import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildQuickFixApprovalPreview } from "../lib/quickFixRepairApprovalBridge";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quick-fix-approval-"));
const approvalsPath = path.join(tmp, "ai-extraction-approvals.json");
const suggestion: any = { suggestionId: "c1:currentCompany", candidateId: "c1", candidateName: "Candidate", fieldName: "currentCompany", currentValue: "", suggestedValue: "Acme", confidence: 92, confidenceBand: "high", evidenceSource: "structured", evidenceSnippet: "Acme", repairCategory: "quick_fix_missing_company", priority: "P1", validationStatus: "safe_suggestion", approvalReadiness: "ready_for_manual_approval", validationReasons: [], safetyNote: "review" };
const preview = buildQuickFixApprovalPreview({ generatedAt: "", mode: "test", candidatesProcessed: 1, suggestions: [suggestion], summary: {} as any }, { approvalsPath });
assert.equal(preview.wouldCreateApprovalDecisions, 1, "approval preview creates review decisions");
assert.equal(fs.existsSync(approvalsPath), false, "approval preview does not write approvals file");
fs.writeFileSync(approvalsPath, JSON.stringify({ approvals: [{ approvalId: "c1:currentCompany", candidateId: "c1", fieldName: "currentCompany" }] }));
const preserved = buildQuickFixApprovalPreview({ generatedAt: "", mode: "test", candidatesProcessed: 1, suggestions: [suggestion], summary: {} as any }, { approvalsPath });
assert.equal(preserved.wouldPreserveExistingApprovals, 1, "existing approval preserved");
console.log("Quick fix repair approval bridge tests passed");
