import {
  evaluateCandidateProfileCompletion,
  hasMeaningfulCandidateValue,
  isValidEmploymentEntry,
  isValidProjectEntry,
} from "./candidateProfileIngestion";
import { careerMonthIndex } from "./candidateCareerExperience";

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

function present(candidate: Record<string, unknown>, aliases: string[]) {
  return aliases.some((alias) => hasMeaningfulCandidateValue(candidate[alias]));
}

function structuredRecordCount(
  value: unknown,
  validEntry: (entry: unknown) => boolean,
): number {
  if (Array.isArray(value)) return value.filter(validEntry).length;
  // A single row object has many nonempty fields, not many records. Unknown
  // object shapes cannot prove that all source entries were extracted.
  if (value && typeof value === "object") return 0;
  if (typeof value !== "string") return 0;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(validEntry).length : 0;
  } catch {
    return 0;
  }
}

function conflictingProjectClients(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const rows = value.filter(isValidProjectEntry) as Array<
    Record<string, unknown>
  >;
  const key = (text: unknown) =>
    typeof text === "string"
      ? text
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim()
      : "";
  for (let i = 0; i < rows.length; i++) {
    for (const later of rows.slice(i + 1)) {
      const first = rows[i];
      if (
        !key(first.name) ||
        key(first.name) !== key(later.name) ||
        !key(first.role) ||
        key(first.role) !== key(later.role) ||
        !key(first.client) ||
        !key(later.client) ||
        key(first.client) === key(later.client)
      )
        continue;
      const from = careerMonthIndex(first.start_date);
      const to = careerMonthIndex(first.end_date, first.current === true);
      if (
        from !== null &&
        to !== null &&
        from === careerMonthIndex(later.start_date) &&
        to === careerMonthIndex(later.end_date, later.current === true)
      )
        return true;
    }
  }
  return false;
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
  const label =
    "(?:employer|company|organisation|organization)(?:[ \\t]+name)?";
  const inline = (
    section.match(new RegExp(`^[ \\t]*${label}[ \\t]*:[ \\t]*\\S`, "gim")) || []
  ).length;
  const nextLine = (
    section.match(
      new RegExp(
        `^[ \\t]*${label}[ \\t]*:?[ \\t]*\\r?\\n(?:[ \\t]*\\r?\\n){0,2}[ \\t]*(?!(?:role|job title|duration|start date|end date|employer|company|client|project)[ \\t]*:)\\S`,
        "gim",
      ),
    ) || []
  ).length;
  return inline + nextLine;
}

/** Count repeated project-entry labels without double-counting Client + Project in one entry. */
function explicitProjectCount(rawText: string): number {
  const labels = ["(?:client|customer)(?: name)?", "project(?: name| title)?"];
  return Math.max(
    ...labels.map((label) => {
      const colon = (
        rawText.match(
          new RegExp(`^[ \\t]*${label}[ \\t]*:[ \\t]*\\S`, "gim"),
        ) || []
      ).length;
      const nextLine = (
        rawText.match(
          new RegExp(
            `^[ \\t]*${label}[ \\t]*\\r?\\n(?:[ \\t]*\\r?\\n){0,2}[ \\t]*\\S`,
            "gim",
          ),
        ) || []
      ).length;
      return colon + nextLine;
    }),
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
    /(?:^|\n)\s*projects?\s*:?(?:\n|$)|(?:^|\n)\s*(?:project|client|customer)\s+(?:experience|history|details|portfolio)\b|(?:^|\n)\s*(?:project|client|customer)\s*:/im,
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

  const validEmploymentRows = Math.max(
    structuredRecordCount(candidate.experience, isValidEmploymentEntry),
    structuredRecordCount(candidate.employment, isValidEmploymentEntry),
    structuredRecordCount(candidate.employment_history, isValidEmploymentEntry),
    structuredRecordCount(candidate.employmentHistory, isValidEmploymentEntry),
  );
  const validProjectRows = Math.max(
    structuredRecordCount(candidate.projects, isValidProjectEntry),
    structuredRecordCount(candidate.project_history, isValidProjectEntry),
    structuredRecordCount(candidate.projectHistory, isValidProjectEntry),
  );
  if (observed.has("employment") && validEmploymentRows === 0)
    extracted.delete("employment");
  if (observed.has("projects") && validProjectRows === 0)
    extracted.delete("projects");

  if (employmentAnchors > 1 && validEmploymentRows < employmentAnchors)
    extracted.delete("employment");

  // Section presence is not enough when the source explicitly enumerates
  // multiple projects. One extracted record must not hide omitted projects.
  if (projectAnchors > 1 && validProjectRows < projectAnchors)
    extracted.delete("projects");

  // Two equally dated assignments with the same named project and role but
  // different clients cannot both be silently treated as a complete parse.
  if (
    conflictingProjectClients(candidate.projects || candidate.project_history)
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
