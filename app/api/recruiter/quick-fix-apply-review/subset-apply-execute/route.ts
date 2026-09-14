import { NextResponse } from "next/server";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "quick-apply-subset-execute",
  });
  if (!authorization.allowed) return authorization.response;
  const body = await request.json().catch(() => ({}));
  if (!(body.writeCandidateUpdates && body.confirmApplySubset))
    return NextResponse.json(
      {
        error:
          "Real DB apply disabled by default. CLI confirmation flags are required.",
      },
      { status: 400 },
    );
  return NextResponse.json(
    { error: "Real DB apply is not enabled from UI v1." },
    { status: 403 },
  );
}
