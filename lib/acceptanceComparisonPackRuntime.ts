import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeepStrictEqual } from "node:util";
import {
  acceptanceFixtureLeaseRecord,
  type AcceptanceFixtureLeaseExpectation,
} from "./acceptanceFixtureLease";
import {
  acceptanceComparisonPackFixture,
  validateAcceptanceComparisonPack,
} from "./acceptanceComparisonPackFixture";
import { buildCandidateSearchIndexRow } from "./candidateSearchIndex";

function packLease(expected: AcceptanceFixtureLeaseExpectation) {
  return acceptanceComparisonPackFixture(expected.runId).candidates.map(
    (candidate) => ({
      ...acceptanceFixtureLeaseRecord(expected),
      marker: `PTF Synthetic Pack ${candidate.id}`,
      candidate_id: candidate.id,
      fixture_version: "ptf1c2-comparison-pack-v1",
      search_query: acceptanceComparisonPackFixture(expected.runId).query,
    }),
  );
}

async function readPack(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  const fixtures = acceptanceComparisonPackFixture(expected.runId);
  const ids = fixtures.candidates.map((row) => row.id);
  const [leases, candidates, index] = await Promise.all([
    client
      .from("acceptance_synthetic_candidates")
      .select("*")
      .in("candidate_id", ids),
    client
      .from("candidates")
      .select("id,name,email,phone,linkedin_url,profile_confirmation_status")
      .in("id", ids),
    client
      .from("candidate_search_index")
      .select("candidate_id")
      .in("candidate_id", ids),
  ]);
  if (
    leases.error ||
    candidates.error ||
    index.error ||
    !Array.isArray(leases.data) ||
    !Array.isArray(candidates.data) ||
    !Array.isArray(index.data)
  )
    throw new Error("acceptance_pack_read_failed");
  return {
    fixtures,
    ids,
    leases: leases.data || [],
    candidates: candidates.data || [],
    index: index.data || [],
  };
}

export async function installAcceptanceComparisonPack(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  const found = await readPack(client, expected);
  if (found.leases.length || found.candidates.length || found.index.length)
    throw new Error("acceptance_pack_namespace_unavailable");
  // Lease first: an interrupted candidate/index insert remains recoverable.
  const lease = await client
    .from("acceptance_synthetic_candidates")
    .insert(packLease(expected));
  if (lease.error) throw new Error("acceptance_pack_lease_install_failed");
  const inserted = await client
    .from("candidates")
    .insert(found.fixtures.candidates);
  if (inserted.error)
    throw new Error("acceptance_pack_candidate_install_failed");
  const rows = found.fixtures.candidates.map(buildCandidateSearchIndexRow);
  if (rows.some((row) => !row))
    throw new Error("acceptance_pack_index_build_failed");
  const indexed = await client
    .from("candidate_search_index")
    .insert(rows.filter((row) => row !== null));
  if (indexed.error) throw new Error("acceptance_pack_index_install_failed");
  const verified = await readPack(client, expected);
  validateAcceptanceComparisonPack(expected.runId, verified.candidates);
  if (new Set(verified.index.map((row) => row.candidate_id)).size !== 25)
    throw new Error("acceptance_pack_index_readback_failed");
  return found.fixtures;
}

export async function removeAcceptanceComparisonPack(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  const found = await readPack(client, expected);
  if (!found.leases.length && !found.candidates.length && !found.index.length)
    return;
  const leases = new Map(
    packLease(expected).map((row) => [row.candidate_id, row]),
  );
  for (const row of found.leases) {
    const lease = leases.get(row.candidate_id);
    if (
      !lease ||
      Object.entries(lease).some(([key, value]) =>
        key === "expires_at"
          ? Date.parse(String(row[key])) !== Date.parse(String(value))
          : !isDeepStrictEqual(row[key], value),
      )
    )
      throw new Error("acceptance_pack_lease_ownership_denied");
  }
  const ownedIds = new Set(found.leases.map((row) => row.candidate_id));
  if (
    found.candidates.some((row) => !ownedIds.has(row.id)) ||
    found.index.some((row) => !ownedIds.has(row.candidate_id))
  )
    throw new Error("acceptance_pack_orphan_detected");
  const candidates = new Map(
    found.fixtures.candidates.map((row) => [row.id, row]),
  );
  for (const row of found.candidates) {
    const candidate = candidates.get(row.id)!;
    if (
      row.name !== candidate.name ||
      row.email !== candidate.email ||
      row.phone ||
      row.linkedin_url
    )
      throw new Error("acceptance_pack_candidate_ownership_denied");
  }
  // Never cascade through another actor's saved data or consent/chat records.
  for (const table of [
    "recruiter_search_shortlist_items",
    "candidate_chat_contact_consents",
    "candidate_chat_contact_consent_events",
    "chat_conversations",
  ]) {
    const probe = await client
      .from(table)
      .select("candidate_id", { count: "exact", head: true })
      .in("candidate_id", found.ids);
    if (probe.error || probe.count !== 0)
      throw new Error("acceptance_pack_dependency_detected");
  }
  for (const [table, key] of [
    ["candidate_search_index", "candidate_id"],
    ["candidates", "id"],
    ["acceptance_synthetic_candidates", "candidate_id"],
  ]) {
    const removed = await client.from(table).delete().in(key, found.ids);
    if (removed.error) throw new Error("acceptance_pack_cleanup_failed");
  }
  await verifyAcceptanceComparisonPackAbsent(client, expected);
}

export async function verifyAcceptanceComparisonPackAbsent(
  client: SupabaseClient,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  const found = await readPack(client, expected);
  if (found.leases.length || found.candidates.length || found.index.length)
    throw new Error("acceptance_pack_residue_detected");
}
