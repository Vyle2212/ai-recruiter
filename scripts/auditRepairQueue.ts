import { buildRepairQueueAudit, writeRepairQueueAudit, writeRepairQueuePrioritization } from "../lib/repairQueueAudit";

async function main() {
  const report = buildRepairQueueAudit();
  const outputPath = writeRepairQueueAudit(report);
  writeRepairQueuePrioritization(report);
  console.log("Mode: read-only repair queue audit; no candidate DB writes");
  console.log(`Total workflow states: ${report.totalWorkflowStates}`);
  console.log(`Needs repair candidates: ${report.needsRepairCandidates}`);
  console.log(`Quick fix candidates: ${report.summary.quickFixes}`);
  console.log(`AI extractable candidates: ${report.summary.aiExtractable}`);
  console.log(`Manual review candidates: ${report.summary.manualReview}`);
  console.log(`Duplicate conflict candidates: ${report.summary.duplicateConflicts}`);
  console.log(`Reupload required candidates: ${report.summary.reuploadRequired}`);
  console.log(`Low evidence candidates: ${report.summary.lowEvidence}`);
  console.log(`Archive review candidates: ${report.summary.archiveReview}`);
  console.log(`P0/P1/P2/P3/P4/P5 counts: ${report.summary.p0}/${report.summary.p1}/${report.summary.p2}/${report.summary.p3}/${report.summary.p4}/${report.summary.p5}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditRepairQueue.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
