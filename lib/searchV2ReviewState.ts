import type {
  CandidateSearchCriterion,
  CandidateSearchV2Filters,
} from "./candidateSearchV2Types";
import { canonicalLanguage } from "./searchV2RequirementOntology";
import { canonicalSearchConcept } from "./candidateSearchConcepts";

export type FilterSection =
  | "general"
  | "location"
  | "experience"
  | "relevantExperience"
  | "company"
  | "industry"
  | "skills"
  | "delivery"
  | "education"
  | "languages"
  | "certifications"
  | "availability"
  | "authorization"
  | "status"
  | "exclusions";
export type SearchFilterDrafts = Readonly<Record<FilterSection, string>>;
export type FilterValidation = Readonly<{
  valid: boolean;
  errors: Readonly<Record<string, string>>;
  filters: CandidateSearchV2Filters;
}>;
const list = (value: string) =>
  [...new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))];
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export function emptyFilterDrafts(): SearchFilterDrafts {
  return {
    general: "",
    location: "",
    experience: "",
    relevantExperience: "",
    company: "",
    industry: "",
    skills: "",
    delivery: "",
    education: "",
    languages: "",
    certifications: "",
    availability: "",
    authorization: "",
    status: "",
    exclusions: "",
  };
}

export function validateAndCommitFilterDrafts(
  drafts: SearchFilterDrafts,
  current: CandidateSearchV2Filters = {},
): FilterValidation {
  const errors: Record<string, string> = {};
  const languageValues = list(drafts.languages);
  const languageProficiencies: Record<string, string> = {};
  const languages = languageValues.map((value) => {
    const [languageValue, ...proficiencyParts] = value.split(":");
    const canonical = canonicalLanguage(languageValue);
    if (!canonical)
      errors[`language:${value}`] = `Resolve “${value}” to a supported language before searching.`;
    const proficiency = proficiencyParts.join(":").trim();
    if (canonical && proficiency) languageProficiencies[canonical.label] = proficiency;
    return canonical?.label || value;
  });
  const skillValues = list(drafts.skills);
  const modules: string[] = [];
  const skills: string[] = [];
  for (const value of skillValues) {
    const concept = canonicalSearchConcept(value);
    if (concept) modules.push(value);
    else if (value.length >= 2) skills.push(value);
    else errors[`skill:${value}`] = "Enter a complete skill or module.";
  }
  const experience = drafts.experience.match(
    /^\s*(\d{1,2})(?:\s*(?:-|to)\s*(\d{1,2}))?\s*(?:\+\s*)?(?:years?)?\s*$/i,
  );
  if (drafts.experience.trim() && !experience)
    errors.experience = "Use a value such as 5, 5+ years, or 5-10 years.";
  const minimum = experience ? number(experience[1]) : current.minimumTotalYearsExperience;
  const maximum = experience?.[2] ? number(experience[2]) : current.maximumTotalYearsExperience;
  if (minimum !== undefined && maximum !== undefined && minimum > maximum)
    errors.experience = "Minimum experience cannot exceed maximum experience.";
  const relevantExperience = drafts.relevantExperience.match(
    /^\s*(\d{1,2})(?:\s*(?:-|to)\s*(\d{1,2}))?\s*(?:\+\s*)?(?:years?)?\s*$/i,
  );
  if (drafts.relevantExperience.trim() && !relevantExperience)
    errors.relevantExperience = "Use a value such as 3, 3+ years, or 3-7 years.";
  const relevantMinimum = relevantExperience ? number(relevantExperience[1]) : undefined;
  const relevantMaximum = relevantExperience?.[2] ? number(relevantExperience[2]) : undefined;
  if (relevantMinimum !== undefined && relevantMaximum !== undefined && relevantMinimum > relevantMaximum)
    errors.relevantExperience = "Minimum relevant experience cannot exceed maximum relevant experience.";
  const availability = list(drafts.availability);
  const noticeValue = availability.find((value) => /^notice:/i.test(value));
  const salaryValue = availability.find((value) => /^salary:/i.test(value));
  const notice = noticeValue ? number(noticeValue.replace(/^notice:\s*/i, "")) : undefined;
  const salary = salaryValue ? number(salaryValue.replace(/^salary:\s*/i, "").replace(/[^0-9.]/g, "")) : undefined;
  if (noticeValue && notice === undefined) errors.availability = "Notice must be a number of days.";
  if (salaryValue && salary === undefined) errors.availability = "Salary must be a numeric maximum.";
  if (availability.some((value) => !/^(?:notice|salary):/i.test(value)))
    errors.availability = "Prefix values with Notice: or Salary:.";
  const statuses = list(drafts.status);
  if (statuses.some((value) => !/^(?:workflow|quality):/i.test(value)))
    errors.status = "Prefix values with Workflow: or Quality:.";
  const general = list(drafts.general);
  const filters: CandidateSearchV2Filters = {
    ...current,
    candidateNames: general.filter((value) => /^name:/i.test(value)).map((value) => value.replace(/^name:\s*/i, "")),
    currentTitles: general.filter((value) => /^current:/i.test(value)).map((value) => value.replace(/^current:\s*/i, "")),
    professionalRoles: general.filter((value) => /^role:/i.test(value)).map((value) => value.replace(/^role:\s*/i, "")),
    seniorities: general.filter((value) => /^seniority:/i.test(value)).map((value) => value.replace(/^seniority:\s*/i, "")),
    anyTitles: general.filter((value) => !/^(?:name|current|role|seniority):/i.test(value)),
    locations: list(drafts.location),
    currentEmployers: list(drafts.company).filter((value) => /^current:/i.test(value)).map((value) => value.replace(/^current:\s*/i, "")),
    anyEmployers: list(drafts.company).filter((value) => !/^(?:current|exclude):/i.test(value)).map((value) => value.replace(/^any:\s*/i, "")),
    industries: list(drafts.industry).filter((value) => !/^exclude:/i.test(value)),
    skills,
    sapModules: modules,
    deliveryExperience: list(drafts.delivery),
    education: list(drafts.education),
    languages,
    languageProficiencies,
    certifications: list(drafts.certifications),
    workAuthorization: list(drafts.authorization),
    workflowStatuses: statuses.filter((value) => /^workflow:/i.test(value)).map((value) => value.replace(/^workflow:\s*/i, "")),
    qualityStatuses: statuses.filter((value) => /^quality:/i.test(value)).map((value) => value.replace(/^quality:\s*/i, "")),
    exclusions: [
      ...list(drafts.exclusions),
      ...list(drafts.company).filter((value) => /^exclude:/i.test(value)).map((value) => value.replace(/^exclude:\s*/i, "")),
      ...list(drafts.industry).filter((value) => /^exclude:/i.test(value)).map((value) => value.replace(/^exclude:\s*/i, "")),
    ],
    minimumTotalYearsExperience: minimum,
    maximumTotalYearsExperience: maximum,
    minimumRelevantYearsExperience: relevantMinimum,
    maximumRelevantYearsExperience: relevantMaximum,
    maximumNoticePeriodDays: notice,
    maximumExpectedSalary: salary,
  };
  return { valid: !Object.keys(errors).length, errors, filters };
}

export function activeFilterCounts(filters: CandidateSearchV2Filters) {
  const counts: Record<FilterSection, number> = {
    general: (filters.candidateNames?.length || 0) + (filters.currentTitles?.length || 0) + (filters.anyTitles?.length || 0) + (filters.professionalRoles?.length || 0) + (filters.seniorities?.length || 0),
    location: (filters.countries?.length || 0) + (filters.locations?.length || 0),
    experience:
      Number(filters.minimumTotalYearsExperience !== undefined) +
      Number(filters.maximumTotalYearsExperience !== undefined),
    relevantExperience:
      Number(filters.minimumRelevantYearsExperience !== undefined) +
      Number(filters.maximumRelevantYearsExperience !== undefined),
    company: (filters.currentEmployers?.length || 0) + (filters.anyEmployers?.length || 0),
    industry: filters.industries?.length || 0,
    skills: (filters.skills?.length || 0) + (filters.sapModules?.length || 0),
    delivery: filters.deliveryExperience?.length || 0,
    education: filters.education?.length || 0,
    languages: (filters.languages?.length || 0) + Object.keys(filters.languageProficiencies || {}).length,
    certifications: filters.certifications?.length || 0,
    availability:
      Number(filters.maximumNoticePeriodDays !== undefined) +
      Number(filters.maximumExpectedSalary !== undefined),
    authorization: filters.workAuthorization?.length || 0,
    status: (filters.workflowStatuses?.length || 0) + (filters.qualityStatuses?.length || 0),
    exclusions: filters.exclusions?.length || 0,
  };
  return { counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}

export function addCriterion(
  criteria: readonly CandidateSearchCriterion[],
  criterion: CandidateSearchCriterion,
) {
  return [...criteria.filter((item) => item.id !== criterion.id), criterion];
}
export function editCriterion(
  criteria: readonly CandidateSearchCriterion[],
  id: string,
  patch: Partial<Omit<CandidateSearchCriterion, "id">>,
) {
  return criteria.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
export function removeCriterion(criteria: readonly CandidateSearchCriterion[], id: string) {
  return criteria.filter((item) => item.id !== id);
}
export function reorderCriterion(
  criteria: readonly CandidateSearchCriterion[],
  id: string,
  targetIndex: number,
) {
  const next = [...criteria];
  const sourceIndex = next.findIndex((item) => item.id === id);
  if (sourceIndex < 0) return next;
  const [item] = next.splice(sourceIndex, 1);
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, item);
  return next;
}
export function promoteCriterion(
  criteria: readonly CandidateSearchCriterion[],
  id: string,
  filters: CandidateSearchV2Filters,
) {
  const criterion = criteria.find((item) => item.id === id);
  if (!criterion) return { criteria: [...criteria], filters };
  const concept = canonicalSearchConcept(criterion.conceptId || criterion.label);
  const nextFilters = {
    ...filters,
    ...(concept
      ? { sapModules: [...new Set([...(filters.sapModules || []), criterion.conceptId || criterion.label])] }
      : { skills: [...new Set([...(filters.skills || []), criterion.label])] }),
  };
  return { criteria: criteria.filter((item) => item.id !== id), filters: nextFilters };
}
