import { NextResponse } from "next/server";
import { runClientExecutiveReport } from "@/lib/clientExecutiveReportData";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "client-report",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    return NextResponse.json(
      await runClientExecutiveReport(await request.json()),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build client report",
      },
      { status: 400 },
    );
  }
}
