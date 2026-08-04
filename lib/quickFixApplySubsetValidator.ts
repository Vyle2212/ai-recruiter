import type { QuickFixApplyDecisionRecord } from "./quickFixApplyReviewTypes";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function validateQuickFixSubsetDecision(decision: Partial<QuickFixApplyDecisionRecord>, stagingItem: any) {
  const reasons: string[] = [];
  if (!clean(decision.candidateId)) reasons.push("candidateId required");
  if (!clean(decision.fieldName)) reasons.push("fieldName required");
  if (clean(decision.decision) !== "approve_for_apply") reasons.push("decision is not approve_for_apply");
  if (clean(decision.fieldName) !== "currentCompany") reasons.push("field not enabled for quick-fix subset apply v1");
  if (!stagingItem) reasons.push("matching staging item missing");
  if (stagingItem && clean(stagingItem.candidateId) !== clean(decision.candidateId)) reasons.push("staging candidateId mismatch");
  if (stagingItem && clean(stagingItem.fieldName) !== clean(decision.fieldName)) reasons.push("staging fieldName mismatch");
  if (stagingItem && clean(stagingItem.approvedValue) !== clean(decision.suggestedValue)) reasons.push("approved value does not match staging approved value");
  if (!clean(decision.suggestedValue)) reasons.push("approved value is empty");
  if (/under\b|organization\b.*company\b|client|project|assigned to|working with|supporting/i.test(clean(decision.suggestedValue))) reasons.push("suspicious value excluded from subset");
  return { ok: reasons.length === 0, reasons };
}

export function quickFixSubsetApplyModeFromFlags(writeCandidateUpdates: boolean, confirmApplySubset: boolean) {
  if (writeCandidateUpdates && confirmApplySubset) return "confirmed_apply" as const;
  if (writeCandidateUpdates && !confirmApplySubset) throw new Error("Refusing quick-fix subset updates: --writeCandidateUpdates requires --confirmApplySubset.");
  if (confirmApplySubset && !writeCandidateUpdates) throw new Error("Refusing quick-fix subset updates: --confirmApplySubset requires --writeCandidateUpdates.");
  return "dry_run" as const;
}
