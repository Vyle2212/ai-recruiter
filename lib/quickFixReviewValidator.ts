import type { QuickFixRepairSuggestion } from "./quickFixRepairTypes";
import { validateQuickFixSuggestion } from "./quickFixRepairValidator";

const SUPPORTED_FIELDS = new Set(["currentCompany", "title", "primarySapModule", "location"]);

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function reviewFieldForQuickFix(fieldName: string) {
  return clean(fieldName) === "location" ? "locationCountry" : clean(fieldName);
}

export function validateQuickFixReviewPromotion(suggestion: Partial<QuickFixRepairSuggestion>, options: { alreadyVerified?: boolean } = {}) {
  const reasons: string[] = [];
  const fieldName = clean(suggestion.fieldName);
  const status = clean(suggestion.validationStatus);
  const readiness = clean(suggestion.approvalReadiness);
  if (!clean(suggestion.candidateId)) reasons.push("missing candidateId");
  if (!SUPPORTED_FIELDS.has(fieldName)) reasons.push("unsupported field");
  if (!clean(suggestion.suggestedValue)) reasons.push("suggested value is empty");
  if (status === "blocked") reasons.push("blocked suggestion cannot be promoted");
  if (status !== "safe_suggestion" && status !== "needs_manual_review") reasons.push("review status is not promotion-ready");
  if (readiness !== "ready_for_manual_approval") reasons.push("approval readiness is not ready");
  if (options.alreadyVerified || status === "already_verified") reasons.push("already verified or applied");
  reasons.push(...validateQuickFixSuggestion(suggestion as QuickFixRepairSuggestion).errors);
  return { ok: reasons.length === 0, reasons: Array.from(new Set(reasons)), reviewFieldName: reviewFieldForQuickFix(fieldName) };
}
