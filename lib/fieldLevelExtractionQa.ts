import { auditFullCandidateExtraction, extractFullCandidateProfile } from "./fullCandidateExtractionEngine";
import { candidateRawCvText } from "./candidateReExtractionEngine";
import { scoreExistingCandidateProfile, scoreExtractedCandidateProfile } from "./extractionQaScoring";

export type FieldLevelExtractionQaOptions = {
  sampleMixed?: boolean;
  limit?: number;
  useExistingRawText?: boolean;
  noOpenAI?: boolean;
  onlyWorseThanExisting?: boolean;
  onlyParserNeedsFix?: boolean;
  onlyImprovedNotSearchReady?: boolean;
};

type QaRow = Record<string, any>;

function clean(value: any) { return String(value || "").replace(/\s+/g, " ").trim(); }
function candidateId(candidate: Record<string, any>) { return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.name || "unknown"); }
function existingName(candidate: Record<string, any>) { return clean(candidate.display_name || candidate.full_name || candidate.candidate_name || candidate.name); }
function existingTitle(candidate: Record<string, any>) { return clean(candidate.current_title || candidate.title || candidate.headline); }
function existingCompany(candidate: Record<string, any>) { return clean(candidate.current_company || candidate.company || candidate.display_company); }
function addUnique(list: string[], value: string) { if (value && !list.includes(value)) list.push(value); }
function countBy(items: QaRow[], getter: (item: QaRow) => string[]) { const out: Record<string, number> = {}; for (const item of items) for (const value of getter(item)) if (value) out[value] = (out[value] || 0) + 1; return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1])); }
function hasRawHeader(raw: string) { return /\b(?:name|full name|email|phone|mobile|linkedin|contact|curriculum vitae|resume)\b/i.test(raw.slice(0, 2500)); }
function isOcrOrGarbled(item: Record<string, any>, raw: string) { return /garbled|ocr/i.test(clean(item.rawTextQualityReason)) || (raw.length > 0 && raw.replace(/[^\x20-\x7E\r\n\t]/g, "").length / Math.max(raw.length, 1) < 0.75); }

function identityIssues(candidate: Record<string, any>, item: Record<string, any>) {
  const issues: string[] = [];
  const name = clean(item.extractedFullName || existingName(candidate));
  const reason = clean(item.nameRejectReason || item.identityRecoveryRejectReason || item.deepIdentityRejectReason);
  if (!item.extractedFullName) addUnique(issues, "missing_name");
  if (/candidate profile pending validation|profile under review|personal particulars?|personal details/i.test(name) || /placeholder/i.test(reason)) addUnique(issues, "placeholder_name");
  if (item.isNameSuspicious || /sentence|fragment/i.test(reason)) addUnique(issues, "fake_name_or_sentence_fragment");
  if (/\b(?:Consultant|Manager|Developer|Architect|Analyst|Lead|Executive|Engineer|Specialist)\b/i.test(name)) addUnique(issues, "name_contains_title");
  if (/\b(?:Sdn\.?\s*Bhd|Pte\.?\s*Ltd|Pvt\.?\s*Ltd|Inc\.?|Corporation|Technologies|Solutions|Consulting|Bank)\b/i.test(name)) addUnique(issues, "name_contains_company");
  if (/\b(?:Work|Current|Status|Public|Father'?s Name|Mother'?s Name|Staff Reimbursement|Monitoring Compliance|External Stakeholders|Industry)\b/i.test(name) || /metadata|noise|section|tool|skill|module|prefix/i.test(reason)) addUnique(issues, "name_contains_noise");
  return issues;
}

function titleIssues(item: Record<string, any>) {
  const issues: string[] = [];
  const title = clean(item.extractedCurrentTitle);
  const reason = clean(item.titleRejectReason);
  if (!title || /empty_title/.test(reason)) addUnique(issues, "missing_title");
  if (/generic_title_without|^Manager$|^Consultant$|^Project Manager$|^SAP Consultant$/i.test(reason) || /generic/i.test(reason)) addUnique(issues, "generic_title");
  if (/company_fragment_title/i.test(reason) || /\bat\s+[A-Z]/.test(title)) addUnique(issues, "title_contains_company");
  if (/client|project/i.test(title) && !/^SAP Project Manager$/i.test(title)) addUnique(issues, "title_contains_client_project");
  if (!/SAP|ABAP|Basis|FICO|MM|SD|EWM|BW|BTP|CPI|SuccessFactors|Ariba|HANA|Fiori/i.test(title)) addUnique(issues, "title_not_sap_relevant");
  if (/summary_sentence_title|comma_heavy_summary_title|long_summary_title|resume_sentence_title/i.test(reason)) addUnique(issues, "title_not_sap_relevant");
  return issues;
}

function employerIssues(item: Record<string, any>) {
  const issues: string[] = [];
  const company = clean(item.extractedCurrentCompany || item.currentCompany);
  const reason = clean(item.companyRejectReason);
  if (!company) addUnique(issues, "missing_current_employer");
  if (!company || /^Not disclosed$/i.test(company)) addUnique(issues, "employer_not_disclosed");
  if (/client|project/i.test(reason)) addUnique(issues, "employer_is_client_project");
  if (/date|location|month_only/i.test(reason) || /^(?:19|20)\d{2}\b|present|current/i.test(company)) addUnique(issues, "employer_is_location_or_date");
  if (/job_title_as_company|role_as_company/i.test(reason) || /^(?:L\d\s+Specialist|Maker|Manager|Consultant|Project Manager|Developer|Architect|Analyst)$/i.test(company)) addUnique(issues, "employer_is_role_title");
  if (/weak_employer|responsibility|fragment|sap_or_project_text|product_or_solution|dangling/i.test(reason)) addUnique(issues, "employer_confidence_low");
  return issues;
}

function moduleIssues(item: Record<string, any>) {
  const issues: string[] = [];
  const modules = Array.isArray(item.sapModules) ? item.sapModules : [];
  const primary = clean(item.primarySapModule);
  if (!primary || primary === "UNKNOWN") addUnique(issues, "missing_primary_module");
  if (item.primaryModuleAlignmentStatus === "evidence_conflict") addUnique(issues, "module_mismatch_with_title");
  if (/module_mismatch_unresolved/.test((item.reviewReasons || []).join(" "))) addUnique(issues, "module_mismatch_with_evidence");
  if ((!modules.length || primary === "UNKNOWN") && /sap_module_missing_but_cv_has_sap_evidence/.test((item.reviewReasons || []).join(" "))) addUnique(issues, "module_unknown_but_sap_evidence_exists");
  if (item.reviewClassification === "likely_non_sap_or_low_quality") addUnique(issues, "non_sap_profile");
  return issues;
}

function contactIssues(item: Record<string, any>) { return item.hasContact ? [] : ["missing_contact"]; }
function rawTextIssues(item: Record<string, any>, raw: string) {
  const issues: string[] = [];
  if (item.rawTextQualityReason) addUnique(issues, item.rawTextQualityReason);
  if (raw && !hasRawHeader(raw)) addUnique(issues, "raw_text_missing_header");
  if (isOcrOrGarbled(item, raw)) addUnique(issues, "raw_text_ocr_garbled");
  return issues;
}

function parserNeedsFix(item: Record<string, any>, fieldIssues: Record<string, string[]>) {
  return item.reviewClassification === "parser_recoverable" || fieldIssues.identity.length > 0 || fieldIssues.title.length > 0 || fieldIssues.employer.length > 0 || fieldIssues.module.length > 0;
}

function requiresAi(item: Record<string, any>, fieldIssues: Record<string, string[]>) {
  return item.reviewClassification === "blocked_identity" || item.reviewClassification === "blocked_title" || item.reviewClassification === "parser_recoverable" || fieldIssues.identity.length > 0 || fieldIssues.title.length > 0 || fieldIssues.module.includes("module_mismatch_with_title") || fieldIssues.employer.includes("employer_confidence_low");
}

function candidateExample(row: QaRow) {
  return {
    candidateId: row.candidateId,
    existingName: row.existing.name,
    simulatedName: row.simulated.displayName,
    existingSearchReady: row.existingScore.searchReady,
    simulatedSearchReady: row.simulatedScore.searchReady,
    existingScore: row.existingScore.score,
    simulatedScore: row.simulatedScore.score,
    title: row.simulated.title,
    currentEmployer: row.simulated.currentCompany,
    primarySapModule: row.simulated.primarySapModule,
    blockers: row.blockers,
    fieldIssues: row.fieldIssues,
    recommendedParserFixes: row.recommendedParserFixes,
    recommendedAction: row.recommendedAction,
  };
}

function selectMixed(rows: QaRow[], options: FieldLevelExtractionQaOptions) {
  let selected = rows;
  if (options.onlyWorseThanExisting) selected = selected.filter(row => row.worseThanExisting);
  if (options.onlyParserNeedsFix) selected = selected.filter(row => row.parserNeedsFix);
  if (options.onlyImprovedNotSearchReady) selected = selected.filter(row => row.improvedButStillNotSearchReady);
  if (options.sampleMixed && !options.onlyWorseThanExisting && !options.onlyParserNeedsFix && !options.onlyImprovedNotSearchReady) {
    const buckets = [
      selected.filter(row => row.simulatedScore.searchReady),
      selected.filter(row => row.worseThanExisting),
      selected.filter(row => row.improvedButStillNotSearchReady),
      selected.filter(row => row.parserNeedsFix),
      selected.filter(row => row.requiresOriginalFileReupload),
      selected.filter(row => row.requiresAi),
    ];
    const mixed: QaRow[] = [];
    let index = 0;
    while (mixed.length < selected.length && buckets.some(bucket => index < bucket.length)) {
      for (const bucket of buckets) if (index < bucket.length && !mixed.includes(bucket[index])) mixed.push(bucket[index]);
      index += 1;
    }
    selected = mixed;
  }
  if (options.limit && options.limit > 0) selected = selected.slice(0, options.limit);
  return selected;
}

export function auditFieldLevelExtractionQa(candidates: Record<string, any>[], options: FieldLevelExtractionQaOptions = {}) {
  const fullReport = auditFullCandidateExtraction(candidates);
  const itemById = new Map(fullReport.items.map((item: any) => [item.candidateId, item]));
  const allRows = candidates.map(candidate => {
    const id = candidateId(candidate);
    const item = itemById.get(id) || extractFullCandidateProfile(candidate);
    const raw = candidateRawCvText(candidate);
    const existingScore = scoreExistingCandidateProfile(candidate);
    const simulatedScore = scoreExtractedCandidateProfile(item);
    const fieldIssues = {
      identity: identityIssues(candidate, item),
      title: titleIssues(item),
      employer: employerIssues(item),
      module: moduleIssues(item),
      contact: contactIssues(item),
      rawText: rawTextIssues(item, raw),
    };
    const blockers = {
      name: fieldIssues.identity,
      title: fieldIssues.title,
      employer: fieldIssues.employer,
      module: fieldIssues.module,
      contact: fieldIssues.contact,
      rawText: fieldIssues.rawText,
    };
    const rawWorseThanExisting = (existingScore.searchReady && !simulatedScore.searchReady) || simulatedScore.score + 15 < existingScore.score;
    const keptExistingBecauseSimulatedWorse = existingScore.searchReady && rawWorseThanExisting;
    const worseThanExisting = rawWorseThanExisting && !keptExistingBecauseSimulatedWorse;
    const improved = (!existingScore.searchReady && simulatedScore.searchReady) || simulatedScore.score >= existingScore.score + 15;
    const improvedButStillNotSearchReady = improved && !simulatedScore.searchReady;
    const needsFix = parserNeedsFix(item, fieldIssues);
    const ai = requiresAi(item, fieldIssues);
    const rawTextReuploadCodes = new Set(["raw_text_too_short", "raw_text_missing", "missing_cv_sections", "raw_text_ocr_garbled"]);
    const requiresOriginalFileReupload = item.reviewClassification === "likely_reupload_required" || fieldIssues.rawText.some(code => rawTextReuploadCodes.has(code));
    const manualReview = item.reviewClassification === "manual_review_required" || (!simulatedScore.searchReady && !requiresOriginalFileReupload && (ai || needsFix));
    const safeToImproveLater = improved && !worseThanExisting && !keptExistingBecauseSimulatedWorse && !requiresOriginalFileReupload && !fieldIssues.identity.length && !fieldIssues.title.length;
    const recommendedParserFixes: string[] = [];
    if (fieldIssues.identity.length) recommendedParserFixes.push("identity_parser");
    if (fieldIssues.title.length) recommendedParserFixes.push("title_parser");
    if (fieldIssues.employer.length) recommendedParserFixes.push("employer_parser");
    if (fieldIssues.module.length) recommendedParserFixes.push("sap_module_parser");
    if (fieldIssues.rawText.length) recommendedParserFixes.push("raw_text_ingestion");
    const recommendedAction = keptExistingBecauseSimulatedWorse ? "keep_existing_record" : requiresOriginalFileReupload ? "requires_original_file_reupload" : ai ? "send_to_ai_extraction_queue" : needsFix ? "fix_parser_before_reupload" : safeToImproveLater ? "safe_to_improve_later" : simulatedScore.searchReady ? "simulation_search_ready" : "manual_review_required";
    return {
      candidateId: id,
      existing: { name: existingName(candidate), title: existingTitle(candidate), company: existingCompany(candidate) },
      simulated: { displayName: item.extractedFullName, title: item.extractedCurrentTitle, currentCompany: item.extractedCurrentCompany, primarySapModule: item.primarySapModule, sapModules: item.sapModules, reviewClassification: item.reviewClassification, reviewReasons: item.reviewReasons },
      existingScore,
      simulatedScore,
      fieldIssues,
      blockers,
      rawWorseThanExisting,
      keptExistingBecauseSimulatedWorse,
      worseThanExisting,
      improved,
      improvedButStillNotSearchReady,
      parserNeedsFix: needsFix,
      requiresAi: ai,
      manualReviewRequired: manualReview,
      requiresOriginalFileReupload,
      safeToImproveLater,
      recommendedParserFixes,
      recommendedAction,
    };
  });
  const rows = selectMixed(allRows, options);
  const hasIssue = (field: keyof QaRow["fieldIssues"]) => (row: QaRow) => row.fieldIssues[field].length > 0 && !row.simulatedScore.searchReady;
  const count = (predicate: (row: QaRow) => boolean) => rows.filter(predicate).length;
  const summary = {
    totalChecked: rows.length,
    searchReadyExisting: count(row => row.existingScore.searchReady),
    searchReadySimulated: count(row => row.simulatedScore.searchReady),
    blockedByIdentity: count(hasIssue("identity")),
    blockedByTitle: count(hasIssue("title")),
    blockedByEmployer: count(hasIssue("employer")),
    blockedBySapModule: count(hasIssue("module")),
    blockedByContact: count(hasIssue("contact")),
    blockedByRawText: count(hasIssue("rawText")),
    worseThanExisting: count(row => row.worseThanExisting),
    keptExistingBecauseSimulatedWorse: count(row => row.keptExistingBecauseSimulatedWorse),
    safeToOverwrite: count(row => row.simulatedScore.searchReady && !row.worseThanExisting && !row.keptExistingBecauseSimulatedWorse && !row.fieldIssues.identity.length && !row.fieldIssues.title.length && !row.fieldIssues.module.length),
    improvedButStillNotSearchReady: count(row => row.improvedButStillNotSearchReady),
    safeToImproveLater: count(row => row.safeToImproveLater),
    requiresAi: count(row => row.requiresAi),
    requiresManualReview: count(row => row.manualReviewRequired),
    requiresOriginalFileReupload: count(row => row.requiresOriginalFileReupload),
  };
  const distributions = {
    identityIssues: countBy(rows, row => row.fieldIssues.identity),
    titleIssues: countBy(rows, row => row.fieldIssues.title),
    employerIssues: countBy(rows, row => row.fieldIssues.employer),
    sapModuleIssues: countBy(rows, row => row.fieldIssues.module),
    rawTextIssues: countBy(rows, row => row.fieldIssues.rawText),
    parserFixPriority: countBy(rows, row => row.recommendedParserFixes),
    recommendedActions: countBy(rows, row => [row.recommendedAction]),
  };
  const examples = {
    identityFalsePositives: rows.filter(row => row.fieldIssues.identity.length).slice(0, 30).map(candidateExample),
    titleIssues: rows.filter(row => row.fieldIssues.title.length).slice(0, 30).map(candidateExample),
    employerIssues: rows.filter(row => row.fieldIssues.employer.length).slice(0, 30).map(candidateExample),
    moduleMismatch: rows.filter(row => row.fieldIssues.module.length).slice(0, 30).map(candidateExample),
    worseThanExisting: rows.filter(row => row.worseThanExisting).slice(0, 30).map(candidateExample),
    improvedButStillBlocked: rows.filter(row => row.improvedButStillNotSearchReady).slice(0, 30).map(candidateExample),
    trueReuploadRequired: rows.filter(row => row.requiresOriginalFileReupload).slice(0, 30).map(candidateExample),
  };
  return {
    mode: "read-only field-level QA; no DB writes; no deletes; no apply; no OpenAI calls",
    options: { sampleMixed: Boolean(options.sampleMixed), limit: options.limit || null, useExistingRawText: options.useExistingRawText !== false, noOpenAI: options.noOpenAI !== false, onlyWorseThanExisting: Boolean(options.onlyWorseThanExisting), onlyParserNeedsFix: Boolean(options.onlyParserNeedsFix), onlyImprovedNotSearchReady: Boolean(options.onlyImprovedNotSearchReady) },
    summary,
    distributions,
    examples,
    items: rows,
  };
}



