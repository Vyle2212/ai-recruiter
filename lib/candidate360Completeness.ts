export type ProfileSectionState = "normalized" | "source_present_not_normalized" | "missing" | "not_applicable";

export type CompletenessComponent = {
  key: string;
  weight: number;
  state: ProfileSectionState;
};

export type ProfileCompletenessResult = {
  score: number;
  earnedWeight: number;
  applicableWeight: number;
  missingKeys: string[];
  partialKeys: string[];
  components: CompletenessComponent[];
};

/**
 * Canonical profile completeness calculation.
 * normalized = 100% of the component weight; source-only/un-normalized = 50%;
 * missing = 0%; not-applicable components are excluded from the denominator.
 * Commercial candidate-confirmation fields are deliberately not components.
 */
export function calculateProfileCompleteness(components: CompletenessComponent[]): ProfileCompletenessResult {
  const applicable = components.filter((component) => component.state !== "not_applicable" && component.weight > 0);
  const applicableWeight = applicable.reduce((sum, component) => sum + component.weight, 0);
  const earnedWeight = applicable.reduce((sum, component) => {
    if (component.state === "normalized") return sum + component.weight;
    if (component.state === "source_present_not_normalized") return sum + component.weight * 0.5;
    return sum;
  }, 0);
  return {
    score: applicableWeight ? Math.round(earnedWeight / applicableWeight * 100) : 0,
    earnedWeight,
    applicableWeight,
    missingKeys: applicable.filter((component) => component.state === "missing").map((component) => component.key),
    partialKeys: applicable.filter((component) => component.state === "source_present_not_normalized").map((component) => component.key),
    components: components.map((component) => ({ ...component })),
  };
}

export function profileSectionState(normalizedValuePresent: boolean, sourcePresent: boolean, notApplicable = false): ProfileSectionState {
  if (notApplicable) return "not_applicable";
  if (normalizedValuePresent) return "normalized";
  if (sourcePresent) return "source_present_not_normalized";
  return "missing";
}
