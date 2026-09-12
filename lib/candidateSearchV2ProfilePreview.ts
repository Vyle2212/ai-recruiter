import type { CanonicalProfileOverview } from "./candidateProfileOverview";
import { canonicalCandidateSkillCollection } from "./candidateProfileSkills";
import type { CandidateSearchV2ProfilePreview } from "./candidateSearchV2Types";

export const SEARCH_V2_PROFILE_PREVIEW_VERSION =
  "search-v2-profile-preview-v4-project-identity";

const clean = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const skillKey = (value: string) => {
  const normalized = clean(value)
    .toLocaleLowerCase()
    .replace(/\bsap\b/g, " ")
    .replace(/\bfi\s*[-/]?\s*co\b/g, " fico ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized || clean(value).toLocaleLowerCase();
};

export function dedupeCandidatePreviewSkills(values: readonly string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const display = clean(value);
    const key = skillKey(display);
    if (!display || !key || seen.has(key)) return [];
    seen.add(key);
    return [display];
  });
}

export function buildCandidateSearchV2ProfilePreview(
  overview: CanonicalProfileOverview,
): CandidateSearchV2ProfilePreview {
  const canonicalSkills = canonicalCandidateSkillCollection(overview);
  const employmentView = (
    item: CanonicalProfileOverview["employmentHighlights"][number],
  ) => ({
    id: item.id,
    title: item.title,
    employer: item.employer,
    start: item.start,
    end: item.end,
    current: item.current,
  });
  return {
    employmentCount: overview.career.employmentCount,
    projectCount: overview.career.projectCount,
    educationCount: overview.education.count,
    certificationCount: overview.certifications.count,
    trainingCount: overview.training.count,
    skillCount: canonicalSkills.total,
    currentEmployment: overview.career.currentEmployment
      ? employmentView(overview.career.currentEmployment)
      : null,
    latestEmployment: overview.career.latestEmployment
      ? employmentView(overview.career.latestEmployment)
      : null,
    employment: overview.employmentHighlights.slice(0, 3).map(employmentView),
    projects: overview.projectHighlights.slice(0, 2).map((item) => ({
      id: item.id,
      name: item.name,
      client: item.client,
      role: item.role,
      start: item.start,
      end: item.end,
      lifecycle: item.lifecycle,
      modules: item.modules,
    })),
    education: overview.education.highestOrLatest
      ? {
          qualification: overview.education.highestOrLatest.qualification,
          fieldOfStudy: overview.education.highestOrLatest.fieldOfStudy,
          institution: overview.education.highestOrLatest.institution,
        }
      : null,
    certifications: overview.certifications.items.map((item) => item.value),
    training: overview.training.items.map((item) => item.value),
    skills: canonicalSkills.items.map((item) => item.value),
  };
}

export function orderedCandidatePreviewSkills(
  preview: CandidateSearchV2ProfilePreview | undefined,
  queryRelevant: readonly string[] = [],
  fallback: readonly string[] = [],
) {
  // A populated profile preview is the canonical presentation projection. The
  // fallback exists only for older/external response contracts; merging it into
  // an Internal preview reintroduced project-only module mentions as skills.
  const canonical = dedupeCandidatePreviewSkills(
    preview ? preview.skills : fallback,
  );
  const relevantKeys = new Set(
    dedupeCandidatePreviewSkills(queryRelevant).map(skillKey),
  );
  return [
    ...canonical.filter((value) => relevantKeys.has(skillKey(value))),
    ...canonical.filter((value) => !relevantKeys.has(skillKey(value))),
  ];
}

export type CandidateMatchPreviewItem = Readonly<{
  id: string;
  label: string;
  state: "met" | "partly_supported" | "not_found";
  explanation: string;
}>;

type PreviewRequirement = {
  id: string;
  label: string;
  kind?: string;
  state: string;
  reason?: string;
};

type PreviewCriterion = {
  id: string;
  label: string;
  state: string;
  score: number;
  reason?: string;
  assignmentEvidence?: {
    directTargetAssignments: number;
    directTargetLifecycleAssignments?: number;
    requestedLifecycleTypes?: readonly string[];
  };
};

const shortMatchExplanation = (item: PreviewRequirement) => {
  const met = item.state === "verified" || item.state === "supported";
  if (!met) {
    if (["related", "manual_review"].includes(item.state))
      return "Related information was found, but the profile does not fully support this criterion.";
    return "Supporting information was not found in the profile.";
  }
  const reason = clean(item.reason);
  if (/confirmed in current title/i.test(reason)) return reason.slice(0, 140);
  if (item.kind === "location")
    return "The profile location supports this criterion.";
  if (item.kind === "professional_role")
    return "Supported by an employment or assignment role in the profile.";
  if (item.kind === "lifecycle")
    return "Supported by relevant delivery work in the project history.";
  if (["target", "skill", "sap_module"].includes(item.kind || ""))
    return "Supported by skills or professional experience in the profile.";
  return (
    clean(item.reason).slice(0, 140) ||
    "Supported by information in the candidate profile."
  );
};

export function buildCandidateMatchPreview(
  requirements: readonly PreviewRequirement[] = [],
  criteria: readonly PreviewCriterion[] = [],
  limit = 5,
): CandidateMatchPreviewItem[] {
  const requirementItems = requirements.map((item) => ({
    id: `requirement:${item.id}`,
    label: clean(item.label).replace(/\s*[·-]\s*Required$/i, ""),
    state: (item.state === "verified" || item.state === "supported"
      ? "met"
      : ["related", "manual_review"].includes(item.state)
        ? "partly_supported"
        : "not_found") as CandidateMatchPreviewItem["state"],
    explanation: shortMatchExplanation(item),
  }));
  const criterionItems = criteria.map((item) => {
    const lifecycleCount =
      item.assignmentEvidence?.directTargetLifecycleAssignments;
    const directCount =
      lifecycleCount ?? item.assignmentEvidence?.directTargetAssignments ?? 0;
    const explanation =
      directCount > 0
        ? `Supported by ${directCount} relevant delivery assignment${directCount === 1 ? "" : "s"}.`
        : item.score > 0
          ? "Some relevant evidence was found, but depth is limited."
          : "Supporting information was not found in the profile.";
    return {
      id: `criterion:${item.id}`,
      label: clean(item.label),
      state: (item.state === "verified" || item.state === "supported"
        ? "met"
        : item.score > 0
          ? "partly_supported"
          : "not_found") as CandidateMatchPreviewItem["state"],
      explanation,
    };
  });
  return [...requirementItems, ...criterionItems]
    .filter((item) => item.label)
    .slice(0, Math.max(0, limit));
}
