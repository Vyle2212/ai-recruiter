import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "./candidateAudit";
import { hydrateRecruiterWorkflow } from "./recruiterWorkflowStateHydration";
import { buildSmartShortlistCards, summarizeSmartShortlist } from "./smartShortlist";

function readReport(name: string) { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "reports", name), "utf8")); } catch { return null; } }
export async function loadSmartShortlistBoard() {
  const [{ candidates }, workflow] = await Promise.all([loadRealTalentPoolCandidates(), Promise.resolve(hydrateRecruiterWorkflow())]);
  const cards = buildSmartShortlistCards(candidates, workflow.states, { approvals: readReport("ai-extraction-approvals.json"), decisions: readReport("quick-fix-apply-decisions.json"), history: readReport("candidate-apply-history.json") || readReport("quick-fix-post-apply-verification.json") });
  const totalCandidates = Number(workflow.summary?.totalCandidates ?? candidates.length);
  const needsRepair = Number(workflow.summary?.needsRepair ?? workflow.states.filter((state) => state.currentStatus === "needs_repair").length);
  return { generatedAt: new Date().toISOString(), workflowGeneratedAt: workflow.generatedAt, source: workflow.stateSource === "saved workflow state" ? "persisted workflow state" : "rebuilt fallback", mode: "read-only Smart Shortlist; no candidate DB writes", summary: summarizeSmartShortlist(cards, totalCandidates, needsRepair), filters: { completeness: ["high", "medium", "low"], verification: ["recruiter_approved", "needs_candidate_confirmation", "missing_company", "missing_title", "missing_location"], sorts: ["completeness_desc", "recently_updated", "name", "company", "needs_confirmation_first"], includeNeedsRepairDefault: false }, candidates: cards.map(({ profile, ...card }) => card) };
}

