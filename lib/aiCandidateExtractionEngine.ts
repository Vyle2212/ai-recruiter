import { candidateRawCvText } from "./candidateReExtractionEngine";
import { extractFullCandidateProfile, auditFullCandidateExtraction } from "./fullCandidateExtractionEngine";
import { field, type AiCandidateExtractionReport, type AiExtractionProvider, type AnyRecord, type RawAiCandidateExtraction, type ValidatedAiCandidateExtraction } from "./cvExtractionSchema";
import { validateAiCandidateExtraction } from "./cvExtractionValidator";
import { getAiExtractionConcurrency, selectAiExtractionProvider, type AiExtractionRunOptions } from "./aiCandidateExtractionProvider";
import { emptyRawAiExtraction, sanitizeOpenAiError } from "./openAiCandidateExtractionProvider";
import { buildIdentityEvidenceBlock } from "./rawIdentityEvidenceRecovery";

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function countBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const value = clean(item[key]) || "UNKNOWN";
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}
function keywordList(raw: string, keywords: string[]) {
  const lower = raw.toLowerCase();
  return Array.from(new Set(keywords.filter((keyword) => lower.includes(keyword.toLowerCase()))));
}

function fallbackTitleFromRaw(raw: string) {
  const match = raw.match(/\bSAP\s+(?:FICO|FI\/CO|MM|SD|ABAP|Basis|BTP|EWM|BW|BI|Fiori|CPI|PI\/PO|Functional|Technical|Solution)\s+(?:Consultant|Developer|Architect|Manager|Lead|Analyst)\b/i);
  return clean(match?.[0] || "").replace(/\bFI\/CO\b/i, "FICO").replace(/\bBI\b/i, "BW");
}
export function buildAiExtractionPrompt(rawText: string, existingCandidateData: AnyRecord) {
  const identityEvidenceBlock = buildIdentityEvidenceBlock(rawText);
  return [
    "You are extracting a SAP recruiter candidate profile from a CV.",
    "Extract only information explicitly present in the CV. Do not hallucinate.",
    "If a field is unclear, return null with confidence 0.",
    "Separate employer from client/project. Client: belongs in clientCompanies, not currentEmployer.",
    "Always provide evidence text from the CV and confidence 0-100.",
    "Reject placeholders and section headings as names.",
    "Prefer labelled fields such as Full Name, Email, Phone, Current Position, Employer.",
    "If current employer is not explicit, use Not disclosed.",
    "If title is a summary sentence, reject it.",
    "Use the identity evidence candidates only when the name is explicitly supported by the CV text.",
    "Return valid JSON only using the PRIMUS CV extraction schema.",
    "",
    `Existing candidate data: ${JSON.stringify(existingCandidateData).slice(0, 4000)}`,
    "",
    identityEvidenceBlock,
    "",
    `CV text: ${rawText.slice(0, 12000)}`,
  ].join("\n");
}
export function fallbackRawExtraction(candidate: AnyRecord): RawAiCandidateExtraction {
  const raw = candidateRawCvText(candidate);
  const full = extractFullCandidateProfile(candidate);
  const sapSkills = full.sapSkills || [];
  const fallbackTitle = fallbackTitleFromRaw(raw);
  const selectedTitle = full.extractedCurrentTitle || fallbackTitle;
  const sapModules = full.sapModules || [];
  const clientCompanies = full.clientCompanies || full.projectClients || [];
  return {
    identity: {
      fullName: field(full.extractedFullName || null, full.nameConfidence || 0, full.nameSource || "fallback_full_extraction", full.nameEvidence || ""),
      normalizedFullName: full.normalizedFullName,
      alternateNames: full.possibleNameCandidates || [],
    },
    contact: {
      email: field(full.extractedEmail || null, full.extractedEmail ? 92 : 0, "fallback_contact", full.contactEvidence || ""),
      phone: field(full.extractedPhone || null, full.extractedPhone ? 84 : 0, "fallback_contact", full.contactEvidence || ""),
      linkedInUrl: field(full.linkedInUrl || null, full.linkedInUrl ? 90 : 0, "fallback_contact", full.linkedInUrl || ""),
    },
    location: {
      city: field(full.city || null, full.city ? 82 : 0, full.locationSource || "fallback_location", full.locationEvidence || ""),
      country: field(full.country || null, full.country ? 82 : 0, full.locationSource || "fallback_location", full.locationEvidence || "", full.normalizedCountry || full.country || null),
    },
    role: {
      currentTitle: field(selectedTitle || null, selectedTitle ? Math.max(full.titleConfidence || 0, fallbackTitle ? 82 : 0) : 0, full.titleSource || (fallbackTitle ? "fallback_raw_title_line" : "fallback_title"), full.titleEvidence || fallbackTitle || "", selectedTitle || null, full.titleRejectReason || ""),
      seniorityLevel: full.seniorityLevel || "",
    },
    employer: {
      currentEmployer: field(full.extractedCurrentCompany || "Not disclosed", full.companyConfidence || 40, full.companySource || "fallback_company", full.companyEvidence || "", full.extractedCurrentCompany || "Not disclosed", full.companyRejectReason || ""),
      currentCompanyStartDate: field(full.currentCompanyStartDate || null, full.currentCompanyStartDate ? 82 : 0, "fallback_current_company_tenure", full.companyEvidence || ""),
      currentCompanyEndDate: field(full.currentCompanyEndDate || null, full.currentCompanyEndDate ? 82 : 0, "fallback_current_company_tenure", full.companyEvidence || ""),
      currentCompanyYearsExperience: field(full.currentCompanyYearsExperience ? Number(full.currentCompanyYearsExperience) : null, full.currentCompanyYearsExperience ? 82 : 0, "fallback_current_company_tenure", full.currentCompanyTenureText || full.companyEvidence || ""),
      currentCompanyTenureText: field(full.currentCompanyTenureText || null, full.currentCompanyTenureText ? 82 : 0, "fallback_current_company_tenure", full.companyEvidence || ""),
      previousEmployer: field(full.previousCompany || null, full.previousCompany ? 75 : 0, "fallback_previous_company", full.previousCompany || ""),
      previousCompanyStartDate: field(full.previousCompanyStartDate || null, full.previousCompanyStartDate ? 78 : 0, "fallback_previous_company_tenure", full.previousCompany || ""),
      previousCompanyEndDate: field(full.previousCompanyEndDate || null, full.previousCompanyEndDate ? 78 : 0, "fallback_previous_company_tenure", full.previousCompany || ""),
      previousCompanyYearsExperience: field(full.previousCompanyYearsExperience ? Number(full.previousCompanyYearsExperience) : null, full.previousCompanyYearsExperience ? 78 : 0, "fallback_previous_company_tenure", full.previousCompanyTenureText || full.previousCompany || ""),
      previousCompanyTenureText: field(full.previousCompanyTenureText || null, full.previousCompanyTenureText ? 78 : 0, "fallback_previous_company_tenure", full.previousCompany || ""),
      employerHistory: full.employerHistory || [],
    },
    clientProjects: {
      clientCompanies,
      projectCompanies: clientCompanies,
      projectHistory: full.projectHistory || [],
      clientVsEmployerDecision: clientCompanies.length ? "client_project_separated_from_employer" : "",
      clientVsEmployerEvidence: clientCompanies.join(", "),
    },
    sap: {
      primarySapModule: field(full.primarySapModule && full.primarySapModule !== "UNKNOWN" ? full.primarySapModule : null, full.primarySapModule && full.primarySapModule !== "UNKNOWN" ? 86 : 0, "fallback_sap_module", full.evidenceSummary?.modules?.text || sapModules.join(", ")),
      secondarySapModules: full.secondarySapModules || [],
      sapModules,
      sapSkills,
      functionalSkills: full.functionalKeywords || [],
      technicalSkills: full.technicalKeywords || [],
      integrationSkills: full.integrationKeywords || [],
      businessProcesses: full.businessProcesses || [],
      projectTypes: full.projectTypes || [],
      s4hanaEvidence: full.s4hanaEvidence || "",
      eccEvidence: full.eccEvidence || "",
      riseEvidence: full.riseEvidence || "",
    },
    experience: {
      totalYearsExperience: field(full.totalYearsExperience ? Number.parseFloat(String(full.totalYearsExperience)) : null, full.totalYearsExperience ? 75 : 0, "fallback_experience", String(full.totalYearsExperience || "")),
      sapYearsExperience: field(full.sapYearsExperience ? Number.parseFloat(String(full.sapYearsExperience)) : null, full.sapYearsExperience ? 75 : 0, "fallback_experience", String(full.sapYearsExperience || "")),
      implementationCount: full.implementationCount || 0,
      rolloutCount: full.rolloutCount || 0,
      supportCount: full.supportCount || 0,
      amsExperience: Boolean((full.projectTypes || []).some((x: string) => /ams/i.test(x))),
      employmentHistory: full.employmentHistory || [],
      projectHistory: full.projectHistory || [],
    },
    compensation: {
      currentSalary: field(full.currentSalary || null, full.currentSalary ? 80 : 0, "fallback_compensation", full.compensationEvidence || ""),
      expectedSalary: field(full.expectedSalary || null, full.expectedSalary ? 82 : 0, "fallback_compensation", full.compensationEvidence || ""),
      salaryCurrency: full.salaryCurrency || "",
      salaryPeriod: full.salaryPeriod || "",
      noticePeriod: field(full.noticePeriod || null, full.noticePeriod ? 78 : 0, "fallback_compensation", full.compensationEvidence || ""),
      availability: field(full.availability || null, full.availability ? 70 : 0, "fallback_availability", full.availability || ""),
      compensationEvidence: full.compensationEvidence || "",
    },
    quality: {
      extractionConfidenceOverall: full.extractionConfidenceOverall || 0,
      fieldCompletenessScore: full.extractionCompletenessScore || 0,
      rawTextQuality: full.rawTextQualityReason || "",
      evidenceSummary: full.evidenceSummary || {},
    },
  };
}

export const fallbackAiExtractionProvider: AiExtractionProvider = {
  name: "deterministic-fallback",
  mode: "fallback",
  model: "deterministic-fallback",
  async extractCandidateFromCv(_rawText: string, existingCandidateData: AnyRecord) {
    const raw = fallbackRawExtraction(existingCandidateData);
    raw.providerMeta = { mode: "fallback", providerUsed: "fallback", model: "deterministic-fallback", cacheHit: false, fallbackParserUsed: true, fallbackReason: "forced_fallback", openAiExtractionUsed: false, openAiRequestAttempted: false, openAiRequestSucceeded: false };
    return raw;
  },
};

export function createMockAiExtractionProvider(raw: RawAiCandidateExtraction): AiExtractionProvider {
  return {
    name: "mock-ai",
    mode: "mock",
    model: "mock",
    async extractCandidateFromCv() {
      raw.providerMeta = { mode: "mock", providerUsed: "mock", model: "mock", cacheHit: false, fallbackParserUsed: false, openAiExtractionUsed: false, openAiRequestAttempted: false, openAiRequestSucceeded: false };
      return raw;
    },
  };
}

export function getDefaultAiExtractionProvider(options: AiExtractionRunOptions = {}) {
  return selectAiExtractionProvider(fallbackAiExtractionProvider, options);
}

export async function extractAiCandidateProfile(candidate: AnyRecord, provider = getDefaultAiExtractionProvider(), options: AiExtractionRunOptions = {}): Promise<ValidatedAiCandidateExtraction> {
  const rawText = candidateRawCvText(candidate);
  let raw: RawAiCandidateExtraction;
  try {
    raw = await provider.extractCandidateFromCv(rawText, candidate);
  } catch (error) {
    const sanitized = sanitizeOpenAiError(error);
    if (provider.mode === "openai" && options.noFallbackOnError) {
      raw = emptyRawAiExtraction(sanitized.type);
      raw.providerMeta = { mode: "openai", providerUsed: "openai", model: provider.model || "unknown", cacheHit: false, fallbackParserUsed: false, fallbackReason: "", openAiExtractionUsed: false, openAiRequestAttempted: true, openAiRequestSucceeded: false, openAiErrorType: sanitized.type, openAiErrorMessage: sanitized.message, error: sanitized.message };
    } else {
      raw = fallbackRawExtraction(candidate);
      raw.providerMeta = { mode: provider.mode, providerUsed: "fallback", model: provider.model || "unknown", cacheHit: false, fallbackParserUsed: true, fallbackReason: provider.mode === "openai" ? sanitized.type : "forced_fallback", openAiExtractionUsed: false, openAiRequestAttempted: provider.mode === "openai", openAiRequestSucceeded: false, openAiErrorType: provider.mode === "openai" ? sanitized.type : "", openAiErrorMessage: provider.mode === "openai" ? sanitized.message : "", error: sanitized.message };
    }
  }
  const meta = raw.providerMeta || { mode: provider.mode, providerUsed: provider.mode, model: provider.model || provider.name, cacheHit: false, fallbackParserUsed: provider.mode === "fallback", fallbackReason: provider.mode === "fallback" ? "forced_fallback" : "", openAiExtractionUsed: provider.mode === "openai", openAiRequestAttempted: false, openAiRequestSucceeded: false };
  return validateAiCandidateExtraction(raw, candidate, rawText, provider.name, Boolean(meta.fallbackParserUsed), meta);
}
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function auditAiCandidateExtraction(candidates: AnyRecord[], provider = getDefaultAiExtractionProvider(), options: AiExtractionRunOptions = {}): Promise<AiCandidateExtractionReport> {
  const currentReport = auditFullCandidateExtraction(candidates);
  const items = await mapWithConcurrency(candidates, getAiExtractionConcurrency(), (candidate) => extractAiCandidateProfile(candidate, provider, options));
  const searchReadyItems = items.filter((item) => item.reviewClassification === "search_ready_after_extraction");
  const parserRecoverableItems = items.filter((item) => item.reviewClassification === "parser_recoverable");
  const manualReviewItems = items.filter((item) => item.reviewClassification === "manual_review_required");
  const requiresReuploadItems = items.filter((item) => item.requiresReupload);
  const recoveredFromBlockedItems = items.filter((item) => item.recoveredByAiFromCurrentParserBlocked);
  const rejectedItems = items.filter((item) => !item.searchReadiness);
  const safeApplyCandidates = searchReadyItems.filter((item) => item.safeToApply);
  const summary = {
    totalCandidates: items.length,
    rawCvAvailable: items.filter((item) => item.rawTextQuality !== "raw_text_missing").length,
    aiExtractionAttempted: items.length,
    aiExtractionSucceeded: items.filter((item) => item.nameEvidence || item.titleEvidence || item.sapModules.length || item.hasContact).length,
    fallbackParserUsed: items.filter((item) => item.fallbackParserUsed).length,
    openAiExtractionUsed: items.filter((item) => item.openAiExtractionUsed).length,
    openAiRequestAttempted: items.filter((item) => item.openAiRequestAttempted).length,
    openAiRequestSucceeded: items.filter((item) => item.openAiRequestSucceeded).length,
    identityEvidenceBlockUsedCount: provider.mode === "openai" ? items.length : 0,
    openAiNameRecoveredFromIdentityEvidence: items.filter((item) => item.openAiExtractionUsed && item.isNameValid && /raw_identity_/i.test(item.nameSourceSection || "")).length,
    openAiStillMissingNameDespiteEvidence: items.filter((item) => item.openAiExtractionUsed && !item.isNameValid).length,
    openAiRequestFailed: items.filter((item) => item.openAiRequestAttempted && !item.openAiRequestSucceeded).length,
    fallbackOnError: items.filter((item) => item.fallbackParserUsed && item.fallbackReason && item.providerMode === "openai").length,
    cacheHits: items.filter((item) => item.cacheHit).length,
    cacheHitsOpenAi: items.filter((item) => item.cacheHit && item.providerUsed === "openai").length,
    cacheHitsFallback: items.filter((item) => item.cacheHit && item.providerUsed === "fallback").length,
    validFullNameExtracted: items.filter((item) => item.isNameValid).length,
    validEmailExtracted: items.filter((item) => item.email).length,
    validPhoneExtracted: items.filter((item) => item.phone).length,
    validTitleExtracted: items.filter((item) => item.isTitleValid && item.currentTitle).length,
    validCurrentEmployerExtracted: items.filter((item) => item.currentEmployer && item.currentEmployer !== "Not disclosed" && item.isEmployerValid).length,
    currentEmployerTenureExtracted: items.filter((item) => item.currentCompanyYearsExperience > 0).length,
    validPreviousEmployerExtracted: items.filter((item) => item.previousEmployer).length,
    previousEmployerTenureExtracted: items.filter((item) => item.previousCompanyYearsExperience > 0).length,
    totalYoeExtracted: items.filter((item) => item.experience.totalYearsExperience.value).length,
    sapYoeExtracted: items.filter((item) => item.experience.sapYearsExperience.value).length,
    sapModuleExtracted: items.filter((item) => item.sapModules.length).length,
    primaryModuleExtracted: items.filter((item) => item.primarySapModule && item.primarySapModule !== "UNKNOWN").length,
    salaryExtracted: items.filter((item) => item.compensation.expectedSalary.value || item.compensation.currentSalary.value).length,
    noticePeriodExtracted: items.filter((item) => item.compensation.noticePeriod.value).length,
    searchReadyAfterAiExtraction: searchReadyItems.length,
    parserRecoverable: parserRecoverableItems.length,
    manualReviewRequired: manualReviewItems.length,
    requiresReupload: requiresReuploadItems.length,
    rejectedDueToIdentity: items.filter((item) => item.reviewClassification === "blocked_identity").length,
    rejectedDueToTitle: items.filter((item) => item.reviewClassification === "blocked_title").length,
    rejectedDueToEmployer: items.filter((item) => item.employerRejectReason).length,
    rejectedDueToRawTextQuality: requiresReuploadItems.length,
    currentParserSearchReady: currentReport.searchReadyItems.length,
    profilesRecoveredByAiThatCurrentParserBlocked: recoveredFromBlockedItems.length,
    profilesRejectedByValidatorThatCurrentParserAccepted: items.filter((item) => !item.searchReadiness && item.currentParserSearchReady).length,
    nameRecovered: items.filter((item) => item.isNameValid && item.currentParserClassification === "blocked_identity").length,
    titleRecovered: items.filter((item) => item.isTitleValid && item.currentParserClassification === "blocked_title").length,
    employerRecovered: items.filter((item) => item.currentEmployer !== "Not disclosed").length,
    contactRecovered: items.filter((item) => item.hasContact).length,
    locationRecovered: items.filter((item) => item.normalizedCountry || item.city).length,
    sapModuleRecovered: items.filter((item) => item.sapModules.length).length,
    salaryRecovered: items.filter((item) => item.compensation.expectedSalary.value || item.compensation.currentSalary.value).length,
    previousEmployerImproved: items.filter((item) => item.previousEmployer).length,
  };
  const examples = {
    searchReady: searchReadyItems.slice(0, 30).map(example),
    rejectedIdentity: items.filter((item) => item.reviewClassification === "blocked_identity").slice(0, 30).map(example),
    rejectedTitle: items.filter((item) => item.reviewClassification === "blocked_title").slice(0, 30).map(example),
    rejectedEmployer: items.filter((item) => item.employerRejectReason).slice(0, 30).map(example),
    clientProjectSeparated: items.filter((item) => item.clientProjects.clientCompanies.length).slice(0, 30).map(example),
    recoveredFromBlocked: recoveredFromBlockedItems.slice(0, 30).map(example),
    requiresReupload: requiresReuploadItems.slice(0, 30).map(example),
  };
  return {
    providerMode: provider.mode,
    model: provider.model || provider.name,
    sampleSize: items.length,
    openAiProviderEnabled: provider.mode === "openai",
    summary,
    distributions: {
      reviewClassification: countBy(items, "reviewClassification"),
      primarySapModule: countBy(items, "primarySapModule"),
      provider: countBy(items, "provider"),
      providerUsed: countBy(items, "providerUsed"),
      fallbackReason: countBy(items.filter((item) => item.fallbackReason), "fallbackReason"),
      openAiErrorType: countBy(items.filter((item) => item.openAiErrorType), "openAiErrorType"),
    },
    items,
    searchReadyItems,
    parserRecoverableItems,
    manualReviewItems,
    requiresReuploadItems,
    recoveredFromBlockedItems,
    rejectedItems,
    safeApplyCandidates,
    examples,
  };
}

function example(item: ValidatedAiCandidateExtraction) {
  return {
    candidateId: item.candidateId,
    name: item.identity.fullName.value,
    title: item.currentTitle || item.role.currentTitle.value,
    employer: item.currentEmployer,
    primarySapModule: item.primarySapModule,
    reviewClassification: item.reviewClassification,
    reviewReasons: item.reviewReasons,
    evidence: {
      name: item.nameEvidence,
      title: item.titleEvidence,
      employer: item.currentEmployerEvidence,
    },
  };
}

export const AI_EXTRACTION_SKILLS = ["S/4HANA", "ECC", "RISE", "Fiori", "CPI", "PI/PO", "CDS", "OData", "WRICEF", "IDoc", "BAPI", "BADI", "HANA", "UAT", "SIT", "cutover", "data migration"];
export const extractSkillKeywords = (raw: string) => keywordList(raw, AI_EXTRACTION_SKILLS);




