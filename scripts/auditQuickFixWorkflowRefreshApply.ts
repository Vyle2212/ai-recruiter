import { auditQuickFixWorkflowRefreshApply, writeQuickFixWorkflowRefreshApplyAudit } from "../lib/quickFixWorkflowRefreshApply";

async function main() {
  const report = auditQuickFixWorkflowRefreshApply();
  const outputPath = writeQuickFixWorkflowRefreshApplyAudit(report);
  console.log("Mode: read-only workflow refresh apply audit; no workflow writes");
  console.log(`Expected workflow updates: ${report.expectedWorkflowUpdates}`);
  console.log(`Applied workflow updates verified: ${report.appliedWorkflowUpdatesVerified}`);
  console.log(`Pending workflow updates: ${report.pendingWorkflowUpdates}`);
  console.log(`Mismatch: ${report.mismatch}`);
  console.log(`Backup available: ${report.backupAvailable}`);
  console.log(`Rollback available: ${report.rollbackAvailable}`);
  console.log(`Rollback safe: ${report.rollbackSafe}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditQuickFixWorkflowRefreshApply.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
