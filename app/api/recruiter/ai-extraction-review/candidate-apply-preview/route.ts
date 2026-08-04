import { NextResponse } from "next/server";
import { loadRealTalentPoolCandidates } from "@/lib/candidateAudit";
import { buildCandidateApplyPlan, loadStagingItems } from "@/lib/aiExtractionCandidateApplyPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { candidates } = await loadRealTalentPoolCandidates();
    const plan = buildCandidateApplyPlan(loadStagingItems(), candidates);
    return NextResponse.json({ ...plan, mode: "dry-run only; no candidate DB writes" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build candidate apply preview" }, { status: 500 });
  }
}
