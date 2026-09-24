import {
  recruiterSearchAuthorizationDenied,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/candidate360/[candidateId]/resume",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  return Response.json(
    { error: "contact_approval_required" },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}
