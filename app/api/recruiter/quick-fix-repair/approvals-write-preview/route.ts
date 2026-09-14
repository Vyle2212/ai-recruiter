import { NextResponse } from "next/server";
import { buildQuickFixApprovalWriteResult } from "../../../../../lib/quickFixApprovalWrite";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export async function GET() {
  return NextResponse.json(buildQuickFixApprovalWriteResult());
}

export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "quick-repair-write-preview",
  });
  if (!authorization.allowed) return authorization.response;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(
    buildQuickFixApprovalWriteResult({
      suggestionsPath: body.suggestionsPath,
      reviewPath: body.reviewPath,
      writeReviewFile: Boolean(body.writeReviewFile),
    }),
  );
}
