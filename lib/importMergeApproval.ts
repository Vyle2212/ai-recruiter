import type { Candidate360Field, Candidate360Profile } from "./candidate360Types";
import type { ImportStagingBatch, ImportStagingField } from "./importStagingTypes";
import type { ImportMergeDecisionFile, ImportMergePlan, ImportMergeProposal, ImportMergeRiskLevel } from "./importMergeTypes";

const DB_FIELDS: Record<string, string> = {
  displayName: "name", email: "email", phone: "phone", currentCompany: "current_company",
  currentTitle: "current_title", location: "location", linkedinUrl: "linkedin_url",
  sourceFilename: "source_filename", yearsOfExperience: "years", primarySapModule: "primary_module",
};
const PERSONAL_FIELDS = new Set(["displayName", "email", "phone", "currentCompany", "currentTitle", "location"]);
function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function profileMap(input: Candidate360Profile[] | Map<string, Candidate360Profile> | Record<string, Candidate360Profile>) {
  if (input instanceof Map) return input;
  if (Array.isArray(input)) return new Map(input.map((item) => [item.candidateId, item]));
  return new Map(Object.entries(input || {}));
}
function profileField(profile: Candidate360Profile | undefined, fieldName: string): Candidate360Field | undefined {
  if (!profile) return undefined;
  const fields: Record<string, Candidate360Field> = {
    displayName: profile.displayName, email: profile.contactInfo.email, phone: profile.contactInfo.phone,
    currentCompany: profile.currentCompany, currentTitle: profile.currentTitle, location: profile.location,
    yearsOfExperience: profile.yearsOfExperience,
  };
  return fields[fieldName];
}
function defaultDecision(field: ImportStagingField, candidateId: string | null, trust: string) {
  const conflict = clean(field.existingValue) && clean(field.existingValue).toLowerCase() !== clean(field.importedValue).toLowerCase();
  if (field.recommendation === "reject_import" || field.blocked && /generic|low-quality/i.test(field.reasons.join(" "))) {
    return { decision: "reject_merge" as const, riskLevel: "blocked" as ImportMergeRiskLevel, blockedReasons: field.reasons };
  }
  if (!candidateId) return { decision: "hold_for_review" as const, riskLevel: "high" as ImportMergeRiskLevel, blockedReasons: ["New candidate creation is outside import merge v1"] };
  if (["candidate_confirmed", "recruiter_approved"].includes(trust) && conflict) {
    return { decision: "keep_existing" as const, riskLevel: "blocked" as ImportMergeRiskLevel, blockedReasons: [`${trust.replace(/_/g, " ")} field cannot be overwritten automatically`] };
  }
  if (field.importedConfidence < 60 && PERSONAL_FIELDS.has(field.fieldName)) {
    return { decision: "ask_candidate_to_confirm" as const, riskLevel: "medium" as ImportMergeRiskLevel, blockedReasons: ["Low-confidence personal/profile field requires candidate confirmation"] };
  }
  if (field.conflictLevel !== "none" || conflict) {
    return { decision: "hold_for_review" as const, riskLevel: "high" as ImportMergeRiskLevel, blockedReasons: ["Conflicting non-empty values require recruiter review"] };
  }
  if (!clean(field.existingValue) && clean(field.importedValue) && field.importedConfidence >= 80 && !field.blocked) {
    return { decision: "approve_merge" as const, riskLevel: "safe" as ImportMergeRiskLevel, blockedReasons: [] };
  }
  return { decision: "keep_existing" as const, riskLevel: "low" as ImportMergeRiskLevel, blockedReasons: field.reasons };
}

export function buildImportMergeProposals(importStagingBatch: ImportStagingBatch, candidate360Profiles: Candidate360Profile[] | Map<string, Candidate360Profile> | Record<string, Candidate360Profile>): ImportMergeProposal[] {
  const profiles = profileMap(candidate360Profiles);
  return importStagingBatch.candidates.flatMap((candidate) => candidate.fields.filter((field) => clean(field.importedValue)).map((field) => {
    const profile = candidate.preservedCandidateId ? profiles.get(candidate.preservedCandidateId) : undefined;
    const trustedField = profileField(profile, field.fieldName);
    const existingTrustLevel = trustedField?.source || field.existingSource || "unknown";
    const defaults = defaultDecision(field, candidate.preservedCandidateId, String(existingTrustLevel));
    return {
      proposalId: `${candidate.stagingCandidateId}:${field.fieldName}`,
      importBatchId: importStagingBatch.batchId,
      candidateId: candidate.preservedCandidateId,
      importedCandidateId: candidate.stagingCandidateId,
      fieldName: field.fieldName,
      dbFieldName: DB_FIELDS[field.fieldName] || field.fieldName,
      existingValue: field.existingValue,
      importedValue: field.importedValue,
      existingTrustLevel: String(existingTrustLevel),
      importedSource: String(field.importedSource),
      importedConfidence: field.importedConfidence,
      recommendation: field.recommendation,
      riskLevel: defaults.riskLevel,
      conflictLevel: field.conflictLevel,
      evidence: [...field.reasons, ...candidate.match.reasons],
      decision: defaults.decision,
      blockedReasons: defaults.blockedReasons,
    };
  }));
}

export function summarizeImportMergeProposals(proposals: ImportMergeProposal[]) {
  const count = (decision: ImportMergeProposal["decision"]) => proposals.filter((item) => item.decision === decision).length;
  return { proposalsGenerated: proposals.length, autoApprovableSafeMerges: count("approve_merge"), holdForReview: count("hold_for_review"), askCandidateConfirmation: count("ask_candidate_to_confirm"), keepExisting: count("keep_existing"), rejected: count("reject_merge") };
}

export function buildDefaultImportMergeDecisionFile(proposals: ImportMergeProposal[]): ImportMergeDecisionFile {
  return { generatedAt: new Date().toISOString(), mode: "local import merge decisions only; no candidate DB writes", decisions: proposals.map((item) => ({ proposalId: item.proposalId, decision: item.decision, reviewerNote: "Default decision from import merge safety rules." })) };
}

export function buildImportMergePlan(proposals: ImportMergeProposal[], decisionFile?: ImportMergeDecisionFile): ImportMergePlan {
  const decisions = new Map((decisionFile?.decisions || []).map((item) => [item.proposalId, item.decision]));
  const resolved = proposals.map((item) => ({ ...item, decision: decisions.get(item.proposalId) || item.decision }));
  const approved = resolved.filter((item) => item.decision === "approve_merge" && item.candidateId && item.riskLevel === "safe" && item.conflictLevel === "none" && !["candidate_confirmed", "recruiter_approved"].includes(item.existingTrustLevel));
  const items = approved.map((item) => ({ proposalId: item.proposalId, candidateId: item.candidateId!, fieldName: item.fieldName, dbFieldName: item.dbFieldName, beforeValue: item.existingValue, afterValue: item.importedValue, decision: "approve_merge" as const, eligible: true as const }));
  const excluded = resolved.filter((item) => !approved.some((approvedItem) => approvedItem.proposalId === item.proposalId));
  return {
    generatedAt: new Date().toISOString(), mode: "import merge plan preview only; no candidate DB writes",
    decisionsLoaded: decisionFile?.decisions.length || proposals.length, approvedMerges: items.length,
    excludedDecisions: excluded.length, candidateRecordsAffected: new Set(items.map((item) => item.candidateId)).size,
    fieldUpdatesPlanned: items.length, conflicts: resolved.filter((item) => item.conflictLevel !== "none").length,
    backupRequired: true, rollbackReady: true, items, excluded,
  };
}
