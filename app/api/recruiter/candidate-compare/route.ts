import { NextResponse } from "next/server";
import { runCandidateCompare } from "@/lib/candidateCompareData";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "candidate-compare",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    return NextResponse.json(await runCandidateCompare(await request.json()));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to compare candidates",
      },
      { status: 400 },
    );
  }
}
