import { NextRequest, NextResponse } from "next/server";
import { authorizeRecruiterJobsRead } from "@/lib/recruiterJobsAuthorization";
import {
  validGuidedSearchSnapshot,
  type GuidedSearchSnapshot,
} from "@/lib/guidedSearchIdentity";
import type { CommittedSearchRequirements } from "@/lib/searchV2CommittedRequirements";
import { COMMITTED_SEARCH_REQUIREMENTS_VERSION } from "@/lib/searchV2CommittedRequirements";
import type { SearchPreparationState } from "@/lib/searchV2Preparation";
import {
  SEARCH_PREPARATION_VERSION,
  preparationIdentity,
} from "@/lib/searchV2Preparation";
import type {
  CandidateSearchTalentPool,
  CandidateSearchV2Filters,
} from "@/lib/candidateSearchV2Types";
import { normalizeSearchV2Query } from "@/lib/searchV2QueryNormalization";
import { searchV2HistoryQueryIdentity } from "@/lib/searchV2History";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Item = {
  id: string;
  query: string;
  rawQuery?: string;
  normalizedQuery?: string;
  filters: {
    countries: string[];
    skills: string[];
    sapModules: string[];
    languages: string[];
  };
  matchQuality: "any" | "relevant" | "strong";
  minimumScore: number;
  timestamp: string;
  source: "manual" | "guided" | "posted_job_jd" | "uploaded_jd";
  jobId?: string;
  guidedPlanSnapshot?: GuidedSearchSnapshot;
  committedSnapshot?: CommittedSearchRequirements;
  preparationSnapshot?: SearchPreparationState;
  filterSnapshot?: CandidateSearchV2Filters;
  talentPool?: CandidateSearchTalentPool;
};
const root = globalThis as typeof globalThis & {
  __searchV2RecentByRecruiter?: Map<string, Item[]>;
};
const store = (root.__searchV2RecentByRecruiter ??= new Map<string, Item[]>());
async function actor() {
  const auth = await authorizeRecruiterJobsRead();
  if (!auth.allowed) return auth;
  return { ...auth, key: auth.actor.id || "local-preview" };
}
export async function GET() {
  const auth = await actor();
  if (!auth.allowed)
    return NextResponse.json({ error: auth.code }, { status: auth.status });
  return NextResponse.json(
    { items: store.get(auth.key) || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  const auth = await actor();
  if (!auth.allowed)
    return NextResponse.json({ error: auth.code }, { status: auth.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const row = body as Partial<Item>;
  if (
    !row ||
    typeof row.query !== "string" ||
    !row.query.trim() ||
    !row.filters ||
    !(["any", "relevant", "strong"] as unknown[]).includes(row.matchQuality) ||
    !(
      ["manual", "guided", "posted_job_jd", "uploaded_jd"] as unknown[]
    ).includes(row.source)
  )
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const queryNormalization = normalizeSearchV2Query(row.rawQuery ?? row.query);
  if (!queryNormalization.normalizedQuery)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const filters = {
    countries: Array.isArray(row.filters.countries)
      ? row.filters.countries.slice(0, 20)
      : [],
    skills: Array.isArray(row.filters.skills)
      ? row.filters.skills.slice(0, 20)
      : [],
    sapModules: Array.isArray(row.filters.sapModules)
      ? row.filters.sapModules.slice(0, 20)
      : [],
    languages: Array.isArray(row.filters.languages)
      ? row.filters.languages.slice(0, 20)
      : [],
  };
  const profile = JSON.stringify({
    q: searchV2HistoryQueryIdentity(queryNormalization.normalizedQuery),
    filters,
    matchQuality: row.matchQuality!,
    minimumScore: Number(row.minimumScore) || 0,
    committedIdentity:
      row.committedSnapshot?.version === COMMITTED_SEARCH_REQUIREMENTS_VERSION
        ? row.committedSnapshot.semanticIdentity
        : null,
  });
  const id = Buffer.from(profile).toString("base64url").slice(0, 48);
  const guidedPlanSnapshot = validGuidedSearchSnapshot(
    row.guidedPlanSnapshot,
    queryNormalization.normalizedQuery,
  )
    ? row.guidedPlanSnapshot
    : undefined;
  const committedSnapshot =
    row.committedSnapshot?.version === COMMITTED_SEARCH_REQUIREMENTS_VERSION &&
    normalizeSearchV2Query(row.committedSnapshot.query).canonicalKey ===
      queryNormalization.canonicalKey
      ? row.committedSnapshot
      : undefined;
  const preparationSnapshot =
    row.preparationSnapshot?.version === SEARCH_PREPARATION_VERSION &&
    row.preparationSnapshot.identity ===
      preparationIdentity(queryNormalization.normalizedQuery)
      ? row.preparationSnapshot
      : undefined;
  const item: Item = {
    id,
    query: queryNormalization.normalizedQuery.slice(0, 1000),
    rawQuery: queryNormalization.rawQuery.slice(0, 1000),
    normalizedQuery: queryNormalization.normalizedQuery.slice(0, 1000),
    filters,
    matchQuality: row.matchQuality!,
    minimumScore: Number(row.minimumScore) || 0,
    timestamp: new Date().toISOString(),
    source: row.source!,
    ...(row.jobId ? { jobId: String(row.jobId).slice(0, 100) } : {}),
    ...(guidedPlanSnapshot ? { guidedPlanSnapshot } : {}),
    ...(committedSnapshot ? { committedSnapshot } : {}),
    ...(preparationSnapshot ? { preparationSnapshot } : {}),
    ...(row.filterSnapshot && typeof row.filterSnapshot === "object"
      ? { filterSnapshot: row.filterSnapshot }
      : {}),
    ...(row.talentPool === "linkedin_talent_pool" ||
    row.talentPool === "internal_profiles"
      ? { talentPool: row.talentPool }
      : {}),
  };
  store.set(
    auth.key,
    [
      item,
      ...(store.get(auth.key) || []).filter((existing) => existing.id !== id),
    ].slice(0, 10),
  );
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
export async function DELETE(request: NextRequest) {
  const auth = await actor();
  if (!auth.allowed)
    return NextResponse.json({ error: auth.code }, { status: auth.status });
  const id = new URL(request.url).searchParams.get("id");
  if (id)
    store.set(
      auth.key,
      (store.get(auth.key) || []).filter((item) => item.id !== id),
    );
  else store.set(auth.key, []);
  return NextResponse.json({ ok: true });
}
