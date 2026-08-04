import { buildQuickFixApprovalWriteResult, writeQuickFixApprovalWriteReport } from "../lib/quickFixApprovalWrite";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const writeApprovalsFile = hasFlag("writeApprovalsFile");
  const result = buildQuickFixApprovalWriteResult({
    suggestionsPath: argValue("suggestionsPath", "reports/quick-fix-repair-suggestions.json"),
    reviewPath: argValue("reviewPath", "reports/ai-extraction-review.json"),
    writeApprovalsFile,
    writeReviewFile: hasFlag("writeReviewFile"),
    overwriteExistingApprovals: hasFlag("overwriteExistingApprovals"),
  });
  const outputPath = writeQuickFixApprovalWriteReport(result);
  console.log(writeApprovalsFile ? "Mode: approvals file write only; no candidate DB writes" : "Mode: approval write preview only; approvals file not changed; no candidate DB writes");
  console.log(`Suggestions loaded: ${result.summary.suggestionsLoaded}`);
  console.log(`Approval decisions ready: ${result.summary.approvalDecisionsReady}`);
  console.log(`Existing approvals preserved: ${result.summary.existingApprovalsPreserved}`);
  console.log(`Suggestions blocked: ${result.summary.suggestionsBlocked}`);
  console.log(`Would write approvals: ${result.summary.wouldWriteApprovals}`);
  if (result.writeReviewFile) console.log(`Review file path: ${result.reviewFilePath}`);
  if (writeApprovalsFile) console.log(`Approval decisions written: ${result.summary.approvalsWritten}`);
  console.log(`Output path: ${outputPath}`);
  if (writeApprovalsFile) console.log(`Approval file path: ${result.approvalFilePath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/writeQuickFixRepairApprovals.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}

