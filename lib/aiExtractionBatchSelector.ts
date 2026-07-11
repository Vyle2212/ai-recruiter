import { fieldMappingFor } from "./aiExtractionCandidateApplyValidator";
import type { ApplyHistoryReport } from "./aiExtractionApplyHistory";
import type { BatchTargetField } from "./aiExtractionBatchGuardrails";

export type BatchCandidateSelection = {
  candidateId: string;
  candidateName: string;
  missingFields: string[];
  selectedTargetFields: BatchTargetField[];
  currentStatus: string;
  aiStatus: string;
  reviewStatus: string;
  stagingStatus: string;
  applyPreviewStatus: string;
  lastUpdated: string;
  safetyNote: string;
  excluded: boolean;
  exclusionReasons: string[];
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function candidateId(candidate: Record<string, any>) {
  return clean(candidate.id || candidate.candidate_id);
}

function candidateName(candidate: Record<string, any>) {
  return clean(candidate.name || candidate.fullName || candidate.displayName || candidate.candidate_name || "Candidate profile pending validation");
}

function valueFor(candidate: Record<string, any>, field: string) {
  const mapping = fieldMappingFor(field);
  if (!mapping) return "";
  for (const alias of mapping.aliases) {
    if (candidate[alias] !== undefined && candidate[alias] !== null) return candidate[alias];
  }
  return candidate[mapping.candidateField];
}

function isMissing(value: any) {
  const text = clean(value);
  return !text || /not disclosed|unknown|null|n\/a|candidate profile pending validation|profile under review/i.test(text) || (Array.isArray(value) && value.length === 0);
}

function hasUsableEvidence(candidate: Record<string, any>) {
  return clean(candidate.raw_text || candidate.resume_text || candidate.rawText || candidate.raw_cv).length > 200 || clean(candidate.work_experience || candidate.employment_history || candidate.skills).length > 50;
}

function duplicateConflict(candidate: Record<string, any>) {
  return /duplicate.*conflict|conflict.*duplicate/i.test(clean(candidate.duplicate_status || candidate.duplicateIdentityStatus || candidate.validation_flags));
}

function requiresReupload(candidate: Record<string, any>) {
  return /requires_original_file_reupload|reupload/i.test(clean(candidate.extraction_decision_action || candidate.decisionAction || candidate.review_action || candidate.status_reason));
}

function unsafeForExport(candidate: Record<string, any>) {
  return /unsafe|blocked/i.test(clean(candidate.export_status || candidate.client_export_status || candidate.exportBlocked));
}

function invalidIdentity(candidate: Record<string, any>) {
  return /profile under review|candidate profile pending validation|placeholder|invalid identity/i.test(candidateName(candidate));
}

function mustRepair(candidate: Record<string, any>) {
  return /must_repair|must repair|repair before search/i.test(clean(candidate.repair_status || candidate.validation_status || candidate.status_reason));
}

export function selectBatchCandidates(candidates: Record<string, any>[], options: { targetFields: BatchTargetField[]; batchSize: number; includeMustRepair?: boolean; validationQueueOnly?: boolean; highConfidenceOnly?: boolean; applyHistory?: ApplyHistoryReport | null; reviewReport?: any; stagingReport?: any; aiResults?: any } ): { selected: BatchCandidateSelection[]; excluded: BatchCandidateSelection[]; candidatesNeedingAiReview: number } {
  const verifiedByCandidate = new Map<string, Set<string>>();
  for (const item of options.applyHistory?.items || []) {
    if (item.status === "applied_verified" || item.status === "preserved_already_applied") {
      const fields = verifiedByCandidate.get(item.candidateId) || new Set<string>();
      fields.add(item.fieldName);
      verifiedByCandidate.set(item.candidateId, fields);
    }
  }
  const stagedByCandidate = new Map<string, Set<string>>();
  for (const item of Array.isArray(options.stagingReport?.items) ? options.stagingReport.items : []) {
    const fields = stagedByCandidate.get(clean(item.candidateId)) || new Set<string>();
    fields.add(clean(item.fieldName));
    stagedByCandidate.set(clean(item.candidateId), fields);
  }
  const reviewIds = new Set((Array.isArray(options.reviewReport?.queueItems) ? options.reviewReport.queueItems : []).map((item: any) => clean(item.candidateId)));
  const aiResultIds = new Set((Array.isArray(options.aiResults?.items) ? options.aiResults.items : Array.isArray(options.aiResults?.results) ? options.aiResults.results : []).map((item: any) => clean(item.candidateId || item.id)));
  const rows = candidates.map((candidate) => {
    const id = candidateId(candidate);
    const verifiedFields = verifiedByCandidate.get(id) || new Set<string>();
    const missingFields = options.targetFields.filter((field) => isMissing(valueFor(candidate, field)) && !verifiedFields.has(field));
    const selectedTargetFields = missingFields.filter((field) => fieldMappingFor(field));
    const exclusionReasons: string[] = [];
    if (!id) exclusionReasons.push("missing candidateId");
    if (invalidIdentity(candidate)) exclusionReasons.push("invalid identity");
    if (duplicateConflict(candidate)) exclusionReasons.push("duplicate conflict unresolved");
    if (requiresReupload(candidate)) exclusionReasons.push("requires original file reupload");
    if (!hasUsableEvidence(candidate)) exclusionReasons.push("no usable text/profile evidence");
    if (unsafeForExport(candidate)) exclusionReasons.push("candidate marked unsafe for export");
    if (mustRepair(candidate) && !options.includeMustRepair) exclusionReasons.push("must repair before search");
    if (!selectedTargetFields.length) exclusionReasons.push("no target fields missing or all target fields already verified/applied");
    if (options.validationQueueOnly && !reviewIds.has(id)) exclusionReasons.push("not in validation queue/review report");
    const stagedFields = stagedByCandidate.get(id) || new Set<string>();
    const row: BatchCandidateSelection = {
      candidateId: id,
      candidateName: candidateName(candidate),
      missingFields,
      selectedTargetFields,
      currentStatus: exclusionReasons.length ? "blocked" : "eligible_for_batch",
      aiStatus: aiResultIds.has(id) ? "cached AI result available" : "AI pending",
      reviewStatus: reviewIds.has(id) ? "needs review" : "not in current review file",
      stagingStatus: selectedTargetFields.some((field) => stagedFields.has(field)) ? "staged" : "not staged",
      applyPreviewStatus: selectedTargetFields.some((field) => verifiedFields.has(field)) ? "applied verified" : "not applied",
      lastUpdated: new Date().toISOString(),
      safetyNote: "Batch mode is review-first. No candidate records are updated.",
      excluded: exclusionReasons.length > 0,
      exclusionReasons,
    };
    return row;
  });
  const candidatesNeedingAiReview = rows.filter((row) => row.missingFields.length > 0).length;
  const selected = rows.filter((row) => !row.excluded).slice(0, options.batchSize);
  const selectedIds = new Set(selected.map((row) => row.candidateId));
  const excluded = rows.filter((row) => row.excluded || !selectedIds.has(row.candidateId));
  return { selected, excluded, candidatesNeedingAiReview };
}