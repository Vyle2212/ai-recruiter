import assert from "node:assert/strict";

import {
  previewCandidateLifecycleTransition,
} from "../lib/candidateLifecycleEngine";
import {
  buildCandidateLifecycleRecord,
} from "../lib/candidateLifecycle";

const base = buildCandidateLifecycleRecord({
  id: "candidate-engine-001",
  name: "Lifecycle Engine Candidate",
  status: "screening",
  created_at:
    "2026-08-01T00:00:00.000Z",
  updated_at:
    "2026-08-03T00:00:00.000Z",
});

const allowed =
  previewCandidateLifecycleTransition({
    lifecycle: base,
    toStage: "submitted",
    note:
      "Candidate approved for client submission.",
    actorId: "recruiter-001",
    actorName: "Recruiter Example",
    occurredAt:
      "2026-08-03T10:00:00.000Z",
  });

assert.equal(allowed.allowed, true);
assert.equal(allowed.previewOnly, true);
assert.equal(
  allowed.next?.stage,
  "submitted",
);
assert.equal(
  allowed.next?.previousStage,
  "screening",
);
assert.equal(
  allowed.next?.nextAction,
  "follow_up_client",
);
assert.equal(
  allowed.next?.history.length,
  1,
);
assert.equal(
  allowed.event?.fromStage,
  "screening",
);
assert.equal(
  allowed.event?.toStage,
  "submitted",
);

const missingNote =
  previewCandidateLifecycleTransition({
    lifecycle: base,
    toStage: "submitted",
  });

assert.equal(
  missingNote.allowed,
  false,
);
assert.ok(
  missingNote.blockers.includes(
    "A transition note is required.",
  ),
);

const invalid =
  previewCandidateLifecycleTransition({
    lifecycle: base,
    toStage: "hired",
    note: "Skip directly to hired",
  });

assert.equal(invalid.allowed, false);
assert.match(
  invalid.blockers.join(" "),
  /not allowed/,
);

const interview =
  buildCandidateLifecycleRecord({
    id: "candidate-engine-002",
    name: "Interview Candidate",
    status: "submitted",
  });

const missingDueDate =
  previewCandidateLifecycleTransition({
    lifecycle: interview,
    toStage: "interview",
    note: "Schedule client interview",
  });

assert.equal(
  missingDueDate.allowed,
  false,
);

assert.ok(
  missingDueDate.blockers.includes(
    "A valid due date is required.",
  ),
);

console.log(
  "candidateLifecycleEngine.test.ts passed",
);