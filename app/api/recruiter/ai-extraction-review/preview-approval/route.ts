import { NextRequest, NextResponse } from "next/server";
import { generateApplyPreview, loadAiExtractionReviewReports, type ApprovalState } from "@/lib/aiExtractionReviewUi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const approvals = (body?.approvals || {}) as ApprovalState;
    const workspace = loadAiExtractionReviewReports();
    return NextResponse.json(generateApplyPreview(workspace, approvals));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build approval preview" },
      { status: 500 },
    );
  }
}
