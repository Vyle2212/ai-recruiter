import { employmentTimelineDiagnostics } from "./candidate360Employment";
import {
  normalizeActualCandidateSchema,
  type EnterpriseEmployment,
} from "./candidate360SchemaNormalize";

type CandidateRow = Record<string, unknown>;

type ProjectionQueue =
  | "short-or-missing-source"
  | "headed-table-needs-layout-review"
  | "explicit-employer-label-needs-field-review"
  | "near-heading-date-needs-boundary-review"
  | "project-or-client-heavy-needs-employment-evidence"
  | "other-narrative-or-layout-review";

type ChangeClass =
  | "unchanged"
  | "additive-only"
  | "replacement-or-removal"
  | "still-empty";

type AggregateEmploymentDiagnostics = {
  records: number;
  companyComplete: number;
  titleComplete: number;
  dateRangeComplete: number;
  currentEmployerComplete: number;
  malformedNarrativeRecords: number;
  duplicateRecords: number;
  invalidRanges: number;
};

export type ProductionEmploymentProjectionAudit = {
  artifact: "production_employment_projection_audit_v1";
  population: number;
  stored: { sources: number; rows: number };
  projected: { sources: number; rows: number; unresolvedSources: number };
  changeClasses: Record<ChangeClass, number>;
  promotionQueues: {
    emptyToPopulatedReview: number;
    existingAdditiveReview: number;
    existingUnchanged: number;
    existingConflictReview: number;
    emptyStillUnresolved: number;
  };
  promotionRows: {
    emptyToPopulatedAdditions: number;
    existingAdditiveAdditions: number;
    conflictProposedAdditions: number;
    conflictStoredTuplesAtRisk: number;
  };
  tupleComparison: {
    storedTuples: number;
    preservedStoredTuples: number;
    removedOrChangedStoredTuples: number;
    addedProjectedTuples: number;
  };
  unresolvedQueues: Record<ProjectionQueue, number>;
  diagnostics: AggregateEmploymentDiagnostics & {
    possibleClientAsEmployerConflicts: number;
  };
  privacy: {
    candidateIdentifiersSerialized: 0;
    sourceExcerptsSerialized: 0;
    contactFieldsSerialized: 0;
  };
  databaseWrites: 0;
};

const clean = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim()
    : "";

const normalized = (value: unknown) =>
  clean(value)
    .toLowerCase()
    .replace(
      /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|private limited|limited|ltd\.?|inc\.?|corporation|corp\.?)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function storedEmployment(row: CandidateRow): Array<Record<string, unknown>> {
  const parsed = row.parsed_json;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const canonical = (parsed as CandidateRow).canonical_candidate;
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical))
    return [];
  const payload = (canonical as CandidateRow).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return [];
  const employment = (payload as CandidateRow).employmentHistory;
  return Array.isArray(employment)
    ? employment.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

function storedTuple(item: Record<string, unknown>) {
  return [
    normalized(item.company),
    normalized(item.title),
    normalized(item.startDate ?? item.start),
    normalized(item.endDate ?? item.end),
    item.current === true ? "current" : "closed",
  ].join("|");
}

function projectedTuple(item: EnterpriseEmployment) {
  return [
    normalized(item.company),
    normalized(item.title),
    normalized(item.start),
    normalized(item.end),
    item.current ? "current" : "closed",
  ].join("|");
}

function sourceText(row: CandidateRow) {
  return [row.raw_text, row.resume_text, row.raw_cv]
    .map(clean)
    .filter(Boolean)
    .join("\n")
    .split(/\b(?:references|referrals)\b/i, 1)[0];
}

export function productionEmploymentGapQueue(source: string): ProjectionQueue {
  if (source.length < 250) return "short-or-missing-source";
  if (
    /Date\s+Company Name\s+Role|From\s+To\s+Company|Name of Company\s+Scope|Period\s+Position\s+(?:Company|Experience)|Organi[sz]ation\s+Designation|Year\s+Name of Employer/i.test(
      source,
    )
  )
    return "headed-table-needs-layout-review";
  if (/(?:Employer|Company Name|Organi[sz]ation)\s*:/i.test(source))
    return "explicit-employer-label-needs-field-review";
  if (
    /(?:employment history|career history|working experiences?|work experience|professional experience)[\s\S]*?(?:19|20)\d{2}/i.test(
      source,
    )
  )
    return "near-heading-date-needs-boundary-review";
  if (/\b(?:projects?|clients?|customers?)\b/i.test(source))
    return "project-or-client-heavy-needs-employment-evidence";
  return "other-narrative-or-layout-review";
}

const emptyQueues = (): Record<ProjectionQueue, number> => ({
  "short-or-missing-source": 0,
  "headed-table-needs-layout-review": 0,
  "explicit-employer-label-needs-field-review": 0,
  "near-heading-date-needs-boundary-review": 0,
  "project-or-client-heavy-needs-employment-evidence": 0,
  "other-narrative-or-layout-review": 0,
});

const emptyDiagnostics = (): AggregateEmploymentDiagnostics => ({
  records: 0,
  companyComplete: 0,
  titleComplete: 0,
  dateRangeComplete: 0,
  currentEmployerComplete: 0,
  malformedNarrativeRecords: 0,
  duplicateRecords: 0,
  invalidRanges: 0,
});

export function auditProductionEmploymentProjection(
  rows: readonly CandidateRow[],
): ProductionEmploymentProjectionAudit {
  const queues = emptyQueues();
  const changes: Record<ChangeClass, number> = {
    unchanged: 0,
    "additive-only": 0,
    "replacement-or-removal": 0,
    "still-empty": 0,
  };
  const diagnostics = emptyDiagnostics();
  let storedSources = 0;
  let storedRows = 0;
  let projectedSources = 0;
  let projectedRows = 0;
  let preservedStoredTuples = 0;
  let removedOrChangedStoredTuples = 0;
  let addedProjectedTuples = 0;
  let possibleClientAsEmployerConflicts = 0;
  let emptyToPopulatedReview = 0;
  let existingAdditiveReview = 0;
  let existingUnchanged = 0;
  let existingConflictReview = 0;
  let emptyStillUnresolved = 0;
  let emptyToPopulatedAdditions = 0;
  let existingAdditiveAdditions = 0;
  let conflictProposedAdditions = 0;
  let conflictStoredTuplesAtRisk = 0;

  for (const row of rows) {
    const stored = storedEmployment(row);
    const normalizedCandidate = normalizeActualCandidateSchema(row);
    const projected = normalizedCandidate.enterpriseProfile.employmentTimeline;
    storedRows += stored.length;
    projectedRows += projected.length;
    storedSources += Number(stored.length > 0);
    projectedSources += Number(projected.length > 0);

    const storedKeys = new Set(stored.map(storedTuple));
    const projectedKeys = new Set(projected.map(projectedTuple));
    const preserved = [...storedKeys].filter((key) =>
      projectedKeys.has(key),
    ).length;
    const added = [...projectedKeys].filter(
      (key) => !storedKeys.has(key),
    ).length;
    preservedStoredTuples += preserved;
    removedOrChangedStoredTuples += storedKeys.size - preserved;
    addedProjectedTuples += added;

    if (!storedKeys.size && !projectedKeys.size) {
      changes["still-empty"] += 1;
      emptyStillUnresolved += 1;
    } else if (
      storedKeys.size === projectedKeys.size &&
      preserved === storedKeys.size
    ) {
      changes.unchanged += 1;
      existingUnchanged += 1;
    } else if (
      preserved === storedKeys.size &&
      projectedKeys.size > storedKeys.size
    ) {
      changes["additive-only"] += 1;
      if (storedKeys.size) {
        existingAdditiveReview += 1;
        existingAdditiveAdditions += added;
      } else {
        emptyToPopulatedReview += 1;
        emptyToPopulatedAdditions += added;
      }
    } else {
      changes["replacement-or-removal"] += 1;
      existingConflictReview += 1;
      conflictProposedAdditions += added;
      conflictStoredTuplesAtRisk += storedKeys.size - preserved;
    }

    if (!projected.length)
      queues[productionEmploymentGapQueue(sourceText(row))] += 1;

    const result = employmentTimelineDiagnostics(projected);
    diagnostics.records += result.records;
    diagnostics.companyComplete += result.companyComplete;
    diagnostics.titleComplete += result.titleComplete;
    diagnostics.dateRangeComplete += result.dateRangeComplete;
    diagnostics.currentEmployerComplete += Number(
      result.currentEmployerComplete,
    );
    diagnostics.malformedNarrativeRecords += result.malformedNarrativeRecords;
    diagnostics.duplicateRecords += result.duplicateRecords;
    diagnostics.invalidRanges += result.invalidRanges;

    const projects = normalizedCandidate.enterpriseProfile.projects;
    const projectClients = new Set(
      projects.map((project) => normalized(project.client)).filter(Boolean),
    );
    possibleClientAsEmployerConflicts += projected.filter(
      (item) =>
        projectClients.has(normalized(item.company)) &&
        !(item.provenance || []).some((source) =>
          /employment|employer/i.test(
            `${source.sourceRef} ${source.label} ${source.excerpt || ""}`,
          ),
        ),
    ).length;
  }

  return {
    artifact: "production_employment_projection_audit_v1",
    population: rows.length,
    stored: { sources: storedSources, rows: storedRows },
    projected: {
      sources: projectedSources,
      rows: projectedRows,
      unresolvedSources: rows.length - projectedSources,
    },
    changeClasses: changes,
    promotionQueues: {
      emptyToPopulatedReview,
      existingAdditiveReview,
      existingUnchanged,
      existingConflictReview,
      emptyStillUnresolved,
    },
    promotionRows: {
      emptyToPopulatedAdditions,
      existingAdditiveAdditions,
      conflictProposedAdditions,
      conflictStoredTuplesAtRisk,
    },
    tupleComparison: {
      storedTuples: storedRows,
      preservedStoredTuples,
      removedOrChangedStoredTuples,
      addedProjectedTuples,
    },
    unresolvedQueues: queues,
    diagnostics: { ...diagnostics, possibleClientAsEmployerConflicts },
    privacy: {
      candidateIdentifiersSerialized: 0,
      sourceExcerptsSerialized: 0,
      contactFieldsSerialized: 0,
    },
    databaseWrites: 0,
  };
}
