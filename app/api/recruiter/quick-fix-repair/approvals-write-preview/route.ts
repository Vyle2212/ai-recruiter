import { NextResponse } from "next/server";
import { buildQuickFixApprovalWriteResult } from "../../../../../lib/quickFixApprovalWrite";

export async function GET() {
  return NextResponse.json(buildQuickFixApprovalWriteResult());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(buildQuickFixApprovalWriteResult({ suggestionsPath: body.suggestionsPath, reviewPath: body.reviewPath, writeReviewFile: Boolean(body.writeReviewFile) }));
}

