import { buildQuickFixRepairImpactReport, writeQuickFixRepairImpactReport } from "../lib/quickFixRepairImpactReport";

async function main() {
  const report = buildQuickFixRepairImpactReport();
  const outputPath = writeQuickFixRepairImpactReport(report);
  console.log("Mode: read-only quick fix repair impact audit; no candidate DB writes");
  console.log(`Subset items: ${report.subsetItems}`);
  console.log(`Applied verified: ${report.appliedVerified}`);
  console.log(`Pending apply: ${report.pendingApply}`);
  console.log(`Mismatch: ${report.mismatch}`);
  console.log(`Repair blockers before: ${report.repairBlockersBefore}`);
  console.log(`Repair blockers resolved: ${report.repairBlockersResolved}`);
  console.log(`Repair blockers remaining: ${report.repairBlockersRemaining}`);
  console.log(`Candidates improved: ${report.candidatesImproved}`);
  console.log(`Candidates unchanged: ${report.candidatesUnchanged}`);
  console.log(`Moved out of needs_repair: ${report.movedOutOfNeedsRepair}`);
  console.log(`Became ready_for_shortlist: ${report.becameReadyForShortlist}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditQuickFixRepairImpact.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
