import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildBatchReviewPromotion, convertBatchDryRunToReviewItems, writeBatchReviewPromotionReport, writePromotedReviewFile } from "../lib/aiExtractionBatchReviewPromotion";
import { emptyBatchReviewPromotionSummary } from "../lib/aiExtractionBatchReviewSummary";
import { POST } from "../app/api/recruiter/ai-extraction-review/batch-promote/route";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "batch-promotion-"));
const batchDryRunPath = path.join(tmp, "batch-dry-run.json");
const reviewPath = path.join(tmp, "review.json");
const approvalsPath = path.join(tmp, "approvals.json");
const applyHistoryPath = path.join(tmp, "history.json");
const outputPath = path.join(tmp, "promotion.json");
writeJson(batchDryRunPath, {
  generatedAt: "batch-1",
  items: [
    { candidateId: "c1", candidateName: "Jane FICO", targetFields: ["currentCompany", "title"], status: "dry_run_completed", reviewItemGenerated: true },
    { candidateId: "c2", candidateName: "Already Applied", targetFields: ["currentCompany"], status: "dry_run_completed", reviewItemGenerated: true },
    { candidateId: "c3", candidateName: "Bad Field", targetFields: ["unsupportedField"], status: "dry_run_completed", reviewItemGenerated: true },
  ],
});
writeJson(reviewPath, { exportedAt: "2026-07-11T00:00:00.000Z", queueItems: [{ candidateId: "c1", existingName: "Existing Jane" }], fieldComparisons: [{ candidateId: "c1", aiAvailable: true, fieldComparisons: [{ field: "currentCompany", aiValue: "Existing" }], safeChanges: [], riskyChanges: [], rejectedChanges: [], manualReviewRequired: true }] });
writeJson(approvalsPath, { approvals: [{ approvalId: "a1", candidateId: "c1", fieldName: "currentCompany", decision: "keep_existing" }] });
writeJson(applyHistoryPath, { items: [{ candidateId: "c2", fieldName: "currentCompany", status: "applied_verified" }] });
const approvalsBefore = fs.readFileSync(approvalsPath, "utf8");
const reviewBefore = fs.readFileSync(reviewPath, "utf8");

const converted = convertBatchDryRunToReviewItems(JSON.parse(fs.readFileSync(batchDryRunPath, "utf8")), JSON.parse(fs.readFileSync(applyHistoryPath, "utf8")));
assert.equal(converted.length, 4, "batch dry-run items converted to field-level review schema");
assert.equal(converted.find((item) => item.candidateId === "c1" && item.fieldName === "title")?.validationStatus, "needs_manual_review", "item without evidence marked needs_manual_review");
assert.equal(converted.find((item) => item.candidateId === "c2")?.validationStatus, "preserved_already_applied", "already applied classified preserved/blocked, not pending");
assert.equal(converted.find((item) => item.fieldName === "unsupportedField")?.validationStatus, "blocked", "unsupported field blocked");

const preview = buildBatchReviewPromotion({ batchDryRunPath, reviewPath, approvalsPath, applyHistoryPath });
writeBatchReviewPromotionReport(preview, outputPath);
assert.equal(fs.readFileSync(reviewPath, "utf8"), reviewBefore, "preview promotion does not write review file");
assert.equal(fs.readFileSync(approvalsPath, "utf8"), approvalsBefore, "approvals file not touched by preview");
assert.equal(preview.summary.duplicateReviewItemsSkipped, 1, "duplicate incoming item skipped");
assert.equal(preview.summary.newReviewItems, 1, "new item ready for recruiter review");
assert.equal(preview.summary.invalidReviewItemsBlocked, 2, "invalid and already-applied items blocked from pending review");

const writeReport = buildBatchReviewPromotion({ batchDryRunPath, reviewPath, approvalsPath, applyHistoryPath, writeReviewFile: true });
writePromotedReviewFile(writeReport, reviewPath);
assert.notEqual(fs.readFileSync(reviewPath, "utf8"), reviewBefore, "write promotion updates review file");
assert.equal(fs.readFileSync(approvalsPath, "utf8"), approvalsBefore, "write promotion updates only review file and preserves approvals file");

const response = await POST({ json: async () => ({ batchDryRunPath, reviewPath, approvalsPath, applyHistoryPath, outputPath: path.join(tmp, "api-promotion.json"), dryRun: true, noApply: true }) } as any);
const apiJson = await response.json();
assert.equal(Boolean(apiJson.summary), true, "API preview returns summary");
assert.equal(apiJson.summary.existingApprovalsPreserved, 1, "API preserves existing approvals count");

const summary = emptyBatchReviewPromotionSummary();
assert.equal(summary.batchReviewItems, 0, "UI summary helper works");

const source = fs.readFileSync(new URL("../lib/aiExtractionBatchReviewPromotion.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../lib/aiExtractionBatchReviewMerge.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/batch-promote/route.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("./promoteAiExtractionBatchToReview.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source), false, "no candidate DB writes and no delete");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/i.test(source), false, "no OpenAI calls");
assert.equal(/rollbackCandidate|applyCandidateChangesFromStaging|confirmApply/i.test(source), false, "no real apply or rollback calls");

console.log("AI extraction batch review promotion tests passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
