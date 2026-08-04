import { NextResponse } from "next/server";
import { buildApplyHistory } from "@/lib/aiExtractionApplyHistory";
import { loadRealTalentPoolCandidates } from "@/lib/candidateAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { candidates } = await loadRealTalentPoolCandidates();
    return NextResponse.json(buildApplyHistory(candidates));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load apply history" }, { status: 500 });
  }
}