import type { SearchV2ProjectionReadiness } from "./searchV2Dataset";

export type SearchV2ReadinessErrorCode =
  | "SEARCH_INDEX_WARMING"
  | "SEARCH_INDEX_WARM_FAILED"
  | "SEARCH_INDEX_WARM_TIMEOUT";

export function searchV2ReadinessHttpContract(
  readiness: Readonly<SearchV2ProjectionReadiness>,
  population: number,
) {
  const ready = readiness.status === "ready" && population > 0;
  const warming = readiness.status === "cold" || readiness.status === "warming";
  const code: SearchV2ReadinessErrorCode | null = ready
    ? null
    : warming
      ? "SEARCH_INDEX_WARMING"
      : readiness.errorCode === "SEARCH_INDEX_WARM_TIMEOUT"
        ? "SEARCH_INDEX_WARM_TIMEOUT"
        : "SEARCH_INDEX_WARM_FAILED";
  const message = warming
    ? "Preparing candidate search. This should only take a moment."
    : "Candidate search could not be prepared. Please try again.";

  return {
    status: ready ? 200 : 503,
    headers: (warming ? { "Retry-After": "1" } : {}) as Record<string, string>,
    body: {
      ready,
      status: readiness.status,
      datasetRevision: readiness.datasetRevision,
      errorCode: readiness.errorCode,
      prewarmMs:
        readiness.prewarmMs === null ? null : Math.round(readiness.prewarmMs),
      datasetCache: readiness.datasetCache,
      snapshotBacked: readiness.snapshotBacked || false,
      snapshotAgeMs: readiness.snapshotAgeMs ?? null,
      backgroundRefreshActive: readiness.backgroundRefreshActive || false,
      ...(code
        ? {
            error: {
              code,
              message,
              retryable: true,
            },
          }
        : {}),
      sources: {
        internal_profiles: {
          available: ready,
          population,
          reason: ready ? null : code,
        },
      },
    },
  } as const;
}
