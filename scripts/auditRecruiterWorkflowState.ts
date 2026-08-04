import { buildPersistedWorkflowStateFile, summarizePersistedWorkflowStates } from "../lib/recruiterWorkflowPersistence";
import { readPersistedWorkflowState } from "../lib/recruiterWorkflowStateHydration";
import { validateWorkflowStateFile } from "../lib/recruiterWorkflowStateValidator";
import { writeWorkflowJson } from "../lib/recruiterWorkflowStore";

async function main() {
  const state = readPersistedWorkflowState();
  const validation = validateWorkflowStateFile(state || { states: [] });
  const summary = state ? summarizePersistedWorkflowStates(validation.validStates, state.generatedAt) : buildPersistedWorkflowStateFile([]).summary;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only workflow state audit; no candidate DB writes; no delete; no OpenAI calls",
    stateFileExists: Boolean(state),
    totalWorkflowStates: validation.validStates.length,
    statusCounts: summary.statusCounts,
    actionCounts: summary.actionCounts,
    missingCandidateIds: validation.validStates.filter((item) => !item.candidateId).length,
    invalidStatuses: validation.invalidStates.filter((item) => item.reasons.some((reason) => /status/i.test(reason))).length,
    invalidActions: validation.invalidStates.filter((item) => item.reasons.some((reason) => /action/i.test(reason))).length,
    duplicateCandidateIds: validation.duplicateCandidateIds,
    blockedCandidates: summary.blockedCandidates,
    readyForShortlist: summary.readyForShortlist,
    invalidStates: validation.invalidStates,
  };
  const outputPath = writeWorkflowJson("reports/recruiter-workflow-state-audit.json", report);
  console.log("Mode: read-only workflow state audit; no candidate DB writes");
  console.log(`State file exists: ${Boolean(state)}`);
  console.log(`Total workflow states: ${report.totalWorkflowStates}`);
  console.log(`Status counts: ${JSON.stringify(report.statusCounts)}`);
  console.log(`Action counts: ${JSON.stringify(report.actionCounts)}`);
  console.log(`Missing candidate IDs: ${report.missingCandidateIds}`);
  console.log(`Invalid statuses: ${report.invalidStatuses}`);
  console.log(`Invalid actions: ${report.invalidActions}`);
  console.log(`Blocked candidates: ${report.blockedCandidates}`);
  console.log(`Ready for shortlist: ${report.readyForShortlist}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditRecruiterWorkflowState.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
