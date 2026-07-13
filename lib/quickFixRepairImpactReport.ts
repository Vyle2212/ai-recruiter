import path from "node:path";
import { hydrateRecruiterWorkflow } from "./recruiterWorkflowStateHydration";
import { buildQuickFixPostApplyVerification } from "./quickFixPostApplyVerification";
import { buildQuickFixWorkflowRefreshPreview } from "./quickFixWorkflowRefreshPreview";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

type RepairImpactOptions = {
  statePath?: string;
  verificationOptions?: Parameters<typeof buildQuickFixPostApplyVerification>[0];
  workflowRefreshReport?: ReturnType<typeof buildQuickFixWorkflowRefreshPreview>;
};

export function buildQuickFixRepairImpactReport(options: RepairImpactOptions = {}) {
  const workflow = hydrateRecruiterWorkflow({ statePath: options.statePath });
  const verification = buildQuickFixPostApplyVerification(options.verificationOptions);
  const workflowRefresh = options.workflowRefreshReport || buildQuickFixWorkflowRefreshPreview({
    statePath: options.statePath,
    verificationOptions: options.verificationOptions,
  });
  const statesById = new Map(workflow.states.map((state) => [state.candidateId, state]));
  const refreshById = new Map(workflowRefresh.items.map((item) => [item.candidateId, item]));

  const items = verification.items.map((item) => {
    const state = statesById.get(item.candidateId);
    const refresh = refreshById.get(item.candidateId);
    const before = state?.blockerReasons || [];
    const isVerified = item.verificationStatus === "verified_applied";
    const movedOutOfNeedsRepair = refresh?.workflowBefore === "needs_repair" && refresh.workflowAfterPreview !== "needs_repair";
    const becameReadyForShortlist = refresh?.workflowAfterPreview === "ready_for_shortlist" && refresh.workflowBefore !== "ready_for_shortlist";
    const improved = isVerified && (isVerified || movedOutOfNeedsRepair || becameReadyForShortlist);
    const resolved = improved ? before.filter((reason) => /company|employer|title|module|location|repair|missing/i.test(reason)) : [];
    const remaining = before.filter((reason) => !resolved.includes(reason));

    return {
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      fieldName: item.fieldName,
      verificationStatus: item.verificationStatus,
      workflowBefore: refresh?.workflowBefore || state?.currentStatus || "unknown",
      workflowAfterPreview: refresh?.workflowAfterPreview || state?.currentStatus || "unknown",
      movedOutOfNeedsRepair,
      becameReadyForShortlist,
      repairBlockersBefore: before,
      repairBlockersResolved: resolved,
      repairBlockersRemaining: remaining,
      impact: improved ? "candidate_improved" : "candidate_unchanged",
      safetyNote: "Read-only repair impact report. Candidate records are not updated.",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only quick fix repair impact audit; no candidate DB writes; no workflow state writes; no delete; no OpenAI calls",
    subsetItems: items.length,
    appliedVerified: verification.appliedVerified,
    pendingApply: verification.pendingApply,
    mismatch: verification.mismatch,
    repairBlockersBefore: items.reduce((sum, item) => sum + item.repairBlockersBefore.length, 0),
    repairBlockersResolved: items.reduce((sum, item) => sum + item.repairBlockersResolved.length, 0),
    repairBlockersRemaining: items.reduce((sum, item) => sum + item.repairBlockersRemaining.length, 0),
    candidatesImproved: items.filter((item) => item.impact === "candidate_improved").length,
    candidatesUnchanged: items.filter((item) => item.impact === "candidate_unchanged").length,
    movedOutOfNeedsRepair: workflowRefresh.wouldMoveOutOfNeedsRepair,
    becameReadyForShortlist: workflowRefresh.wouldBecomeReadyForShortlist,
    items,
  };
}

export function writeQuickFixRepairImpactReport(report: ReturnType<typeof buildQuickFixRepairImpactReport>, outputPath = path.join("reports", "quick-fix-repair-impact-report.json")) {
  return writeWorkflowJson(outputPath, report);
}


