import assert from "node:assert/strict";
import Module from "node:module";
import { NextRequest } from "next/server";
import { recruiterRuntimeStore } from "../lib/recruiterRuntimeStore";
import type {
  StateSnapshot,
  StateRepository,
} from "../lib/recruiterDurableState";
import { answerRecruiterCopilotQuestion } from "../lib/recruiterCopilotAnswerEngine";
import { buildRecruiterCopilotContext } from "../lib/recruiterCopilotContext";
import { authorizeRecruiterApiAccess } from "../lib/recruiterApiAuthorizationCore";

async function main() {
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
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    if (request.includes("recruiterRuntimeStore.server"))
      return {
        createRecruiterRuntimeStore: (scope: any) =>
          recruiterRuntimeStore(repository, scope),
      };
    return original.call(this, request, parent, isMain);
  };
  const auth = await import("../lib/recruiterApiAuthorization");
  const history = await import("../app/api/recruiter/copilot/history/route");
  const decisions = await import(
    "../app/api/recruiter/workflow/automation-decisions/route"
  );
  const rules = await import(
    "../app/api/recruiter/workflow/automation-rules/route"
  );
  let role = "recruiter",
    profileId = "one",
    organizationId = "org-one";
  auth.setRecruiterApiAuditSinkForTests(() => {});
  auth.setRecruiterApiAuthorizationResolverForTests(({ policy }) =>
    authorizeRecruiterApiAccess({
      permission: policy.requiredPermission,
      routePolicyId: policy.id,
      log() {},
      adapter: {
        async getUser() {
          return { user: { id: profileId } };
        },
        async getProfile() {
          return {
            profile: {
              id: profileId,
              auth_user_id: profileId,
              role,
              status: "active",
              organization_id: organizationId,
            },
          };
        },
      },
    }),
  );
  const request = (path: string, method = "GET", data?: unknown) =>
    new NextRequest(`https://acceptance.example/api/recruiter/${path}`, {
      method,
      headers: {
        origin: "https://acceptance.example",
        "content-type": "application/json",
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
  try {
    assert.equal(
      (
        await history.POST(
          request("copilot/history", "POST", {
            question: "Test",
            answer: { summary: "old malformed fixture" },
          }),
        )
      ).status,
      400,
    );
    assert.equal(rows.size, 0);
    const question = "What should I focus on today?";
    const answer = answerRecruiterCopilotQuestion(
      question,
      buildRecruiterCopilotContext([]),
    );
    const result = await history.POST(
      request("copilot/history", "POST", {
        conversationId: "roundtrip",
        question,
        answer,
      }),
    );
    assert.equal(result.status, 201);
    assert.equal(
      (await result.json()).conversation.conversationId,
      "roundtrip",
    );
    assert.equal(
      (await (await history.GET(request("copilot/history"))).json())
        .conversations.length,
      1,
    );
    profileId = "two";
    assert.equal(
      (await (await history.GET(request("copilot/history"))).json())
        .conversations.length,
      0,
    );
    profileId = "one";
    assert.equal(
      (
        await history.DELETE(
          request("copilot/history?conversationId=roundtrip", "DELETE"),
        )
      ).status,
      200,
    );
    assert.equal(
      (await (await history.GET(request("copilot/history"))).json())
        .conversations.length,
      0,
    );
    assert.equal(
      (
        await decisions.POST(
          request("workflow/automation-decisions", "POST", {}),
        )
      ).status,
      403,
    );
    role = "recruiter_manager";
    const approval = {
      proposalId: "proposal",
      candidateId: "synthetic",
      ruleId: "overdue_follow_up",
      proposedAction: "review",
      decision: "approved",
      reviewerId: "forged",
    };
    assert.equal(
      (
        await decisions.POST(
          request("workflow/automation-decisions", "POST", approval),
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await (
          await decisions.GET(request("workflow/automation-decisions"))
        ).json()
      ).decisions[0].reviewerId,
      "one",
    );
    organizationId = "org-two";
    assert.equal(
      (
        await (
          await decisions.GET(request("workflow/automation-decisions"))
        ).json()
      ).decisions.length,
      0,
    );
    organizationId = "org-one";
    assert.equal(
      (
        await decisions.DELETE(
          request(
            "workflow/automation-decisions?proposalId=proposal",
            "DELETE",
          ),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await (
          await decisions.GET(request("workflow/automation-decisions"))
        ).json()
      ).decisions.length,
      0,
    );
    assert.equal(
      (
        await rules.POST(
          request("workflow/automation-rules", "POST", {
            ruleId: "overdue_follow_up",
            enabled: false,
          }),
        )
      ).status,
      403,
    );
    role = "admin";
    assert.equal(
      (
        await rules.POST(
          request("workflow/automation-rules", "POST", {
            ruleId: "overdue_follow_up",
            enabled: false,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await (await rules.GET(request("workflow/automation-rules"))).json())
        .rules[0].enabled,
      false,
    );
    assert.equal(
      (await rules.DELETE(request("workflow/automation-rules", "DELETE")))
        .status,
      200,
    );
    role = "client";
    assert.equal((await history.GET(request("copilot/history"))).status, 403);
    assert.equal(
      (await decisions.GET(request("workflow/automation-decisions"))).status,
      403,
    );
    console.log(
      "PASS route integration: malformed input 400, history and decision create/read/delete, actor and tenant isolation, authoritative reviewer, role denials, rule persistence",
    );
  } finally {
    auth.setRecruiterApiAuthorizationResolverForTests(null);
    auth.setRecruiterApiAuditSinkForTests(null);
    runtime._load = original;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
