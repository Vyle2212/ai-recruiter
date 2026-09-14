import { NextResponse } from "next/server";
import {
  loadQuickFixApplyDecisions,
  writeQuickFixApplyDecisions,
} from "../../../../../lib/quickFixApplyDecisionStore";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export async function GET() {
  return NextResponse.json(loadQuickFixApplyDecisions());
}
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "quick-apply-decisions-write",
  });
  if (!authorization.allowed) return authorization.response;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(
    writeQuickFixApplyDecisions({
      writeDecisionFile: Boolean(body.writeDecisionFile),
      decisionMode: body.decisionMode || "suggested",
    }),
  );
}
