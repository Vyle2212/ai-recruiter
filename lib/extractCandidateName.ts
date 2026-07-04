import { extractCandidateNameStrict } from "./candidateFileGuards";

function cleanText(value: any): string {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const BAD_NAME_PATTERNS = [
  "review required",
  "profile under review",
  "candidate information",
  "candidate name not detected",
  "personal information",
  "personal particular",
  "personal particulars",
  "personal details",
  "personal detail",
  "full name",
  "name of candidate",
  "career history",
  "employment history",
  "professional summary",
  "profile summary",
  "career objective",
  "professional objective",
  "technical skills",
  "key skills",
  "key competencies",
  "responsibilities",
  "responsibility",
  "procedures",
  "test scripts",
  "robot framework",
  "hobbies",
  "hobbies and",
  "references",
  "education",
  "certification",
  "certifications",
  "qualification",
  "qualifications",
  "job title name",
  "consultant candidate name",
  "and need for resources",
  "need for resources",
  "software testing",
  "page 1 of",
  "resume of",
  "curriculum vitae",
  "nationality",
  "date of birth",
  "year of birth",
  "gender",
  "expected salary",
  "current salary",
  "notice period",
  "availability",
  "prepared by",
  "assessment by",
  "private & confidential",
  "strictly confidential",
  "capital market",
  "enterprise accounts",
  "strategy development",
];

const TITLE_OR_ROLE_WORDS =
  /\b(SAP|ABAP|FICO|FI\/CO|BASIS|CONSULTANT|MANAGER|ENGINEER|ANALYST|DEVELOPER|SPECIALIST|LEAD|ARCHITECT|PROJECT|PROGRAM|TESTING|FRAMEWORK|ORACLE|ERP|DELOITTE|KPMG|PWC|EY)\b/i;

const PORTAL_SUFFIX_PATTERNS = [
  /\bSeek\b$/i,
  /\bAsk\b$/i,
  /\bJobstreet\b$/i,
  /\bJobStreet\b$/i,
  /\bLinkedin\b$/i,
  /\bLinkedIn\b$/i,
  /\bIndeed\b$/i,
  /\bMonster\b$/i,
  /\bNaukri\b$/i,
];

function stripPortalSuffix(value: string): string {
  let output = cleanText(value);

  for (let i = 0; i < 3; i++) {
    const before = output;
    for (const pattern of PORTAL_SUFFIX_PATTERNS) {
      output = output.replace(pattern, "").trim();
    }
    if (before === output) break;
  }

  return output;
}

export function looksLikeBadCandidateName(value?: string | null): boolean {
  const name = cleanText(value);
  if (!name) return true;

  const stripped = stripPortalSuffix(name);
  const lower = stripped.toLowerCase();

  if (!stripped) return true;
  if (BAD_NAME_PATTERNS.some((pattern) => lower.includes(pattern))) return true;
  if (stripped.includes("@")) return true;
  if (/https?:\/\//i.test(stripped) || /\blinkedin\b/i.test(stripped)) return true;
  if (/\d{3,}/.test(stripped)) return true;
  if (stripped.length < 3 || stripped.length > 70) return true;

  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return true;

  if (TITLE_OR_ROLE_WORDS.test(stripped)) return true;

  return false;
}

function titleCasePersonName(value: string): string {
  let cleaned = cleanText(value)
    .replace(/^Career\s*history/i, "")
    .replace(/^Employment\s*history/i, "")
    .replace(/^Professional\s*Experience/i, "")
    .replace(/^PROFILE\s+Name\s*[:\-]?\s*/i, "")
    .replace(/^Full\s*Name\s*[:\-]?\s*/i, "")
    .replace(/^Candidate\s*Name\s*[:\-]?\s*/i, "")
    .replace(/^Name\s*[:\-]?\s*/i, "")
    .replace(/^Mr\.?\s+/i, "")
    .replace(/^Ms\.?\s+/i, "")
    .replace(/^Mrs\.?\s+/i, "")
    .trim();

  cleaned = stripPortalSuffix(cleaned);

  return cleaned
    .replace(/^[<~\-\s]+|[<~\-\s]+$/g, "")
    .split(/\s+/)
    .map((part) => {
      const cleanedPart = part.replace(/[^\p{L}.'’@-]/gu, "");
      if (!cleanedPart) return "";
      const lower = cleanedPart.toLowerCase();
      if (["de", "del", "dela", "la", "le", "van", "von", "bin", "binti"].includes(lower)) {
        return lower;
      }
      return cleanedPart.charAt(0).toUpperCase() + cleanedPart.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(" ");
}

function splitDenseCvText(rawText: string): string[] {
  const text = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .replace(/([a-z])([A-Z][a-z])/g, "$1\n$2")
    .replace(
      /(CANDIDATE\s*INFORMATION|PERSONAL\s*INFORMATION|PERSONAL\s*PARTICULARS|PERSONAL\s*DETAILS|Full\s*Name|Candidate\s*Name|Name|Career\s*history|Employment\s*history|Professional\s*Experience|Work\s*Experience|Education|Qualification|Certification|Skills|Profile|Summary|Assessment\s*by)/gi,
      "\n$1 "
    )
    .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "\n$1\n")
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, "\n$1\n");

  return text
    .split(/\r?\n| {3,}/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .slice(0, 100);
}

function validHumanName(value: string | null): string | null {
  if (!value) return null;

  const candidate = titleCasePersonName(value);

  if (looksLikeBadCandidateName(candidate)) return null;

  if (!/^[A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-Za-zÀ-ỹ.'’@-]+){1,5}$/.test(candidate)) {
    return null;
  }

  return candidate;
}

function extractFromExplicitLabels(rawText: string): string | null {
  const patterns = [
    /\bFull\s*Name\s*[:\-]?\s*([A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+){1,5})/i,
    /\bCandidate\s*Name\s*[:\-]?\s*([A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+){1,5})/i,
    /(?:^|\n)\s*Name\s*[:\-]?\s*([A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+){1,5})/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    const valid = validHumanName(match?.[1] || null);
    if (valid) return valid;
  }

  return null;
}

function extractAfterHeading(rawText: string): string | null {
  const compact = cleanText(rawText);

  const densePatterns = [
    /CANDIDATE\s*INFORMATION.{0,120}?Full\s*Name\s*[:\-]?\s*([A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+){1,5})/i,
    /PERSONAL\s*INFORMATION.{0,120}?Full\s*name\s*[:\-]?\s*([A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+){1,5})/i,
    /PERSONAL\s*PARTICULARS.{0,120}?Name\s*[:\-]?\s*([A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+(?:\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ.'’@-]+){1,5})/i,
  ];

  for (const pattern of densePatterns) {
    const match = compact.match(pattern);
    const valid = validHumanName(match?.[1] || null);
    if (valid) return valid;
  }

  return null;
}

function extractFromTopLines(rawText: string): string | null {
  const lines = splitDenseCvText(rawText);

  for (const line of lines.slice(0, 30)) {
    const cleanedLine = line
      .replace(/^CANDIDATE\s*INFORMATION\s*/i, "")
      .replace(/^PERSONAL\s*INFORMATION\s*/i, "")
      .replace(/^PERSONAL\s*PARTICULARS\s*/i, "")
      .replace(/^PERSONAL\s*DETAILS\s*/i, "")
      .trim();

    const valid = validHumanName(cleanedLine);
    if (valid) return valid;
  }

  return null;
}

function fallbackFromEmail(email?: string | null): string | null {
  const e = cleanText(email);
  if (!e.includes("@")) return null;

  const local = e
    .split("@")[0]
    .replace(/\d+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return validHumanName(local);
}

export function extractCandidateName(text: string, fallbackEmail?: string | null) {
  const rawText = String(text || "");

  const strict = extractCandidateNameStrict(rawText, fallbackEmail);
  if (strict && !looksLikeBadCandidateName(strict)) return titleCasePersonName(strict);

  const explicit = extractFromExplicitLabels(rawText);
  if (explicit) return explicit;

  const fromHeading = extractAfterHeading(rawText);
  if (fromHeading) return fromHeading;

  const topLine = extractFromTopLines(rawText);
  if (topLine) return topLine;

  const emailName = fallbackFromEmail(fallbackEmail);
  if (emailName) return emailName;

  return "Review Required";
}

export default extractCandidateName;
