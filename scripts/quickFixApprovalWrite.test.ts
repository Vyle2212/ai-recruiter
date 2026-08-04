import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildQuickFixApprovalWriteResult, writeQuickFixApprovalWriteReport } from "../lib/quickFixApprovalWrite";
import { buildQuickFixReviewPromotion } from "../lib/quickFixReviewPromotion";

function suggestion(overrides: any = {}) {
  return { suggestionId: "c1:currentCompany", candidateId: "c1", candidateName: "Candidate", fieldName: "currentCompany", currentValue: "", suggestedValue: "Acme Consulting", confidence: 92, confidenceBand: "high", evidenceSource: "structured", evidenceSnippet: "Acme Consulting | SAP Consultant", repairCategory: "quick_fix_missing_company", priority: "P1", validationStatus: "safe_suggestion", approvalReadiness: "ready_for_manual_approval", validationReasons: [], safetyNote: "review", ...overrides };
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quick-fix-write-"));
const suggestionsPath = path.join(tmp, "suggestions.json");
const approvalsPath = path.join(tmp, "ai-extraction-approvals.json");
const reviewPath = path.join(tmp, "ai-extraction-review.json");
const outputPath = path.join(tmp, "preview.json");
fs.writeFileSync(reviewPath, JSON.stringify({ exportedAt: "", summary: {}, queueItems: [], fieldComparisons: [] }));
fs.writeFileSync(suggestionsPath, JSON.stringify({ generatedAt: "", mode: "test", candidatesProcessed: 2, suggestions: [suggestion(), suggestion({ suggestionId: "c2:title", candidateId: "c2", fieldName: "title", suggestedValue: "SAP MM Consultant", evidenceSnippet: "SAP MM Consultant", validationStatus: "needs_manual_review" }), suggestion({ suggestionId: "c3:currentCompany", candidateId: "c3", suggestedValue: "Client", validationStatus: "blocked" })], summary: {} }));
const missingReview = buildQuickFixApprovalWriteResult({ suggestionsPath, approvalsPath, reviewPath, outputPath });
assert.equal(missingReview.summary.approvalDecisionsReady, 0, "approval write blocks if matching review item missing");
assert.equal(missingReview.blocked.some((item) => item.blockReasons.includes("missing matching review item; promote quick-fix suggestion to review first")), true, "missing review reason reported");
buildQuickFixReviewPromotion({ suggestionsPath, reviewPath, writeReviewFile: true });
const preview = buildQuickFixApprovalWriteResult({ suggestionsPath, approvalsPath, reviewPath, outputPath });
assert.equal(preview.summary.approvalDecisionsReady, 2, "safe and manual review suggestions converted after promotion");
assert.equal(preview.summary.suggestionsBlocked, 1, "blocked suggestions not written");
assert.equal(fs.existsSync(approvalsPath), false, "preview does not write approvals file");
assert.equal(preview.approvals[0].source, "quick_fix_repair", "metadata source=quick_fix_repair included");
const write = buildQuickFixApprovalWriteResult({ suggestionsPath, approvalsPath, reviewPath, outputPath: path.join(tmp, "result.json"), writeApprovalsFile: true });
writeQuickFixApprovalWriteReport(write);
assert.equal(fs.existsSync(approvalsPath), true, "writeApprovalsFile writes only approvals file");
const stored = JSON.parse(fs.readFileSync(approvalsPath, "utf8"));
assert.equal(stored.approvals.length, 2, "approval decisions written");
const preserved = buildQuickFixApprovalWriteResult({ suggestionsPath, approvalsPath, reviewPath, outputPath: path.join(tmp, "preserved.json") });
assert.equal(preserved.summary.existingApprovalsPreserved, 2, "overwrite disabled by default");
async function checkApiPreview() {
  const route = await import("../app/api/recruiter/quick-fix-repair/approvals-write-preview/route");
  const response: any = await route.GET();
  const json = await response.json();
  assert.equal(Boolean(json.summary), true, "API preview returns summary");
}
checkApiPreview().then(() => console.log("Quick fix approval write tests passed"));
