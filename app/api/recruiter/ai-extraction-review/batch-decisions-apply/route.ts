import { NextRequest, NextResponse } from "next/server";
import { applyBatchBulkDecision } from "@/lib/aiExtractionBatchDecisionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const report = applyBatchBulkDecision({
      decision: body.decision || "approve_safe",
      source: body.source || "batch_promotion",
      writeApprovalsFile: body.writeApprovalsFile === true,
      overwriteExistingApprovals: body.overwriteExistingApprovals === true,
    });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to apply batch decisions" }, { status: 500 });
  }
}
