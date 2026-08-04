import { buildBatchDecisionAudit, writeBatchDecisionAudit } from "../lib/aiExtractionBatchDecisionWorkflow";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const report = buildBatchDecisionAudit({
    reviewPath: argValue("reviewPath", "reports/ai-extraction-review.json"),
    approvalsPath: argValue("approvalsPath", "reports/ai-extraction-approvals.json"),
    promotionPath: argValue("promotionPath", "reports/ai-extraction-batch-review-promotion.json"),
    stagingPath: argValue("stagingPath", "reports/ai-extraction-staging.json"),
    applyHistoryPath: argValue("applyHistoryPath", "reports/candidate-apply-history.json"),
    source: argValue("source", "batch_promotion"),
  });
  const outputPath = writeBatchDecisionAudit(report, argValue("outputPath", "reports/ai-extraction-batch-decisions.json"));
  console.log("Mode: read-only decision audit; no candidate DB writes");
  console.log(`Batch promoted items: ${report.summary.promotedBatchItems}`);
  console.log(`Pending decisions: ${report.summary.pendingDecisions}`);
  console.log(`Existing approvals preserved: ${report.summary.existingApprovalsPreserved}`);
  console.log(`Safe approve eligible: ${report.summary.safeToApprove}`);
  console.log(`Manual review required: ${report.summary.needsManualReview}`);
  console.log(`Conflicts: ${report.summary.conflicts}`);
  console.log(`Already applied / preserved: ${report.summary.alreadyAppliedPreserved}`);
  console.log(`Bulk reject eligible: ${report.summary.bulkRejectionEligible}`);
  console.log(`Blocked from bulk action: ${report.summary.blockedFromBulkAction}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditAiExtractionBatchDecisions.ts")) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
