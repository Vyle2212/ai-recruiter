import { NextRequest, NextResponse } from "next/server";
import { loadApprovalStore, type AiExtractionApproval } from "@/lib/aiExtractionApprovalStore";
import { buildSafeApplyPreview } from "@/lib/aiExtractionSafeApplyPreview";
import { loadAiExtractionReviewReports } from "@/lib/aiExtractionReviewUi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspace = loadAiExtractionReviewReports();
    const approvals = Array.isArray(body?.approvals) ? (body.approvals as AiExtractionApproval[]) : loadApprovalStore().approvals;
    return NextResponse.json(buildSafeApplyPreview(workspace, approvals));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build apply preview" }, { status: 500 });
  }
}
