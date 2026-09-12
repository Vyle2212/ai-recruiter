import { NextResponse } from "next/server";
import { loadSearchV2CandidateDetail } from "@/lib/searchV2CandidateDetailCache";
import { authorizeRecruiterJobsRead } from "@/lib/recruiterJobsAuthorization";
import { sanitizeSearchV2VisiblePayload } from "@/lib/searchV2VisibleEvidence";
import {
  buildSearchV2RecruiterCandidateDetail,
  SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION,
} from "@/lib/searchV2CandidateDetailContract";
import {
  authorizeSearchV2CandidateDetailRequest,
  candidateDetailDebugFeatureEnabled,
} from "@/lib/searchV2CandidateDetailAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  const startedAt = performance.now();
  const authorization = await authorizeRecruiterJobsRead();
  if (!authorization.allowed)
    return NextResponse.json(
      { error: authorization.code },
      { status: authorization.status },
    );
  try {
    const debugRequested =
      new URL(request.url).searchParams.get("debug") === "1";
    const access = authorizeSearchV2CandidateDetailRequest({
      authenticated: true,
      active: true,
      role: authorization.actor.role,
      debugRequested,
      debugFeatureEnabled: candidateDetailDebugFeatureEnabled(),
    });
    if (!access.allowed)
      return NextResponse.json(
        { error: access.code },
        { status: access.status },
      );
    const scope = access.scope;
    const { candidateId } = await context.params;
    const detail = await loadSearchV2CandidateDetail(
      decodeURIComponent(candidateId).trim(),
      scope,
    );
    const profile = detail.profile;
    if (!profile)
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 },
      );
    const response =
      scope === "technical_debug"
        ? sanitizeSearchV2VisiblePayload(profile)
        : buildSearchV2RecruiterCandidateDetail(profile);
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Candidate-Detail-Version":
          SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION,
        "X-Candidate-Detail-Scope": scope,
        Vary: "Cookie, Authorization",
        "X-Candidate-Detail-Cache": detail.cacheHit ? "hit" : "miss",
        "Server-Timing": `candidate-detail;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load candidate details" },
      { status: 500 },
    );
  }
}
