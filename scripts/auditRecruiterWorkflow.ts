import { buildRecruiterWorkflowAuditPreferPersisted, writeRecruiterWorkflowAudit } from "../lib/recruiterWorkflowAudit";

async function main() {
  const report = buildRecruiterWorkflowAuditPreferPersisted();
  const outputPath = writeRecruiterWorkflowAudit(report);
  console.log("Mode: read-only workflow audit; no candidate DB writes");
  console.log(`Source: ${report.auditSource}`);
  console.log(`Workflow state path: ${report.workflowStatePath}`);
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Total candidates: ${report.totalCandidates}`);
  console.log(`Status counts: ${JSON.stringify(report.summary)}`);
  console.log(`Action queue count: ${report.actionQueue.length}`);
  console.log(`High priority actions: ${report.summary.highPriorityActions}`);
  console.log(`Medium priority actions: ${report.summary.mediumPriorityActions}`);
  console.log(`Low priority actions: ${report.summary.lowPriorityActions}`);
  console.log(`Blocked candidates: ${report.summary.blockedCandidates}`);
  console.log(`Needs repair: ${report.summary.needsRepair}`);
  console.log(`Ready for shortlist: ${report.summary.readyForShortlist}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditRecruiterWorkflow.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
