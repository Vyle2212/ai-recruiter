import "server-only";

import { createClient } from "@supabase/supabase-js";
import { legacyIndexMutationRefusal } from "./legacyIndexMutationGate";

const PAGE_SIZE = 300;
const EXCLUDED_STATUSES = new Set(["deleted", "needs_review", "non_sap"]);

function getAdminSupabase() {
  const url =
    process.env.CANDIDATE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key)
    throw new Error("Server service-role configuration required");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function rebuildOneCandidate(
  _candidateId: string,
): Promise<never> {
  return legacyIndexMutationRefusal();
}

export async function rebuildSearchIndex(): Promise<never> {
  return legacyIndexMutationRefusal();
}

export async function auditSearchIndex() {
  const db = getAdminSupabase();
  let totalCandidates = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("candidates")
      .select("status")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    totalCandidates += page.filter(
      ({ status }) =>
        !EXCLUDED_STATUSES.has(
          String(status || "")
            .trim()
            .toLowerCase(),
        ),
    ).length;
    if (page.length < PAGE_SIZE) break;
  }

  const index = db.from("candidate_search_index");
  const [
    indexedResult,
    moduleResult,
    nameResult,
    quality50Result,
    quality60Result,
    reviewResult,
  ] = await Promise.all([
    index.select("candidate_id", { count: "exact", head: true }),
    db
      .from("candidate_search_index")
      .select("candidate_id", { count: "exact", head: true })
      .or("primary_module.is.null,primary_module.eq.UNKNOWN"),
    db
      .from("candidate_search_index")
      .select("candidate_id", { count: "exact", head: true })
      .or(
        "display_name.is.null,display_name.eq.Review Required,display_name.eq.Profile Under Review",
      ),
    db
      .from("candidate_search_index")
      .select("candidate_id", { count: "exact", head: true })
      .lt("quality_score", 50),
    db
      .from("candidate_search_index")
      .select("candidate_id", { count: "exact", head: true })
      .lt("quality_score", 60),
    db
      .from("candidate_search_index")
      .select("candidate_id", { count: "exact", head: true })
      .ilike("display_name", "%review%"),
  ]);
  for (const result of [
    indexedResult,
    moduleResult,
    nameResult,
    quality50Result,
    quality60Result,
    reviewResult,
  ]) {
    if (result.error) throw result.error;
  }

  const byModule: Record<string, number> = {};
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("candidate_search_index")
      .select("primary_module")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    for (const { primary_module } of page) {
      const moduleName = primary_module || "NULL";
      byModule[moduleName] = (byModule[moduleName] || 0) + 1;
    }
    if (page.length < PAGE_SIZE) break;
  }

  return {
    totalCandidates,
    indexed: indexedResult.count || 0,
    missingPrimaryModule: moduleResult.count || 0,
    missingDisplayName: nameResult.count || 0,
    qualityBelow50: quality50Result.count || 0,
    qualityBelow60: quality60Result.count || 0,
    reviewNames: reviewResult.count || 0,
    byModule,
  };
}
