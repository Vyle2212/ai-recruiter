import "server-only";
import type { Candidate360Profile } from "./candidate360Types";
import { loadCandidate360Profile } from "./candidate360Data";
import { CANDIDATE_DETAIL_PROJECTION_VERSION } from "./candidate360SchemaNormalize";
import type { SearchV2CandidateDetailScope } from "./searchV2CandidateDetailContract";

export const SEARCH_V2_CANDIDATE_DETAIL_CACHE_VERSION =
  "search-v2-candidate-detail-cache-v11-canonical-education-presentation";

type Entry = { createdAt: number; value: Candidate360Profile | null };
const globalState = globalThis as typeof globalThis & {
  __searchV2CandidateDetailCache?: Map<string, Entry>;
  __searchV2CandidateDetailRequests?: Map<
    string,
    Promise<Candidate360Profile | null>
  >;
};
const cache =
  globalState.__searchV2CandidateDetailCache ||
  (globalState.__searchV2CandidateDetailCache = new Map());
const requests =
  globalState.__searchV2CandidateDetailRequests ||
  (globalState.__searchV2CandidateDetailRequests = new Map());
const TTL_MS = 60_000;

export async function loadSearchV2CandidateDetail(
  candidateId: string,
  scopeOrLoader:
    | SearchV2CandidateDetailScope
    | ((
        candidateId: string,
      ) => Promise<Candidate360Profile | null>) = "recruiter",
  scopedLoader: (
    candidateId: string,
  ) => Promise<Candidate360Profile | null> = loadCandidate360Profile,
) {
  const scope = typeof scopeOrLoader === "string" ? scopeOrLoader : "recruiter";
  const loader =
    typeof scopeOrLoader === "function" ? scopeOrLoader : scopedLoader;
  const key = `${SEARCH_V2_CANDIDATE_DETAIL_CACHE_VERSION}:${scope}:${CANDIDATE_DETAIL_PROJECTION_VERSION}:${candidateId}`;
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < TTL_MS)
    return { profile: existing.value, cacheHit: true } as const;
  const pending = requests.get(key);
  if (pending) return { profile: await pending, cacheHit: true } as const;
  const request = loader(candidateId)
    .then((value) => {
      cache.set(key, { createdAt: Date.now(), value });
      return value;
    })
    .finally(() => requests.delete(key));
  requests.set(key, request);
  return { profile: await request, cacheHit: false } as const;
}

export function clearSearchV2CandidateDetailCacheForTests() {
  cache.clear();
  requests.clear();
}
