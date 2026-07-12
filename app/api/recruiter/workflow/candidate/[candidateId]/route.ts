import { NextResponse } from "next/server";
import { buildRecruiterWorkflowAuditFromReports } from "@/lib/recruiterWorkflowAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await context.params;
    const audit = buildRecruiterWorkflowAuditFromReports();
    const state = audit.states.find((item) => item.candidateId === candidateId);
    if (!state) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    const recommended = audit.actionQueue.filter((item) => item.candidateId === candidateId);
    const actionNames = ["validate_profile", "review_ai_extraction", "repair_missing_data", "compare_candidate", "add_to_shortlist", "generate_submission", "submit_to_client", "schedule_interview", "update_client_feedback", "update_candidate_feedback", "move_to_offer", "mark_placed", "mark_rejected", "archive_candidate"];
    const allowedNames = ["mark_rejected", "archive_candidate", recommended[0]?.recommendedNextAction].filter(Boolean);
    return NextResponse.json({
      candidateId,
      candidateName: state.candidateName,
      currentWorkflowStatus: state.status,
      profileQualityStatus: state.missingData.length ? "Missing " + state.missingData.join(", ") : "Profile quality is usable",
      validationStatus: state.validationBlockers.length ? "Validation blockers present" : state.status === "needs_validation" ? "Needs validation" : "Validated or ready for review",
      aiExtractionReviewStatus: state.status === "ai_review_needed" ? "AI extraction review needed" : "No AI review blocker",
      stagingApplyHistoryStatus: "Report-backed status available",
      recommendedNextActions: recommended,
      allowedActions: actionNames.filter((action) => allowedNames.includes(action)).map((action) => ({ action, reasons: ["Dry-run workflow action preview"] })),
      blockedActions: actionNames.filter((action) => !allowedNames.includes(action)).map((action) => ({ action, reasons: ["Action is not the recommended next step for current workflow status"] })),
      timeline: [{ at: state.lastUpdated, event: "workflow_status_inferred", note: state.reasons.join("; ") }],
      safetyNote: "Workflow panel is dry-run by default and does not update candidate records.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load candidate workflow" }, { status: 500 });
  }
}
