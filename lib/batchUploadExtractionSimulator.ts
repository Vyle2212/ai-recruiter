import { auditFullCandidateExtraction, extractFullCandidateProfile } from "./fullCandidateExtractionEngine";
import { candidateRawCvText } from "./candidateReExtractionEngine";
import { scoreExistingCandidateProfile, scoreExtractedCandidateProfile } from "./extractionQaScoring";

export type BatchUploadSimulationOptions = {
  sampleMixed?: boolean;
  limit?: number;
  useExistingRawText?: boolean;
  noOpenAI?: boolean;
  onlyBlockedIdentity?: boolean;
  onlyParserRecoverable?: boolean;
};

function clean(value: any) { return String(value || "").replace(/\s+/g, " ").trim(); }
function candidateId(candidate: Record<string, any>) { return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.name || "unknown"); }
function short(value: any, length = 180) { const text = clean(Array.isArray(value) ? value.join(", ") : value); return text.length > length ? `${text.slice(0, length - 3)}...` : text; }
function hasRawHeader(raw: string) { return /\b(?:name|full name|email|phone|mobile|linkedin|contact|curriculum vitae|resume)\b/i.test(raw.slice(0, 2500)); }
function isOcrOrGarbled(item: Record<string, any>, raw: string) { return /garbled|ocr/i.test(clean(item.rawTextQualityReason)) || (raw.length > 0 && raw.replace(/[^\x20-\x7E\r\n\t]/g, "").length / Math.max(raw.length, 1) < 0.75); }

function aiRecommended(item: Record<string, any>) {
  return item.reviewClassification === "blocked_identity" || item.reviewClassification === "blocked_title" || item.reviewClassification === "parser_recoverable" || item.isCompanySuspicious || item.primaryModuleAlignmentStatus === "evidence_conflict";
}

function makeExample(candidate: Record<string, any>, item: Record<string, any>, existingScore: any, simulatedScore: any, reason: string) {
  return {
    candidateId: candidateId(candidate),
    existingName: short(candidate.display_name || candidate.full_name || candidate.candidate_name || candidate.name),
    simulatedName: short(item.extractedFullName),
    existingScore: existingScore.score,
    simulatedScore: simulatedScore.score,
    existingSearchReady: existingScore.searchReady,
    simulatedSearchReady: simulatedScore.searchReady,
    title: short(item.extractedCurrentTitle),
    currentCompany: short(item.extractedCurrentCompany),
    primarySapModule: item.primarySapModule,
    reviewClassification: item.reviewClassification,
    reason,
    reviewReasons: item.reviewReasons || [],
    missingFields: simulatedScore.missingFields,
    riskFlags: simulatedScore.riskFlags,
  };
}

function selectSample(rows: Array<Record<string, any>>, options: BatchUploadSimulationOptions) {
  let selected = rows;
  if (options.onlyBlockedIdentity) selected = selected.filter(row => row.item.reviewClassification === "blocked_identity");
  if (options.onlyParserRecoverable) selected = selected.filter(row => row.item.reviewClassification === "parser_recoverable");
  if (options.sampleMixed && !options.onlyBlockedIdentity && !options.onlyParserRecoverable) {
    const buckets = [
      selected.filter(row => row.item.reviewClassification === "search_ready_after_extraction"),
      selected.filter(row => row.item.reviewClassification === "parser_recoverable"),
      selected.filter(row => row.item.reviewClassification === "blocked_identity"),
      selected.filter(row => row.item.reviewClassification === "blocked_title"),
      selected.filter(row => row.item.reviewClassification === "likely_reupload_required"),
      selected.filter(row => !["search_ready_after_extraction", "parser_recoverable", "blocked_identity", "blocked_title", "likely_reupload_required"].includes(row.item.reviewClassification)),
    ];
    const mixed: Array<Record<string, any>> = [];
    let index = 0;
    while (mixed.length < selected.length && buckets.some(bucket => index < bucket.length)) {
      for (const bucket of buckets) if (index < bucket.length) mixed.push(bucket[index]);
      index += 1;
    }
    selected = mixed;
  }
  if (options.limit && options.limit > 0) selected = selected.slice(0, options.limit);
  return selected;
}

export function auditBatchUploadExtractionSimulation(candidates: Record<string, any>[], options: BatchUploadSimulationOptions = {}) {
  const fullReport = auditFullCandidateExtraction(candidates);
  const itemById = new Map(fullReport.items.map((item: any) => [item.candidateId, item]));
  const rows = candidates.map(candidate => {
    const id = candidateId(candidate);
    const item = itemById.get(id) || extractFullCandidateProfile(candidate);
    const raw = candidateRawCvText(candidate);
    const existingScore = scoreExistingCandidateProfile(candidate);
    const simulatedScore = scoreExtractedCandidateProfile(item);
    const improved = (!existingScore.searchReady && simulatedScore.searchReady) || simulatedScore.score >= existingScore.score + 15;
    const rawWorse = (existingScore.searchReady && !simulatedScore.searchReady) || simulatedScore.score + 15 < existingScore.score;
    const keptExistingBecauseSimulatedWorse = existingScore.searchReady && rawWorse;
    const worse = rawWorse && !keptExistingBecauseSimulatedWorse;
    const safeToOverwrite = simulatedScore.searchReady && !worse && !keptExistingBecauseSimulatedWorse && !item.isNameSuspicious && !item.isTitleSuspicious && !item.isCompanySuspicious;
    const missingHeader = Boolean(raw && !hasRawHeader(raw));
    const ocrGarbled = isOcrOrGarbled(item, raw);
    const parserNeedsFix = item.reviewClassification === "parser_recoverable" || item.reviewReasons?.some((r: string) => /parser|company_suspicious|title_missing|sap_module_missing/i.test(r));
    const reuploadRecommended = item.reviewClassification === "likely_reupload_required" || (Boolean(item.rawTextQualityReason) && !raw);
    const aiRecommend = aiRecommended(item);
    const manualReview = item.reviewClassification === "manual_review_required" || (aiRecommend && !reuploadRecommended && !simulatedScore.searchReady);
    return { candidate, item, raw, existingScore, simulatedScore, improved, rawWorse, worse, keptExistingBecauseSimulatedWorse, safeToOverwrite, missingHeader, ocrGarbled, parserNeedsFix, reuploadRecommended, aiRecommend, manualReview };
  });
  const tested = selectSample(rows, options);
  const count = (predicate: (row: any) => boolean) => tested.filter(predicate).length;
  const summary = {
    totalTested: tested.length,
    existingDbSearchReady: count(row => row.existingScore.searchReady),
    simulatedExtractionSearchReady: count(row => row.simulatedScore.searchReady),
    fullNameExtracted: count(row => row.item.extractedFullName && !row.item.isNameSuspicious),
    emailExtracted: count(row => row.item.extractedEmail),
    phoneExtracted: count(row => row.item.extractedPhone),
    titleExtracted: count(row => row.item.extractedCurrentTitle && !row.item.isTitleSuspicious),
    currentEmployerExtracted: count(row => row.item.extractedCurrentCompany && row.item.extractedCurrentCompany !== "Not disclosed" && !row.item.isCompanySuspicious),
    sapModuleExtracted: count(row => Array.isArray(row.item.sapModules) && row.item.sapModules.length > 0),
    primarySapModuleExtracted: count(row => row.item.primarySapModule && row.item.primarySapModule !== "UNKNOWN"),
    profilesImprovedBySimulatedExtraction: count(row => row.improved),
    profilesWorseThanExistingDb: count(row => row.worse),
    dirtyEmployerRejected: count(row => /dirty_employer|fragment|responsibility|project|long_company|email|company_sentence/i.test(clean(row.item.companyRejectReason))),
    dirtyIdentityRejected: count(row => /tool|skill|module|metadata|fragment/i.test(clean(row.item.nameRejectReason || row.item.identityRecoveryRejectReason || row.item.deepIdentityRejectReason))),
    moduleConflictResolved: count(row => row.item.primaryModuleAlignmentStatus === "corrected_from_title"),
    moduleConflictSentToAi: count(row => row.item.primaryModuleAlignmentStatus === "evidence_conflict" || row.aiRecommend && row.simulatedScore.riskFlags.includes("title_module_mismatch")),
    keptExistingBecauseSimulatedWorse: count(row => row.keptExistingBecauseSimulatedWorse),
    safeToOverwrite: count(row => row.safeToOverwrite),
    rawTextMissingHeader: count(row => row.missingHeader),
    ocrGarbled: count(row => row.ocrGarbled),
    parserNeedsFix: count(row => row.parserNeedsFix),
    reuploadRecommended: count(row => row.reuploadRecommended),
    aiRecommended: count(row => row.aiRecommend),
    manualReviewRequired: count(row => row.manualReview),
  };
  const improvedExamples = tested.filter(row => row.improved).slice(0, 30).map(row => makeExample(row.candidate, row.item, row.existingScore, row.simulatedScore, "simulated_extraction_improved_profile"));
  const failedExtractionExamples = tested.filter(row => !row.simulatedScore.searchReady).slice(0, 30).map(row => makeExample(row.candidate, row.item, row.existingScore, row.simulatedScore, "simulated_extraction_not_search_ready"));
  const likelyReuploadRequiredExamples = tested.filter(row => row.reuploadRecommended).slice(0, 30).map(row => makeExample(row.candidate, row.item, row.existingScore, row.simulatedScore, "likely_reupload_required"));
  const parserNeedsFixExamples = tested.filter(row => row.parserNeedsFix).slice(0, 30).map(row => makeExample(row.candidate, row.item, row.existingScore, row.simulatedScore, "parser_needs_fix"));
  const items = tested.map(row => ({
    candidateId: candidateId(row.candidate),
    existingScore: row.existingScore,
    simulatedScore: row.simulatedScore,
    improved: row.improved,
    worse: row.worse,
    rawWorse: row.rawWorse,
    keptExistingBecauseSimulatedWorse: row.keptExistingBecauseSimulatedWorse,
    safeToOverwrite: row.safeToOverwrite,
    recommendedAction: row.keptExistingBecauseSimulatedWorse ? "keep_existing_record" : row.aiRecommend ? "send_to_ai_extraction_queue" : row.safeToOverwrite ? "safe_to_overwrite" : row.reuploadRecommended ? "requires_original_file_reupload" : "manual_review_required",
    rawTextMissingHeader: row.missingHeader,
    ocrGarbled: row.ocrGarbled,
    parserNeedsFix: row.parserNeedsFix,
    reuploadRecommended: row.reuploadRecommended,
    aiRecommended: row.aiRecommend,
    manualReviewRequired: row.manualReview,
    simulated: {
      displayName: row.item.extractedFullName,
      email: row.item.extractedEmail,
      phone: row.item.extractedPhone,
      title: row.item.extractedCurrentTitle,
      currentCompany: row.item.extractedCurrentCompany,
      primarySapModule: row.item.primarySapModule,
      sapModules: row.item.sapModules,
      reviewClassification: row.item.reviewClassification,
      reviewReasons: row.item.reviewReasons,
    },
  }));
  return {
    mode: "simulation only; no DB writes; no deletes; no apply",
    options: { sampleMixed: Boolean(options.sampleMixed), limit: options.limit || null, useExistingRawText: options.useExistingRawText !== false, noOpenAI: options.noOpenAI !== false, onlyBlockedIdentity: Boolean(options.onlyBlockedIdentity), onlyParserRecoverable: Boolean(options.onlyParserRecoverable) },
    source: "existing raw CV/resume text",
    summary,
    examples: { improvedExamples, failedExtractionExamples, likelyReuploadRequiredExamples, parserNeedsFixExamples },
    items,
  };
}
