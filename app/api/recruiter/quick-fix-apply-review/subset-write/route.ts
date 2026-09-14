import { NextResponse } from "next/server";
import {
  buildQuickFixApplySubset,
  writeQuickFixApplySubsetFile,
} from "../../../../../lib/quickFixApplySubsetAudit";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export async function GET() {
  return NextResponse.json(buildQuickFixApplySubset());
}
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "quick-apply-subset-write",
  });
  if (!authorization.allowed) return authorization.response;
  const body = await request.json().catch(() => ({}));
  const subset = buildQuickFixApplySubset({
    decisionsPath: body.decisionsPath,
    stagingPath: body.stagingPath,
  });
  if (body.writeSubsetFile) writeQuickFixApplySubsetFile(subset, true);
  return NextResponse.json(subset);
}
