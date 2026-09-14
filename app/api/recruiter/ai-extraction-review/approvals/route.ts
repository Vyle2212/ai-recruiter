import { NextRequest, NextResponse } from "next/server";
import {
  loadApprovalStore,
  upsertApprovals,
} from "@/lib/aiExtractionApprovalStore";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(loadApprovalStore());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load approvals",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request: req,
    policyId: "ai-review-approvals-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const body = await req.json().catch(() => ({}));
    const approvals = Array.isArray(body?.approvals)
      ? body.approvals
      : body?.approval
        ? [body.approval]
        : [];
    const result = upsertApprovals(approvals);
    if (!result.ok)
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    return NextResponse.json(loadApprovalStore());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save approvals",
      },
      { status: 500 },
    );
  }
}
