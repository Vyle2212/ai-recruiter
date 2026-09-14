import { NextResponse } from "next/server";
import { buildQuickFixApplySubsetPreview } from "../../../../../lib/quickFixApplySubsetBuilder";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export async function GET() {
  return NextResponse.json(buildQuickFixApplySubsetPreview());
}
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "quick-apply-subset-preview-write",
  });
  if (!authorization.allowed) return authorization.response;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(
    buildQuickFixApplySubsetPreview({ decisionsPath: body.decisionsPath }),
  );
}
