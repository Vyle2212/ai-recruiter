import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function asArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const poolId = body.poolId || body.pool_id;
    const candidateIds = asArray(body.candidateIds || body.candidate_ids || body.candidateId || body.candidate_id);

    if (!poolId) return NextResponse.json({ success: false, error: "Missing poolId" }, { status: 400 });
    if (!candidateIds.length) return NextResponse.json({ success: false, error: "Missing candidateIds" }, { status: 400 });

    const rows = candidateIds.map((candidateId, index) => ({
      pool_id: poolId,
      candidate_id: candidateId,
      rank: Number(body.startRank || 0) + index + 1,
      status: body.status || "saved",
      metadata: body.metadata || {},
    }));

    const { data, error } = await supabase
      .from("talent_pool_candidates")
      .upsert(rows, { onConflict: "pool_id,candidate_id" })
      .select("*");

    if (error) throw error;

    await supabase.from("talent_pools").update({ updated_at: new Date().toISOString() }).eq("id", poolId);

    return NextResponse.json({ success: true, candidates: data || [], count: data?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unable to add candidates to pool" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const poolId = body.poolId || body.pool_id;
    const candidateIds = asArray(body.candidateIds || body.candidate_ids || body.candidateId || body.candidate_id);

    if (!poolId) return NextResponse.json({ success: false, error: "Missing poolId" }, { status: 400 });
    if (!candidateIds.length) return NextResponse.json({ success: false, error: "Missing candidateIds" }, { status: 400 });

    const { error } = await supabase
      .from("talent_pool_candidates")
      .delete()
      .eq("pool_id", poolId)
      .in("candidate_id", candidateIds);

    if (error) throw error;

    await supabase.from("talent_pools").update({ updated_at: new Date().toISOString() }).eq("id", poolId);

    return NextResponse.json({ success: true, removed: candidateIds.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unable to remove candidates from pool" }, { status: 500 });
  }
}
