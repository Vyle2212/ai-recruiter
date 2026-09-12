import type { Candidate360Profile } from "./candidate360Types";

export type CandidateProject =
  Candidate360Profile["enterpriseProfile"]["projects"][number];
export type ProjectSortMode = "evidence" | "newest" | "relevant" | "complexity";
export type ProjectComplexityAssessment = {
  value: "High" | "Moderate" | null;
  evidenceState: "derived" | "missing";
  rationale: string;
};
export type ProjectEvidenceStrength = "Strong" | "Moderate" | "Limited";
export type ResponsibilityEvidenceState = "none" | "summary" | "detailed";
export type ProjectEvidenceAssessment = {
  strength: ProjectEvidenceStrength;
  score: number;
  supportedDimensions: string[];
  missingDimensions: string[];
  explanation: string;
  responsibilityState: ResponsibilityEvidenceState;
  responsibilityLimitation: string;
};

type IndexedProject = { project: CandidateProject; index: number };
type EvidenceField = keyof CandidateProject["fieldEvidence"];

const clean = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase();
const supportedStates = new Set(["verified", "source_extracted", "derived"]);

function supportedField(
  project: CandidateProject,
  field: EvidenceField,
): boolean {
  const evidence = project.fieldEvidence[field];
  return Boolean(
    evidence &&
    evidence.value !== null &&
    supportedStates.has(evidence.evidenceState),
  );
}

function stableProjectKey(project: CandidateProject): string {
  return clean(
    [project.id, project.name, project.client, project.role].join("|"),
  );
}

function supportedDateRank(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (/present|current|now/i.test(text)) {
    const now = new Date();
    return now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
  }
  const year = Number(text.match(/(?:19|20)\d{2}/)?.[0] || 0);
  if (!year) return null;
  const numericMonth = Number(
    text.match(/(?:19|20)\d{2}[-/]((?:0?[1-9])|(?:1[0-2]))/)?.[1] || 0,
  );
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const namedMonth = text
    .toLocaleLowerCase()
    .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)?.[1];
  const month =
    numericMonth || (namedMonth ? monthNames.indexOf(namedMonth) + 1 : 0);
  return year * 100 + month;
}

export function assessResponsibilityEvidence(project: CandidateProject): {
  state: ResponsibilityEvidenceState;
  limitation: string;
} {
  const items = project.responsibilities
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length)
    return { state: "none", limitation: "Responsibilities not recorded." };
  const hasDetailedNarrative = items.some((item) => {
    const words = item.split(/\s+/).length;
    return (
      words >= 8 ||
      (words >= 5 &&
        /\b(?:owned|designed|resolved|led|delivered|outcome|result|impact|scope)\b/i.test(
          item,
        ))
    );
  });
  if (!hasDetailedNarrative)
    return {
      state: "summary",
      limitation:
        "Responsibility evidence is present at summary level, but individual ownership, scope, complexity and outcomes are not sufficiently documented.",
    };
  return {
    state: "detailed",
    limitation: "Detailed responsibility evidence is available.",
  };
}
export function assessProjectEvidence(
  project: CandidateProject,
): ProjectEvidenceAssessment {
  const responsibilityEvidence = assessResponsibilityEvidence(project);
  const dimensions = [
    [
      "project/client",
      supportedField(project, "name") || supportedField(project, "client"),
    ],
    [
      "project dates",
      supportedField(project, "dates") &&
        supportedDateRank(project.start) !== null &&
        supportedDateRank(project.end) !== null,
    ],
    ["role", supportedField(project, "role")],
    ["modules", supportedField(project, "modules")],
    [
      "delivery type",
      supportedField(project, "projectType") ||
        supportedField(project, "implementationType"),
    ],
    [
      "responsibilities/deliverables",
      supportedField(project, "responsibilities"),
    ],
    ["industry", supportedField(project, "industry")],
  ] as const;
  const supportedDimensions: string[] = dimensions
    .filter(([, supported]) => supported)
    .map(([label]) => label);
  const missingDimensions: string[] = dimensions
    .filter(([, supported]) => !supported)
    .map(([label]) => label);
  const provenanceAvailable = Object.values(project.fieldEvidence).some(
    (field) =>
      field?.provenance.some((item) =>
        Boolean(item.sourceRef || item.fieldPath),
      ),
  );
  if (provenanceAvailable)
    supportedDimensions.push("traceable source evidence");
  else missingDimensions.push("traceable source evidence");

  const coreDeliverySignals = [
    supportedField(project, "role"),
    supportedField(project, "modules"),
    supportedField(project, "projectType") ||
      supportedField(project, "implementationType"),
  ].filter(Boolean).length;
  const hasDepthSignal =
    supportedField(project, "dates") ||
    supportedField(project, "responsibilities");
  const verifiedBonus =
    project.evidenceState === "verified"
      ? 15
      : project.evidenceState === "source_extracted"
        ? 8
        : 0;
  const score = supportedDimensions.length * 10 + verifiedBonus;
  const strength: ProjectEvidenceStrength =
    provenanceAvailable &&
    coreDeliverySignals === 3 &&
    hasDepthSignal &&
    responsibilityEvidence.state === "detailed" &&
    supportedDimensions.length >= 6
      ? "Strong"
      : provenanceAvailable && supportedDimensions.length >= 4
        ? "Moderate"
        : "Limited";
  const explanation = supportedDimensions.length
    ? `${strength} evidence — supported by ${supportedDimensions.join(", ")}. ${responsibilityEvidence.state === "detailed" ? "Detailed responsibility evidence is available." : responsibilityEvidence.limitation}`
    : `Limited evidence — no traceable structured project dimensions are available. ${responsibilityEvidence.limitation}`;
  return {
    strength,
    score,
    supportedDimensions,
    missingDimensions,
    explanation,
    responsibilityState: responsibilityEvidence.state,
    responsibilityLimitation: responsibilityEvidence.limitation,
  };
}

export function assessProjectComplexity(
  project: CandidateProject,
): ProjectComplexityAssessment {
  const signals = [
    supportedField(project, "teamSize") &&
    project.teamSize !== null &&
    project.teamSize >= 10
      ? "team size of " + project.teamSize
      : "",
    supportedField(project, "modules") && project.modules.length >= 3
      ? project.modules.length + " SAP modules"
      : "",
    supportedField(project, "responsibilities") &&
    project.responsibilities.length >= 4
      ? project.responsibilities.length + " evidenced responsibilities"
      : "",
    supportedField(project, "environment") &&
    /s\/?4\s*hana|public cloud|private cloud/i.test(project.environment)
      ? project.environment
      : "",
    (supportedField(project, "projectType") ||
      supportedField(project, "implementationType")) &&
    /greenfield|migration|transformation/i.test(
      project.projectType + " " + project.implementationType,
    )
      ? project.implementationType || project.projectType
      : "",
  ].filter(Boolean);
  if (signals.length < 3)
    return {
      value: null,
      evidenceState: "missing",
      rationale: "Insufficient supported project signals.",
    };
  return {
    value:
      signals.length >= 4 ||
      (supportedField(project, "teamSize") &&
        project.teamSize !== null &&
        project.teamSize >= 20)
        ? "High"
        : "Moderate",
    evidenceState: "derived",
    rationale: "Based on " + signals.slice(0, 3).join(", ") + ".",
  };
}

export function projectEvidenceRank(project: CandidateProject): number {
  return assessProjectEvidence(project).score;
}

export function structuredJobProjectTerms(
  job: Record<string, unknown> | null,
): string[] {
  if (!job) return [];
  const aliases = [
    "must_have_skills",
    "mustHaveSkills",
    "nice_to_have_skills",
    "niceToHaveSkills",
    "required_modules",
    "requiredModules",
    "modules",
    "required_industries",
    "requiredIndustries",
    "industries",
    "required_languages",
    "requiredLanguages",
    "location",
    "country",
  ];
  const values: string[] = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(add);
      return;
    }
    String(value ?? "")
      .split(/[,;|\n]/)
      .map(clean)
      .filter(Boolean)
      .forEach((item) => values.push(item));
  };
  aliases.forEach((alias) => add(job[alias]));
  return [...new Set(values)];
}

export function projectRelevanceRank(
  project: CandidateProject,
  terms: string[],
): number {
  if (!terms.length) return 0;
  const supportedValues = [
    supportedField(project, "name") ? project.name : "",
    supportedField(project, "client") ? project.client : "",
    supportedField(project, "role") ? project.role : "",
    supportedField(project, "industry") ? project.industry : "",
    supportedField(project, "country") ? project.country : "",
    supportedField(project, "environment") ? project.environment : "",
    supportedField(project, "projectType") ? project.projectType : "",
    supportedField(project, "implementationType")
      ? project.implementationType
      : "",
    ...(supportedField(project, "modules") ? project.modules : []),
    ...(supportedField(project, "responsibilities")
      ? project.responsibilities
      : []),
  ];
  const evidence = clean(supportedValues.join(" "));
  return terms.reduce(
    (score, term) => score + (evidence.includes(term) ? 1 : 0),
    0,
  );
}

export function canSortProjectComplexity(
  projects: CandidateProject[],
): boolean {
  return (
    projects.length > 0 &&
    projects.every((project) => assessProjectComplexity(project).value !== null)
  );
}

export function sortCandidateProjects(
  projects: CandidateProject[],
  mode: ProjectSortMode,
  job: Record<string, unknown> | null = null,
): CandidateProject[] {
  const terms = structuredJobProjectTerms(job);
  const indexed: IndexedProject[] = projects.map((project, index) => ({
    project,
    index,
  }));
  const compareStable = (left: IndexedProject, right: IndexedProject) =>
    stableProjectKey(left.project).localeCompare(
      stableProjectKey(right.project),
    ) || left.index - right.index;
  const compare = (left: IndexedProject, right: IndexedProject) => {
    let delta = 0;
    if (mode === "evidence")
      delta =
        projectEvidenceRank(right.project) - projectEvidenceRank(left.project);
    if (mode === "newest") {
      const rightEnd = supportedField(right.project, "dates")
        ? supportedDateRank(right.project.end)
        : null;
      const leftEnd = supportedField(left.project, "dates")
        ? supportedDateRank(left.project.end)
        : null;
      delta =
        (rightEnd ?? Number.NEGATIVE_INFINITY) -
        (leftEnd ?? Number.NEGATIVE_INFINITY);
      if (!delta) {
        const rightStart = supportedField(right.project, "dates")
          ? supportedDateRank(right.project.start)
          : null;
        const leftStart = supportedField(left.project, "dates")
          ? supportedDateRank(left.project.start)
          : null;
        delta =
          (rightStart ?? Number.NEGATIVE_INFINITY) -
          (leftStart ?? Number.NEGATIVE_INFINITY);
      }
    }
    if (mode === "relevant" && terms.length)
      delta =
        projectRelevanceRank(right.project, terms) -
        projectRelevanceRank(left.project, terms);
    if (mode === "complexity") {
      const rank = (project: CandidateProject) =>
        assessProjectComplexity(project).value === "High"
          ? 2
          : assessProjectComplexity(project).value === "Moderate"
            ? 1
            : 0;
      delta = rank(right.project) - rank(left.project);
    }
    if (!delta && mode !== "evidence")
      delta =
        projectEvidenceRank(right.project) - projectEvidenceRank(left.project);
    return delta || compareStable(left, right);
  };
  return indexed.sort(compare).map((item) => item.project);
}

export function projectEvidenceStrength(
  project: CandidateProject,
): ProjectEvidenceStrength {
  return assessProjectEvidence(project).strength;
}

export type AggregateProjectClaim = "implementation" | "ams" | "rollout";
export function supportingProjectsForClaim(
  projects: CandidateProject[],
  claim: AggregateProjectClaim,
): CandidateProject[] {
  const pattern =
    claim === "implementation"
      ? /implementation|greenfield|brownfield|full[ -]?cycle|end[ -]?to[ -]?end/i
      : claim === "ams"
        ? /\bams\b|application management/i
        : /rollout|roll-out/i;
  return projects.filter((project) =>
    pattern.test(
      [
        project.name,
        project.projectType,
        project.implementationType,
        project.role,
        ...project.responsibilities,
      ].join(" "),
    ),
  );
}
