import { buildApplyHistory, writeApplyHistoryReport, type ApplyHistoryOptions, type ApplyHistoryReport } from "../lib/aiExtractionApplyHistory";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function argValue(name: keyof ApplyHistoryOptions | "outputPath", fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

export async function buildApplyHistoryFromArgs() {
  const options: ApplyHistoryOptions = {
    stagingPath: argValue("stagingPath", "reports/ai-extraction-staging.json"),
    backupPath: argValue("backupPath", "reports/candidate-apply-backup.json"),
    rollbackPath: argValue("rollbackPath", "reports/candidate-apply-rollback.json"),
    resultPath: argValue("resultPath", "reports/candidate-apply-result.json"),
    postAuditPath: argValue("postAuditPath", "reports/candidate-apply-post-audit.json"),
  };
  const { candidates } = await loadRealTalentPoolCandidates();
  return buildApplyHistory(candidates, options);
}

export function printApplyHistory(report: ApplyHistoryReport, outputPath: string) {
  console.log("Mode: read-only audit; no candidate DB writes");
  console.log(`Staged fields: ${report.summary.stagedFields}`);
  console.log(`Applied fields: ${report.summary.appliedFields}`);
  console.log(`Already applied / preserved fields: ${report.summary.alreadyAppliedPreservedFields}`);
  console.log(`Eligible pending fields: ${report.summary.eligibleFields}`);
  console.log(`Blocked fields: ${report.summary.blockedFields}`);
  console.log(`Conflicts: ${report.summary.conflicts}`);
  console.log(`Backup available: ${report.summary.backupAvailable}`);
  console.log(`Rollback available: ${report.summary.rollbackAvailable}`);
  console.log(`Post-apply verified: ${report.summary.postApplyVerified}`);
  console.log(`Post-apply mismatch: ${report.summary.postApplyMismatch}`);
  console.log(`Output path: ${outputPath}`);
}

async function main() {
  const outputPath = argValue("outputPath", "reports/candidate-apply-history.json");
  const report = await buildApplyHistoryFromArgs();
  const writtenPath = writeApplyHistoryReport(report, outputPath);
  printApplyHistory(report, writtenPath);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditCandidateApplyHistory.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}