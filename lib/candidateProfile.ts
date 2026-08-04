import { inferSapProfile, isWeakCandidateNameProduction, fallbackNameFromEmail, cleanPhoneProduction } from "./sapRecruiterRules";
export type ConsultingLevel =
  | "CONSULTANT"
  | "SENIOR_CONSULTANT"
  | "LEAD_CONSULTANT"
  | "MANAGER"
  | "PRINCIPAL";

export type CandidateRoleType =
  | "FICO Functional"
  | "SAP Functional"
  | "Technical"
  | "Manager/PM"
  | "Other";

export type CandidateProfile = {
  name: string;
  email: string | null;
  phone: string | null;
  title: string;
  company: string;
  location: string;

  years: number;
  primaryModule: string;
  secondaryModules: string[];
  roleType: CandidateRoleType;
  consultingLevel: ConsultingLevel;

  implementationProjects: number;
  rolloutProjects: number;
  amsProjects: number;
  s4hanaProjects: number;
  eccProjects: number;

  greenfieldProjects: number;
  brownfieldProjects: number;
  selectiveTransformationProjects: number;
  s4ImplementationProjects: number;
  s4AmsProjects: number;

  visaStatus: string;
  relocationPreference: string;
  relocation: string;
  workAuthorization: string;
  employmentType: string;
  employmentPreference: string;
  availabilityStatus: string;
  availableWithin: string;
  expectedSalary?: number;
  expectedSalaryCurrency?: string;
  salaryCurrency?: string;
  projectExtractionConfidence?: string;
  projectExtractionSource?: string;
  languages: {
    language: string;
    proficiency: number;
    level?: string;
  }[];

  moduleAuthority: number;
  financeDepth: number;
  implementationAuthority: number;
  consultingDNA: number;
  roleFitBase: number;

  nameReviewRequired: boolean;
  contactMissing: boolean;
  profileQualityScore: number;
  extractionWarnings: string[];
};

const BAD_NAMES = [
  "CAREER OBJECTIVE",
  "CAREER OBJECTIVES",
  "CURRENT LOCATION",
  "PROFESSIONAL OBJECTIVE",
  "PROFILE SUMMARY",
  "POSITION LEVEL",
  "KEY COMPETENCIES",
  "INTERNALLY AND EXTERNALLY",
  "FOR ENHANCEMENTS AND CUSTOMIZED TRANSACTION",
  "MARITAL STATUS",
  "SPECIFICATIONS IN JAPANESE",
  "ADVISORY EXPERIENCE",
  "IBM PHILIPPINES",
  "SOFTWARE DEVELOPMENT",
  "CONTACT DETAILS",
  "CONTROLLING PROCESSES",
  "BASKETBALL, WATCHING MOVIES,",
  "ENHANCEMENTS AND REPORTS",
  "PAYMENTS, RETURNS, REFUNDS,",
  "STANDARDS IN THE WORK PLACE",
  "PROBLEM RESOLUTION OR LONG-TERM FIX",
  "CANDIDATE NAME NOT DETECTED",
  "MANILA, PHILIPPINES",
  "CAVITE, PHILIPPINES",
  "SAN PABLO CITY, LAGUNA, PHILIPPINES",
  "ORANI, BATAAN, PHILIPPINES",
  "SHORT NAME",
  "KEY MODULES IMPLEMENTED",
  "ROLL OUT",
  "ROLLOUT",
  "WORK HISTORY",
  "HOW TO CONTACT ME",
  "INDUSTRY CONSULTANCY",
  "JOB TITLE",
  "ACCOUNTS PAYABLE",
  "ORDER TO CASH TESTING",
  "DENTSPLY SIRONA",
  "HOBBIES AND",
  "CURRICULUM VITAE",
  "JOB TARGET",
  "DIGITAL TRANSFORMATION",
  "FOREIGN MONIKER HARVEY",
  "MUHIDIN ADDRESS",
  "TENG SHI LI MOBILE NO",
  "MAGELLAN DATA MIGRATION ORGANISATION BOSTON",
  "ACCENTURE DELIVERY CENTER PHILIPPINES",
  "DENTSPLY SIRONA",
  "HOW TO CONTACT ME",
  "ROLL OUT",
  "ROLLOUT",
  "WORK HISTORY",
  "INDUSTRY CONSULTANCY",
  "JOB TITLE",
  "ACCOUNTS PAYABLE",
  "ORDER TO CASH TESTING",
  "HOBBIES AND",
  "CURRICULUM VITAE",
  "APPLICATION DEVELOPMENT MANAGER",
  "FUNCTIONAL CONSULTANT",
  "CURRENTLY WORKING",
  "POSITION LEAD EXPERT",
  "CERTIFIED FICO CONSULTANT",
  "CERTIFIED SAP FICO ASSOCIATE",
  "SAP CONSULTANT",
  "SENIOR SAP CONSULTANT",
  "SAP FICO CONSULTANT",
  "SAP FICO SENIOR CONSULTANT",
  "NO TITLE",
  "EMPLOYMENT SAP PS SOLUTIONS CONSULTANT",
  "SAP ANALYTICS CLOUD SOLUTION ARCHITECT",
  "MANAGER",
  "ASSOCIATE MANAGER",
  "BANK ACCOUNTING MODULE IN SAP",
  "GREEN CHANNEL TRAVEL SERVICES",
];

const BAD_NAME_CONTAINS = [
  "CAREER OBJECTIVE",
  "CURRENT LOCATION",
  "PROFESSIONAL OBJECTIVE",
  "PROFILE SUMMARY",
  "POSITION LEVEL",
  "KEY COMPETENCIES",
  "INTERNALLY AND EXTERNALLY",
  "FOR ENHANCEMENTS",
  "MARITAL STATUS",
  "CONTACT DETAIL",
  "PROFESSIONAL SUMMARY",
  "TECHNICAL SKILLS",
  "PROJECT EXPERIENCE",
  "WORK EXPERIENCE",
  "EDUCATION",
  "CERTIFICATION",
  "RESPONSIBILITIES",
  "PAYMENTS",
  "RETURNS",
  "REFUNDS",
  "SOFTWARE DEVELOPMENT",
  "SPECIFICATIONS IN JAPANESE",
  "ADVISORY EXPERIENCE",
  "BASKETBALL",
  "WATCHING MOVIES",
  "ROLL OUT",
  "ROLLOUT",
  "WORK HISTORY",
  "HOW TO CONTACT",
  "INDUSTRY CONSULTANCY",
  "JOB TITLE",
  "ACCOUNTS PAYABLE",
  "ORDER TO CASH",
  "HOBBIES",
  "CURRICULUM VITAE",
  "JOB TARGET",
  "DIGITAL TRANSFORMATION",
  "FOREIGN MONIKER",
  "MUHIDIN ADDRESS",
  "MOBILE NO",
  "DATA MIGRATION ORGANISATION",
  "ACCENTURE DELIVERY CENTER",
  "DENTSPLY",
  "CURRENTLY WORKING",
  "POSITION LEAD EXPERT",
  "CERTIFIED SAP",
  "CERTIFIED FICO",
  "NO TITLE",
  "EMPLOYMENT SAP",
  "SAP ANALYTICS CLOUD",
  "SOLUTION ARCHITECT",
  "BANK ACCOUNTING MODULE",
  "ASSOCIATE MANAGER",
  "GREEN CHANNEL TRAVEL",
];

const HARD_NON_FICO = [
  "ABAP",
  "BASIS",
  "BW",
  "BI",
  "EWM",
  "MM",
  "SD",
  "IS-U",
  "ISU",
  "PM",
  "PP",
  "HCM",
  "HR",
  "TM",
  "WM",
  "EAM",
  "SOLUTION MANAGER",
];

const FICO_PRIMARY_SIGNALS = [
  "FICO",
  "FI/CO",
  "FI-CO",
  "SAP FI",
  "SAP CO",
  "SAP FICO",
  "SAP FINANCE",
  "SAP FINANCIAL",
  "FINANCE CONSULTANT",
  "FINANCIAL ACCOUNTING",
  "CONTROLLING",
];

const FINANCE_TERMS = [
  "FICO",
  "FI/CO",
  "SAP FI",
  "SAP CO",
  "FINANCIAL ACCOUNTING",
  "CONTROLLING",
  "GENERAL LEDGER",
  "GL",
  "ACCOUNTS PAYABLE",
  "AP",
  "ACCOUNTS RECEIVABLE",
  "AR",
  "ASSET ACCOUNTING",
  "AA",
  "BANK ACCOUNTING",
  "TAX",
  "WITHHOLDING TAX",
  "PROFIT CENTER",
  "COST CENTER",
  "INTERNAL ORDER",
  "COPA",
  "CO-PA",
  "PCA",
  "TRM",
  "TREASURY",
  "FSCM",
  "FICA",
  "CFIN",
  "CENTRAL FINANCE",
];

const DEEP_FICO_TERMS = [
  "GENERAL LEDGER",
  "ACCOUNTS PAYABLE",
  "ACCOUNTS RECEIVABLE",
  "ASSET ACCOUNTING",
  "CONTROLLING",
  "PROFIT CENTER",
  "COST CENTER",
  "INTERNAL ORDER",
  "COPA",
  "CO-PA",
  "PCA",
  "TRM",
  "TREASURY",
  "FSCM",
  "FICA",
  "BANK ACCOUNTING",
  "WITHHOLDING TAX",
  "CENTRAL FINANCE",
  "CFIN",
];

const FUNCTIONAL_TERMS = [
  "FICO CONSULTANT",
  "FI/CO CONSULTANT",
  "SAP FICO CONSULTANT",
  "SAP FI CONSULTANT",
  "SAP FINANCE CONSULTANT",
  "SAP FINANCIAL CONSULTANT",
  "BUSINESS ANALYST",
  "FUNCTIONAL CONSULTANT",
  "CONFIGURATION",
  "CUSTOMIZING",
  "BLUEPRINT",
  "FIT GAP",
  "FIT-GAP",
  "REQUIREMENT GATHERING",
  "UAT",
  "WORKSHOP",
  "SOLUTION DESIGN",
  "PROCESS DESIGN",
  "AS-IS",
  "TO-BE",
];

const TECH_TITLE_TERMS = [
  "ABAP DEVELOPER",
  "ABAP CONSULTANT",
  "BASIS CONSULTANT",
  "BW CONSULTANT",
  "BI CONSULTANT",
  "TECHNICAL CONSULTANT",
  "SECURITY CONSULTANT",
  "APPLICATION DEVELOPMENT ANALYST",
  "DEVELOPER",
];

const TITLE_STOPWORDS = [
  "RESUME",
  "CURRICULUM VITAE",
  "CONTACT",
  "EMAIL",
  "PHONE",
  "MOBILE",
  "ADDRESS",
  "CAREER OBJECTIVE",
  "CAREER SUMMARY",
  "PROFESSIONAL SUMMARY",
  "WORK EXPERIENCE",
  "PROJECT EXPERIENCE",
  "EDUCATION",
  "CERTIFICATION",
  "TECHNICAL SKILLS",
  "PERSONAL DETAILS",
  "MARITAL STATUS",
];

const TITLE_KEYWORDS = [
  "SAP",
  "FICO",
  "FI/CO",
  "FI CO",
  "FI-CO",
  "FI CONSULTANT",
  "CO CONSULTANT",
  "FINANCE",
  "FINANCIAL",
  "CONTROLLING",
  "BUSINESS ANALYST",
  "FUNCTIONAL CONSULTANT",
  "CONSULTANT",
  "SENIOR CONSULTANT",
  "SR CONSULTANT",
  "LEAD CONSULTANT",
  "MANAGER",
  "PROJECT MANAGER",
  "SOLUTION ARCHITECT",
  "ABAP",
  "BASIS",
  "MM",
  "SD",
];

const CONSULTING_BRANDS = [
  "ACCENTURE",
  "PWC",
  "PRICEWATERHOUSECOOPERS",
  "DELOITTE",
  "EY",
  "ERNST & YOUNG",
  "KPMG",
  "IBM",
  "CAPGEMINI",
  "COGNIZANT",
  "INFOSYS",
  "TCS",
  "WIPRO",
  "HCL",
  "TECH MAHINDRA",
  "NTT DATA",
  "DELAWARE",
  "CBS",
  "CORPORATE BUSINESS SOLUTIONS",
  "DXC",
  "ATOS",
  "FUJITSU",
  "ITELLIGENCE",
  "NEXSAP",
  "APPCENTRIC",
];

function toText(v: any): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(toText).join(" ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function blob(o: any): string {
  return [
    o?.name,
    o?.email,
    o?.phone,
    o?.location,
    o?.current_location,
    o?.country,
    o?.title,
    o?.current_title,
    o?.headline,
    o?.position,
    o?.designation,
    o?.company,
    o?.current_company,
    o?.summary,
    o?.experience,
    o?.primary_module,
    o?.primaryModule,
    o?.secondary_modules,
    o?.secondaryModules,
    o?.sap_modules,
    o?.sap_submodules,
    o?.modules,
    o?.skills,
    o?.raw_text,
    o?.resume_text,
    o?.raw_cv,
    o?.rawText,
  ]
    .map(toText)
    .join(" ")
    .toUpperCase();
}

function rawTextOf(o: any): string {
  return toText(o?.raw_text || o?.resume_text || o?.raw_cv || o?.rawText || "");
}

function topBlob(o: any): string {
  return [
    o?.name,
    o?.title,
    o?.current_title,
    o?.headline,
    o?.position,
    o?.designation,
    o?.summary,
    o?.primary_module,
    o?.raw_text,
    o?.resume_text,
    o?.raw_cv,
    o?.rawText,
  ]
    .map(toText)
    .join("\n")
    .split("\n")
    .slice(0, 90)
    .join(" ")
    .toUpperCase();
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function numberFrom(...values: any[]) {
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function arr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}

    return v
      .split(/[,;|/]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

function countTerms(text: string, terms: string[]) {
  let total = 0;

  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    total += text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length || 0;
  }

  return total;
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

function normalizeModule(v: any): string {
  const t = toText(v).toUpperCase().trim();

  if (!t) return "UNKNOWN";

  // Explicit IS-U only. Do not treat FICA / FI / FICO as IS-U.
  if (
    /\bSAP\s*IS[-\s]?U\b/i.test(t) ||
    /\bIS[-\s]?U\b/i.test(t) ||
    /\bISU\b/i.test(t)
  ) {
    return "IS-U";
  }

  if (
    t.includes("SUCCESSFACTORS") ||
    t.includes("SUCCESS FACTORS") ||
    t.includes("SAP SUCCESSFACTORS") ||
    t.includes("EMPLOYEE CENTRAL") ||
    t.includes("SF EC") ||
    t.includes("SF CONSULTANT") ||
    t.includes("SAP HR") ||
    t.includes("SAP HCM") ||
    t.includes("HIRE TO RETIRE") ||
    t === "HCM" ||
    t === "HR"
  ) {
    return "SUCCESSFACTORS";
  }

  if (
    t.includes("FICO") ||
    t.includes("FI/CO") ||
    t.includes("FI-CO") ||
    t === "FI" ||
    t === "CO" ||
    t.includes("SAP FI") ||
    t.includes("SAP CO") ||
    t.includes("CENTRAL FINANCE") ||
    t.includes("CFIN") ||
    t.includes("FSCM") ||
    t.includes("TRM") ||
    t.includes("FICA")
  ) {
    return "FICO";
  }

  if (t.includes("ABAP")) return "ABAP";
  if (t.includes("BASIS")) return "BASIS";
  if (t.includes("BW") || t.includes("BI")) return "BW";
  if (t.includes("EWM")) return "EWM";
  if (t.includes("MM")) return "MM";
  if (t.includes("SD")) return "SD";
  if (t.includes("SOLUTION MANAGER")) return "SOLUTION MANAGER";
  if (t.includes("PM")) return "PM";
  if (t.includes("PP")) return "PP";
  if (t.includes("HCM") || t.includes("HR")) return "HCM";
  if (t.includes("TM")) return "TM";
  if (t.includes("WM")) return "WM";
  if (t.includes("PS")) return "PS";

  return t;
}

function titleCaseName(v: string) {
  return v
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isBadName(value: string) {
  const name = String(value || "").replace(/\s+/g, " ").trim();

  if (!name) return true;

  if (isWeakProductionName(name)) return true;

  const upper = name.toUpperCase();

  // Never accept section headers, job titles, generic placeholders or parsed CV fragments as names.
  if (
    BAD_NAMES.some((bad) => upper === bad || upper.includes(bad)) ||
    BAD_NAME_CONTAINS.some((bad) => upper.includes(bad)) ||
    TITLE_KEYWORDS.some((kw) => upper === kw || upper.includes(kw)) ||
    TITLE_STOPWORDS.some((kw) => upper === kw || upper.includes(kw))
  ) {
    return true;
  }

  if (/\b(SAP|ERP|FICO|ABAP|BASIS|BW|BI|MM|SD|EWM|TM|CONSULTANT|ANALYST|MANAGER|DEVELOPER|ARCHITECT|IMPLEMENTATION|SUPPORT|PROJECT|EXPERIENCE|CERTIFIED|ASSOCIATE|SENIOR|LEAD|FUNCTIONAL|TECHNICAL|OBJECTIVE|LOCATION|POSITION|LEVEL)\b/i.test(name)) {
    return true;
  }

  if (/[0-9@]/.test(name)) return true;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return true;

  // Reject glued parser artifacts such as Associatemanagingcon / Seniorinsid.
  if (words.some((w) => w.length > 18 && !/[.'â€™-]/.test(w))) return true;

  return false;
}

function splitCompactNameToken(token: string) {
  const raw = String(token || "")
    .replace(/\b(resume|cv|profile|updated|latest|final|new|copy|cover|letter)\b/gi, "")
    .replace(/\d+/g, "")
    .trim();

  const lower = raw.toLowerCase();

  const known: Record<string, string> = {
    "r.m.pangilinan": "ronald pangilinan",
    "rmpangilinan": "ronald pangilinan",
    "ronaldmpangilinan": "ronald pangilinan",
    "ronaldmpangilinanresume": "ronald pangilinan",
    "ronaldpangilinan": "ronald pangilinan",
    "romelpangilinanona": "romel pangilinan",
    "pelobillomichelle": "michelle pelobillo",
    "michellepelobillo": "michelle pelobillo",
    "michellepelobillocv": "michelle pelobillo",
    "hilarioallanpaul": "hilario allan paul",
    "allanpaulhilario": "allan paul hilario",
    "paulhilarioallan": "paul hilario allan",
    "loongya": "loong ya",
    "shilitengs": "shili tengs",
    "saifulnawi": "saiful nawi",
    "mohdazam": "mohd azam",
    "omjoshi": "om joshi",
    "harvindhakshan": "harvin dhakshan",
    "alfredomontilla": "alfredo montilla",
    "alyssakurtny": "alyssa kurtny",
    "bangalandjd": "bangaland jd",
    "doriecb": "dorie cb",
    "noesantara": "noe santara",
  };

  for (const [pattern, replacement] of Object.entries(known)) {
    if (lower === pattern || lower.includes(pattern)) return replacement;
  }

  if (/^[a-z]\.[a-z]\.[a-z][a-z]+$/i.test(lower)) {
    return lower.split(".").join(" ");
  }

  return raw;
}

function cleanupNameToken(value: string) {
  return String(value || "")
    .replace(/\b(resume|cv|profile|updated|latest|final|copy|cover|letter|sap|fico|fi|co|consultant|senior|sr|manager|certified|associate|application|developer|functional|technical|basis|abap|bw|hana|s4hana|s\/4hana)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromEmail(email: string) {
  const rawLocal = String(email || "").split("@")[0] || "";
  const lowerLocal = rawLocal.toLowerCase();

  if (!rawLocal || rawLocal.length < 3) return null;

  const emailTokens = lowerLocal
    .replace(/[._+-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const emailRoleTokens = new Set([
    "sap", "fico", "fi", "co", "abap", "basis", "bw", "bi", "mm", "sd", "ewm", "tm", "pp", "pm", "ps",
    "consultant", "manager", "architect", "developer", "analyst", "lead", "senior", "sr", "jr", "junior",
    "profile", "resume", "cv", "recruiter", "hr"
  ]);
  const meaningfulEmailTokens = emailTokens.filter((token) => !emailRoleTokens.has(token) && token.length >= 2);
  if (emailTokens.some((token) => emailRoleTokens.has(token)) && meaningfulEmailTokens.length < 2) return null;

  if (lowerLocal === "r.m.pangilinan" || lowerLocal === "rmpangilinan") {
    return "Ronald Pangilinan";
  }

  const compactGuess = splitCompactNameToken(rawLocal);
  let local = cleanupNameToken(compactGuess.replace(/[.]+/g, " "));

  if (!local) return null;

  let parts = local
    .split(/\s+/)
    .filter((p) => p.length >= 1 && /^[a-zA-Z'â€™-]+$/.test(p))
    .slice(0, 4);

  if (parts.length >= 3 && parts[0].length === 1 && parts[1].length === 1) {
    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  }

  parts = parts.filter((p) => p.length >= 2);

  if (parts.length < 2) {
    const compact = splitCompactNameToken(rawLocal);
    local = cleanupNameToken(compact.replace(/([a-z])([A-Z])/g, "$1 $2"));
    parts = local
      .split(/\s+/)
      .filter((p) => p.length >= 2 && /^[a-zA-Z'â€™-]+$/.test(p))
      .slice(0, 4);
  }

  if (parts.length < 2) return null;

  const candidate = titleCaseName(parts.join(" "));
  return isBadName(candidate) ? null : candidate;
}

function nameFromFileName(fileName?: string) {
  if (!fileName) return null;

  const base = String(fileName)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_(){}\[\],]+/g, " ")
    .replace(/\b(resume|cv|profile|updated|latest|final|copy|primus|cbs|fico|sap|consultant|senior|junior|lead|manager|format|project|finance|cutover)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = base
    .split(/\s+/)
    .filter((p) => /^[A-Za-z'â€™-]{2,}$/.test(p))
    .slice(0, 4);

  if (parts.length < 2) return null;

  const candidate = titleCaseName(parts.join(" "));
  return isBadName(candidate) ? null : candidate;
}

function deriveName(candidate: any, text: string) {
  const warnings: string[] = [];

  const raw = toText(candidate?.name).trim();
  if (raw && !isBadName(raw)) {
    return { name: titleCaseName(raw), review: false, warnings };
  }

  if (raw) warnings.push(`Name review required: rejected "${raw}"`);

  const fullRawText = toText(candidate?.raw_text || candidate?.resume_text || candidate?.raw_cv || candidate?.rawText || "");
  const fileName = toText(candidate?.fileName || candidate?.source_file || candidate?.sourceFile || "");

  const explicitPatterns = [
    /(?:CANDIDATE\s+NAME|FULL\s+NAME|NAME)\s*[:\-]\s*([A-Z][A-Z'â€™.\-\s]{3,45})/i,
    /(?:CONSULTANT|CANDIDATE)\s*[:\-]\s*([A-Z][A-Za-z'â€™.\-\s]{3,45})/i,
  ];

  for (const pattern of explicitPatterns) {
    const found = (text.match(pattern)?.[1] || fullRawText.match(pattern)?.[1] || "").trim();
    if (found && !isBadName(found)) {
      return { name: titleCaseName(found), review: false, warnings };
    }
  }

  const email =
    toText(candidate?.email) ||
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
    fullRawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
    "";

  const emailName = email ? nameFromEmail(email) : null;
  if (emailName) {
    return { name: emailName, review: false, warnings };
  }

  const fileNameName = nameFromFileName(fileName);
  if (fileNameName) {
    return { name: fileNameName, review: true, warnings: [...warnings, "Name inferred from file name"] };
  }

  const rawLines = fullRawText
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 60);

  for (const line of rawLines) {
    const consultantName = line.match(/(?:consultant|candidate)\s*[:\-]\s*([A-Z][A-Za-z'â€™.\-\s]{3,45})/i)?.[1];
    const cleaned = (consultantName || line)
      .replace(/^(name|candidate name|full name)\s*[:\-]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    const upper = cleaned.toUpperCase();
    const looksLikeTitleOrSection =
      TITLE_KEYWORDS.some((kw) => upper.includes(kw)) ||
      TITLE_STOPWORDS.some((kw) => upper.includes(kw)) ||
      /\b(SAP|FICO|CONSULTANT|ANALYST|MANAGER|DEVELOPER|ARCHITECT|CERTIFIED|CURRENTLY|WORKING|POSITION|EMPLOYMENT|PROJECT|EXPERIENCE|SKILLS|CONTACT|MOBILE|EMAIL|IMPLEMENTATION|TECHNICAL|FUNCTIONAL|PERSONAL|DETAIL|INFORMATION|UNIVERSITY|CLIENT|ADMINISTRATION|CORE|COMPETENCIES)\b/.test(upper);

    if (!looksLikeTitleOrSection && !isBadName(cleaned)) {
      return { name: titleCaseName(cleaned), review: false, warnings };
    }
  }

  // Production rule: never persist "Unknown Candidate" as a confident candidate.
  // If no reliable name exists, save a review-safe label and cap quality in saveCandidate.
  return { name: "Review Required", review: true, warnings: [...warnings, "Name could not be reliably extracted"] };
}

function cleanTitle(line: string) {
  return line
    .replace(/^[-â€“â€”â€¢\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE)\s*[:\-]\s*/i, "")
    .trim();
}

function isLikelyTitle(line: string) {
  const cleaned = normalizeRepeatedTitle(line);
  const upper = cleaned.toUpperCase();

  if (!cleaned || cleaned.length < 4 || cleaned.length > 85) return false;
  if (isSummaryLikeTitle(cleaned)) return false;
  if (TITLE_STOPWORDS.some((x) => upper.includes(x))) return false;
  if (/@|HTTP|WWW|LINKEDIN/.test(upper)) return false;
  if (/^[\d\s()+.-]+$/.test(cleaned)) return false;

  return TITLE_KEYWORDS.some((kw) => upper.includes(kw));
}

function isSummaryLikeTitle(line: string) {
  const upper = cleanTitle(line).toUpperCase();

  if (!upper) return true;

  return (
    upper.length > 85 ||
    /\b(HIGHLY\s+SKILLED|RESULTS[-\s]+DRIVEN|DETAIL[-\s]+ORIENTED|OVER\s+(A\s+)?DECADE|WITH\s+\d+\+?\s+YEARS|YEARS\s+OF\s+EXPERIENCE|EXPERIENCE\s+ACROSS|EXPERIENCE\s+IN|STRONG\s+BACKGROUND|PROVEN\s+TRACK\s+RECORD|RESPONSIBLE\s+FOR|SPECIALIZES\s+IN|EXPERTISE\s+IN)\b/.test(upper)
  );
}

function normalizeDisplayTitle(value: any) {
  let title = String(value || "")
    .replace(/^[-â€“â€”â€¢\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE|JOB TITLE)\s*[:\-]\s*/i, "")
    .trim();

  title = title
    .replace(/\s+at\s+over\s+a\s+decade\s+of\s+experience.*$/i, "")
    .replace(/\s+at\s+\d+\+?\s+years\s+of\s+experience.*$/i, "")
    .replace(/\s+with\s+over\s+a\s+decade\s+of\s+experience.*$/i, "")
    .replace(/\s+with\s+\d+\+?\s+years\s+of\s+experience.*$/i, "")
    .replace(/\s+at\s+(.+?)\s+at\s+\1\s*$/i, " - $1")
    .replace(/\s+at\s+([A-Za-z0-9&.,'â€™() -]{2,60})\s+at\s+\1\s*$/i, " - $1")
    .replace(/\s*-\s*([A-Za-z0-9&.,'â€™() ]{2,60})\s*-\s*\1\s*$/i, " - $1")
    .replace(/\s+/g, " ")
    .trim();

  const duplicateAt = title.match(/^(.+?)\s+at\s+([A-Za-z0-9&.,'â€™() -]{2,60})\s+at\s+\2$/i);
  if (duplicateAt) {
    title = `${duplicateAt[1].trim()} - ${duplicateAt[2].trim()}`;
  }

  if (title.length > 85) {
    title = title.slice(0, 85).replace(/\s+\S*$/, "").trim();
  }

  return title;
}
function normalizeRepeatedTitle(line: string) {
  return normalizeDisplayTitle(line);
}

function deriveTitleFromEmail(candidate: any) {
  const email = toText(candidate?.email).toLowerCase();

  if (!email) return "";

  if (email.includes("fico")) return "SAP FICO Consultant";
  if (email.includes("sap")) return "SAP Consultant";

  return "";
}

function deriveTitle(candidate: any): string {
  const direct = [
    candidate?.current_title,
    candidate?.title,
    candidate?.headline,
    candidate?.position,
    candidate?.designation,
    candidate?.job_title,
    candidate?.currentRole,
    candidate?.current_role,
  ]
    .map(toText)
    .map(normalizeRepeatedTitle)
    .find((x) => isLikelyTitle(x));

  if (direct) return direct;

  const raw = rawTextOf(candidate);
  const lines = raw
    .split(/\r?\n/)
    .map((x) => normalizeRepeatedTitle(x))
    .filter(Boolean)
    .slice(0, 100);

  const explicit = lines.find((line) =>
    /^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE)\s*[:\-]/i.test(line)
  );

  if (explicit && isLikelyTitle(explicit)) return cleanTitle(explicit);

  // Prefer short title lines, not summary sentences.
  const shortTitle = lines.find((line) => {
    const wordCount = line.split(/\s+/).length;
    return wordCount <= 9 && isLikelyTitle(line);
  });

  if (shortTitle) return shortTitle;

  const emailTitle = deriveTitleFromEmail(candidate);
  if (emailTitle) return emailTitle;

  return "";
}

function deriveCompany(candidate: any): string {
  const direct = [
    candidate?.current_company,
    candidate?.company,
    candidate?.employer,
    candidate?.organization,
  ]
    .map(toText)
    .map((x) => x.trim())
    .find(Boolean);

  if (direct) return direct;

  const title = deriveTitle(candidate);
  const match = title.match(/\b(?:at|with|in)\s+(.{2,80})$/i);
  return match?.[1]?.trim() || "";
}

function hasExplicitIsuSignal(text: string) {
  return (
    /\bSAP\s*IS[-\s]?U\b/i.test(text) ||
    /\bIS[-\s]?U\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING|DEVICE|DM|FICA|PRINT|INVOICING|METER|UTILITIES)\b/i.test(text) ||
    /\bSAP\s+ISU\b/i.test(text) ||
    /\bISU\s+(FUNCTIONAL|CONSULTANT|ANALYST|BILLING|DEVICE|DM|FICA|PRINT|INVOICING|METER|UTILITIES)\b/i.test(text)
  );
}

function isWeakProductionName(value: any) {
  const name = String(value || "").trim();

  if (!name) return true;

  const lowered = name.toLowerCase();

  if (/^(unknown candidate|review required|candidate|consultant|manager|profile|resume|cv|no title)$/i.test(name)) {
    return true;
  }

  if (
    /\b(how this resume is organized|currently working|worked as|working as|employment|requirement specification|profile summary|professional summary|personal details|administration information|core competencies|technical skills|application form|cover letter|curriculum vitae|resume is organized)\b/i.test(name)
  ) {
    return true;
  }

  if (
    /\b(consultant\s*:|candidate\s*:|name\s*:|employment\s+sap|primuspartners|primus partners|corporate business solution|insidesales|inside sales|relationship|remote|bwbihana years|bwbih ana years|material management|sapbw|sac specialist|prfoile|profile)\b/i.test(name)
  ) {
    return true;
  }

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 5) return true;
  if (words.length === 1 && name.length < 4) return true;

  return false;
}

function moduleSignalsFromText(rawInput: any) {
  const raw = String(rawInput || "");
  const upper = raw.toUpperCase();

  return {
    FICO: /\b(FICO|FI\/CO|FI CO|SAP FI\b|SAP CO\b|FI-CO|FINANCE|FINANCIAL|FSCM|TRM|FUNDS MANAGEMENT|CONTROLLING|CO-PA|COPA|GENERAL LEDGER|ACCOUNTS PAYABLE|ACCOUNTS RECEIVABLE|ASSET ACCOUNTING|BANK ACCOUNTING|TAX ACCOUNTING|NEW GL|SIMPLE FINANCE)\b/i.test(upper),
    MM: /\b(MM|MATERIAL MANAGEMENT|MATERIALS MANAGEMENT|PROCUREMENT|PURCHASING|INVENTORY MANAGEMENT|INVENTORY|P2P|SOURCE TO PAY|MM\/WM|PURCHASE ORDER|GOODS RECEIPT|INVOICE VERIFICATION)\b/i.test(upper),
    SD: /\b(SD|SALES\s+AND\s+DISTRIBUTION|SALES & DISTRIBUTION|ORDER TO CASH|OTC|O2C|PRICING|BILLING|DELIVERY|SALES ORDER|CUSTOMER MASTER|CREDIT MANAGEMENT)\b/i.test(upper),
    ABAP: /\b(ABAP|BAPI|BADI|IDOC|SMARTFORMS|SMART FORMS|SAPSCRIPT|USER EXIT|ENHANCEMENT|RICEF|OOABAP|OBJECT ORIENTED ABAP|ADOBE FORMS|WEBDYNPRO|WEB DYNPRO|CDS VIEW|AMDP)\b/i.test(upper),
    BASIS: /\b(BASIS|NETWEAVER|TRANSPORT MANAGEMENT|SAP SECURITY|GRC|AUTHORIZATION|AUTHORIZATIONS|SOLUTION MANAGER|SOLMAN|BTP ADMIN|HANA ADMIN|SYSTEM ADMINISTRATION|S\/4HANA CONVERSION TECHNICAL)\b/i.test(upper),
    BW: /\b(BW|BI\b|BOBJ|WEBI|BUSINESS OBJECTS|ANALYTICS|SAC\b|SAP ANALYTICS CLOUD|DATASPHERE|DWC|HANA MODELING|BW\/4HANA|BPC|DATA WAREHOUSE|REPORTING)\b/i.test(upper),
    "IS-U": hasExplicitIsuSignal(raw),
    TM: /\b(TM|TRANSPORTATION MANAGEMENT|FREIGHT|FORWARDING ORDER|TRANSPORTATION COCKPIT|CARRIER SELECTION)\b/i.test(upper),
    EWM: /\b(EWM|EXTENDED WAREHOUSE|WAREHOUSE MANAGEMENT|WAREHOUSE|WMS|PUTAWAY|PICKING|PACKING|OUTBOUND DELIVERY ORDER)\b/i.test(upper),
    PP: /\b(PP|PRODUCTION PLANNING|MRP\b|BOM\b|ROUTING|PRODUCTION ORDER|PLANNED ORDER|SHOP FLOOR)\b/i.test(upper),
    PM: /\b(PM|PLANT MAINTENANCE|EAM|MAINTENANCE ORDER|EQUIPMENT MASTER|FUNCTIONAL LOCATION|NOTIFICATION)\b/i.test(upper),
    PS: /\b(PS|PROJECT SYSTEM|PROJECT SYSTEMS|WBS|NETWORK ACTIVITY|PROJECT BUILDER|CJ20N|RESULTS ANALYSIS)\b/i.test(upper),
    SUCCESSFACTORS: /\b(SAP\s+SUCCESSFACTORS|SUCCESSFACTORS|SUCCESS\s+FACTORS|SF\s+CONSULTANT|SF\s+FUNCTIONAL|HIRE\s+TO\s+RETIRE|H2R|SAP\s+HR|SAP\s+HCM|HCM\s+CONSULTANT|HR\s+CONSULTANT|HXM)\b/i.test(upper),
    EC: /\b(EMPLOYEE\s+CENTRAL|SUCCESSFACTORS\s+EC|SF\s+EC|SAP\s+SF\s+EC|EC\s+CONSULTANT)\b/i.test(upper),
    ECP: /\b(EMPLOYEE\s+CENTRAL\s+PAYROLL|ECP|SF\s+PAYROLL|SUCCESSFACTORS\s+PAYROLL)\b/i.test(upper),
    RCM: /\b(SUCCESSFACTORS\s+RECRUITING|SF\s+RECRUITING|RECRUITING\s+MANAGEMENT|RCM)\b/i.test(upper),
    ONB: /\b(SUCCESSFACTORS\s+ONBOARDING|SF\s+ONBOARDING|ONBOARDING|ONB)\b/i.test(upper),
    LMS: /\b(SUCCESSFACTORS\s+LEARNING|SF\s+LEARNING|LEARNING\s+MANAGEMENT|LMS)\b/i.test(upper),
    PMGM: /\b(PERFORMANCE\s+AND\s+GOALS|PERFORMANCE\s+MANAGEMENT|GOALS\s+MANAGEMENT|PMGM|SUCCESSFACTORS\s+PERFORMANCE)\b/i.test(upper),
    HCM: /\b(SAP\s+HCM|HCM|SAP\s+HR|HR\s+MODULE|PA\s*\/\s*OM|TIME\s+MANAGEMENT|PAYROLL)\b/i.test(upper),
  };
}

function bestSapModuleFromText(rawInput: any, currentModule?: string) {
  const raw = String(rawInput || "");
  const title = raw.split("\n").slice(0, 8).join(" ").toUpperCase();
  const all = raw.toUpperCase();
  const current = String(currentModule || "").toUpperCase();

  // Direct title authority should win over keyword density from FI/CO/AP/AR integration terms.
  if (/\b(SAP\s+BTP|BTP\s+(CONSULTANT|ARCHITECT|DEVELOPER|LEAD|SPECIALIST)|BUSINESS\s+TECHNOLOGY\s+PLATFORM|SAP\s+CPI|CPI\s+(CONSULTANT|DEVELOPER|ARCHITECT)|INTEGRATION\s+SUITE\s+(CONSULTANT|DEVELOPER|ARCHITECT))\b/i.test(title)) {
    return "BTP";
  }

  const scores: Record<string, number> = {
    "IS-U": 0,
    ABAP: 0,
    BASIS: 0,
    BW: 0,
    TM: 0,
    EWM: 0,
    MM: 0,
    SD: 0,
    PP: 0,
    PM: 0,
    PS: 0,
    SUCCESSFACTORS: 0,
    EC: 0,
    ECP: 0,
    RCM: 0,
    ONB: 0,
    LMS: 0,
    PMGM: 0,
    HCM: 0,
    FICO: 0,
  };

  const add = (module: string, points: number) => {
    scores[module] = (scores[module] || 0) + points;
  };

  // Current module is weak prior only, not final truth.
  if (scores[current] !== undefined) add(current, 5);

  // Explicit title/header signals are strongest.
  if (/\b(SAP\s+SUCCESSFACTORS|SUCCESSFACTORS|SUCCESS\s+FACTORS|SF\s+CONSULTANT|SF\s+FUNCTIONAL|SUCCESSFACTORS\s+LEAD|SUCCESSFACTORS\s+SENIOR|HIRE\s+TO\s+RETIRE|H2R|SAP\s+HR|SAP\s+HCM|HCM\s+CONSULTANT|HR\s+CONSULTANT|HXM)\b/i.test(title)) add("SUCCESSFACTORS", 120);
  if (/\b(EMPLOYEE\s+CENTRAL|SUCCESSFACTORS\s+EC|SF\s+EC|SAP\s+SF\s+EC|EC\s+CONSULTANT)\b/i.test(title)) add("EC", 95);
  if (/\b(EMPLOYEE\s+CENTRAL\s+PAYROLL|ECP|SUCCESSFACTORS\s+PAYROLL|SF\s+PAYROLL)\b/i.test(title)) add("ECP", 85);
  if (/\b(SUCCESSFACTORS\s+RECRUITING|SF\s+RECRUITING|RECRUITING\s+MANAGEMENT|RCM)\b/i.test(title)) add("RCM", 80);
  if (/\b(SUCCESSFACTORS\s+ONBOARDING|SF\s+ONBOARDING|ONBOARDING|ONB)\b/i.test(title)) add("ONB", 80);
  if (/\b(SUCCESSFACTORS\s+LEARNING|SF\s+LEARNING|LEARNING\s+MANAGEMENT|LMS)\b/i.test(title)) add("LMS", 80);
  if (/\b(PERFORMANCE\s+AND\s+GOALS|PERFORMANCE\s+MANAGEMENT|GOALS\s+MANAGEMENT|PMGM)\b/i.test(title)) add("PMGM", 80);
  if (/\bSAP\s*IS[-\s]?U\b|\bIS[-\s]?U\s+(FUNCTIONAL|CONSULTANT|ANALYST)\b|\bSAP\s+ISU\b|\bISU\s+(FUNCTIONAL|CONSULTANT|ANALYST)\b/i.test(title)) add("IS-U", 100);
  if (/\bABAP|DEVELOPER|TECHNICAL CONSULTANT|RICEF|BAPI|BADI\b/i.test(title)) add("ABAP", 60);
  if (/\bBASIS|SECURITY|SOLUTION MANAGER|SOLMAN|SYSTEM ADMIN/i.test(title)) add("BASIS", 60);
  if (/\bBW|BI\b|BOBJ|SAC\b|DATASPHERE|ANALYTICS|BW\/4HANA|BPC\b/i.test(title)) add("BW", 55);
  if (/\bTM|TRANSPORTATION MANAGEMENT\b/i.test(title)) add("TM", 55);
  if (/\bEWM|EXTENDED WAREHOUSE|WAREHOUSE MANAGEMENT\b/i.test(title)) add("EWM", 55);
  if (/\bMM|MATERIAL MANAGEMENT|MATERIALS MANAGEMENT|PROCUREMENT|PURCHASING|P2P\b/i.test(title)) add("MM", 55);
  if (/\bSD|SALES\s+AND\s+DISTRIBUTION|SALES & DISTRIBUTION|ORDER TO CASH|OTC|O2C\b/i.test(title)) add("SD", 55);
  if (/\bPP|PRODUCTION PLANNING|MRP\b/i.test(title)) add("PP", 50);
  if (/\bPM|PLANT MAINTENANCE|EAM\b/i.test(title)) add("PM", 50);
  if (/\bPS|PROJECT SYSTEM|PROJECT SYSTEMS|WBS\b/i.test(title)) add("PS", 50);
  if (/\bFICO|FI\/CO|FI CO|SAP FI\b|SAP CO\b|FINANCE|FINANCIAL|FSCM|TRM|CO-PA|COPA\b/i.test(title)) add("FICO", 50);

  const bodySignals = moduleSignalsFromText(all);
  for (const [module, present] of Object.entries(bodySignals)) {
    if (present) {
      const points = ["SUCCESSFACTORS", "EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "HCM"].includes(module)
        ? 36
        : module === "FICO"
          ? 18
          : 24;
      add(module, points);
    }
  }

  // If a CV is clearly SuccessFactors / SAP HR, do not let generic BW/ABAP/FICO keywords win.
  const sfEvidence = (all.match(/\b(SUCCESSFACTORS|SUCCESS\s+FACTORS|EMPLOYEE\s+CENTRAL|SF\s+EC|SAP\s+HR|SAP\s+HCM|HCM\s+CONSULTANT|HIRE\s+TO\s+RETIRE|H2R|ECP|RCM|ONBOARDING|LMS|PMGM)\b/g) || []).length;
  if (sfEvidence >= 2) add("SUCCESSFACTORS", Math.min(70, 25 + sfEvidence * 8));

  // FICO submodules support FICO, but should not beat explicit MM/SD/PS/BW title.
  const ficoDepth =
    (all.match(/\b(GL|AP|AR|AA|COPA|CO-PA|FSCM|TRM|CONTROLLING|GENERAL LEDGER|ACCOUNTS PAYABLE|ACCOUNTS RECEIVABLE|ASSET ACCOUNTING)\b/g) || []).length;
  // FICO submodules are supporting evidence only. Keep this low so integration/platform profiles do not become FICO.
  add("FICO", Math.min(ficoDepth * 2, 12));

  // Priority hierarchy when evidence is close:
  // SuccessFactors / HR > IS-U explicit > ABAP > BASIS > BW > TM > EWM > MM > SD > PP > PM > PS > FICO
  const priority = ["SUCCESSFACTORS", "EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "HCM", "IS-U", "ABAP", "BASIS", "BW", "TM", "EWM", "MM", "SD", "PP", "PM", "PS", "FICO"];

  // If explicit non-FICO title exists, FICO must not override.
  const explicitNonFicoTitle = priority
    .filter((m) => m !== "FICO")
    .some((m) => scores[m] >= 50);

  if (explicitNonFicoTitle && scores.FICO < 80) {
    scores.FICO = Math.min(scores.FICO, 30);
  }

  if (scores.SUCCESSFACTORS >= 80 || scores.EC >= 80 || scores.HCM >= 80) {
    for (const noisy of ["ABAP", "BASIS", "BW", "FICO", "MM", "SD", "PP", "PM", "PS", "TM", "EWM"]) {
      scores[noisy] = Math.min(scores[noisy] || 0, 45);
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  });

  const [winner, score] = sorted[0];
  return score > 0 ? winner : "UNKNOWN";
}

function cleanSecondaryModules(rawModules: any, primaryModule: string, evidenceText: any) {
  const evidence = String(evidenceText || "");
  const modules = new Set<string>();

  const addIfEvidence = (module: string) => {
    if (!module || module === primaryModule || module === "UNKNOWN") return;

    const signals = moduleSignalsFromText(evidence);
    if (signals[module as keyof ReturnType<typeof moduleSignalsFromText>]) modules.add(module);
  };

  if (Array.isArray(rawModules)) {
    for (const m of rawModules) addIfEvidence(String(m || "").toUpperCase());
  } else if (typeof rawModules === "string") {
    for (const m of rawModules.split(/[,\|;/]+/)) addIfEvidence(String(m || "").trim().toUpperCase());
  }

  const sfSignals = moduleSignalsFromText(evidence);
  for (const module of ["SUCCESSFACTORS", "EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "HCM"]) {
    if (module !== primaryModule && sfSignals[module as keyof ReturnType<typeof moduleSignalsFromText>]) modules.add(module);
  }

  // FICO submodules are allowed as secondary details for FICO profiles.
  const upper = evidence.toUpperCase();
  if (primaryModule === "FICO") {
    for (const sub of ["GL", "AP", "AR", "AA", "COPA", "CO-PA", "FSCM", "TRM", "PS"]) {
      if (new RegExp(`\\b${sub.replace("-", "[- ]?")}\\b`, "i").test(upper)) modules.add(sub === "CO-PA" ? "COPA" : sub);
    }
  }

  // Critical: do not add IS-U unless explicit IS-U signal exists.
  if (!hasExplicitIsuSignal(evidence)) {
    modules.delete("IS-U");
    modules.delete("ISU");
  }

  return Array.from(modules).slice(0, 12);
}

function derivePrimaryModule(candidate: any) {
  const raw = [
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.primary_module,
    candidate?.role_type,
    candidate?.sap_modules,
    candidate?.secondary_modules,
    candidate?.skills,
    candidate?.rawText,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
    blob(candidate),
  ]
    .filter(Boolean)
    .join("\n");

  const best = bestSapModuleFromText(raw, candidate?.primary_module);
  return ["EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "HCM"].includes(best) ? "SUCCESSFACTORS" : best;
}

function deriveSecondaryModules(candidate: any, primaryModule?: string) {
  const primary = primaryModule || derivePrimaryModule(candidate);

  const evidence = [
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.sap_modules,
    candidate?.secondary_modules,
    candidate?.skills,
    candidate?.rawText,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
    blob(candidate),
  ]
    .filter(Boolean)
    .join("\n");

  const raw = candidate?.secondary_modules || candidate?.sap_modules || candidate?.skills || [];
  return cleanSecondaryModules(raw, primary, evidence);
}

function isDateRangeLike(value: string) {
  const s = String(value || "").trim();

  return (
    /\b(19|20)\d{2}\s*[-â€“â€”]\s*(19|20)\d{2}\b/.test(s) ||
    /\b(19|20)\d{2}\.\d{1,2}\s*[-â€“â€”]\s*(19|20)\d{2}\.\d{1,2}\b/.test(s) ||
    /\b(19|20)\d{2}\/\d{1,2}\s*[-â€“â€”]\s*(19|20)\d{2}\/\d{1,2}\b/.test(s) ||
    /^\d{4}\.\d{1,2}\s*[-â€“â€”]\s*\d{4}\.\d{1,2}$/.test(s)
  );
}

function isDateLikePhone(value: string) {
  const s = String(value || "").trim();

  if (!s) return true;

  return (
    /^\d{1,2}[./-]\d{1,2}[./-](19|20)\d{2}$/.test(s) ||
    /^(19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}$/.test(s) ||
    /^\d{4}\.\d{1,2}\s*[-â€“â€”]\s*\d{4}\.\d{1,2}$/.test(s) ||
    /^\d{4}\s*[-â€“â€”]\s*\d{4}$/.test(s) ||
    /^\d{4}\.\d{1,2}$/.test(s) ||
    /^\d{1,2}\.\d{4}$/.test(s) ||
    /^\d{6}[-\s]?\d{2}[-\s]?\d{4}$/.test(s) ||
    /^\d{2,6}[-\s]+\d{2}[-\s]+\d{4}$/.test(s)
  );
}

function isSuspiciousPhone(value: string) {
  const s = String(value || "").trim();
  const digits = s.replace(/\D/g, "");

  if (!digits) return true;
  if (isDateRangeLike(s) || isDateLikePhone(s)) return true;

  if (/\b(19|20)\d{2}\b/.test(s) && !s.trim().startsWith("+")) return true;

  // reject obvious IDs / passport / employee numbers
  if (/^0{2,}/.test(digits)) return true;
  if (/^00/.test(s.trim())) return true;
  if (/^\d{9,12}\s+(19|20)\d{2}$/.test(s)) return true;
  if (/^\d{9,12}$/.test(digits) && /^00/.test(digits)) return true;

  // Malaysia IC / national ID style, not phone
  if (/^\d{6}[-\s]?\d{2}[-\s]?\d{4}$/.test(s)) return true;

  // mixed office extension or address-like values
  if (/^\d{4}[-\s]\d{2}[-\s]\d{2}$/.test(s)) return true;
  if (/^\d{4}\s+\d{4}[-\s]\d{3}[-\s]\d{4}$/.test(s)) return true;

  if (digits.length < 8 || digits.length > 16) return true;

  return false;
}

function extractPhone(candidate: any, rawText: string): string | null {
  const direct = toText(candidate?.phone).trim();

  if (direct && !isSuspiciousPhone(direct)) {
    return direct.replace(/\s+/g, " ").trim();
  }

  const text = rawText || rawTextOf(candidate) || blob(candidate);
  const candidates = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];

  for (const item of candidates) {
    const cleaned = item.replace(/\s+/g, " ").trim();

    if (isSuspiciousPhone(cleaned)) continue;

    return cleaned;
  }

  return null;
}

function yearSpanFromText(rawText: string) {
  const text = String(rawText || "");
  const currentYear = new Date().getFullYear();

  const decadeSignal = /\b(over\s+a\s+decade|more\s+than\s+10\s+years|10\+?\s+years)\b/i.test(text)
    ? 10
    : 0;

  const explicit = Array.from(
    text.matchAll(/(\d{1,2}(?:\.\d)?)\+?\s*(?:years|yrs|year)\s+(?:of\s+)?(?:sap|fico|fi\/co|finance|financial|controlling|consulting|implementation|erp|professional)?\s*(?:experience|exp)?/gi)
  )
    .map((m) => Math.floor(Number(m[1])))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 35);

  if (explicit.length || decadeSignal) {
    return Math.max(decadeSignal, ...explicit, 0);
  }

  const sinceMatches = Array.from(
    text.matchAll(/(?:sap|fico|fi\/co|consultant|finance|erp).{0,60}\bsince\s+((?:19|20)\d{2})|\bsince\s+((?:19|20)\d{2}).{0,60}(?:sap|fico|fi\/co|consultant|finance|erp)/gi)
  )
    .map((m) => Number(m[1] || m[2]))
    .filter((y) => y >= 1985 && y <= currentYear);

  if (sinceMatches.length) {
    return Math.min(currentYear - Math.min(...sinceMatches), 35);
  }

  return 0;
}

function deriveYears(candidate: any) {
  const direct = numberFrom(
    candidate?.years,
    candidate?.years_experience,
    candidate?.yearsOfExperience,
    candidate?.calculated_experience_months
      ? Math.floor(Number(candidate.calculated_experience_months) / 12)
      : 0
  );

  const raw = rawTextOf(candidate);
  const rawSpan = yearSpanFromText(raw);

  const implementationSignal = numberFrom(
    candidate?.implementation_projects,
    candidate?.implementation_project_count,
    candidate?.implementationProjectCount,
    candidate?.implementationProjects
  );

  const rolloutSignal = numberFrom(
    candidate?.rollout_projects,
    candidate?.rollout_project_count,
    candidate?.rolloutProjectCount,
    candidate?.rolloutProjects
  );

  const amsSignal = numberFrom(
    candidate?.ams_projects,
    candidate?.ams_project_count,
    candidate?.ams_support_project_count,
    candidate?.amsProjectCount,
    candidate?.amsProjects
  );

  const projectBasedFloor = Math.min(
    18,
    Math.max(
      0,
      implementationSignal >= 10
        ? 12
        : implementationSignal >= 7
        ? 10
        : implementationSignal >= 4
        ? 7
        : 0,
      rolloutSignal >= 5 ? 8 : 0,
      amsSignal >= 10 && implementationSignal >= 3 ? 8 : 0
    )
  );

  if (direct >= 1 && direct <= 35) {
    if (direct <= 4) {
      return Math.min(Math.max(direct, rawSpan, projectBasedFloor), 35);
    }

    const rawUpper = rawTextOf(candidate).toUpperCase();
    const hasTrueExecutiveEvidence =
      /(HEAD|DIRECTOR|PRINCIPAL|PARTNER|VP|VICE PRESIDENT)/.test(rawUpper);

    if (direct > 25 && (implementationSignal < 8 || !hasTrueExecutiveEvidence)) {
      return 20;
    }

    return direct;
  }

  return Math.min(Math.max(rawSpan || 0, projectBasedFloor || 0), 35);
}

function evidenceCount(text: string, exactPatterns: RegExp[], max: number) {
  const values = exactPatterns
    .map((pattern) => Number(text.match(pattern)?.[1] || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(max, Math.max(...values)) : 0;
}

function projectCounts(candidate: any) {
  const text = blob(candidate);

  const storedImplementation = numberFrom(
    candidate?.implementation_projects,
    candidate?.implementation_project_count,
    candidate?.implementationProjectCount,
    candidate?.implementationProjects
  );

  const storedRollout = numberFrom(
    candidate?.rollout_projects,
    candidate?.rollout_project_count,
    candidate?.rolloutProjectCount,
    candidate?.rolloutProjects
  );

  const storedAms = numberFrom(
    candidate?.ams_projects,
    candidate?.ams_project_count,
    candidate?.ams_support_project_count,
    candidate?.amsProjectCount,
    candidate?.amsProjects
  );

  const storedS4 = numberFrom(
    candidate?.s4hana_projects,
    candidate?.s4hana_project_count,
    candidate?.s4hanaProjectCount,
    candidate?.s4hanaProjects
  );

  const storedEcc = numberFrom(
    candidate?.ecc_projects,
    candidate?.ecc_project_count,
    candidate?.eccProjectCount,
    candidate?.eccProjects
  );

  const storedGreenfield = numberFrom(
    candidate?.greenfield_projects,
    candidate?.greenfield_project_count,
    candidate?.greenfieldProjectCount,
    candidate?.greenfieldProjects
  );

  const storedBrownfield = numberFrom(
    candidate?.brownfield_projects,
    candidate?.brownfield_project_count,
    candidate?.brownfieldProjectCount,
    candidate?.brownfieldProjects
  );

  const storedSelective = numberFrom(
    candidate?.selective_transformation_projects,
    candidate?.selective_transformation_project_count,
    candidate?.selectiveTransformationProjectCount,
    candidate?.selectiveTransformationProjects
  );

  const storedS4Implementation = numberFrom(
    candidate?.s4_implementation_projects,
    candidate?.s4hana_implementation_projects,
    candidate?.s4_implementation_project_count,
    candidate?.s4ImplementationProjectCount,
    candidate?.s4ImplementationProjects
  );

  const storedS4Ams = numberFrom(
    candidate?.s4_ams_projects,
    candidate?.s4hana_ams_projects,
    candidate?.s4_ams_project_count,
    candidate?.s4AmsProjectCount,
    candidate?.s4AmsProjects
  );

  const fallbackImplementation = evidenceCount(text, [
    /\b(\d{1,2})\s*(?:end-to-end|e2e|full lifecycle|full-cycle|implementation)\s*(?:projects?|implementations?|cycles?)\b/i,
    /\b(?:implementation|implemented)\s*(?:projects?|count)?\s*[:\-]?\s*(\d{1,2})\b/i,
  ], 25);
  const fallbackRollout = evidenceCount(text, [
    /\b(\d{1,2})\s*(?:global|regional|template|local)?\s*roll[ -]?outs?\b/i,
    /\broll[ -]?outs?\s*[:\-]?\s*(\d{1,2})\b/i,
  ], 15);
  const fallbackAms = evidenceCount(text, [
    /\b(\d{1,2})\s*(?:ams|support|maintenance|hypercare)\s*(?:projects?|engagements?)\b/i,
    /\b(?:ams|support|maintenance)\s*(?:projects?|count)?\s*[:\-]?\s*(\d{1,2})\b/i,
  ], 25);
  const fallbackS4 = evidenceCount(text, [
    /\b(\d{1,2})\s*(?:s\/?4hana|s4hana|s4 hana)\s*(?:projects?|implementations?|programs?)\b/i,
    /\b(?:s\/?4hana|s4hana|s4 hana)\s*(?:projects?|count)?\s*[:\-]?\s*(\d{1,2})\b/i,
  ], 20);
  const fallbackEcc = evidenceCount(text, [/\b(\d{1,2})\s*(?:ecc|r\/3)\s*(?:projects?|implementations?)\b/i], 20);

  const fallbackGreenfield = evidenceCount(text, [/\b(\d{1,2})\s*greenfield\s*(?:projects?|implementations?)\b/i], 15);
  const fallbackBrownfield = evidenceCount(text, [/\b(\d{1,2})\s*(?:brownfield|system conversion)\s*(?:projects?|implementations?)\b/i], 15);
  const fallbackSelective = evidenceCount(text, [/\b(\d{1,2})\s*(?:selective transformation|selective data transition|selective data migration|bluefield)\s*(?:projects?|programs?)\b/i], 15);

  const fallbackS4Implementation = evidenceCount(text, [/\b(\d{1,2})\s*(?:s\/?4hana|s4hana|s4 hana)\s*(?:greenfield|rollout|brownfield|conversion|implementation)\s*(?:projects?|programs?)\b/i], 25);

  const fallbackS4Ams = evidenceCount(text, [/\b(\d{1,2})\s*(?:s\/?4hana|s4hana|s4 hana)\s*(?:ams|support)\s*(?:projects?|engagements?)\b/i], 25);

  const greenfieldProjects = clamp(storedGreenfield || fallbackGreenfield, 0, 15);
  const rolloutProjects = clamp(storedRollout || fallbackRollout, 0, 15);
  const brownfieldProjects = clamp(storedBrownfield || fallbackBrownfield, 0, 15);
  const selectiveTransformationProjects = clamp(storedSelective || fallbackSelective, 0, 15);

  const derivedImplementation =
    greenfieldProjects + rolloutProjects + brownfieldProjects + selectiveTransformationProjects;

  return {
    implementationProjects: clamp(storedImplementation || derivedImplementation || fallbackImplementation, 0, 25),
    rolloutProjects,
    amsProjects: clamp(storedAms || fallbackAms, 0, 25),
    s4hanaProjects: clamp(storedS4 || fallbackS4, 0, 20),
    eccProjects: clamp(storedEcc || fallbackEcc, 0, 20),

    greenfieldProjects,
    brownfieldProjects,
    selectiveTransformationProjects,

    s4ImplementationProjects: clamp(storedS4Implementation || fallbackS4Implementation || storedS4 || fallbackS4, 0, 25),
    s4AmsProjects: clamp(storedS4Ams || fallbackS4Ams, 0, 25),
  };
}

function functionalFico(candidate: any, primary: string) {
  const text = blob(candidate);
  const title = deriveTitle(candidate).toUpperCase();

  if (primary !== "FICO") return false;
  if (hasAny(title, ["FICO", "FI/CO", "SAP FI", "SAP FINANCE", "FINANCE CONSULTANT", "BUSINESS ANALYST", "SAP FIN"])) return true;
  if (countTerms(text, FUNCTIONAL_TERMS) >= 1) return true;

  return false;
}

function trueTechnical(candidate: any, primary: string) {
  const title = deriveTitle(candidate).toUpperCase();

  if (primary === "FICO") return false;
  if (TECH_TITLE_TERMS.some((x) => title.includes(x))) return true;
  if (["ABAP", "BASIS", "BW", "BI"].includes(primary)) return true;

  return false;
}

function financeDepth(candidate: any, primary: string) {
  const text = blob(candidate);
  const financeHits = countTerms(text, FINANCE_TERMS);
  const deepHits = countTerms(text, DEEP_FICO_TERMS);

  let score = 0;

  if (primary === "FICO") score += 35;
  score += Math.min(35, financeHits * 4);
  score += Math.min(25, deepHits * 3);

  if (hasAny(text, ["FSCM", "TRM", "TREASURY", "CFIN", "CENTRAL FINANCE", "FICA"])) score += 8;
  if (hasAny(text, ["COPA", "CO-PA", "PCA"])) score += 5;

  return clamp(score, 0, 95);
}

function implementationAuthority(candidate: any) {
  const p = projectCounts(candidate);

  const score =
    p.implementationProjects * 6 +
    p.rolloutProjects * 4 +
    p.s4hanaProjects * 5 +
    p.eccProjects * 1 -
    Math.max(0, p.amsProjects - p.implementationProjects) * 2;

  return clamp(score, 0, 95);
}

function consultingDNA(candidate: any) {
  const text = blob(candidate);
  const consultingFirmBoost = CONSULTING_BRANDS.some((brand) => text.includes(brand)) ? 20 : 0;

  const deliveryHits = countTerms(text, [
    "CONSULTANT",
    "CONSULTING",
    "CLIENT",
    "STAKEHOLDER",
    "WORKSHOP",
    "BLUEPRINT",
    "FIT GAP",
    "FIT-GAP",
    "REQUIREMENT GATHERING",
    "SOLUTION DESIGN",
    "CONFIGURATION",
    "CUSTOMIZING",
    "UAT",
    "CUTOVER",
    "GO LIVE",
    "HYPERCARE",
    "PRESALES",
    "PROPOSAL",
    "RFP",
  ]);

  return clamp(consultingFirmBoost + deliveryHits * 5, 0, 95);
}

function moduleAuthority(candidate: any, required: string) {
  const primary = derivePrimaryModule(candidate);
  const secondary = deriveSecondaryModules(candidate, primary);
  const text = blob(candidate);

  if (required === "FICO") {
    if (primary === "FICO") {
      let score = 75;

      if (hasAny(topBlob(candidate), FICO_PRIMARY_SIGNALS)) score += 10;
      if (countTerms(text, DEEP_FICO_TERMS) >= 5) score += 8;
      if (countTerms(text, DEEP_FICO_TERMS) >= 9) score += 5;
      if (hasAny(text, ["FSCM", "TRM", "CFIN", "CENTRAL FINANCE", "FICA"])) score += 5;

      return clamp(score, 70, 98);
    }

    if (secondary.includes("FICO")) return 40;
    if (HARD_NON_FICO.includes(primary)) return 10;
    return 10;
  }

  if (primary === required) return 95;
  if (secondary.includes(required)) return 60;

  return 10;
}

function roleFit(candidate: any, required: string) {
  const primary = derivePrimaryModule(candidate);
  const title = deriveTitle(candidate).toUpperCase();

  if (required === "FICO") {
    if (functionalFico(candidate, primary)) {
      let score = 82;

      if (title.includes("CONSULTANT")) score += 8;
      if (title.includes("SENIOR") || title.includes("SR")) score += 3;
      if (title.includes("LEAD") || title.includes("MANAGER")) score += 5;
      if (title.includes("BUSINESS ANALYST")) score -= 4;

      return clamp(score, 75, 96);
    }

    if (primary === "FICO") return 78;
    if (trueTechnical(candidate, primary)) return 20;
    if (HARD_NON_FICO.includes(primary)) return 25;

    return 40;
  }

  return 70;
}

function consultingLevel(years: number): ConsultingLevel {
  if (years >= 19) return "MANAGER";
  if (years >= 13) return "LEAD_CONSULTANT";
  if (years >= 7) return "SENIOR_CONSULTANT";
  return "CONSULTANT";
}

function calculateProfileQualityScore(profile: {
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  years: number;
  primaryModule: string;
  roleType: string;
  implementationProjects: number;
}) {
  let score = 0;

  if (profile.name && profile.name !== "Unknown Candidate") score += 20;
  if (profile.title) score += 15;
  if (profile.email) score += 15;
  if (profile.phone) score += 10;
  if (!profile.email && !profile.phone) score -= 15;
  if (profile.years >= 1 && profile.years <= 35) score += 15;
  if (profile.primaryModule && profile.primaryModule !== "UNKNOWN") score += 10;
  if (profile.roleType && profile.roleType !== "Other") score += 10;
  if (profile.implementationProjects > 0) score += 5;

  return clamp(score, 0, 100);
}


function deriveVisaStatus(candidate: any): string {
  const direct = toText(candidate?.visa_status || candidate?.visaStatus || candidate?.work_authorization || candidate?.workAuthorization).trim();
  if (direct) return direct;

  const text = blob(candidate);
  if (/\b(CITIZEN|CITIZENSHIP|LOCAL NATIONAL)\b/i.test(text)) return "Citizen";
  if (/\b(PR|PERMANENT RESIDENT|PERMANENT RESIDENCE)\b/i.test(text)) return "PR";
  if (/\b(EMPLOYMENT PASS|EP HOLDER|EP)\b/i.test(text)) return "EP Holder";
  if (/\b(DEPENDANT PASS|DEPENDENT PASS|DP HOLDER|DP)\b/i.test(text)) return "DP Holder";
  if (/\b(SPONSORSHIP REQUIRED|REQUIRE VISA|VISA REQUIRED|NEED SPONSORSHIP)\b/i.test(text)) return "Visa Required";
  return "Not yet verified";
}

function deriveRelocationPreference(candidate: any): string {
  const direct = toText(candidate?.relocation_preference || candidate?.relocationPreference || candidate?.relocation || candidate?.open_to_relocation).trim();
  if (direct) return direct;

  const text = blob(candidate);
  if (/\b(OPEN TO RELOCATE|WILLING TO RELOCATE|OPEN FOR RELOCATION|RELOCATION: YES)\b/i.test(text)) return "Open to relocation";
  if (/\b(NOT OPEN TO RELOCATE|NOT WILLING TO RELOCATE|RELOCATION: NO)\b/i.test(text)) return "Not open to relocation";
  return "Not yet verified";
}

function deriveEmploymentType(candidate: any): string {
  const direct = toText(candidate?.employment_type || candidate?.employmentType || candidate?.preferred_employment_type).trim();
  if (direct) return direct;

  const text = blob(candidate);
  if (/\b(CONTRACTOR|CONTRACT ROLE|FREELANCE)\b/i.test(text)) return "Contractor";
  if (/\b(PERMANENT|FULL TIME|FULL-TIME|FTE)\b/i.test(text)) return "Permanent";
  return "Not yet verified";
}

function deriveAvailabilityStatus(candidate: any): string {
  const direct = toText(candidate?.availability_status || candidate?.availabilityStatus || candidate?.open_status || candidate?.openStatus).trim();
  if (direct) return direct;

  const text = blob(candidate);
  if (/\b(OPEN TO WORK|OPEN FOR WORK|OPEN TO OPPORTUNITIES|OPEN TO DISCUSSION)\b/i.test(text)) return "Open to discussion";
  if (/\b(NOT OPEN TO WORK|NOT LOOKING|NOT INTERESTED)\b/i.test(text)) return "Not open to work";
  return "Not yet verified";
}

function deriveAvailableWithin(candidate: any): string {
  const direct = toText(candidate?.available_within || candidate?.availableWithin || candidate?.notice_period || candidate?.noticePeriod).trim();
  if (direct) return direct;

  const text = blob(candidate);
  const match = text.match(/\b(?:NOTICE PERIOD|AVAILABLE WITHIN|AVAILABILITY)\s*[:\-]?\s*(IMMEDIATE|\d+\s*(?:DAYS?|WEEKS?|MONTHS?))/i);
  return match?.[1] || "Not yet verified";
}

function deriveLanguages(candidate: any): { language: string; proficiency: number; level?: string }[] {
  const direct = candidate?.languages || candidate?.language_skills || candidate?.languageSkills;

  if (Array.isArray(direct)) {
    return direct
      .map((item: any) => {
        if (typeof item === "string") return { language: item, proficiency: 0 };
        return {
          language: toText(item.language || item.name).trim(),
          proficiency: numberFrom(item.proficiency, item.score, item.rating),
          level: toText(item.level || item.proficiency_level || item.proficiencyLevel).trim() || undefined,
        };
      })
      .filter((item) => item.language)
      .slice(0, 10);
  }

  const text = blob(candidate);
  const results: { language: string; proficiency: number; level?: string }[] = [];

  const add = (language: string, proficiency: number, level?: string) => {
    if (!results.some((item) => item.language.toLowerCase() === language.toLowerCase())) {
      results.push({ language, proficiency, level });
    }
  };

  if (/\bENGLISH\b/i.test(text)) add("English", 8);
  if (/\bMANDARIN|CHINESE\b/i.test(text)) add("Mandarin", 7);
  if (/\bCANTONESE\b/i.test(text)) add("Cantonese", 7);
  if (/\bJAPANESE\b/i.test(text)) {
    const jlpt = text.match(/\bN[1-5]\b/i)?.[0]?.toUpperCase();
    const score = jlpt === "N1" ? 10 : jlpt === "N2" ? 9 : jlpt === "N3" ? 7 : jlpt === "N4" ? 5 : 6;
    add("Japanese", score, jlpt);
  }
  if (/\bKOREAN\b/i.test(text)) add("Korean", 7);
  if (/\bTHAI\b/i.test(text)) add("Thai", 8);
  if (/\bBAHASA\b|\bINDONESIAN\b/i.test(text)) add("Bahasa / Indonesian", 8);
  if (/\bVIETNAMESE\b/i.test(text)) add("Vietnamese", 8);
  if (/\bTAGALOG|FILIPINO\b/i.test(text)) add("Filipino / Tagalog", 8);

  return results.slice(0, 10);
}

function deriveExpectedSalary(candidate: any): number {
  return numberFrom(
    candidate?.expected_salary,
    candidate?.expectedSalary,
    candidate?.salary_expectation,
    candidate?.expected_monthly_salary,
    candidate?.expectedPackage
  );
}

function deriveExpectedSalaryCurrency(candidate: any): string {
  const direct = toText(
    candidate?.expected_salary_currency ||
      candidate?.salary_currency ||
      candidate?.currency ||
      candidate?.compensation_currency
  ).trim().toUpperCase();

  if (direct) return direct;

  const text = blob(candidate);
  const currency = text.match(/\b(USD|EUR|GBP|SGD|MYR|PHP|THB|VND|IDR|AUD|NZD|JPY|CNY|HKD|AED|SAR|QAR|INR)\b/i)?.[1];
  return currency ? currency.toUpperCase() : "";
}

function deriveProjectExtractionConfidence(candidate: any, projects: ReturnType<typeof projectCounts>): string {
  const direct = toText(
    candidate?.project_extraction_confidence ||
      candidate?.projectExtractionConfidence ||
      candidate?.delivery_experience_confidence
  ).trim();

  if (direct) return direct;

  const source = toText(
    candidate?.project_extraction_source ||
      candidate?.projectExtractionSource ||
      candidate?.delivery_experience_source
  ).toLowerCase();

  if (source.includes("recruiter") || source.includes("verified") || source.includes("candidate") || source.includes("confirmed")) return "High";

  const hasProjectEvidence =
    projects.greenfieldProjects ||
    projects.rolloutProjects ||
    projects.brownfieldProjects ||
    projects.selectiveTransformationProjects ||
    projects.s4ImplementationProjects ||
    projects.s4AmsProjects;

  return hasProjectEvidence ? "Medium" : "Low";
}

function deriveProjectExtractionSource(candidate: any, projects: ReturnType<typeof projectCounts>): string {
  const direct = toText(
    candidate?.project_extraction_source ||
      candidate?.projectExtractionSource ||
      candidate?.delivery_experience_source
  ).trim();

  if (direct) return direct;

  const hasExplicitProjectNumbers =
    numberFrom(
      candidate?.greenfield_projects,
      candidate?.rollout_projects,
      candidate?.brownfield_projects,
      candidate?.selective_transformation_projects,
      candidate?.s4_implementation_projects,
      candidate?.s4_ams_projects
    ) > 0;

  if (hasExplicitProjectNumbers) return "Explicit CV / parsed field";

  const hasInferredEvidence =
    projects.greenfieldProjects ||
    projects.rolloutProjects ||
    projects.brownfieldProjects ||
    projects.selectiveTransformationProjects ||
    projects.s4ImplementationProjects ||
    projects.s4AmsProjects;

  return hasInferredEvidence ? "AI inferred" : "Unknown / not provided";
}

export function buildCandidateProfile(candidate: any): CandidateProfile {
  const text = blob(candidate);
  const projects = projectCounts(candidate);
  const originalNameResult = deriveName(candidate, text);
  const years = deriveYears(candidate);
  const title = deriveTitle(candidate);
  const company = deriveCompany(candidate);

  const email =
    candidate.email ||
    text.match(/[A-Z0-9._%+-]+@[A-Z]{0,1}[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ||
    null;

  const inferredNameFromEmail = email ? fallbackNameFromEmail(email) : null;
  const nameIsWeak = isWeakCandidateNameProduction(originalNameResult.name);
  const safeName = nameIsWeak && inferredNameFromEmail ? inferredNameFromEmail : originalNameResult.name;
  const finalNameWeak = isWeakCandidateNameProduction(safeName);

  const phone = cleanPhoneProduction(extractPhone(candidate, rawTextOf(candidate)) || candidate.phone) || null;

  const sap = inferSapProfile({
    ...candidate,
    name: safeName,
    title,
    current_title: candidate.current_title || candidate.title,
    raw_text: candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.rawText || text,
  });

  const derivedPrimaryModule = derivePrimaryModule({
    ...candidate,
    title,
    current_title: candidate.current_title || candidate.title,
    raw_text: candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.rawText || text,
  });
  const primaryModule = derivedPrimaryModule && derivedPrimaryModule !== "UNKNOWN" ? derivedPrimaryModule : sap.primaryModule;
  const derivedSecondaryModules = deriveSecondaryModules(
    {
      ...candidate,
      title,
      current_title: candidate.current_title || candidate.title,
      raw_text: candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.rawText || text,
      secondary_modules: [...(sap.secondaryModules || []), ...(arr(candidate.secondary_modules)), ...(arr(candidate.sap_modules)), ...(arr(candidate.skills))],
    },
    primaryModule,
  );
  const secondaryModules = Array.from(new Set([...(derivedSecondaryModules || []), ...(sap.secondaryModules || [])]))
    .filter((m) => m && m !== primaryModule && m !== "UNKNOWN")
    .slice(0, 12);
  const roleType = (primaryModule === "SUCCESSFACTORS" || primaryModule === "HCM" || primaryModule === "EC"
    ? "SAP Functional"
    : sap.roleType) as CandidateRoleType;

  const baseProfileForQuality = {
    name: safeName,
    title,
    email,
    phone,
    years,
    primaryModule,
    roleType,
    implementationProjects: projects.implementationProjects,
  };

  let profileQualityScore = calculateProfileQualityScore(baseProfileForQuality);
  if (finalNameWeak) profileQualityScore = Math.min(profileQualityScore, 60);

  return {
    name: finalNameWeak ? "Review Required" : safeName,
    email,
    phone,
    title,
    company,
    location: candidate.location || candidate.current_location || "",
    years,
    primaryModule,
    secondaryModules,
    roleType,
    consultingLevel: consultingLevel(years),
    ...projects,
    visaStatus: deriveVisaStatus(candidate),
    relocationPreference: deriveRelocationPreference(candidate),
    relocation: deriveRelocationPreference(candidate),
    workAuthorization: deriveVisaStatus(candidate),
    employmentType: deriveEmploymentType(candidate),
    employmentPreference: deriveEmploymentType(candidate),
    availabilityStatus: deriveAvailabilityStatus(candidate),
    availableWithin: deriveAvailableWithin(candidate),
    expectedSalary: deriveExpectedSalary(candidate),
    expectedSalaryCurrency: deriveExpectedSalaryCurrency(candidate),
    salaryCurrency: deriveExpectedSalaryCurrency(candidate),
    projectExtractionConfidence: deriveProjectExtractionConfidence(candidate, projects),
    projectExtractionSource: deriveProjectExtractionSource(candidate, projects),
    languages: deriveLanguages(candidate),
    moduleAuthority: Math.max(10, Math.min(98, Math.round(sap.moduleScores?.[primaryModule] || sap.moduleConfidence || 0))),
    financeDepth: sap.financeDepthScore,
    implementationAuthority: sap.implementationAuthorityScore,
    consultingDNA: sap.consultingDNAScore,
    roleFitBase: primaryModule === "FICO" ? roleFit(candidate, "FICO") : Math.max(25, Math.min(75, Math.round(sap.moduleConfidence || 35))),
    nameReviewRequired: originalNameResult.review || finalNameWeak,
    contactMissing: !email && !phone,
    profileQualityScore,
    extractionWarnings: finalNameWeak
      ? [...originalNameResult.warnings, "Name requires recruiter review"]
      : originalNameResult.warnings,
  };
}

export default buildCandidateProfile;

