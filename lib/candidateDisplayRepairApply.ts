import fs from "node:fs";
import path from "node:path";
import { isForbiddenEmployer, isValidDisplayHumanName, type CandidateDisplayRepairSuggestion } from "./candidateDisplayAudit";
import { cleanTalentSearchTitle } from "./talentSearchDisplay";
import { type CandidateValidationStatus } from "./candidateValidation";

type AnyRecord = Record<string, any>;

export type DisplayRepairWriteEligibility = "safe-write" | "structured-employer-write" | "manual-review-only";

export type DisplayRepairUpdatePlan = {
  candidate_id: string;
  update: AnyRecord;
  changedFields: string[];
  skippedReasons: string[];
  manualReview: boolean;
  autoSafe: boolean;
  sourceBacked: boolean;
  reason: string;
  confidence: number;
  source_field: string;
  oldValues: AnyRecord;
  newValues: AnyRecord;
  writeEligibility: DisplayRepairWriteEligibility;
};

export type DisplayRepairApplySummary = {
  totalSuggestions: number;
  updatePlans: DisplayRepairUpdatePlan[];
  safeDisplayRepairs: DisplayRepairUpdatePlan[];
  structuredEmployerRepairs: DisplayRepairUpdatePlan[];
  rawTextEmployerCandidates: DisplayRepairUpdatePlan[];
  manualReview: DisplayRepairUpdatePlan[];
  sampleUpdates: DisplayRepairUpdatePlan[];
};

export type DisplayRepairRollbackEntry = {
  candidate_id: string;
  fields_changed: string[];
  old_values: AnyRecord;
  new_values: AnyRecord;
  reason: string;
  confidence: number;
  source_field: string;
  timestamp: string;
};

const PLACEHOLDER_NAME = "Candidate profile pending validation";
const NOT_DISCLOSED = "Not disclosed";
const SAFE_PLACEHOLDER_NAMES = /^(profile under review|name requires validation|identity under review|candidate profile pending validation)$/i;
const AUTO_SAFE_NAME_REASONS = /(placeholder-name|invalid-name|education-used-as-name|certificate-used-as-name|title-used-as-name|company-used-as-name)/i;
const AUTO_SAFE_ROLE_REASONS = /(employment-prefix|dangling-punctuation|unknown-artifact|sap-sap-artifact|role-missing-with-module)/i;
const ROLE_FALLBACK_PATTERN = /^SAP\s+(FICO|FI|CO|MM|SD|ABAP|BASIS|EWM|WM|PS|SUCCESSFACTORS|SF|BTP|PP|PM|TM)\s+Consultant$/i;
const STRUCTURED_EMPLOYER_SOURCES = new Set([
  "current_company",
  "currentCompany",
  "current_employer",
  "currentEmployer",
  "company",
  "employer",
  "latest workExperience company",
  "latest experience company",
]);
const RAW_TEXT_EMPLOYER_SOURCES = new Set(["resumeText", "rawText", "profileText", "raw resume text"]);
const EMPLOYER_FIELDS = new Set(["display_company", "canonical_company", "current_company", "current_employer", "company", "employer"]);
const DISPLAY_FIELDS = new Set(["display_name", "canonical_name", "name", "display_title", "canonical_title", "current_title", "title"]);
const STATUS_FIELDS = new Set(["validation_status", "validationStatus"]);

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sourceParts(sourceField: string) {
  return String(sourceField || "").split("|").map((item) => item.trim());
}

function employerSource(sourceField: string) {
  return sourceParts(sourceField)[1] || "";
}

function hasColumn(candidate: AnyRecord, field: string) {
  return Object.prototype.hasOwnProperty.call(candidate, field);
}

function firstExistingField(candidate: AnyRecord, fields: string[]) {
  return fields.find((field) => hasColumn(candidate, field));
}

function cleanRole(value: string) {
  return cleanTalentSearchTitle(value, "SAP").replace(/\s+/g, " ").trim();
}

function isAmbiguousEmployerName(value: any) {
  const employer = clean(value);
  if (!employer) return true;
  const openParens = (employer.match(/\(/g) || []).length;
  const closeParens = (employer.match(/\)/g) || []).length;
  if (openParens !== closeParens) return true;
  if (/[-|,;:]\s*$/.test(employer)) return true;
  if (/\b(heavily|responsib|assigned|period|project role|module|consultant)\b/i.test(employer)) return true;
  return false;
}

export function isStructuredEmployerRepair(suggestion: CandidateDisplayRepairSuggestion) {
  const employer = clean(suggestion.suggested_employer);
  const source = employerSource(suggestion.source_field);
  if (!employer || employer === NOT_DISCLOSED || isForbiddenEmployer(employer) || isAmbiguousEmployerName(employer)) return false;
  return STRUCTURED_EMPLOYER_SOURCES.has(source);
}

export function isRawTextEmployerCandidate(suggestion: CandidateDisplayRepairSuggestion) {
  const employer = clean(suggestion.suggested_employer);
  const source = employerSource(suggestion.source_field);
  if (!employer || employer === NOT_DISCLOSED || isForbiddenEmployer(employer) || isAmbiguousEmployerName(employer)) return false;
  return RAW_TEXT_EMPLOYER_SOURCES.has(source);
}

export function isSourceBackedEmployerRepair(suggestion: CandidateDisplayRepairSuggestion) {
  return isStructuredEmployerRepair(suggestion) || isRawTextEmployerCandidate(suggestion);
}

export function resolveSuggestedValidationStatus(input: { name: string; employer: string; role: string; hasContact: boolean; confidence: number }): CandidateValidationStatus {
  const name = clean(input.name);
  const employer = clean(input.employer);
  const role = clean(input.role);
  const roleHasArtifact = !role || role === "Role not disclosed" || /UNKNOWN|\bSAP\s+SAP\b|^Employment\b|[([{]\s*$|[-|]\s*$/i.test(role);
  if (name === PLACEHOLDER_NAME || !isValidDisplayHumanName(name) || !input.hasContact || !employer || employer === NOT_DISCLOSED || isForbiddenEmployer(employer) || roleHasArtifact) return "Missing Information";
  if (input.confidence < 75) return "Needs Review";
  return "Ready";
}

export function buildDisplayRepairUpdatePlan(suggestion: CandidateDisplayRepairSuggestion, candidate: AnyRecord): DisplayRepairUpdatePlan {
  const skippedReasons: string[] = [];
  const update: AnyRecord = {};
  const oldValues: AnyRecord = {};
  const newValues: AnyRecord = {};
  const reason = clean(suggestion.reason);
  const currentName = clean(suggestion.current_name);
  const suggestedName = clean(suggestion.suggested_name);
  const currentRole = clean(suggestion.current_role);
  const suggestedRole = clean(suggestion.suggested_role);
  const suggestedEmployer = clean(suggestion.suggested_employer);
  const hasContact = Boolean(clean(candidate.email || candidate.contact_email) || clean(candidate.phone || candidate.mobile || candidate.contact_phone) || clean(candidate.linkedin || candidate.linkedin_url));
  const autoSafeName = suggestedName === PLACEHOLDER_NAME && (SAFE_PLACEHOLDER_NAMES.test(currentName) || AUTO_SAFE_NAME_REASONS.test(reason));
  const cleanedRole = cleanRole(suggestedRole || currentRole);
  const autoSafeRole = Boolean(cleanedRole && cleanedRole !== currentRole && (AUTO_SAFE_ROLE_REASONS.test(reason) || ROLE_FALLBACK_PATTERN.test(cleanedRole)) && !/UNKNOWN|\bSAP\s+SAP\b|^Employment\b|[([{]\s*$|[-|]\s*$/i.test(cleanedRole));
  const structuredEmployer = isStructuredEmployerRepair(suggestion);
  const rawTextEmployer = isRawTextEmployerCandidate(suggestion);
  const sourceBackedEmployer = structuredEmployer || rawTextEmployer;

  if (autoSafeName) {
    const field = firstExistingField(candidate, ["display_name", "canonical_name", "name"]);
    if (field) {
      oldValues[field] = candidate[field] ?? null;
      newValues[field] = PLACEHOLDER_NAME;
      update[field] = PLACEHOLDER_NAME;
    } else skippedReasons.push("No display/name column exists for name repair");
  }

  if (autoSafeRole) {
    const field = firstExistingField(candidate, ["display_title", "canonical_title", "current_title", "title"]);
    if (field) {
      oldValues[field] = candidate[field] ?? null;
      newValues[field] = cleanedRole;
      update[field] = cleanedRole;
    } else skippedReasons.push("No display/title column exists for role repair");
  }

  if (suggestedEmployer && suggestedEmployer !== NOT_DISCLOSED) {
    if (structuredEmployer) {
      const field = firstExistingField(candidate, ["display_company", "canonical_company", "current_company", "current_employer", "company", "employer"]);
      if (field) {
        oldValues[field] = candidate[field] ?? null;
        newValues[field] = suggestedEmployer;
        update[field] = suggestedEmployer;
      } else skippedReasons.push("No display/company column exists for employer repair");
    } else {
      skippedReasons.push("Employer suggestion is not source-backed or is unsafe");
    }
  }

  const effectiveName = update.display_name || update.canonical_name || update.name || suggestedName || currentName;
  const effectiveEmployer = update.display_company || update.canonical_company || update.current_company || update.current_employer || update.company || update.employer || suggestedEmployer || suggestion.current_employer;
  const effectiveRole = update.display_title || update.canonical_title || update.current_title || update.title || cleanedRole || currentRole;
  const safeStatus = resolveSuggestedValidationStatus({ name: effectiveName, employer: effectiveEmployer, role: effectiveRole, hasContact, confidence: Number(suggestion.confidence || 0) });
  const statusField = firstExistingField(candidate, ["validation_status", "validationStatus"]);
  if (statusField && candidate[statusField] !== safeStatus) {
    oldValues[statusField] = candidate[statusField] ?? null;
    newValues[statusField] = safeStatus;
    update[statusField] = safeStatus;
  }

  const changedFields = Object.keys(update).filter((field) => candidate[field] !== update[field]);
  for (const field of Object.keys(update)) {
    if (!changedFields.includes(field)) {
      delete update[field];
      delete oldValues[field];
      delete newValues[field];
    }
  }
  const hasEmployerUpdate = changedFields.some((field) => EMPLOYER_FIELDS.has(field));
  const hasDisplayUpdate = changedFields.some((field) => DISPLAY_FIELDS.has(field));
  const structuredEmployerWrite = hasEmployerUpdate && structuredEmployer && Number(suggestion.confidence || 0) >= 85 && skippedReasons.length === 0;
  const safeWrite = !hasEmployerUpdate && (hasDisplayUpdate || changedFields.some((field) => STATUS_FIELDS.has(field))) && skippedReasons.length === 0;
  const writeEligibility: DisplayRepairWriteEligibility = safeWrite ? "safe-write" : structuredEmployerWrite ? "structured-employer-write" : "manual-review-only";
  const manualReview = writeEligibility === "manual-review-only";
  return {
    candidate_id: suggestion.candidate_id,
    update,
    changedFields,
    skippedReasons,
    manualReview,
    autoSafe: autoSafeName || autoSafeRole,
    sourceBacked: sourceBackedEmployer,
    reason,
    confidence: Number(suggestion.confidence || 0),
    source_field: suggestion.source_field,
    oldValues,
    newValues,
    writeEligibility,
  };
}

function pickFields(plan: DisplayRepairUpdatePlan, include: (field: string) => boolean, eligibility: DisplayRepairWriteEligibility): DisplayRepairUpdatePlan {
  const update: AnyRecord = {};
  const oldValues: AnyRecord = {};
  const newValues: AnyRecord = {};
  for (const field of plan.changedFields.filter(include)) {
    update[field] = plan.update[field];
    oldValues[field] = plan.oldValues[field];
    newValues[field] = plan.newValues[field];
  }
  const changedFields = Object.keys(update);
  return { ...plan, update, oldValues, newValues, changedFields, writeEligibility: changedFields.length ? eligibility : "manual-review-only" };
}

export function buildDisplayRepairApplySummary(suggestions: CandidateDisplayRepairSuggestion[], candidatesById: Map<string, AnyRecord>): DisplayRepairApplySummary {
  const plans = suggestions.map((suggestion) => buildDisplayRepairUpdatePlan(suggestion, candidatesById.get(suggestion.candidate_id) || {}));
  const safeDisplayRepairs = plans
    .map((plan) => pickFields(plan, (field) => DISPLAY_FIELDS.has(field) || STATUS_FIELDS.has(field), "safe-write"))
    .filter((plan) => plan.changedFields.length > 0 && !plan.changedFields.some((field) => EMPLOYER_FIELDS.has(field)) && plan.skippedReasons.length === 0);
  const structuredEmployerRepairs = plans
    .filter((plan) => plan.writeEligibility === "structured-employer-write")
    .map((plan) => pickFields(plan, (field) => EMPLOYER_FIELDS.has(field) || STATUS_FIELDS.has(field), "structured-employer-write"))
    .filter((plan) => plan.changedFields.some((field) => EMPLOYER_FIELDS.has(field)));
  const rawTextEmployerCandidates = plans.filter((plan, index) => isRawTextEmployerCandidate(suggestions[index]));
  const updatePlans = [...safeDisplayRepairs, ...structuredEmployerRepairs];
  const updateIds = new Set(updatePlans.map((plan) => plan.candidate_id + ":" + plan.writeEligibility));
  const manualReview = plans.filter((plan) => !updateIds.has(plan.candidate_id + ":" + plan.writeEligibility) && plan.writeEligibility === "manual-review-only");
  return {
    totalSuggestions: suggestions.length,
    updatePlans,
    safeDisplayRepairs,
    structuredEmployerRepairs,
    rawTextEmployerCandidates,
    manualReview,
    sampleUpdates: updatePlans.slice(0, 10),
  };
}

export function buildRollbackEntries(plans: DisplayRepairUpdatePlan[], timestamp = new Date().toISOString()): DisplayRepairRollbackEntry[] {
  return plans.map((plan) => ({
    candidate_id: plan.candidate_id,
    fields_changed: plan.changedFields,
    old_values: plan.oldValues,
    new_values: plan.newValues,
    reason: plan.reason,
    confidence: plan.confidence,
    source_field: plan.source_field,
    timestamp,
  }));
}

export function loadRepairPreview(filePath = path.resolve("repair-preview.json")): CandidateDisplayRepairSuggestion[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("repair-preview.json must contain an array of repair suggestions.");
  return parsed;
}
