import { createClient } from "@supabase/supabase-js";
import Module from "node:module";
import {
  legacyEmploymentTimelineForAudit,
  normalizeActualCandidateSchema,
  extractExplicitResponsibilityProjects,
  type EnterpriseEmployment,
} from "../lib/candidate360SchemaNormalize";
import { employmentTimelineDiagnostics } from "../lib/candidate360Employment";
import {
  canonicalLifecycleEvidence,
  targetModuleDeliveryEvidence,
} from "../lib/searchV2Lifecycle";
import { canonicalTalentSearchIdentity } from "../lib/talentSearchDisplay";

const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key)
  throw new Error("Candidate database configuration unavailable");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clean = (value: unknown) =>
  typeof value === "string" ? value.normalize("NFKC").trim() : "";
const normalized = (value: unknown) =>
  clean(value)
    .toLowerCase()
    .replace(
      /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|limited|ltd\.?|inc\.?|corporation|corp\.?)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const malformed = (item: EnterpriseEmployment) =>
  /professional summary|profile summary|experience of over|covering various roles|career objective/i.test(
    `${item.title} ${item.company}`,
  );
const malformedTitle = (value: unknown) =>
  /^(?:com|www|or position held\b)|https?:\/\/|\b(?:i am|professional summary|profile summary|results-oriented|highly skilled|passionate, dedicated)\b/i.test(
    clean(value),
  );
const suspiciousProject = (project: {
  name?: string;
  client?: string;
  role?: string;
  responsibilities?: string[];
}) =>
  /^(?:profile|professional summary|core skills|technical skills|skills)\b/i.test(
    clean(
      [
        project.name,
        project.client,
        project.role,
        ...(project.responsibilities || []),
      ].join(" "),
    ),
  );
const probableIdentityHeader = (value: unknown) =>
  /(?:^|[.!?]\s+)[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\-]{1,}(?:\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\-]{1,}){1,6}\s+(?:SAP|ERP|Senior|Project)\b[^\n]{0,260}\|[^\n]{1,160}\|/u.test(
    clean(value),
  );
const pipeSeparatedCvHeader = (value: unknown) =>
  /\b(?:SAP\s+Senior\s+Consultant|ERP\s+Solutions?\s+Leader|Project\s+Manager)\b[^\n]{0,180}\|[^\n]{1,180}\|/i.test(
    clean(value),
  );

const month = (value: string, current = false) => {
  if (current || /present|current|now/i.test(value))
    return new Date().getUTCFullYear() * 12 + new Date().getUTCMonth();
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() * 12 + parsed.getUTCMonth();
};

function overlappingRanges(timeline: EnterpriseEmployment[]) {
  const ranges = timeline
    .map((item) => ({
      start: month(item.start),
      end: month(item.end, item.current),
    }))
    .filter(
      (item): item is { start: number; end: number } =>
        item.start !== null && item.end !== null,
    );
  return ranges.some((left, index) =>
    ranges
      .slice(index + 1)
      .some((right) => left.start <= right.end && right.start <= left.end),
  );
}

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db
      .from("candidates")
      .select("*")
      .order("id")
      .range(from, from + 199);
    if (error) throw error;
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < 200) break;
  }
  const totals = {
    profiles: rows.length,
    profilesWithExplicitRawEmploymentEvidence: 0,
    profilesWithCanonicalEmployment: 0,
    headlineOnlyPlaceholdersBefore: 0,
    profilesWithoutGroundedEmploymentAfter: 0,
    records: 0,
    companyComplete: 0,
    titleComplete: 0,
    dateRangeComplete: 0,
    currentEmployerComplete: 0,
    malformedNarrativeRecordsBefore: 0,
    malformedNarrativeRecordsAfter: 0,
    possibleClientAsEmployerConflicts: 0,
    duplicateEmploymentRecords: 0,
    invalidDateRanges: 0,
    profilesWithOverlappingDateRanges: 0,
    malformedTitlesBefore: 0,
    malformedTitlesAfter: 0,
    urlOrDomainTitlesBefore: 0,
    urlOrDomainTitlesAfter: 0,
    profilesWithLabelledWorkingHistory: 0,
    labelledWorkingHistoryStillMissed: 0,
    summariesOrSkillsClassifiedAsProjectsAfter: 0,
    falseDirectFicoAssignmentsAfter: 0,
    canonicalProjects: 0,
    profilesWithCanonicalProjects: 0,
    mergedProjectFragments: 0,
    projectsRecoveredFromExplicitResponsibilityBlocks: 0,
    contactOrEducationLeakageAfter: 0,
    ungroundedParsedPresentRolesAfter: 0,
    probablePersonNameLeakageInResponsibilities: 0,
    pipeSeparatedCvHeadersInResponsibilities: 0,
    embeddedClientBlocksInEmploymentResponsibilities: 0,
    identityContactHeaderFragmentsInScoringEvidence: 0,
  };
  const affectedHeaderLeakageTokens = new Set<string>();
  const unresolvedExceptions: Array<{
    token: string;
    field: string;
    sourceType: string;
    reason: string;
  }> = [];
  const normalizedCoverageBySourceId = new Map<
    string,
    { employment: boolean; projects: boolean }
  >();
  for (const row of rows) {
    const before = legacyEmploymentTimelineForAudit(row);
    if (
      before.length === 1 &&
      before[0].id === "candidate-current-employment" &&
      !before[0].start &&
      !before[0].end
    )
      totals.headlineOnlyPlaceholdersBefore += 1;
    totals.malformedNarrativeRecordsBefore += before.filter(malformed).length;
    const enterprise = normalizeActualCandidateSchema(row).enterpriseProfile;
    normalizedCoverageBySourceId.set(String(row.id || ""), {
      employment: enterprise.employmentTimeline.length > 0,
      projects: enterprise.projects.length > 0,
    });
    const rawTitle = clean(row.current_title || row.title);
    totals.malformedTitlesBefore += Number(malformedTitle(rawTitle));
    totals.urlOrDomainTitlesBefore += Number(
      /^(?:com|www)$/i.test(rawTitle) ||
        /https?:\/\/|www\.|\.(?:com|net|org)\b/i.test(rawTitle),
    );
    totals.malformedTitlesAfter +=
      Number(malformedTitle(enterprise.identity.currentTitle)) +
      enterprise.employmentTimeline.filter((item) => malformedTitle(item.title))
        .length;
    totals.urlOrDomainTitlesAfter +=
      Number(/^(?:com|www)$/i.test(enterprise.identity.currentTitle)) +
      enterprise.employmentTimeline.filter((item) =>
        /^(?:com|www)$/i.test(item.title),
      ).length;
    const rawText = clean(row.raw_text || row.resume_text);
    const labelledWorkingHistory =
      /\bWORKING EXPERIENCE\b[\s\S]*\bCompany Name\s*:/i.test(rawText);
    totals.profilesWithLabelledWorkingHistory += Number(labelledWorkingHistory);
    totals.labelledWorkingHistoryStillMissed += Number(
      labelledWorkingHistory && !enterprise.employmentTimeline.length,
    );
    if (labelledWorkingHistory && !enterprise.employmentTimeline.length)
      unresolvedExceptions.push({
        token: canonicalTalentSearchIdentity(String(row.id || ""))
          .identityToken,
        field: "employmentTimeline",
        sourceType: "raw_text.WORKING EXPERIENCE",
        reason:
          "Labelled working-history text exists, but no employer-role-date boundary passed canonical employment validation.",
      });
    totals.summariesOrSkillsClassifiedAsProjectsAfter +=
      enterprise.projects.filter(suspiciousProject).length;
    totals.canonicalProjects += enterprise.projects.length;
    totals.profilesWithCanonicalProjects += Number(
      enterprise.projects.length > 0,
    );
    totals.mergedProjectFragments += enterprise.projects.reduce(
      (sum, project) =>
        sum + Math.max(0, (project.sourceAssignmentIds?.length || 1) - 1),
      0,
    );
    totals.projectsRecoveredFromExplicitResponsibilityBlocks +=
      extractExplicitResponsibilityProjects([row]).length;
    const employmentAndProjects = JSON.stringify({
      employment: enterprise.employmentTimeline,
      projects: enterprise.projects,
    });
    const hasContactOrEducationLeakage =
      /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|EDUCATION,\s*TRAINING\s*&\s*CERTIFICATIONS)/i.test(
        employmentAndProjects,
      );
    totals.contactOrEducationLeakageAfter += Number(
      hasContactOrEducationLeakage,
    );
    if (hasContactOrEducationLeakage)
      unresolvedExceptions.push({
        token: canonicalTalentSearchIdentity(String(row.id || ""))
          .identityToken,
        field: "employmentOrProjects",
        sourceType: "normalized candidate profile",
        reason:
          "A contact or education section marker remains in a canonical employment/project record.",
      });
    totals.ungroundedParsedPresentRolesAfter +=
      enterprise.employmentTimeline.filter(
        (item) =>
          item.current &&
          (item.provenance || []).some(
            (source) => source.sourceType === "parsed_resume",
          ) &&
          !/\b(?:present|current|to date)\b/i.test(item.end || ""),
      ).length;
    const employmentResponsibilities = enterprise.employmentTimeline.flatMap(
      (item) => item.responsibilities || item.achievements || [],
    );
    const allResponsibilities = [
      ...employmentResponsibilities,
      ...enterprise.projects.flatMap((item) => item.responsibilities),
    ];
    const personLeakage = allResponsibilities.filter(
      probableIdentityHeader,
    ).length;
    const pipeLeakage = allResponsibilities.filter(
      pipeSeparatedCvHeader,
    ).length;
    const clientEmploymentLeakage = employmentResponsibilities.filter((item) =>
      /\bClient\s*:/i.test(item),
    ).length;
    totals.probablePersonNameLeakageInResponsibilities += personLeakage;
    totals.pipeSeparatedCvHeadersInResponsibilities += pipeLeakage;
    totals.embeddedClientBlocksInEmploymentResponsibilities +=
      clientEmploymentLeakage;
    if (personLeakage || pipeLeakage || clientEmploymentLeakage)
      affectedHeaderLeakageTokens.add(
        canonicalTalentSearchIdentity(String(row.id || "")).identityToken,
      );
    const fico = targetModuleDeliveryEvidence(
      {
        lifecycleEvidence: canonicalLifecycleEvidence(
          String(row.id || "candidate"),
          enterprise.projects,
        ),
      },
      "FICO",
    );
    const scoringEvidence = canonicalLifecycleEvidence(
      String(row.id || "candidate"),
      enterprise.projects,
    ).map((item) => item.excerpt);
    totals.identityContactHeaderFragmentsInScoringEvidence +=
      scoringEvidence.filter(
        (item) =>
          probableIdentityHeader(item) ||
          pipeSeparatedCvHeader(item) ||
          /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d))/i.test(
            item,
          ),
      ).length;
    totals.falseDirectFicoAssignmentsAfter +=
      fico.directTargetAssignments.filter((assignment) =>
        /^(?:profile|professional summary|core skills|technical skills|skills)\b/i.test(
          clean(assignment.evidence.excerpt),
        ),
      ).length;
    const timeline = enterprise.employmentTimeline;
    if (
      timeline.some((item) =>
        (item.provenance || []).some(
          (source) =>
            source.sourceType === "employment" ||
            source.sourceType === "parsed_resume",
        ),
      )
    )
      totals.profilesWithExplicitRawEmploymentEvidence += 1;
    if (timeline.length) totals.profilesWithCanonicalEmployment += 1;
    else totals.profilesWithoutGroundedEmploymentAfter += 1;
    const diagnostic = employmentTimelineDiagnostics(timeline);
    totals.records += diagnostic.records;
    totals.companyComplete += diagnostic.companyComplete;
    totals.titleComplete += diagnostic.titleComplete;
    totals.dateRangeComplete += diagnostic.dateRangeComplete;
    totals.currentEmployerComplete += Number(
      diagnostic.currentEmployerComplete,
    );
    totals.malformedNarrativeRecordsAfter +=
      diagnostic.malformedNarrativeRecords;
    totals.duplicateEmploymentRecords += diagnostic.duplicateRecords;
    totals.invalidDateRanges += diagnostic.invalidRanges;
    totals.profilesWithOverlappingDateRanges += Number(
      overlappingRanges(timeline),
    );
    const projectClients = new Set(
      enterprise.projects
        .map((project) => normalized(project.client))
        .filter(Boolean),
    );
    totals.possibleClientAsEmployerConflicts += timeline.filter(
      (item) =>
        projectClients.has(normalized(item.company)) &&
        !(item.provenance || []).some((source) =>
          /employment|employer/i.test(
            `${source.sourceRef} ${source.label} ${source.excerpt}`,
          ),
        ),
    ).length;
  }
  const percent = (value: number, denominator: number) =>
    denominator ? Math.round((value / denominator) * 1000) / 10 : 0;
  const [{ fetchCandidateSource }, { dedupeCandidateSearchV2Documents }] =
    await Promise.all([
      import("../lib/searchV2Dataset"),
      import("../lib/candidateSearchV2Projection"),
    ]);
  const indexed = await fetchCandidateSource();
  const canonical = dedupeCandidateSearchV2Documents(
    indexed.documents,
  ).documents;
  const coverage = (documents: typeof indexed.documents) => {
    const evidenceFor = (item: (typeof documents)[number]) =>
      (item.sourceCandidateIds || [item.candidateId])
        .map((id) => normalizedCoverageBySourceId.get(id))
        .filter((value): value is { employment: boolean; projects: boolean } =>
          Boolean(value),
        );
    const withEmployment = documents.filter((item) =>
      evidenceFor(item).some((value) => value.employment),
    ).length;
    const withProjects = documents.filter((item) =>
      evidenceFor(item).some((value) => value.projects),
    ).length;
    return {
      denominator: documents.length,
      employment: {
        with: withEmployment,
        without: documents.length - withEmployment,
      },
      projects: {
        with: withProjects,
        without: documents.length - withProjects,
      },
    };
  };
  console.log(
    JSON.stringify(
      {
        ...totals,
        coverageByPopulation: {
          rawRows: {
            denominator: rows.length,
            employment: {
              with: totals.profilesWithCanonicalEmployment,
              without: totals.profilesWithoutGroundedEmploymentAfter,
            },
            projects: {
              with: totals.profilesWithCanonicalProjects,
              without: rows.length - totals.profilesWithCanonicalProjects,
            },
          },
          indexedRows: coverage(indexed.documents),
          canonicalPeople: coverage(canonical),
        },
        companyCompletenessPercent: percent(
          totals.companyComplete,
          totals.records,
        ),
        titleCompletenessPercent: percent(totals.titleComplete, totals.records),
        dateRangeCompletenessPercent: percent(
          totals.dateRangeComplete,
          totals.records,
        ),
        currentEmployerCompletenessPercent: percent(
          totals.currentEmployerComplete,
          totals.profiles,
        ),
        privacy: {
          candidateIdentitiesSerialized: 0,
          sourceExcerptsSerialized: 0,
        },
        affectedHeaderLeakageTokens: [...affectedHeaderLeakageTokens].sort(),
        unresolvedExceptions,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Employment audit failed",
  );
  process.exitCode = 1;
});
