import { createHash } from "node:crypto";
import { SEARCH_V2_VERSION, serializeSearchV2Canonical } from "./searchV2Shared";

export function searchV2ServerHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function searchV2DatasetRevision(indexRows: ReadonlyArray<Record<string, unknown>>, sourceUpdatedAtById: ReadonlyMap<string, unknown>) {
  const revisionInput = indexRows.map((row) => `${String(row.candidate_id || "")}:${String(row.source_updated_at || "")}:${String(sourceUpdatedAtById.get(String(row.candidate_id || "")) || "")}`).join("|");
  return searchV2ServerHash(`${SEARCH_V2_VERSION}|${revisionInput}`).slice(0, 20);
}

export function searchV2ExecutionProfileHash(profile: unknown) {
  return searchV2ServerHash(serializeSearchV2Canonical(profile)).slice(0, 20);
}

export function searchV2DiagnosticHeaders(datasetRevision: string, cache: "hit" | "miss", phases: Record<string, number>, profile?: { hash: string; minimumScore: number; matchQuality: string; readiness?: string; datasetCache?: string }) {
  const serverTiming = Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.max(0, duration).toFixed(1)}`).join(", ");
  return {
    "Cache-Control": "no-store",
    "X-Search-Version": SEARCH_V2_VERSION,
    "X-Search-Dataset-Revision": datasetRevision,
    "X-Search-Profile": profile?.hash || "unavailable",
    "X-Search-Minimum-Score": String(profile?.minimumScore ?? 0),
    "X-Search-Match-Quality": profile?.matchQuality || "any",
    "X-Search-Readiness": profile?.readiness || "ready",
    "X-Search-Cache": cache,
    "X-Search-Dataset-Cache": profile?.datasetCache || "unknown",
    "Server-Timing": serverTiming,
  };
}