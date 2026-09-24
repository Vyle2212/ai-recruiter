import { createHash } from "node:crypto";
import {
  buildEmploymentPromotionPlan,
  type EmploymentPromotionApproval,
  type EmploymentPromotionPlan,
  type EmploymentPromotionQueue,
  type StoredEmploymentRow,
} from "./productionEmploymentAdditivePromotion";
import {
  prepareEmploymentPromotionOperatorRun,
  type EmploymentPromotionOperatorBundle,
} from "./productionEmploymentPromotionOperator";
import type { EmploymentPromotionCandidateState } from "./productionEmploymentPromotionBatch";
import {
  normalizeActualCandidateSchema,
  type EnterpriseEmployment,
} from "./candidate360SchemaNormalize";

type CandidateRow = Record<string, unknown>;

export type EmploymentReviewCandidateInput = {
  candidateId: string;
  sourceUpdatedAt: string;
  employmentHistory: StoredEmploymentRow[];
  projectedEmployment: EnterpriseEmployment[];
  sourceText: string;
};

export type EmploymentReviewDecision = {
  decision: "pending" | "approve_additions" | "hold" | "reject";
  reviewedBy: string;
  reviewedAt: string;
};

export type PrivateEmploymentReviewItem = {
  plan: EmploymentPromotionPlan;
  currentCandidate: EmploymentPromotionCandidateState;
  projectedEmployment: EnterpriseEmployment[];
  sourceText: string;
  review: EmploymentReviewDecision;
};

export type PrivateEmploymentReviewPack = {
  artifact: "private_employment_promotion_review_pack_v1";
  generatedAt: string;
  capturedAt: string;
  targetCommitSha: string;
  population: number;
  reviewPackFingerprint: string;
  queueCounts: Record<EmploymentPromotionQueue, number>;
  items: PrivateEmploymentReviewItem[];
};

export type EmploymentReviewPackReport = {
  artifact: "employment_promotion_review_pack_report_v1";
  targetCommitSha: string;
  reviewPackFingerprint: string;
  population: number;
  reviewItems: number;
  additiveReviewItems: number;
  conflictReviewItems: number;
  proposedAdditions: number;
  queueCounts: Record<EmploymentPromotionQueue, number>;
  privacy: {
    candidateIdentifiersSerialized: 0;
    sourceTextSerialized: 0;
    employmentRowsSerialized: 0;
  };
  databaseWrites: 0;
};

export type EmploymentReviewFinalizationReport = {
  artifact: "employment_promotion_review_finalization_report_v1";
  targetCommitSha: string;
  reviewPackFingerprint: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  additiveReviewItems: number;
  approvedEntries: number;
  approvedAdditions: number;
  heldEntries: number;
  rejectedEntries: number;
  conflictsReviewedKeepStored: number;
  conflictsOutstanding: number;
  pendingAdditiveDecisions: 0;
  readyForBackup: true;
  readyForWrite: false;
  privacy: {
    candidateIdentifiersSerialized: 0;
    sourceTextSerialized: 0;
    employmentRowsSerialized: 0;
  };
  databaseWrites: 0;
};

const reviewQueues = new Set<EmploymentPromotionQueue>([
  "empty_to_populated_review",
  "existing_additive_review",
  "conflict_review",
]);

const additiveQueues = new Set<EmploymentPromotionQueue>([
  "empty_to_populated_review",
  "existing_additive_review",
]);

const reviewDecisions = new Set<EmploymentReviewDecision["decision"]>([
  "pending",
  "approve_additions",
  "hold",
  "reject",
]);

function clean(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim()
    : "";
}

function validDate(value: unknown) {
  return Boolean(clean(value)) && Number.isFinite(Date.parse(clean(value)));
}

function assertSha(value: string, label: string) {
  if (!/^[a-f0-9]{40}$/i.test(value))
    throw new Error(`${label} must be a full commit SHA`);
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains duplicate candidate IDs`);
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

function emptyQueueCounts(): Record<EmploymentPromotionQueue, number> {
  return {
    empty_to_populated_review: 0,
    existing_additive_review: 0,
    unchanged: 0,
    conflict_review: 0,
    still_empty: 0,
  };
}

function storedEmployment(row: CandidateRow): StoredEmploymentRow[] {
  const parsed = row.parsed_json;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const canonical = (parsed as CandidateRow).canonical_candidate;
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical))
    return [];
  const payload = (canonical as CandidateRow).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return [];
  const employment = (payload as CandidateRow).employmentHistory;
  return Array.isArray(employment)
    ? employment.filter((item): item is StoredEmploymentRow =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

function privateSourceText(row: CandidateRow) {
  return [row.raw_text, row.resume_text, row.raw_cv]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.normalize("NFKC").trim())
    .filter(Boolean)
    .join("\n");
}

export function buildEmploymentReviewInputsFromCandidateRows(
  rows: readonly CandidateRow[],
): EmploymentReviewCandidateInput[] {
  return rows.map((row) => {
    const candidateId = clean(row.id ?? row.candidate_id);
    const sourceUpdatedAt = clean(row.updated_at ?? row.source_updated_at);
    if (!candidateId)
      throw new Error("Employment review input refused: candidate ID missing");
    if (!validDate(sourceUpdatedAt))
      throw new Error(
        "Employment review input refused: source version missing",
      );
    return {
      candidateId,
      sourceUpdatedAt,
      employmentHistory: structuredClone(storedEmployment(row)),
      projectedEmployment: structuredClone(
        normalizeActualCandidateSchema(row).enterpriseProfile
          .employmentTimeline,
      ),
      sourceText: privateSourceText(row),
    };
  });
}

function immutablePackContents(
  pack: Omit<PrivateEmploymentReviewPack, "reviewPackFingerprint">,
) {
  return {
    artifact: pack.artifact,
    generatedAt: pack.generatedAt,
    capturedAt: pack.capturedAt,
    targetCommitSha: pack.targetCommitSha,
    population: pack.population,
    queueCounts: pack.queueCounts,
    items: pack.items.map(({ review: _review, ...item }) => item),
  };
}

function assertReviewPackIntegrity(pack: PrivateEmploymentReviewPack) {
  if (pack.artifact !== "private_employment_promotion_review_pack_v1")
    throw new Error("Employment review pack refused: artifact mismatch");
  assertSha(pack.targetCommitSha, "review pack targetCommitSha");
  if (!validDate(pack.generatedAt) || !validDate(pack.capturedAt))
    throw new Error("Employment review pack refused: invalid timestamp");
  if (Date.parse(pack.generatedAt) < Date.parse(pack.capturedAt))
    throw new Error("Employment review pack refused: pack predates snapshot");
  if (!Number.isSafeInteger(pack.population) || pack.population < 1)
    throw new Error("Employment review pack refused: invalid population");
  if (!/^[a-f0-9]{64}$/.test(pack.reviewPackFingerprint))
    throw new Error("Employment review pack refused: invalid fingerprint");
  const { reviewPackFingerprint: _fingerprint, ...withoutFingerprint } = pack;
  if (
    fingerprint(immutablePackContents(withoutFingerprint)) !==
    pack.reviewPackFingerprint
  )
    throw new Error(
      "Employment review pack refused: immutable content changed",
    );

  const itemIds = pack.items.map(({ plan }) => clean(plan.candidateId));
  if (itemIds.some((id) => !id))
    throw new Error("Employment review pack refused: candidate ID missing");
  assertUnique(itemIds, "employment review pack");
  if (
    Object.values(pack.queueCounts).reduce((sum, value) => sum + value, 0) !==
    pack.population
  )
    throw new Error("Employment review pack refused: queue counts changed");
  if (
    pack.items.length !==
    pack.queueCounts.empty_to_populated_review +
      pack.queueCounts.existing_additive_review +
      pack.queueCounts.conflict_review
  )
    throw new Error(
      "Employment review pack refused: review item count changed",
    );

  for (const item of pack.items) {
    if (!reviewQueues.has(item.plan.queue))
      throw new Error(
        "Employment review pack refused: non-review queue included",
      );
    if (
      item.currentCandidate.candidateId !== item.plan.candidateId ||
      item.currentCandidate.sourceUpdatedAt !== item.plan.sourceUpdatedAt
    )
      throw new Error("Employment review pack refused: source state changed");
    const rebuilt = buildEmploymentPromotionPlan({
      candidateId: item.currentCandidate.candidateId,
      sourceUpdatedAt: item.currentCandidate.sourceUpdatedAt,
      stored: item.currentCandidate.employmentHistory,
      projected: item.projectedEmployment,
    });
    if (stableJson(rebuilt) !== stableJson(item.plan))
      throw new Error(
        "Employment review pack refused: plan no longer matches inputs",
      );
    if (!reviewDecisions.has(item.review.decision))
      throw new Error(
        "Employment review pack refused: invalid review decision",
      );
  }
}

export function buildPrivateEmploymentReviewPack(input: {
  candidates: readonly EmploymentReviewCandidateInput[];
  capturedAt: string;
  generatedAt: string;
  targetCommitSha: string;
}): {
  pack: PrivateEmploymentReviewPack;
  report: EmploymentReviewPackReport;
} {
  assertSha(input.targetCommitSha, "targetCommitSha");
  if (!validDate(input.capturedAt) || !validDate(input.generatedAt))
    throw new Error("Employment review pack refused: invalid timestamp");
  if (Date.parse(input.generatedAt) < Date.parse(input.capturedAt))
    throw new Error("Employment review pack refused: pack predates snapshot");
  if (!input.candidates.length)
    throw new Error("Employment review pack refused: population is empty");
  const candidateIds = input.candidates.map(({ candidateId }) =>
    clean(candidateId),
  );
  if (candidateIds.some((id) => !id))
    throw new Error("Employment review pack refused: candidate ID missing");
  assertUnique(candidateIds, "employment review population");

  const capturedAt = Date.parse(input.capturedAt);
  const sourceVersionAfterCapture = input.candidates.some(
    ({ sourceUpdatedAt }) =>
      !validDate(sourceUpdatedAt) || Date.parse(sourceUpdatedAt) > capturedAt,
  );
  if (sourceVersionAfterCapture)
    throw new Error(
      "Employment review pack refused: snapshot predates a source version",
    );

  const queueCounts = emptyQueueCounts();
  const items: PrivateEmploymentReviewItem[] = [];
  let proposedAdditions = 0;
  for (const candidate of input.candidates) {
    const plan = buildEmploymentPromotionPlan({
      candidateId: candidate.candidateId,
      sourceUpdatedAt: candidate.sourceUpdatedAt,
      stored: candidate.employmentHistory,
      projected: candidate.projectedEmployment,
    });
    queueCounts[plan.queue] += 1;
    if (!reviewQueues.has(plan.queue)) continue;
    proposedAdditions += plan.additions.length;
    items.push({
      plan,
      currentCandidate: {
        candidateId: plan.candidateId,
        sourceUpdatedAt: plan.sourceUpdatedAt,
        employmentHistory: structuredClone(candidate.employmentHistory),
      },
      projectedEmployment: structuredClone(candidate.projectedEmployment),
      sourceText: String(candidate.sourceText || ""),
      review: { decision: "pending", reviewedBy: "", reviewedAt: "" },
    });
  }

  const packWithoutFingerprint: Omit<
    PrivateEmploymentReviewPack,
    "reviewPackFingerprint"
  > = {
    artifact: "private_employment_promotion_review_pack_v1",
    generatedAt: input.generatedAt,
    capturedAt: input.capturedAt,
    targetCommitSha: input.targetCommitSha,
    population: input.candidates.length,
    queueCounts,
    items,
  };
  const pack: PrivateEmploymentReviewPack = {
    ...packWithoutFingerprint,
    reviewPackFingerprint: fingerprint(
      immutablePackContents(packWithoutFingerprint),
    ),
  };
  const report: EmploymentReviewPackReport = {
    artifact: "employment_promotion_review_pack_report_v1",
    targetCommitSha: pack.targetCommitSha,
    reviewPackFingerprint: pack.reviewPackFingerprint,
    population: pack.population,
    reviewItems: pack.items.length,
    additiveReviewItems:
      queueCounts.empty_to_populated_review +
      queueCounts.existing_additive_review,
    conflictReviewItems: queueCounts.conflict_review,
    proposedAdditions,
    queueCounts,
    privacy: {
      candidateIdentifiersSerialized: 0,
      sourceTextSerialized: 0,
      employmentRowsSerialized: 0,
    },
    databaseWrites: 0,
  };
  return { pack, report };
}

export function finalizePrivateEmploymentReviewPack(input: {
  pack: PrivateEmploymentReviewPack;
  finalizedAt: string;
  expectedCommitSha: string;
}): {
  bundle: EmploymentPromotionOperatorBundle;
  report: EmploymentReviewFinalizationReport;
} {
  const { pack } = input;
  assertReviewPackIntegrity(pack);
  assertSha(input.expectedCommitSha, "expectedCommitSha");
  if (pack.targetCommitSha !== input.expectedCommitSha)
    throw new Error(
      "Employment review finalization refused: target commit mismatch",
    );
  if (!validDate(input.finalizedAt))
    throw new Error(
      "Employment review finalization refused: invalid timestamp",
    );
  if (Date.parse(input.finalizedAt) < Date.parse(pack.generatedAt))
    throw new Error(
      "Employment review finalization refused: finalization predates review pack",
    );

  const approved: Array<{
    plan: EmploymentPromotionPlan;
    approval: EmploymentPromotionApproval;
    currentCandidate: EmploymentPromotionCandidateState;
  }> = [];
  let heldEntries = 0;
  let rejectedEntries = 0;
  let conflictsReviewedKeepStored = 0;
  let conflictsOutstanding = 0;
  let additiveReviewItems = 0;
  let pendingAdditiveDecisions = 0;

  for (const item of pack.items) {
    const isAdditive = additiveQueues.has(item.plan.queue);
    if (isAdditive) additiveReviewItems += 1;
    if (item.review.decision !== "pending") {
      if (!clean(item.review.reviewedBy) || !validDate(item.review.reviewedAt))
        throw new Error(
          "Employment review finalization refused: review identity and timestamp required",
        );
      if (
        Date.parse(item.review.reviewedAt) <
        Math.max(
          Date.parse(item.plan.sourceUpdatedAt),
          Date.parse(pack.generatedAt),
        )
      )
        throw new Error(
          "Employment review finalization refused: review predates source version or review pack",
        );
      if (Date.parse(input.finalizedAt) < Date.parse(item.review.reviewedAt))
        throw new Error(
          "Employment review finalization refused: bundle predates review",
        );
    }
    if (!isAdditive) {
      if (item.review.decision === "approve_additions")
        throw new Error(
          "Employment review finalization refused: conflict cannot enter additive manifest",
        );
      if (item.review.decision === "reject") conflictsReviewedKeepStored += 1;
      else conflictsOutstanding += 1;
      continue;
    }
    if (item.review.decision === "pending") {
      pendingAdditiveDecisions += 1;
      continue;
    }
    if (item.review.decision === "hold") {
      heldEntries += 1;
      continue;
    }
    if (item.review.decision === "reject") {
      rejectedEntries += 1;
      continue;
    }
    approved.push({
      plan: structuredClone(item.plan),
      approval: {
        candidateId: item.plan.candidateId,
        sourceUpdatedAt: item.plan.sourceUpdatedAt,
        storedFingerprint: item.plan.storedFingerprint,
        projectedFingerprint: item.plan.projectedFingerprint,
        planFingerprint: item.plan.planFingerprint,
        decision: "approve_additions",
        reviewedBy: item.review.reviewedBy,
        reviewedAt: item.review.reviewedAt,
      },
      currentCandidate: structuredClone(item.currentCandidate),
    });
  }

  if (pendingAdditiveDecisions)
    throw new Error(
      "Employment review finalization refused: additive decisions are pending",
    );
  if (!approved.length)
    throw new Error(
      "Employment review finalization refused: no additive entries approved",
    );

  const bundle: EmploymentPromotionOperatorBundle = {
    artifact: "reviewed_employment_promotion_operator_bundle_v1",
    manifest: {
      artifact: "reviewed_employment_promotion_manifest_v1",
      generatedAt: input.finalizedAt,
      targetCommitSha: pack.targetCommitSha,
      entries: approved.map(({ plan, approval }) => ({ plan, approval })),
    },
    currentCandidates: approved.map(({ currentCandidate }) => currentCandidate),
  };
  const prepared = prepareEmploymentPromotionOperatorRun({
    bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  const report: EmploymentReviewFinalizationReport = {
    artifact: "employment_promotion_review_finalization_report_v1",
    targetCommitSha: pack.targetCommitSha,
    reviewPackFingerprint: pack.reviewPackFingerprint,
    manifestFingerprint: prepared.report.manifestFingerprint,
    preflightFingerprint: prepared.report.preflightFingerprint,
    candidateSetFingerprint: prepared.report.candidateSetFingerprint,
    sourceStateFingerprint: prepared.report.sourceStateFingerprint,
    additiveReviewItems,
    approvedEntries: prepared.report.entries,
    approvedAdditions: prepared.report.additions,
    heldEntries,
    rejectedEntries,
    conflictsReviewedKeepStored,
    conflictsOutstanding,
    pendingAdditiveDecisions: 0,
    readyForBackup: true,
    readyForWrite: false,
    privacy: {
      candidateIdentifiersSerialized: 0,
      sourceTextSerialized: 0,
      employmentRowsSerialized: 0,
    },
    databaseWrites: 0,
  };
  return { bundle, report };
}
