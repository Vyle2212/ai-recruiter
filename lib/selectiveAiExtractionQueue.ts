import { auditFullCandidateExtraction, type FullCandidateExtractionItem } from "./fullCandidateExtractionEngine";

type AnyRecord = Record<string, any>;

export type SelectiveExtractionStatus =
  | "parser_search_ready"
  | "ai_recommended_identity"
  | "ai_recommended_title"
  | "ai_recommended_employer"
  | "ai_recommended_module_alignment"
  | "ai_recommended_low_confidence"
  | "manual_review_required"
  | "reupload_required";

export type NameQualityLevel =
  | "strong_labelled_name"
  | "strong_header_name"
  | "acceptable_structured_name"
  | "weak_structured_name"
  | "suspicious_metadata_name"
  | "suspicious_ocr_joined_name"
  | "invalid_identity";

export type SelectiveAiExtractionQueueItem = {
  candidateId: string;
  extractionStatus: SelectiveExtractionStatus;
  aiRecommended: boolean;
  aiRecommendationReasons: string[];
  parserReviewClassification: string;
  parserConfidence: number;
  displayName: string;
  title: string;
  company: string;
  primarySapModule: string;
  hasContact: boolean;
  hasLocation: boolean;
  nameSource: string;
  nameEvidence: string;
  nameQualityLevel: NameQualityLevel;
  identityQualityReasons: string[];
  parserReasons: string[];
  profileHref: string;
};

export type SelectiveAiExtractionReport = {
  mode: "read-only";
  threshold: number;
  summary: Record<string, number>;
  items: SelectiveAiExtractionQueueItem[];
  aiQueueItems: SelectiveAiExtractionQueueItem[];
  parserSearchReadyItems: SelectiveAiExtractionQueueItem[];
  manualReviewItems: SelectiveAiExtractionQueueItem[];
  reuploadRequiredItems: SelectiveAiExtractionQueueItem[];
  examples: {
    aiQueue: SelectiveAiExtractionQueueItem[];
    parserSearchReady: SelectiveAiExtractionQueueItem[];
    identityQualityDowngraded: SelectiveAiExtractionQueueItem[];
    parserSearchReadyWithNameEvidence: SelectiveAiExtractionQueueItem[];
    reuploadRequired: SelectiveAiExtractionQueueItem[];
  };
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function profileHref(candidateId: string) {
  return `/candidate360/${encodeURIComponent(candidateId)}`;
}

function confidence(item: FullCandidateExtractionItem) {
  return Number(item.extractionConfidenceOverall || item.extractionCompletenessScore || 0);
}

function getNameSource(item: FullCandidateExtractionItem) {
  return clean(item.nameSource || item.identityRecoverySource || item.deepIdentitySource);
}

function getNameEvidence(item: FullCandidateExtractionItem) {
  return clean(item.nameEvidence || item.identityRecoveryEvidence || item.deepIdentityEvidence);
}

function nameValue(item: FullCandidateExtractionItem) {
  return clean(item.extractedFullName || item.existingDisplayName);
}

function hasLabelledNameEvidence(item: FullCandidateExtractionItem) {
  const source = getNameSource(item).toLowerCase();
  return /(label|full_name|candidate_name|personal_details|personal_information|biodata)/i.test(source);
}

function hasHeaderNameEvidence(item: FullCandidateExtractionItem) {
  const source = getNameSource(item).toLowerCase();
  return /(resume_header|header|contact_block|contact)/i.test(source);
}

function hasStructuredIdentityEvidence(item: FullCandidateExtractionItem) {
  return /structured_identity/i.test(getNameSource(item));
}

function hasNameEvidence(item: FullCandidateExtractionItem) {
  return Boolean(getNameSource(item) || getNameEvidence(item));
}

function containsInvalidIdentityText(name: string) {
  return /candidate profile pending validation|profile under review|personal particulars?|personal details|resume|curriculum vitae|monitoring compliance|external stakeholders|technical skills|professional summary|work experience|employment history|career objective|project experience/i.test(name);
}

function containsMetadataIdentityText(name: string) {
  return /father['’]?s name|mother['’]?s name|\b(public|work|current|status|profile|resume|industry)\b|staff reimbursement|external stakeholders|monitoring compliance|\bkone industry\b/i.test(name);
}

function containsRoleModuleOrSourceText(name: string) {
  return /\b(erp|sap|fico|abap|basis|ewm|btp|hana|consultant|developer|manager|lead|analyst|technical|functional|architect|engineer|ams|recruiter|sourcing)\b/i.test(name);
}

function containsCompanyOrLegalSuffix(name: string) {
  return /\b(sdn|bhd|pte|pvt|ltd|inc|corp|corporation|technologies|technology|solutions|consulting|bank|university|college)\b/i.test(name);
}

function hasOcrJoinedRisk(name: string) {
  return /\b(lamkieumy|humaimahmuhamad|eugeneong|qiantan|yokiee|huiyee|linhtongbp)\b/i.test(name);
}

function isCleanPersonNameShape(name: string) {
  if (!name || name.length > 80) return false;
  if (/[,:;|/\\]/.test(name)) return false;
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return false;
  const validToken = /^\p{L}+(?:[.'-]\p{L}+)*\.?$/u;
  const validInitial = /^\p{L}\.?$/u;
  const validSuffix = /^(jr\.?|sr\.?)$/i;
  return tokens.every((token) => validToken.test(token) || validInitial.test(token) || validSuffix.test(token));
}

function cleanPersonNameRisk(name: string) {
  if (!name) return "missing_name";
  if (containsInvalidIdentityText(name)) return "invalid_identity";
  if (containsMetadataIdentityText(name)) return "identity_metadata_in_name";
  if (containsRoleModuleOrSourceText(name)) return "identity_metadata_in_name";
  if (containsCompanyOrLegalSuffix(name)) return "identity_metadata_in_name";
  if (hasOcrJoinedRisk(name)) return "ocr_joined_name";
  if (!isCleanPersonNameShape(name)) return "weak_name_evidence";
  return "";
}

function getNameQualityLevel(item: FullCandidateExtractionItem): NameQualityLevel {
  const name = nameValue(item);
  if (item.reviewClassification === "blocked_identity" || item.isNameSuspicious || item.nameRejectReason || containsInvalidIdentityText(name)) return "invalid_identity";
  const risk = cleanPersonNameRisk(name);
  if (risk === "identity_metadata_in_name") return "suspicious_metadata_name";
  if (risk === "ocr_joined_name") return hasLabelledNameEvidence(item) || hasHeaderNameEvidence(item) ? "weak_structured_name" : "suspicious_ocr_joined_name";
  if (risk) return "weak_structured_name";
  if (hasLabelledNameEvidence(item)) return "strong_labelled_name";
  if (hasHeaderNameEvidence(item)) return "strong_header_name";
  if (hasStructuredIdentityEvidence(item) || hasNameEvidence(item)) return "acceptable_structured_name";
  return "weak_structured_name";
}

function getIdentityQualityReasons(item: FullCandidateExtractionItem) {
  const level = getNameQualityLevel(item);
  const reasons: string[] = [];
  if (level === "invalid_identity") reasons.push("invalid_identity");
  if (level === "suspicious_metadata_name") reasons.push("identity_metadata_in_name");
  if (level === "suspicious_ocr_joined_name") reasons.push("ocr_joined_name");
  if (level === "weak_structured_name") reasons.push("weak_name_evidence");
  if (reasons.length) reasons.push("suspicious_identity_quality");
  return Array.from(new Set(reasons));
}

function aiReasons(item: FullCandidateExtractionItem, threshold: number) {
  const reasons: string[] = [];
  reasons.push(...getIdentityQualityReasons(item));
  if (item.reviewClassification === "blocked_identity" || item.isNameSuspicious || item.nameRejectReason) reasons.push("blocked_identity");
  if (item.reviewClassification === "blocked_title" || item.isTitleSuspicious || item.titleRejectReason) reasons.push("blocked_title");
  if (item.isCompanySuspicious || item.companyRejectReason) reasons.push("suspicious_company");
  if (item.primaryModuleAlignmentStatus === "evidence_conflict" || item.reviewReasons?.includes("module_mismatch_unresolved")) reasons.push("title_module_mismatch");
  if (confidence(item) > 0 && confidence(item) < threshold) reasons.push("parser_confidence_below_threshold");
  return Array.from(new Set(reasons));
}

export function classifySelectiveAiExtractionItem(item: FullCandidateExtractionItem, threshold = 75): SelectiveAiExtractionQueueItem {
  const reasons = aiReasons(item, threshold);
  const identityReasons = getIdentityQualityReasons(item);
  const nameQualityLevel = getNameQualityLevel(item);
  let extractionStatus: SelectiveExtractionStatus = "manual_review_required";
  if (item.reviewClassification === "likely_reupload_required" || item.rawTextQualityReason) extractionStatus = "reupload_required";
  else if (item.reviewClassification === "search_ready_after_extraction" && !reasons.length) extractionStatus = "parser_search_ready";
  else if (reasons.includes("blocked_identity") || reasons.includes("suspicious_identity_quality") || reasons.includes("weak_name_evidence") || reasons.includes("identity_metadata_in_name") || reasons.includes("ocr_joined_name") || reasons.includes("invalid_identity")) extractionStatus = "ai_recommended_identity";
  else if (reasons.includes("blocked_title")) extractionStatus = "ai_recommended_title";
  else if (reasons.includes("suspicious_company")) extractionStatus = "ai_recommended_employer";
  else if (reasons.includes("title_module_mismatch")) extractionStatus = "ai_recommended_module_alignment";
  else if (reasons.includes("parser_confidence_below_threshold")) extractionStatus = "ai_recommended_low_confidence";

  const aiRecommended = extractionStatus.startsWith("ai_recommended");
  return {
    candidateId: item.candidateId,
    extractionStatus,
    aiRecommended,
    aiRecommendationReasons: reasons,
    parserReviewClassification: item.reviewClassification,
    parserConfidence: confidence(item),
    displayName: nameValue(item),
    title: clean(item.extractedCurrentTitle || item.existingTitle),
    company: clean(item.extractedCurrentCompany || item.existingCurrentCompany || "Not disclosed"),
    primarySapModule: clean(item.primarySapModule || "UNKNOWN"),
    hasContact: Boolean(item.hasContact),
    hasLocation: !item.isLocationMissing,
    nameSource: getNameSource(item),
    nameEvidence: getNameEvidence(item),
    nameQualityLevel,
    identityQualityReasons: identityReasons,
    parserReasons: item.reviewReasons || [],
    profileHref: profileHref(item.candidateId),
  };
}

export function buildSelectiveAiExtractionQueue(candidates: AnyRecord[], threshold = Number(process.env.SELECTIVE_AI_CONFIDENCE_THRESHOLD || 75)): SelectiveAiExtractionReport {
  const parserReport = auditFullCandidateExtraction(candidates);
  const items = parserReport.items.map((item) => classifySelectiveAiExtractionItem(item, threshold));
  const aiQueueItems = items.filter((item) => item.aiRecommended);
  const parserSearchReadyItems = items.filter((item) => item.extractionStatus === "parser_search_ready");
  const manualReviewItems = items.filter((item) => item.extractionStatus === "manual_review_required");
  const reuploadRequiredItems = items.filter((item) => item.extractionStatus === "reupload_required");
  const parserSearchReadyBeforeIdentityQualityGate = parserReport.items.filter((item) => item.reviewClassification === "search_ready_after_extraction").length;
  const identityQualityDowngradedItems = items.filter(
    (item) => item.parserReviewClassification === "search_ready_after_extraction" && item.extractionStatus === "ai_recommended_identity" && item.identityQualityReasons.length,
  );
  const total = items.length;
  const aiRecommended = aiQueueItems.length;
  const aiCallsSaved = Math.max(0, total - aiRecommended);
  const estimatedAiCostReduction = total ? Math.round((aiCallsSaved / total) * 100) : 0;
  const countReason = (reason: string) => aiQueueItems.filter((item) => item.aiRecommendationReasons.includes(reason)).length;
  return {
    mode: "read-only",
    threshold,
    summary: {
      totalCandidates: total,
      parserSearchReadyWithoutAi: parserSearchReadyItems.length,
      parserSearchReadyBeforeIdentityQualityGate,
      parserSearchReadyAfterIdentityQualityGate: parserSearchReadyItems.length,
      downgradedFromParserSearchReadyDueToIdentityQuality: identityQualityDowngradedItems.length,
      aiRecommendedCandidates: aiRecommended,
      aiRecommendedDueToIdentity: aiQueueItems.filter((item) => item.aiRecommendationReasons.includes("blocked_identity") || item.identityQualityReasons.length).length,
      aiRecommendedDueToSuspiciousIdentityQuality: countReason("suspicious_identity_quality"),
      aiRecommendedDueToWeakNameEvidence: countReason("weak_name_evidence"),
      aiRecommendedDueToIdentityMetadataInName: countReason("identity_metadata_in_name"),
      aiRecommendedDueToOcrJoinedName: countReason("ocr_joined_name"),
      aiRecommendedDueToTitle: countReason("blocked_title"),
      aiRecommendedDueToEmployer: countReason("suspicious_company"),
      aiRecommendedDueToModuleMismatch: countReason("title_module_mismatch"),
      aiRecommendedDueToLowConfidence: countReason("parser_confidence_below_threshold"),
      manualReviewRequired: manualReviewItems.length,
      reuploadRequired: reuploadRequiredItems.length,
      estimatedAiCallsSaved: aiCallsSaved,
      estimatedAiCostReductionPercent: estimatedAiCostReduction,
    },
    items,
    aiQueueItems,
    parserSearchReadyItems,
    manualReviewItems,
    reuploadRequiredItems,
    examples: {
      aiQueue: aiQueueItems.slice(0, 30),
      parserSearchReady: parserSearchReadyItems.slice(0, 30),
      identityQualityDowngraded: identityQualityDowngradedItems.slice(0, 30),
      parserSearchReadyWithNameEvidence: parserSearchReadyItems.slice(0, 30),
      reuploadRequired: reuploadRequiredItems.slice(0, 30),
    },
  };
}
