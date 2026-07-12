import fs from "node:fs";
import path from "node:path";
import { loadQuickFixApplyDecisions } from "./quickFixApplyDecisionStore";
import { validateQuickFixSubsetDecision } from "./quickFixApplySubsetValidator";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}
function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export function buildQuickFixApplySubset(options: { decisionsPath?: string; stagingPath?: string } = {}) {
  const decisionsPath = options.decisionsPath || path.join("reports", "quick-fix-apply-decisions.json");
  const stagingPath = options.stagingPath || path.join("reports", "ai-extraction-staging.json");
  const decisionFile = loadQuickFixApplyDecisions(decisionsPath);
  const staging = readJson(stagingPath);
  const stagedItems = Array.isArray(staging?.items) ? staging.items : [];
  const stagingByKey = new Map(stagedItems.map((item: any) => [`${clean(item.candidateId)}:${clean(item.fieldName)}`, item]));
  const latestByKey = new Map<string, any>();
  for (const decision of decisionFile.decisions) latestByKey.set(`${clean(decision.candidateId)}:${clean(decision.fieldName)}`, decision);
  const subsetItems: any[] = [];
  const excludedItems: any[] = [];
  for (const decision of latestByKey.values()) {
    const stagingItem = stagingByKey.get(`${clean(decision.candidateId)}:${clean(decision.fieldName)}`);
    const validation = validateQuickFixSubsetDecision(decision, stagingItem);
    if (validation.ok) subsetItems.push({ ...(stagingItem as Record<string, any>), quickFixApplyDecision: decision, quickFixSubsetSafetyReasons: decision.safetyReasons || [] });
    else excludedItems.push({ decision, stagingItem: stagingItem || null, reasons: validation.reasons });
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: "subset write preview only; subset file not changed; no candidate DB writes",
    decisionsLoaded: decisionFile.decisions.length,
    stagedItemsLoaded: stagedItems.length,
    approvedDecisions: decisionFile.decisions.filter((d) => d.decision === "approve_for_apply").length,
    excludedCount: excludedItems.length,
    wouldWriteSubsetItems: subsetItems.length,
    subsetItems,
    excludedItems,
    outputPath: path.join("reports", "quick-fix-apply-subset-preview.json"),
  };
}

export function writeQuickFixApplySubsetFile(subset: ReturnType<typeof buildQuickFixApplySubset>, writeSubsetFile = false, outputPath = writeSubsetFile ? path.join("reports", "quick-fix-apply-subset.json") : path.join("reports", "quick-fix-apply-subset-preview.json")) {
  const data = { ...subset, mode: writeSubsetFile ? "subset file write only; no candidate DB writes" : subset.mode, outputPath };
  return writeWorkflowJson(outputPath, data);
}

