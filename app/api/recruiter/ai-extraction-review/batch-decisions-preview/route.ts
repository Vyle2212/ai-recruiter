import { NextRequest, NextResponse } from "next/server";
import {
  previewBatchBulkDecision,
  writeBatchBulkDecisionPreview,
} from "@/lib/aiExtractionBatchDecisionStore";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request: req,
    policyId: "ai-review-batch-decisions-preview",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const body = await req.json().catch(() => ({}));
    const report = previewBatchBulkDecision({
      decision: body.decision || "approve_safe",
      source: body.source || "batch_promotion",
    });
    const outputPath = writeBatchBulkDecisionPreview(
      report,
      body.outputPath ||
        "reports/ai-extraction-batch-bulk-decision-preview.json",
    );
    return NextResponse.json({ ...report, outputPath });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview batch decisions",
      },
      { status: 500 },
    );
  }
}
