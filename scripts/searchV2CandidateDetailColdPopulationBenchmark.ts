import Module from "node:module";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";

type TimingRecord = {
  token: string;
  candidateId: string;
  sourceRows: number;
  sourceBytes: number;
  employmentCount: number;
  projectCount: number;
  educationCount: number;
  skillCount: number;
  stages: Record<string, number>;
  beforeTotalMs: number;
  totalMs: number;
};

const percentile = (values: number[], ratio: number) =>
  values[
    Math.min(
      values.length - 1,
      Math.max(0, Math.ceil(values.length * ratio) - 1),
    )
  ];
const rounded = (value: number) => Number(value.toFixed(2));
const correlation = (
  values: TimingRecord[],
  select: (value: TimingRecord) => number,
) => {
  const count = values.length;
  const xMean = values.reduce((sum, value) => sum + select(value), 0) / count;
  const yMean = values.reduce((sum, value) => sum + value.totalMs, 0) / count;
  let numerator = 0;
  let xSquared = 0;
  let ySquared = 0;
  for (const value of values) {
    const xDelta = select(value) - xMean;
    const yDelta = value.totalMs - yMean;
    numerator += xDelta * yDelta;
    xSquared += xDelta * xDelta;
    ySquared += yDelta * yDelta;
  }
  return rounded(
    xSquared && ySquared ? numerator / Math.sqrt(xSquared * ySquared) : 0,
  );
};

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };

  const [
    { createCandidateSupabaseAdminClient },
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { normalizeActualCandidateSchemaWithTimings },
    { buildCandidate360Profile },
    { buildCanonicalProfileOverview },
    { canonicalCandidateSkillCollection },
    { canonicalTalentSearchIdentity },
  ] = await Promise.all([
    import("../lib/candidateSupabase"),
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidate360SchemaNormalize"),
    import("../lib/candidate360Profile"),
    import("../lib/candidateProfileOverview"),
    import("../lib/candidateProfileSkills"),
    import("../lib/talentSearchDisplay"),
  ]);

  const dataset = await fetchCandidateSource();
  const canonical = dedupeCandidateSearchV2Documents(
    dataset.documents,
  ).documents;
  const sourceIds = [
    ...new Set(canonical.flatMap((item) => item.sourceCandidateIds)),
  ];
  const supabase = createCandidateSupabaseAdminClient();
  const retrievalStarted = performance.now();
  const rows: Array<Record<string, unknown>> = [];
  for (let index = 0; index < sourceIds.length; index += 200) {
    const response = await supabase
      .from("candidates")
      .select("*")
      .in("id", sourceIds.slice(index, index + 200));
    if (response.error) throw new Error(response.error.message);
    rows.push(...((response.data || []) as Array<Record<string, unknown>>));
  }
  const sourceRetrievalMs = performance.now() - retrievalStarted;
  const rowsById = new Map(rows.map((row) => [String(row.id), row]));
  const measurements: TimingRecord[] = [];
  const supportArtifactPaths = [
    "recruiter-workflow-state.json",
    "repair-queue-audit.json",
    "ai-extraction-approvals.json",
    "quick-fix-apply-decisions.json",
    fs.existsSync(path.join("reports", "candidate-apply-history.json"))
      ? "candidate-apply-history.json"
      : "quick-fix-post-apply-verification.json",
  ].map((file) => path.join("reports", file));
  const readSupportArtifacts = () =>
    supportArtifactPaths.map((file) =>
      JSON.parse(fs.readFileSync(file, "utf8")),
    );
  const sharedSupportArtifacts = readSupportArtifacts();

  for (const document of canonical) {
    const lookupStarted = performance.now();
    const sourceRows = document.sourceCandidateIds.flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    });
    const sourceLookupMs = performance.now() - lookupStarted;
    const raw = Object.assign({}, ...sourceRows) as Record<string, unknown>;
    const sourceBytes = Buffer.byteLength(JSON.stringify(raw), "utf8");

    const normalized = normalizeActualCandidateSchemaWithTimings(raw);
    const legacySupportStarted = performance.now();
    const legacySupportArtifacts = readSupportArtifacts();
    const legacySupportArtifactMs = performance.now() - legacySupportStarted;
    const legacyProfileStarted = performance.now();
    const legacyProfile = buildCandidate360Profile(
      { ...raw, ...normalized.projection },
      {},
      legacySupportArtifacts[2],
      legacySupportArtifacts[3],
      legacySupportArtifacts[4],
    );
    const legacyProfileConstructionMs =
      performance.now() - legacyProfileStarted;
    const legacyOverviewStarted = performance.now();
    const legacyOverview = buildCanonicalProfileOverview(legacyProfile);
    const legacyOverviewGenerationMs =
      performance.now() - legacyOverviewStarted;
    const legacySerializationStarted = performance.now();
    JSON.stringify({ profile: legacyProfile, overview: legacyOverview });
    const legacySerializationMs =
      performance.now() - legacySerializationStarted;

    const profileStarted = performance.now();
    const profile = buildCandidate360Profile(
      { ...raw, ...normalized.projection },
      {},
      sharedSupportArtifacts[2],
      sharedSupportArtifacts[3],
      sharedSupportArtifacts[4],
    );
    const profileConstructionMs = performance.now() - profileStarted;
    const overviewStarted = performance.now();
    const overview = buildCanonicalProfileOverview(profile);
    const overviewGenerationMs = performance.now() - overviewStarted;
    const skillStarted = performance.now();
    const skillCount = canonicalCandidateSkillCollection(overview).total;
    const skillProjectionMs = performance.now() - skillStarted;
    const serializationStarted = performance.now();
    JSON.stringify({ profile, overview });
    const responseSerializationMs = performance.now() - serializationStarted;

    measurements.push({
      token: canonicalTalentSearchIdentity(document.candidateId).identityToken,
      candidateId: document.candidateId,
      sourceRows: sourceRows.length,
      sourceBytes,
      employmentCount:
        profile.enterpriseProfile?.employmentTimeline.length || 0,
      projectCount: profile.enterpriseProfile?.projects.length || 0,
      educationCount:
        (profile.enterpriseProfile?.education.length || 0) +
        (profile.enterpriseProfile?.certifications.length || 0),
      skillCount,
      stages: {
        cacheLookupMs: 0,
        sourceRowLookupMs: sourceLookupMs,
        identityResolutionMs: normalized.timings.identityResolutionMs,
        canonicalEmploymentMs: normalized.timings.employmentMs,
        canonicalProjectsMs: normalized.timings.projectConstructionMs,
        projectLinkingMs: normalized.timings.projectLinkingMs,
        educationAndSkillsMs: normalized.timings.educationAndSkillsMs,
        remainingNormalizationMs:
          normalized.timings.sourceScopesMs +
          normalized.timings.remainingProjectionMs,
        legacySupportArtifactMs,
        profileConstructionMs,
        overviewGenerationMs,
        scoringEvidenceProjectionMs: 0,
        skillProjectionMs,
        responseSerializationMs,
        cachePopulationMs: 0,
      },
      beforeTotalMs:
        normalized.timings.totalMs +
        legacySupportArtifactMs +
        legacyProfileConstructionMs +
        legacyOverviewGenerationMs +
        legacySerializationMs,
      totalMs:
        normalized.timings.totalMs +
        sourceLookupMs +
        profileConstructionMs +
        overviewGenerationMs +
        skillProjectionMs +
        responseSerializationMs,
    });
  }

  const sorted = measurements.map((item) => item.totalMs).sort((a, b) => a - b);
  const beforeSorted = measurements
    .map((item) => item.beforeTotalMs)
    .sort((a, b) => a - b);
  const distribution = (values: number[]) => ({
    min: rounded(values[0]),
    median: rounded(percentile(values, 0.5)),
    p90: rounded(percentile(values, 0.9)),
    p95: rounded(percentile(values, 0.95)),
    p99: rounded(percentile(values, 0.99)),
    max: rounded(values.at(-1) || 0),
  });
  const report = {
    version: "search-v2-candidate-detail-cold-population-v1",
    generatedAt: new Date().toISOString(),
    commit: process.env.GIT_COMMIT || null,
    datasetRevision: dataset.revision,
    denominator: measurements.length,
    sourceRetrieval: {
      mode: "five bounded database batches followed by O(1) candidate row lookup",
      rows: rows.length,
      totalMs: rounded(sourceRetrievalMs),
    },
    distributionMs: {
      before: distribution(beforeSorted),
      after: distribution(sorted),
    },
    correlationsWithTotalMs: {
      sourceBytes: correlation(measurements, (item) => item.sourceBytes),
      sourceRows: correlation(measurements, (item) => item.sourceRows),
      employmentCount: correlation(
        measurements,
        (item) => item.employmentCount,
      ),
      projectCount: correlation(measurements, (item) => item.projectCount),
      educationCount: correlation(measurements, (item) => item.educationCount),
      skillCount: correlation(measurements, (item) => item.skillCount),
    },
    fd1174: measurements.find((item) => item.token === "#FD1174") || null,
    slowest20: [...measurements]
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 20)
      .map((item) => ({
        ...item,
        totalMs: rounded(item.totalMs),
        stages: Object.fromEntries(
          Object.entries(item.stages).map(([key, value]) => [
            key,
            rounded(value),
          ]),
        ),
      })),
  };
  const destination = path.join(
    "reports",
    "search-v2-v72-candidate-detail-cold-population.json",
  );
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ destination, ...report }, null, 2));

  if (report.denominator !== 822)
    throw new Error(
      `Expected 822 canonical profiles, received ${report.denominator}.`,
    );
  if (
    report.distributionMs.after.p99 > 1500 ||
    report.distributionMs.after.max > 5000
  )
    throw new Error(
      `Cold canonical preparation exceeded ceiling: p99=${report.distributionMs.after.p99}ms max=${report.distributionMs.after.max}ms`,
    );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
