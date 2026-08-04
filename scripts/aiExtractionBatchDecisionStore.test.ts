import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { previewBatchBulkDecision, applyBatchBulkDecision } from "../lib/aiExtractionBatchDecisionStore";
import { POST } from "../app/api/recruiter/ai-extraction-review/batch-decisions-preview/route";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "batch-decisions-"));
  const reviewPath = path.join(tmp, "review.json");
  const approvalsPath = path.join(tmp, "approvals.json");
  const applyHistoryPath = path.join(tmp, "history.json");
  writeJson(reviewPath, {
    queueItems: [{ candidateId: "c1", existingName: "Jane", source: "batch_promotion" }, { candidateId: "c2", existingName: "Bad", source: "batch_promotion" }],
    fieldComparisons: [
      { candidateId: "c1", source: "batch_promotion", fieldComparisons: [{ field: "currentCompany", existingValue: "", aiValue: "Acme", evidence: "Employer Acme", confidence: 95, decision: "safe_accept", source: "batch_promotion" }] },
      { candidateId: "c2", source: "batch_promotion", fieldComparisons: [{ field: "unsupportedField", existingValue: "", aiValue: "Value", evidence: "Evidence", confidence: 95, decision: "safe_accept", source: "batch_promotion" }] },
    ],
  });
  writeJson(approvalsPath, { mode: "local", updatedAt: "", approvals: [{ approvalId: "existing:title", candidateId: "existing", fieldName: "title", decision: "keep_existing" }] });
  writeJson(applyHistoryPath, { items: [] });
  const beforeApprovals = fs.readFileSync(approvalsPath, "utf8");
  const preview = previewBatchBulkDecision({ decision: "approve_safe", reviewPath, approvalsPath, applyHistoryPath });
  assert.equal(preview.summary.wouldApproveCount, 1, "preview selects one safe approval");
  assert.equal(fs.readFileSync(approvalsPath, "utf8"), beforeApprovals, "preview bulk approve does not write approvals file");
  const applyApprove = applyBatchBulkDecision({ decision: "approve_safe", reviewPath, approvalsPath, applyHistoryPath, writeApprovalsFile: true }) as any;
  assert.equal(applyApprove.writtenCount, 1, "apply bulk approve writes approvals file");
  const afterApprove = fs.readFileSync(approvalsPath, "utf8");
  assert.notEqual(afterApprove, beforeApprovals, "approval file changed after explicit write");
  assert.equal(JSON.parse(afterApprove).approvals.some((approval: any) => approval.source === "batch_decision_workflow"), true, "approval metadata added");
  const applyReject = applyBatchBulkDecision({ decision: "reject_invalid", reviewPath, approvalsPath, applyHistoryPath, writeApprovalsFile: true }) as any;
  assert.equal(applyReject.summary.wouldRejectCount, 1, "apply bulk reject writes only approvals file candidates");
  const preserveAgain = applyBatchBulkDecision({ decision: "approve_safe", reviewPath, approvalsPath, applyHistoryPath, writeApprovalsFile: true }) as any;
  assert.equal(preserveAgain.writtenCount, 0, "overwrite disabled by default");
  assert.ok(fs.existsSync(approvalsPath), "approvals file exists");
  const apiResponse = await POST({ json: async () => ({ decision: "approve_safe", source: "batch_promotion", outputPath: path.join(tmp, "api-preview.json") }) } as any);
  const apiJson = await apiResponse.json();
  assert.equal(Boolean(apiJson.summary), true, "API preview returns summary");
  const source = fs.readFileSync(new URL("../lib/aiExtractionBatchDecisionStore.ts", import.meta.url), "utf8") + fs.readFileSync(new URL("../lib/aiExtractionBatchDecisionWorkflow.ts", import.meta.url), "utf8");
  assert.equal(/\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source), false, "no candidate DB writes and no delete");
  assert.equal(/writeFileSync\([^)]*ai-extraction-staging\.json/i.test(source), false, "no staging writes");
  assert.equal(/applyCandidateChangesFromStaging|rollbackCandidate|confirmApply|confirmRollback/i.test(source), false, "no real apply or rollback calls");
  assert.equal(/from ["']openai["']|new\s+OpenAI\b/i.test(source), false, "no OpenAI calls");
  console.log("AI extraction batch decision store tests passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
