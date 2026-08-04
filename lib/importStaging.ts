import { Candidate360FieldSource as Source } from "./candidate360Types";
import type {
  ImportStagingBatch, ImportStagingCandidate, ImportStagingConflict,
  ImportStagingField, ImportStagingMatch, ImportStagingMatchStatus, ImportStagingRecommendation,
} from "./importStagingTypes";

type AnyRecord = Record<string, any>;
const COMPARE_FIELDS = ["displayName", "email", "phone", "currentCompany", "currentTitle", "location", "linkedinUrl", "sourceFilename", "yearsOfExperience", "primarySapModule"] as const;
const ALIASES: Record<(typeof COMPARE_FIELDS)[number], string[]> = {
  displayName: ["displayName", "display_name", "name", "full_name", "candidate_name"],
  email: ["email", "email_address"], phone: ["phone", "phone_number", "mobile"],
  currentCompany: ["currentCompany", "current_company", "company", "employer"],
  currentTitle: ["currentTitle", "current_title", "title", "headline"],
  location: ["location", "current_location", "country"],
  linkedinUrl: ["linkedinUrl", "linkedin_url", "linkedin"],
  sourceFilename: ["sourceFilename", "source_filename", "source_file", "file_name", "filename"],
  yearsOfExperience: ["yearsOfExperience", "years_of_experience", "years", "total_experience_years"],
  primarySapModule: ["primarySapModule", "primary_module", "primary_sap_module"],
};
const GENERIC_VALUES = ["not disclosed", "financial services", "tax services", "consultant", "co-founder &"];

function clean(value: unknown): string { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function normalized(value: unknown): string { return clean(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); }
function email(value: unknown): string { return clean(value).toLowerCase(); }
function phone(value: unknown): string { return clean(value).replace(/\D/g, "").replace(/^00/, ""); }
function url(value: unknown): string { return clean(value).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""); }
function valueOf(record: AnyRecord, fieldName: keyof typeof ALIASES): unknown {
  for (const key of ALIASES[fieldName]) if (record[key] !== undefined && record[key] !== null && clean(record[key])) return record[key];
  return "";
}
function candidateId(record: AnyRecord): string { return clean(record.id || record.candidate_id || record.existingCandidateId || record.existing_candidate_id); }
function generic(value: unknown): boolean {
  const candidate = normalized(value);
  return GENERIC_VALUES.some((item) => candidate === normalized(item) || (item === "co-founder &" && candidate.startsWith("co founder")));
}
function fieldMetadata(record: AnyRecord, fieldName: string): AnyRecord {
  const metadata = record.candidate360_fields || record.field_metadata || record.confirmed_fields || {};
  if (Array.isArray(metadata)) return metadata.find((item) => clean(item?.fieldName || item?.field_name) === fieldName) || {};
  const item = metadata[fieldName];
  return item && typeof item === "object" ? item : {};
}
function sourceOf(record: AnyRecord, fieldName: string, fallback: Source): Source | string {
  const source = clean(fieldMetadata(record, fieldName).source || record[`${fieldName}Source`] || record[`${fieldName}_source`] || record.extraction_source);
  return source || fallback;
}
function confidenceOf(record: AnyRecord, fieldName: string): number {
  const metadata = fieldMetadata(record, fieldName);
  const raw = metadata.confidence ?? record[`${fieldName}Confidence`] ?? record[`${fieldName}_confidence`] ?? record.confidence;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value <= 1 ? value * 100 : value)) : 75;
}

function scoreCandidate(imported: AnyRecord, existing: AnyRecord) {
  const reasons: string[] = [];
  let score = 0;
  const hint = clean(imported.existingCandidateId || imported.existing_candidate_id);
  if (hint && hint === candidateId(existing)) { score = 100; reasons.push("existing candidate ID supplied for reupload"); }
  const importedEmail = email(valueOf(imported, "email")); const existingEmail = email(valueOf(existing, "email"));
  if (importedEmail && importedEmail === existingEmail) { score = Math.max(score, 100); reasons.push("exact email match"); }
  const importedPhone = phone(valueOf(imported, "phone")); const existingPhone = phone(valueOf(existing, "phone"));
  if (importedPhone.length >= 7 && importedPhone === existingPhone) { score = Math.max(score, 98); reasons.push("exact phone match"); }
  const importedLinkedin = url(valueOf(imported, "linkedinUrl")); const existingLinkedin = url(valueOf(existing, "linkedinUrl"));
  if (importedLinkedin && importedLinkedin === existingLinkedin) { score = Math.max(score, 100); reasons.push("exact LinkedIn URL match"); }
  const importedFilename = normalized(valueOf(imported, "sourceFilename")); const existingFilename = normalized(valueOf(existing, "sourceFilename"));
  if (importedFilename && importedFilename === existingFilename) { score = Math.max(score, 90); reasons.push("exact source filename match"); }
  const nameMatch = normalized(valueOf(imported, "displayName")) && normalized(valueOf(imported, "displayName")) === normalized(valueOf(existing, "displayName"));
  if (nameMatch) { score += score >= 90 ? 0 : 42; reasons.push("normalized full name match"); }
  for (const [fieldName, points, label] of [["currentCompany", 20, "current company"], ["currentTitle", 14, "title"], ["location", 8, "location"]] as const) {
    const left = normalized(valueOf(imported, fieldName)); const right = normalized(valueOf(existing, fieldName));
    if (left && left === right) { score += score >= 90 ? 0 : points; reasons.push(`${label} match`); }
  }
  return { score: Math.min(100, score), reasons, nameMatch };
}

export function matchImportedCandidate(importCandidate: AnyRecord, existingCandidates: AnyRecord[]): ImportStagingMatch {
  const suppliedRisks = Array.isArray(importCandidate.possibleExistingCandidateIds) ? importCandidate.possibleExistingCandidateIds.map(clean).filter(Boolean) : [];
  if (suppliedRisks.length > 1) return { existingCandidateId: suppliedRisks[0], existingCandidateName: "", status: "duplicate_risk", confidence: Number(importCandidate.matchConfidence || 60), reasons: ["import source identified multiple possible existing candidate IDs"], competingCandidateIds: suppliedRisks.slice(1) };
  const ranked = existingCandidates.map((candidate) => ({ candidate, ...scoreCandidate(importCandidate, candidate) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 35) return { existingCandidateId: null, existingCandidateName: "", status: "new_candidate", confidence: top?.score || 0, reasons: ["No sufficiently strong existing candidate evidence"], competingCandidateIds: [] };
  const competitors = ranked.filter((item) => item !== top && item.score >= 55);
  if (competitors.length) return { existingCandidateId: candidateId(top.candidate), existingCandidateName: clean(valueOf(top.candidate, "displayName")), status: "duplicate_risk", confidence: top.score, reasons: [...top.reasons, "multiple existing candidates have material matching evidence"], competingCandidateIds: competitors.map((item) => candidateId(item.candidate)) };
  const importedName = normalized(valueOf(importCandidate, "displayName")); const existingName = normalized(valueOf(top.candidate, "displayName"));
  const strongIdentity = top.reasons.some((reason) => /email|phone|LinkedIn|candidate ID/.test(reason));
  if (strongIdentity && importedName && existingName && importedName !== existingName) return { existingCandidateId: candidateId(top.candidate), existingCandidateName: clean(valueOf(top.candidate, "displayName")), status: "conflict", confidence: top.score, reasons: [...top.reasons, "strong identifier conflicts with normalized full name"], competingCandidateIds: [] };
  const status: ImportStagingMatchStatus = top.score >= 90 ? "exact_match" : top.score >= 60 ? "likely_match" : "possible_match";
  return { existingCandidateId: candidateId(top.candidate), existingCandidateName: clean(valueOf(top.candidate, "displayName")), status, confidence: top.score, reasons: top.reasons, competingCandidateIds: [] };
}

export function compareImportedToExisting(importCandidate: AnyRecord, existingCandidate: AnyRecord): ImportStagingField[] {
  return COMPARE_FIELDS.map((fieldName): ImportStagingField => {
    const existingValue = valueOf(existingCandidate, fieldName);
    const importedValue = valueOf(importCandidate, fieldName);
    const existingSource = sourceOf(existingCandidate, fieldName, Source.ParserExtracted);
    const importedSource = sourceOf(importCandidate, fieldName, Source.Imported);
    const importedConfidence = confidenceOf(importCandidate, fieldName);
    const reasons: string[] = [];
    let recommendation: ImportStagingRecommendation = "update_existing";
    let conflictLevel: ImportStagingField["conflictLevel"] = "none";
    let blocked = false;
    if (!clean(importedValue)) { recommendation = "skip_duplicate"; reasons.push("Imported value is empty"); blocked = true; }
    else if (generic(importedValue)) { recommendation = "reject_import"; conflictLevel = "high"; reasons.push("Generic or low-quality imported value is blocked"); blocked = true; }
    else if ([Source.CandidateConfirmed, Source.RecruiterApproved].includes(existingSource as Source)) {
      recommendation = normalized(existingValue) === normalized(importedValue) ? "skip_duplicate" : "needs_recruiter_review";
      conflictLevel = normalized(existingValue) === normalized(importedValue) ? "none" : "high";
      reasons.push(`${String(existingSource).replace(/_/g, " ")} value cannot be overwritten automatically`); blocked = true;
    } else if (!clean(existingValue)) {
      if (importedConfidence < 60) { recommendation = "needs_candidate_confirmation"; conflictLevel = "low"; reasons.push("Existing field is empty but imported confidence is low"); }
      else { recommendation = "update_existing"; reasons.push("Existing field is empty and imported value is usable"); }
    } else if (normalized(existingValue) === normalized(importedValue)) {
      recommendation = "skip_duplicate"; reasons.push("Imported value matches existing value");
    } else if (importedConfidence < 60) {
      recommendation = "needs_candidate_confirmation"; conflictLevel = "medium"; reasons.push("Conflicting imported value has low confidence"); blocked = true;
    } else {
      recommendation = "needs_recruiter_review"; conflictLevel = "high"; reasons.push("Conflicting non-empty values require recruiter review"); blocked = true;
    }
    return { fieldName, existingValue, importedValue, existingSource, importedSource, importedConfidence, recommendation, conflictLevel, reasons, blocked };
  });
}

function summarize(candidates: ImportStagingCandidate[]): ImportStagingBatch["summary"] {
  const count = (status: ImportStagingMatchStatus) => candidates.filter((item) => item.match.status === status).length;
  return {
    exactMatches: count("exact_match"), likelyMatches: count("likely_match"), possibleMatches: count("possible_match"),
    newCandidates: count("new_candidate"), duplicateRisks: count("duplicate_risk"), conflicts: count("conflict"),
    readyForMergePreview: candidates.filter((item) => item.readyForMergePreview).length,
    needsRecruiterReview: candidates.filter((item) => item.recommendation === "needs_recruiter_review").length,
    blockedGenericValues: candidates.reduce((sum, item) => sum + item.blockedGenericValues.length, 0),
  };
}

export function buildImportStagingBatch(rawImportedCandidates: AnyRecord[], existingCandidates: AnyRecord[], options: { batchName?: string; now?: () => Date } = {}): ImportStagingBatch {
  const generatedAt = (options.now || (() => new Date()))().toISOString();
  const candidates = rawImportedCandidates.map((importedCandidate, index): ImportStagingCandidate => {
    const match = matchImportedCandidate(importedCandidate, existingCandidates);
    const existing = match.existingCandidateId ? existingCandidates.find((item) => candidateId(item) === match.existingCandidateId) : undefined;
    const fields = existing ? compareImportedToExisting(importedCandidate, existing) : compareImportedToExisting(importedCandidate, {});
    const conflicts: ImportStagingConflict[] = fields.filter((item) => item.conflictLevel !== "none").map((item) => ({ fieldName: item.fieldName, conflictLevel: item.conflictLevel, existingValue: item.existingValue, importedValue: item.importedValue, reason: item.reasons.join("; ") }));
    const blockedGenericValues = fields.filter((item) => item.recommendation === "reject_import").map((item) => item.fieldName);
    let recommendation: ImportStagingRecommendation;
    if (match.status === "duplicate_risk") recommendation = "skip_duplicate";
    else if (match.status === "conflict" || match.status === "possible_match" || conflicts.some((item) => item.conflictLevel === "high")) recommendation = "needs_recruiter_review";
    else if (match.status === "new_candidate") recommendation = blockedGenericValues.length ? "needs_candidate_confirmation" : "create_new_candidate";
    else if (fields.some((item) => item.recommendation === "update_existing")) recommendation = "update_existing";
    else if (fields.some((item) => item.recommendation === "needs_candidate_confirmation")) recommendation = "needs_candidate_confirmation";
    else recommendation = "skip_duplicate";
    return {
      stagingCandidateId: `${options.batchName || "import"}-${index + 1}`, importedCandidate, match, fields, conflicts,
      recommendation, decision: "pending", preservedCandidateId: match.existingCandidateId,
      blockedGenericValues,
      readyForMergePreview: ["update_existing", "create_new_candidate"].includes(recommendation) && !conflicts.some((item) => item.conflictLevel === "high"),
    };
  });
  return {
    batchId: `import-${generatedAt.replace(/\D/g, "").slice(0, 14)}`, batchName: options.batchName || "import-staging",
    generatedAt, status: "matched", mode: "import staging only; no candidate DB writes",
    importedCandidatesLoaded: rawImportedCandidates.length, existingCandidatesLoaded: existingCandidates.length,
    candidates, summary: summarize(candidates),
    preservationPolicy: { preserveExistingCandidateIds: true, preserveApplyHistory: true, preserveApprovals: true, preserveDecisions: true, preserveWorkflowState: true, candidateDbWrites: false, fullReuploadIntoMainDb: false },
  };
}

export function buildImportMergePreview(stagingBatch: ImportStagingBatch) {
  return {
    generatedAt: new Date().toISOString(), mode: "merge preview only; no candidate DB writes",
    batchId: stagingBatch.batchId,
    proposals: stagingBatch.candidates.map((item) => ({
      stagingCandidateId: item.stagingCandidateId, existingCandidateId: item.preservedCandidateId,
      recommendation: item.recommendation, decision: item.decision,
      proposedFieldUpdates: item.fields.filter((field) => field.recommendation === "update_existing" && !field.blocked),
      blockedFields: item.fields.filter((field) => field.blocked),
      mergeAllowed: item.readyForMergePreview,
    })),
    summary: stagingBatch.summary,
    candidateDbWritePerformed: false,
  };
}
