import fs from "node:fs";
import path from "node:path";
import type { AiExtractionApproval } from "./aiExtractionApprovalStore";
import { buildAiExtractionStagingPreview, type AiExtractionStagingRecord } from "./aiExtractionStagingPreview";
import { writeStagingStore } from "./aiExtractionStagingStore";
import { buildReviewWorkspace, type ReviewWorkspace } from "./aiExtractionReviewUi";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

export type QuickFixStagingRefreshPaths = {
  approvalsPath: string; applyResultPath: string; verificationPath: string; workflowRefreshPath: string;
  decisionsPath: string; reviewPath: string; applyPlanPath: string; workflowStatePath: string; cumulativeHistoryPath: string;
  stagingPath: string; previewPath: string; resultPath: string;
};

export type QuickFixCumulativeApplyHistoryItem = {
  candidateId: string; fieldName: string; dbFieldName: string; appliedValue: string;
  sourceBatchOrResultPath: string; appliedAt: string; verificationStatus: string;
};

export type QuickFixStagingRefreshReport = {
  generatedAt: string; mode: string; writeStaging: boolean; approvalsLoaded: number; validApprovalItems: number;
  alreadyAppliedExcluded: number; preservedHeldRejectedExcluded: number; newStagingItemsReady: number;
  wouldWriteStagingItems: number; stagingItemsWritten: number; stagingPath: string; outputPath: string;
  items: AiExtractionStagingRecord[];
  excludedAlreadyApplied: Array<{ candidateId: string; fieldName: string }>;
  excludedPreservedHeldRejected: Array<{ candidateId: string; fieldName: string }>;
};

function clean(value: unknown) { return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim(); }
function key(candidateId: unknown, fieldName: unknown) { return `${clean(candidateId)}:${clean(fieldName)}`; }
function readJson(filePath: string) { const fullPath = path.resolve(filePath); if (!fs.existsSync(fullPath)) return null; try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; } }
function rows(value: any, names: string[]) { for (const name of names) if (Array.isArray(value?.[name])) return value[name]; return []; }

export function quickFixStagingRefreshPaths(baseDir = process.cwd()): QuickFixStagingRefreshPaths {
  const report = (name: string) => path.join(baseDir, "reports", name);
  return {
    approvalsPath: report("ai-extraction-approvals.json"), applyResultPath: report("quick-fix-subset-apply-result.json"),
    verificationPath: report("quick-fix-post-apply-verification.json"), workflowRefreshPath: report("quick-fix-workflow-refresh-apply-result.json"),
    decisionsPath: report("quick-fix-apply-decisions.json"), reviewPath: report("ai-extraction-review.json"),
    applyPlanPath: report("ai-extraction-apply-plan.json"), workflowStatePath: report("recruiter-workflow-state.json"),
    cumulativeHistoryPath: report("quick-fix-cumulative-apply-history.json"), stagingPath: report("ai-extraction-staging.json"),
    previewPath: report("quick-fix-staging-refresh-preview.json"), resultPath: report("quick-fix-staging-refresh-result.json"),
  };
}

export function canWriteQuickFixStaging(writeStaging: boolean, confirmQuickFixStagingRefresh: boolean) { return writeStaging && confirmQuickFixStagingRefresh; }

function dbFieldName(fieldName: string) { return fieldName === "currentCompany" ? "current_company" : fieldName === "primarySapModule" ? "primary_sap_module" : fieldName; }

export function buildQuickFixCumulativeApplyHistory(paths: QuickFixStagingRefreshPaths, approvals: AiExtractionApproval[]) {
  const byPair = new Map<string, QuickFixCumulativeApplyHistoryItem>();
  const existing = readJson(paths.cumulativeHistoryPath);
  for (const item of rows(existing, ["items"])) if (clean(item?.candidateId) && clean(item?.fieldName)) byPair.set(key(item.candidateId, item.fieldName), item);
  const approvalsByCandidate = new Map<string, any[]>();
  for (const approval of approvals) {
    const list = approvalsByCandidate.get(clean(approval.candidateId)) || []; list.push(approval); approvalsByCandidate.set(clean(approval.candidateId), list);
  }
  const add = (item: any, sourcePath: string, appliedAt: string, verificationStatus: string) => {
    const candidateId = clean(item?.candidateId); const fieldName = clean(item?.fieldName); if (!candidateId || !fieldName) return;
    const pair = key(candidateId, fieldName); const previous = byPair.get(pair);
    byPair.set(pair, { candidateId, fieldName, dbFieldName: clean(item?.dbFieldName || item?.candidateField) || dbFieldName(fieldName), appliedValue: clean(item?.appliedValue || item?.approvedValue || item?.finalDbValue || item?.to) || previous?.appliedValue || "", sourceBatchOrResultPath: previous?.sourceBatchOrResultPath || sourcePath, appliedAt: previous?.appliedAt || appliedAt, verificationStatus: /verified/i.test(verificationStatus) ? verificationStatus : previous?.verificationStatus || verificationStatus });
  };
  const applyResult = readJson(paths.applyResultPath);
  for (const item of rows(applyResult, ["fieldAudit", "items"])) if (item?.applied !== false) add(item, paths.applyResultPath, clean(applyResult?.exportedAt || applyResult?.generatedAt), "applied");
  const verification = readJson(paths.verificationPath);
  for (const item of rows(verification, ["items"])) if (/verified_applied|applied_verified|preserved_already_applied/i.test(clean(item?.verificationStatus || item?.status))) add(item, paths.verificationPath, clean(verification?.generatedAt), clean(item?.verificationStatus || item?.status));
  const workflow = readJson(paths.workflowStatePath);
  for (const state of rows(workflow, ["states"])) if (clean(state?.applyHistoryStatus) === "quick_fix_verified_applied") {
    for (const approval of approvalsByCandidate.get(clean(state.candidateId)) || []) if (clean(approval?.decision) === "approve_suggestion") add({ ...approval, appliedValue: approval.suggestedValue }, paths.workflowStatePath, clean(state?.lastUpdatedAt), "verified_applied_from_workflow_history");
  }
  const workflowRefresh = readJson(paths.workflowRefreshPath);
  for (const update of rows(workflowRefresh, ["updates", "items"])) for (const approval of approvalsByCandidate.get(clean(update.candidateId)) || []) if (clean(approval?.decision) === "approve_suggestion") add({ ...approval, appliedValue: approval.suggestedValue }, paths.workflowRefreshPath, clean(workflowRefresh?.generatedAt), "verified_applied_from_workflow_refresh");
  const items = Array.from(byPair.values()).sort((a, b) => key(a.candidateId, a.fieldName).localeCompare(key(b.candidateId, b.fieldName)));
  writeWorkflowJson(paths.cumulativeHistoryPath, { generatedAt: new Date().toISOString(), mode: "durable cumulative quick fix apply history; reconstructed from local reports only; no candidate DB writes; no workflow writes; no apply; no delete; no OpenAI calls", appliedPairs: items.length, items });
  return items;
}

function processedHistory(paths: QuickFixStagingRefreshPaths, approvals: AiExtractionApproval[]) {
  const appliedPairs = new Set(buildQuickFixCumulativeApplyHistory(paths, approvals).map((item) => key(item.candidateId, item.fieldName))); const heldPairs = new Set<string>();
  for (const item of rows(readJson(paths.decisionsPath), ["decisions", "items"])) if (/^(hold_for_review|reject_suggestion|keep_existing|held|rejected)$/i.test(clean(item?.decision))) heldPairs.add(key(item.candidateId, item.fieldName));
  return { appliedPairs, heldPairs };
}

export function loadQuickFixStagingRefreshInputs(paths: QuickFixStagingRefreshPaths) {
  const approvalsFile = readJson(paths.approvalsPath); const review = readJson(paths.reviewPath); const applyPlan = readJson(paths.applyPlanPath);
  const approvals = (Array.isArray(approvalsFile?.approvals) ? approvalsFile.approvals : []) as AiExtractionApproval[];
  const workspace = buildReviewWorkspace(review, applyPlan, null, { reviewReportFound: Boolean(review), applyPlanFound: Boolean(applyPlan), aiResultsFound: false });
  return { approvals, workspace };
}

export function buildQuickFixStagingRefresh(options: { paths?: QuickFixStagingRefreshPaths; approvals?: AiExtractionApproval[]; workspace?: ReviewWorkspace; writeStaging?: boolean; confirmQuickFixStagingRefresh?: boolean } = {}): QuickFixStagingRefreshReport {
  const paths = options.paths || quickFixStagingRefreshPaths();
  const loaded = options.approvals && options.workspace ? { approvals: options.approvals, workspace: options.workspace } : loadQuickFixStagingRefreshInputs(paths);
  const validItems = buildAiExtractionStagingPreview(loaded.workspace, loaded.approvals).items;
  const history = processedHistory(paths, loaded.approvals); const excludedAlreadyApplied: QuickFixStagingRefreshReport["excludedAlreadyApplied"] = []; const excludedPreservedHeldRejected: QuickFixStagingRefreshReport["excludedPreservedHeldRejected"] = [];
  const items = validItems.filter((item) => {
    const pair = key(item.candidateId, item.fieldName);
    if (history.appliedPairs.has(pair)) { excludedAlreadyApplied.push({ candidateId: item.candidateId, fieldName: item.fieldName }); return false; }
    if (history.heldPairs.has(pair)) { excludedPreservedHeldRejected.push({ candidateId: item.candidateId, fieldName: item.fieldName }); return false; }
    return true;
  });
  const writeStaging = canWriteQuickFixStaging(Boolean(options.writeStaging), Boolean(options.confirmQuickFixStagingRefresh)); const outputPath = writeStaging ? paths.resultPath : paths.previewPath;
  if (writeStaging) writeStagingStore(items, path.dirname(path.dirname(paths.stagingPath)));
  const report: QuickFixStagingRefreshReport = {
    generatedAt: new Date().toISOString(), mode: writeStaging ? "confirmed quick fix staging refresh; staging file updates only; no candidate DB writes; no workflow writes; no apply; no delete; no OpenAI calls" : "quick fix staging refresh preview only; staging file not changed; no candidate DB writes; no workflow writes; no apply; no delete; no OpenAI calls",
    writeStaging, approvalsLoaded: loaded.approvals.length, validApprovalItems: validItems.length, alreadyAppliedExcluded: excludedAlreadyApplied.length,
    preservedHeldRejectedExcluded: excludedPreservedHeldRejected.length, newStagingItemsReady: items.length, wouldWriteStagingItems: items.length,
    stagingItemsWritten: writeStaging ? items.length : 0, stagingPath: paths.stagingPath, outputPath, items, excludedAlreadyApplied, excludedPreservedHeldRejected,
  };
  writeWorkflowJson(outputPath, report); return report;
}

export function auditQuickFixStagingRefresh(options: { paths?: QuickFixStagingRefreshPaths; approvals?: AiExtractionApproval[]; workspace?: ReviewWorkspace } = {}) {
  const paths = options.paths || quickFixStagingRefreshPaths(); const expected = buildQuickFixStagingRefresh({ paths, approvals: options.approvals, workspace: options.workspace }); const staged = rows(readJson(paths.stagingPath), ["items"]);
  const stagedByKey = new Map(staged.map((item: any) => [key(item.candidateId, item.fieldName), item]));
  const foundItems = expected.items.filter((item) => stagedByKey.has(key(item.candidateId, item.fieldName)));
  const mismatch = foundItems.filter((item) => {
    const stagedItem: any = stagedByKey.get(key(item.candidateId, item.fieldName));
    return clean(stagedItem?.approvedValue) !== clean(item.approvedValue) || clean(stagedItem?.sourceApprovalId) !== clean(item.sourceApprovalId);
  }).length;
  return { generatedAt: new Date().toISOString(), mode: "read-only quick fix staging refresh audit; no candidate DB writes; no workflow writes; no apply; no delete; no OpenAI calls", stagingItemsExpected: expected.items.length, stagingItemsFound: foundItems.length, alreadyAppliedExcluded: expected.alreadyAppliedExcluded, pendingStagingItems: expected.items.length - foundItems.length, mismatch };
}

export function writeQuickFixStagingRefreshAudit(audit: ReturnType<typeof auditQuickFixStagingRefresh>, outputPath = path.join("reports", "quick-fix-staging-refresh-audit.json")) { return writeWorkflowJson(outputPath, audit); }
