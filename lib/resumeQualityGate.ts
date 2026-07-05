export const RESUME_QUALITY_THRESHOLD = 75;
export const EXECUTIVE_RANKING_QUALITY_THRESHOLD = 75;

type AnyRecord = Record<string, any>;

export type CompanyCategory =
  | "Consulting"
  | "Big4"
  | "SI"
  | "Product"
  | "End User"
  | "Government"
  | "Manufacturing"
  | "Healthcare"
  | "Retail"
  | "Banking"
  | "Energy"
  | "Telecommunication"
  | "Staffing/Freelance"
  | "Unknown";

export type CandidateEvidence = {
  source?: "structured" | "header" | "contact" | "email" | "filename" | "other";
  rawText?: string;
  email?: string;
};

export type ParsedNameResult = {
  name: string;
  source: CandidateEvidence["source"] | "unresolved";
  confidence: number;
  needsManualReview: boolean;
  rejectionReasons: string[];
};

export type ResumeQualityGateResult = {
  parserQualityScore: number;
  allowedForRanking: boolean;
  allowedForExecutiveExport: boolean;
  needsManualReview: boolean;
  rejected: boolean;
  rejectionReasons: string[];
  warnings: string[];
  duplicateKey: string;
  companyCategory: CompanyCategory;
  importStatus: "imported" | "manual_review" | "rejected";
};

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function clean(value: any) {
  return String(value || "").replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").replace(/[,.;:]+$/g, "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function titleCaseName(value: string) {
  return clean(value).split(/\s+/).filter(Boolean).map((part) => {
    if (/^[A-Z]{2,4}$/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(" ");
}

const NAME_METADATA_SUFFIX_RE = /\b(gender|nationality|father'?s name|mother'?s name|original|seniorassociate|businessanalyst|changemanagement|technicallead|subjectmatterexpert|functionalconsultant|embeddedsystemsengineer|consultant|sap|current location|availability|notice period|professional summary|resume|cv)\b.*$/i;
const FORBIDDEN_NAME_RE = /current location|nationality|languages?|technology consulting|academic background|capital market|current position|worked on|industry|summary|projects?|responsibilities|skills?|modules?|headings?|section titles?|company names?|software testing|authorization matrix|customer request|extended star schema|roll out|information technology|quality of outcomes|device management|master data governance|period end closing|preferred working location|installation status|strictly confidential|manufacturing domain|contact education|external stakeholders|identity under review|needs manual name review|profile manual review|profile under review|name requires validation|candidate\s*#|academic qualification|professional summary|career summary|employment history|work experience|education|certifications?|gender|father'?s name|mother'?s name|original|\bams\b|\bsap\b|functional consultant|senior consultant|employment|designation|position title/i;
const ROLE_NAME_RE = /\b(sap|sd|fico|fi|co|mm|abap|basis|functional|technical|consultant|developer|architect|manager|lead|tester|testing|engineer|analyst|specialist|subject matter|business analyst|current position|designation|position title)\b/i;
const LOCATION_RE = /\b(malaysia|petaling jaya|kuala lumpur|selangor|singapore|india|indonesia|philippines|current location|preferred working location)\b/i;
const KNOWN_BAD_EXACT = new Set([
  "snvenkat kurmala",
  "hajar iexora",
  "ams lim soo ying",
  "current location",
  "technology consulting",
  "academic background",
  "capital market",
  "software testing",
  "authorization matrix etc",
  "customer request",
  "extended star schema models",
  "roll out",
  "information technology",
  "quality of outcomes",
  "device management",
  "master data governance",
  "period end closing process",
  "preferred working location",
  "installation status",
  "strictly confidential",
  "manufacturing domain",
  "contact education",
  "external stakeholders",
  "identity under review",
  "needs manual name review",
  "profile under review",
  "review required",
  "gender",
  "nationality",
  "father's name",
  "mother's name",
  "original",
  "ams",
  "sap",
  "functional consultant",
  "senior consultant",
  "current position",
  "employment",
  "designation",
  "position title",
]);

const COMPANY_WORD_RE = /\b(sdn\s*bhd|berhad|ltd|limited|inc|corp|corporation|company|group|services|solutions|technologies|technology|consulting|bank|airports|petronas|telekom|capgemini|wipro|deloitte|accenture|pwc|kpmg|infosys|cognizant|bosch|shell|dksh|abeam)\b/i;

export function cleanCandidateName(rawName: string): ParsedNameResult {
  const rejectionReasons: string[] = [];
  let name = clean(rawName)
    .replace(/\b(?:dr|mr|mrs|ms|miss)\.?\s+/i, "")
    .replace(/\b(?:phd|mba|msc|bsc|degree|economics|accounting|finance)\b.*$/i, "")
    .replace(/\.[a-z0-9]{2,5}$/i, " ")
    .replace(/[_|()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  name = name.replace(NAME_METADATA_SUFFIX_RE, "").replace(/\s+/g, " ").trim();
  const words = name.split(/\s+/).filter(Boolean);
  name = words.filter((word, index) => index === 0 || word.toLowerCase() !== words[index - 1]?.toLowerCase()).join(" ");
  const lower = name.toLowerCase();
  if (!name) rejectionReasons.push("empty name");
  if (KNOWN_BAD_EXACT.has(lower) || FORBIDDEN_NAME_RE.test(name)) rejectionReasons.push("forbidden section/header token");
  if (ROLE_NAME_RE.test(name)) rejectionReasons.push("role title detected");
  if (LOCATION_RE.test(name)) rejectionReasons.push("location detected");
  if (COMPANY_WORD_RE.test(name)) rejectionReasons.push("company-like value detected");
  if (/candidate\s*#|requires review|review required|manual review|under review|not disclosed|unknown|unnamed/i.test(name)) rejectionReasons.push("placeholder detected");
  if (/[0-9@:/\\]/.test(name)) rejectionReasons.push("invalid characters");
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) rejectionReasons.push("invalid word count");
  if (parts.some((part) => part.length > 20 || !/^[A-Za-z][A-Za-z.'-]*$/.test(part))) rejectionReasons.push("non-human token shape");
  return { name: rejectionReasons.length ? "" : titleCaseName(name), source: "other", confidence: rejectionReasons.length ? 0 : 88, needsManualReview: rejectionReasons.length > 0, rejectionReasons };
}

export function isValidHumanName(name: string, evidence: CandidateEvidence = {}) {
  const result = cleanCandidateName(name);
  if (!result.name) return false;
  const parts = result.name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 && evidence.source !== "structured" && evidence.source !== "email") return false;
  if (evidence.source === "other" && ROLE_NAME_RE.test(result.name)) return false;
  return true;
}

export function isTrustedCandidateName(value: any, source: "structured" | "header" | "contact" | "email" | "filename" | "other" = "other") {
  if (source === "filename") {
    const result = cleanCandidateName(String(value || "").replace(/\b(resume|cv|profile|updated|latest|final|copy|sap|consultant|senior|lead|manager)\b/gi, " "));
    return Boolean(result.name && result.rejectionReasons.length === 0);
  }
  return isValidHumanName(clean(value), { source });
}

function splitCompressedName(value: string) {
  return clean(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromRawBlob(rawValue: any) {
  const raw = textOf(rawValue);
  if (!raw) return "";
  const explicitPatterns = [
    /\b(?:full\s*name|candidate\s*name|name)\s*[:\-]?\s*([A-Za-z][A-Za-z.'\- ]{3,90}?)(?=\s+(?:year\s+of\s+birth|gender|current\s+salary|expected\s+salary|availability|email|phone|mobile|assessment|summary|address|skill|nationality|contact|\+?\d)|$)/i,
    /\bPERSONAL\s+DETAIL\s+Name\s*(?:Dr\.?\s+)?([A-Za-z][A-Za-z.'\- ]{3,70}?)(?=\s+(?:PhD|MBA|MSc|Skill|Availability|Nationality|Contact|Email|Phone))/i,
    /\bAbout\s+Me\s+([A-Z][A-Za-z.'\-]+\s+[A-Z][A-Za-z.'\-]+)/i,
    /^\s*([A-Z][A-Za-z.'\-]+\s+[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,3})\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b([A-Z][A-Z.'\-]+\s+[A-Z][A-Z.'\-]+(?:\s+[A-Z][A-Z.'\-]+){0,3})\s+(?:Product\s+Manager|SAP|Senior|Lead|Manager|Consultant|Analyst|Engineer)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /\bprepared\s+by\s*[:\-]\s*[A-Za-z.'\- ]+\s+CANDIDATE\s+INFORMATION\s+Full\s+Name\s*[:\-]\s*([A-Za-z][A-Za-z.'\- ]{3,80}?)(?=\s+(?:Year|Gender|Current|Expected|Availability))/i,
  ];
  for (const pattern of explicitPatterns) {
    const match = raw.match(pattern)?.[1];
    const parsed = cleanCandidateName(splitCompressedName(match || ""));
    if (parsed.name) return parsed.name;
  }
  const compact = raw.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]+){1,4})\s+(?:Having|Manager|Consultant|Phone|Email|Address)\b/)?.[1];
  if (compact) {
    const parsed = cleanCandidateName(splitCompressedName(compact));
    if (parsed.name) return parsed.name;
  }
  return "";
}

function nameFromEmail(email: any) {
  const local = clean(email).split("@")[0]?.replace(/[._+-]+/g, " ") || "";
  const cleaned = local.replace(/\b(sap|fico|consultant|resume|cv|profile|recruiter|hr)\b/gi, " ").replace(/\s+/g, " ").trim();
  return isTrustedCandidateName(cleaned, "email") ? titleCaseName(cleaned) : "";
}

export function resolveTrustedResumeName(candidate: AnyRecord) {
  const structuredSources: Array<[any, "structured" | "header" | "contact" | "email" | "filename"]> = [
    [candidate.linkedinName || candidate.linkedin_name, "structured"],
    [candidate.atsName || candidate.ats_name, "structured"],
    [candidate.fullName || candidate.full_name || candidate.candidateName || candidate.candidate_name || candidate.name, "structured"],
    [candidate.parsedProfile?.fullName || candidate.parsedProfile?.name || candidate.parsedResume?.name || candidate.resume?.name, "structured"],
    [candidate.personalDetails?.name || candidate.personal_details?.name || candidate.contactBlock?.name || candidate.contact_block?.name, "contact"],
  ];
  for (const [value, source] of structuredSources) {
    const parsed = cleanCandidateName(value);
    if (parsed.name && isTrustedCandidateName(parsed.name, source)) return { name: parsed.name, source, confidence: source === "structured" ? 96 : 90 };
  }
  const blobName = nameFromRawBlob([candidate.raw_text, candidate.resume_text, candidate.raw_cv, candidate.rawText, candidate.resumeText, candidate.profileText, candidate.profile_text, candidate.summary]);
  if (blobName) return { name: blobName, source: "contact" as const, confidence: 90 };
  const emailName = nameFromEmail(candidate.email || candidate.candidateEmail || candidate.candidate_email || candidate.contact_email);
  if (emailName) return { name: emailName, source: "email" as const, confidence: 82 };
  const lines = textOf(candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.rawText || candidate.resumeText || candidate.profileText || candidate.profile_text || candidate.summary || "").split(/\r?\n/).map(clean).filter(Boolean).slice(0, 12);
  for (const line of lines) {
    const explicit = line.match(/^(?:name|candidate name|full name)\s*[:\-]\s*(.+)$/i)?.[1];
    const value = explicit || line;
    const parsed = cleanCandidateName(value);
    if (parsed.name && isTrustedCandidateName(parsed.name, explicit ? "contact" : "header")) return { name: parsed.name, source: explicit ? "contact" as const : "header" as const, confidence: explicit ? 90 : 84 };
  }
  const file = clean(candidate.fileName || candidate.filename || candidate.resumeFileName || candidate.resume_file_name || candidate.source_file || candidate.sourceFile || candidate.originalFileName || candidate.documentName)
    .replace(/\.[a-z0-9]{2,5}$/i, " ")
    .replace(/[_()[\]{}-]+/g, " ")
    .replace(/\b(resume|cv|profile|sap|consultant|senior|lead|manager|final|updated|copy)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fileParsed = cleanCandidateName(file);
  if (fileParsed.name && isTrustedCandidateName(fileParsed.name, "filename")) return { name: fileParsed.name, source: "filename" as const, confidence: 72 };
  return { name: "", source: "unresolved" as const, confidence: 0 };
}

function emailOf(candidate: AnyRecord) {
  const value = normalize(candidate.email || candidate.candidateEmail || candidate.candidate_email || candidate.contact_email);
  return value.includes("@") ? value : "";
}

function phoneOf(candidate: AnyRecord) {
  const digits = clean(candidate.phone || candidate.mobile || candidate.contact_phone || candidate.phone_number).replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-10) : "";
}

function linkedinOf(candidate: AnyRecord) {
  const value = normalize(candidate.linkedin || candidate.linkedin_url || candidate.linkedInUrl || candidate.profile_url);
  return value.includes("linkedin") ? value.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
}

const INVALID_COMPANY_RE = /current location|preferred working location|malaysia$|vietnam site|sap sd consultant|sap functional consultant|sap consultant|^software$|technology consulting|academic background|capital market|software testing|current position|worked on|studied|education|academic|qualification|degree|university|college|school|skills?|modules?|responsibilities|summary|projects?|nationality|languages?|not ready|availability|notice period|candidate #|\bage\b/i;
const MODULE_OR_DELIVERY_AS_COMPANY_RE = /^(?:sap\s*)?(?:sd|mm|pp|fico|fi\/?co|fi|co|ewm|wm|abap|basis|hcm|successfactors|s\/?4hana|s4hana)(?:\s+module)?$|^(?:implementation|rollout|roll\s*out|support|ams|greenfield|brownfield|migration)(?:\s+(?:project|module|support))?$/i;

const COMPANY_DICTIONARY: Array<{ pattern: RegExp; category: CompanyCategory }> = [
  { pattern: /deloitte|pwc|pricewaterhousecoopers|kpmg|\bey\b|ernst/i, category: "Big4" },
  { pattern: /accenture|capgemini|ntt data|abeam|\bcbs\b|corporate business solutions|infosys|\btcs\b|tata consultancy|dxc|cgi|hitachi consulting|fujitsu|wipro|hcltech|\bhcl\b|atos|cognizant|tech mahindra|epam|tdi apj|delaware|lti|t-systems|itelligence|snp|avanade|system integrator|consulting|it services/i, category: "SI" },
  { pattern: /sap\s+(se|malaysia)|microsoft|oracle|servicenow|salesforce|workday|opentext|uipath|celonis|blackline|snowflake|databricks|boomi|mulesoft/i, category: "Product" },
  { pattern: /ministry|government|authority|municipal|public sector|state/i, category: "Government" },
  { pattern: /bank|maybank|cimb|dbs|ocbc|uob|hsbc|insurance|aia|prudential/i, category: "Banking" },
  { pattern: /petronas|petronas digital|petronas ict|carigali hess|shell|\bbp\b|basf|energy|oil|gas|petro|evonik/i, category: "Energy" },
  { pattern: /telekom malaysia|telekom|celcom|axiata|telco|telecom|singtel|viettel|pldt/i, category: "Telecommunication" },
  { pattern: /bosch|toyota|honda|panasonic|samsung|manufacturing|factory|industrial|siemens|abb|weir minerals|wilmar/i, category: "Manufacturing" },
  { pattern: /hospital|healthcare|roche|novartis|pfizer|gsk|sanofi/i, category: "Healthcare" },
  { pattern: /retail|7\s*eleven|shopee|lazada|grab|dksh|dksh cssc|unilever|nestl[eé]|\bbat\b|airasia|malaysia airports|maersk|dhl|averis|orisoft|fpt software|\bfpt\b/i, category: "End User" },
  { pattern: /freelance|independent consultant|self employed|contractor/i, category: "Staffing/Freelance" },
];

export function sanitizeCompanyName(value: any) {
  const company = clean(value);
  if (!company || /^(malaysia|singapore|india|indonesia|philippines|current location|unknown|not disclosed|protected|not classified|needs validation)$/i.test(company) || MODULE_OR_DELIVERY_AS_COMPANY_RE.test(company) || INVALID_COMPANY_RE.test(company) || company.length > 90) return "";
  if (/^sap$/i.test(company)) return "";
  if (/\b(consultant|developer|architect|manager|lead|engineer|analyst|functional|technical)\b/i.test(company) && !/(consulting|technologies|technology|services|solutions|sdn|bhd|berhad|group|inc|ltd|plc|llc)/i.test(company)) return "";
  return company;
}

export function classifyCompanyCategory(company: any): CompanyCategory {
  const cleanCompany = sanitizeCompanyName(company);
  if (!cleanCompany) return "Unknown";
  return COMPANY_DICTIONARY.find((entry) => entry.pattern.test(cleanCompany))?.category || "Unknown";
}

function workRecords(candidate: AnyRecord) {
  const sources = [candidate.currentExperience, candidate.current_experience, candidate.latestExperience, candidate.latest_experience, candidate.workExperience, candidate.work_experience, candidate.experience, candidate.experiences, candidate.employmentHistory, candidate.employment_history, candidate.positions, candidate.jobs, candidate.parsedProfile?.experience, candidate.parsedProfile?.workExperience, candidate.parsedResume?.experience, candidate.resume?.experience];
  return sources.flatMap((source) => Array.isArray(source) ? source : source && typeof source === "object" ? [source] : []).filter((item) => item && typeof item === "object") as AnyRecord[];
}

function recordCompany(record: AnyRecord) {
  return sanitizeCompanyName(record.company || record.companyName || record.company_name || record.employer || record.organization || record.organisation || record.client || record.account);
}

function isCurrentRecord(record: AnyRecord) {
  const end = clean(record.endDate || record.end_date || record.to || record.until || record.period).toLowerCase();
  return !end || /present|current|now|ongoing|till date|to date/.test(end);
}

const MONTH_RE = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const DATE_RANGE_RE = String.raw`(?:${MONTH_RE})?\s*\d{4}\s*(?:-|\u2013|\u2014|to)\s*(?:present|current|now|ongoing|till\s+date|to\s+date|(?:${MONTH_RE})?\s*\d{4})`;

function cleanRawCompanyCandidate(value: any) {
  return sanitizeCompanyName(clean(value)
    .replace(/^.*\bEXPERIENCE\s+/i, "")
    .replace(/\b(?:duration|designation|position|role|key\s*role|project|responsibilities|india|malaysia|vietnam|jakarta|bangalore)\b.*$/i, "")
    .replace(/\s{2,}/g, " "));
}

function companyFromRawResumeText(candidate: AnyRecord) {
  const raw = textOf([candidate.raw_text, candidate.resume_text, candidate.raw_cv, candidate.rawText, candidate.resumeText, candidate.profileText, candidate.profile_text, candidate.summary]);
  if (!raw) return "";
  const spaced = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(Organization|Duration|Designation|KeyRole|Company|Position|Project|Working place|WORKING EXPERIENCE|WORK EXPERIENCE|EXPERIENCE)/g, " $1 ")
    .replace(/\s+/g, " ");
  const patterns = [
    new RegExp(String.raw`\bOrganization\s+([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)\s+Duration\s*${DATE_RANGE_RE}`, "i"),
    new RegExp(String.raw`\bCompany\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)\s+(?:Position|Project|Working place|${MONTH_RE}|\d{4})`, "i"),
    new RegExp(String.raw`(?:WORKING EXPERIENCE|WORK EXPERIENCE|EXPERIENCE)\s+${DATE_RANGE_RE}\s+([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)(?=\s+(?:SAP|Senior|Lead|Manager|Consultant|Analyst|Engineer|Developer|Team|Key|Responsibilities|Position|Designation))`, "i"),
    new RegExp(String.raw`\b([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)\s+${DATE_RANGE_RE}\s+(?=SAP|Senior|Lead|Manager|Consultant|Analyst|Engineer|Developer|Team|Software|Key|Responsibilities|Position|Designation)`, "i"),
    new RegExp(String.raw`${DATE_RANGE_RE}\s+([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)(?=\s+(?:SAP|Senior|Lead|Manager|Consultant|Analyst|Engineer|Developer|Team|Key|Responsibilities|Position|Designation))`, "i"),
    /(?:currently\s+working\s+at|working\s+at|present\s+employer|current\s+employer|current\s+company)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)(?=\s+(?:as|in|with|and|for|since|from|$))/i,
  ];
  for (const pattern of patterns) {
    const company = cleanRawCompanyCandidate(spaced.match(pattern)?.[1]);
    if (company) return company;
  }
  const known = spaced.match(KNOWN_COMPANY_RE)?.[1];
  return sanitizeCompanyName(known);
}

const KNOWN_COMPANY_RE = /\b(Capgemini Services|Wipro Technologies|Telekom Malaysia Berhad|Orisoft Technology Sdn Bhd|Petronas Digital|Petronas ICT|Petronas Trading|Petronas|Malaysia Airports|Accenture|Deloitte|PwC|KPMG|EY|IBM Consulting|NTT DATA|TCS|Infosys|HCLTech|DXC|Fujitsu|Hitachi Consulting|Hitachi|ABeam|TDI APJ|BASF|DKSH CSSC|DKSH|Shell|BP|Nestle|Unilever|Toyota|Celcom|Axiata|AirAsia|Weir Minerals|FIS|Averis|FPT Software|FPT|Carigali Hess|7 Eleven|Panasonic|Wilmar|Evonik)\b/i;

export function resolveCurrentCompany(candidate: AnyRecord) {
  const direct = [candidate.currentEmployer, candidate.currentCompany, candidate.current_company, candidate.employer, candidate.company, candidate.latestCompany].map(sanitizeCompanyName).find(Boolean);
  if (direct) return direct;
  const work = workRecords(candidate);
  const current = work.find((item) => isCurrentRecord(item) && recordCompany(item));
  if (current) return recordCompany(current);
  const first = work.find((item) => recordCompany(item));
  if (first) return recordCompany(first);
  const rawCompany = companyFromRawResumeText(candidate);
  if (rawCompany) return rawCompany;
  return "Not disclosed";
}

function companyList(candidate: AnyRecord) {
  const direct = [candidate.currentCompany, candidate.current_company, candidate.currentEmployer, candidate.employer, candidate.company, candidate.latestCompany];
  const fromWork = workRecords(candidate).map(recordCompany);
  return Array.from(new Set([...direct.map(sanitizeCompanyName), ...fromWork].filter(Boolean)));
}

function timelineLooksBroken(candidate: AnyRecord) {
  const text = textOf(candidate.raw_text || candidate.resume_text || candidate.experience || candidate.workExperience || "");
  const ranges = text.match(/\b(?:19|20)\d{2}\b/g) || [];
  return ranges.length === 1 && /experience|employment|worked|present|current/i.test(text);
}

function metricValue(candidate: AnyRecord, keys: string[]) {
  return keys.some((key) => {
    const n = Number(candidate[key]);
    return Number.isFinite(n) && n > 0;
  });
}

function hasDefaultMetricSuspect(candidate: AnyRecord) {
  const metrics = [
    ["implementationProjects", "implementation_projects", "implementation_project_count"],
    ["rolloutProjects", "rollout_projects", "rollout_project_count"],
    ["amsProjects", "ams_projects", "ams_support_project_count"],
    ["s4hanaProjects", "s4hana_projects", "s4hana_project_count", "s4_implementation_count"],
  ];
  const oneCounts = metrics.filter((keys) => keys.some((key) => Number(candidate[key]) === 1)).length;
  if (oneCounts < 3) return false;
  const raw = textOf(candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.rawText || "");
  return !/\b\d+\s*(implementations?|rollouts?|s\/4hana|s4hana|ams|support projects?|full lifecycle|end-to-end)\b/i.test(raw);
}

export function duplicateFingerprint(candidate: AnyRecord) {
  const email = emailOf(candidate);
  if (email) return `email:${email}`;
  const linkedin = linkedinOf(candidate);
  if (linkedin) return `linkedin:${linkedin}`;
  const phone = phoneOf(candidate);
  if (phone) return `phone:${phone}`;
  const trustedName = resolveTrustedResumeName(candidate).name || normalize(candidate.name || candidate.fullName || candidate.candidateName).replace(/\b(original|ams|designation|nationality|gender)\b/g, "").trim();
  const employers = companyList(candidate).slice(0, 5).map(normalize).join(">");
  const skills = textOf(candidate.skills || candidate.sap_modules || candidate.secondary_modules).toLowerCase().split(/[^a-z0-9+#/]+/).filter((item) => item.length > 2).sort().slice(0, 16).join("|");
  return `profile:${normalize(trustedName)}|${employers}|${skills}`.replace(/\s+/g, " ").slice(0, 240);
}

export function evaluateResumeQualityGate(candidate: AnyRecord): ResumeQualityGateResult {
  const warnings: string[] = [];
  const rejectionReasons: string[] = [];
  let score = 100;
  const trustedName = resolveTrustedResumeName(candidate);
  if (!trustedName.name) {
    score -= 45;
    rejectionReasons.push("Name source is not trusted");
  } else if (trustedName.confidence < 88) {
    score -= trustedName.confidence < 80 ? 22 : 12;
    warnings.push("Name confidence below preferred threshold");
  }

  const currentCompany = resolveCurrentCompany(candidate);
  const companyCategory = classifyCompanyCategory(currentCompany);
  const companies = companyList(candidate);
  if (currentCompany === "Not disclosed") {
    score -= companies.length ? 14 : 22;
    warnings.push(companies.length ? "Current employer unresolved despite company history" : "Current employer uncertain");
  } else if (companyCategory === "Unknown") {
    score -= 6;
    warnings.push("Company not found in dictionary");
  }
  if (/^sap$/i.test(currentCompany)) {
    score -= 30;
    rejectionReasons.push("SAP assigned as employer without explicit employer evidence");
  }

  if (timelineLooksBroken(candidate)) {
    score -= 15;
    warnings.push("Timeline requires review");
  }
  if (!emailOf(candidate) && !phoneOf(candidate) && !linkedinOf(candidate)) {
    score -= 10;
    warnings.push("No strong contact identifier for duplicate detection");
  }
  if (hasDefaultMetricSuspect(candidate)) {
    score -= 12;
    warnings.push("Delivery metrics look like default fallback values");
  }
  const raw = textOf(candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.name || "");
  if (/profile under review|snvenkat kurmala|hajar iexora|identity under review|needs manual name review|current location|technology consulting|academic background|capital market|software testing/i.test(raw) && !trustedName.name) {
    score -= 20;
    rejectionReasons.push("Known parser-regression pattern detected");
  }

  const parserQualityScore = Math.max(0, Math.min(100, Math.round(score)));
  const rejected = parserQualityScore < 50 || rejectionReasons.length > 0;
  const needsManualReview = rejected || parserQualityScore < RESUME_QUALITY_THRESHOLD;
  return {
    parserQualityScore,
    allowedForRanking: parserQualityScore >= EXECUTIVE_RANKING_QUALITY_THRESHOLD && !needsManualReview,
    allowedForExecutiveExport: parserQualityScore >= EXECUTIVE_RANKING_QUALITY_THRESHOLD && !needsManualReview,
    needsManualReview,
    rejected,
    rejectionReasons,
    warnings,
    duplicateKey: duplicateFingerprint(candidate),
    companyCategory,
    importStatus: rejected ? "rejected" : needsManualReview ? "manual_review" : "imported",
  };
}

export function summarizeImportResults(results: Array<{ ok?: boolean; rejected?: boolean; candidate?: AnyRecord; parserQuality?: ResumeQualityGateResult }>) {
  const imported = results.filter((item) => item.ok).length;
  const rejected = results.filter((item) => item.rejected || item.parserQuality?.importStatus === "rejected").length;
  const manualReview = results.filter((item) => item.parserQuality?.importStatus === "manual_review" || item.candidate?.name_review_required).length;
  const duplicatesMerged = results.filter((item) => Number(item.candidate?.duplicate_count || 0) > 0).length;
  const parserQuality = results.map((item) => item.parserQuality?.parserQualityScore ?? item.candidate?.parser_quality_score ?? item.candidate?.profile_quality_score).filter((value) => Number.isFinite(Number(value)));
  return { imported, duplicatesMerged, manualReview, rejected, parserQuality };
}



