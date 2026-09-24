import "server-only";

import { createClient } from "@supabase/supabase-js";
import { legacyIndexMutationRefusal } from "./legacyIndexMutationGate";
import { buildSearchIndexAudit } from "../searchIndexAudit";

const PAGE_SIZE = 300;

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
  const candidates: Array<Record<string, any>> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("candidates")
      .select("id,status,updated_at")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    candidates.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const indexRows: Array<Record<string, any>> = [];
  const byModule: Record<string, number> = {};
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("candidate_search_index")
      .select(
        "candidate_id,source_updated_at,updated_at,primary_module,display_name,quality_score",
      )
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    indexRows.push(...page);
    for (const { primary_module } of page) {
      const moduleName = primary_module || "NULL";
      byModule[moduleName] = (byModule[moduleName] || 0) + 1;
    }
    if (page.length < PAGE_SIZE) break;
  }

  const reconciliation = buildSearchIndexAudit({
    candidates,
    indexRows,
    sampleSize: 20,
  });
  const missingPrimaryModule = indexRows.filter(
    (row) => !row.primary_module || row.primary_module === "UNKNOWN",
  ).length;
  const missingDisplayName = indexRows.filter((row) =>
    ["", "Review Required", "Profile Under Review"].includes(
      String(row.display_name || ""),
    ),
  ).length;
  const qualityBelow50 = indexRows.filter(
    (row) => Number(row.quality_score || 0) < 50,
  ).length;
  const qualityBelow60 = indexRows.filter(
    (row) => Number(row.quality_score || 0) < 60,
  ).length;
  const reviewNames = indexRows.filter((row) =>
    /review/i.test(String(row.display_name || "")),
  ).length;
  const readyForSearch =
    reconciliation.exactSetAligned &&
    missingPrimaryModule === 0 &&
    missingDisplayName === 0 &&
    qualityBelow50 === 0 &&
    reviewNames === 0;

  return {
    readyForSearch,
    totalCandidates: reconciliation.eligibleCandidates,
    indexed: reconciliation.searchIndexRows,
    missingPrimaryModule,
    missingDisplayName,
    qualityBelow50,
    qualityBelow60,
    reviewNames,
    byModule,
    reconciliation,
  };
}
