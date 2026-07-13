import path from "node:path";
import { hydrateRecruiterWorkflow } from "./recruiterWorkflowStateHydration";
import { buildQuickFixPostApplyVerification } from "./quickFixPostApplyVerification";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) { return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim(); }

export function buildQuickFixWorkflowRefreshPreview(options: { statePath?: string; verificationOptions?: Parameters<typeof buildQuickFixPostApplyVerification>[0] } = {}) {
  const workflow = hydrateRecruiterWorkflow({ statePath: options.statePath });
  const verification = buildQuickFixPostApplyVerification(options.verificationOptions);
  const verifiedIds = new Set(verification.items.filter((item) => item.verificationStatus === "verified_applied").map((item) => item.candidateId));
  const subsetIds = new Set(verification.items.map((item) => item.candidateId));
  const items = workflow.states.filter((state) => subsetIds.has(state.candidateId)).map((state) => {
    const verified = verifiedIds.has(state.candidateId);
    const before = state.currentStatus;
    const after = verified && before === "needs_repair" ? "ready_for_shortlist" : before;
    return { candidateId: state.candidateId, candidateName: state.displayName, workflowBefore: before, workflowAfterPreview: after, status: verified && after !== before ? "workflow_would_improve" : before === "needs_repair" ? "still_needs_repair" : "workflow_unchanged", remainingBlockers: verified ? state.blockerReasons.filter((reason) => !/company|employer/i.test(reason)) : state.blockerReasons, safetyNote: "Workflow refresh preview only. Saved workflow state is not changed." };
  });
  const beforeNeedsRepair = workflow.states.filter((state) => state.currentStatus === "needs_repair").length;
  const movedOut = items.filter((item) => item.workflowBefore === "needs_repair" && item.workflowAfterPreview !== "needs_repair").length;
  return { generatedAt: new Date().toISOString(), mode: "workflow refresh preview only; no candidate DB writes; no workflow state writes; no delete; no OpenAI calls", candidatesAnalyzed: items.length, workflowStatesBefore: workflow.states.length, workflowStatesAfterPreview: workflow.states.length, wouldMoveOutOfNeedsRepair: movedOut, wouldRemainNeedsRepair: items.filter((item) => item.workflowAfterPreview === "needs_repair").length, wouldBecomeReadyForShortlist: items.filter((item) => item.workflowAfterPreview === "ready_for_shortlist" && item.workflowBefore !== "ready_for_shortlist").length, needsRepairBefore: beforeNeedsRepair, needsRepairAfterPreview: beforeNeedsRepair - movedOut, readyForShortlistAfterPreview: (workflow.summary?.readyForShortlist || 0) + items.filter((item) => item.workflowAfterPreview === "ready_for_shortlist" && item.workflowBefore !== "ready_for_shortlist").length, remainingBlockers: items.reduce((sum, item) => sum + item.remainingBlockers.length, 0), items };
}
export function writeQuickFixWorkflowRefreshPreview(report: ReturnType<typeof buildQuickFixWorkflowRefreshPreview>, outputPath = path.join("reports", "quick-fix-workflow-refresh-preview.json")) { return writeWorkflowJson(outputPath, report); }

