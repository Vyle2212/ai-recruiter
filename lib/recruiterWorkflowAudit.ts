import fs from "node:fs";
import path from "node:path";
import { auditCandidates } from "./candidateAudit";
import { buildActionQueue } from "./recruiterWorkflowActions";
import { buildWorkflowStates } from "./recruiterWorkflowState";
import { loadRecruiterWorkflowStore, writeWorkflowJson } from "./recruiterWorkflowStore";
import { summarizeWorkflow } from "./recruiterWorkflowSummary";
import type { RecruiterWorkflowState, WorkflowAuditReport } from "./recruiterWorkflowTypes";

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null };
  try { return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) }; } catch { return { found: true, data: null }; }
}

export function buildRecruiterWorkflowAudit(candidates: Record<string, any>[], options: { reviewPath?: string; applyHistoryPath?: string; baseDir?: string } = {}): WorkflowAuditReport {
  const reviewPath = options.reviewPath || path.join("reports", "ai-extraction-review.json");
  const applyHistoryPath = options.applyHistoryPath || path.join("reports", "candidate-apply-history.json");
  const review = readJson(reviewPath);
  const applyHistory = readJson(applyHistoryPath);
  const localState = loadRecruiterWorkflowStore(options.baseDir || process.cwd());
  const candidateAudit = auditCandidates(candidates);
  const states = buildWorkflowStates(candidates, { auditIssues: candidateAudit.issues, reviewReport: review.data, applyHistory: applyHistory.data, localState });
  const actionQueue = buildActionQueue(states);
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only workflow audit; no candidate DB writes; no delete; no OpenAI calls",
    totalCandidates: candidates.length,
    summary: summarizeWorkflow(states, actionQueue),
    states,
    actionQueue,
    blockedCandidates: states.filter((state) => state.validationBlockers.length || state.status === "needs_repair"),
    files: { review: { path: reviewPath, found: review.found }, applyHistory: { path: applyHistoryPath, found: applyHistory.found }, workflowState: { path: path.join("reports", "recruiter-workflow-state.json"), found: localState.states.length > 0 } },
  };
}


function stateFromQualityItem(item: any) {
  const candidateId = String(item.candidateId || item.id || "unknown").trim();
  const missingData = Array.isArray(item.missingFields) ? item.missingFields : [];
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  const statusText = String([item.status, item.reviewCategory, ...missingData, ...reasons].join(" ")).toLowerCase();
  let status: any = "new_profile";
  if (/must.?repair|repair|reupload/.test(statusText)) status = "needs_repair";
  else if (/blocked|validation|identity|duplicate/.test(statusText)) status = "needs_validation";
  else if (/search_ready|ready/.test(statusText)) status = "ready_for_shortlist";
  else if (/searchable_needs_enrichment/.test(statusText)) status = "needs_repair";
  else status = "validated";
  if (missingData.some((field: string) => /company|title|identity/.test(String(field)))) status = status === "ready_for_shortlist" ? "needs_repair" : status;
  return {
    workflowId: `workflow-${candidateId}`,
    candidateId,
    candidateName: String(item.name || item.candidateName || candidateId).trim(),
    status,
    source: "inferred" as const,
    reasons: reasons.length ? reasons : ["Workflow status inferred from local quality report"],
    missingData: missingData.map((field: any) => String(field)),
    validationBlockers: /blocked|validation|identity|duplicate/.test(statusText) ? reasons.map((reason: any) => String(reason)) : [],
    lastUpdated: new Date().toISOString(),
  };
}


function stateFromFullExtractionItem(item: any) {
  const candidateId = String(item.candidateId || item.id || "unknown").trim();
  const missingData: string[] = [];
  if (!item.displayName || item.isNameSuspicious || /blocked_identity/i.test(String(item.searchReadyBlocker || item.identityRecoveryFinalDecision))) missingData.push("identity");
  if (!item.currentCompany || item.currentCompany === "Not disclosed") missingData.push("currentCompany");
  if (!item.title) missingData.push("title");
  if (!item.primarySapModule) missingData.push("primarySapModule");
  let status: any = "validated";
  if (missingData.includes("identity")) status = "needs_validation";
  else if (missingData.includes("currentCompany") || missingData.includes("title")) status = "needs_repair";
  else if (item.searchReadyAfterQualityGate || item.searchReadyAfterExtraction || item.searchReadyBeforeQualityGate) status = "ready_for_shortlist";
  const reasons = missingData.length ? ["Missing " + missingData.join(", ")] : [String(item.searchReadyReason || "Workflow status inferred from full extraction report")];
  return {
    workflowId: `workflow-${candidateId}`,
    candidateId,
    candidateName: String(item.displayName || item.extractedFullName || item.name || candidateId).trim(),
    status,
    source: "inferred" as const,
    reasons,
    missingData,
    validationBlockers: missingData.includes("identity") ? reasons : [],
    lastUpdated: new Date().toISOString(),
  };
}

export function buildRecruiterWorkflowAuditFromReports(options: { qualityPath?: string; fullExtractionPath?: string; reviewPath?: string; applyHistoryPath?: string } = {}): WorkflowAuditReport {
  const qualityPath = options.qualityPath || path.join("reports", "searchable-profile-quality-review.json");
  const fullExtractionPath = options.fullExtractionPath || path.join("reports", "full-candidate-extraction.json");
  const reviewPath = options.reviewPath || path.join("reports", "ai-extraction-review.json");
  const applyHistoryPath = options.applyHistoryPath || path.join("reports", "candidate-apply-history.json");
  const quality = readJson(qualityPath);
  const fullExtraction = readJson(fullExtractionPath);
  const review = readJson(reviewPath);
  const applyHistory = readJson(applyHistoryPath);
  const qualityById = new Map((Array.isArray(quality.data?.items) ? quality.data.items : []).map((item: any) => [String(item.candidateId), item]));
  const sourceItems = Array.isArray(fullExtraction.data?.items) ? fullExtraction.data.items : (Array.isArray(quality.data?.items) ? quality.data.items : []);
  const states: RecruiterWorkflowState[] = sourceItems.map((item: any) => qualityById.has(String(item.candidateId)) ? stateFromQualityItem({ ...item, ...(qualityById.get(String(item.candidateId)) as any) }) : stateFromFullExtractionItem(item));
  const reviewIds = new Set((Array.isArray(review.data?.fieldComparisons) ? review.data.fieldComparisons : []).filter((item: any) => item.manualReviewRequired || item.aiAvailable).map((item: any) => String(item.candidateId)));
  const appliedIds = new Set((Array.isArray(applyHistory.data?.items) ? applyHistory.data.items : []).filter((item: any) => /applied_verified|preserved_already_applied/i.test(String(item.status))).map((item: any) => String(item.candidateId)));
  for (const state of states) {
    if (reviewIds.has(state.candidateId) && !["needs_repair", "needs_validation"].includes(state.status)) state.status = "ai_review_needed";
    if (appliedIds.has(state.candidateId) && !["needs_repair", "needs_validation", "ai_review_needed"].includes(state.status)) state.status = "ready_for_shortlist";
  }
  const actionQueue = buildActionQueue(states);
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only workflow audit from local reports; no candidate DB writes; no delete; no OpenAI calls",
    totalCandidates: states.length,
    summary: summarizeWorkflow(states, actionQueue),
    states,
    actionQueue,
    blockedCandidates: states.filter((state) => state.validationBlockers.length || state.status === "needs_repair"),
    files: { quality: { path: qualityPath, found: quality.found }, fullExtraction: { path: fullExtractionPath, found: fullExtraction.found }, review: { path: reviewPath, found: review.found }, applyHistory: { path: applyHistoryPath, found: applyHistory.found } },
  };
}

export function writeRecruiterWorkflowAudit(report: WorkflowAuditReport, outputPath = path.join("reports", "recruiter-workflow-audit.json")) {
  return writeWorkflowJson(outputPath, report);
}
