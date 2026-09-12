import { createClient } from "@supabase/supabase-js";
import { buildSearchIndexRow, CandidateRow } from "./buildSearchIndexRow";

const SUPABASE_URL =
  process.env.CANDIDATE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const CANDIDATE_PAGE_SIZE = 300;
const INDEX_PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 100;

const EXCLUDED_STATUSES = new Set(["deleted", "needs_review", "non_sap"]);

function normalizeStatus(value: any): string {
  return String(value || "").trim().toLowerCase();
}

function isIndexableCandidate(candidate: CandidateRow): boolean {
  return !EXCLUDED_STATUSES.has(normalizeStatus((candidate as any).status));
}

export function getAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function fetchAllCandidateRows(supabase: any): Promise<CandidateRow[]> {
  let from = 0;
  let all: CandidateRow[] = [];

  while (true) {
    const to = from + CANDIDATE_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data);

    if (data.length < CANDIDATE_PAGE_SIZE) break;
    from += CANDIDATE_PAGE_SIZE;
  }

  return all;
}

async function fetchAllCandidates(supabase: any): Promise<CandidateRow[]> {
  const candidates = await fetchAllCandidateRows(supabase);
  return candidates.filter(isIndexableCandidate);
}

async function cleanupSearchIndexOrphans(
  supabase: any,
  activeCandidateIds: string[]
) {
  const keep = new Set(activeCandidateIds);
  let from = 0;
  let removed = 0;

  while (true) {
    const to = from + INDEX_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("candidate_search_index")
      .select("candidate_id")
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const orphanIds = data
      .map((row: any) => row.candidate_id)
      .filter((id: string) => id && !keep.has(id));

    for (let i = 0; i < orphanIds.length; i += UPSERT_BATCH_SIZE) {
      const batch = orphanIds.slice(i, i + UPSERT_BATCH_SIZE);

      const { error: deleteError } = await supabase
        .from("candidate_search_index")
        .delete()
        .in("candidate_id", batch);

      if (deleteError) throw deleteError;
      removed += batch.length;
    }

    if (data.length < INDEX_PAGE_SIZE) break;
    from += INDEX_PAGE_SIZE;
  }

  return removed;
}

export async function rebuildOneCandidate(candidateId: string) {
  const supabase = getAdminSupabase();

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();

  if (error) throw error;
  if (!candidate) throw new Error("Candidate not found.");

  if (!isIndexableCandidate(candidate)) {
    const { error: deleteError } = await supabase
      .from("candidate_search_index")
      .delete()
      .eq("candidate_id", candidateId);

    if (deleteError) throw deleteError;

    return {
      candidate_id: candidateId,
      indexed: false,
      action: "removed_from_index",
      reason: "excluded_status",
      status: candidate.status || null,
    };
  }

  const row = buildSearchIndexRow(candidate);

  if (!row) {
    const { error: deleteError } = await supabase
      .from("candidate_search_index")
      .delete()
      .eq("candidate_id", candidateId);

    if (deleteError) throw deleteError;

    return {
      candidate_id: candidateId,
      indexed: false,
      action: "removed_from_index",
      reason: "buildSearchIndexRow_returned_null",
      status: candidate.status || null,
    };
  }

  const { error: upsertError } = await supabase
    .from("candidate_search_index")
    .upsert(row, { onConflict: "candidate_id" });

  if (upsertError) throw upsertError;

  return {
    candidate_id: candidateId,
    indexed: true,
    action: "upserted",
    status: candidate.status || null,
  };
}

export async function rebuildSearchIndex() {
  const supabase = getAdminSupabase();

  const candidates = await fetchAllCandidates(supabase);
  const activeCandidateIds = candidates
    .map((candidate) => candidate.id)
    .filter(Boolean);

  const rows = candidates
    .map((candidate) => buildSearchIndexRow(candidate))
    .filter(Boolean);

  const removed_orphans = await cleanupSearchIndexOrphans(
    supabase,
    activeCandidateIds
  );

  let indexed = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);

    const { error } = await supabase
      .from("candidate_search_index")
      .upsert(batch, { onConflict: "candidate_id" });

    if (error) throw error;

    indexed += batch.length;
  }

  return {
    candidates_read: candidates.length,
    indexed,
    skipped: candidates.length - rows.length,
    removed_orphans,
    mode: "upsert_with_orphan_cleanup",
  };
}

export async function auditSearchIndex() {
  const supabase = getAdminSupabase();

  const candidates = await fetchAllCandidates(supabase);

  const { count: indexed, error: indexedError } = await supabase
    .from("candidate_search_index")
    .select("candidate_id", { count: "exact", head: true });

  if (indexedError) throw indexedError;

  const { count: missingPrimaryModule, error: moduleCountError } =
    await supabase
      .from("candidate_search_index")
      .select("candidate_id", { count: "exact", head: true })
      .or("primary_module.is.null,primary_module.eq.UNKNOWN");

  if (moduleCountError) throw moduleCountError;

  const { count: missingDisplayName, error: displayNameError } = await supabase
    .from("candidate_search_index")
    .select("candidate_id", { count: "exact", head: true })
    .or(
      "display_name.is.null,display_name.eq.Review Required,display_name.eq.Profile Under Review"
    );

  if (displayNameError) throw displayNameError;

  const { count: qualityBelow50, error: qualityBelow50Error } = await supabase
    .from("candidate_search_index")
    .select("candidate_id", { count: "exact", head: true })
    .lt("quality_score", 50);

  if (qualityBelow50Error) throw qualityBelow50Error;

  const { count: qualityBelow60, error: qualityBelow60Error } = await supabase
    .from("candidate_search_index")
    .select("candidate_id", { count: "exact", head: true })
    .lt("quality_score", 60);

  if (qualityBelow60Error) throw qualityBelow60Error;

  const { count: reviewNames, error: reviewNamesError } = await supabase
    .from("candidate_search_index")
    .select("candidate_id", { count: "exact", head: true })
    .ilike("display_name", "%review%");

  if (reviewNamesError) throw reviewNamesError;

  const { data: moduleDistribution, error: moduleError } = await supabase
    .from("candidate_search_index")
    .select("primary_module");

  if (moduleError) throw moduleError;

  const byModule = (moduleDistribution || []).reduce(
    (acc: Record<string, number>, row: any) => {
      const key = row.primary_module || "NULL";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  return {
    totalCandidates: candidates.length,
    indexed: indexed || 0,
    missingPrimaryModule: missingPrimaryModule || 0,
    missingDisplayName: missingDisplayName || 0,

    // Main warning threshold for production data quality.
    // This prevents valid but incomplete profiles such as "Rudolf N. Peralta"
    // from being treated as broken data.
    qualityBelow50: qualityBelow50 || 0,

    // Kept for backward compatibility / monitoring only.
    qualityBelow60: qualityBelow60 || 0,

    reviewNames: reviewNames || 0,
    byModule,
  };
}
