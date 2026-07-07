export type ReExtractionReviewClassification =
  | "safe_recovery_candidate"
  | "needs_parser_refinement"
  | "needs_manual_review"
  | "likely_bad_extraction"
  | "still_blocked_identity"
  | "still_blocked_title"
  | "still_blocked_status"
  | "insufficient_evidence";

export type ReExtractionReviewAnalysisItem = {
  candidateId: string;
  currentSearchable: boolean;
  searchableAfter: boolean;
  newlyRecoverable: boolean;
  classification: ReExtractionReviewClassification;
  confidence: number;
  current: Record<string, any>;
  suggested: Record<string, any>;
  recoveredFields: string[];
  suspiciousFields: Array<{ field: string; value: string; reason: string }>;
  blockingReasons: string[];
  evidenceSummary: Record<string, string>;
  recommendedNextStep: string;
};

export type ReExtractionReviewAnalysisSummary = {
  totalItemsAnalyzed: number;
  newlyRecoverableCount: number;
  safeRecoveryCandidatesCount: number;
  needsParserRefinementCount: number;
  needsManualReviewCount: number;
  likelyBadExtractionCount: number;
  stillBlockedIdentityCount: number;
  stillBlockedTitleCount: number;
  stillBlockedStatusCount: number;
  candidatesWithPreviousCompanyRecovered: number;
  candidatesWithExpectedSalaryRecovered: number;
  strongSapRecoveryWeakIdentityCount: number;
  currentSearchableWithSuspiciousEmployerOrTitleCount: number;
  recommendation: "do_not_reupload_yet" | "refine_parser_next" | "manual_review_required" | "ready_for_high_confidence_apply_later";
};

type ReviewItem = Record<string, any>;

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function hasKnownSapModule(item: ReviewItem) {
  const modules = item?.suggested?.sapModules;
  return Array.isArray(modules) && modules.some((module) => clean(module) && lower(module) !== "unknown");
}

function hasLocationOrContact(item: ReviewItem) {
  return Boolean(clean(item?.suggested?.city) || clean(item?.suggested?.country) || clean(item?.suggested?.email) || clean(item?.suggested?.phone));
}

function hasSapEvidence(item: ReviewItem) {
  return hasKnownSapModule(item) || (Array.isArray(item?.suggested?.sapSkills) && item.suggested.sapSkills.length > 0) || (Array.isArray(item?.suggested?.sapProjectTypes) && item.suggested.sapProjectTypes.length > 0);
}

export function suspiciousReExtractionNameReason(value: any) {
  const name = clean(value);
  if (!name) return "empty_name";
  if (/^name\s+/i.test(name)) return "starts_with_name_label";
  if (/candidate profile pending validation|profile under review|personal particular|professional objective|curriculum vitae|work experience|education|skills|summary|date of birth/i.test(name)) return "section_or_placeholder_name";
  if (/\b(?:erp|pm|fico|sapsd|sap|sd|mm|abap|basis|consultant|manager|lead|architect)\b$/i.test(name)) return "role_or_module_suffix";
  if (/[a-z]{4,}(?:ex|analyst|manager|consultant)$/i.test(name.replace(/\s+/g, "")) && !/\s/.test(name)) return "concatenated_identity_token";
  if (/\b(?:sdn|bhd|ltd|inc|corp|corporation|technologies|solutions|consulting|services|group)\b/i.test(name)) return "company_like_name";
  if (/\b(?:responsible|implemented|configured|worked|experience|project|module|migration|support|position)\b/i.test(name)) return "sentence_or_resume_text_name";
  if (name.length > 70 || name.split(/\s+/).length > 6) return "too_long_for_person_name";
  return "";
}

export function suspiciousReExtractionCompanyReason(value: any) {
  const company = clean(value);
  if (!company || company === "Not disclosed") return "";
  if (/^jul\s+2024\s+to\s+jun\s+2025$/i.test(company) || /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s+(?:-|to)\s+(?:present|\d{4})$/i.test(company) || /^(?:19|20)\d{2}\s*(?:-|to)\s*(?:19|20)\d{2}$/i.test(company)) return "date_text_company";
  if (/^implemented solutions$/i.test(company)) return "implemented_solutions_fragment";
  if (/^s\s+east\s+zone\b|^months?\)/i.test(company)) return "truncated_region_fragment";
  if (/\bORGANISATION\b.*\b(?:pvt|ltd|sdn|bhd|inc|corp|technologies|solutions|consulting)\b/i.test(company)) return "organisation_combined_company_fragment";
  if (/\bsystem solutions\b/i.test(company)) return "system_phrase_company";
  if (/\b(?:SAP|S\/4HANA|HANA|ECC|FICO|FI\/CO|MM|SD|PP|ABAP|BASIS|module|migration|implementation|rollout|support|configured|responsibilities|project description|client description)\b/i.test(company) && !/\b(?:SAP SE|SAP Malaysia)\b/i.test(company)) return "sap_or_project_text_company";
  if (/\b(?:project|client|industry|background|responsibilities|about the company|about the project|general clerk)\b/i.test(company)) return "project_or_client_description";
  if (/^by\s+|achieving|requirements|analy[sz]ed|designed new solutions/i.test(company)) return "responsibility_or_achievement_fragment";
  if (/\b(?:worked as|recently worked|i am|more than|over \d+ years|years of)\b/i.test(company)) return "sentence_like_company";
  if (company.length > 80 || company.split(/\s+/).length > 9) return "too_long_company";
  return "";
}

export function suspiciousReExtractionTitleReason(value: any, item?: ReviewItem) {
  const title = clean(value);
  if (!title) return "empty_title";
  const hasSupport = hasKnownSapModule(item || {}) || (Array.isArray(item?.suggested?.sapSkills) && item.suggested.sapSkills.length > 1);
  if (/^(?:project manager|solution architect|sap consultant)$/i.test(title) && !hasSupport) return "generic_title_without_supporting_evidence";
  if (/^(?:project manager|solution architect|sap consultant)$/i.test(title)) return "generic_title_needs_review";
  if (/^(?:worked as|recently worked|i am)\b/i.test(title)) return "sentence_start_title";
  if (/\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(title)) return "date_fragment_title";
  if (/\b(?:sdn|bhd|ltd|inc|corp|technologies|solutions|consulting|services)\b/i.test(title)) return "company_fragment_title";
  if (title.length > 100 || title.split(/\s+/).length > 13) return "long_summary_title";
  if (/\b(?:responsible for|having|experience in|implementation cycles|worked on)\b/i.test(title)) return "resume_sentence_title";
  return "";
}

function evidenceSummary(item: ReviewItem) {
  const evidence = item.evidence || {};
  const summary: Record<string, string> = {};
  for (const field of ["name", "title", "currentCompany", "previousCompany", "modules", "skills", "location", "email", "phone"]) {
    const source = clean(evidence[field]?.source);
    const text = clean(evidence[field]?.text);
    if (source || text) summary[field] = [source ? `source=${source}` : "", text].filter(Boolean).join("; ");
  }
  return summary;
}

function confidenceFor(item: ReviewItem, suspiciousFields: ReExtractionReviewAnalysisItem["suspiciousFields"]) {
  const confidence = item.confidence || {};
  let score = Math.round((Number(confidence.name || 0) + Number(confidence.title || 0) + Number(confidence.modules || 0) + Math.max(Number(confidence.location || 0), Number(confidence.contact || 0))) / 4);
  if (item.couldBecomeSearchableAfterReExtraction) score += 8;
  if (item.newlyRecoverable) score += 4;
  score -= suspiciousFields.length * 18;
  score -= (item.whyBlockedAfterReExtraction || []).length * 15;
  return Math.max(0, Math.min(100, score));
}

function classify(item: ReviewItem, suspiciousFields: ReExtractionReviewAnalysisItem["suspiciousFields"], confidence: number): ReExtractionReviewClassification {
  const blockingReasons = item.whyBlockedAfterReExtraction || [];
  if (blockingReasons.includes("blocked_status")) return "still_blocked_status";
  if (blockingReasons.includes("invalid_or_placeholder_name")) return "still_blocked_identity";
  if (blockingReasons.includes("invalid_title")) return "still_blocked_title";
  if (suspiciousFields.some((field) => field.field === "displayName")) return item.newlyRecoverable ? "needs_parser_refinement" : "likely_bad_extraction";
  if (suspiciousFields.length >= 2) return "likely_bad_extraction";
  if (suspiciousFields.length === 1) return "needs_parser_refinement";
  if (item.newlyRecoverable && item.couldBecomeSearchableAfterReExtraction && confidence >= 82 && hasKnownSapModule(item) && hasLocationOrContact(item) && hasSapEvidence(item)) return "safe_recovery_candidate";
  if (!item.couldBecomeSearchableAfterReExtraction && !blockingReasons.length) return "insufficient_evidence";
  if (blockingReasons.length) return "needs_manual_review";
  return item.currentSearchable ? "needs_manual_review" : "insufficient_evidence";
}

function nextStepFor(classification: ReExtractionReviewClassification) {
  switch (classification) {
    case "safe_recovery_candidate": return "queue_for_high_confidence_apply_later_after_admin_review";
    case "needs_parser_refinement": return "refine_parser_rules_before_apply";
    case "likely_bad_extraction": return "exclude_from_apply_and_improve_parser";
    case "still_blocked_identity": return "manual_identity_review_or_validation_queue";
    case "still_blocked_title": return "repair_title_extraction_before_search";
    case "still_blocked_status": return "review_candidate_status_before_any_recovery";
    case "insufficient_evidence": return "keep_blocked_until_more_evidence";
    default: return "manual_review_required";
  }
}

export function analyzeReExtractionReviewItems(items: ReviewItem[]) {
  const analyses = items.map((item): ReExtractionReviewAnalysisItem => {
    const suspiciousFields: ReExtractionReviewAnalysisItem["suspiciousFields"] = [];
    const nameReason = suspiciousReExtractionNameReason(item?.suggested?.displayName);
    const companyReason = suspiciousReExtractionCompanyReason(item?.suggested?.currentCompany);
    const previousCompanyReason = suspiciousReExtractionCompanyReason(item?.suggested?.previousCompany);
    const titleReason = suspiciousReExtractionTitleReason(item?.suggested?.currentTitle, item);
    if (nameReason) suspiciousFields.push({ field: "displayName", value: clean(item?.suggested?.displayName), reason: nameReason });
    if (companyReason) suspiciousFields.push({ field: "currentCompany", value: clean(item?.suggested?.currentCompany), reason: companyReason });
    if (previousCompanyReason) suspiciousFields.push({ field: "previousCompany", value: clean(item?.suggested?.previousCompany), reason: previousCompanyReason });
    if (titleReason) suspiciousFields.push({ field: "currentTitle", value: clean(item?.suggested?.currentTitle), reason: titleReason });
    const confidence = confidenceFor(item, suspiciousFields);
    const classification = classify(item, suspiciousFields, confidence);
    return {
      candidateId: clean(item.candidateId),
      currentSearchable: Boolean(item.currentSearchable),
      searchableAfter: Boolean(item.couldBecomeSearchableAfterReExtraction),
      newlyRecoverable: Boolean(item.newlyRecoverable),
      classification,
      confidence,
      current: item.current || {},
      suggested: item.suggested || {},
      recoveredFields: Array.isArray(item.recoveredFields) ? item.recoveredFields : [],
      suspiciousFields,
      blockingReasons: Array.isArray(item.whyBlockedAfterReExtraction) ? item.whyBlockedAfterReExtraction : [],
      evidenceSummary: evidenceSummary(item),
      recommendedNextStep: nextStepFor(classification),
    };
  });
  return { items: analyses, summary: buildReExtractionReviewAnalysisSummary(analyses) };
}

export function buildReExtractionReviewAnalysisSummary(items: ReExtractionReviewAnalysisItem[]): ReExtractionReviewAnalysisSummary {
  const count = (classification: ReExtractionReviewClassification) => items.filter((item) => item.classification === classification).length;
  const safeRecoveryCandidatesCount = count("safe_recovery_candidate");
  const needsParserRefinementCount = count("needs_parser_refinement");
  const likelyBadExtractionCount = count("likely_bad_extraction");
  const stillBlockedIdentityCount = count("still_blocked_identity");
  const stillBlockedTitleCount = count("still_blocked_title");
  const stillBlockedStatusCount = count("still_blocked_status");
  const needsManualReviewCount = count("needs_manual_review");
  const newlyRecoverableCount = items.filter((item) => item.newlyRecoverable).length;
  const criticalParserFindings = needsParserRefinementCount + likelyBadExtractionCount;
  const recommendation: ReExtractionReviewAnalysisSummary["recommendation"] =
    criticalParserFindings > safeRecoveryCandidatesCount ? "refine_parser_next" :
    safeRecoveryCandidatesCount > 0 && criticalParserFindings === 0 ? "ready_for_high_confidence_apply_later" :
    needsManualReviewCount > 0 ? "manual_review_required" : "do_not_reupload_yet";
  return {
    totalItemsAnalyzed: items.length,
    newlyRecoverableCount,
    safeRecoveryCandidatesCount,
    needsParserRefinementCount,
    needsManualReviewCount,
    likelyBadExtractionCount,
    stillBlockedIdentityCount,
    stillBlockedTitleCount,
    stillBlockedStatusCount,
    candidatesWithPreviousCompanyRecovered: items.filter((item) => clean(item.suggested.previousCompany)).length,
    candidatesWithExpectedSalaryRecovered: items.filter((item) => item.recoveredFields.includes("expectedSalary") && clean(item.suggested.expectedSalary) && clean(item.suggested.expectedSalary) !== "0").length,
    strongSapRecoveryWeakIdentityCount: items.filter((item) => item.blockingReasons.includes("invalid_or_placeholder_name") && Array.isArray(item.suggested.sapModules) && item.suggested.sapModules.length > 0).length,
    currentSearchableWithSuspiciousEmployerOrTitleCount: items.filter((item) => item.currentSearchable && item.suspiciousFields.some((field) => field.field === "currentCompany" || field.field === "currentTitle" || field.field === "previousCompany")).length,
    recommendation,
  };
}

export function analyzeReExtractionReviewReport(report: any) {
  return analyzeReExtractionReviewItems(Array.isArray(report?.items) ? report.items : []);
}

export function suspiciousFieldExamples(items: ReExtractionReviewAnalysisItem[], field: string, limit = 10) {
  return items.flatMap((item) => item.suspiciousFields.filter((suspicious) => suspicious.field === field).map((suspicious) => ({ candidateId: item.candidateId, value: suspicious.value, reason: suspicious.reason, classification: item.classification }))).slice(0, limit);
}