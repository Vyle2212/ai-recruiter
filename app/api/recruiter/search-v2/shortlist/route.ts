import { NextResponse } from "next/server";
import {
  recruiterApiPrivateNoStoreHeaders,
  requireRecruiterApiRouteAuthorization,
} from "@/lib/recruiterApiAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { loadCandidateSearchMutationEligibility } from "@/lib/candidateSearchMutationGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const database = createLazySupabaseServiceClient();
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLE = "recruiter_search_shortlist_items";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: recruiterApiPrivateNoStoreHeaders,
  });

function scope(jobId: unknown) {
  if (jobId === null || jobId === undefined || jobId === "")
    return { jobId: null, key: "general" };
  if (typeof jobId !== "string" || !UUID.test(jobId)) return null;
  const id = jobId.toLowerCase();
  return { jobId: id, key: `job:${id}` };
}

function ownedQuery(
  profileId: string,
  organizationId: string | null,
  scopeKey: string,
) {
  let query = database
    .from(TABLE)
    .select("*")
    .eq("owner_profile_id", profileId)
    .eq("scope_key", scopeKey);
  query = organizationId
    ? query.eq("organization_id", organizationId)
    : query.is("organization_id", null);
  return query;
}

async function authorize(request: Request) {
  return requireRecruiterApiRouteAuthorization({ request });
}

async function readShortlist(request: Request) {
  const auth = await authorize(request);
  if (!auth.allowed) return auth.response;
  const url = new URL(request.url);
  const selection = scope(url.searchParams.get("jobId"));
  if (!selection) return json({ error: "Invalid job ID." }, 400);
  const candidateIds = url.searchParams.get("candidateIds");
  const ids =
    candidateIds === null
      ? null
      : [...new Set(candidateIds.split(",").filter(Boolean))];
  if (ids && (ids.length > 20 || ids.some((id) => !UUID.test(id))))
    return json({ error: "Invalid candidate IDs." }, 400);
  const page = Number(url.searchParams.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    return json({ error: "Invalid page." }, 400);
  try {
    let query = ownedQuery(
      auth.scope.profileId,
      auth.scope.organizationId,
      selection.key,
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (ids)
      query = query.in(
        "candidate_id",
        ids.length ? ids : ["00000000-0000-4000-8000-000000000000"],
      );
    else query = query.range((page - 1) * 50, page * 50 - 1);
    const { data, error } = await query;
    if (error) throw error;
    if (ids) {
      let countQuery = database
        .from(TABLE)
        .select("id", { head: true, count: "exact" })
        .eq("owner_profile_id", auth.scope.profileId)
        .eq("scope_key", selection.key);
      countQuery = auth.scope.organizationId
        ? countQuery.eq("organization_id", auth.scope.organizationId)
        : countQuery.is("organization_id", null);
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      return json({
        candidateIds: (data || []).map((row) => row.candidate_id),
        count: count || 0,
      });
    }
    const rows = data || [];
    const eligible = await loadCandidateSearchMutationEligibility(
      database,
      rows.map((row) => row.candidate_id),
    );
    const visible = rows.filter((row) =>
      eligible.eligibleIds.has(row.candidate_id),
    );
    const { data: profiles, error: profileError } = visible.length
      ? await database
          .from("candidates")
          .select(
            "id,name,title,current_title,company,current_company,location",
          )
          .in(
            "id",
            visible.map((row) => row.candidate_id),
          )
      : { data: [], error: null };
    if (profileError) throw profileError;
    const byId = new Map(
      (profiles || []).map((profile) => [profile.id, profile]),
    );
    return json({
      items: visible.map((row) => ({
        candidateId: row.candidate_id,
        createdAt: row.created_at,
        profile: byId.get(row.candidate_id) || null,
      })),
      page,
      hasMore: rows.length === 50,
    });
  } catch {
    return json(
      { error: "Shortlist is unavailable. Please retry later." },
      503,
    );
  }
}

async function mutate(request: Request, method: "POST" | "DELETE") {
  const auth = await authorize(request);
  if (!auth.allowed) return auth.response;
  let body: { jobId?: unknown; candidateId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const selection = scope(body?.jobId);
  const candidateId = body?.candidateId;
  if (!selection || typeof candidateId !== "string" || !UUID.test(candidateId))
    return json({ error: "Invalid shortlist selection." }, 400);
  try {
    if (method === "POST") {
      if (selection.jobId) {
        const { data: job, error: jobError } = await database
          .from("jobs")
          .select("id")
          .eq("id", selection.jobId)
          .eq("status", "active")
          .maybeSingle();
        if (jobError) throw jobError;
        if (!job) return json({ error: "The job is unavailable." }, 409);
      }
      const eligibility = await loadCandidateSearchMutationEligibility(
        database,
        [candidateId],
      );
      if (!eligibility.allEligible)
        return json(
          { error: "The candidate is not available for shortlisting." },
          409,
        );
      const { error } = await database.from(TABLE).upsert(
        {
          organization_id: auth.scope.organizationId,
          owner_profile_id: auth.scope.profileId,
          scope_key: selection.key,
          job_id: selection.jobId,
          candidate_id: candidateId.toLowerCase(),
        },
        {
          onConflict: "owner_profile_id,scope_key,candidate_id",
          ignoreDuplicates: true,
        },
      );
      if (error) throw error;
      // The unique constraint predates organization scope. A reassigned owner
      // can conflict with an old organization's row; ignoreDuplicates alone
      // would otherwise report success while the new shortlist stays empty.
      const { data: saved, error: savedError } = await ownedQuery(
        auth.scope.profileId,
        auth.scope.organizationId,
        selection.key,
      )
        .eq("candidate_id", candidateId)
        .maybeSingle();
      if (savedError) throw savedError;
      if (!saved)
        return json(
          { error: "This candidate is already saved under a previous organization. Contact an admin to resolve ownership." },
          409,
        );
      return json({ candidateId, shortlisted: true });
    }
    let deletion = database
      .from(TABLE)
      .delete()
      .eq("owner_profile_id", auth.scope.profileId)
      .eq("scope_key", selection.key)
      .eq("candidate_id", candidateId);
    deletion = auth.scope.organizationId
      ? deletion.eq("organization_id", auth.scope.organizationId)
      : deletion.is("organization_id", null);
    const { error } = await deletion;
    if (error) throw error;
    return json({ candidateId, shortlisted: false });
  } catch {
    return json(
      { error: "Shortlist could not be updated. Please retry." },
      503,
    );
  }
}

async function timedShortlist(operation: () => Promise<Response>) {
  const startedAt = performance.now();
  const response = await operation();
  const durationMs = performance.now() - startedAt;
  response.headers.append("Server-Timing", `shortlist;dur=${durationMs.toFixed(1)}`);
  console.info("[shortlist] request timing", JSON.stringify({ handlerMs: Math.round(durationMs) }));
  return response;
}
export async function GET(request: Request) {
  return timedShortlist(() => readShortlist(request));
}
export async function POST(request: Request) {
  return timedShortlist(() => mutate(request, "POST"));
}
export async function DELETE(request: Request) {
  return timedShortlist(() => mutate(request, "DELETE"));
}
