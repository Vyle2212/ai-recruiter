import path from "node:path";
import { hydrateRecruiterWorkflow } from "./recruiterWorkflowStateHydration";
import { buildQuickFixPostApplyVerification } from "./quickFixPostApplyVerification";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

export function buildQuickFixRepairImpactReport() {
  const workflow = hydrateRecruiterWorkflow();
  const verification = buildQuickFixPostApplyVerification();
  const statesById = new Map(workflow.states.map((state) => [state.candidateId, state]));
  const items = verification.items.map((item) => {
    const state = statesById.get(item.candidateId);
    const before = state?.blockerReasons || [];
    const resolved = item.verificationStatus === "verified_applied" ? before.filter((reason) => /company|employer/i.test(reason)) : [];
    const remaining = before.filter((reason) => !resolved.includes(reason));
    return { candidateId: item.candidateId, candidateName: item.candidateName, fieldName: item.fieldName, repairBlockersBefore: before, repairBlockersResolved: resolved, repairBlockersRemaining: remaining, impact: resolved.length ? "candidate_improved" : "candidate_unchanged", safetyNote: "Read-only repair impact report. Candidate records are not updated." };
  });
  return { generatedAt: new Date().toISOString(), mode: "read-only quick fix repair impact audit; no candidate DB writes; no workflow state writes; no delete; no OpenAI calls", subsetItems: items.length, repairBlockersBefore: items.reduce((sum, item) => sum + item.repairBlockersBefore.length, 0), repairBlockersResolved: items.reduce((sum, item) => sum + item.repairBlockersResolved.length, 0), repairBlockersRemaining: items.reduce((sum, item) => sum + item.repairBlockersRemaining.length, 0), candidatesImproved: items.filter((item) => item.impact === "candidate_improved").length, candidatesUnchanged: items.filter((item) => item.impact === "candidate_unchanged").length, items };
}
export function writeQuickFixRepairImpactReport(report: ReturnType<typeof buildQuickFixRepairImpactReport>, outputPath = path.join("reports", "quick-fix-repair-impact-report.json")) { return writeWorkflowJson(outputPath, report); }
