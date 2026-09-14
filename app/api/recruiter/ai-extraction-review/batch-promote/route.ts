import { NextRequest, NextResponse } from "next/server";
import {
  buildBatchReviewPromotion,
  writeBatchReviewPromotionReport,
  writePromotedReviewFile,
} from "@/lib/aiExtractionBatchReviewPromotion";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request: req,
    policyId: "ai-review-batch-promote",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const body = await req.json().catch(() => ({}));
    const writeReviewFile = body.writeReviewFile === true;
    const reviewPath = body.reviewPath || "reports/ai-extraction-review.json";
    const report = buildBatchReviewPromotion({
      batchDryRunPath:
        body.batchDryRunPath || "reports/ai-extraction-batch-dry-run.json",
      reviewPath,
      approvalsPath:
        body.approvalsPath || "reports/ai-extraction-approvals.json",
      applyHistoryPath:
        body.applyHistoryPath || "reports/candidate-apply-history.json",
      writeReviewFile,
    });
    const outputPath = writeBatchReviewPromotionReport(
      report,
      body.outputPath || "reports/ai-extraction-batch-review-promotion.json",
    );
    if (writeReviewFile) writePromotedReviewFile(report, reviewPath);
    return NextResponse.json({
      ...report,
      outputPath,
      mergedReview: undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to promote batch review items",
      },
      { status: 500 },
    );
  }
}
