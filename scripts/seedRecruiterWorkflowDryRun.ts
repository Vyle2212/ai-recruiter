import { buildRecruiterWorkflowAuditFromReports } from "../lib/recruiterWorkflowAudit";
import { writeRecruiterWorkflowStore, writeWorkflowJson } from "../lib/recruiterWorkflowStore";

async function main() {
  const writeWorkflowState = process.argv.includes("--writeWorkflowState");
  const report = buildRecruiterWorkflowAuditFromReports();
  const previewPath = writeWorkflowJson("reports/recruiter-workflow-state-preview.json", {
    mode: "dry-run workflow seed; no candidate DB writes; no delete; no OpenAI calls",
    generatedAt: new Date().toISOString(),
    candidatesAnalyzed: report.totalCandidates,
    workflowStatesGenerated: report.states.length,
    actionsGenerated: report.actionQueue.length,
    states: report.states,
    actionQueue: report.actionQueue,
    wouldWritePath: "reports/recruiter-workflow-state.json",
  });
  let writtenPath = "";
  if (writeWorkflowState) writtenPath = writeRecruiterWorkflowStore(report.states).path;
  console.log(writeWorkflowState ? "Mode: local workflow state write only; no candidate DB writes" : "Mode: dry-run workflow seed; no candidate DB writes");
  console.log(`Candidates analyzed: ${report.totalCandidates}`);
  console.log(`Workflow states generated: ${report.states.length}`);
  console.log(`Actions generated: ${report.actionQueue.length}`);
  console.log("Would write path: reports/recruiter-workflow-state.json");
  console.log(`Output path: ${writeWorkflowState ? writtenPath : previewPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seedRecruiterWorkflowDryRun.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
