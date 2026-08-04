import assert from "node:assert/strict";
import { planRepairBatches, validateRepairBatchSize } from "../lib/repairQueueBatchPlanner";
const item = (id: string, category = "quick_fix_missing_company") => ({ repairId: id, candidateId: id, candidateName: id, workflowStatus: "needs_repair", repairCategory: category, categories: [category], priority: "P1", missingFields: ["currentCompany"], evidenceAvailability: "good_evidence", recommendedRepairAction: "fix", blockerReason: "missing", suggestedBatch: "company_title_quick_fix", readyAfterQuickFix: true, safetyNote: "safe", sortScore: 1 } as any);
assert.equal(validateRepairBatchSize(undefined).batchSize, 25, "batch size default 25");
assert.equal(validateRepairBatchSize(51).ok, false, "batch > 50 rejected");
const plan = planRepairBatches([item("c1"), item("c2", "ai_extractable")], { batchSize: 25, focus: "quick_fix_missing_company" });
assert.equal(plan.batches[0].items.length, 1, "focus filter works");
console.log("Repair queue batch planner tests passed");
