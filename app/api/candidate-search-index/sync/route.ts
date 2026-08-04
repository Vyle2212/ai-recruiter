import { NextRequest, NextResponse } from "next/server";
import { syncCandidateSearchIndexSince, upsertCandidateSearchIndex } from "@/lib/candidateSearchIndex";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.candidateId) {
      const { data: candidate, error } = await supabase.from("candidates").select("*").eq("id", body.candidateId).single();
      if (error || !candidate) return NextResponse.json({ success: false, error: error?.message || "Candidate not found" }, { status: 404 });

      const result = await upsertCandidateSearchIndex(candidate);
      if (result.error) return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });
      return NextResponse.json({ success: true, indexed: 1, mode: "single" });
    }

    const result = await syncCandidateSearchIndexSince(body.since, Number(body.limit || 500));
    if (result.error) return NextResponse.json({ success: false, error: result.error.message || String(result.error) }, { status: 500 });

    return NextResponse.json({ success: true, indexed: result.count, mode: "incremental", since: body.since || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Sync candidate search index failed" }, { status: 500 });
  }
}
