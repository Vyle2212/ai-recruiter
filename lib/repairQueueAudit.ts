import fs from "node:fs";
import path from "node:path";
import { hydrateRecruiterWorkflow } from "./recruiterWorkflowStateHydration";
import { classifyRepairCandidate } from "./repairQueueClassifier";
import { prioritizeRepairQueue } from "./repairQueuePrioritizer";
import { summarizeRepairQueue } from "./repairQueueSummary";
import type { RepairQueueAuditReport } from "./repairQueueTypes";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null };
  try { return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) }; } catch { return { found: true, data: null }; }
}

function candidateMap(fullExtraction: any) {
  return new Map((Array.isArray(fullExtraction?.items) ? fullExtraction.items : []).map((item: any) => [String(item.candidateId), item]));
}

export function buildRepairQueueAudit(options: { statePath?: string; fullExtractionPath?: string; applyHistoryPath?: string } = {}): RepairQueueAuditReport {
  const fullExtractionPath = options.fullExtractionPath || path.join("reports", "full-candidate-extraction.json");
  const applyHistoryPath = options.applyHistoryPath || path.join("reports", "candidate-apply-history.json");
  const aiReviewPath = path.join("reports", "ai-extraction-review.json");
  const approvalsPath = path.join("reports", "ai-extraction-approvals.json");
  const stagingPath = path.join("reports", "ai-extraction-staging.json");
  const workflow = hydrateRecruiterWorkflow({ statePath: options.statePath });
  const fullExtraction = readJson(fullExtractionPath);
  const applyHistory = readJson(applyHistoryPath);
  const aiReview = readJson(aiReviewPath);
  const approvals = readJson(approvalsPath);
  const staging = readJson(stagingPath);
  const candidates = candidateMap(fullExtraction.data);
  const repairStates = workflow.states.filter((state) => state.currentStatus === "needs_repair");
  const items = prioritizeRepairQueue(repairStates.flatMap((state) => {
    const item = classifyRepairCandidate(state, candidates.get(state.candidateId), applyHistory.data);
    return item ? [item] : [];
  }));
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only repair queue audit; no candidate DB writes; no staging; no apply; no rollback; no delete; no OpenAI calls",
    totalWorkflowStates: workflow.states.length,
    needsRepairCandidates: repairStates.length,
    summary: summarizeRepairQueue(items),
    items,
    files: {
      workflowState: workflow.files.workflowState,
      fullExtraction: { path: fullExtractionPath, found: fullExtraction.found },
      applyHistory: { path: applyHistoryPath, found: applyHistory.found },
      aiReview: { path: aiReviewPath, found: aiReview.found },
      approvals: { path: approvalsPath, found: approvals.found },
      staging: { path: stagingPath, found: staging.found },
    },
  };
}

export function writeRepairQueueAudit(report: RepairQueueAuditReport, outputPath = path.join("reports", "repair-queue-audit.json")) {
  return writeWorkflowJson(outputPath, report);
}

export function writeRepairQueuePrioritization(report: RepairQueueAuditReport, outputPath = path.join("reports", "repair-queue-prioritization.json")) {
  return writeWorkflowJson(outputPath, report);
}

