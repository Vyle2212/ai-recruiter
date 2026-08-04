import assert from "node:assert/strict";

import {
  answerRecruiterCopilotQuestion,
  detectRecruiterCopilotIntent,
} from "../lib/recruiterCopilotAnswerEngine";
import {
  buildRecruiterCopilotContext,
} from "../lib/recruiterCopilotContext";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const NOW =
  "2026-08-03T12:00:00.000Z";

function lifecycleEvent(
  overrides: Partial<CandidateLifecycleEvent> = {},
): CandidateLifecycleEvent {
  return {
    eventId:
      "lifecycle-event:candidate-1:2026-08-03T08:00:00.000Z",
    candidateId:
      "candidate-1",
    fromStage:
      "screening",
    toStage:
      "submitted",
    action:
      "follow_up_client",
    note:
      "Submitted to client",
    source:
      "recruiter_updated",
    actorId:
      "user-1",
    actorName:
      "Vy",
    occurredAt:
      "2026-08-03T08:00:00.000Z",
    ...overrides,
  };
}

function lifecycle(
  overrides: Partial<CandidateLifecycleRecord> = {},
): CandidateLifecycleRecord {
  return {
    lifecycleId:
      "candidate-lifecycle:candidate-1",
    candidateId:
      "candidate-1",
    candidateName:
      "Candidate One",
    ownerId:
      "user-1",
    ownerName:
      "Vy",
    stage:
      "submitted",
    previousStage:
      "screening",
    nextAction:
      "follow_up_client",
    nextActionNote:
      "Follow up client",
    nextActionDueAt:
      "2026-08-01T09:00:00.000Z",
    priority:
      "medium",
    source:
      "recruiter_updated",
    lastActivityAt:
      "2026-08-03T08:00:00.000Z",
    createdAt:
      "2026-08-01T00:00:00.000Z",
    updatedAt:
      "2026-08-03T08:00:00.000Z",
    history: [
      lifecycleEvent(),
    ],
    ...overrides,
  };
}

function state(
  value: CandidateLifecycleRecord,
): PersistedWorkflowState {
  return {
    candidateId:
      value.candidateId,
    displayName:
      value.candidateName,
    lifecycle: value,
    lastUpdatedAt:
      value.updatedAt,
  } as PersistedWorkflowState;
}

const context =
  buildRecruiterCopilotContext(
    [
      state(lifecycle()),
    ],
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

assert.equal(
  detectRecruiterCopilotIntent(
    "What should I focus on today?",
  ).intent,
  "today_priorities",
);

assert.equal(
  detectRecruiterCopilotIntent(
    "How many overdue follow-ups are there?",
  ).intent,
  "overdue_followups",
);

assert.equal(
  detectRecruiterCopilotIntent(
    "Where is the biggest bottleneck?",
  ).intent,
  "pipeline_bottleneck",
);

assert.equal(
  detectRecruiterCopilotIntent(
    "Which recruiter has the most activity?",
  ).intent,
  "top_recruiter",
);

assert.equal(
  detectRecruiterCopilotIntent(
    "Which candidate should I review first?",
  ).intent,
  "candidate_priority",
);

assert.equal(
  detectRecruiterCopilotIntent(
    "How is workflow health?",
  ).intent,
  "workflow_health",
);

const today =
  answerRecruiterCopilotQuestion(
    "What should I focus on today?",
    context,
  );

assert.equal(
  today.intent,
  "today_priorities",
);

assert.match(
  today.answer,
  /overdue/i,
);

assert.ok(
  today.evidence.length > 0,
);

assert.ok(
  today.suggestedActions.length > 0,
);

const overdue =
  answerRecruiterCopilotQuestion(
    "Show overdue follow-ups",
    context,
  );

assert.equal(
  overdue.intent,
  "overdue_followups",
);

assert.equal(
  overdue.safety.openAiCalls,
  0,
);

assert.equal(
  overdue.safety.candidateDbWrites,
  0,
);

const candidate =
  answerRecruiterCopilotQuestion(
    "Which candidate should I review first?",
    context,
  );

assert.equal(
  candidate.intent,
  "candidate_priority",
);

assert.match(
  candidate.title,
  /Candidate One/,
);

const unknown =
  answerRecruiterCopilotQuestion(
    "Tell me something random",
    context,
  );

assert.equal(
  unknown.intent,
  "unknown",
);

assert.match(
  unknown.answer,
  /Try asking/i,
);

assert.equal(
  unknown.safety.deterministic,
  true,
);

assert.match(
  unknown.mode,
  /no OpenAI calls/,
);

console.log(
  "recruiterCopilotAnswerEngine.test.ts passed",
);