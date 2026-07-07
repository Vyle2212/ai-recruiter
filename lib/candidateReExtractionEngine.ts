import { classifyCandidateSearchVisibility } from "./candidateSearchVisibility";
import { classifySearchableProfileQuality } from "./searchableProfileQualityGate";
import { cleanTalentSearchTitle, isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, safeTalentSearchCompany } from "./talentSearchDisplay";

type AnyRecord = Record<string, any>;

export type ReExtractionFieldConfidence = {
  value: string | string[];
  confidence: number;
  source: string;
  evidence: string;
};

export type CandidateReExtractionSuggestion = {
  candidateId: string;
  hasRawCvText: boolean;
  current: Record<string, any>;
  suggested: {
    displayName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    currentTitle: string;
    currentCompany: string;
    currentEmployerStartDate: string;
    currentEmployerEndDate: string;
    currentEmployerDuration: string;
    previousTitle: string;
    previousCompany: string;
    previousEmployerStartDate: string;
    previousEmployerEndDate: string;
    previousEmployerDuration: string;
    totalYearsExperience: string;
    expectedSalary: string;
    sapModules: string[];
    sapSkills: string[];
    sapProjectTypes: string[];
    latestCvMonthYear: string;
  };
  confidence: Record<string, number>;
  evidence: Record<string, { source: string; text: string }>;
  sources: {
    nameCleanupSource: string;
    currentCompanySource: string;
    previousCompanySource: string;
    titleSource: string;
    moduleSource: string;
  };
  rejectReasons: {
    name: string[];
    company: string[];
    title: string[];
  };
  auditFlags: {
    invalidCompanySuggestionsRejected: number;
    previousCompanyDeduplicated: boolean;
    genericTitleAvoided: boolean;
    invalidCurrentCompanyFragment: boolean;
    employerLinesSanitized: number;
    employerExtractedFromLongLine: boolean;
    suspiciousNamesCleaned: number;
    suspiciousNamesRejected: number;
    suspiciousCompaniesRejected: number;
    suspiciousTitlesRejected: number;
  };
  employerSanitizations: Array<{ original: string; sanitized: string }>;
  likelySapProfileRecovered: boolean;
  couldBecomeSearchableAfterReExtraction: boolean;
  currentSearchable: boolean;
  newlyRecoverable: boolean;
  whyBlockedAfterReExtraction: string[];
  recoveredFields: string[];
};

const MONTH = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const DATE_RANGE = new RegExp(`(?:(${MONTH})\\s*)?((?:19|20)\\d{2})\\s*(?:-|\\u2013|\\u2014|to|until)\\s*(?:(present|current|now|ongoing|till\\s+date|to\\s+date)|(?:(${MONTH})\\s*)?((?:19|20)\\d{2}))`, "ig");
const BAD_NAME_RE = /candidate profile pending validation|profile under review|professional objective|personal particular|curriculum vitae|summary|work experience|education|skills|strictly confidential|date of birth/i;
const TITLE_WORD_RE = /\b(sap|consultant|manager|developer|analyst|architect|lead|specialist|engineer|basis|fico|abap|functional|technical)\b/i;
const NAME_SUFFIX_RE = /(?:[-\s]+(?:ep\s+)?(?:erp|pm|fico|sapsd|sapmm|sapfico|consultant|manager|lead|analyst))+$/i;
const NAME_MODULE_PREFIX_RE = /^(?:fi|pp|sd|mm|fico|erp)\s+(?:ar|ap|asset|erp|pm)\b/i;
const BAD_COMPANY_RE = /administered|data enablement|over\s+\d+\s+years|many project|july\s+2008|implementation|migration|module|experience|domain of|as an(?:\s+SAP)?|sap including functional|in the world|where as my goal|managed\s*&|roles and|responsibilities|business process|application development|work experience|working on global|handles\b|^work$|^project$|^provided$|^overall and$|analysed finance|^sap finance$|tool$|^led$|^position$|^supported$|^product$|^provided\b|bachelor|degree|university|information technology|appointed\b|assign group|^in the\b|^by\s+|achieving|requirements|analy[sz]ed|designed new solutions|with various|mobile services|credit and collections officer|^year\s+|client services|client name|action is growing fast|creating functional designs|implemented solutions|^s\s+east\s+zone/i;
const BAD_TITLE_RE = /professional objective|personal particular|curriculum vitae|summary|work experience|education|skills|strictly confidential|date of birth|responsible for|experience in|having|worked on|implementation cycles|\d+\s+years\s+as|certified|cleared/i;
const COMPANY_MODULE_LIST_RE = /\b(?:SAP\s+)?(?:ECC|S\/4HANA|FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|ABAP|BASIS|BTP|EWM|WM|MDG|GRC|BW|P2P|MDM)\b.*[,/&].*\b(?:FICO|MM|SD|PP|ABAP|BASIS|P2P|MDM|HANA)\b/i;
const BAD_COMPANY_SECTION_RE = /\b(skills?|technical skills?|tools?|platforms?|projects?|project experience|certifications?|education|training|professional summary|profile summary|responsibilities|achievements)\b/i;
const GENERIC_TITLE_RE = /^(?:functional consultant|technical consultant|consultant|manager|lead|analyst|developer|architect|specialist)$/i;

const MODULE_PATTERNS: Array<[string, RegExp]> = [
  ["FICO", /\b(?:FI\s*\/\s*CO|FI\s*-\s*CO|FICO|SAP\s+FI\b|SAP\s+CO\b|\bFI\b|\bCO\b)\b/i],
  ["MM", /\b(?:SAP\s+)?MM\b/i], ["SD", /\b(?:SAP\s+)?SD\b/i], ["PP", /\b(?:SAP\s+)?PP\b/i], ["QM", /\b(?:SAP\s+)?QM\b/i],
  ["PM", /\b(?:SAP\s+)?PM\b/i], ["PS", /\b(?:SAP\s+)?PS\b/i], ["ABAP", /\bABAP\b/i], ["BASIS", /\bBASIS\b/i],
  ["BTP", /\bBTP\b/i], ["CPI", /\bCPI\b/i], ["PI/PO", /\b(?:PI\s*\/\s*PO|PI-PO|PI PO)\b/i], ["EWM", /\bEWM\b/i],
  ["WM", /\bWM\b/i], ["TM", /\bTM\b/i], ["MDG", /\bMDG\b/i], ["GRC", /\bGRC\b/i], ["BW", /\b(?:BI\s*\/\s*BW|BW\s*\/\s*4HANA|BW4HANA|SAP\s+BI\b|SAP\s+BW\b|\bBW\b)\b/i],
  ["SAC", /\bSAC\b|SAP\s+Analytics\s+Cloud/i], ["Datasphere", /\bDatasphere\b/i], ["SuccessFactors", /\bSuccessFactors\b|SAP\s+SF\b/i],
  ["Ariba", /\bAriba\b/i], ["Concur", /\bConcur\b/i], ["Fieldglass", /\bFieldglass\b/i], ["VIM", /\bVIM\b/i], ["OpenText", /\bOpenText\b/i],
  ["HCM", /\bHCM\b/i], ["IS-U", /\bIS\s*-\s*U\b|\bISU\b/i], ["Fiori", /\bFiori\b/i], ["UI5", /\bUI5\b/i],
];

const SKILL_PATTERNS: Array<[string, RegExp]> = [
  ["S/4HANA", /\bS\/?4HANA\b|S\/4\s*HANA/i], ["ECC", /\bECC\b/i], ["RISE", /\bRISE\b/i], ["Fiori", /\bFiori\b/i],
  ["CPI", /\bCPI\b/i], ["PI/PO", /\bPI\s*\/\s*PO\b|\bPI-PO\b/i], ["CDS", /\bCDS\b/i], ["OData", /\bOData\b/i],
  ["WRICEF", /\bWRICEF\b/i], ["IDoc", /\bIDoc\b/i], ["BAPI", /\bBAPI\b/i], ["BADI", /\bBADI\b/i], ["ALV", /\bALV\b/i],
  ["SmartForms", /\bSmart\s*Forms?\b/i], ["Adobe Forms", /\bAdobe\s+Forms?\b/i], ["HANA", /\bHANA\b/i], ["ABAP OO", /\bABAP\s+OO\b/i],
  ["UAT", /\bUAT\b/i], ["SIT", /\bSIT\b/i], ["cutover", /\bcutover\b/i], ["data migration", /\bdata\s+migration\b/i],
];

const PROJECT_PATTERNS: Array<[string, RegExp]> = [
  ["implementation", /\bimplementation\b|greenfield/i], ["support", /\bsupport\b/i], ["rollout", /\broll\s*-?\s*out\b|\brollout\b/i],
  ["upgrade", /\bupgrade\b/i], ["migration", /\bmigration\b/i], ["S/4HANA", /\bS\/?4HANA\b|S\/4\s*HANA/i], ["ECC", /\bECC\b/i],
  ["RISE", /\bRISE\b/i], ["AMS", /\bAMS\b|application\s+managed\s+services/i],
];

function clean(value: any) { return String(value || "").replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim(); }
function textOf(value: any): string { if (value == null) return ""; if (Array.isArray(value)) return value.map(textOf).join("\n"); if (typeof value === "object") return Object.values(value).map(textOf).join("\n"); return String(value); }
function candidateId(candidate: AnyRecord) { return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown"); }
export function candidateRawCvText(candidate: AnyRecord) { return textOf([candidate.raw_text, candidate.resume_text, candidate.raw_cv, candidate.rawText, candidate.resumeText, candidate.profile_text, candidate.summary, candidate.parsed_json, candidate.experience, candidate.work_experience, candidate.employment_history]).trim(); }
function evidence(source: string, text: string) { return { source, text: clean(text).slice(0, 240) }; }
function confidence(value: string | string[], score: number, source: string, text: string): ReExtractionFieldConfidence { return { value, confidence: value && (!Array.isArray(value) || value.length) ? score : 0, source, evidence: clean(text).slice(0, 240) }; }
function unique(values: string[]) { return Array.from(new Set(values.map(clean).filter(Boolean))); }

function cleanNameCandidate(value: string) {
  let name = clean(value)
    .replace(/\b(?:email|e-mail|mobile|phone|telephone|tel|contact|address|nationality|date of birth|dob)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const labelled = name.match(/^Name\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,5})$/i)?.[1] || "";
  if (labelled && !NAME_MODULE_PREFIX_RE.test(labelled)) name = labelled;
  name = name.replace(NAME_SUFFIX_RE, "").replace(/[,:;|]+$/g, "").trim();
  return name;
}

function nameRejectReason(value: string) {
  const original = clean(value);
  const name = cleanNameCandidate(value);
  const words = name.split(/\s+/).filter(Boolean);
  if (!name) return "empty_name";
  if (BAD_NAME_RE.test(name) || isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name)) return `placeholder_or_section_name:${name}`;
  if (NAME_MODULE_PREFIX_RE.test(original) || NAME_MODULE_PREFIX_RE.test(name)) return `module_prefix_name:${name}`;
  if (/\b(?:erp|pm|fico|sapsd|sapmm|sapfico|consultant|manager|lead|analyst)\b/i.test(name)) return `role_or_module_name_token:${name}`;
  if (TITLE_WORD_RE.test(name)) return `title_word_in_name:${name}`;
  if (words.length < 2 || words.length > 6) return `name_word_count:${name}`;
  if (name.length > 70) return `name_too_long:${name}`;
  if (/[,:;]|\b(responsible|experience|project|module|certified|consultant|position)\b/i.test(name)) return `resume_text_name:${name}`;
  if (/\b(?:sdn|bhd|ltd|inc|corp|corporation|technologies|solutions|consulting|services|group)\b/i.test(name)) return `company_like_name:${name}`;
  return "";
}

function isBadName(value: string) {
  return Boolean(nameRejectReason(value));
}

function extractName(candidate: AnyRecord, raw: string) {
  const structuredRaw = clean(candidate.full_name || candidate.candidate_name || candidate.source_name || candidate.display_name || candidate.name);
  const structured = cleanNameCandidate(structuredRaw);
  if (!nameRejectReason(structuredRaw)) return confidence(structured, structured !== structuredRaw ? 90 : 88, structured !== structuredRaw ? "structured_identity_cleaned" : "structured_identity", structuredRaw || structured);
  const lines = raw.split(/\r?\n| {3,}/).map(clean).filter(Boolean).slice(0, 20);
  const labelledRaw = raw.match(/\b(?:Full\s*Name|Candidate\s*Name|Name)\s*[:\-]\s*([^\r\n]{3,100})/i)?.[1] || "";
  const labelled = cleanNameCandidate(labelledRaw);
  if (labelled && !nameRejectReason(labelledRaw)) return confidence(labelled, labelled !== labelledRaw ? 95 : 94, labelled !== labelledRaw ? "parsed_identity_section_cleaned" : "parsed_identity_section", labelledRaw || labelled);
  for (const line of lines) {
    const headerRaw = line.replace(/^(curriculum vitae|resume|cv)\s*(of)?\s*/i, "");
    const candidateName = cleanNameCandidate(headerRaw);
    if (!nameRejectReason(headerRaw)) return confidence(candidateName, candidateName !== headerRaw ? 93 : 92, candidateName !== headerRaw ? "resume_header_cleaned" : "resume_header", line);
  }
  return confidence("", 0, "none", "no safe name evidence");
}
function extractEmail(candidate: AnyRecord, raw: string) {
  const current = clean(candidate.email || candidate.contact_email);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current)) return confidence(current.toLowerCase(), 100, "structured_email", current);
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  return confidence(match.toLowerCase(), match ? 92 : 0, match ? "resume_contact" : "none", match || "no email found");
}

function extractPhone(candidate: AnyRecord, raw: string) {
  const current = clean(candidate.phone || candidate.mobile || candidate.contact_phone);
  if (current.replace(/\D/g, "").length >= 8) return confidence(current, 100, "structured_phone", current);
  for (const match of raw.matchAll(/\b(?:mobile|phone|tel|telephone|contact)\s*(?:no\.?|number)?\s*[:\-]?\s*(\+?\d[\d() .-]{7,}\d)\b/ig)) {
    const evidenceText = match[0];
    const value = match[1] || "";
    const digits = value.replace(/\D/g, "");
    const looksLikeDateRange = /\b(?:19|20)\d{2}\s*(?:-|\u2013|\u2014|to)\s*(?:19|20)\d{2}\b/i.test(evidenceText);
    const looksLikeCompactDate = /^(?:19|20)\d{6}$/.test(digits) || /^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(digits);
    if (digits.length >= 8 && digits.length <= 15 && !looksLikeDateRange && !looksLikeCompactDate) {
      return confidence(clean(value), 84, "resume_contact", evidenceText);
    }
  }
  return confidence("", 0, "none", "no phone found");
}
function extractLocation(candidate: AnyRecord, raw: string) {
  const countryCurrent = clean(candidate.country || candidate.current_country || candidate.location_country);
  const cityCurrent = clean(candidate.city || candidate.current_city);
  const countries: Array<[string, RegExp]> = [["Malaysia", /\bMalaysia|Kuala Lumpur|Selangor|Petaling Jaya|Cyberjaya|Penang\b/i], ["Singapore", /\bSingapore\b/i], ["India", /\bIndia|Bangalore|Bengaluru|Hyderabad|Chennai|Mumbai|Pune|Delhi\b/i], ["Philippines", /\bPhilippines|Manila|Taguig|Makati\b/i], ["Thailand", /\bThailand|Bangkok\b/i], ["Vietnam", /\bVietnam|Ho Chi Minh|Hanoi\b/i], ["Indonesia", /\bIndonesia|Jakarta\b/i]];
  const cities: Array<[string, RegExp]> = [["Kuala Lumpur", /\bKuala Lumpur\b/i], ["Singapore", /\bSingapore\b/i], ["Bangalore", /\bBangalore|Bengaluru\b/i], ["Hyderabad", /\bHyderabad\b/i], ["Manila", /\bManila\b/i], ["Bangkok", /\bBangkok\b/i]];
  const city = cityCurrent || cities.find(([, rx]) => rx.test(raw))?.[0] || "";
  const country = countryCurrent || countries.find(([, rx]) => rx.test(raw))?.[0] || "";
  return { city: confidence(city, city ? 78 : 0, cityCurrent ? "structured_location" : "resume_location", city || "no city found"), country: confidence(country, country ? 82 : 0, countryCurrent ? "structured_location" : "resume_location", country || "no country found") };
}

function normalizeMonth(month: string) { return month ? month.slice(0, 3).replace(/^Sep/i, "Sep") : "Jan"; }
function monthYear(month: string, year: string) { return clean(`${normalizeMonth(month)} ${year}`); }
function monthsBetween(start: string, end: string) { const s = new Date(start.replace(/^([A-Za-z]{3}) /, "$1 1, ")); const e = /present/i.test(end) ? new Date() : new Date(end.replace(/^([A-Za-z]{3}) /, "$1 1, ")); if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0; return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth()); }
function durationLabel(start: string, end: string) { const months = monthsBetween(start, end); if (!months) return ""; const years = Math.floor(months / 12); const rem = months % 12; return [years ? `${years} yr${years > 1 ? "s" : ""}` : "", rem ? `${rem} mo${rem > 1 ? "s" : ""}` : ""].filter(Boolean).join(" "); }
function normalizeComparable(value: string) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

const EMPLOYER_TRIM_RE = /\b(?:Duration|Role|Position|Title|Project|Responsibilities|Environment|Industry)\b\s*(?:::|[:\-])?.*$/i;
const EMPLOYER_FROM_RE = /\bfrom\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}|(?:19|20)\d{2}).*$/i;
const TRAILING_CITY_RE = /\s*,?\s+(?:Bangalore|Bengaluru|Hyderabad|Kuala Lumpur|Singapore|Manila|Pune|Chennai|Mumbai|Taguig|Makati|Malaysia|India|Philippines)$/i;
const COMPANY_SUFFIX_RE = /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Ltd\.?|Inc\.?|Corporation|Corp\.?|Consulting|Technologies|Technology|Solutions|Services|Systems|Group|Bank|Deloitte|Accenture|Cognizant|Capgemini|IBM|TCS|Wipro|Infosys|HCL|NTT)\b/i;

function sanitizeEmployerCandidate(value: string) {
  const original = clean(value);
  let employer = original
    .replace(/\s+/g, " ")
    .replace(/^[|,;:\-\s]+/g, "").replace(/[|,;:\-]+$/g, "")
    .trim();
  if (!employer) return { original, sanitized: "", changed: false };
  employer = employer.replace(EMPLOYER_TRIM_RE, "").trim();
  employer = employer.replace(EMPLOYER_FROM_RE, "").trim();
  employer = employer.replace(/\s+from\s*$/i, "").trim();
  employer = employer.replace(/^Year\s+in\s+SAP\s+/i, "").trim();
  employer = employer.replace(/\s+(?:Bangalore|Bengaluru|Hyderabad|Kuala Lumpur|Singapore|Manila|Pune|Chennai|Mumbai)\s+from\b.*$/i, "").trim();
  employer = employer.replace(/,\s*(?:Bangalore|Bengaluru|Hyderabad|Kuala Lumpur|Singapore|Manila|Pune|Chennai|Mumbai|Malaysia|India|Philippines)$/i, "").trim();
  if (!COMPANY_SUFFIX_RE.test(employer)) employer = employer.replace(TRAILING_CITY_RE, "").trim();
  employer = employer.replace(/[.,|;:\-]+$/g, "").trim();
  return { original, sanitized: employer, changed: employer !== original };
}
function companyRejectReason(value: string, context = "") {
  const sanitized = sanitizeEmployerCandidate(value);
  const company = sanitized.sanitized;
  const words = company.split(/\s+/).filter(Boolean);
  const commaCount = (company.match(/,/g) || []).length;
  if (!company) return "empty_company";
  if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*(?:-|to)\s*(?:present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{0,4}$/i.test(company)) return `date_fragment:${company}`;
  if (/^(?:Jan|Feb|Mar|Apr|April|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2}$/i.test(company) || /^(?:19|20)\d{2}$/.test(company) || /^(?:19|20)\d{2}\s*(?:-|to)\s*(?:19|20)\d{2}$/i.test(company)) return `date_fragment:${company}`;
  if (/^[a-z],\s*\w+/i.test(company)) return `truncated_sentence_fragment:${company}`;
  if (/\bORGANISATION\b.*\b(?:pvt|ltd|sdn|bhd|inc|corp|technologies|solutions|consulting)\b/i.test(company)) return `organisation_combined_company:${company}`;
  if (/\b(?:SAP|HANA|FICO|FI\/CO|MM|SD|PP|BW|ABAP|BASIS)\b.*\bsystem solutions\b/i.test(company)) return `sap_system_phrase:${company}`;
  if (/^implemented solutions$/i.test(company) || /^s\s+east\s+zone\b/i.test(company) || /^by\s+|achieving|requirements|analy[sz]ed|designed new solutions|action is growing fast|creating functional designs|client services|client name/i.test(company)) return `resume_fragment:${company}`;
  if (/\b(?:SAP|HANA|FICO|FI\/CO|MM|SD|PP|BW|ABAP|BASIS)\b.*\bsolutions\b/i.test(company)) return `sap_solution_phrase:${company}`;
  if (/^Client\s+/i.test(company)) return `client_project_company:${company}`;
  if (/^(?:skills?|technical skills?|tools?|platforms?|projects?|project experience|certifications?|education|training|professional summary|profile summary|responsibilities|achievements)\b/i.test(context)) return `section_not_employment:${company}`;
  if (/^(?:CO|FI|MM|SD|PP|ABAP|BASIS)\s+solutions$/i.test(company) || COMPANY_MODULE_LIST_RE.test(company) || (/\b(?:SAP|S4|S\/4HANA|HANA|FICO|FI\/?CO|MM|SD|PP|ABAP|BASIS)\b/i.test(company) && !/\b(?:sdn|bhd|ltd|limited|inc|corp|corporate|consulting|technologies|technology|solutions|services|group|systems|bank|tcs|wipro|infosys|accenture|deloitte|cognizant|capgemini|ibm)\b/i.test(company)) || commaCount >= 2) return `module_or_list_fragment:${company}`;
    if (/\b(?:summary|confidential|core expertise|profile)\b|^page\s+\d+\b|^\[[^\]]+\]/i.test(company)) return `resume_header_fragment:${company}`;
  if (/\b(?:SAP\s+)?(?:FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|Solution|Project)?\s*(?:Consultant|Analyst|Manager|Lead|Developer|Architect|Specialist)\b/i.test(company)) return `title_in_company:${company}`;
  if ((/^[A-Z][A-Z.'()\s-]{6,}(?:\s+(?:Bangalore|Malaysia|Singapore|Manila|India))?$/i.test(company) || /^[A-Z][A-Za-z]+,\s+[A-Z][A-Za-z]+/.test(company) || /[^\x00-\x7F]/.test(company)) && !/\b(?:sdn|bhd|ltd|limited|inc|corp|corporate|consulting|technologies|technology|solutions|services|group|systems|bank|oil|gas|co|company|deloitte|accenture|cognizant|capgemini|ibm|sap|tcs|wipro|infosys|hcl|ntt|ey|kpmg|pwc)\b/i.test(company)) return `person_header:${company}`;
  if (BAD_COMPANY_RE.test(company)) return `resume_fragment:${company}`;
  if (/\b(?:implementation|migration|rollout|support|process|project|module|skill|tool|responsible|configured|developed|performed)\b/i.test(company)) return `project_or_skill_phrase:${company}`;
  if (/\b(?:as an(?:\s+SAP)?|from\s*$|with\s*$|for\s*$)\b/i.test(company)) return `sentence_fragment:${company}`;
  if (company.length > 70 || words.length > 7) return `too_long:${company}`;
  if (words.length === 1 && !/^(?:IBM|SAP|Deloitte|Accenture|Cognizant|Capgemini|EY|KPMG|PwC|TCS|Wipro|Infosys|HCL|NTT)$/i.test(company)) return `single_generic_token:${company}`;
  const safe = safeTalentSearchCompany(company);
  if (!safe || safe === "Not disclosed") return `unsafe_company:${company}`;
  return "";
}

function companySafe(value: string, context = "") {
  const sanitized = sanitizeEmployerCandidate(value);
  return companyRejectReason(sanitized.sanitized, context) ? "" : sanitized.sanitized;
}

function moduleSpecificTitleFromContext(title: string, context: string) {
  const raw = clean(title);
  if (!/^SAP Consultant$/i.test(raw) && !/^Consultant$/i.test(raw)) return raw;
  const module = [
    ["FICO", /\b(?:FICO|FI\/?CO|SAP\s+FI|SAP\s+CO)\b/i],
    ["MM", /\bMM\b/i],
    ["SD", /\bSD\b/i],
    ["ABAP", /\bABAP\b/i],
    ["Basis", /\bBASIS\b/i],
    ["EWM", /\bEWM\b/i],
    ["BTP", /\bBTP\b/i],
  ].find(([, rx]) => (rx as RegExp).test(context))?.[0];
  return module ? `SAP ${module} Consultant` : raw;
}
function titleRejectReason(value: string) {
  const raw = clean(value).replace(/^[|,;:\-\s]+/g, "").replace(/[|,;:\-]+$/g, "").trim();
  if (!raw) return "empty_title";
  if (BAD_TITLE_RE.test(raw)) return `bad_title_phrase:${raw}`;
  if (/^(?:worked as|recently worked|i am)\b/i.test(raw)) return `bad_title_phrase:${raw}`;
  if (/\b(?:19|20)\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(raw)) return `date_fragment_title:${raw}`;
  if (/\b(?:sdn|bhd|ltd|inc|corp|technologies|solutions|consulting|services)\b/i.test(raw)) return `company_fragment_title:${raw}`;
  if (/^(?:SAP Consultant|project manager|solution architect)$/i.test(raw)) return `generic_title:${raw}`;
  if (raw.length > 100 || raw.split(/\s+/).length > 12) return `long_summary_title:${raw}`;
  if (!/\b(?:SAP|FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|HCM|SuccessFactors|Solution|Project)\b/i.test(raw)) return `not_sap_specific_title:${raw}`;
  if (GENERIC_TITLE_RE.test(raw)) return `generic_title:${raw}`;
  return "";
}

function titleSafe(value: string) {
  const raw = clean(value).replace(/^[|,;:\-\s]+/g, "").replace(/[|,;:\-]+$/g, "").trim();
  return titleRejectReason(raw) ? "" : raw;
}
function lineContext(lines: string[], index: number) {
  return [lines[index - 1] || "", lines[index] || "", lines[index + 1] || ""].map(clean).filter(Boolean).join(" | ");
}

function findCompanyCandidates(line: string, context: string) {
  const candidates: Array<{ value: string; source: string }> = [];
  const labelled = context.match(/\b(?:Employer|Organization|Organisation|Company|Client)\s*[:\-]\s*([^|\r\n]{2,80})/i)?.[1];
  if (labelled) candidates.push({ value: labelled, source: "labelled_employer" });
  const titleAtCompany = context.match(/\b(?:SAP\s+)?(?:Senior\s+|Sr\.?\s+|Lead\s+|Principal\s+)?(?:FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|HCM|SuccessFactors|Solution|Project)?\s*(?:Consultant|Analyst|Manager|Lead|Developer|Architect|Specialist)\s+at\s+([^|\r\n]{2,80})/i)?.[1];
  if (titleAtCompany) candidates.push({ value: titleAtCompany, source: "title_at_company" });
  const pipeParts = line.split(/\s+\|\s+/).map(clean).filter(Boolean);
  if (pipeParts.length >= 2) candidates.push({ value: pipeParts[0], source: "company_pipe_title_dates" });
  const dashParts = line.split(/\s+-\s+/).map(clean).filter(Boolean);
  if (dashParts.length >= 3) candidates.push({ value: dashParts[0], source: "company_dash_title_dates" });
  const afterDate = line.replace(DATE_RANGE, "").trim();
  const suffixCompany = afterDate.match(/([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Ltd\.?|Inc\.?|Corporation|Corp\.?|Consulting|Technologies|Technology|Solutions|Services|Systems|Group|Bank)\b)/i)?.[1];
  if (suffixCompany) candidates.push({ value: suffixCompany, source: "legal_suffix_company" });
  const beforeTitle = afterDate.match(/^([A-Z][A-Za-z0-9&.,'()\- ]{2,70}?)(?=\s+(?:SAP|Senior|Sr\.?|Lead|Principal|Functional|Technical|Business|Application|Solution|Consultant|Analyst|Manager|Developer|Architect|Specialist|ABAP|FICO|FI\/?CO|MM|SD)\b)/i)?.[1];
  if (beforeTitle) candidates.push({ value: beforeTitle, source: "date_line_company_before_title" });
  return candidates;
}

function titleCandidates(context: string) {
  const rx = /\b((?:SAP\s+)?(?:Senior\s+|Sr\.?\s+|Lead\s+|Principal\s+)?(?:FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|HCM|SuccessFactors|Solution|Project)?\s*(?:Consultant|Analyst|Manager|Lead|Developer|Architect|Specialist))\b/ig;
  const found = Array.from(context.matchAll(rx)).map((match) => moduleSpecificTitleFromContext(clean(match[1]), context));
  found.sort((a, b) => Number(!/\b(?:SAP|FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|Solution|Project)\b/i.test(a)) - Number(!/\b(?:SAP|FICO|FI\/?CO|MM|SD|PP|QM|PM|PS|EWM|WM|ABAP|BASIS|BTP|Solution|Project)\b/i.test(b)) || b.length - a.length);
  return unique(found);
}

function extractExperience(raw: string) {
  const roles: Array<{ start: string; end: string; current: boolean; company: string; title: string; companySource: string; titleSource: string; evidence: string; rejectedCompanies: string[]; rejectedTitles: string[]; employerSanitizations: Array<{ original: string; sanitized: string }> }> = [];
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    DATE_RANGE.lastIndex = 0;
    const matches = Array.from(line.matchAll(DATE_RANGE));
    if (!matches.length) continue;
    for (const [matchIndex, match] of matches.entries()) {
      const start = monthYear(match[1] || "Jan", match[2]);
      const end = match[3] ? "Present" : monthYear(match[4] || "Jan", match[5]);
      const segmentStart = match.index ?? 0;
      const segmentEnd = matches[matchIndex + 1]?.index ?? line.length;
      const segment = clean(line.slice(segmentStart, segmentEnd));
      const context = [lines[index - 1] || "", segment, lines[index + 1] || ""].map(clean).filter(Boolean).join(" | ");
      const rejectedCompanies: string[] = [];
      const rejectedTitles: string[] = [];
      const employerSanitizations: Array<{ original: string; sanitized: string }> = [];
      let company = "";
      let companySource = "none";
      for (const candidate of findCompanyCandidates(segment, context)) {
        const sanitized = sanitizeEmployerCandidate(candidate.value);
        if (sanitized.changed && sanitized.sanitized) employerSanitizations.push({ original: sanitized.original, sanitized: sanitized.sanitized });
        if (!sanitized.changed && candidate.source === "legal_suffix_company" && clean(candidate.value) !== clean(segment)) employerSanitizations.push({ original: segment, sanitized: clean(candidate.value) });
        const reason = companyRejectReason(sanitized.sanitized || candidate.value, context);
        if (!reason) { company = companySafe(sanitized.sanitized || candidate.value, context); companySource = sanitized.changed ? `${candidate.source}_sanitized` : candidate.source; break; }
        rejectedCompanies.push(reason);
      }
      let title = "";
      let titleSource = "none";
      for (const candidate of titleCandidates(context)) {
        const reason = titleRejectReason(candidate);
        if (!reason) { title = titleSafe(candidate); titleSource = /\bSAP|FICO|FI\/?CO|MM|SD|PP|ABAP|BASIS|Solution|Project\b/i.test(candidate) ? "sap_specific_title" : "experience_title"; break; }
        rejectedTitles.push(reason);
      }
      if (company || title || rejectedCompanies.length || rejectedTitles.length) roles.push({ start, end, current: /present/i.test(end), company, title, companySource, titleSource, evidence: context, rejectedCompanies, rejectedTitles, employerSanitizations });
    }
  }
  roles.sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || monthsBetween("Jan 1900", b.end) - monthsBetween("Jan 1900", a.end));
  return roles;
}
function extractModules(raw: string) { return unique(MODULE_PATTERNS.filter(([, rx]) => rx.test(raw)).map(([module]) => module)); }
function extractSkills(raw: string) { return unique(SKILL_PATTERNS.filter(([, rx]) => rx.test(raw)).map(([skill]) => skill)); }
function extractProjects(raw: string) { return unique(PROJECT_PATTERNS.filter(([, rx]) => rx.test(raw)).map(([project]) => project)); }
function extractYears(candidate: AnyRecord, raw: string) { const current = clean(candidate.years || candidate.years_experience || candidate.sap_years); if (current && Number(current) > 0) return confidence(String(current), 100, "structured_years", current); const match = raw.match(/\b(\d{1,2})\+?\s*(?:years|yrs)\b/i)?.[1] || ""; return confidence(match, match ? 80 : 0, match ? "resume_years_phrase" : "none", match ? `${match} years` : "no years phrase found"); }
function extractSalary(candidate: AnyRecord, raw: string) { const current = clean(candidate.expected_salary || candidate.salary_expectation || candidate.expectedSalary); if (current) return confidence(current, 100, "structured_salary", current); const match = raw.match(/\b(?:expected\s+salary|salary\s+expectation|expected)\s*[:\-]?\s*((?:MYR|RM|USD|SGD|PHP|IDR|THB)?\s*[0-9][0-9,]*(?:\+)?\s*(?:monthly|month|annual|yearly|per month)?)/i)?.[1] || ""; return confidence(clean(match), match ? 76 : 0, match ? "resume_salary_phrase" : "none", match || "no expected salary found"); }
function latestCvMonth(candidate: AnyRecord) { const value = clean(candidate.latestCvUploadedAt || candidate.latest_cv_uploaded_at || candidate.cv_uploaded_at || candidate.updated_at); if (!value) return ""; const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "short", year: "numeric" }); }

function currentSnapshot(candidate: AnyRecord) {
  return {
    displayName: clean(candidate.displayName || candidate.display_name || candidate.name || "Candidate profile pending validation"),
    email: clean(candidate.email), phone: clean(candidate.phone), city: clean(candidate.city || candidate.current_city), country: clean(candidate.country || candidate.current_country || candidate.location),
    currentTitle: clean(candidate.current_title || candidate.title || candidate.headline), currentCompany: safeTalentSearchCompany(candidate.current_company || candidate.company),
    sapModules: clean(candidate.primary_module || "UNKNOWN"), totalYearsExperience: clean(candidate.years || candidate.years_experience), expectedSalary: clean(candidate.expected_salary || candidate.salary_expectation),
  };
}

function distinctPreviousRole(currentRole: any, roles: any[]) {
  if (!currentRole) return { role: undefined, deduplicated: false };
  let deduplicated = false;
  for (const role of roles.slice(1)) {
    const sameCompany = role.company && currentRole.company && normalizeComparable(role.company) === normalizeComparable(currentRole.company);
    const sameRange = role.start === currentRole.start && role.end === currentRole.end;
    if (sameCompany) { deduplicated = true; continue; }
    if (role.company || role.title) return { role, deduplicated };
  }
  return { role: undefined, deduplicated };
}

function employerRolesByRecency(roles: any[]) {
  return roles.filter((role) => role.company).sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || monthsBetween("Jan 1900", b.end) - monthsBetween("Jan 1900", a.end));
}

function previousDistinctEmployer(currentEmployerRole: any, roles: any[]) {
  if (!currentEmployerRole) return { role: undefined, deduplicated: false };
  let deduplicated = false;
  for (const role of employerRolesByRecency(roles)) {
    if (role === currentEmployerRole) continue;
    const sameCompany = normalizeComparable(role.company) === normalizeComparable(currentEmployerRole.company);
    if (sameCompany) { deduplicated = true; continue; }
    return { role, deduplicated };
  }
  return { role: undefined, deduplicated };
}

function candidateStatus(candidate: AnyRecord) {
  return clean(candidate.status || candidate.validation_status || candidate.profile_status || candidate.lifecycle_status).toLowerCase();
}

function hasBlockedStatus(candidate: AnyRecord) {
  const status = candidateStatus(candidate);
  return /deleted|rejected_noise|non_sap|non-sap/.test(status);
}
function isKnownSapModule(modules: string[]) { return modules.some((module) => module && module !== "UNKNOWN"); }
function isValidSearchableTitle(value: string) { return Boolean(titleSafe(value)); }
export function reExtractCandidate(candidate: AnyRecord): CandidateReExtractionSuggestion {
  const raw = candidateRawCvText(candidate);
  const snapshot = currentSnapshot(candidate);
  const name = extractName(candidate, raw);
  const email = extractEmail(candidate, raw);
  const phone = extractPhone(candidate, raw);
  const loc = extractLocation(candidate, raw);
  const roles = extractExperience(raw);
  const currentRole = roles[0];
  const currentEmployerRole = employerRolesByRecency(roles)[0];
  const previous = previousDistinctEmployer(currentEmployerRole, roles);
  const previousRole = previous.role;
  const modules = extractModules(raw || textOf(candidate));
  const skills = extractSkills(raw || textOf(candidate));
  const projects = extractProjects(raw || textOf(candidate));
  const years = extractYears(candidate, raw);
  const salary = extractSalary(candidate, raw);
  const currentTitle = confidence(currentRole?.title || titleSafe(candidate.current_title || candidate.title || ""), currentRole?.title ? 86 : 70, currentRole?.titleSource || (currentRole?.title ? "latest_experience_title" : "structured_title"), currentRole?.evidence || candidate.current_title || "");
  const currentCompany = confidence(currentEmployerRole?.company || companySafe(candidate.current_company || candidate.company || "") || "Not disclosed", currentEmployerRole?.company ? 88 : (companySafe(candidate.current_company || candidate.company || "") ? 78 : 40), currentEmployerRole?.companySource || (currentEmployerRole?.company ? "latest_experience_company" : "structured_company"), currentEmployerRole?.evidence || candidate.current_company || "company unresolved");
  const previousTitle = confidence(previousRole?.title || "", previousRole?.title ? 82 : 0, previousRole?.titleSource || (previousRole?.title ? "previous_experience_title" : "none"), previousRole?.evidence || "no previous title found");
  const previousCompany = confidence(previousRole?.company || "", previousRole?.company ? 84 : 0, previousRole?.companySource || (previousRole?.company ? "previous_experience_company" : "none"), previousRole?.evidence || "no previous company found");
  const suggested = {
    displayName: String(name.value || ""), email: String(email.value || ""), phone: String(phone.value || ""), city: String(loc.city.value || ""), country: String(loc.country.value || ""),
    currentTitle: String(currentTitle.value || ""), currentCompany: String(currentCompany.value || "Not disclosed"), currentEmployerStartDate: currentEmployerRole?.start || "", currentEmployerEndDate: currentEmployerRole?.end || "", currentEmployerDuration: currentEmployerRole ? durationLabel(currentEmployerRole.start, currentEmployerRole.end) : "",
    previousTitle: String(previousTitle.value || ""), previousCompany: String(previousCompany.value || ""), previousEmployerStartDate: previousRole?.start || "", previousEmployerEndDate: previousRole?.end || "", previousEmployerDuration: previousRole ? durationLabel(previousRole.start, previousRole.end) : "",
    totalYearsExperience: String(years.value || ""), expectedSalary: String(salary.value || ""), sapModules: modules, sapSkills: skills, sapProjectTypes: projects, latestCvMonthYear: latestCvMonth(candidate),
  };
  const confidenceMap = { name: name.confidence, contact: Math.max(email.confidence, phone.confidence), location: Math.max(loc.city.confidence, loc.country.confidence), currentCompany: currentCompany.confidence, previousCompany: previousCompany.confidence, title: currentTitle.confidence, modules: modules.length ? 88 : 0, skills: skills.length ? 84 : 0, totalYearsExperience: years.confidence, salary: salary.confidence };
  const evidenceMap = { name: evidence(name.source, name.evidence), email: evidence(email.source, email.evidence), phone: evidence(phone.source, phone.evidence), location: evidence(loc.country.source, loc.country.evidence), currentCompany: evidence(currentCompany.source, currentCompany.evidence), previousCompany: evidence(previousCompany.source, previousCompany.evidence), title: evidence(currentTitle.source, currentTitle.evidence), modules: evidence(modules.length ? "resume_module_tokens" : "none", modules.join(", ") || "no SAP modules found"), skills: evidence(skills.length ? "resume_skill_tokens" : "none", skills.join(", ") || "no SAP skills found"), totalYearsExperience: evidence(years.source, years.evidence), salary: evidence(salary.source, salary.evidence) };
  const employerSanitizations = roles.flatMap((role) => role.employerSanitizations || []);
  const structuredCompanyReason = candidate.current_company || candidate.company ? companyRejectReason(candidate.current_company || candidate.company || "") : "";
  const rejectedCompanies = [...roles.flatMap((role) => role.rejectedCompanies || []), structuredCompanyReason].filter(Boolean);
  const rejectedTitles = [...roles.flatMap((role) => role.rejectedTitles || []), titleRejectReason(candidate.current_title || candidate.title || "")].filter(Boolean);
  const suggestedNameReason = nameRejectReason(suggested.displayName || candidate.name || "");
  const suggestedCompanyReason = suggested.currentCompany !== "Not disclosed" ? companyRejectReason(suggested.currentCompany) : "";
  const suggestedPreviousCompanyReason = suggested.previousCompany ? companyRejectReason(suggested.previousCompany) : "";
  const suggestedTitleReason = titleRejectReason(suggested.currentTitle);
  const rejectedNames = [suggestedNameReason].filter(Boolean);
  const invalidCurrentCompanyFragment = Boolean((candidate.current_company || candidate.company) && !companySafe(candidate.current_company || candidate.company || ""));
  const likelySapProfileRecovered = modules.length > 0 || skills.length > 1 || projects.length > 0;
  const currentSearchable = !classifyCandidateSearchVisibility(candidate).blocked_from_recruiter_search;
  const selectedCompanyInvalid = Boolean(suggestedCompanyReason || suggestedPreviousCompanyReason);
  const selectedTitleInvalid = Boolean(suggestedTitleReason);
  const selectedNameInvalid = Boolean(suggestedNameReason);
  const hardCompanyReject = selectedCompanyInvalid;
  const contactAvailable = Boolean(suggested.email || suggested.phone || candidate.email || candidate.phone);
  const locationAvailable = Boolean(suggested.city || suggested.country || candidate.city || candidate.country || candidate.location);
  const keywordEvidenceAvailable = Boolean(modules.length || skills.length || projects.length);
  const whyBlockedAfterReExtraction = [
    selectedNameInvalid ? "invalid_or_placeholder_name" : "",
    !isKnownSapModule(modules) ? "missing_known_sap_module" : "",
    selectedTitleInvalid || !isValidSearchableTitle(suggested.currentTitle) ? "invalid_title" : "",
    hardCompanyReject ? "invalid_company_fragment" : "",
    !keywordEvidenceAvailable ? "missing_keyword_evidence" : "",
    !(locationAvailable || contactAvailable) ? "missing_location_or_contact" : "",
    hasBlockedStatus(candidate) ? "blocked_status" : "",
  ].filter(Boolean);
  const couldBecomeSearchableAfterReExtraction = Boolean(likelySapProfileRecovered && whyBlockedAfterReExtraction.length === 0);
  const newlyRecoverable = couldBecomeSearchableAfterReExtraction && !currentSearchable;
  const current = currentSnapshot(candidate);
  const recoveredFields = Object.entries({ displayName: suggested.displayName, email: suggested.email, phone: suggested.phone, city: suggested.city, country: suggested.country, currentTitle: suggested.currentTitle, currentCompany: suggested.currentCompany, previousCompany: suggested.previousCompany, sapModules: suggested.sapModules.join(", "), sapSkills: suggested.sapSkills.join(", "), totalYearsExperience: suggested.totalYearsExperience, expectedSalary: suggested.expectedSalary }).filter(([key, value]) => {
    if (!value || value === (current as AnyRecord)[key]) return false;
    if (key === "currentCompany" && suggested.currentCompany === "Not disclosed" && structuredCompanyReason) return false;
    return true;
  }).map(([key]) => key);
  return {
    candidateId: candidateId(candidate), hasRawCvText: Boolean(raw), current, suggested, confidence: confidenceMap, evidence: evidenceMap,
    sources: { nameCleanupSource: String(name.source), currentCompanySource: String(currentCompany.source), previousCompanySource: String(previousCompany.source), titleSource: String(currentTitle.source), moduleSource: modules.length ? "resume_module_tokens" : "none" },
    rejectReasons: { name: rejectedNames, company: [...rejectedCompanies, suggestedCompanyReason, suggestedPreviousCompanyReason].filter(Boolean), title: [...rejectedTitles, suggestedTitleReason].filter(Boolean) },
    auditFlags: { invalidCompanySuggestionsRejected: rejectedCompanies.length, previousCompanyDeduplicated: previous.deduplicated || (roles.length > 1 && !previousRole?.company), genericTitleAvoided: rejectedTitles.some((reason) => reason.includes("generic_title")), invalidCurrentCompanyFragment, employerLinesSanitized: employerSanitizations.length, employerExtractedFromLongLine: employerSanitizations.some((item) => item.original.length > item.sanitized.length), suspiciousNamesCleaned: /cleaned/.test(String(name.source)) ? 1 : 0, suspiciousNamesRejected: rejectedNames.length, suspiciousCompaniesRejected: [...rejectedCompanies, suggestedCompanyReason, suggestedPreviousCompanyReason].filter(Boolean).length, suspiciousTitlesRejected: [...rejectedTitles, suggestedTitleReason].filter(Boolean).length },
    employerSanitizations,
    likelySapProfileRecovered, couldBecomeSearchableAfterReExtraction, currentSearchable, newlyRecoverable, whyBlockedAfterReExtraction, recoveredFields,
  };
}

export type CandidateReExtractionSummary = {
  totalCandidates: number;
  rawCvAvailable: number;
  successfullyReExtracted: number;
  likelySapRecovered: number;
  currentlySearchable: number;
  candidatesThatCouldBecomeSearchableAfterReExtraction: number;
  newlyRecoverableNotCurrentlySearchable: number;
  stillBlockedAfterReExtraction: number;
  potentialSearchableAfterReExtraction: number;
};

export function buildCandidateReExtractionSummary(results: CandidateReExtractionSuggestion[], currentSearchableIds?: Set<string>): CandidateReExtractionSummary {
  const searchableIds = currentSearchableIds ?? new Set(results.filter((item) => item.currentSearchable).map((item) => item.candidateId));
  const newlyRecoverableIds = new Set(results.filter((item) => item.couldBecomeSearchableAfterReExtraction && !searchableIds.has(item.candidateId)).map((item) => item.candidateId));
  const potentialSearchableIds = new Set([...searchableIds, ...newlyRecoverableIds]);
  return {
    totalCandidates: results.length,
    rawCvAvailable: results.filter((item) => item.hasRawCvText).length,
    successfullyReExtracted: results.filter((item) => item.recoveredFields.length > 0).length,
    likelySapRecovered: results.filter((item) => item.likelySapProfileRecovered).length,
    currentlySearchable: searchableIds.size,
    candidatesThatCouldBecomeSearchableAfterReExtraction: results.filter((item) => item.couldBecomeSearchableAfterReExtraction).length,
    newlyRecoverableNotCurrentlySearchable: newlyRecoverableIds.size,
    stillBlockedAfterReExtraction: results.filter((item) => !searchableIds.has(item.candidateId) && !item.couldBecomeSearchableAfterReExtraction).length,
    potentialSearchableAfterReExtraction: potentialSearchableIds.size,
  };
}
export function auditCandidateReExtraction(candidates: AnyRecord[]) {
  const suggestions = candidates.map(reExtractCandidate);
  const summary = buildCandidateReExtractionSummary(suggestions);
  const newlyRecoverableItems = suggestions.filter((item) => item.couldBecomeSearchableAfterReExtraction && !item.currentSearchable);
  const topMissingFieldsRecovered = suggestions.flatMap((item) => item.recoveredFields).reduce<Record<string, number>>((acc, field) => { acc[field] = (acc[field] || 0) + 1; return acc; }, {});
  const rejectedNameExamples = suggestions.flatMap((item) => item.rejectReasons.name.map((reason) => ({ candidateId: item.candidateId, reason, displayName: item.suggested.displayName })));
  const cleanedNameExamples = suggestions.filter((item) => /cleaned/.test(item.sources.nameCleanupSource)).map((item) => ({ candidateId: item.candidateId, displayName: item.suggested.displayName, source: item.sources.nameCleanupSource, evidence: item.evidence.name.text }));
  const rejectedCompanyExamples = suggestions.flatMap((item) => item.rejectReasons.company.map((reason) => ({ candidateId: item.candidateId, reason })));
  const acceptedCompanyExamples = suggestions.filter((item) => item.suggested.currentCompany && item.suggested.currentCompany !== "Not disclosed").map((item) => ({ candidateId: item.candidateId, company: item.suggested.currentCompany, source: item.sources.currentCompanySource }));
  const sanitizedEmployerExamples = suggestions.flatMap((item) => item.employerSanitizations.map((example) => ({ candidateId: item.candidateId, ...example })));
  const recoveredCompanyExamples = suggestions.filter((item) => item.recoveredFields.includes("currentCompany") || item.recoveredFields.includes("previousCompany")).map((item) => ({ candidateId: item.candidateId, currentCompany: item.suggested.currentCompany, previousCompany: item.suggested.previousCompany, source: item.sources.currentCompanySource }));
  const previousCompanyExamples = suggestions.filter((item) => item.suggested.previousCompany).map((item) => ({ candidateId: item.candidateId, previousCompany: item.suggested.previousCompany, source: item.sources.previousCompanySource, evidence: item.evidence.previousCompany.text }));
  const newlyRecoverableExamples = newlyRecoverableItems.map((item) => ({ candidateId: item.candidateId, displayName: item.suggested.displayName, title: item.suggested.currentTitle, company: item.suggested.currentCompany, modules: item.suggested.sapModules.join(", "), currentSearchable: item.currentSearchable, searchableAfter: item.couldBecomeSearchableAfterReExtraction, newlyRecoverable: item.newlyRecoverable, whyBlockedAfterReExtraction: item.whyBlockedAfterReExtraction }));
  const blockedAfterExamples = suggestions.filter((item) => !item.couldBecomeSearchableAfterReExtraction).map((item) => ({ candidateId: item.candidateId, currentSearchable: item.currentSearchable, searchableAfter: item.couldBecomeSearchableAfterReExtraction, newlyRecoverable: item.newlyRecoverable, whyBlockedAfterReExtraction: item.whyBlockedAfterReExtraction }));
  return {
    summary,
    totalCandidatesAudited: summary.totalCandidates,
    candidatesWithRawCvText: summary.rawCvAvailable,
    candidatesSuccessfullyReExtracted: summary.successfullyReExtracted,
    likelySapProfilesRecovered: summary.likelySapRecovered,
    candidatesCouldBecomeSearchableAfterReExtraction: summary.candidatesThatCouldBecomeSearchableAfterReExtraction,
    currentSearchableCount: summary.currentlySearchable,
    newlyRecoverableNotCurrentlySearchableCount: summary.newlyRecoverableNotCurrentlySearchable,
    stillBlockedAfterReExtractionCount: summary.stillBlockedAfterReExtraction,
    potentialSearchableCountAfterReExtraction: summary.potentialSearchableAfterReExtraction,
    suspiciousNamesCleanedCount: suggestions.reduce((sum, item) => sum + item.auditFlags.suspiciousNamesCleaned, 0),
    suspiciousNamesRejectedCount: suggestions.reduce((sum, item) => sum + item.auditFlags.suspiciousNamesRejected, 0),
    suspiciousCompaniesRejectedCount: suggestions.reduce((sum, item) => sum + item.auditFlags.suspiciousCompaniesRejected, 0),
    suspiciousTitlesRejectedCount: suggestions.reduce((sum, item) => sum + item.auditFlags.suspiciousTitlesRejected, 0),
    safeSearchableAfterCount: suggestions.filter((item) => item.couldBecomeSearchableAfterReExtraction && !item.whyBlockedAfterReExtraction.length).length,
    invalidCompanySuggestionsRejected: rejectedCompanyExamples.length,
    employerLinesSanitizedCount: sanitizedEmployerExamples.length,
    employerExtractedFromLongLineCount: suggestions.filter((item) => item.auditFlags.employerExtractedFromLongLine).length,
    acceptedEmployerCount: acceptedCompanyExamples.length,
    rejectedEmployerCount: rejectedCompanyExamples.length,
    currentCompanyRecoveredCount: suggestions.filter((item) => item.recoveredFields.includes("currentCompany")).length,
    previousCompanyRecoveredCount: suggestions.filter((item) => item.recoveredFields.includes("previousCompany")).length,
    previousCompanyDeduplicatedCount: suggestions.filter((item) => item.auditFlags.previousCompanyDeduplicated).length,
    genericTitleAvoidedCount: suggestions.filter((item) => item.auditFlags.genericTitleAvoided).length,
    topCleanedNameExamples: cleanedNameExamples.slice(0, 20),
    topRejectedNameExamples: rejectedNameExamples.slice(0, 20),
    topRejectedCompanyExamples: rejectedCompanyExamples.slice(0, 20),
    topRejectedTitleExamples: suggestions.flatMap((item) => item.rejectReasons.title.map((reason) => ({ candidateId: item.candidateId, reason, title: item.suggested.currentTitle }))).slice(0, 20),
    topAcceptedCompanyExamples: acceptedCompanyExamples.slice(0, 20),
    topSanitizedEmployerExamples: sanitizedEmployerExamples.slice(0, 20),
    topRecoveredCompanyExamples: recoveredCompanyExamples.slice(0, 20),
    topPreviousCompanyExamples: previousCompanyExamples.slice(0, 20),
    topNewlyRecoverableExamples: newlyRecoverableExamples.slice(0, 20),
    topBlockedAfterReExtractionExamples: blockedAfterExamples.slice(0, 20),
    topMissingFieldsRecovered,
    suggestions,
  };
}
