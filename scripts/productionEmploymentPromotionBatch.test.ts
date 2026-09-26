import assert from "node:assert/strict";
import {
  buildEmploymentPromotionExecutionAuthorization,
  executeEmploymentPromotionBatch,
  preflightEmploymentPromotionBatch,
  serializeEmploymentPromotionPreflightReport,
  type EmploymentPromotionCandidateState,
  type EmploymentPromotionManifest,
  type EmploymentPromotionTransaction,
  type EmploymentPromotionTransactionalRepository,
} from "../lib/productionEmploymentPromotionBatch";
import {
  buildEmploymentPromotionPlan,
  type EmploymentPromotionApproval,
  type StoredEmploymentRow,
} from "../lib/productionEmploymentAdditivePromotion";
import type { EnterpriseEmployment } from "../lib/candidate360SchemaNormalize";

const commitSha = "a".repeat(40);
const sourceUpdatedAt = "2026-09-24T01:00:00Z";
const backupAt = "2026-09-24T01:10:00Z";
const authorizedAt = "2026-09-24T01:15:00Z";

function projected(
  id: string,
  company: string,
  title: string,
  start: string,
  end: string,
): EnterpriseEmployment {
  return {
    id,
    company,
    title,
    location: "",
    companyType: "",
    modules: [],
    achievements: [],
    start,
    end,
    duration: "",
    current: false,
    provenance: [
      {
        sourceType: "employment",
        sourceRef: "synthetic.fixture",
        label: "Synthetic fixture",
      },
    ],
  };
}

function approvedEntry(input: {
  candidateId: string;
  stored: StoredEmploymentRow[];
  projected: EnterpriseEmployment[];
}) {
  const plan = buildEmploymentPromotionPlan({
    candidateId: input.candidateId,
    sourceUpdatedAt,
    stored: input.stored,
    projected: input.projected,
  });
  const approval: EmploymentPromotionApproval = {
    candidateId: plan.candidateId,
    sourceUpdatedAt: plan.sourceUpdatedAt,
    storedFingerprint: plan.storedFingerprint,
    projectedFingerprint: plan.projectedFingerprint,
    planFingerprint: plan.planFingerprint,
    decision: "approve_additions",
    reviewedBy: "synthetic-reviewer",
    reviewedAt: "2026-09-24T01:05:00Z",
  };
  return { plan, approval };
}

const existing: StoredEmploymentRow[] = [
  {
    id: "stored-role",
    company: "Existing Example",
    title: "ERP Analyst",
    startDate: "2018",
    endDate: "2019",
    current: false,
  },
];
const emptyEntry = approvedEntry({
  candidateId: "synthetic-empty",
  stored: [],
  projected: [
    projected("new-a", "Alpha Example", "SAP Consultant", "2020", "2021"),
  ],
});
const additiveEntry = approvedEntry({
  candidateId: "synthetic-additive",
  stored: existing,
  projected: [
    projected(
      "existing-copy",
      "Existing Example",
      "ERP Analyst",
      "2018",
      "2019",
    ),
    projected("new-b", "Beta Example", "SAP Lead", "2022", ""),
  ],
});
const manifest: EmploymentPromotionManifest = {
  artifact: "reviewed_employment_promotion_manifest_v1",
  generatedAt: "2026-09-24T01:06:00Z",
  targetCommitSha: commitSha,
  entries: [emptyEntry, additiveEntry],
};
const currentCandidates: EmploymentPromotionCandidateState[] = [
  {
    candidateId: "synthetic-empty",
    sourceUpdatedAt,
    employmentHistory: [],
  },
  {
    candidateId: "synthetic-additive",
    sourceUpdatedAt,
    employmentHistory: existing,
  },
];

const preflight = preflightEmploymentPromotionBatch({
  manifest,
  currentCandidates,
  expectedCommitSha: commitSha,
});
assert.equal(preflight.entries, 2);
assert.equal(preflight.additions, 2);
assert.equal(preflight.emptyToPopulated, 1);
assert.equal(preflight.existingAdditive, 1);
assert.equal(preflight.databaseWrites, 0);
const publicReport = JSON.stringify(
  serializeEmploymentPromotionPreflightReport(preflight),
);
assert.doesNotMatch(
  publicReport,
  /synthetic-empty|synthetic-additive|Existing Example|Alpha Example|Beta Example/,
);

assert.throws(
  () =>
    preflightEmploymentPromotionBatch({
      manifest,
      currentCandidates,
      expectedCommitSha: "b".repeat(40),
    }),
  /target commit mismatch/,
);
assert.throws(
  () =>
    preflightEmploymentPromotionBatch({
      manifest: { ...manifest, entries: [emptyEntry, emptyEntry] },
      currentCandidates,
      expectedCommitSha: commitSha,
    }),
  /duplicate candidate IDs/,
);
assert.throws(
  () =>
    preflightEmploymentPromotionBatch({
      manifest: { ...manifest, generatedAt: "2026-09-24T01:04:00Z" },
      currentCandidates,
      expectedCommitSha: commitSha,
    }),
  /manifest predates its reviews/,
);

class MemoryRepository implements EmploymentPromotionTransactionalRepository {
  transactional = true as const;
  states = new Map(
    currentCandidates.map((candidate) => [
      candidate.candidateId,
      structuredClone(candidate),
    ]),
  );
  mismatchCandidate = "";

  async transaction<T>(
    callback: (transaction: EmploymentPromotionTransaction) => Promise<T>,
  ): Promise<T> {
    const snapshot = structuredClone(this.states);
    try {
      return await callback({
        lockCandidate: async (candidateId) =>
          structuredClone(this.states.get(candidateId) ?? null),
        updateCandidateEmployment: async (input) => {
          const current = this.states.get(input.candidateId);
          if (!current || current.sourceUpdatedAt !== input.expectedUpdatedAt)
            return { matchedRows: 0 };
          this.states.set(input.candidateId, {
            candidateId: input.candidateId,
            sourceUpdatedAt: "2026-09-24T01:20:00Z",
            employmentHistory: structuredClone(input.employmentHistory),
          });
          return { matchedRows: 1 };
        },
        readCandidate: async (candidateId) => {
          const value = structuredClone(this.states.get(candidateId) ?? null);
          if (value && candidateId === this.mismatchCandidate)
            value.employmentHistory = [];
          return value;
        },
      });
    } catch (error) {
      this.states = snapshot;
      throw error;
    }
  }
}

const backup = {
  artifact: "verified_candidate_backup_v1" as const,
  capturedAt: backupAt,
  candidateCount: preflight.entries,
  candidateSetFingerprint: preflight.candidateSetFingerprint,
  sourceStateFingerprint: preflight.sourceStateFingerprint,
  verification: "readback_verified" as const,
};
const authorization = buildEmploymentPromotionExecutionAuthorization({
  preflight,
  backup,
  authorizedBy: "synthetic-release-owner",
  authorizedAt,
  expectedCommitSha: commitSha,
});

async function main() {
  const repository = new MemoryRepository();
  const result = await executeEmploymentPromotionBatch({
    preflight,
    repository,
    backup,
    authorization,
    expectedCommitSha: commitSha,
  });
  assert.equal(result.candidatesUpdated, 2);
  assert.equal(result.additionsWritten, 2);
  assert.equal(result.readbacksVerified, 2);
  assert.equal(result.transactionCommitted, true);
  assert.equal(
    repository.states.get("synthetic-additive")?.employmentHistory.length,
    2,
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /synthetic-empty|synthetic-additive|Existing Example|Alpha Example|Beta Example/,
  );

  await assert.rejects(
    () =>
      executeEmploymentPromotionBatch({
        preflight,
        repository: new MemoryRepository(),
        backup: { ...backup, candidateCount: 1 },
        authorization,
        expectedCommitSha: commitSha,
      }),
    /backup does not cover this batch/,
  );
  await assert.rejects(
    () =>
      executeEmploymentPromotionBatch({
        preflight,
        repository: new MemoryRepository(),
        backup: { ...backup, capturedAt: "2026-09-24T00:59:00Z" },
        authorization,
        expectedCommitSha: commitSha,
      }),
    /backup predates the reviewed source state/,
  );
  await assert.rejects(
    () =>
      executeEmploymentPromotionBatch({
        preflight,
        repository: new MemoryRepository(),
        backup,
        authorization: {
          ...authorization,
          preflightFingerprint: "0".repeat(64),
        },
        expectedCommitSha: commitSha,
      }),
    /authorization content changed/,
  );
  const sameVersionPayloadChange = new MemoryRepository();
  sameVersionPayloadChange.states.set("synthetic-additive", {
    candidateId: "synthetic-additive",
    sourceUpdatedAt,
    employmentHistory: [
      ...existing,
      { company: "Concurrent Example", title: "Unreviewed role" },
    ],
  });
  await assert.rejects(
    () =>
      executeEmploymentPromotionBatch({
        preflight,
        repository: sameVersionPayloadChange,
        backup,
        authorization,
        expectedCommitSha: commitSha,
      }),
    /locked employment payload changed/,
  );
  await assert.rejects(
    () =>
      executeEmploymentPromotionBatch({
        preflight: {
          ...preflight,
          operations: [
            { ...preflight.operations[0], employmentHistory: [] },
            preflight.operations[1],
          ],
        },
        repository: new MemoryRepository(),
        backup,
        authorization,
        expectedCommitSha: commitSha,
      }),
    /preflight operations changed/,
  );

  const rollbackRepository = new MemoryRepository();
  rollbackRepository.mismatchCandidate = "synthetic-additive";
  await assert.rejects(
    () =>
      executeEmploymentPromotionBatch({
        preflight,
        repository: rollbackRepository,
        backup,
        authorization,
        expectedCommitSha: commitSha,
      }),
    /readback mismatch/,
  );
  assert.equal(
    rollbackRepository.states.get("synthetic-empty")?.employmentHistory.length,
    0,
    "the first update must roll back when a later readback fails",
  );
  assert.equal(
    rollbackRepository.states.get("synthetic-additive")?.employmentHistory
      .length,
    1,
  );

  console.log("Production employment promotion batch regression passed.");
}

void main();
