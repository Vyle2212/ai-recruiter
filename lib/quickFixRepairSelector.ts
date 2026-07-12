import fs from "node:fs";
import path from "node:path";
import { buildRepairQueueAudit } from "./repairQueueAudit";
import { planRepairBatches } from "./repairQueueBatchPlanner";
import type { RepairBatchPlan, RepairQueueItem } from "./repairQueueTypes";
import type { QuickFixRepairPlan, QuickFixTargetField } from "./quickFixRepairTypes";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

const SUPPORTED_FIELDS: QuickFixTargetField[] = ["currentCompany", "title", "primarySapModule", "location"];

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

export function buildQuickFixRepairPlan(options: { batchSize?: number; focus?: string; repairBatchesPath?: string; repairAuditPath?: string } = {}): QuickFixRepairPlan {
  const batchSize = Number(options.batchSize || 25);
  const focus = clean(options.focus || "all");
  const sourceItems = loadRepairItems(options.repairBatchesPath, options.repairAuditPath);
  const quickItems = sourceItems.filter(isQuickFixItem);
  const planned = planRepairBatches(quickItems, { batchSize, focus });
  const selected = planned.batches.flatMap((batch) => batch.items || []).slice(0, planned.batchSize);
  const targetFields = Array.from(new Set(selected.flatMap(targetsFor))) as QuickFixTargetField[];
  return {
    generatedAt: new Date().toISOString(),
    mode: "quick fix repair planning only; no candidate DB writes; no approvals write; no staging; no apply; no delete; no OpenAI calls",
    batchSize: planned.batchSize,
    focus,
    quickFixCandidates: quickItems.length,
    selectedCandidates: selected.length,
    targetFields,
    warnings: planned.warnings,
    errors: planned.errors,
    items: selected.map((item) => ({
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      repairCategory: item.repairCategory,
      priority: item.priority,
      targetFields: targetsFor(item),
      missingFields: item.missingFields,
      evidenceAvailability: item.evidenceAvailability,
      safetyNote: "Quick fix plan is read-only. Candidate records are not updated.",
    })),
  };
}

export function writeQuickFixRepairPlan(plan: QuickFixRepairPlan, outputPath = path.join("reports", "quick-fix-repair-plan.json")) {
  return writeWorkflowJson(outputPath, { ...plan, outputPath });
}
