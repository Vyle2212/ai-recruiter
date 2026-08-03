import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  executeCandidateLifecycleTransition,
} from "../lib/candidateLifecyclePersistence";
import {
  buildPersistedWorkflowStateFile,
} from "../lib/recruiterWorkflowPersistence";
import {
  writePersistedRecruiterWorkflowStore,
} from "../lib/recruiterWorkflowStore";

const baseDir = fs.mkdtempSync(
  path.join(
    os.tmpdir(),
    "candidate-lifecycle-persistence-",
  ),
);

const initial =
  buildPersistedWorkflowStateFile([
    {
      candidateId:
        "candidate-persist-001",
      displayName:
        "Persistence Candidate",
      currentStatus:
        "validated",
      priority:
        "high",
      recommendedNextAction:
        "generate_submission",
      allowedActions: [
        "generate_submission",
        "mark_rejected",
        "archive_candidate",
      ],
      blockedActions: [],
      blockerReasons: [],
      missingFields: [],
      validationStatus:
        "validated_or_pending_review",
      profileQualityStatus:
        "Profile quality usable",
      aiReviewStatus:
        "no_ai_review_blocker",
      stagingStatus:
        "not_staged_by_workflow",
      applyHistoryStatus:
        "not_applied_by_workflow",
      readyForShortlist:
        true,
      clientSubmissionBlocked:
        false,
      lastInferredAt:
        "2026-08-03T00:00:00.000Z",
      lastUpdatedAt:
        "2026-08-03T00:00:00.000Z",
      source:
        "workflow_inference",
      auditNotes: [],
    },
  ]);

writePersistedRecruiterWorkflowStore(
  initial,
  baseDir,
);

const preview =
  executeCandidateLifecycleTransition({
    candidateId:
      "candidate-persist-001",
    toStage:
      "submitted",
    expectedStage:
      "screening",
    note:
      "Approved for client submission.",
    actorId:
      "recruiter-001",
    actorName:
      "Recruiter Example",
    execute:
      false,
    occurredAt:
      "2026-08-03T10:00:00.000Z",
    baseDir,
  });

assert.equal(
  preview.executed,
  false,
);

const statePath = path.join(
  baseDir,
  "reports",
  "recruiter-workflow-state.json",
);

const beforeExecute =
  fs.readFileSync(
    statePath,
    "utf8",
  );

const executed =
  executeCandidateLifecycleTransition({
    candidateId:
      "candidate-persist-001",
    toStage:
      "submitted",
    expectedStage:
      "screening",
    note:
      "Approved for client submission.",
    actorId:
      "recruiter-001",
    actorName:
      "Recruiter Example",
    execute:
      true,
    occurredAt:
      "2026-08-03T10:00:00.000Z",
    baseDir,
  });

assert.equal(
  executed.ok,
  true,
);

assert.equal(
  executed.executed,
  true,
);

assert.equal(
  executed.lifecycle?.stage,
  "submitted",
);

assert.equal(
  executed.persistence?.candidateDbWrites,
  0,
);

assert.ok(
  executed.persistence?.backupPath,
);

const afterExecute =
  fs.readFileSync(
    statePath,
    "utf8",
  );

assert.notEqual(
  afterExecute,
  beforeExecute,
);

const parsed =
  JSON.parse(afterExecute);

assert.equal(
  parsed.states[0].currentStatus,
  "submitted_to_client",
);

assert.equal(
  parsed.states[0].lifecycle.stage,
  "submitted",
);

assert.equal(
  parsed.states[0].lifecycle.history.length,
  1,
);

const stale =
  executeCandidateLifecycleTransition({
    candidateId:
      "candidate-persist-001",
    toStage:
      "interview",
    expectedStage:
      "screening",
    note:
      "Interview planned.",
    dueAt:
      "2026-08-05T00:00:00.000Z",
    execute:
      true,
    baseDir,
  });

assert.equal(
  stale.ok,
  false,
);

assert.equal(
  stale.status,
  409,
);

fs.rmSync(
  baseDir,
  {
    recursive: true,
    force: true,
  },
);

console.log(
  "candidateLifecyclePersistence.test.ts passed",
);