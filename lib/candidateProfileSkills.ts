import { getSapModuleLabel } from "./sapTalentTaxonomy";

export type CandidateProfileSkillGroup =
  | "SAP modules"
  | "Business processes"
  | "Lifecycle experience"
  | "Tools and technologies"
  | "Languages";

export type CandidateProfileSkillItem = Readonly<{
  key: string;
  value: string;
  group: CandidateProfileSkillGroup;
}>;

type SkillOverview = {
  skills: {
    sapModules: Array<{ value: string }>;
    functional: Array<{ value: string }>;
    technical: Array<{ value: string }>;
    lifecycle: string[];
  };
  languages: Array<{ value: string; proficiency?: string | null }>;
  certifications?: { items: Array<{ value: string }> };
  training?: { items: Array<{ value: string }> };
};

const clean = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const normalizedSkillKey = (value: string) =>
  clean(value)
    .toLocaleLowerCase()
    .replace(/\bsap\b/g, " ")
    .replace(/\bfi\s*[-/]?\s*co\b/g, " fico ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function canonicalCandidateSkillCollection(overview: SkillOverview) {
  const credentialKeys = new Set(
    [
      ...(overview.certifications?.items || []),
      ...(overview.training?.items || []),
    ]
      .map((item) => normalizedSkillKey(item.value))
      .filter(Boolean),
  );
  const candidates: Array<{
    value: string;
    group: CandidateProfileSkillGroup;
  }> = [
    ...(overview.skills.sapModules || []).map((item) => ({
      value: item.value,
      group: "SAP modules" as const,
    })),
    ...(overview.skills.functional || []).map((item) => ({
      value: item.value,
      group: "Business processes" as const,
    })),
    ...(overview.skills.lifecycle || []).map((value) => ({
      value,
      group: "Lifecycle experience" as const,
    })),
    ...(overview.skills.technical || []).map((item) => ({
      value: item.value,
      group: "Tools and technologies" as const,
    })),
    ...(overview.languages || []).map((item) => ({
      value: `${item.value}${item.proficiency ? ` — ${item.proficiency}` : ""}`,
      group: "Languages" as const,
    })),
  ];
  const seen = new Set<string>();
  const items = candidates.flatMap((candidate) => {
    const rawValue = clean(candidate.value);
    const value =
      candidate.group === "SAP modules" && rawValue.includes("_")
        ? getSapModuleLabel(rawValue)
        : rawValue;
    const key = normalizedSkillKey(value);
    if (!value || !key || seen.has(key) || credentialKeys.has(key)) return [];
    seen.add(key);
    return [{ key, value, group: candidate.group }];
  });
  const groups = (
    [
      "SAP modules",
      "Business processes",
      "Lifecycle experience",
      "Tools and technologies",
      "Languages",
    ] as CandidateProfileSkillGroup[]
  ).flatMap((group) => {
    const values = items.filter((item) => item.group === group);
    return values.length ? [{ group, values }] : [];
  });
  return { items, groups, total: items.length };
}

export function relevantCandidateSkills(
  overviewSkills: readonly string[],
  queryRelevant: readonly string[],
) {
  const relevantKeys = new Set(
    queryRelevant.map(normalizedSkillKey).filter(Boolean),
  );
  const canonical = overviewSkills.map((value) => ({
    value,
    key: normalizedSkillKey(value),
  }));
  return canonical
    .filter((item) => relevantKeys.has(item.key))
    .map((item) => item.value);
}
