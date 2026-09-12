export type CandidateFileClassification = {
  recordType: "SAP_CV" | "NON_SAP_CV" | "JD" | "UNKNOWN";
  isSapProfile: boolean;
  shouldSave: boolean;
  reason: string;
  confidence: number;
  signals: string[];
};
import { hasContextualSapModuleEvidence } from "./sapModuleEvidenceContext";

export type NormalizeCandidateInput = Record<string, any>;

const SAP_MODULE_PATTERNS: Array<[string, RegExp]> = [
  ["FICO", /\b(SAP\s+FI\s*\/\s*CO|SAP\s+FICO|FI\s*\/\s*CO|FICO|SAP\s+FI\b|SAP\s+CO\b|FINANCIAL\s+ACCOUNTING|CONTROLLING)\b/i],
  ["SD", /\b(SAP\s+SD|SD\s+CONSULTANT|SALES\s+AND\s+DISTRIBUTION|ORDER\s+TO\s+CASH|\bO2C\b|\bOTC\b)\b/i],
  ["MM", /\b(SAP\s+MM|MM\s+CONSULTANT|MATERIALS?\s+MANAGEMENT|PROCURE\s+TO\s+PAY|\bP2P\b|PURCHASING|PROCUREMENT)\b/i],
  ["ABAP", /\b(SAP\s+ABAP|ABAP\b|RICEF|WRICEF|BAPI|BADI|IDOC|SMARTFORMS?|SAPSCRIPT|TECHNICAL\s+CONSULTANT)\b/i],
  ["BASIS", /\b(SAP\s+BASIS|BASIS\b|NETWEAVER|SOLUTION\s+MANAGER|SOLMAN|SAP\s+ADMIN)\b/i],
  ["SUCCESSFACTORS", /\b(SAP\s+SUCCESSFACTORS|SUCCESS\s*FACTORS|EMPLOYEE\s+CENTRAL|\bEC\b|\bECP\b|\bRCM\b|ONBOARDING|SAP\s+HCM|SAP\s+HR|HXM)\b/i],
  ["BTP", /\b(SAP\s+BTP|BUSINESS\s+TECHNOLOGY\s+PLATFORM|SAP\s+CLOUD\s+PLATFORM|INTEGRATION\s+SUITE|SAP\s+CPI|\bCPI\b|CAP\s+MODEL|SAP\s+UI5|FIORI)\b/i],
  ["BW", /\b(SAP\s+BW|BUSINESS\s+WAREHOUSE|SAP\s+BI\b|BW\/4HANA|BW4HANA|BOBJ|SAC|DATASPHERE)\b/i],
  ["PP", /\b(SAP\s+PP|PRODUCTION\s+PLANNING|\bMRP\b)\b/i],
  ["PM", /\b(SAP\s+PM|PLANT\s+MAINTENANCE|ENTERPRISE\s+ASSET\s+MANAGEMENT|\bEAM\b)\b/i],
  ["QM", /\b(SAP\s+QM|QUALITY\s+MANAGEMENT)\b/i],
  ["EWM", /\b(SAP\s+EWM|EXTENDED\s+WAREHOUSE|WAREHOUSE\s+MANAGEMENT)\b/i],
  ["TM", /\b(SAP\s+TM|TRANSPORTATION\s+MANAGEMENT)\b/i],
  ["ARIBA", /\b(SAP\s+ARIBA|ARIBA\b)\b/i],
  ["CONCUR", /\b(SAP\s+CONCUR|CONCUR\b)\b/i],
  ["MDG", /\b(SAP\s+MDG|MASTER\s+DATA\s+GOVERNANCE|\bMDG\b)\b/i],
  ["GRC", /\b(SAP\s+GRC|GRC\b|AUTHORI[ZS]ATION|SAP\s+SECURITY)\b/i],
  ["SCM", /\b(SAP\s+SCM|SUPPLY\s+CHAIN\s+MANAGEMENT|APO|IBP|PPDS|PP\/DS)\b/i],
];

const JD_STRONG_PATTERNS = [
  /\bJOB\s+DESCRIPTION\b/i,
  /\bKEY\s+RESPONSIBILITIES\b/i,
  /\bJOB\s+REQUIREMENTS\b/i,
  /\bQUALIFICATIONS\s+AND\s+SKILLS\b/i,
  /\bWHAT\s+YOU\s+WILL\s+DO\b/i,
  /\bWE\s+ARE\s+(LOOKING|HIRING)\b/i,
  /\bCANDIDATE\s+MUST\s+HAVE\b/i,
  /\bABOUT\s+THE\s+ROLE\b/i,
  /\bRESPONSIBILITIES\s*[:\-]/i,
  /\bREQUIREMENTS\s*[:\-]/i,
];

const CV_SIGNALS = [
  /\b(EMAIL|E-MAIL|MOBILE|PHONE|CONTACT|LINKEDIN)\b/i,
  /\b(PROFESSIONAL\s+SUMMARY|CAREER\s+SUMMARY|WORK\s+EXPERIENCE|EMPLOYMENT\s+HISTORY|PROJECT\s+EXPERIENCE)\b/i,
  /\b(EDUCATION|CERTIFICATION|CERTIFICATIONS|SKILLS)\b/i,
  /\b(\+?\d{2,}[\d\s().-]{6,})\b/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
];

const NON_SAP_STRONG_PATTERNS = [
  /\b(BIOTECHNOLOGIST|MOLECULAR\s+BIOLOGY|GENOMIC|MICROBIOLOGICAL)\b/i,
  /\b(INSIDE\s+SALES|KEY\s+ACCOUNT\s+MANAGER|SALES\s+REPRESENTATIVE|ACCOUNT\s+EXECUTIVE)\b/i,
  /\b(DEBT\s+COLLECTOR|COLLECTION\s+DEPARTMENT|SECURED\s+LOAN)\b/i,
  /\b(JAVA\s+DEVELOPER|SPRING\s+BOOT|MICROSERVICES|REACT\s+DEVELOPER|NODE\.JS|ANGULAR)\b/i,
  /\b(SOFTWARE\s+TESTING|QA\s+TESTER|ROBOT\s+FRAMEWORK|MANUAL\s+TESTER)\b/i,
];

const BAD_NAME_PATTERNS = [
  /\b(REVIEW\s+REQUIRED|PROFILE\s+UNDER\s+REVIEW|UNKNOWN\s+CANDIDATE)\b/i,
  /\b(PERSONAL\s+PARTICULARS?|CAREER\s+OBJECTIVE|PROFESSIONAL\s+SUMMARY|EXECUTIVE\s+SUMMARY)\b/i,
  /\b(HOBBIES|PROCEDURES|TEST\s+SCRIPTS|ROBOT\s+FRAMEWORK|KEY\s+RESPONSIBILITIES)\b/i,
  /\b(JOB\s+TITLE\s+NAME|CANDIDATE\s+NAME|FULL\s+NAME)\b/i,
  /\b(AND\s+NEED\s+FOR\s+RESOURCES|RESPONSIBLE\s+AND\s+ACCOUNTABLE)\b/i,
];

const TITLE_PREFIX_RE = /^(TITLE|POSITION|DESIGNATION|CURRENT\s+POSITION|CURRENT\s+TITLE|ROLE|JOB\s+TITLE)\s*[:\-]\s*/i;

function cleanText(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLines(text: string): string[] {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/\n| {3,}/)
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function titleCaseName(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase())
    .replace(/\b(Bin|Binti|Bt|B)\b/g, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
}

export function isWeakOrGarbageName(value: any): boolean {
  const name = cleanText(value);
  if (!name) return true;
  if (name.length < 3 || name.length > 70) return true;
  if (/@|www\.|http|linkedin/i.test(name)) return true;
  if (/^\d+$/.test(name)) return true;
  if (BAD_NAME_PATTERNS.some((re) => re.test(name))) return true;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 6) return true;
  if (/\b(SAP|ABAP|FICO|BASIS|CONSULTANT|MANAGER|DEVELOPER|TESTING|FRAMEWORK|SKILLS|SUMMARY|PROFILE|RESUME|CV)\b/i.test(name)) {
    return true;
  }
  return false;
}

export function extractCandidateNameStrict(rawText: string, fallbackEmail?: string | null): string | null {
  const text = String(rawText || "");
  const lines = normalizeLines(text).slice(0, 80);

  const explicitPatterns = [
    /\bFULL\s+NAME\s*[:\-]\s*([A-Z][A-Z .'’,-]{3,70})/i,
    /\bNAME\s*[:\-]\s*([A-Z][A-Z .'’,-]{3,70})/i,
    /\bCANDIDATE\s+NAME\s*[:\-]\s*([A-Z][A-Z .'’,-]{3,70})/i,
    /氏\s*名\s*([A-Za-z][A-Za-z .'’,-]{3,70})/i,
  ];

  for (const re of explicitPatterns) {
    const match = text.match(re);
    const candidate = cleanNameCandidate(match?.[1]);
    if (candidate && !isWeakOrGarbageName(candidate)) return titleCaseName(candidate);
  }

  for (const line of lines.slice(0, 30)) {
    const candidate = cleanNameCandidate(line);
    if (!candidate || isWeakOrGarbageName(candidate)) continue;

    const wordCount = candidate.split(/\s+/).length;
    const looksLikeHumanName = /^[A-Za-z][A-Za-z .'’,-]{3,65}$/.test(candidate) && wordCount >= 2 && wordCount <= 5;
    const allCapsName = /^[A-Z][A-Z .'’,-]{4,65}$/.test(candidate) && wordCount >= 2 && wordCount <= 5;

    if (looksLikeHumanName || allCapsName) return titleCaseName(candidate);
  }

  const email = cleanText(fallbackEmail);
  if (email.includes("@")) {
    const local = email.split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (local.split(/\s+/).length >= 2 && !isWeakOrGarbageName(local)) return titleCaseName(local);
  }

  return null;
}

function cleanNameCandidate(value: any): string | null {
  let v = cleanText(value)
    .replace(/^[-–—•|:;\s]+/, "")
    .replace(/^(CURRICULUM\s+VITAE\s+OF|RESUME\s+OF|CV\s+OF)\s+/i, "")
    .replace(/^FULL\s+NAME\s*[:\-]\s*/i, "")
    .replace(/^NAME\s*[:\-]\s*/i, "")
    .replace(/^CANDIDATE\s+NAME\s*[:\-]\s*/i, "")
    .replace(/\s*[,|]\s*(EMAIL|MOBILE|PHONE|TEL|ADDRESS)\b.*$/i, "")
    .replace(/\s+\+?\d[\d\s().-]{6,}.*$/i, "")
    .trim();

  if (/^[A-Z][a-z]+[A-Z][a-z]+/.test(v)) {
    v = v.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  v = v.replace(/\s+/g, " ").trim();
  if (!v) return null;
  return v;
}

export function derivePrimaryModuleStrict(input: {
  title?: any;
  current_title?: any;
  headline?: any;
  primary_module?: any;
  secondary_modules?: any;
  sap_modules?: any;
  skills?: any;
  raw_text?: any;
  resume_text?: any;
  raw_cv?: any;
}): string | null {
  const titleText = [input.title, input.current_title, input.headline].map(cleanText).join("\n");
  const fullText = [
    titleText,
    input.primary_module,
    Array.isArray(input.secondary_modules) ? input.secondary_modules.join(" ") : input.secondary_modules,
    Array.isArray(input.sap_modules) ? input.sap_modules.join(" ") : input.sap_modules,
    Array.isArray(input.skills) ? input.skills.join(" ") : input.skills,
    input.raw_text,
    input.resume_text,
    input.raw_cv,
  ].map(cleanText).join("\n");

  const titleModule = firstModuleMatch(titleText);
  if (titleModule) return titleModule;

  const fullModule = firstModuleMatch(fullText);
  if (fullModule) return fullModule;

  return null;
}

function firstModuleMatch(text: string): string | null {
  for (const [module, re] of SAP_MODULE_PATTERNS) {
    if (["MM", "SD", "FI", "CO", "FICO"].includes(module) && !hasContextualSapModuleEvidence(text, module)) continue;
    if (re.test(text)) return module;
  }
  return null;
}

export function classifyCandidateText(rawText: string, fileName?: string): CandidateFileClassification {
  const text = cleanText(rawText);
  const upper = text.toUpperCase();
  const signals: string[] = [];

  if (!text || text.length < 120) {
    return { recordType: "UNKNOWN", isSapProfile: false, shouldSave: false, reason: "File text is empty or too short.", confidence: 0.95, signals: ["too_short"] };
  }

  const jdHits = JD_STRONG_PATTERNS.filter((re) => re.test(text)).length;
  const cvHits = CV_SIGNALS.filter((re) => re.test(text)).length;
  const moduleHits = SAP_MODULE_PATTERNS.filter(([module, re]) => re.test(text) && (!["MM", "SD", "FI", "CO", "FICO"].includes(module) || hasContextualSapModuleEvidence(text, module))).map(([module]) => module);
  const nonSapHits = NON_SAP_STRONG_PATTERNS.filter((re) => re.test(text)).length;

  if (jdHits >= 2 && cvHits <= 2) {
    return { recordType: "JD", isSapProfile: false, shouldSave: false, reason: "Job description detected. This file was not saved as a candidate.", confidence: 0.96, signals: [`jd_hits:${jdHits}`] };
  }

  if (moduleHits.length) signals.push(`sap_modules:${Array.from(new Set(moduleHits)).join(",")}`);
  if (/\b(SAP|S\/4HANA|S4HANA|ECC|FIORI|ABAP|BASIS)\b/i.test(upper)) signals.push("sap_keyword");
  if (/\b(IMPLEMENTATION|ROLLOUT|SUPPORT|AMS|HYPERCARE|MIGRATION|GREENFIELD|BROWNFIELD)\b/i.test(upper)) signals.push("sap_delivery_keyword");

  const sapScore = moduleHits.length * 2 + (signals.includes("sap_keyword") ? 1 : 0) + (signals.includes("sap_delivery_keyword") ? 1 : 0);

  if (sapScore >= 2) {
    return { recordType: "SAP_CV", isSapProfile: true, shouldSave: true, reason: "SAP candidate profile detected.", confidence: Math.min(0.98, 0.65 + sapScore * 0.08), signals };
  }

  if (nonSapHits > 0 || sapScore < 2) {
    return { recordType: "NON_SAP_CV", isSapProfile: false, shouldSave: false, reason: "Non-SAP candidate profile detected. This file was not saved to SAP Talent Hub.", confidence: nonSapHits > 0 ? 0.93 : 0.78, signals: [`non_sap_hits:${nonSapHits}`, `sap_score:${sapScore}`] };
  }

  return { recordType: "UNKNOWN", isSapProfile: false, shouldSave: false, reason: "Unable to confirm this is a SAP candidate profile.", confidence: 0.7, signals: [`sap_score:${sapScore}`] };
}

export function normalizeCandidatePayloadForSapUpload(candidate: NormalizeCandidateInput, rawText: string): NormalizeCandidateInput {
  const reliableName = extractCandidateNameStrict(rawText, candidate.email || candidate.email_address);
  const derivedModule = derivePrimaryModuleStrict({ ...candidate, raw_text: rawText, resume_text: rawText, raw_cv: rawText });

  const cleanTitle = cleanText(candidate.current_title || candidate.title || candidate.headline)
    .replace(/^Career\s+history\s*/i, "")
    .replace(TITLE_PREFIX_RE, "")
    .slice(0, 180)
    .trim();

  return {
    ...candidate,
    name: reliableName || candidate.name || "Review Required",
    title: cleanTitle || candidate.title || null,
    current_title: cleanTitle || candidate.current_title || candidate.title || null,
    primary_module: derivedModule || candidate.primary_module || null,
    primaryModule: derivedModule || candidate.primaryModule || candidate.primary_module || null,
    raw_text: rawText,
    resume_text: rawText,
    raw_cv: rawText,
    record_type: "SAP_CV",
    is_sap_profile: true,
  };
}
