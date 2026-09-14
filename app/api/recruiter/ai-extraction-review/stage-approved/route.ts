import { NextRequest, NextResponse } from "next/server";
import {
  loadApprovalStore,
  type AiExtractionApproval,
} from "@/lib/aiExtractionApprovalStore";
import { buildAiExtractionStagingPreview } from "@/lib/aiExtractionStagingPreview";
import {
  loadStagingStore,
  stageApprovedChanges,
} from "@/lib/aiExtractionStagingStore";
import { loadAiExtractionReviewReports } from "@/lib/aiExtractionReviewUi";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request: req,
    policyId: "ai-review-stage-approved",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false && body?.writeStaging !== true;
    const workspace = loadAiExtractionReviewReports();
    const approvals = Array.isArray(body?.approvals)
      ? (body.approvals as AiExtractionApproval[])
      : loadApprovalStore().approvals;
    const preview = buildAiExtractionStagingPreview(workspace, approvals);
    const result = stageApprovedChanges(preview.items, {
      dryRun,
      writeStaging: body?.writeStaging === true,
    });
    const existingStagedIds = loadStagingStore().items.map(
      (item) => item.stagingId,
    );
    return NextResponse.json({
      ...preview,
      ...result,
      existingStagedIds,
      rejectedCount: preview.rejectedStagingItems,
      noDbWrites: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to stage approved changes",
      },
      { status: 500 },
    );
  }
}
