import { extractFullCandidateProfile } from "./fullCandidateExtractionEngine";
import type { AiExtractionProviderMeta, AnyRecord, RawAiCandidateExtraction, ValidatedAiCandidateExtraction } from "./cvExtractionSchema";

const MODULE_ALIASES: Array<[string, RegExp]> = [
  ["FICO", /\b(?:FI\s*\/\s*CO|FI-CO|FICO|SAP\s+FI\b|SAP\s+CO\b)\b/i],
  ["ABAP", /\bABAP\b/i],
  ["BASIS", /\bBASIS\b|SAP Security|Authorization/i],
  ["BTP", /\bBTP\b|Business Technology Platform/i],
  ["CPI", /\bCPI\b|Cloud Platform Integration/i],
  ["PI/PO", /\bPI\s*\/\s*PO\b|PI-PO|PI PO/i],
  ["EWM", /\bEWM\b/i],
  ["SuccessFactors", /\bSuccessFactors\b|SAP SF\b/i],
  ["BW", /\bBW\b|BI\/BW|BW4HANA|BW\/4HANA/i],
  ["SAC", /\bSAC\b|SAP Analytics Cloud/i],
  ["MM", /\bMM\b/i],
  ["SD", /\bSD\b/i],
  ["PP", /\bPP\b/i],
  ["PM", /\bPM\b/i],
  ["QM", /\bQM\b/i],
  ["PS", /\bPS\b/i],
  ["HCM", /\bHCM\b/i],
  ["GRC", /\bGRC\b/i],
  ["MDG", /\bMDG\b/i],
  ["WM", /\bWM\b/i],
  ["TM", /\bTM\b/i],
  ["Ariba", /\bAriba\b/i],
  ["Concur", /\bConcur\b/i],
  ["Fieldglass", /\bFieldglass\b/i],
  ["VIM", /\bVIM\b/i],
  ["OpenText", /\bOpenText\b/i],
  ["Fiori", /\bFiori\b/i],
];

const COUNTRIES: Array<[string, RegExp]> = [
  ["Malaysia", /\bMY\b|Malaysia|Kuala Lumpur|Selangor|Petaling Jaya|Cyberjaya|Penang/i],
  ["Singapore", /\bSG\b|Singapore/i],
  ["Philippines", /\bPH\b|Philippines|Manila|Taguig|Makati/i],
  ["Vietnam", /\bVN\b|Vietnam|Ho Chi Minh|Hanoi/i],
  ["India", /\bIN\b|India|Bangalore|Bengaluru|Hyderabad|Chennai|Mumbai|Pune|Delhi/i],
  ["Indonesia", /\bID\b|Indonesia|Jakarta/i],
  ["Thailand", /\bTH\b|Thailand|Bangkok/i],
  ["China", /\bCN\b|China|Shanghai|Beijing/i],
  ["Taiwan", /\bTW\b|Taiwan|Taipei/i],
  ["Australia", /\bAU\b|Australia|Sydney|Melbourne/i],
  ["New Zealand", /\bNZ\b|New Zealand|Auckland/i],
  ["Japan", /\bJP\b|Japan|Tokyo/i],
  ["Korea", /\bKR\b|Korea|Seoul/i],
  ["UAE", /UAE|United Arab Emirates|Dubai|Abu Dhabi/i],
  ["Saudi Arabia", /Saudi Arabia|KSA|Riyadh|Jeddah/i],
];

const BAD_NAME_RE = /candidate profile pending validation|profile under review|personal particulars?|personal details|resume|curriculum vitae|monitoring compliance|external stakeholders|technical skills|professional summary|work experience|employment history|career objective|project experience|application development|^sap consultant$|^sap fico$|^sap hana$|robot framework/i;
const BAD_TITLE_RE = /^(?:\d{1,2}(?:\.\d)?\+?\s+years?\s+as\b)|implementation projects?|roll-?out projects?|support projects?|years as|experience in|worked as|recently worked|^i am\b/i;
const BAD_COMPANY_RE = /(?:^\d{4}\s*-\s*(?:present|now|current)$)|(?:\bLocation:)|(?:^product group$)|(?:^led\s+it systems$)|(?:^business development\s*&\s*operation$)|(?:^director oversee)|(?:^welcome to\b)|^by\s+|achieving|requirements|analy[sz]ed|designed new solutions|implemented solutions|client name|^client\s+|date of birth|personal particulars?|professional objective|authorization concepts|sap ecc|hana system solutions|jul\s+\d{4}\s+to|flavor\s*&\s*fragrance\s+solutions|creating functional designs|action is growing fast|system solutions/i;

function clean(value: any) {
  return String(value || "").replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

function norm(value: string) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function evidenceSupports(value: string, evidence: string, rawText: string, candidate: AnyRecord) {
  const v = clean(value);
  if (!v || /^not disclosed$/i.test(v)) return true;
  const haystack = norm([evidence, rawText, candidate.name, candidate.full_name, candidate.display_name, candidate.current_title, candidate.current_company].filter(Boolean).join(" "));
  const words = norm(v).split(/\s+/).filter((word) => word.length >= 3);
  return words.length > 0 && words.some((word) => haystack.includes(word));
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

export function normalizeSapModules(values: string[], rawText = "") {
  const input = `${values.join(" ")}\n${rawText}`;
  return uniq(MODULE_ALIASES.filter(([, rx]) => rx.test(input)).map(([module]) => module));
}

export function normalizeCountry(value: string, rawText = "") {
  const input = `${value}\n${rawText}`;
  return COUNTRIES.find(([, rx]) => rx.test(input))?.[0] || clean(value);
}

export function nameRejectReason(value: string) {
  const v = clean(value).replace(/^Name\s+/i, "");
  if (!v) return "empty_name";
  if (BAD_NAME_RE.test(v)) return "placeholder_or_section_heading_name";
  if (/\b(?:NRIC|passport|gender|dob|date of birth)\b/i.test(v) || /\bWork$/i.test(v)) return "identity_metadata_in_name";
  if (/^(Robot Framework|Power BI|SuccessFactors)$/i.test(v)) return "skill_or_tool_name";
  if (/\b(FICO|MM|SD|ABAP|BASIS|EWM|BTP|BW|HANA|ERP|PM|PP|QM|Consultant|Manager|Lead|Analyst|Developer|Architect|Engineer)\b/i.test(v)) return "role_or_module_fragment_in_name";
  if (/\b(?:Sdn\.?\s*Bhd|Pte\.?\s*Ltd|Pvt\.?\s*Ltd|Inc\.?|Corporation|Technologies|Solutions|Consulting|Services)\b/i.test(v)) return "company_like_name";
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return "name_word_count_invalid";
  if (/[!?]$|\b(?:responsible|implemented|managed|experience|project)\b/i.test(v)) return "sentence_like_name";
  return "";
}

export function titleRejectReason(value: string, modules: string[]) {
  const v = clean(value);
  if (!v) return "empty_title";
  if (BAD_TITLE_RE.test(v)) return "summary_sentence_title";
  if ((v.match(/,/g) || []).length >= 2) return "comma_heavy_summary_title";
  if (v.length > 85) return "long_summary_title";
  if (/\bat\s+[A-Z][A-Za-z0-9&().,' -]{3,}$/i.test(v)) return "company_fragment_title";
  if (/^(Manager|Specialist|Lead|Analyst|Consultant|SAP Consultant)$/i.test(v) && !modules.length) return "generic_title_without_sap_context";
  return "";
}

export function employerRejectReason(value: string, clientCompanies: string[] = []) {
  const v = clean(value);
  if (!v || /^not disclosed$/i.test(v)) return "";
  if (BAD_COMPANY_RE.test(v)) return "company_sentence_or_project_fragment";
  if (clientCompanies.some((client) => norm(client) === norm(v))) return "client_or_project_company_not_employer";
  if (v.length > 80 || (v.match(/,/g) || []).length >= 3) return "long_company_fragment";
  if (/\b(?:implementation|migration|module|experience|responsibilities|business process|data migration|support project)\b/i.test(v)) return "project_description_as_company";
  return "";
}

function titleModule(title: string) {
  for (const [module, rx] of MODULE_ALIASES) if (rx.test(title)) return module;
  if (/SAP\s+Analytics/i.test(title)) return "BW";
  return "";
}

function alignPrimaryModule(title: string, primary: string, modules: string[], rawText: string) {
  const fromTitle = titleModule(title);
  if (!fromTitle) return primary || modules[0] || "UNKNOWN";
  if (!modules.includes(fromTitle) && !new RegExp(`\\b${fromTitle}\\b`, "i").test(rawText)) return primary || "UNKNOWN";
  return fromTitle;
}

function currentParser(candidate: AnyRecord) {
  try {
    return extractFullCandidateProfile(candidate);
  } catch {
    return { reviewClassification: "manual_review_required", searchReadiness: false };
  }
}

export function validateAiCandidateExtraction(raw: RawAiCandidateExtraction, candidate: AnyRecord, rawText: string, provider: string, fallbackParserUsed: boolean, providerMeta?: AiExtractionProviderMeta): ValidatedAiCandidateExtraction {
  const current = currentParser(candidate);
  const nameValue = clean(raw.identity.fullName.value);
  let nameReason = nameRejectReason(nameValue);
  if (!nameReason && !evidenceSupports(nameValue, raw.identity.fullName.evidence, rawText, candidate)) nameReason = "hallucinated_name_not_in_cv";
  const modules = normalizeSapModules(raw.sap.sapModules || [], rawText);
  let primarySapModule = clean(raw.sap.primarySapModule.value) || modules[0] || "UNKNOWN";
  primarySapModule = alignPrimaryModule(clean(raw.role.currentTitle.value), primarySapModule, modules, rawText);
  if (primarySapModule !== "UNKNOWN" && !modules.includes(primarySapModule)) modules.unshift(primarySapModule);
  const titleValue = clean(raw.role.currentTitle.normalizedValue || raw.role.currentTitle.value);
  let titleReason = titleRejectReason(titleValue, modules);
  if (!titleReason && !evidenceSupports(titleValue, raw.role.currentTitle.evidence, rawText, candidate)) titleReason = "hallucinated_title_not_in_cv";
  const clientCompanies = uniq(raw.clientProjects.clientCompanies || []);
  const employerValue = clean(raw.employer.currentEmployer.value) || "Not disclosed";
  let employerReason = employerRejectReason(employerValue, clientCompanies);
  if (!employerReason && !evidenceSupports(employerValue, raw.employer.currentEmployer.evidence, rawText, candidate)) employerReason = "hallucinated_employer_not_in_cv";
  const currentEmployer = employerReason ? "Not disclosed" : employerValue;
  const email = clean(raw.contact.email.value);
  const phone = clean(raw.contact.phone.value);
  const linkedInUrl = clean(raw.contact.linkedInUrl.value);
  const validEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPhone = !phone || phone.replace(/\D/g, "").length >= 8;
  const normalizedCountry = normalizeCountry(clean(raw.location.country.value), rawText);
  const hasContact = Boolean(validEmail && email || validPhone && phone || /linkedin\.com/i.test(linkedInUrl));
  const hasLocation = Boolean(clean(raw.location.city.value) || normalizedCountry);
  const rawTextQuality = raw.quality.rawTextQuality || (rawText.length < 250 ? "raw_text_too_short" : "");
  const hasSapEvidence = Boolean(modules.length || raw.sap.sapSkills.length || raw.sap.projectTypes.length || /\bSAP\b/i.test(rawText));
  const hasKnownPrimaryModule = Boolean(primarySapModule && primarySapModule !== "UNKNOWN");
  const reviewReasons = [
    nameReason ? `identity_rejected:${nameReason}` : "",
    titleReason ? `title_rejected:${titleReason}` : "",
    employerReason ? `employer_rejected:${employerReason}` : "",
    !hasSapEvidence ? "sap_evidence_missing" : "",
    !hasKnownPrimaryModule ? "primary_sap_module_missing" : "",
    !hasContact ? "contact_missing" : "",
    !hasLocation ? "location_missing" : "",
    rawTextQuality ? `raw_text_quality:${rawTextQuality}` : "",
  ].filter(Boolean);
  let reviewClassification: ValidatedAiCandidateExtraction["reviewClassification"] = "manual_review_required";
  if (rawTextQuality) reviewClassification = "likely_reupload_required";
  else if (nameReason) reviewClassification = "blocked_identity";
  else if (titleReason) reviewClassification = "blocked_title";
  else if (!hasSapEvidence || !hasKnownPrimaryModule) reviewClassification = "likely_non_sap_or_low_quality";
  else if (!hasContact && !hasLocation) reviewClassification = "blocked_contact_location";
  else if (employerReason) reviewClassification = "parser_recoverable";
  else reviewClassification = "search_ready_after_extraction";
  const searchReadiness = reviewClassification === "search_ready_after_extraction";
  const fieldCompletenessScore = Math.round([!nameReason, !titleReason, modules.length, raw.sap.sapSkills.length, hasContact, hasLocation, Boolean(currentEmployer), raw.experience.totalYearsExperience.value, raw.compensation.expectedSalary.value].filter(Boolean).length / 9 * 100);
  const contactConfidence = Math.max(email ? raw.contact.email.confidence : 0, phone ? raw.contact.phone.confidence : 0, linkedInUrl ? raw.contact.linkedInUrl.confidence : 0);
  return {
    ...raw,
    candidateId: candidateId(candidate),
    existingDisplayName: clean(candidate.display_name || candidate.full_name || candidate.candidate_name || candidate.name),
    normalizedFullName: norm(nameValue),
    nameConfidence: nameReason ? 0 : raw.identity.fullName.confidence,
    nameEvidence: raw.identity.fullName.evidence,
    nameSourceSection: raw.identity.fullName.sourceSection,
    isNameValid: !nameReason,
    nameRejectReason: nameReason,
    email: validEmail ? email : "",
    phone: validPhone ? phone : "",
    linkedInUrl: /linkedin\.com/i.test(linkedInUrl) ? linkedInUrl : "",
    hasContact,
    contactConfidence,
    contactEvidence: clean([raw.contact.email.evidence, raw.contact.phone.evidence, raw.contact.linkedInUrl.evidence].filter(Boolean).join(" | ")),
    city: clean(raw.location.city.value),
    country: clean(raw.location.country.value),
    normalizedCountry,
    currentLocationEvidence: clean([raw.location.city.evidence, raw.location.country.evidence].filter(Boolean).join(" | ")),
    locationConfidence: hasLocation ? Math.max(raw.location.city.confidence, raw.location.country.confidence) : 0,
    currentTitle: titleReason ? "" : titleValue,
    normalizedCurrentTitle: norm(titleReason ? "" : titleValue),
    seniorityLevel: raw.role.seniorityLevel || "",
    titleConfidence: titleReason ? 0 : raw.role.currentTitle.confidence,
    titleEvidence: raw.role.currentTitle.evidence,
    titleSourceSection: raw.role.currentTitle.sourceSection,
    isTitleValid: !titleReason,
    titleRejectReason: titleReason,
    currentEmployer,
    normalizedCurrentEmployer: currentEmployer === "Not disclosed" ? "" : norm(currentEmployer),
    previousEmployer: clean(raw.employer.previousEmployer.value),
    currentEmployerEvidence: raw.employer.currentEmployer.evidence,
    employerConfidence: employerReason ? 0 : raw.employer.currentEmployer.confidence,
    isEmployerValid: !employerReason,
    employerRejectReason: employerReason,
    primarySapModule,
    secondarySapModules: uniq(raw.sap.secondarySapModules || []).filter((m) => m !== primarySapModule),
    sapModules: modules,
    sapSkills: uniq(raw.sap.sapSkills || []),
    extractionConfidenceOverall: Math.round([nameReason ? 0 : raw.identity.fullName.confidence, titleReason ? 0 : raw.role.currentTitle.confidence, modules.length ? 85 : 0, contactConfidence, hasLocation ? 80 : 0].reduce((a, b) => a + b, 0) / 5),
    fieldCompletenessScore,
    searchReadiness,
    reviewClassification,
    reviewReasons,
    safeToApply: searchReadiness && !nameReason && !titleReason && !employerReason,
    requiresManualReview: ["parser_recoverable", "manual_review_required"].includes(reviewClassification),
    requiresReupload: reviewClassification === "likely_reupload_required",
    parserRecoverable: reviewClassification === "parser_recoverable",
    rawTextQuality,
    evidenceSummary: raw.quality.evidenceSummary,
    recoveredByAiFromCurrentParserBlocked: searchReadiness && current.reviewClassification !== "search_ready_after_extraction",
    currentParserClassification: String(current.reviewClassification || ""),
    currentParserSearchReady: Boolean(current.searchReadiness),
    provider,
    providerMode: providerMeta?.mode || raw.providerMeta?.mode || "fallback",
    model: providerMeta?.model || raw.providerMeta?.model || provider,
    cacheHit: Boolean(providerMeta?.cacheHit || raw.providerMeta?.cacheHit),
    fallbackParserUsed,
    openAiExtractionUsed: Boolean(providerMeta?.openAiExtractionUsed || raw.providerMeta?.openAiExtractionUsed),
  };
}
