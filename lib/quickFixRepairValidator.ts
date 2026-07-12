import type { QuickFixRepairSuggestion, QuickFixTargetField } from "./quickFixRepairTypes";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

const GENERIC_COMPANY = /^(company|client|confidential|not disclosed|n\/a|na|none|null|unknown)$/i;
const BAD_COMPANY = /@|https?:|www\.|\.com\b|\b(project|implementation|migration|rollout|support|responsibilities|experience|skills|tools|environment)\b|[.!?].{20,}/i;
const BAD_TITLE = /@|https?:|www\.|\.com\b|\b(pvt|ltd|sdn|bhd|inc|llc|company|client|project|tools|skills|responsibilities)\b|[.!?].{20,}/i;
const SUPPORTED = new Set(["currentCompany", "title", "primarySapModule", "location"]);
const SAP_MODULES = new Set(["ABAP", "BASIS", "BTP", "BW", "CPI", "EWM", "FICO", "FI", "CO", "HCM", "HR", "MM", "PM", "PP", "PS", "SD", "SuccessFactors", "OpenText"]);

export function normalizeQuickFixField(field: string): QuickFixTargetField | "unsupported" {
  const value = clean(field);
  if (SUPPORTED.has(value)) return value as QuickFixTargetField;
  if (/company|employer/i.test(value)) return "currentCompany";
  if (/title/i.test(value)) return "title";
  if (/module|primarysap/i.test(value)) return "primarySapModule";
  if (/location|country|city/i.test(value)) return "location";
  return "unsupported";
}

export function validateQuickFixSuggestion(input: Partial<QuickFixRepairSuggestion>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const field = clean(input.fieldName);
  const value = clean(input.suggestedValue);
  const evidence = clean(input.evidenceSnippet);
  const current = clean(input.currentValue);
  const reasons = (input.validationReasons || []).join(" ");

  if (!clean(input.candidateId)) errors.push("candidateId required");
  if (!SUPPORTED.has(field)) errors.push("unsupported field");
  if (!value) errors.push("suggested value missing");
  if (!evidence) errors.push("missing evidence");
  if (current && current.toLowerCase() === value.toLowerCase()) errors.push("already has same value");
  if (field === "currentCompany" && (GENERIC_COMPANY.test(value) || BAD_COMPANY.test(value))) errors.push("company value is not safe enough");
  if (field === "title" && BAD_TITLE.test(value)) errors.push("title value is not safe enough");
  if (field === "primarySapModule") {
    const moduleValue = value.toUpperCase();
    const known = Array.from(SAP_MODULES).some((module) => module.toUpperCase() === moduleValue);
    if (!known) errors.push("unsupported SAP module");
    if (/module conflict|conflict/i.test(reasons)) errors.push("module conflict detected");
    if (Number(input.confidence || 0) < 90) warnings.push("module suggestion needs manual review unless evidence is strong");
  }
  if (field === "location" && value.length < 2) errors.push("location is ambiguous");
  return { ok: errors.length === 0, errors, warnings };
}

export function statusForValidatedSuggestion(input: Partial<QuickFixRepairSuggestion>) {
  const validation = validateQuickFixSuggestion(input);
  if (validation.errors.length) return { validationStatus: "blocked" as const, approvalReadiness: validation.errors.includes("missing evidence") ? "not_ready_missing_evidence" as const : "not_ready_conflict" as const, reasons: validation.errors };
  if (input.fieldName === "primarySapModule" || validation.warnings.length || Number(input.confidence || 0) < 85) return { validationStatus: "needs_manual_review" as const, approvalReadiness: "ready_for_manual_approval" as const, reasons: validation.warnings };
  return { validationStatus: "safe_suggestion" as const, approvalReadiness: "ready_for_manual_approval" as const, reasons: validation.warnings };
}
