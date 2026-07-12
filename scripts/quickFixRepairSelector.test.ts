import assert from "node:assert/strict";
import { buildQuickFixRepairPlan, isQuickFixItem } from "../lib/quickFixRepairSelector";

const item: any = { priority: "P1", repairCategory: "quick_fix_missing_company", missingFields: ["currentCompany"] };
assert.equal(isQuickFixItem(item), true, "selects P1 quick fix candidates");
const plan = buildQuickFixRepairPlan({ batchSize: 25, focus: "quick_fix_missing_company" });
assert.equal(plan.focus, "quick_fix_missing_company", "focus quick_fix_missing_company works");
assert.equal(plan.items.every((entry) => entry.targetFields.includes("currentCompany")), true, "focused plan targets company fixes");
console.log("Quick fix repair selector tests passed");
