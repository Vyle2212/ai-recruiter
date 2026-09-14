import { NextResponse } from "next/server";
import {
  buildQuickFixApprovalWriteResult,
  writeQuickFixApprovalWriteReport,
} from "../../../../../lib/quickFixApprovalWrite";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "quick-repair-approvals-write",
  });
  if (!authorization.allowed) return authorization.response;
  const body = await request.json().catch(() => ({}));
  if (!body.writeApprovalsFile) {
    return NextResponse.json(
      {
        error:
          "writeApprovalsFile=true is required. This route writes approvals only and never stages or applies candidate updates.",
      },
      { status: 400 },
    );
  }
  const result = buildQuickFixApprovalWriteResult({
    suggestionsPath: body.suggestionsPath,
    reviewPath: body.reviewPath,
    writeApprovalsFile: true,
    writeReviewFile: Boolean(body.writeReviewFile),
    overwriteExistingApprovals: Boolean(body.overwriteExistingApprovals),
  });
  writeQuickFixApprovalWriteReport(result);
  return NextResponse.json(result);
}
