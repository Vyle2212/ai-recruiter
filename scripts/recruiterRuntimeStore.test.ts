import assert from "node:assert/strict";
import { recruiterRuntimeStore } from "../lib/recruiterRuntimeStore";
import {
  type StateRepository,
  type StateKey,
  type StateSnapshot,
  RecruiterStateUnavailable,
  stateKey,
  supabaseStateRepository,
} from "../lib/recruiterDurableState";
import { isRecruiterCopilotHistoryAnswer } from "../lib/recruiterCopilotHistoryInput";
import { answerRecruiterCopilotQuestion } from "../lib/recruiterCopilotAnswerEngine";
import { buildRecruiterCopilotContext } from "../lib/recruiterCopilotContext";

const rows = new Map<string, StateSnapshot>();
const repository: StateRepository = {
  async read(key) {
    return structuredClone(rows.get(JSON.stringify(key)) ?? null);
  },
  async compareAndSet(key, revision, payload) {
    const id = JSON.stringify(key),
      current = rows.get(id);
    if ((current?.revision ?? null) !== revision) return false;
    rows.set(id, {
      revision: (revision ?? 0) + 1,
      payload: structuredClone(payload),
    });
    return true;
  },
};
const scope = { organizationId: "org-a", profileId: "recruiter-a" };
const fresh = () => recruiterRuntimeStore(repository, scope);
const otherUser = recruiterRuntimeStore(repository, {
  ...scope,
  profileId: "recruiter-b",
});
const otherOrg = recruiterRuntimeStore(repository, {
  organizationId: "org-b",
  profileId: "recruiter-a",
});
const question = "What should I focus on today?";
const answer = answerRecruiterCopilotQuestion(
  question,
  buildRecruiterCopilotContext([]),
);
assert.equal(isRecruiterCopilotHistoryAnswer(answer), true);
for (const value of [
  null,
  {},
  { summary: "Synthetic acceptance answer" },
  { ...answer, evidence: null },
  { ...answer, suggestedActions: {} },
  { ...answer, confidence: NaN },
  { ...answer, generatedAt: "invalid" },
]) {
  assert.equal(isRecruiterCopilotHistoryAnswer(value), false);
}
async function main() {
  // Separate store instances model separate requests; no process-local store cache.
  await fresh().appendRecruiterCopilotExchange({
    conversationId: "one",
    question,
    answer,
  });
  assert.equal(
    (await fresh().readRecruiterCopilotConversations()).conversations[0]
      .messages[1].content,
    answer.answer,
  );
  assert.equal(
    (await otherUser.readRecruiterCopilotConversations()).conversations.length,
    0,
  );
  assert.equal(
    (await otherOrg.readRecruiterCopilotConversations()).conversations.length,
    0,
  );
  await otherUser.deleteRecruiterCopilotConversation("one");
  assert.equal(
    (await fresh().readRecruiterCopilotConversations()).conversations.length,
    1,
  );
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      fresh().appendRecruiterCopilotExchange({
        conversationId: "one",
        question: `Concurrent ${i}`,
        answer,
      }),
    ),
  );
  assert.equal(
    (await fresh().readRecruiterCopilotConversations()).conversations[0]
      .messages.length,
    12,
  );
  await fresh().deleteRecruiterCopilotConversation("one");
  assert.equal(
    (await fresh().readRecruiterCopilotConversations()).conversations.length,
    0,
  );

  const decision = {
    proposalId: "proposal",
    candidateId: "synthetic",
    ruleId: "overdue_follow_up",
    proposedAction: "review",
    decision: "approved" as const,
    reviewerId: "forged",
  };
  await fresh().saveWorkflowAutomationDecision(decision);
  assert.equal(
    (await otherUser.readWorkflowAutomationDecisions()).decisions[0].reviewerId,
    scope.profileId,
  );
  assert.equal(
    (await otherOrg.readWorkflowAutomationDecisions()).decisions.length,
    0,
  );
  await fresh().deleteWorkflowAutomationDecision("proposal");
  assert.equal(
    (await fresh().readWorkflowAutomationDecisions()).decisions.length,
    0,
  );
  await fresh().saveWorkflowAutomationRuleConfig({
    ruleId: "overdue_follow_up",
    enabled: false,
    updatedBy: "forged",
  });
  const saved = (await otherUser.readWorkflowAutomationRuleConfigs()).rules[0];
  assert.equal(saved.enabled, false);
  assert.equal(saved.updatedBy, scope.profileId);
  assert.equal(
    (await otherOrg.readWorkflowAutomationRuleConfigs()).rules[0].enabled,
    true,
  );
  await fresh().resetWorkflowAutomationRuleConfigs();
  assert.equal(
    (await fresh().readWorkflowAutomationRuleConfigs()).rules[0].enabled,
    true,
  );
  assert.throws(
    () => stateKey({ organizationId: null, profileId: "x" }, "copilot_history"),
    RecruiterStateUnavailable,
  );

  // Storage outages must fail, never fall back to files or successful empty responses.
  const unavailable = recruiterRuntimeStore(
    {
      async read() {
        throw new RecruiterStateUnavailable();
      },
      async compareAndSet() {
        return false;
      },
    },
    scope,
  );
  await assert.rejects(
    unavailable.readRecruiterCopilotConversations(),
    RecruiterStateUnavailable,
  );
  await assert.rejects(
    unavailable.appendRecruiterCopilotExchange({ question, answer }),
    RecruiterStateUnavailable,
  );
  const contended = recruiterRuntimeStore(
    {
      read: repository.read,
      async compareAndSet() {
        return false;
      },
    },
    scope,
  );
  await assert.rejects(
    contended.appendRecruiterCopilotExchange({ question, answer }),
    RecruiterStateUnavailable,
  );

  // Exercise the actual Supabase adapter's scope predicates and revision condition.
  const filters: [string, unknown][] = [];
  const query = {
    eq(field: string, value: unknown) {
      filters.push([field, value]);
      return query;
    },
    select() {
      return Promise.resolve({ data: [{ revision: 2 }], error: null });
    },
  };
  const client = {
    from(table: string) {
      assert.equal(table, "recruiter_runtime_state");
      return {
        update() {
          return query;
        },
      };
    },
  };
  const adapter = supabaseStateRepository(client as any);
  const key: StateKey = stateKey(scope, "copilot_history");
  assert.equal(await adapter.compareAndSet(key, 1, {}), true);
  assert.deepEqual(filters, [
    ["organization_id", "org-a"],
    ["owner_key", "recruiter-a"],
    ["kind", "copilot_history"],
    ["revision", 1],
  ]);
  console.log(
    "PASS durable state: round trips, user/organization isolation, concurrent writes, deletes, authoritative ownership, outages, CAS scoping, malformed answer",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
