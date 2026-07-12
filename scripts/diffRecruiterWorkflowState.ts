import { buildRecruiterWorkflowAuditFromReports } from "../lib/recruiterWorkflowAudit";
import { buildPersistedWorkflowStates } from "../lib/recruiterWorkflowPersistence";
import { diffWorkflowStates } from "../lib/recruiterWorkflowStateDiff";
import { readPersistedWorkflowState } from "../lib/recruiterWorkflowStateHydration";
import { writeWorkflowJson } from "../lib/recruiterWorkflowStore";

async function main() {
  const previous = readPersistedWorkflowState();
  const audit = buildRecruiterWorkflowAuditFromReports();
  const current = buildPersistedWorkflowStates(audit, previous?.states || []);
  const diff = diffWorkflowStates(previous?.states || [], current);
  const outputPath = writeWorkflowJson("reports/recruiter-workflow-state-diff.json", diff);
  console.log("Mode: read-only workflow state diff; no candidate DB writes");
  console.log(`Previous states: ${diff.previousStates}`);
  console.log(`Current inferred states: ${diff.currentInferredStates}`);
  console.log(`New states: ${diff.newStates.length}`);
  console.log(`Changed states: ${diff.changedStates.length}`);
  console.log(`Unchanged states: ${diff.unchangedStates.length}`);
  console.log(`Removed/missing states: ${diff.removedOrMissingStates.length}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/diffRecruiterWorkflowState.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
