import { loadCandidateSearchMutationEligibility } from "@/lib/candidateSearchMutationGate";
import { recruiterSearchAuthorizationDenied, recruiterSearchPrivateNoStoreHeaders, requireRecruiterSearchAuthorization } from "@/lib/recruiterSearchAuthorization";
import { NextRequest, NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createLazySupabaseServiceClient();

function asArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/shortlist-candidates",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  try {
    const body = await req.json().catch(() => ({}));
    const shortlistId = body.shortlistId || body.shortlist_id;
    const candidateIds = asArray(body.candidateIds || body.candidate_ids || body.candidateId || body.candidate_id);

    if (!shortlistId) return NextResponse.json({ success: false, error: "Missing shortlistId" }, { status: 400 });
    if (!candidateIds.length) return NextResponse.json({ success: false, error: "Missing candidateIds" }, { status: 400 });

    const eligibility = await loadCandidateSearchMutationEligibility(supabase, candidateIds);
    if (!eligibility.allEligible)
      return NextResponse.json(
        { success: false, error: "Every candidate must be eligible for shortlisting." },
        { status: 409, headers: recruiterSearchPrivateNoStoreHeaders },
      );

    const rows = candidateIds.map((candidateId, index) => ({
      shortlist_id: shortlistId,
      candidate_id: candidateId,
      rank: Number(body.startRank || 0) + index + 1,
      stage: body.stage || "shortlisted",
      status: body.status || "active",
      metadata: body.metadata || {},
    }));

    const { data, error } = await supabase
      .from("shortlist_candidates")
      .upsert(rows, { onConflict: "shortlist_id,candidate_id" })
      .select("*");

    if (error) throw error;

    await supabase.from("shortlists").update({ updated_at: new Date().toISOString() }).eq("id", shortlistId);

    return NextResponse.json({ success: true, candidates: data || [], count: data?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unable to add candidates to shortlist" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/shortlist-candidates",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  try {
    const body = await req.json().catch(() => ({}));
    const shortlistId = body.shortlistId || body.shortlist_id;
    const candidateId = body.candidateId || body.candidate_id;

    if (!shortlistId || !candidateId) {
      return NextResponse.json({ success: false, error: "Missing shortlistId or candidateId" }, { status: 400 });
    }

    const eligibility = await loadCandidateSearchMutationEligibility(supabase, [candidateId]);
    if (!eligibility.allEligible)
      return NextResponse.json(
        { success: false, error: "Candidate is not eligible for shortlist updates." },
        { status: 409, headers: recruiterSearchPrivateNoStoreHeaders },
      );

    const updatePayload: Record<string, any> = {};
    if (body.stage) updatePayload.stage = body.stage;
    if (body.status) updatePayload.status = body.status;
    if (body.rank !== undefined) updatePayload.rank = body.rank;
    if (body.notes !== undefined) updatePayload.notes = body.notes;
    if (body.metadata !== undefined) updatePayload.metadata = body.metadata;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("shortlist_candidates")
      .update(updatePayload)
      .eq("shortlist_id", shortlistId)
      .eq("candidate_id", candidateId)
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("shortlists").update({ updated_at: new Date().toISOString() }).eq("id", shortlistId);

    return NextResponse.json({ success: true, candidate: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unable to update shortlist candidate" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/shortlist-candidates",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  try {
    const body = await req.json().catch(() => ({}));
    const shortlistId = body.shortlistId || body.shortlist_id;
    const candidateIds = asArray(body.candidateIds || body.candidate_ids || body.candidateId || body.candidate_id);

    if (!shortlistId) return NextResponse.json({ success: false, error: "Missing shortlistId" }, { status: 400 });
    if (!candidateIds.length) return NextResponse.json({ success: false, error: "Missing candidateIds" }, { status: 400 });

    const { error } = await supabase
      .from("shortlist_candidates")
      .delete()
      .eq("shortlist_id", shortlistId)
      .in("candidate_id", candidateIds);

    if (error) throw error;

    await supabase.from("shortlists").update({ updated_at: new Date().toISOString() }).eq("id", shortlistId);

    return NextResponse.json({ success: true, removed: candidateIds.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unable to remove candidates from shortlist" }, { status: 500 });
  }
}
