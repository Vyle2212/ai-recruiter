import { NextResponse } from "next/server";
import { runSubmissionGeneration } from "@/lib/submissionGeneratorData";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "submission-generator",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    return NextResponse.json(
      await runSubmissionGeneration(await request.json()),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate submission draft",
      },
      { status: 400 },
    );
  }
}
