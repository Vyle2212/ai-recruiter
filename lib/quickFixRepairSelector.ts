import fs from "node:fs";
import path from "node:path";
import { buildRepairQueueAudit } from "./repairQueueAudit";
import { planRepairBatches } from "./repairQueueBatchPlanner";
import type { RepairBatchPlan, RepairQueueItem } from "./repairQueueTypes";
import type { QuickFixRepairPlan, QuickFixTargetField } from "./quickFixRepairTypes";
import { generateQuickFixRepairSuggestions } from "./quickFixRepairSuggestionEngine";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

const SUPPORTED_FIELDS: QuickFixTargetField[] = ["currentCompany", "title", "primarySapModule", "location"];
const DEFAULT_HISTORY_PATHS = {
  cumulativeApply: path.join("reports", "quick-fix-cumulative-apply-history.json"),
  applyResult: path.join("reports", "quick-fix-subset-apply-result.json"),
  verification: path.join("reports", "quick-fix-post-apply-verification.json"),
  workflowRefresh: path.join("reports", "quick-fix-workflow-refresh-apply-result.json"),
  approvals: path.join("reports", "ai-extraction-approvals.json"),
  decisions: path.join("reports", "quick-fix-apply-decisions.json"),
  suggestions: path.join("reports", "quick-fix-repair-suggestions.json"),
  audit: path.join("reports", "quick-fix-repair-audit.json"),
  blockedHistory: path.join("reports", "quick-fix-blocked-history.json"),
};
type HistoryPaths = Partial<typeof DEFAULT_HISTORY_PATHS>;

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

function targetsFor(item: RepairQueueItem): QuickFixTargetField[] {
  return SUPPORTED_FIELDS.filter((field) => item.missingFields.includes(field));
}

function pairKey(candidateId: any, fieldName: any) { return `${clean(candidateId)}:${clean(fieldName)}`; }
function rows(file: any, names: string[]) { for (const name of names) if (Array.isArray(file?.[name])) return file[name]; return []; }

function loadPlanningHistory(overrides: HistoryPaths = {}, persistBlocked = false) {
  const paths = { ...DEFAULT_HISTORY_PATHS, ...overrides };
  const applied = new Set<string>(); const moved = new Set<string>(); const approvals = new Set<string>(); const held = new Set<string>(); const blocked = new Set<string>();
  for (const item of rows(readJson(paths.cumulativeApply), ["items"])) applied.add(pairKey(item.candidateId, item.fieldName));
  for (const item of rows(readJson(paths.applyResult), ["fieldAudit", "items"])) if (item?.applied !== false) applied.add(pairKey(item.candidateId, item.fieldName));
  for (const item of rows(readJson(paths.verification), ["items"])) if (/verified_applied|applied_verified|preserved_already_applied/i.test(clean(item?.verificationStatus || item?.status))) applied.add(pairKey(item.candidateId, item.fieldName));
  for (const item of rows(readJson(paths.workflowRefresh), ["updates", "items"])) if (clean(item?.candidateId)) moved.add(clean(item.candidateId));
  for (const item of rows(readJson(paths.approvals), ["approvals"])) approvals.add(pairKey(item.candidateId, item.fieldName));
  for (const item of rows(readJson(paths.decisions), ["decisions", "items"])) if (/^(hold_for_review|reject_suggestion|keep_existing|held|rejected)$/i.test(clean(item?.decision))) held.add(pairKey(item.candidateId, item.fieldName));
  for (const source of [readJson(paths.blockedHistory), readJson(paths.suggestions), readJson(paths.audit)]) for (const item of rows(source, ["items", "suggestions"])) if (clean(item?.validationStatus) === "blocked") blocked.add(pairKey(item.candidateId, item.fieldName));
  if (persistBlocked) writeWorkflowJson(paths.blockedHistory, { generatedAt: new Date().toISOString(), mode: "durable quick fix blocked history; planning only; no candidate DB writes; no workflow writes; no staging; no apply; no delete; no OpenAI calls", blockedPairs: blocked.size, items: Array.from(blocked).sort().map((pair) => { const split = pair.lastIndexOf(":"); return { candidateId: pair.slice(0, split), fieldName: pair.slice(split + 1), validationStatus: "blocked" }; }) });
  return { applied, moved, approvals, held, blocked };
}

export function isQuickFixItem(item: RepairQueueItem) {
  return item.priority === "P1" && item.repairCategory.startsWith("quick_fix") && targetsFor(item).length > 0;
}

function loadRepairItems(repairBatchesPath?: string, repairAuditPath?: string): RepairQueueItem[] {
  const batches = repairBatchesPath ? readJson(repairBatchesPath) as RepairBatchPlan | null : readJson(path.join("reports", "repair-queue-batches.json")) as RepairBatchPlan | null;
  if (Array.isArray(batches?.batches)) return batches.batches.flatMap((batch) => batch.items || []);
  const audit = repairAuditPath ? readJson(repairAuditPath) : readJson(path.join("reports", "repair-queue-audit.json"));
  if (Array.isArray(audit?.items)) return audit.items;
  return buildRepairQueueAudit().items;
}

export function buildQuickFixRepairPlan(options: { batchSize?: number; focus?: string; repairBatchesPath?: string; repairAuditPath?: string; batchIndex?: number; offset?: number; skipPreviouslyBlocked?: boolean; minSafeSuggestions?: number; historyPaths?: HistoryPaths } = {}): QuickFixRepairPlan {
  const batchSize = Number(options.batchSize || 25);
  const batchIndex = Math.max(0, Math.floor(Number(options.batchIndex || 0)));
  const requestedOffset = options.offset === undefined ? batchIndex * batchSize : Math.max(0, Math.floor(Number(options.offset || 0)));
  const focus = clean(options.focus || "all");
  const sourceItems = loadRepairItems(options.repairBatchesPath, options.repairAuditPath);
  const quickItems = sourceItems.filter(isQuickFixItem);
  const history = loadPlanningHistory(options.historyPaths, Boolean(options.skipPreviouslyBlocked));
  let excludedAlreadyAppliedCount = 0; let excludedExistingApprovalsCount = 0; let excludedPreviouslyBlockedCount = 0;
  const eligible = quickItems.flatMap((item) => {
    const candidateId = clean(item.candidateId); const remaining = targetsFor(item).filter((field) => {
      const pair = pairKey(candidateId, field);
      if (history.applied.has(pair) || history.moved.has(candidateId)) { excludedAlreadyAppliedCount++; return false; }
      if (history.approvals.has(pair) || history.held.has(pair)) { excludedExistingApprovalsCount++; return false; }
      if (options.skipPreviouslyBlocked && history.blocked.has(pair)) { excludedPreviouslyBlockedCount++; return false; }
      return true;
    });
    return remaining.length ? [{ ...item, missingFields: item.missingFields.filter((field) => !SUPPORTED_FIELDS.includes(field as QuickFixTargetField) || remaining.includes(field as QuickFixTargetField)) }] : [];
  });
  const planned = planRepairBatches(eligible, { batchSize, focus });
  const ordered = planned.batches.flatMap((batch) => batch.items || []);
  const minSafeSuggestions = Math.max(0, Math.floor(Number(options.minSafeSuggestions || 0)));
  let offset = requestedOffset; let selected = ordered.slice(offset, offset + planned.batchSize); let estimatedSafeSuggestions = 0;
  const makePlan = (items: RepairQueueItem[], planOffset: number): QuickFixRepairPlan => ({
    generatedAt: new Date().toISOString(),
    mode: "quick fix repair planning only; no candidate DB writes; no approvals write; no staging; no apply; no delete; no OpenAI calls",
    batchSize: planned.batchSize, batchIndex: Math.floor(planOffset / planned.batchSize), offset: planOffset, focus, quickFixCandidates: quickItems.length,
    selectedCandidates: items.length, selectedCandidateIds: items.map((item) => clean(item.candidateId)), excludedAlreadyAppliedCount, excludedPreviouslyBlockedCount, excludedExistingApprovalsCount,
    skipPreviouslyBlocked: Boolean(options.skipPreviouslyBlocked), minSafeSuggestions, estimatedSafeSuggestions,
    targetFields: Array.from(new Set(items.flatMap(targetsFor))) as QuickFixTargetField[],
    warnings: planned.warnings,
    errors: planned.errors,
    items: items.map((item) => ({
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      repairCategory: item.repairCategory,
      priority: item.priority,
      targetFields: targetsFor(item),
      missingFields: item.missingFields,
      evidenceAvailability: item.evidenceAvailability,
      safetyNote: "Quick fix plan is read-only. Candidate records are not updated.",
    })),
  });
  if (minSafeSuggestions > 0) {
    while (selected.length) {
      const suggestions = generateQuickFixRepairSuggestions(makePlan(selected, offset));
      estimatedSafeSuggestions = suggestions.summary.safeSuggestions;
      if (estimatedSafeSuggestions >= minSafeSuggestions) break;
      offset += planned.batchSize; selected = ordered.slice(offset, offset + planned.batchSize);
    }
  } else if (selected.length) estimatedSafeSuggestions = generateQuickFixRepairSuggestions(makePlan(selected, offset)).summary.safeSuggestions;
  const result = makePlan(selected, offset); result.estimatedSafeSuggestions = estimatedSafeSuggestions;
  if (selected.length && estimatedSafeSuggestions === 0) result.warnings.push("Selected batch may be unproductive; run with --batchIndex=<next> or --skipPreviouslyBlocked.");
  return result;
}

export function writeQuickFixRepairPlan(plan: QuickFixRepairPlan, outputPath = path.join("reports", "quick-fix-repair-plan.json")) {
  return writeWorkflowJson(outputPath, { ...plan, outputPath });
}
