import { NextResponse } from "next/server";
import { buildQuickFixApprovalWriteResult, writeQuickFixApprovalWriteReport } from "../../../../../lib/quickFixApprovalWrite";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.writeApprovalsFile) {
    return NextResponse.json({ error: "writeApprovalsFile=true is required. This route writes approvals only and never stages or applies candidate updates." }, { status: 400 });
  }
  const result = buildQuickFixApprovalWriteResult({ suggestionsPath: body.suggestionsPath, reviewPath: body.reviewPath, writeApprovalsFile: true, writeReviewFile: Boolean(body.writeReviewFile), overwriteExistingApprovals: Boolean(body.overwriteExistingApprovals) });
  writeQuickFixApprovalWriteReport(result);
  return NextResponse.json(result);
}

