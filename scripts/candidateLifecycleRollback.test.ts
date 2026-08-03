import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  rollbackCandidateLifecycleTransition,
} from "../lib/candidateLifecycleRollback";
import {
  buildPersistedWorkflowStateFile,
} from "../lib/recruiterWorkflowPersistence";
import {
  writePersistedRecruiterWorkflowStore,
} from "../lib/recruiterWorkflowStore";

const baseDir =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "candidate-lifecycle-rollback-",
    ),
  );

const stateFile =
  buildPersistedWorkflowStateFile([
    {
      candidateId:
        "candidate-rollback-001",
      displayName:
        "Rollback Candidate",
      currentStatus:
        "submitted_to_client",
      previousStatus:
        "validated",
      priority:
        "high",
      recommendedNextAction:
        "update_client_feedback",
      allowedActions: [
        "update_client_feedback",
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
        false,
      clientSubmissionBlocked:
        false,
      lastInferredAt:
        "2026-08-03T00:00:00.000Z",
      lastUpdatedAt:
        "2026-08-03T10:00:00.000Z",
      source:
        "workflow_inference",
      auditNotes: [],
      lifecycle: {
        lifecycleId:
          "candidate-lifecycle:candidate-rollback-001",
        candidateId:
          "candidate-rollback-001",
        candidateName:
          "Rollback Candidate",
        ownerId:
          "recruiter-001",
        ownerName:
          "Recruiter Example",
        stage:
          "submitted",
        previousStage:
          "screening",
        nextAction:
          "follow_up_client",
        nextActionNote:
          "Follow up client",
        nextActionDueAt:
          null,
        priority:
          "high",
        source:
          "recruiter_updated",
        lastActivityAt:
          "2026-08-03T10:00:00.000Z",
        createdAt:
          "2026-08-03T00:00:00.000Z",
        updatedAt:
          "2026-08-03T10:00:00.000Z",
        history: [],
      },
    },
  ]);

writePersistedRecruiterWorkflowStore(
  stateFile,
  baseDir,
);

const preview =
  rollbackCandidateLifecycleTransition({
    candidateId:
      "candidate-rollback-001",
    expectedStage:
      "submitted",
    actorName:
      "Recruiter Example",
    execute:
      false,
    occurredAt:
      "2026-08-03T11:00:00.000Z",
    baseDir,
  });

assert.equal(
  preview.ok,
  true,
);

assert.equal(
  preview.executed,
  false,
);

assert.equal(
  preview.lifecycle?.stage,
  "screening",
);

const executed =
  rollbackCandidateLifecycleTransition({
    candidateId:
      "candidate-rollback-001",
    expectedStage:
      "submitted",
    actorName:
      "Recruiter Example",
    execute:
      true,
    occurredAt:
      "2026-08-03T11:00:00.000Z",
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
  "screening",
);

assert.equal(
  executed.persistence?.candidateDbWrites,
  0,
);

assert.ok(
  executed.persistence?.backupPath,
);

const persisted =
  JSON.parse(
    fs.readFileSync(
      path.join(
        baseDir,
        "reports",
        "recruiter-workflow-state.json",
      ),
      "utf8",
    ),
  );

assert.equal(
  persisted.states[0].currentStatus,
  "validated",
);

assert.equal(
  persisted.states[0].lifecycle.stage,
  "screening",
);

assert.equal(
  persisted.states[0].lifecycle.history.length,
  1,
);

const stale =
  rollbackCandidateLifecycleTransition({
    candidateId:
      "candidate-rollback-001",
    expectedStage:
      "submitted",
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
  "candidateLifecycleRollback.test.ts passed",
);