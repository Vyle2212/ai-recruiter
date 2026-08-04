import { fieldMappingFor } from "./aiExtractionCandidateApplyValidator";

export type BatchReviewValidation = {
  ok: boolean;
  blocked: boolean;
  needsManualReview: boolean;
  status: "valid" | "needs_manual_review" | "blocked" | "preserved_already_applied";
  reasons: string[];
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function validateBatchReviewItem(item: { candidateId?: string; fieldName?: string; evidence?: string; aiValue?: any }, applyHistory?: { items?: Array<{ candidateId: string; fieldName: string; status: string }> } | null): BatchReviewValidation {
  const reasons: string[] = [];
  const candidateId = clean(item.candidateId);
  const fieldName = clean(item.fieldName);
  if (!candidateId) reasons.push("candidateId required");
  if (!fieldName) reasons.push("fieldName required");
  if (fieldName && !fieldMappingFor(fieldName)) reasons.push("unsupported target field blocked");
  const alreadyApplied = (applyHistory?.items || []).some((history) => clean(history.candidateId) === candidateId && clean(history.fieldName) === fieldName && /applied_verified|preserved_already_applied/i.test(clean(history.status)));
  if (alreadyApplied) return { ok: false, blocked: true, needsManualReview: false, status: "preserved_already_applied", reasons: ["already applied or preserved in apply history"] };
  if (reasons.length) return { ok: false, blocked: true, needsManualReview: false, status: "blocked", reasons };
  if (!clean(item.evidence) || !clean(item.aiValue)) return { ok: true, blocked: false, needsManualReview: true, status: "needs_manual_review", reasons: ["missing evidence or suggestion; recruiter review required"] };
  return { ok: true, blocked: false, needsManualReview: false, status: "valid", reasons };
}