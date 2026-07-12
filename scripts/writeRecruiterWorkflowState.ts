import { buildRecruiterWorkflowAuditFromReports } from "../lib/recruiterWorkflowAudit";
import { buildPersistedWorkflowStateFile, buildPersistedWorkflowStates } from "../lib/recruiterWorkflowPersistence";
import { diffWorkflowStates } from "../lib/recruiterWorkflowStateDiff";
import { readPersistedWorkflowState, writePersistedWorkflowStatePreview } from "../lib/recruiterWorkflowStateHydration";
import { writePersistedRecruiterWorkflowStore } from "../lib/recruiterWorkflowStore";

async function main() {
  const writeWorkflowState = process.argv.includes("--writeWorkflowState");
  const previous = readPersistedWorkflowState();
  const audit = buildRecruiterWorkflowAuditFromReports();
  const states = buildPersistedWorkflowStates(audit, previous?.states || []);
  const file = buildPersistedWorkflowStateFile(states, audit.generatedAt);
  const diff = diffWorkflowStates(previous?.states || [], states);
  const previewPath = writePersistedWorkflowStatePreview({ ...file, diffSummary: { newStates: diff.newStates.length, updatedStates: diff.changedStates.length, unchangedStates: diff.unchangedStates.length } } as any);
  if (writeWorkflowState) {
    const written = writePersistedRecruiterWorkflowStore(file);
    console.log("Mode: local workflow state write only; no candidate DB writes");
    console.log(`Candidates analyzed: ${audit.totalCandidates}`);
    console.log(`Workflow states written: ${file.states.length}`);
    console.log(`Output path: ${written.path}`);
    return;
  }
  console.log("Mode: dry-run workflow state write; no candidate DB writes");
  console.log(`Candidates analyzed: ${audit.totalCandidates}`);
  console.log(`Workflow states generated: ${states.length}`);
  console.log(`New states: ${diff.newStates.length}`);
  console.log(`Updated states: ${diff.changedStates.length}`);
  console.log(`Unchanged states: ${diff.unchangedStates.length}`);
  console.log("Would write path: reports/recruiter-workflow-state.json");
  console.log(`Preview path: ${previewPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/writeRecruiterWorkflowState.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
