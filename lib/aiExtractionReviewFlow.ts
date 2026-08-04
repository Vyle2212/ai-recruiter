import { scoreExistingCandidateProfile, scoreExtractedCandidateProfile } from "./extractionQaScoring";
import { buildBackgroundAiExtractionQueue, BackgroundAiQueueOptions } from "./backgroundAiExtractionQueue";
import type { ValidatedAiCandidateExtraction } from "./cvExtractionSchema";

export type FieldReviewDecision = "safe_accept" | "risky_needs_review" | "reject" | "keep_existing" | "missing_evidence" | "conflict";

const FIELD_MAP = [
  ["displayName", "existingName", "displayName"],
  ["email", "email", "email"],
  ["phone", "phone", "phone"],
  ["title", "title", "currentTitle"],
  ["currentCompany", "currentCompany", "currentEmployer"],
  ["previousCompany", "previousCompany", "previousEmployer"],
  ["locationCountry", "country", "normalizedCountry"],
  ["primarySapModule", "primarySapModule", "primarySapModule"],
] as const;

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value || "").replace(/\s+/g, " ").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function validExisting(candidate: Record<string, any>, field: string) {
  const value = clean((candidate as any)[field] || (candidate as any)[`current_${field}`]);
  return value && !/candidate profile pending validation|profile under review|not disclosed|unknown/i.test(value);
}

function dirtyName(value: string) {
  return /\b(?:service now|hp alm|jira|oracle|excel|sap|fico|abap|consultant|manager|developer)\b/i.test(value) || value.split(/\s+/).length > 6;
}

function dirtyEmployer(value: string) {
  return /@|yahoo\.com|gmail\.com|employment history|professional experiences|date company name role|technology enablement solutions|responsibilit|implementation|project|duration|role|present/i.test(value);
}

function moduleFromTitle(title: string) {
  if (/FICO|FI\/CO/i.test(title)) return "FICO";
  if (/ABAP/i.test(title)) return "ABAP";
  if (/\bBW\b|BI/i.test(title)) return "BW";
  if (/\bMM\b/i.test(title)) return "MM";
  if (/\bSD\b/i.test(title)) return "SD";
  if (/EWM/i.test(title)) return "EWM";
  if (/BTP/i.test(title)) return "BTP";
  return "";
}

function fieldObject(ai: any, field: string): any {
  if (!ai) return null;
  if (field === "displayName") return ai.identity?.fullName || ai.identity?.name || null;
  if (field === "title") return ai.role?.currentTitle || null;
  if (field === "currentCompany") return ai.employer?.currentEmployer || null;
  if (field === "previousCompany") return ai.employer?.previousEmployer || null;
  if (field === "email") return ai.contact?.email || null;
  if (field === "phone") return ai.contact?.phone || null;
  if (field === "locationCountry") return ai.location?.country || null;
  if (field === "primarySapModule") return ai.sap?.primarySapModule || null;
  return null;
}

function fieldValue(ai: any, field: string, flatKey: string) {
  const obj = fieldObject(ai, field);
  return clean((ai && ((ai as any)[flatKey] || (ai as any)[field])) || obj?.normalizedValue || obj?.value || "");
}

function normalizedConfidence(value: any) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
}
function evidenceFor(ai: ValidatedAiCandidateExtraction | null, field: string) {
  if (!ai) return "";
  if (field === "displayName") return ai.nameEvidence || fieldObject(ai, field)?.evidence || "";
  if (field === "title") return ai.titleEvidence || fieldObject(ai, field)?.evidence || "";
  if (field === "currentCompany") return ai.currentEmployerEvidence || fieldObject(ai, field)?.evidence || "";
  if (field === "primarySapModule") return ai.sap?.primarySapModule?.evidence || fieldObject(ai, field)?.evidence || "";
  if (field === "email" || field === "phone") return ai.contactEvidence || fieldObject(ai, field)?.evidence || "";
  return "";
}

function confidenceFor(ai: ValidatedAiCandidateExtraction | null, field: string) {
  if (!ai) return 0;
  if (field === "displayName") return normalizedConfidence(ai.nameConfidence || fieldObject(ai, field)?.confidence);
  if (field === "title") return normalizedConfidence(ai.titleConfidence || fieldObject(ai, field)?.confidence);
  if (field === "currentCompany") return normalizedConfidence(ai.employerConfidence || fieldObject(ai, field)?.confidence);
  if (field === "primarySapModule") return normalizedConfidence(ai.sap?.primarySapModule?.confidence || fieldObject(ai, field)?.confidence);
  if (field === "email" || field === "phone") return normalizedConfidence(ai.contactConfidence || fieldObject(ai, field)?.confidence);
  return 70;
}

export function classifyFieldChange(field: string, existingValue: any, parserValue: any, aiValue: any, ai: ValidatedAiCandidateExtraction | null): { decision: FieldReviewDecision; reason: string; evidence: string; confidence: number } {
  const existing = clean(existingValue);
  const parser = clean(parserValue);
  const value = clean(aiValue);
  const evidence = evidenceFor(ai, field);
  const confidence = confidenceFor(ai, field);
  if (!ai || !value) return { decision: "missing_evidence", reason: "ai_extraction_missing", evidence, confidence };
  if (existing && norm(existing) === norm(value)) return { decision: "keep_existing", reason: "ai_matches_existing", evidence, confidence };
  if (!evidence && field !== "primarySapModule") return { decision: "missing_evidence", reason: "no_direct_evidence", evidence, confidence };
  if (field === "displayName" && (dirtyName(value) || !ai.isNameValid)) return { decision: "reject", reason: "dirty_or_invalid_identity", evidence, confidence };
  if (field === "title" && (!ai.isTitleValid || /^(manager|project lead)$/i.test(value))) return { decision: "reject", reason: "generic_or_invalid_title", evidence, confidence };
  if (field === "currentCompany" && (dirtyEmployer(value) || !ai.isEmployerValid)) return { decision: "reject", reason: "dirty_or_invalid_employer", evidence, confidence };
  if (field === "currentCompany" && /^Not disclosed$/i.test(value) && existing) return { decision: "keep_existing", reason: "do_not_overwrite_existing_employer_with_not_disclosed", evidence, confidence };
  if (field === "primarySapModule") {
    const titleModule = moduleFromTitle(clean(ai?.currentTitle || parser));
    if (titleModule && titleModule !== value) return { decision: "conflict", reason: "module_conflicts_with_title", evidence, confidence };
  }
  if (existing && norm(existing) !== norm(value) && confidence < 90) return { decision: "risky_needs_review", reason: "existing_valid_and_ai_differs_with_limited_confidence", evidence, confidence };
  if (confidence >= 80) return { decision: "safe_accept", reason: "direct_evidence_and_high_confidence", evidence, confidence };
  return { decision: "risky_needs_review", reason: "low_confidence_change", evidence, confidence };
}

export function buildAiExtractionReview(candidates: Record<string, any>[], aiResults: ValidatedAiCandidateExtraction[] = [], options: BackgroundAiQueueOptions = {}) {
  const queue = buildBackgroundAiExtractionQueue(candidates, options);
  const aiEntries = aiResults.map((item: any) => [clean(item.candidateId), item] as [string, any]).filter(([id]) => Boolean(id));
  const aiById = new Map<string, any>(aiEntries);
  const fieldComparisons = queue.queueItems.map((queueItem: any) => {
    const candidate = candidates.find((row: any) => clean(row.id || row.candidate_id) === queueItem.candidateId) || {};
    const ai: any = aiById.get(clean(queueItem.candidateId)) || null;
    const simulated = queueItem.parserExtractedFields || {};
    const fields = FIELD_MAP.map(([field, existingKey, aiKey]) => {
      const existingValue = clean((candidate as any)[existingKey] || (candidate as any)[field] || (candidate as any)[`current_${existingKey}`]);
      const parserValue = clean((simulated as any)[field] || (simulated as any)[aiKey]);
      const aiValue = ai ? fieldValue(ai, field, aiKey) : "";
      return { field, existingValue, parserValue, aiValue, ...classifyFieldChange(field, existingValue, parserValue, aiValue, ai) };
    });
    const safeChanges = fields.filter((field) => field.decision === "safe_accept");
    const riskyChanges = fields.filter((field) => field.decision === "risky_needs_review" || field.decision === "conflict");
    const rejectedChanges = fields.filter((field) => field.decision === "reject");
    const missingEvidence = fields.filter((field) => field.decision === "missing_evidence");
    const existingScore = scoreExistingCandidateProfile(candidate);
    const parserScore = scoreExtractedCandidateProfile({ extractedFullName: simulated.displayName, extractedCurrentTitle: simulated.title, extractedCurrentCompany: simulated.currentCompany, primarySapModule: simulated.primarySapModule, sapModules: simulated.sapModules });
    return {
      candidateId: queueItem.candidateId,
      existingScore,
      parserScore,
      aiAvailable: Boolean(ai),
      fieldComparisons: fields,
      safeChanges,
      riskyChanges,
      rejectedChanges,
      missingEvidence,
      manualReviewRequired: riskyChanges.length > 0 || rejectedChanges.length > 0,
      safeApplyCandidate: Boolean(ai) && safeChanges.length > 0 && riskyChanges.length === 0 && rejectedChanges.length === 0,
      stillBlocked: !ai || missingEvidence.length > 2 || rejectedChanges.length > 0,
      searchReadyBefore: existingScore.searchReady,
      searchReadyAfterSafeChanges: existingScore.searchReady || safeChanges.length >= 3 && !rejectedChanges.length,
      searchReadyAfterManualApprovals: existingScore.searchReady || safeChanges.length + riskyChanges.length >= 3,
    };
  });
  const allFields = fieldComparisons.flatMap((item) => item.fieldComparisons);
  const summary = {
    totalQueued: queue.summary.queueCandidates,
    cachedAiResultFileLoaded: Boolean((options as any).aiResultsFileLoaded),
    cachePath: clean((options as any).aiResultsPath),
    candidateIdMatched: fieldComparisons.filter((item) => item.aiAvailable).length,
    unmatchedCachedAiResults: aiResults.filter((item: any) => !new Set(queue.queueItems.map((q: any) => clean(q.candidateId))).has(clean(item.candidateId))).length,
    aiExtractionAvailable: fieldComparisons.filter((item) => item.aiAvailable).length,
    aiExtractionMissing: fieldComparisons.filter((item) => !item.aiAvailable).length,
    candidatesWithSafeImprovements: fieldComparisons.filter((item) => item.safeChanges.length).length,
    candidatesRequiringManualReview: fieldComparisons.filter((item) => item.manualReviewRequired).length,
    candidatesStillBlocked: fieldComparisons.filter((item) => item.stillBlocked).length,
    fieldsSafeToAccept: allFields.filter((field) => field.decision === "safe_accept").length,
    fieldsRisky: allFields.filter((field) => field.decision === "risky_needs_review" || field.decision === "conflict").length,
    fieldsRejected: allFields.filter((field) => field.decision === "reject").length,
    searchReadyBefore: fieldComparisons.filter((item) => item.searchReadyBefore).length,
    searchReadyAfterSafeChanges: fieldComparisons.filter((item) => item.searchReadyAfterSafeChanges).length,
    searchReadyAfterManualApprovals: fieldComparisons.filter((item) => item.searchReadyAfterManualApprovals).length,
  };
  return {
    mode: "read-only AI extraction review; no DB writes; no deletes; no apply",
    options: queue.options,
    summary,
    queueItems: queue.queueItems,
    aiResults,
    fieldComparisons,
    safeChanges: fieldComparisons.flatMap((item) => item.safeChanges.map((field) => ({ candidateId: item.candidateId, ...field }))),
    riskyChanges: fieldComparisons.flatMap((item) => item.riskyChanges.map((field) => ({ candidateId: item.candidateId, ...field }))),
    rejectedChanges: fieldComparisons.flatMap((item) => item.rejectedChanges.map((field) => ({ candidateId: item.candidateId, ...field }))),
    missingEvidence: fieldComparisons.flatMap((item) => item.missingEvidence.map((field) => ({ candidateId: item.candidateId, ...field }))),
    manualReviewRequired: fieldComparisons.filter((item) => item.manualReviewRequired),
    safeApplyCandidates: fieldComparisons.filter((item) => item.safeApplyCandidate),
    stillBlockedCandidates: fieldComparisons.filter((item) => item.stillBlocked),
  };
}

export { validExisting };
