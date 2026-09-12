import { createCandidateSupabaseAdminClient } from "./candidateSupabase";
import {
  candidateSearchV2ProjectionDocument,
  SEARCH_V2_PROJECTION_FIELDS,
} from "./candidateSearchV2Projection";
import {
  hasContextualImplementationProjectEvidence,
  hasContextualSapModuleEvidence,
} from "./sapModuleEvidenceContext";
import {
  buildTrustedProfessionalSegments,
  qualifyNicheTargetEvidence,
} from "./nicheTargetEvidence";
import { SEARCH_V2_CACHE_VERSION } from "./searchV2Shared";
import { buildCanonicalProfileOverview } from "./candidateProfileOverview";
import { buildCandidateSearchV2ProfilePreview } from "./candidateSearchV2ProfilePreview";
import { buildCandidate360Profile } from "./candidate360Profile";
import { searchV2DatasetRevision } from "./searchV2Server";
import type { CandidateSearchV2Document } from "./candidateSearchV2Types";
import { languagesInText } from "./searchV2RequirementOntology";
import { conceptsInText, searchConcept } from "./candidateSearchConcepts";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  searchV2SnapshotSchemaVersion,
  validateSearchV2SnapshotPayload,
} from "./searchV2Snapshot";
import { canonicalLifecycleEvidence } from "./searchV2Lifecycle";
import { normalizeActualCandidateSchema } from "./candidate360SchemaNormalize";
import { supportedLinkedInProfileUrl } from "./linkedinProfileUrl";
import {
  publicIdentityTokensFor,
  resolvePublicIdentityToken,
  sourcePersonIdsForPublicIdentityToken,
} from "./searchV2PublicIdentity";

const SEARCH_RANKING_CACHE_VERSION = SEARCH_V2_CACHE_VERSION;
// Keep the normalized projection hot across normal recruiter sessions. Dataset
// revision and source timestamps remain part of downstream search identities;
// process restart/prewarm is the authoritative cold-refresh boundary.
const DATASET_CACHE_TTL_MS = 15 * 60 * 1000;
const DATASET_BUILD_TIMEOUT_MS = 120 * 1000;
let datasetBuildTimeoutMs = DATASET_BUILD_TIMEOUT_MS;
type CandidateDatasetSnapshot = {
  schemaVersion: string;
  createdAt: number;
  revision: string;
  documents: CandidateSearchV2Document[];
  sourceRows: number;
  snapshotBacked?: boolean;
  sourceCreatedAt?: number;
};
type IdentityTokenLookupResult = {
  documents: CandidateSearchV2Document[];
  revision: string;
  sourceRows: number;
};
const runtimeState = globalThis as typeof globalThis & {
  __candidateSearchV2DatasetV23CanonicalLifecycle?: CandidateDatasetSnapshot;
  __candidateSearchV2IndexLifecycleV1?: SearchV2IndexLifecycle;
  __candidateSearchV2IdentityTokenMapV1?: {
    version: string;
    byToken: Map<string, string[]>;
    promise: Promise<Map<string, string[]>> | null;
    builds: number;
  };
  __candidateSearchV2IdentityProjectionCacheV1?: {
    version: string;
    values: Map<
      string,
      { createdAt: number; value: IdentityTokenLookupResult }
    >;
    pending: Map<string, Promise<IdentityTokenLookupResult>>;
  };
  __candidateSearchV2IdentityDocumentMapV1?: {
    version: string;
    revision: string;
    byToken: Map<string, CandidateSearchV2Document[]>;
  };
};
const projectedDocumentCache = new Map<string, CandidateSearchV2Document>();
const removeProjectedDocument = (key: string) =>
  Reflect.apply(Map.prototype.delete, projectedDocumentCache, [key]);
const SNAPSHOT_SCHEMA_VERSION = searchV2SnapshotSchemaVersion(
  SEARCH_RANKING_CACHE_VERSION,
);
const PRECOMPUTED_STRICT_TARGETS = [
  "FICO",
  "OTC",
  "CPI",
  "MBC",
  "DATASPHERE",
] as const;
const normalizedEvidenceValue = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const identityHash = (value: unknown) => {
  const normalized = normalizedEvidenceValue(value);
  return normalized
    ? createHash("sha256").update(normalized).digest("hex")
    : "";
};
const documentEvidenceKeys = (value: unknown) => {
  const tokens = normalizedEvidenceValue(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 1);
  if (tokens.length < 8) return [];
  const keys: string[] = [];
  for (
    let index = 0;
    index <= tokens.length - 8 && keys.length < 400;
    index += 4
  )
    keys.push(
      identityHash(tokens.slice(index, index + 8).join(" ")).slice(0, 20),
    );
  return [...new Set(keys)];
};
// Keep the runtime snapshot statically scoped beneath the workspace tmp
// directory. An arbitrary environment-provided path caused Next's output
// tracer to include the whole repository in the production server bundle.
const SNAPSHOT_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "tmp",
  "search-v2-runtime-snapshot.json",
);
let backgroundRefreshPromise: Promise<unknown> | null = null;
let backgroundRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function readValidatedSnapshot() {
  try {
    const parsed: unknown = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    if (
      !validateSearchV2SnapshotPayload<CandidateSearchV2Document>(
        parsed,
        SNAPSHOT_SCHEMA_VERSION,
      )
    )
      return null;
    return {
      ...parsed,
      createdAt: Date.now(),
      sourceCreatedAt: parsed.sourceCreatedAt || parsed.createdAt,
      snapshotBacked: true,
    } as CandidateDatasetSnapshot;
  } catch {
    return null;
  }
}
async function persistValidatedSnapshot(snapshot: CandidateDatasetSnapshot) {
  const directory = path.dirname(SNAPSHOT_PATH),
    temporary = `${SNAPSHOT_PATH}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(
    temporary,
    JSON.stringify({
      ...snapshot,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      sourceCreatedAt: Date.now(),
      snapshotBacked: false,
    }),
    "utf8",
  );
  await rename(temporary, SNAPSHOT_PATH);
}
function refreshSnapshotInBackground() {
  if (backgroundRefreshPromise) return;
  const lifecycle = currentLifecycle();
  const generation = lifecycle.generation;
  const startedAt = performance.now();
  backgroundRefreshPromise = loadCandidateSource(true)
    .then((snapshot) => {
      if (
        currentLifecycle() !== lifecycle ||
        lifecycle.generation !== generation ||
        lifecycle.status !== "ready"
      )
        return;
      runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle = snapshot;
      lifecycle.datasetRevision = snapshot.revision;
      lifecycle.datasetCache = "miss";
      lifecycle.readyAt = Date.now();
      console.info(
        `[search-v2] shared index refresh completed in ${Math.round(performance.now() - startedAt)}ms`,
      );
    })
    .catch(() => {
      console.error(
        "[search-v2] shared index refresh failed; the last ready index remains available",
      );
    })
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}
function scheduleSnapshotRefresh() {
  if (backgroundRefreshPromise || backgroundRefreshTimer) return;
  // A validated snapshot can serve immediately. Defer CPU-heavy Candidate 360
  // projection rebuilding until after the active recruiter request burst so it
  // cannot block cached pagination in the same Node event loop.
  backgroundRefreshTimer = setTimeout(() => {
    backgroundRefreshTimer = null;
    refreshSnapshotInBackground();
  }, 30_000);
  backgroundRefreshTimer.unref?.();
}
export async function invalidateCandidateSearchV2DatasetSnapshot() {
  runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle = undefined;
  const lifecycle = currentLifecycle();
  lifecycle.generation += 1;
  lifecycle.status = "cold";
  lifecycle.promise = null;
  lifecycle.datasetRevision = null;
  lifecycle.datasetCache = "unknown";
  lifecycle.errorCode = null;
  await unlink(SNAPSHOT_PATH).catch(() => undefined);
}

// Interactive search only needs explicit language-section evidence. Running the
// complete Candidate 360 Experience/Projects normalizer here made a cold search
// reconstruct every profile projection even though drawer data is loaded lazily.
function explicitLanguageSectionEvidence(source: string) {
  const sections = [
    ...source.matchAll(
      /(?:^|\n)\s*(?:languages?|spoken languages?)\s*[:\-]?\s*([^\n]*(?:\n(?!\s*[A-Z][A-Za-z /&]{2,30}\s*:)[^\n]*){0,2})/gim,
    ),
  ];
  const evidence: string[] = [];
  for (const section of sections) {
    const excerpt = String(section[1] || "").slice(0, 500);
    for (const language of languagesInText(excerpt)) {
      const proficiency = excerpt.match(
        new RegExp(
          `${language.label}\\s*(?:[-:,(]\\s*)?(native|fluent|professional|business|conversational|basic)`,
          "i",
        ),
      )?.[1];
      evidence.push([language.label, proficiency].filter(Boolean).join(" "));
    }
  }
  return [...new Set(evidence)];
}

async function loadCandidateSource(forceRemote = false, signal?: AbortSignal) {
  const cached = runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle;
  const compatibleCached =
    cached?.schemaVersion === SNAPSHOT_SCHEMA_VERSION ? cached : undefined;
  if (cached && !compatibleCached)
    runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle = undefined;
  if (
    !forceRemote &&
    compatibleCached &&
    Date.now() - compatibleCached.createdAt <= DATASET_CACHE_TTL_MS
  ) {
    populateIdentityTokenMap(
      compatibleCached.documents.map((document) => document.candidateId),
    );
    populateIdentityDocumentMap(
      compatibleCached.documents,
      compatibleCached.revision,
    );
    return {
      ...compatibleCached,
      cacheHit: true,
      retrievalMs: 0,
      sourceEvidenceLoadingMs: 0,
      evidenceProjectionMs: 0,
    };
  }
  if (!forceRemote && !compatibleCached) {
    const persisted = await readValidatedSnapshot();
    if (persisted) {
      populateIdentityTokenMap(
        persisted.documents.map((document) => document.candidateId),
      );
      populateIdentityDocumentMap(persisted.documents, persisted.revision);
      // A fresh validated snapshot is already the production-ready index.
      // Refreshing all 833 source rows 30 seconds after boot competed with
      // candidate-detail requests and caused multi-second drawer stalls.
      if (
        !persisted.sourceCreatedAt ||
        Date.now() - persisted.sourceCreatedAt > DATASET_CACHE_TTL_MS
      )
        scheduleSnapshotRefresh();
      return {
        ...persisted,
        cacheHit: true,
        retrievalMs: 0,
        sourceEvidenceLoadingMs: 0,
        evidenceProjectionMs: 0,
      };
    }
  }
  const supabase = createCandidateSupabaseAdminClient();
  const retrievalStartedAt = performance.now();
  const indexQuery = supabase
    .from("candidate_search_index")
    .select(SEARCH_V2_PROJECTION_FIELDS)
    .order("candidate_id", { ascending: true })
    .limit(2000);
  const indexResponse = await (signal
    ? indexQuery.abortSignal(signal)
    : indexQuery);
  const retrievalMs = performance.now() - retrievalStartedAt;
  if (indexResponse.error)
    throw new Error(
      "Candidate Supabase query failed: " + indexResponse.error.message,
    );
  const rows = (indexResponse.data || []) as unknown as Array<
    Record<string, unknown>
  >;
  const candidateIds = rows
    .map((row) => String(row.candidate_id))
    .filter(Boolean);
  const sourceStartedAt = performance.now();
  const sourceBatches: string[][] = [];
  // The versioned canonical snapshot is required for cross-surface parity and
  // can be large. Keep source hydration bounded below the database statement
  // timeout instead of requesting 100 JSON projections at once.
  for (let offset = 0; offset < candidateIds.length; offset += 50)
    sourceBatches.push(candidateIds.slice(offset, offset + 50));
  const sourceResponses = await Promise.all(
    sourceBatches.map((ids) => {
      const sourceQuery = supabase
        .from("candidates")
        .select(
          "id,title,current_title,current_company,headline,summary,current_location,raw_text,resume_text,updated_at,name,email,phone,linkedin_url,location,country,cv_hash,experience,education,skills,sap_modules,primary_module,module_authorities,secondary_modules,languages,language_skills,extraction_confidence,profile_quality_score,confidence,work_authorization,visa_status,relocation,relocation_willingness,availability_timeline,notice_period_days",
        )
        .in("id", ids);
      return signal ? sourceQuery.abortSignal(signal) : sourceQuery;
    }),
  );
  const sourceEvidenceLoadingMs = performance.now() - sourceStartedAt;
  const sourceError = sourceResponses.find((response) => response.error)?.error;
  if (sourceError)
    throw new Error("Candidate evidence query failed: " + sourceError.message);
  const sourceRows = sourceResponses.flatMap(
    (response) => response.data || [],
  ) as unknown as Array<Record<string, unknown>>;
  const sourceById = new Map(sourceRows.map((row) => [String(row.id), row]));
  const revision = searchV2DatasetRevision(
    rows,
    new Map(sourceRows.map((row) => [String(row.id), row.updated_at])),
  );
  const projectionStartedAt = performance.now();
  const documents = rows.map((row) => {
    const candidateId = String(row.candidate_id);
    const sourceRecord = sourceById.get(candidateId);
    const cacheKey = `${candidateId}:${row.source_updated_at || ""}:${sourceRecord?.updated_at || ""}:${SEARCH_RANKING_CACHE_VERSION}`;
    const cachedDocument = projectedDocumentCache.get(cacheKey);
    if (cachedDocument) return cachedDocument;
    const rawProfile = String(
      sourceRecord?.raw_text || sourceRecord?.resume_text || "",
    );
    const canonicalSource = sourceRecord
      ? normalizeActualCandidateSchema(sourceRecord)
      : null;
    const lifecycleEvidence = canonicalLifecycleEvidence(
      candidateId,
      canonicalSource?.enterpriseProfile.projects || [],
    );
    const languageEvidence = explicitLanguageSectionEvidence(rawProfile);
    const primary = String(row.primary_module || "").toUpperCase();
    const invalidModules =
      primary === "MM" &&
      ((row.project_types as unknown[]) || []).some(
        (value) => String(value) === "DOMAIN_CLASS_MM_EXPOSURE",
      ) &&
      !hasContextualSapModuleEvidence(rawProfile, primary)
        ? [primary]
        : [];
    const invalidImplementation =
      ((row.project_types as unknown[]) || []).some(
        (value) =>
          String(value) === "IMPLEMENTATION_EXPLICIT_SOURCE_TEXT_SUPPORTED",
      ) && !hasContextualImplementationProjectEvidence(rawProfile);
    const document = candidateSearchV2ProjectionDocument({
      ...row,
      ...(canonicalSource
        ? {
            display_name: canonicalSource.candidateName || null,
            display_title:
              canonicalSource.enterpriseProfile.identity.profileTitle ||
              canonicalSource.currentTitle ||
              null,
            display_company: canonicalSource.currentCompany || null,
            years:
              canonicalSource.enterpriseProfile.experienceSummary
                .totalCareerYears,
          }
        : {}),
      _trusted_candidate_evidence_values: sourceRecord
        ? [
            ...[
              ["current_title", sourceRecord.current_title],
              ["title", sourceRecord.title],
            ]
              .filter(([, value]) => String(value || "").trim())
              .map(([field, value]) => ({
                value: String(value),
                normalizedValue: normalizedEvidenceValue(value),
                sourceType: "raw_title",
                sourceField: `candidates.${field}`,
                sourceRecordId: candidateId,
                provenance: "candidate_record_raw",
                trusted: true,
                normalizedSegments: buildTrustedProfessionalSegments(
                  String(value),
                  "raw_title",
                ),
              })),
            ...(rawProfile.trim()
              ? [
                  {
                    value: rawProfile,
                    normalizedValue: normalizedEvidenceValue(rawProfile),
                    sourceType: "raw_professional_text",
                    sourceField: sourceRecord.raw_text
                      ? "candidates.raw_text"
                      : "candidates.resume_text",
                    sourceRecordId: candidateId,
                    provenance: "candidate_record_raw",
                    trusted: true,
                    normalizedSegments: buildTrustedProfessionalSegments(
                      rawProfile,
                      "raw_professional_text",
                    ),
                  },
                ]
              : []),
            ...languageEvidence.map((value) => ({
              value,
              normalizedValue: normalizedEvidenceValue(value),
              sourceType: "raw_professional_text",
              sourceField: "candidate_profile.language_section",
              sourceRecordId: candidateId,
              provenance: "candidate_record_raw",
              trusted: true,
              normalizedSegments: buildTrustedProfessionalSegments(
                value,
                "raw_professional_text",
              ),
            })),
          ]
        : [],
      ...(invalidModules.length
        ? { _invalid_ambiguous_modules: invalidModules }
        : {}),
      ...(invalidImplementation
        ? { _invalid_ambiguous_implementation: true }
        : {}),
    });
    document.sourceRecordId = candidateId;
    document.alternateNames = [
      sourceRecord?.full_name,
      sourceRecord?.name,
      sourceRecord?.display_name,
      canonicalSource?.candidateName,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    document.historicalEmployers =
      canonicalSource?.enterpriseProfile.employmentTimeline
        .map((item) => item.company)
        .filter(Boolean) || [];
    document.historicalTitles =
      canonicalSource?.enterpriseProfile.employmentTimeline
        .map((item) => item.title)
        .filter(Boolean) || [];
    document.canonicalRoleEvidence = canonicalSource
      ? [
          ...canonicalSource.enterpriseProfile.employmentTimeline
            .filter((item) => Boolean(item.title))
            .map((item) => ({
              title: item.title,
              sourceType: "canonical_employment" as const,
              sourceRecordId: item.id,
              sourceField: "enterpriseProfile.employmentTimeline.title",
              current: item.current,
            })),
          ...canonicalSource.enterpriseProfile.projects
            .filter((item) => Boolean(item.role))
            .map((item) => ({
              title: item.role,
              sourceType: "canonical_project" as const,
              sourceRecordId: item.id,
              sourceField: "enterpriseProfile.projects.role",
              current: false,
            })),
        ]
      : [];
    document.dataConfidenceScore =
      canonicalSource?.enterpriseProfile.quality.dataConfidence ??
      document.profileQualityScore ??
      null;
    if (canonicalSource) {
      document.canonicalProfileCompletenessScore =
        canonicalSource.enterpriseProfile.quality.profileCompleteness;
      document.profilePreview = buildCandidateSearchV2ProfilePreview(
        buildCanonicalProfileOverview(
          buildCandidate360Profile({ ...sourceRecord, ...canonicalSource }),
        ),
      );
      const completenessComponents =
        canonicalSource.enterpriseProfile.quality.completenessComponents;
      document.sourceCompletenessScore = completenessComponents.length
        ? Math.round(
            (completenessComponents.filter((item) => item.state !== "missing")
              .length /
              completenessComponents.length) *
              100,
          )
        : null;
    }
    document.identitySignals = {
      ...document.identitySignals,
      verifiedEmailHash:
        sourceRecord?.email && String(sourceRecord.email).includes("@")
          ? identityHash(sourceRecord.email)
          : null,
      verifiedPhoneHash:
        String(sourceRecord?.phone || "").replace(/\D/g, "").length >= 8
          ? identityHash(String(sourceRecord?.phone).replace(/\D/g, ""))
          : null,
      sourceProfileId: candidateId,
      sourceDocumentHash: identityHash(sourceRecord?.cv_hash || rawProfile),
      documentEvidenceKeys: documentEvidenceKeys(rawProfile),
      employmentKeys:
        canonicalSource?.enterpriseProfile.employmentTimeline
          .map((item) =>
            identityHash(
              [item.company, item.title, item.start, item.end].join("|"),
            ),
          )
          .filter(Boolean) || [],
      projectKeys:
        canonicalSource?.enterpriseProfile.projects
          .map((item) => item.id)
          .filter(Boolean) || [],
    };
    document.lifecycleEvidence = lifecycleEvidence;
    document.linkedInProfileUrl = supportedLinkedInProfileUrl(
      sourceRecord?.linkedin_url,
    );
    // A profile URL is not source provenance. The current production projection
    // has no authoritative LinkedIn-derived source marker, so fail closed.
    document.talentPool = "internal_profiles";
    const conceptEvidence: NonNullable<
      CandidateSearchV2Document["searchConceptEvidence"]
    > = {};
    for (const entry of document.trustedCandidateEvidence?.values || []) {
      const normalized =
        entry.normalizedValue || normalizedEvidenceValue(entry.value);
      for (const conceptId of conceptsInText(normalized)) {
        const concept = searchConcept(conceptId),
          literal =
            [
              concept?.label,
              ...(concept?.aliases || []),
              ...(concept?.contextAliases || []),
            ]
              .filter((value): value is string => Boolean(value))
              .find((value) =>
                normalized.includes(normalizedEvidenceValue(value)),
              ) || conceptId;
        conceptEvidence[conceptId] ||= {
          sourceType: entry.sourceType,
          sourceField: entry.sourceField,
          sourceRecordId: entry.sourceRecordId,
          matchedLiteral: literal,
          trusted: entry.trusted,
        };
      }
    }
    for (const value of [
      ...(document.sapModules || []),
      ...(document.skills || []),
    ]) {
      for (const conceptId of conceptsInText(value)) {
        conceptEvidence[conceptId] ||= {
          sourceType: "direct_skill",
          sourceField: "candidate_search_index.skills",
          sourceRecordId: candidateId,
          matchedLiteral: value,
          trusted: true,
        };
      }
    }
    document.searchConceptEvidence = conceptEvidence;
    document.searchConceptIds = Object.keys(conceptEvidence);
    document.searchTargetEvidence = Object.fromEntries(
      PRECOMPUTED_STRICT_TARGETS.map((target) => [
        target,
        qualifyNicheTargetEvidence(target, document),
      ]),
    );
    projectedDocumentCache.set(cacheKey, document);
    return document;
  });
  while (projectedDocumentCache.size > 2000)
    removeProjectedDocument(projectedDocumentCache.keys().next().value!);
  const evidenceProjectionMs = performance.now() - projectionStartedAt;
  const snapshot: CandidateDatasetSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: Date.now(),
    revision,
    documents,
    sourceRows: rows.length,
  };
  populateIdentityTokenMap(documents.map((document) => document.candidateId));
  populateIdentityDocumentMap(documents, revision);
  await persistValidatedSnapshot(snapshot).catch(() => null);
  return {
    ...snapshot,
    cacheHit: false,
    retrievalMs,
    sourceEvidenceLoadingMs,
    evidenceProjectionMs,
  };
}

type IdentityTokenSupabase = ReturnType<
  typeof createCandidateSupabaseAdminClient
>;

function populateIdentityTokenMap(candidateIds: readonly string[]) {
  const version = `${SEARCH_RANKING_CACHE_VERSION}:identity-token-map-v1`;
  let state = runtimeState.__candidateSearchV2IdentityTokenMapV1;
  if (!state || state.version !== version) {
    state = { version, byToken: new Map(), promise: null, builds: 0 };
    runtimeState.__candidateSearchV2IdentityTokenMapV1 = state;
  }
  const byToken = new Map<string, string[]>();
  for (const candidateId of candidateIds) {
    const identity = publicIdentityTokensFor([candidateId]);
    for (const token of [identity.token, ...identity.aliases]) {
      const ids = byToken.get(token) || [];
      if (!ids.includes(candidateId)) ids.push(candidateId);
      byToken.set(token, ids);
    }
  }
  state.byToken = byToken;
  return byToken;
}

function populateIdentityDocumentMap(
  documents: readonly CandidateSearchV2Document[],
  revision: string,
) {
  const byToken = new Map<string, CandidateSearchV2Document[]>();
  for (const document of documents) {
    const sourceIds = document.sourceCandidateIds?.length
      ? document.sourceCandidateIds
      : [document.candidateId];
    const identity = publicIdentityTokensFor(sourceIds);
    for (const token of [identity.token, ...identity.aliases]) {
      const values = byToken.get(token) || [];
      if (!values.some((value) => value.candidateId === document.candidateId))
        values.push(document);
      byToken.set(token, values);
    }
  }
  runtimeState.__candidateSearchV2IdentityDocumentMapV1 = {
    version: `${SEARCH_RANKING_CACHE_VERSION}:identity-document-map-v1`,
    revision,
    byToken,
  };
}

async function candidateIdsForIdentityToken(
  supabase: IdentityTokenSupabase,
  requestedToken: string,
  signal?: AbortSignal,
) {
  const version = `${SEARCH_RANKING_CACHE_VERSION}:identity-token-map-v1`;
  let state = runtimeState.__candidateSearchV2IdentityTokenMapV1;
  if (!state || state.version !== version) {
    state = { version, byToken: new Map(), promise: null, builds: 0 };
    runtimeState.__candidateSearchV2IdentityTokenMapV1 = state;
  }
  if (!state.byToken.size) {
    state.promise ||= (async () => {
      state!.builds += 1;
      const query = supabase
        .from("candidate_search_index")
        .select("candidate_id")
        .order("candidate_id", { ascending: true })
        .limit(2000);
      const response = await (signal ? query.abortSignal(signal) : query);
      if (response.error)
        throw new Error(
          "Candidate identity map failed: " + response.error.message,
        );
      return populateIdentityTokenMap(
        (response.data || [])
          .map((row) => String(row.candidate_id || ""))
          .filter(Boolean),
      );
    })().finally(() => {
      state!.promise = null;
    });
    await state.promise;
  }
  const matches = state.byToken.get(requestedToken) || [];
  return matches.length === 1 ? matches : [];
}

/**
 * Resolve an exact public token without waiting for the ranking projection.
 * Only matching source rows are normalized; the complete candidate population
 * is neither loaded nor scored on this path.
 */
async function loadCandidateSourceByIdentityToken(
  requestedToken: unknown,
  signal?: AbortSignal,
) {
  const normalizedToken = String(requestedToken || "")
    .replace(/[^a-f0-9]/gi, "")
    .toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(normalizedToken))
    return { documents: [], revision: "identity-token-invalid", sourceRows: 0 };

  const publicToken = `#${normalizedToken}`;
  const readyMap = runtimeState.__candidateSearchV2IdentityDocumentMapV1;
  if (
    readyMap?.version ===
    `${SEARCH_RANKING_CACHE_VERSION}:identity-document-map-v1`
  ) {
    const documents = readyMap.byToken.get(publicToken) || [];
    if (documents.length)
      return {
        documents: [...documents],
        revision: readyMap.revision,
        sourceRows: documents.length,
      };
  }

  const supabase = createCandidateSupabaseAdminClient();
  const registeredIds = sourcePersonIdsForPublicIdentityToken(publicToken);
  const requestedIds: string[] =
    registeredIds && registeredIds.length > 0
      ? registeredIds
      : await candidateIdsForIdentityToken(supabase, publicToken, signal);
  if (!requestedIds.length)
    return {
      documents: [],
      revision: "identity-token-unresolved",
      sourceRows: 0,
    };
  let indexQuery = supabase
    .from("candidate_search_index")
    .select(SEARCH_V2_PROJECTION_FIELDS)
    .limit(20);
  indexQuery = indexQuery.in("candidate_id", requestedIds);
  const indexResponse = await (signal
    ? indexQuery.abortSignal(signal)
    : indexQuery);
  if (indexResponse.error)
    throw new Error(
      "Candidate identity lookup failed: " + indexResponse.error.message,
    );
  const rows = (indexResponse.data || []) as unknown as Array<
    Record<string, unknown>
  >;
  const candidateIds = [
    ...new Set(rows.map((row) => String(row.candidate_id))),
  ];
  if (!candidateIds.length)
    return { documents: [], revision: "identity-token-empty", sourceRows: 0 };

  const sourceQuery = supabase
    .from("candidates")
    .select(
      "id,title,current_title,current_company,headline,summary,current_location,raw_text,resume_text,updated_at,name,email,phone,linkedin_url,location,country,cv_hash,experience,education,skills,sap_modules,primary_module,module_authorities,secondary_modules,languages,language_skills,extraction_confidence,profile_quality_score,confidence,work_authorization,visa_status,relocation,relocation_willingness,availability_timeline,notice_period_days",
    )
    .in("id", candidateIds);
  const sourceResponse = await (signal
    ? sourceQuery.abortSignal(signal)
    : sourceQuery);
  if (sourceResponse.error)
    throw new Error(
      "Candidate identity evidence lookup failed: " +
        sourceResponse.error.message,
    );
  const sourceRows = (sourceResponse.data || []) as unknown as Array<
    Record<string, unknown>
  >;
  const sourceById = new Map(sourceRows.map((row) => [String(row.id), row]));
  const documents = rows.flatMap((row) => {
    const candidateId = String(row.candidate_id);
    const sourceRecord = sourceById.get(candidateId);
    const canonicalSource = sourceRecord
      ? normalizeActualCandidateSchema(sourceRecord)
      : null;
    const candidateIdsForIdentity = [candidateId];
    if (!resolvePublicIdentityToken(publicToken, candidateIdsForIdentity))
      return [];
    const document = candidateSearchV2ProjectionDocument({
      ...row,
      ...(canonicalSource
        ? {
            display_name: canonicalSource.candidateName || null,
            display_title:
              canonicalSource.enterpriseProfile.identity.profileTitle ||
              canonicalSource.currentTitle ||
              null,
            display_company: canonicalSource.currentCompany || null,
            years:
              canonicalSource.enterpriseProfile.experienceSummary
                .totalCareerYears,
          }
        : {}),
    });
    document.sourceRecordId = candidateId;
    document.alternateNames = [
      sourceRecord?.full_name,
      sourceRecord?.name,
      sourceRecord?.display_name,
      canonicalSource?.candidateName,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    document.historicalEmployers =
      canonicalSource?.enterpriseProfile.employmentTimeline
        .map((item) => item.company)
        .filter(Boolean) || [];
    document.historicalTitles =
      canonicalSource?.enterpriseProfile.employmentTimeline
        .map((item) => item.title)
        .filter(Boolean) || [];
    document.canonicalRoleEvidence = canonicalSource
      ? [
          ...canonicalSource.enterpriseProfile.employmentTimeline
            .filter((item) => Boolean(item.title))
            .map((item) => ({
              title: item.title,
              sourceType: "canonical_employment" as const,
              sourceRecordId: item.id,
              sourceField: "enterpriseProfile.employmentTimeline.title",
              current: item.current,
            })),
          ...canonicalSource.enterpriseProfile.projects
            .filter((item) => Boolean(item.role))
            .map((item) => ({
              title: item.role,
              sourceType: "canonical_project" as const,
              sourceRecordId: item.id,
              sourceField: "enterpriseProfile.projects.role",
              current: false,
            })),
        ]
      : [];
    document.dataConfidenceScore =
      canonicalSource?.enterpriseProfile.quality.dataConfidence ??
      document.profileQualityScore ??
      null;
    if (canonicalSource) {
      document.canonicalProfileCompletenessScore =
        canonicalSource.enterpriseProfile.quality.profileCompleteness;
      document.profilePreview = buildCandidateSearchV2ProfilePreview(
        buildCanonicalProfileOverview(
          buildCandidate360Profile({ ...sourceRecord, ...canonicalSource }),
        ),
      );
    }
    document.lifecycleEvidence = canonicalLifecycleEvidence(
      candidateId,
      canonicalSource?.enterpriseProfile.projects || [],
    );
    document.linkedInProfileUrl = supportedLinkedInProfileUrl(
      sourceRecord?.linkedin_url,
    );
    document.talentPool = "internal_profiles";
    return [document];
  });
  return {
    documents,
    sourceRows: rows.length,
    revision: searchV2DatasetRevision(
      rows,
      new Map(sourceRows.map((row) => [String(row.id), row.updated_at])),
    ),
  };
}

export function fetchCandidateSourceByIdentityToken(
  requestedToken: unknown,
  signal?: AbortSignal,
): Promise<IdentityTokenLookupResult> {
  const key = String(requestedToken || "")
    .replace(/[^a-f0-9]/gi, "")
    .toUpperCase();
  const version = `${SEARCH_RANKING_CACHE_VERSION}:identity-projection-v1`;
  let cache = runtimeState.__candidateSearchV2IdentityProjectionCacheV1;
  if (!cache || cache.version !== version) {
    cache = { version, values: new Map(), pending: new Map() };
    runtimeState.__candidateSearchV2IdentityProjectionCacheV1 = cache;
  }
  const cached = cache.values.get(key);
  if (cached && Date.now() - cached.createdAt <= DATASET_CACHE_TTL_MS)
    return Promise.resolve(cached.value);
  const existing = cache.pending.get(key);
  if (existing) return existing;
  const activeCache = cache;
  // This process-owned promise is shared by concurrent requests. A browser
  // navigation may discard its response, but must not cancel another
  // authorized request waiting on the same exact token.
  const pending = loadCandidateSourceByIdentityToken(requestedToken)
    .then((value) => {
      activeCache.values.set(key, { createdAt: Date.now(), value });
      return value;
    })
    .finally(() => {
      activeCache.pending.delete(key);
    });
  activeCache.pending.set(key, pending);
  return pending;
}

type CandidateDatasetLoadResult = CandidateDatasetSnapshot & {
  cacheHit: boolean;
  retrievalMs: number;
  sourceEvidenceLoadingMs: number;
  evidenceProjectionMs: number;
};
export type SearchV2ProjectionReadiness = {
  status: "cold" | "warming" | "ready" | "failed";
  startedAt: number | null;
  readyAt: number | null;
  errorCode: string | null;
  datasetRevision: string | null;
  prewarmMs: number | null;
  datasetCache: "unknown" | "hit" | "miss";
  snapshotBacked?: boolean;
  snapshotAgeMs?: number | null;
  backgroundRefreshActive?: boolean;
};
type SearchV2IndexLifecycle = SearchV2ProjectionReadiness & {
  version: string;
  generation: number;
  promise: Promise<CandidateDatasetLoadResult> | null;
};
function newLifecycle(): SearchV2IndexLifecycle {
  const cached = runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle;
  const compatible = cached?.schemaVersion === SNAPSHOT_SCHEMA_VERSION;
  return {
    version: SNAPSHOT_SCHEMA_VERSION,
    generation: 0,
    status: compatible ? "ready" : "cold",
    promise: null,
    startedAt: null,
    readyAt: compatible ? Date.now() : null,
    errorCode: null,
    datasetRevision: compatible ? cached.revision : null,
    prewarmMs: null,
    datasetCache: compatible ? "hit" : "unknown",
    snapshotBacked: Boolean(compatible && cached.snapshotBacked),
  };
}
function currentLifecycle() {
  const existing = runtimeState.__candidateSearchV2IndexLifecycleV1;
  if (existing?.version === SNAPSHOT_SCHEMA_VERSION) return existing;
  const lifecycle = newLifecycle();
  runtimeState.__candidateSearchV2IndexLifecycleV1 = lifecycle;
  return lifecycle;
}

export function searchV2ProjectionReadiness(): Readonly<SearchV2ProjectionReadiness> {
  const lifecycle = currentLifecycle();
  const cached = runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle;
  if (
    lifecycle.status === "ready" &&
    cached &&
    Date.now() - cached.createdAt > DATASET_CACHE_TTL_MS
  )
    scheduleSnapshotRefresh();
  return {
    status: lifecycle.status,
    startedAt: lifecycle.startedAt,
    readyAt: lifecycle.readyAt,
    errorCode: lifecycle.errorCode,
    datasetRevision: lifecycle.datasetRevision,
    prewarmMs: lifecycle.prewarmMs,
    datasetCache: lifecycle.datasetCache,
    snapshotBacked: Boolean(cached?.snapshotBacked),
    snapshotAgeMs: cached?.sourceCreatedAt
      ? Date.now() - cached.sourceCreatedAt
      : null,
    backgroundRefreshActive: Boolean(backgroundRefreshPromise),
  };
}

export function prewarmCandidateSearchV2Dataset() {
  const lifecycle = currentLifecycle();
  if (lifecycle.status === "ready") {
    const cached = runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle;
    if (cached)
      return Promise.resolve({
        ...cached,
        cacheHit: true,
        retrievalMs: 0,
        sourceEvidenceLoadingMs: 0,
        evidenceProjectionMs: 0,
      });
  }
  if (lifecycle.status === "warming" && lifecycle.promise)
    return lifecycle.promise;

  lifecycle.generation += 1;
  const generation = lifecycle.generation;
  lifecycle.status = "warming";
  lifecycle.startedAt = Date.now();
  lifecycle.readyAt = null;
  lifecycle.errorCode = null;
  const prewarmStartedAt = performance.now();
  console.info(
    `[search-v2] shared index warm-up started (${SNAPSHOT_SCHEMA_VERSION})`,
  );
  const buildController = new AbortController();
  const build = (
    datasetLoaderForTest
      ? datasetLoaderForTest(buildController.signal)
      : loadCandidateSource(false, buildController.signal)
  ) as Promise<CandidateDatasetLoadResult>;
  let buildTimer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    buildTimer = setTimeout(() => {
      reject(new Error("SEARCH_INDEX_WARM_TIMEOUT"));
      buildController.abort();
    }, datasetBuildTimeoutMs);
  });
  lifecycle.promise = Promise.race([build, timeout])
    .then((snapshot) => {
      const active = currentLifecycle();
      if (active !== lifecycle || active.generation !== generation)
        throw new Error("SEARCH_INDEX_WARM_STALE_GENERATION");
      runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle = snapshot;
      lifecycle.status = "ready";
      lifecycle.errorCode = null;
      lifecycle.readyAt = Date.now();
      lifecycle.datasetRevision = snapshot.revision;
      lifecycle.prewarmMs = performance.now() - prewarmStartedAt;
      lifecycle.datasetCache = snapshot.cacheHit ? "hit" : "miss";
      lifecycle.snapshotBacked = Boolean(snapshot.snapshotBacked);
      console.info(
        `[search-v2] shared index warm-up completed in ${Math.round(lifecycle.prewarmMs)}ms (${snapshot.sourceRows} rows)`,
      );
      return snapshot;
    })
    .catch((error: unknown) => {
      const active = currentLifecycle();
      if (active === lifecycle && active.generation === generation) {
        lifecycle.status = "failed";
        lifecycle.errorCode =
          error instanceof Error &&
          error.message === "SEARCH_INDEX_WARM_TIMEOUT"
            ? "SEARCH_INDEX_WARM_TIMEOUT"
            : "SEARCH_INDEX_WARM_FAILED";
        console.error(
          `[search-v2] shared index warm-up failed after ${Math.round(performance.now() - prewarmStartedAt)}ms (${lifecycle.errorCode})`,
        );
      }
      throw error;
    })
    .finally(() => {
      if (buildTimer) clearTimeout(buildTimer);
      if (lifecycle.generation === generation) lifecycle.promise = null;
    });
  return lifecycle.promise;
}

export async function waitForSearchV2ProjectionReadiness(maxWaitMs = 25000) {
  const initial = searchV2ProjectionReadiness();
  if (initial.status === "ready") return initial;
  const prewarm = prewarmCandidateSearchV2Dataset();
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    prewarm.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), maxWaitMs);
      timer.unref?.();
    }),
  ]);
  if (timer) clearTimeout(timer);
  return searchV2ProjectionReadiness();
}

export async function fetchCandidateSource() {
  const lifecycle = currentLifecycle();
  if (lifecycle.status !== "ready") return prewarmCandidateSearchV2Dataset();
  const cached = runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle;
  if (!cached) {
    lifecycle.status = "cold";
    return prewarmCandidateSearchV2Dataset();
  }
  if (Date.now() - cached.createdAt > DATASET_CACHE_TTL_MS)
    scheduleSnapshotRefresh();
  return {
    ...cached,
    cacheHit: true,
    retrievalMs: 0,
    sourceEvidenceLoadingMs: 0,
    evidenceProjectionMs: 0,
  };
}

/*
 * Test-only lifecycle reset. Production callers use version changes or the
 * explicit snapshot invalidator; exporting this keeps lifecycle tests on the
 * same code path without exposing candidate data.
 */
export function resetSearchV2ProjectionLifecycleForTest() {
  runtimeState.__candidateSearchV2DatasetV23CanonicalLifecycle = undefined;
  runtimeState.__candidateSearchV2IndexLifecycleV1 = undefined;
}

let datasetLoaderForTest:
  ((signal?: AbortSignal) => Promise<CandidateDatasetLoadResult>) | null = null;
export function configureSearchV2ProjectionLifecycleForTest(options?: {
  loader?: (signal?: AbortSignal) => Promise<CandidateDatasetLoadResult>;
  timeoutMs?: number;
}) {
  datasetLoaderForTest = options?.loader || null;
  datasetBuildTimeoutMs = options?.timeoutMs || DATASET_BUILD_TIMEOUT_MS;
  resetSearchV2ProjectionLifecycleForTest();
}
