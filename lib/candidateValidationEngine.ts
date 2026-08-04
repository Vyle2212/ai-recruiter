export type CandidateValidationResult = {
  cleanedName: string;
  isWeakName: boolean;
  isCompanyName: boolean;
  isReviewRecord: boolean;
  suppressionReason: string | null;
  qualityCap: number | null;
};

const COMPANY_WORDS = [
  "INC", "INC.", "LTD", "LTD.", "LLC", "CORP", "CORPORATION", "COMPANY",
  "CO.", "GROUP", "HOLDINGS", "TECHNOLOGIES", "TECHNOLOGY", "SOLUTIONS",
  "CONSULTING", "SYSTEMS", "SERVICES", "PHILIPPINES", "MALAYSIA",
  "SINGAPORE", "VIETNAM", "INDONESIA", "CENTER", "CENTRE", "DELIVERY",
  "ACCENTURE", "DELOITTE", "PWC", "PRICEWATERHOUSECOOPERS", "EY", "KPMG",
  "IBM", "CAPGEMINI", "NTT", "TCS", "INFOSYS", "WIPRO", "DXC", "ATOS",
  "DENTSPLY", "SIRONA", "OLIVAREZ", "HOMES", "TRAVEL"
];

const TITLE_OR_SECTION_WORDS = [
  "SAP", "FICO", "FI", "CO", "ABAP", "BASIS", "BW", "BI", "MM", "SD", "EWM",
  "TM", "PP", "PM", "PS", "CONSULTANT", "MANAGER", "LEAD", "SENIOR", "JUNIOR",
  "SPECIALIST", "ARCHITECT", "ANALYST", "DEVELOPER", "APPLICATION", "DEVELOPMENT",
  "DESIGNATION", "IMPLEMENTATION", "PROJECT", "SUPPORT", "AMS", "ROLLOUT",
  "MIGRATION", "BROWNFIELD", "GREENFIELD", "HYPERCARE", "CUTOVER", "BLUEPRINT",
  "WORKSHOP", "EXPERIENCE", "RESPONSIBILITIES", "PROFILE", "SUMMARY",
  "OBJECTIVE", "SKILLS", "TRACKING", "RESOLUTION", "ISSUE", "MONITORING",
  "BODS", "DATA", "MATERIAL", "LOGISTICS", "WAREHOUSE", "ORDER", "CASH", "INTERNALLY"
];

const REVIEW_NAMES = [
  "UNKNOWN CANDIDATE", "REVIEW REQUIRED", "CANDIDATE", "RESUME", "CV",
  "JOB TITLE", "NO TITLE", "NOT FOUND", "NAME", "PROFILE"
];

function s(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function titleCaseName(value: string) {
  return s(value)
    .replace(/\b(cv|resume|profile|updated|final|copy)\b/gi, " ")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z]{2,4}$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function localPartFromEmail(email: any) {
  const local = s(email).split("@")[0] || "";
  if (!local) return "";

  const tokens = local
    .toLowerCase()
    .replace(/[._+-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const roleTokens = new Set([
    "sap", "fico", "fi", "co", "abap", "basis", "bw", "bi", "mm", "sd", "ewm", "tm", "pp", "pm", "ps",
    "consultant", "manager", "architect", "developer", "analyst", "lead", "senior", "sr", "jr", "junior",
    "profile", "resume", "cv", "recruiter", "hr"
  ]);
  const meaningful = tokens.filter((token) => !roleTokens.has(token) && token.length >= 2);
  if (tokens.some((token) => roleTokens.has(token)) && meaningful.length < 2) return "";

  const cleaned = local
    .replace(/[0-9]+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\b(cv|resume|profile|sap|fico|fi|co|consultant|senior|lead|manager)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCaseName(cleaned);
}

export function isCompanyNameV2(value: any) {
  const name = s(value);
  if (!name) return false;
  const up = name.toUpperCase().replace(/[.,()]/g, " ");
  const words = up.split(/\s+/).filter(Boolean);
  const companyHits = words.filter((w) => COMPANY_WORDS.includes(w)).length;

  if (companyHits >= 2) return true;
  if (companyHits >= 1 && words.length <= 3) return true;
  if (/\b(INC|LTD|LLC|CORP|CORPORATION|COMPANY|GROUP|HOLDINGS|SOLUTIONS|TECHNOLOGIES|SERVICES)\b/i.test(up)) return true;

  return false;
}

export function isReviewRecordNameV2(value: any) {
  const name = s(value).toUpperCase();
  if (!name) return true;
  if (REVIEW_NAMES.includes(name)) return true;
  if (/^(REVIEW|UNKNOWN|CANDIDATE|RESUME|CV|PROFILE)(\s|$)/i.test(name)) return true;
  return false;
}

export function isWeakCandidateNameV2(value: any) {
  const name = s(value);
  if (!name) return true;

  const up = name.toUpperCase().replace(/[.,:;()]/g, " ");
  const words = up.split(/\s+/).filter(Boolean);

  if (isReviewRecordNameV2(name)) return true;
  if (isCompanyNameV2(name)) return true;
  if (/[0-9@]/.test(name)) return true;
  if (words.length < 2 || words.length > 5) return true;

  if (/\b(AS A CONSULTANT|WORKED AS|PROVIDED SERVICES|ISSUE RESOLUTION|TRACKING|MONITORING|SEAMLESS TRANSITION|DIGITAL TRANSFORMATION|BODS DATA MIGRATION|ORDER TO CASH|LOGISTICS WAREHOUSE|OLIVAREZ HOMES|DENTSPLY SIRONA|THE IMPLEMENTATION)\b/i.test(up)) return true;

  const titleHits = words.filter((w) => TITLE_OR_SECTION_WORDS.includes(w)).length;
  if (titleHits >= Math.max(2, words.length - 1)) return true;

  if (/\b(SAC|BODS|DATASPHERE|MATERIAL|CALAMBA|DESIGNATION|CONSULTANT|MANAGER|ARCHITECT|SPECIALIST|IMPLEMENTATION|RESOLUTION)\b$/i.test(name)) return true;

  return false;
}

export function validateCandidateNameV2(name: any, email?: any, sourceFile?: any): CandidateValidationResult {
  let cleaned = titleCaseName(s(name));

  if (isWeakCandidateNameV2(cleaned)) {
    const fromEmail = localPartFromEmail(email);
    if (fromEmail && !isWeakCandidateNameV2(fromEmail)) {
      cleaned = fromEmail;
    }
  }

  if (isWeakCandidateNameV2(cleaned)) {
    const fromFile = titleCaseName(s(sourceFile).replace(/\.[a-z0-9]+$/i, ""));
    if (fromFile && !isWeakCandidateNameV2(fromFile)) {
      cleaned = fromFile;
    }
  }

  const isReviewRecord = isReviewRecordNameV2(cleaned);
  const isCompanyName = isCompanyNameV2(cleaned);
  const isWeakName = isWeakCandidateNameV2(cleaned);

  let suppressionReason: string | null = null;
  let qualityCap: number | null = null;

  if (isReviewRecord) {
    suppressionReason = "Review placeholder record";
    qualityCap = 20;
  } else if (isCompanyName) {
    suppressionReason = "Company name detected instead of candidate name";
    qualityCap = 35;
  } else if (isWeakName) {
    suppressionReason = "Weak candidate name evidence";
    qualityCap = 60;
  }

  return {
    cleanedName: cleaned || "Review Required",
    isWeakName,
    isCompanyName,
    isReviewRecord,
    suppressionReason,
    qualityCap,
  };
}


const HARD_SUPPRESS_NAME_PATTERNS_V3 = [
  /\breview\s+required\b/i,
  /\bglobal\s+rollout\b/i,
  /\broll\s*out\b/i,
  /\bimplementation\b/i,
  /\bproject\b/i,
  /\bconsultant\b/i,
  /\bmanager\b/i,
  /\blead\s+consultant\b/i,
  /\bfunctional\s+consultant\b/i,
  /\btechnical\s+consultant\b/i,
  /\bsap\s+(fico|fi|co|mm|sd|abap|basis|bw|bi|ewm|tm|pp|pm|ps)\b/i,
  /\btracking\b/i,
  /\bissue\s+resolution\b/i,
  /\bmonitoring\b/i,
  /\barchitecture\b/i,
  /\bsolution\b/i,
  /\bworked\s+as\b/i,
  /\bresponsible\b/i,
  /\bexperience\b/i,
];

export function validateCandidateNameV3(name: any, email?: any, sourceFile?: any): CandidateValidationResult {
  const v2 = validateCandidateNameV2(name, email, sourceFile);
  const raw = String(name || "").trim();
  const cleaned = String(v2.cleanedName || "").trim();

  const hardBad =
    HARD_SUPPRESS_NAME_PATTERNS_V3.some((pattern) => pattern.test(raw)) ||
    HARD_SUPPRESS_NAME_PATTERNS_V3.some((pattern) => pattern.test(cleaned));

  if (hardBad) {
    return {
      ...v2,
      cleanedName: cleaned && !hardBad ? cleaned : "Review Required",
      isWeakName: true,
      isReviewRecord: true,
      suppressionReason: "Suppressed non-person candidate name",
      qualityCap: 20,
    };
  }

  return v2;
}


export function isBadTitleOrSectionV25(value: any) {
  const text = String(value || "").trim();
  if (!text) return true;
  const up = text.toUpperCase();

  if (/^(NO TITLE|N\/A|NA|NONE|UNKNOWN|REVIEW REQUIRED|JOB TITLE)$/i.test(text)) return true;

  if (
    /\b(AS A CONSULTANT|WORKED AS|PROVIDED SERVICES|INCLUDING ESTABLISHING|RESPONSIBLE FOR|ISSUE RESOLUTION|TRACKING|MONITORING|THE IMPLEMENTATION|I AM ACTUALLY|CURRENTLY WORKING AS|HAVE PROVIDED SERVICES)\b/i.test(up)
  ) {
    return true;
  }

  if (text.length > 95 && !/\b(ARCHITECT|MANAGER|CONSULTANT|LEAD|SPECIALIST|ANALYST|DEVELOPER)\b/i.test(text.slice(0, 95))) {
    return true;
  }

  return false;
}

export function validateCandidateNameV25(name: any, email?: any, sourceFile?: any): CandidateValidationResult {
  const v3 = validateCandidateNameV3(name, email, sourceFile);
  const raw = String(name || "").trim();
  const cleaned = String(v3.cleanedName || "").trim();

  const hardBad =
    isBadTitleOrSectionV25(raw) ||
    /^(ROLL\s*OUT|GLOBAL\s+ROLLOUT|IMPLEMENTATION|PROJECT|SAP\s+CONSULTANT|FUNCTIONAL\s+CONSULTANT|TECHNICAL\s+CONSULTANT)$/i.test(cleaned);

  if (hardBad) {
    return {
      ...v3,
      cleanedName: v3.cleanedName && !isBadTitleOrSectionV25(v3.cleanedName) ? v3.cleanedName : "Review Required",
      isWeakName: true,
      isReviewRecord: true,
      suppressionReason: "Suppressed non-person or section/title candidate name",
      qualityCap: 20,
    };
  }

  return v3;
}

export function titleQualityCapV25(title: any) {
  if (isBadTitleOrSectionV25(title)) return 70;
  const t = String(title || "").trim();
  if (!t || /^NO TITLE$/i.test(t)) return 70;
  if (t.length > 85) return 82;
  return null;
}


// =========================
// V27.1 Stronger Name/Title Suppression
// =========================

export function isBadTitleOrSectionV271(value: any) {
  const text = String(value || "").trim();
  const up = text.toUpperCase();

  if (!text) return true;
  if (/^(NO TITLE|N\/A|NA|NONE|UNKNOWN|REVIEW REQUIRED|JOB TITLE|MANAGER|ASSOCIATE MANAGER)$/i.test(text)) return true;

  if (
    /\b(AS A CONSULTANT|WORKED AS|CURRENTLY WORKING AS|HAVE PROVIDED SERVICES|INCLUDING ESTABLISHING|RESPONSIBLE FOR|THE IMPLEMENTATION|IMPLEMENTATION\.|ISSUE RESOLUTION|RELEASE STRATEGY IN PROCUREMENT FLOW|LOGISTICS,\s*WAREHOUSE AND|HO CHI MINH CITY|INSIDESALES|INSIDE SALES|KEY ACCOUNT MANAGER|ACCOUNT MANAGER|PROCUREMENT FLOW)\b/i.test(up)
  ) {
    return true;
  }

  if (
    up.length > 80 &&
    /\b(WORKED AS|PROVIDED SERVICES|INCLUDING|RESPONSIBLE|IMPLEMENTATION|ESTABLISHING|CURRENTLY|SEASONED|HAVE)\b/.test(up)
  ) {
    return true;
  }

  if (
    /\b(CITY|ADDRESS|MOBILE|PHONE|EMAIL|PERSONAL DETAILS|CONTACT DETAILS|WORK HISTORY|PROJECT EXPERIENCE|TECHNICAL SKILLS|CAREER OBJECTIVE|MARITAL STATUS)\b/i.test(up) &&
    !/\b(SAP|CONSULTANT|MANAGER|LEAD|ARCHITECT|ANALYST|DEVELOPER)\b/i.test(up)
  ) {
    return true;
  }

  return false;
}

export function validateCandidateNameV271(name: any, email?: any, sourceFile?: any): CandidateValidationResult {
  const base = validateCandidateNameV25(name, email, sourceFile);
  const raw = String(name || "").trim();
  const cleaned = String(base.cleanedName || "").trim();

  const hardBad =
    isBadTitleOrSectionV271(raw) ||
    isBadTitleOrSectionV271(cleaned) ||
    /^(RELEASE STRATEGY|LOGISTICS|WAREHOUSE|HO CHI MINH|INSIDESALES|INSIDE SALES)$/i.test(cleaned);

  if (hardBad) {
    return {
      ...base,
      cleanedName: "Review Required",
      isWeakName: true,
      isReviewRecord: true,
      suppressionReason: "Suppressed non-person name/title section",
      qualityCap: 20,
    };
  }

  return base;
}

export function titleQualityCapV271(title: any) {
  if (isBadTitleOrSectionV271(title)) return 45;
  const baseCap = titleQualityCapV25(title);
  return baseCap;
}


// =========================
// V27.2 Final Suppression Helpers
// =========================

export function isNarrativeCvSentenceV272(value: any) {
  const text = String(value || "").trim();
  const up = text.toUpperCase();

  if (!text) return false;

  if (
    /\b(AS A CONSULTANT|I HAVE PROVIDED|HAVE PROVIDED SERVICES|PROVIDED SERVICES|CURRENTLY WORKING AS|WORKING AS|WORKED AS|RESPONSIBLE FOR|RESPONSIBILITIES INCLUDE|INCLUDING ESTABLISHING|SEASONED AS|TILL DATE|FROM MAY|PROJECT DETAILS|ROLE DESCRIPTION|KEY RESPONSIBILITIES|DUTIES AND RESPONSIBILITIES)\b/i.test(up)
  ) {
    return true;
  }

  if (
    text.length > 75 &&
    /\b(I|HAVE|WORKING|WORKED|PROVIDED|RESPONSIBLE|INCLUDING|ESTABLISHING|IMPLEMENTATION|SUPPORT|CONFIGURATION|DEVELOPMENT|PROJECT|CLIENT|SYSTEMS?)\b/i.test(up)
  ) {
    return true;
  }

  return false;
}

export function isBadCandidateTitleV272(value: any) {
  const text = String(value || "").trim();
  const up = text.toUpperCase();

  if (!text) return true;

  if (isBadTitleOrSectionV271(text)) return true;
  if (isNarrativeCvSentenceV272(text)) return true;

  if (
    /^(RELEASE STRATEGY IN PROCUREMENT FLOW|LOGISTICS,\s*WAREHOUSE AND|HO CHI MINH CITY|JOB TITLE|REVIEW REQUIRED)$/i.test(text)
  ) {
    return true;
  }

  if (
    /\b(PERSONAL DETAILS|CONTACT DETAILS|CAREER OBJECTIVE|SUMMARY OF QUALIFICATIONS|PROFESSIONAL SUMMARY|WORK EXPERIENCE|PROJECT EXPERIENCE|TECHNICAL SKILLS|EDUCATION|CERTIFICATION)\b/i.test(up)
  ) {
    return true;
  }

  return false;
}

export function validateCandidateNameV272(name: any, email?: any, sourceFile?: any): CandidateValidationResult {
  const base = validateCandidateNameV271(name, email, sourceFile);
  const raw = String(name || "").trim();
  const cleaned = String(base.cleanedName || "").trim();

  if (isBadCandidateTitleV272(raw) || isBadCandidateTitleV272(cleaned)) {
    return {
      ...base,
      cleanedName: "Review Required",
      isWeakName: true,
      isReviewRecord: true,
      suppressionReason: "Suppressed non-person name or CV section heading",
      qualityCap: 20,
    };
  }

  return base;
}

export function titleQualityCapV272(title: any) {
  if (isBadCandidateTitleV272(title)) return 20;
  return titleQualityCapV271(title);
}
