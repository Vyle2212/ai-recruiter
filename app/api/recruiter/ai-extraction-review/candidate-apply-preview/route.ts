import { NextResponse } from "next/server";
import { loadRealTalentPoolCandidates } from "@/lib/candidateAudit";
import {
  buildCandidateApplyPlan,
  loadStagingItems,
} from "@/lib/aiExtractionCandidateApplyPlan";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "ai-review-candidate-apply-preview",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const { candidates } = await loadRealTalentPoolCandidates();
    const plan = buildCandidateApplyPlan(loadStagingItems(), candidates);
    return NextResponse.json({
      ...plan,
      mode: "dry-run only; no candidate DB writes",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build candidate apply preview",
      },
      { status: 500 },
    );
  }
}
