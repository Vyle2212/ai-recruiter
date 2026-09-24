import "server-only";

import { createHash } from "node:crypto";

import type { CandidateSearchV2Document } from "./candidateSearchV2Types";
import { createCandidateSupabaseAdminClient } from "./candidateSupabase";
import { CANDIDATE_SEARCH_BLOCKED_STATUSES } from "./candidateSearchLifecycle";

const PAGE_SIZE = 500;

type BlockedCandidateRow = { id: unknown; status: unknown };
type CurrentBlockedCandidatesResolver = (
  signal?: AbortSignal,
) => Promise<BlockedCandidateRow[]>;

let currentBlockedCandidatesResolverForTests: CurrentBlockedCandidatesResolver | null =
  null;

async function currentBlockedCandidates(signal?: AbortSignal) {
  const supabase = createCandidateSupabaseAdminClient();
  const rows: BlockedCandidateRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("candidates")
      .select("id,status")
      .in("status", [...CANDIDATE_SEARCH_BLOCKED_STATUSES])
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const response = await query;
    if (response.error)
      throw new Error(
        "Candidate search lifecycle query failed: " + response.error.message,
      );
    const page = (response.data || []) as BlockedCandidateRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Explicit dependency injection for isolated route tests; never enabled by env alone. */
export function setCurrentBlockedCandidatesResolverForTests(
  resolver: CurrentBlockedCandidatesResolver | null,
) {
  if (resolver && process.env.NODE_ENV !== "test")
    throw new Error(
      "Candidate lifecycle test resolver is only available in NODE_ENV=test.",
    );
  currentBlockedCandidatesResolverForTests = resolver;
}

/** Re-check mutable lifecycle state outside cached search projections. */
export async function applyCurrentCandidateSearchLifecycle(
  documents: CandidateSearchV2Document[],
  signal?: AbortSignal,
) {
  const blockedRows = await (
    currentBlockedCandidatesResolverForTests || currentBlockedCandidates
  )(signal);
  const blockedIds = new Set(
    blockedRows.map((row) => String(row.id || "")).filter(Boolean),
  );
  const visibilityRevision = createHash("sha256")
    .update(
      blockedRows
        .map((row) => `${String(row.id || "")}:${String(row.status || "")}`)
        .sort()
        .join("|"),
    )
    .digest("hex")
    .slice(0, 16);

  return {
    documents: documents.filter(
      (document) => !blockedIds.has(String(document.candidateId || "")),
    ),
    blockedCount: blockedIds.size,
    visibilityRevision,
  };
}
