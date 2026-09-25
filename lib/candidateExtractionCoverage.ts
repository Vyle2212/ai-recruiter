import { evaluateCandidateProfileCompletion } from "./candidateProfileIngestion";

export type CandidateExtractionSection =
  | "identity"
  | "contact"
  | "employment"
  | "projects"
  | "education"
  | "certifications"
  | "skills"
  | "languages"
  | "sap_modules";

export type CandidateExtractionCoverage = {
  status: "complete_for_validation" | "incomplete_needs_review";
  coveragePercent: number;
  observedSections: CandidateExtractionSection[];
  extractedSections: CandidateExtractionSection[];
  missedObservedSections: CandidateExtractionSection[];
  missingRequiredFields: string[];
};

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

function values(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  if (!clean(value)) return [];
  try {
    const parsed = JSON.parse(clean(value));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return clean(value)
      .split(/[,;|\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function present(candidate: Record<string, unknown>, aliases: string[]) {
  return aliases.some((alias) => values(candidate[alias]).some(Boolean));
}

function structuredRecordCount(value: unknown): number {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  if (value && typeof value === "object")
    return Object.values(value).filter(Boolean).length;
  if (typeof value !== "string") return 0;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

function employmentSection(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    /^\s*(?:work(?:ing)?|professional|career|employment)\s+(?:experience|history)\s*:?\s*$/i.test(
      line,
    ),
  );
  if (start < 0) return "";
  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) =>
      /^\s*(?:projects?(?:\s+(?:experience|history|details|portfolio))?|education|academic\s+(?:background|qualifications?)|certifications?|licenses?|skills?|technical\s+skills?|languages?|references?)\s*:?\s*$/i.test(
        line,
      ),
    );
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n");
}

/** Count explicitly labelled employers only inside the bounded employment section. */
function explicitEmploymentCount(rawText: string): number {
  const section = employmentSection(rawText);
  if (!section) return 0;
  return (
    section.match(
      /^[ \t]*(?:employer|company|organisation|organization)(?:[ \t]+name)?[ \t]*:[ \t]*\S/gim,
    ) || []
  ).length;
}

/** Count repeated project-entry labels without double-counting Client + Project in one entry. */
function explicitProjectCount(rawText: string): number {
  const labels = ["(?:client|customer)(?: name)?", "project(?: name| title)?"];
  return Math.max(
    ...labels.map(
      (label) =>
        (
          rawText.match(
            new RegExp(`^[ \\t]*${label}[ \\t]*:[ \\t]*\\S`, "gim"),
          ) || []
        ).length,
    ),
  );
}

const OBSERVED_PATTERNS: Record<
  Exclude<CandidateExtractionSection, "identity" | "sap_modules">,
  RegExp
> = {
  contact:
    /(?:^|\n)\s*(?:contact|email|e-mail|phone|mobile|linkedin)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/im,
  employment:
    /(?:^|\n)\s*(?:work|professional|career|employment)\s+(?:experience|history)\b|\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:present|current|(?:19|20)\d{2})\b/im,
  projects:
    /(?:^|\n)\s*(?:project|client|customer)\s+(?:experience|history|details|portfolio)\b|(?:^|\n)\s*(?:project|client|customer)\s*:/im,
  education:
    /(?:^|\n)\s*(?:education|academic background|academic qualification|qualifications?)\s*:?(?:\n|$)/im,
  certifications:
    /(?:^|\n)\s*(?:certifications?|licenses?\s*(?:&|and)\s*certifications?|credentials?)\s*:?(?:\n|$)/im,
  skills:
    /(?:^|\n)\s*(?:skills?|technical skills?|core competencies|sap skills?|expertise)\s*:?(?:\n|$)/im,
  languages:
    /(?:^|\n)\s*(?:languages?|language proficiency|spoken languages?)\s*:?(?:\n|$)/im,
};

const EXTRACTED_ALIASES: Record<CandidateExtractionSection, string[]> = {
  identity: ["name", "full_name", "displayName", "extractedFullName"],
  contact: ["email", "phone", "linkedin_url", "linkedInUrl"],
  employment: [
    "experience",
    "employment",
    "employment_history",
    "employmentHistory",
  ],
  projects: ["projects", "project_history", "projectHistory", "project_types"],
  education: ["education", "education_history", "educationHistory"],
  certifications: [
    "certifications",
    "professional_certifications",
    "credentials",
  ],
  skills: ["skills", "technical_skills", "sapSkills"],
  languages: ["languages", "language_skills", "spoken_languages"],
  sap_modules: ["primary_module", "primaryModule", "sap_modules", "sapModules"],
};

/**
 * Compares sections explicitly visible in a CV with structured fields emitted
 * by ingestion. A source section that was seen but not structured is never
 * silently treated as successfully parsed.
 */
export function evaluateCandidateExtractionCoverage(
  rawText: string,
  candidate: Record<string, unknown>,
): CandidateExtractionCoverage {
  const observed = new Set<CandidateExtractionSection>([
    "identity",
    "sap_modules",
  ]);
  const projectAnchors = explicitProjectCount(rawText);
  const employmentAnchors = explicitEmploymentCount(rawText);
  if (projectAnchors) observed.add("projects");
  if (employmentAnchors) observed.add("employment");
  for (const [section, pattern] of Object.entries(OBSERVED_PATTERNS)) {
    if (pattern.test(rawText))
      observed.add(section as CandidateExtractionSection);
  }

  const extracted = new Set<CandidateExtractionSection>();
  for (const [section, aliases] of Object.entries(EXTRACTED_ALIASES)) {
    if (present(candidate, aliases))
      extracted.add(section as CandidateExtractionSection);
  }

  if (
    employmentAnchors > 1 &&
    Math.max(
      structuredRecordCount(candidate.experience),
      structuredRecordCount(candidate.employment),
      structuredRecordCount(candidate.employment_history),
      structuredRecordCount(candidate.employmentHistory),
    ) < employmentAnchors
  )
    extracted.delete("employment");

  // Section presence is not enough when the source explicitly enumerates
  // multiple projects. One extracted record must not hide omitted projects.
  if (
    projectAnchors > 1 &&
    Math.max(
      structuredRecordCount(candidate.projects),
      structuredRecordCount(candidate.project_history),
      structuredRecordCount(candidate.projectHistory),
    ) < projectAnchors
  )
    extracted.delete("projects");

  const observedSections = Array.from(observed);
  const extractedSections = Array.from(extracted);
  const missedObservedSections = observedSections.filter(
    (section) => !extracted.has(section),
  );
  const completion = evaluateCandidateProfileCompletion(candidate, {
    requireCandidateConfirmation: false,
  });
  const covered = observedSections.filter((section) => extracted.has(section));
  const coveragePercent = observedSections.length
    ? Math.round((covered.length / observedSections.length) * 100)
    : 0;
  const incomplete =
    missedObservedSections.length > 0 ||
    completion.missingRequiredFields.length > 0;

  return {
    status: incomplete ? "incomplete_needs_review" : "complete_for_validation",
    coveragePercent,
    observedSections,
    extractedSections,
    missedObservedSections,
    missingRequiredFields: completion.missingRequiredFields,
  };
}
