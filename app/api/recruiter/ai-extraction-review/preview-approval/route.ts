import { NextRequest, NextResponse } from "next/server";
import {
  generateApplyPreview,
  loadAiExtractionReviewReports,
  type ApprovalState,
} from "@/lib/aiExtractionReviewUi";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request: req,
    policyId: "ai-review-preview-approval",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const body = await req.json().catch(() => ({}));
    const approvals = (body?.approvals || {}) as ApprovalState;
    const workspace = loadAiExtractionReviewReports();
    return NextResponse.json(generateApplyPreview(workspace, approvals));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build approval preview",
      },
      { status: 500 },
    );
  }
}
