import assert from "node:assert/strict";

import {
  buildCandidateLifecycleRecord,
  getDefaultNextAction,
  isCandidatePipelineStage,
  mapLegacyStatusToPipelineStage,
} from "../lib/candidateLifecycle";

assert.equal(
  mapLegacyStatusToPipelineStage("new_profile"),
  "sourced",
);

assert.equal(
  mapLegacyStatusToPipelineStage(
    "ready_for_shortlist",
  ),
  "screening",
);

assert.equal(
  mapLegacyStatusToPipelineStage(
    "submitted_to_client",
  ),
  "submitted",
);

assert.equal(
  mapLegacyStatusToPipelineStage(
    "interview_process",
  ),
  "interview",
);

assert.equal(
  mapLegacyStatusToPipelineStage(
    "offer_process",
  ),
  "offer",
);

assert.equal(
  mapLegacyStatusToPipelineStage("placed"),
  "hired",
);

assert.equal(
  mapLegacyStatusToPipelineStage("rejected"),
  "rejected",
);

assert.equal(
  mapLegacyStatusToPipelineStage("archived"),
  "on_hold",
);

assert.equal(
  isCandidatePipelineStage("screening"),
  true,
);

assert.equal(
  isCandidatePipelineStage("unknown"),
  false,
);

assert.equal(
  getDefaultNextAction("submitted"),
  "follow_up_client",
);

const record = buildCandidateLifecycleRecord(
  {
    id: "candidate-001",
    name: "Example Candidate",
    status: "interviewed",
    recruiter_id: "recruiter-001",
    recruiter_name: "Example Recruiter",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-03T00:00:00.000Z",
  },
  {
    priority: "high",
    dueDate: "2026-08-05T00:00:00.000Z",
  },
);

assert.equal(record.candidateId, "candidate-001");
assert.equal(record.stage, "interview");
assert.equal(
  record.nextAction,
  "collect_interview_feedback",
);
assert.equal(record.priority, "high");
assert.equal(
  record.ownerName,
  "Example Recruiter",
);
assert.equal(
  record.nextActionDueAt,
  "2026-08-05T00:00:00.000Z",
);
assert.deepEqual(record.history, []);

console.log(
  "candidateLifecycle.test.ts passed",
);