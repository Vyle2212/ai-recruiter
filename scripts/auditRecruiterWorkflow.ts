import { buildRecruiterWorkflowAuditFromReports, writeRecruiterWorkflowAudit } from "../lib/recruiterWorkflowAudit";

async function main() {
  const report = buildRecruiterWorkflowAuditFromReports();
  const outputPath = writeRecruiterWorkflowAudit(report);
  console.log("Mode: read-only workflow audit; no candidate DB writes");
  console.log(`Total candidates: ${report.totalCandidates}`);
  console.log(`Status counts: ${JSON.stringify(report.summary)}`);
  console.log(`Action queue count: ${report.actionQueue.length}`);
  console.log(`High priority actions: ${report.summary.highPriorityActions}`);
  console.log(`Medium priority actions: ${report.summary.mediumPriorityActions}`);
  console.log(`Low priority actions: ${report.summary.lowPriorityActions}`);
  console.log(`Blocked candidates: ${report.summary.blockedCandidates}`);
  console.log(`Ready for shortlist: ${report.summary.readyForShortlist}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditRecruiterWorkflow.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
