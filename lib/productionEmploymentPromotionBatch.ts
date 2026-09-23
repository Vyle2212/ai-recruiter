import { createHash } from "node:crypto";
import {
  buildApprovedAdditiveEmploymentMerge,
  type EmploymentPromotionApproval,
  type EmploymentPromotionPlan,
  type StoredEmploymentRow,
} from "./productionEmploymentAdditivePromotion";

export type EmploymentPromotionManifest = {
  artifact: "reviewed_employment_promotion_manifest_v1";
  generatedAt: string;
  targetCommitSha: string;
  entries: Array<{
    plan: EmploymentPromotionPlan;
    approval: EmploymentPromotionApproval;
  }>;
};

export type EmploymentPromotionCandidateState = {
  candidateId: string;
  sourceUpdatedAt: string;
  employmentHistory: StoredEmploymentRow[];
};

export type EmploymentPromotionBatchOperation = {
  candidateId: string;
  expectedUpdatedAt: string;
  expectedEmploymentHistory: StoredEmploymentRow[];
  employmentHistory: StoredEmploymentRow[];
  addedRows: number;
  queue: EmploymentPromotionPlan["queue"];
};

export type EmploymentPromotionBatchPreflight = {
  artifact: "reviewed_employment_promotion_preflight_v1";
  targetCommitSha: string;
  manifestGeneratedAt: string;
  latestSourceUpdatedAt: string;
  manifestFingerprint: string;
  operationsFingerprint: string;
  preflightFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  entries: number;
  additions: number;
  emptyToPopulated: number;
  existingAdditive: number;
  operations: EmploymentPromotionBatchOperation[];
  privacy: {
    candidateIdentifiersSerializedInReport: 0;
    employmentRowsSerializedInReport: 0;
  };
  databaseWrites: 0;
};

export type EmploymentPromotionBackupEvidence = {
  artifact: "verified_candidate_backup_v1";
  capturedAt: string;
  candidateCount: number;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  verification: "readback_verified";
};

export type EmploymentPromotionExecutionAuthorization = {
  decision: "authorize_reviewed_additive_backfill";
  authorizedBy: string;
  authorizedAt: string;
  targetCommitSha: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
};

export type EmploymentPromotionTransaction = {
  lockCandidate(
    candidateId: string,
  ): Promise<EmploymentPromotionCandidateState | null>;
  updateCandidateEmployment(input: {
    candidateId: string;
    expectedUpdatedAt: string;
    employmentHistory: StoredEmploymentRow[];
  }): Promise<{ matchedRows: number }>;
  readCandidate(
    candidateId: string,
  ): Promise<EmploymentPromotionCandidateState | null>;
};

export type EmploymentPromotionTransactionalRepository = {
  transactional: true;
  transaction<T>(
    callback: (transaction: EmploymentPromotionTransaction) => Promise<T>,
  ): Promise<T>;
};

export type EmploymentPromotionExecutionReport = {
  artifact: "reviewed_employment_promotion_execution_v1";
  targetCommitSha: string;
  manifestFingerprint: string;
  candidatesUpdated: number;
  additionsWritten: number;
  readbacksVerified: number;
  transactionCommitted: true;
  privacy: {
    candidateIdentifiersSerialized: 0;
    employmentRowsSerialized: 0;
  };
};

export type EmploymentPromotionExecutionGateInput = {
  preflight: EmploymentPromotionBatchPreflight;
  backup: EmploymentPromotionBackupEvidence;
  authorization: EmploymentPromotionExecutionAuthorization;
  expectedCommitSha: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: unknown) {
  return Boolean(clean(value)) && Number.isFinite(Date.parse(clean(value)));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function candidateSetFingerprint(candidateIds: readonly string[]) {
  return fingerprint([...candidateIds].sort());
}

function assertSha(value: string, label: string) {
  if (!/^[a-f0-9]{40}$/i.test(value))
    throw new Error(`${label} must be a full commit SHA`);
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains duplicate candidate IDs`);
}

function publicPreflight(
  preflight: EmploymentPromotionBatchPreflight,
): Omit<EmploymentPromotionBatchPreflight, "operations"> {
  const { operations: _privateOperations, ...report } = preflight;
  return report;
}

function preflightFingerprintContents(
  preflight: Omit<EmploymentPromotionBatchPreflight, "preflightFingerprint">,
) {
  return {
    artifact: preflight.artifact,
    targetCommitSha: preflight.targetCommitSha,
    manifestGeneratedAt: preflight.manifestGeneratedAt,
    latestSourceUpdatedAt: preflight.latestSourceUpdatedAt,
    manifestFingerprint: preflight.manifestFingerprint,
    operationsFingerprint: preflight.operationsFingerprint,
    candidateSetFingerprint: preflight.candidateSetFingerprint,
    sourceStateFingerprint: preflight.sourceStateFingerprint,
    entries: preflight.entries,
    additions: preflight.additions,
    emptyToPopulated: preflight.emptyToPopulated,
    existingAdditive: preflight.existingAdditive,
    privacy: preflight.privacy,
    databaseWrites: preflight.databaseWrites,
  };
}

function assertPreflightIntegrity(
  preflight: EmploymentPromotionBatchPreflight,
) {
  const { preflightFingerprint, ...withoutPreflightFingerprint } = preflight;
  if (
    fingerprint(preflightFingerprintContents(withoutPreflightFingerprint)) !==
    preflightFingerprint
  )
    throw new Error(
      "Employment promotion execution refused: preflight metadata changed",
    );
  const operationIds = preflight.operations.map(
    ({ candidateId }) => candidateId,
  );
  assertUnique(operationIds, "preflight operations");
  if (fingerprint(preflight.operations) !== preflight.operationsFingerprint)
    throw new Error(
      "Employment promotion execution refused: preflight operations changed",
    );
  if (
    candidateSetFingerprint(operationIds) !== preflight.candidateSetFingerprint
  )
    throw new Error(
      "Employment promotion execution refused: preflight candidate set changed",
    );
  if (preflight.entries !== preflight.operations.length)
    throw new Error(
      "Employment promotion execution refused: preflight entry count changed",
    );
  if (
    preflight.additions !==
    preflight.operations.reduce(
      (sum, operation) => sum + operation.addedRows,
      0,
    )
  )
    throw new Error(
      "Employment promotion execution refused: preflight addition count changed",
    );
  if (
    preflight.emptyToPopulated !==
      preflight.operations.filter(
        ({ queue }) => queue === "empty_to_populated_review",
      ).length ||
    preflight.existingAdditive !==
      preflight.operations.filter(
        ({ queue }) => queue === "existing_additive_review",
      ).length
  )
    throw new Error(
      "Employment promotion execution refused: preflight queue counts changed",
    );
}

export function serializeEmploymentPromotionPreflightReport(
  preflight: EmploymentPromotionBatchPreflight,
) {
  return publicPreflight(preflight);
}

export function preflightEmploymentPromotionBatch(input: {
  manifest: EmploymentPromotionManifest;
  currentCandidates: readonly EmploymentPromotionCandidateState[];
  expectedCommitSha: string;
}): EmploymentPromotionBatchPreflight {
  const { manifest, currentCandidates } = input;
  if (manifest.artifact !== "reviewed_employment_promotion_manifest_v1")
    throw new Error(
      "Employment promotion preflight refused: manifest artifact mismatch",
    );
  assertSha(manifest.targetCommitSha, "manifest targetCommitSha");
  assertSha(input.expectedCommitSha, "expectedCommitSha");
  if (manifest.targetCommitSha !== input.expectedCommitSha)
    throw new Error(
      "Employment promotion preflight refused: target commit mismatch",
    );
  if (!validDate(manifest.generatedAt))
    throw new Error(
      "Employment promotion preflight refused: invalid generatedAt",
    );
  if (!manifest.entries.length)
    throw new Error(
      "Employment promotion preflight refused: manifest is empty",
    );
  const latestReviewedAt = manifest.entries
    .map(({ approval }) => approval.reviewedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  if (
    !validDate(latestReviewedAt) ||
    Date.parse(manifest.generatedAt) < Date.parse(latestReviewedAt)
  )
    throw new Error(
      "Employment promotion preflight refused: manifest predates its reviews",
    );

  const entryIds = manifest.entries.map(({ plan }) => clean(plan.candidateId));
  const currentIds = currentCandidates.map(({ candidateId }) =>
    clean(candidateId),
  );
  if (entryIds.some((id) => !id) || currentIds.some((id) => !id))
    throw new Error(
      "Employment promotion preflight refused: candidate ID missing",
    );
  assertUnique(entryIds, "manifest");
  assertUnique(currentIds, "current candidate state");
  const currentById = new Map(
    currentCandidates.map((candidate) => [
      clean(candidate.candidateId),
      candidate,
    ]),
  );

  const operations = manifest.entries.map(({ plan, approval }) => {
    const current = currentById.get(plan.candidateId);
    if (!current)
      throw new Error(
        "Employment promotion preflight refused: current candidate state missing",
      );
    if (current.sourceUpdatedAt !== plan.sourceUpdatedAt)
      throw new Error(
        "Employment promotion preflight refused: source version is stale",
      );
    const merge = buildApprovedAdditiveEmploymentMerge(
      plan,
      approval,
      current.employmentHistory,
    );
    return {
      candidateId: plan.candidateId,
      expectedUpdatedAt: plan.sourceUpdatedAt,
      expectedEmploymentHistory: structuredClone(current.employmentHistory),
      employmentHistory: merge.employmentHistory,
      addedRows: merge.addedRows,
      queue: plan.queue,
    };
  });

  const orderedSourceStates = entryIds.map((candidateId) => {
    const current = currentById.get(candidateId);
    if (!current)
      throw new Error(
        "Employment promotion preflight refused: current candidate state missing",
      );
    return current;
  });
  const latestSourceUpdatedAt = orderedSourceStates
    .map(({ sourceUpdatedAt }) => sourceUpdatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

  const preflightWithoutFingerprint: Omit<
    EmploymentPromotionBatchPreflight,
    "preflightFingerprint"
  > = {
    artifact: "reviewed_employment_promotion_preflight_v1",
    targetCommitSha: manifest.targetCommitSha,
    manifestGeneratedAt: manifest.generatedAt,
    latestSourceUpdatedAt,
    manifestFingerprint: fingerprint(manifest),
    operationsFingerprint: fingerprint(operations),
    candidateSetFingerprint: candidateSetFingerprint(entryIds),
    sourceStateFingerprint: fingerprint(orderedSourceStates),
    entries: operations.length,
    additions: operations.reduce(
      (sum, operation) => sum + operation.addedRows,
      0,
    ),
    emptyToPopulated: operations.filter(
      ({ queue }) => queue === "empty_to_populated_review",
    ).length,
    existingAdditive: operations.filter(
      ({ queue }) => queue === "existing_additive_review",
    ).length,
    operations,
    privacy: {
      candidateIdentifiersSerializedInReport: 0,
      employmentRowsSerializedInReport: 0,
    },
    databaseWrites: 0,
  };
  return {
    ...preflightWithoutFingerprint,
    preflightFingerprint: fingerprint(
      preflightFingerprintContents(preflightWithoutFingerprint),
    ),
  };
}

export function assertEmploymentPromotionExecutionGate(
  input: EmploymentPromotionExecutionGateInput,
) {
  const { preflight, backup, authorization } = input;
  assertSha(input.expectedCommitSha, "expectedCommitSha");
  assertPreflightIntegrity(preflight);
  if (
    preflight.targetCommitSha !== input.expectedCommitSha ||
    authorization.targetCommitSha !== input.expectedCommitSha
  )
    throw new Error(
      "Employment promotion execution refused: target commit mismatch",
    );
  if (
    authorization.decision !== "authorize_reviewed_additive_backfill" ||
    !clean(authorization.authorizedBy) ||
    !validDate(authorization.authorizedAt)
  )
    throw new Error(
      "Employment promotion execution refused: authorization missing",
    );
  if (authorization.manifestFingerprint !== preflight.manifestFingerprint)
    throw new Error(
      "Employment promotion execution refused: authorization is for another manifest",
    );
  if (authorization.preflightFingerprint !== preflight.preflightFingerprint)
    throw new Error(
      "Employment promotion execution refused: authorization is for another preflight",
    );
  if (
    backup.artifact !== "verified_candidate_backup_v1" ||
    backup.verification !== "readback_verified" ||
    !validDate(backup.capturedAt)
  )
    throw new Error(
      "Employment promotion execution refused: verified backup missing",
    );
  if (
    backup.candidateCount !== preflight.entries ||
    backup.candidateSetFingerprint !== preflight.candidateSetFingerprint ||
    backup.sourceStateFingerprint !== preflight.sourceStateFingerprint
  )
    throw new Error(
      "Employment promotion execution refused: backup does not cover this batch",
    );
  if (
    Date.parse(backup.capturedAt) < Date.parse(preflight.manifestGeneratedAt) ||
    Date.parse(backup.capturedAt) < Date.parse(preflight.latestSourceUpdatedAt)
  )
    throw new Error(
      "Employment promotion execution refused: backup predates the reviewed source state",
    );
  if (Date.parse(backup.capturedAt) > Date.parse(authorization.authorizedAt))
    throw new Error(
      "Employment promotion execution refused: authorization predates backup",
    );
}

export async function executeEmploymentPromotionBatch(
  input: EmploymentPromotionExecutionGateInput & {
    repository: EmploymentPromotionTransactionalRepository;
  },
): Promise<EmploymentPromotionExecutionReport> {
  const { preflight, repository } = input;
  assertEmploymentPromotionExecutionGate(input);
  if (!repository.transactional)
    throw new Error(
      "Employment promotion execution refused: repository is not transactional",
    );

  return repository.transaction(async (transaction) => {
    for (const operation of preflight.operations) {
      const locked = await transaction.lockCandidate(operation.candidateId);
      if (!locked || locked.sourceUpdatedAt !== operation.expectedUpdatedAt)
        throw new Error(
          "Employment promotion transaction refused: locked source version changed",
        );
      if (
        fingerprint(locked.employmentHistory) !==
        fingerprint(operation.expectedEmploymentHistory)
      )
        throw new Error(
          "Employment promotion transaction refused: locked employment payload changed",
        );
      const write = await transaction.updateCandidateEmployment({
        candidateId: operation.candidateId,
        expectedUpdatedAt: operation.expectedUpdatedAt,
        employmentHistory: operation.employmentHistory,
      });
      if (write.matchedRows !== 1)
        throw new Error(
          "Employment promotion transaction refused: optimistic update did not match exactly one row",
        );
      const readback = await transaction.readCandidate(operation.candidateId);
      if (
        !readback ||
        fingerprint(readback.employmentHistory) !==
          fingerprint(operation.employmentHistory)
      )
        throw new Error(
          "Employment promotion transaction refused: employment readback mismatch",
        );
      if (
        !validDate(readback.sourceUpdatedAt) ||
        Date.parse(readback.sourceUpdatedAt) <=
          Date.parse(operation.expectedUpdatedAt)
      )
        throw new Error(
          "Employment promotion transaction refused: source version did not advance monotonically",
        );
    }

    return {
      artifact: "reviewed_employment_promotion_execution_v1",
      targetCommitSha: preflight.targetCommitSha,
      manifestFingerprint: preflight.manifestFingerprint,
      candidatesUpdated: preflight.entries,
      additionsWritten: preflight.additions,
      readbacksVerified: preflight.entries,
      transactionCommitted: true,
      privacy: {
        candidateIdentifiersSerialized: 0,
        employmentRowsSerialized: 0,
      },
    };
  });
}
