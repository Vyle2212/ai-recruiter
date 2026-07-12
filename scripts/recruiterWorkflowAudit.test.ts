import assert from "node:assert/strict";
import { buildRecruiterWorkflowAudit } from "../lib/recruiterWorkflowAudit";

const candidates = [
  { id: "c1", name: "Jane Tan", current_company: "Accenture", current_title: "SAP FICO Lead", primary_module: "FICO", raw_text: "SAP FICO Accenture implementation 2019 2020 2021" },
  { id: "c2", name: "Profile Under Review", current_company: "", current_title: "" },
  { id: "c3", name: "Repair User", current_company: "", current_title: "SAP MM Consultant", extraction_decision_action: "mustRepairBeforeSearch" },
];
const report = buildRecruiterWorkflowAudit(candidates, { reviewPath: "missing-review.json", applyHistoryPath: "missing-history.json" });
assert.equal(report.totalCandidates, 3, "audit includes all candidates");
assert.equal(report.summary.actionRequiredToday, report.actionQueue.length, "audit summary counts statuses correctly");
assert.equal(report.actionQueue.some((item) => item.priority === "high"), true, "high priority actions generated");
assert.equal(report.mode.includes("no candidate DB writes"), true, "audit is read-only");

console.log("Recruiter workflow audit tests passed");
