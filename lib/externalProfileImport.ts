export const EXTERNAL_PROFILE_IMPORT_VERSION =
  "external-profile-import-preview-v1";
export const EXTERNAL_PROFILE_IMPORT_MAX_BYTES = 8 * 1024 * 1024;
export const EXTERNAL_PROFILE_IMPORT_MAX_TEXT_CHARACTERS = 60_000;

export type ExternalProfileImportSourceKind =
  | "candidate_cv"
  | "candidate_provided_linkedin_pdf";

export type ExternalProfileImportSection =
  | "overview"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "skills";

export type ExternalProfileImportPreview = {
  version: typeof EXTERNAL_PROFILE_IMPORT_VERSION;
  candidateId: string;
  source: {
    kind: ExternalProfileImportSourceKind;
    fileName: string;
    importedAt: string;
    providedByCandidate: true;
  };
  sections: Record<ExternalProfileImportSection, string[]>;
  completenessPercent: number;
  extractedSectionCount: number;
  warnings: string[];
};

const sectionMatchers: Array<{
  section: ExternalProfileImportSection;
  expression: RegExp;
}> = [
  {
    section: "overview",
    expression:
      /^(?:about|summary|professional summary|profile|profile summary|career summary)$/i,
  },
  {
    section: "experience",
    expression:
      /^(?:experience|work experience|professional experience|employment history|career history)$/i,
  },
  {
    section: "projects",
    expression:
      /^(?:projects?|project experience|professional projects?|key projects?)$/i,
  },
  {
    section: "education",
    expression:
      /^(?:education|academic background|academic qualifications?|education and qualifications?)$/i,
  },
  {
    section: "certifications",
    expression:
      /^(?:certifications?|licenses?\s*(?:&|and)\s*certifications?|professional certifications?|credentials?)$/i,
  },
  {
    section: "skills",
    expression:
      /^(?:skills?|technical skills?|core skills?|key skills?|skills and expertise|competencies)$/i,
  },
];

function cleanLine(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/\0/g, "")
    .replace(/^[\s•●▪◦·\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingFor(value: string) {
  const normalized = cleanLine(value).replace(/[:：]+$/, "").trim();
  return sectionMatchers.find((item) => item.expression.test(normalized))
    ?.section;
}

function dedupe(values: string[], limit: number) {
  const seen = new Set<string>();
  return values
    .map(cleanLine)
    .filter((value) => {
      if (!value || value.length < 2) return false;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function parseExternalProfileImport(input: {
  candidateId: string;
  text: string;
  fileName: string;
  sourceKind: ExternalProfileImportSourceKind;
  importedAt?: string;
}): ExternalProfileImportPreview {
  const raw = String(input.text || "")
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/\0/g, "")
    .slice(0, EXTERNAL_PROFILE_IMPORT_MAX_TEXT_CHARACTERS);
  const sections: Record<ExternalProfileImportSection, string[]> = {
    overview: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    skills: [],
  };
  let activeSection: ExternalProfileImportSection | null = null;
  let recognizedHeadings = 0;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const heading = headingFor(line);
    if (heading) {
      activeSection = heading;
      recognizedHeadings += 1;
      continue;
    }
    if (activeSection) sections[activeSection].push(line);
  }

  sections.overview = dedupe(sections.overview, 12);
  sections.experience = dedupe(sections.experience, 80);
  sections.projects = dedupe(sections.projects, 60);
  sections.education = dedupe(sections.education, 30);
  sections.certifications = dedupe(sections.certifications, 30);
  sections.skills = dedupe(
    sections.skills.flatMap((value) =>
      value.split(/[,;|]/).map((item) => item.trim()),
    ),
    80,
  );

  const represented = [
    sections.overview.length,
    sections.experience.length,
    sections.projects.length,
    sections.education.length + sections.certifications.length,
    sections.skills.length,
  ].filter(Boolean).length;
  const warnings: string[] = [];
  if (!recognizedHeadings)
    warnings.push(
      "No supported profile section headings were detected; no fields were inferred from unstructured text.",
    );
  if (!sections.experience.length)
    warnings.push("Employment history was not explicitly identified.");
  if (!sections.skills.length)
    warnings.push("Skills were not explicitly identified.");

  return {
    version: EXTERNAL_PROFILE_IMPORT_VERSION,
    candidateId: input.candidateId,
    source: {
      kind: input.sourceKind,
      fileName: input.fileName,
      importedAt: input.importedAt || new Date().toISOString(),
      providedByCandidate: true,
    },
    sections,
    completenessPercent: Math.round((represented / 5) * 100),
    extractedSectionCount: represented,
    warnings,
  };
}
