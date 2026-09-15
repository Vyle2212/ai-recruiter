export const SEARCH_V2_VERSION =
  "candidate-search-v2-canonical-detail-v95-career-statements";
export const SEARCH_V2_QUALIFICATION_VERSION =
  "professional-context-segment-v18";
export const SEARCH_V2_CACHE_VERSION =
  "recruiter-search-cache-2026-09-14-profile-v95-career-statements";

export function serializeSearchV2Canonical(value: unknown) {
  return JSON.stringify(value);
}
