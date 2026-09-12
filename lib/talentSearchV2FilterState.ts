export type TalentSearchAdvancedFilters = {
  countries: string;
  skills: string;
  sapModules: string;
  languages: string;
};

export const EMPTY_TALENT_SEARCH_ADVANCED_FILTERS: TalentSearchAdvancedFilters = {
  countries: "",
  skills: "",
  sapModules: "",
  languages: "",
};

function normalizedConcepts(values: string[]) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function talentSearchRoleIntentKey(roleConcepts: string[]) {
  const concepts = normalizedConcepts(roleConcepts);
  return concepts.length ? `role:${concepts.join("|")}` : "";
}

export function shouldClearAdvancedFiltersForQueryChange(previousRoleConcepts: string[], nextRoleConcepts: string[]) {
  const previousKey = talentSearchRoleIntentKey(previousRoleConcepts);
  const nextKey = talentSearchRoleIntentKey(nextRoleConcepts);
  return Boolean(previousKey && nextKey && previousKey !== nextKey);
}

export function restoredTalentSearchAdvancedFilters(saved: Record<string, unknown>, restoredRoleConcepts: string[]): TalentSearchAdvancedFilters {
  const restoredIntentKey = talentSearchRoleIntentKey(restoredRoleConcepts);
  if (!restoredIntentKey || saved.advancedFilterIntentKey !== restoredIntentKey) return EMPTY_TALENT_SEARCH_ADVANCED_FILTERS;
  return {
    countries: typeof saved.countries === "string" ? saved.countries : "",
    skills: typeof saved.skills === "string" ? saved.skills : "",
    sapModules: typeof saved.sapModules === "string" ? saved.sapModules : "",
    languages: typeof saved.languages === "string" ? saved.languages : "",
  };
}
