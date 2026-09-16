import { careerMonthIndex } from "./candidateCareerExperience";
import type { EnterpriseEmployment } from "./candidate360SchemaNormalize";

// Match the raw text aliases accepted by canonical normalization.
export function auditSourceText(row: Record<string, unknown>): string {
  return ["raw_text", "resume_text", "cv_text", "raw_cv"]
    .map((key) => (typeof row[key] === "string" ? row[key] : ""))
    .join("\n");
}

export function auditEmploymentDateComplete(
  job: EnterpriseEmployment,
): boolean {
  const start = careerMonthIndex(job.start);
  const end = careerMonthIndex(job.end, job.current);
  return start !== null && end !== null && start <= end;
}

export function auditEmploymentIncomplete(job: EnterpriseEmployment): boolean {
  return !job.company || !job.title || !auditEmploymentDateComplete(job);
}

export function auditPopulationScope(
  auditedSources: number,
  declaredPopulation: number | null,
  fromInput: boolean,
) {
  return {
    auditedSources,
    declaredPopulation,
    unauditedSources:
      declaredPopulation !== null
        ? Math.max(0, declaredPopulation - auditedSources)
        : null,
    coverage:
      declaredPopulation === null
        ? fromInput
          ? "UNKNOWN_POPULATION"
          : "DATABASE_SCAN"
        : declaredPopulation > auditedSources
          ? "SUBSET_ONLY"
          : declaredPopulation === auditedSources
            ? "DECLARED_POPULATION_LOADED"
            : "INCONSISTENT_EXPORT_METADATA",
  };
}
