import { NextRequest, NextResponse } from "next/server";
import { loadApprovalStore, type AiExtractionApproval } from "@/lib/aiExtractionApprovalStore";
import { buildAiExtractionStagingPreview } from "@/lib/aiExtractionStagingPreview";
import { loadStagingStore } from "@/lib/aiExtractionStagingStore";
import { loadAiExtractionReviewReports } from "@/lib/aiExtractionReviewUi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspace = loadAiExtractionReviewReports();
    const approvals = Array.isArray(body?.approvals) ? (body.approvals as AiExtractionApproval[]) : loadApprovalStore().approvals;
    const preview = buildAiExtractionStagingPreview(workspace, approvals);
    const existingStagedIds = loadStagingStore().items.map((item) => item.stagingId);
    return NextResponse.json({ ...preview, existingStagedIds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build staging preview" }, { status: 500 });
  }
}

