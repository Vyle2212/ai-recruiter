import { createHash } from "node:crypto";
import type { EnterpriseEmployment } from "./candidate360SchemaNormalize";

export type StoredEmploymentRow = Record<string, unknown> & {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
};

export type EmploymentPromotionQueue =
  | "empty_to_populated_review"
  | "existing_additive_review"
  | "unchanged"
  | "conflict_review"
  | "still_empty";

export type EmploymentPromotionPlan = {
  candidateId: string;
  sourceUpdatedAt: string;
  queue: EmploymentPromotionQueue;
  storedFingerprint: string;
  projectedFingerprint: string;
  planFingerprint: string;
  storedRows: number;
  projectedRows: number;
  additions: StoredEmploymentRow[];
  removedOrChangedStoredTuples: number;
  writeEligibleAfterReview: boolean;
};

export type EmploymentPromotionApproval = {
  candidateId: string;
  sourceUpdatedAt: string;
  storedFingerprint: string;
  projectedFingerprint: string;
  planFingerprint: string;
  decision: "approve_additions" | "hold" | "reject";
  reviewedBy: string;
  reviewedAt: string;
};

const clean = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim()
    : "";

const normalized = (value: unknown) =>
  clean(value)
    .toLowerCase()
    .replace(
      /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|private limited|limited|ltd\.?|inc\.?|corporation|corp\.?)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function storedTuple(item: StoredEmploymentRow) {
  return [
    normalized(item.company),
    normalized(item.title),
    normalized(item.startDate ?? item.start),
    normalized(item.endDate ?? item.end),
    item.current === true ? "current" : "closed",
  ].join("|");
}

function projectedTuple(item: EnterpriseEmployment) {
  return [
    normalized(item.company),
    normalized(item.title),
    normalized(item.start),
    normalized(item.end),
    item.current ? "current" : "closed",
  ].join("|");
}

function fingerprint(values: Iterable<string>) {
  return createHash("sha256")
    .update([...values].join("\n"), "utf8")
    .digest("hex");
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

function exactFingerprint(value: unknown) {
  return fingerprint([stableJson(value)]);
}

function promotionPlanFingerprint(input: {
  candidateId: string;
  sourceUpdatedAt: string;
  queue: EmploymentPromotionQueue;
  storedFingerprint: string;
  projectedFingerprint: string;
  storedRows: number;
  projectedRows: number;
  additions: readonly StoredEmploymentRow[];
  removedOrChangedStoredTuples: number;
  writeEligibleAfterReview: boolean;
}) {
  return exactFingerprint({
    candidateId: input.candidateId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    queue: input.queue,
    storedFingerprint: input.storedFingerprint,
    projectedFingerprint: input.projectedFingerprint,
    storedRows: input.storedRows,
    projectedRows: input.projectedRows,
    additions: input.additions,
    removedOrChangedStoredTuples: input.removedOrChangedStoredTuples,
    writeEligibleAfterReview: input.writeEligibleAfterReview,
  });
}

function storedProjection(item: EnterpriseEmployment): StoredEmploymentRow {
  return {
    id: item.id,
    company: clean(item.company),
    title: clean(item.title),
    location: clean(item.location),
    startDate: clean(item.start),
    endDate: clean(item.end),
    duration: clean(item.duration),
    current: item.current === true,
    modules: [...item.modules],
    achievements: [...item.achievements],
    responsibilities: [...(item.responsibilities || [])],
    evidenceState: item.evidenceState,
    evidenceConfidence: item.evidenceConfidence,
    linkedProjectIds: [...(item.linkedProjectIds || [])],
    estimatedTenure: item.estimatedTenure,
    provenance: [...(item.provenance || [])],
  };
}

export function buildEmploymentPromotionPlan(input: {
  candidateId: string;
  sourceUpdatedAt: string;
  stored: readonly StoredEmploymentRow[];
  projected: readonly EnterpriseEmployment[];
}): EmploymentPromotionPlan {
  const candidateId = clean(input.candidateId);
  const sourceUpdatedAt = clean(input.sourceUpdatedAt);
  if (!candidateId) throw new Error("candidateId required");
  if (!sourceUpdatedAt) throw new Error("sourceUpdatedAt required");
  if (!Number.isFinite(Date.parse(sourceUpdatedAt)))
    throw new Error("valid sourceUpdatedAt required");

  const storedKeys = new Set(input.stored.map(storedTuple));
  const projectedRows = input.projected.map(storedProjection);
  const projectedByKey = new Map(
    input.projected.map(
      (item, index) => [projectedTuple(item), projectedRows[index]] as const,
    ),
  );
  const projectedKeys = new Set(projectedByKey.keys());
  const preserved = [...storedKeys].filter((key) => projectedKeys.has(key));
  const additions = [...projectedByKey]
    .filter(([key]) => !storedKeys.has(key))
    .map(([, item]) => item);
  const removedOrChangedStoredTuples = storedKeys.size - preserved.length;

  let queue: EmploymentPromotionQueue;
  if (!storedKeys.size && !projectedKeys.size) queue = "still_empty";
  else if (
    storedKeys.size === projectedKeys.size &&
    preserved.length === storedKeys.size
  )
    queue = "unchanged";
  else if (
    preserved.length === storedKeys.size &&
    projectedKeys.size > storedKeys.size
  )
    queue = storedKeys.size
      ? "existing_additive_review"
      : "empty_to_populated_review";
  else queue = "conflict_review";

  const planContents = {
    candidateId,
    sourceUpdatedAt,
    queue,
    storedFingerprint: exactFingerprint(input.stored),
    projectedFingerprint: exactFingerprint(projectedRows),
    storedRows: input.stored.length,
    projectedRows: input.projected.length,
    additions,
    removedOrChangedStoredTuples,
    writeEligibleAfterReview:
      queue === "empty_to_populated_review" ||
      queue === "existing_additive_review",
  };

  return {
    ...planContents,
    planFingerprint: promotionPlanFingerprint(planContents),
  };
}

export function buildApprovedAdditiveEmploymentMerge(
  plan: EmploymentPromotionPlan,
  approval: EmploymentPromotionApproval,
  stored: readonly StoredEmploymentRow[],
) {
  const refusal = (message: string): never => {
    throw new Error(`Employment promotion refused: ${message}`);
  };
  if (!plan.writeEligibleAfterReview) refusal("plan is not additive-only");
  if (approval.decision !== "approve_additions")
    refusal("review decision is not approve_additions");
  if (!clean(approval.reviewedBy) || !clean(approval.reviewedAt))
    refusal("review identity and timestamp required");
  if (!Number.isFinite(Date.parse(approval.reviewedAt)))
    refusal("review timestamp is invalid");
  if (Date.parse(approval.reviewedAt) < Date.parse(plan.sourceUpdatedAt))
    refusal("review predates the source version");
  if (approval.candidateId !== plan.candidateId)
    refusal("candidate changed after review");
  if (approval.sourceUpdatedAt !== plan.sourceUpdatedAt)
    refusal("source version changed after review");
  if (approval.storedFingerprint !== plan.storedFingerprint)
    refusal("stored employment changed after review");
  if (approval.projectedFingerprint !== plan.projectedFingerprint)
    refusal("parser projection changed after review");
  if (approval.planFingerprint !== plan.planFingerprint)
    refusal("approved plan fingerprint changed");
  if (promotionPlanFingerprint(plan) !== plan.planFingerprint)
    refusal("plan contents changed after review");
  if (exactFingerprint(stored) !== plan.storedFingerprint)
    refusal("current stored employment no longer matches the plan");

  return {
    candidateId: plan.candidateId,
    expectedUpdatedAt: plan.sourceUpdatedAt,
    expectedStoredFingerprint: plan.storedFingerprint,
    expectedProjectedFingerprint: plan.projectedFingerprint,
    employmentHistory: [...stored, ...plan.additions],
    addedRows: plan.additions.length,
    preservedStoredRows: stored.length,
    mode: "reviewed_additive_only" as const,
  };
}
