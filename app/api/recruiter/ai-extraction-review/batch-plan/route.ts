import { NextRequest, NextResponse } from "next/server";
import { buildAiExtractionBatchPlan } from "@/lib/aiExtractionBatchPlanner";
import { parseTargetFields } from "@/lib/aiExtractionBatchGuardrails";
import { loadRealTalentPoolCandidates } from "@/lib/candidateAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const { candidates } = await loadRealTalentPoolCandidates();
    const plan = buildAiExtractionBatchPlan(candidates, {
      batchSize: Number(params.get("batchSize") || 10),
      targetFields: parseTargetFields(params.get("targetFields") || undefined),
      provider: (params.get("provider") || "mock") as any,
      maxAiCalls: params.get("maxAiCalls") ? Number(params.get("maxAiCalls")) : undefined,
      confirmOpenAi: params.get("confirmOpenAi") === "true",
      includeMustRepair: params.get("includeMustRepair") === "true",
      validationQueueOnly: params.get("validationQueueOnly") === "true",
      highConfidenceOnly: params.get("highConfidenceOnly") === "true",
    });
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build batch plan" }, { status: 500 });
  }
}