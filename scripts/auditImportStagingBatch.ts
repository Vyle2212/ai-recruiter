import fs from "node:fs";
import path from "node:path";
import type { ImportStagingBatch } from "../lib/importStagingTypes";

export function auditImportStagingBatch(batch: ImportStagingBatch) {
  const invalidPreservedIds = batch.candidates.filter((item) => item.match.existingCandidateId && item.preservedCandidateId !== item.match.existingCandidateId).length;
  const unsafeTrustedOverwrites = batch.candidates.flatMap((item) => item.fields).filter((field) => ["candidate_confirmed", "recruiter_approved"].includes(String(field.existingSource)) && field.recommendation === "update_existing").length;
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only import staging audit; no candidate DB writes",
    batchId: batch.batchId, batchName: batch.batchName,
    importedCandidates: batch.importedCandidatesLoaded, existingCandidates: batch.existingCandidatesLoaded,
    summary: batch.summary,
    guardrails: {
      preservedCandidateIdsValid: invalidPreservedIds === 0,
      unsafeTrustedOverwrites,
      candidateDbWrites: false, workflowWrites: false, delete: false, fullReupload: false, openAiCalls: false,
      applyHistoryPreserved: batch.preservationPolicy.preserveApplyHistory,
      approvalsPreserved: batch.preservationPolicy.preserveApprovals,
      decisionsPreserved: batch.preservationPolicy.preserveDecisions,
      workflowStatePreserved: batch.preservationPolicy.preserveWorkflowState,
    },
  };
}
function main() {
  const batchPath = path.resolve("reports/import/import-staging-batch.json");
  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8")) as ImportStagingBatch;
  const audit = auditImportStagingBatch(batch);
  const outputPath = path.resolve("reports/import/import-staging-audit.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log("Mode: read-only import staging audit; no candidate DB writes");
  console.log(`Imported candidates audited: ${audit.importedCandidates}`);
  console.log(`Preserved candidate IDs valid: ${audit.guardrails.preservedCandidateIdsValid ? "yes" : "no"}`);
  console.log(`Unsafe trusted-field overwrites: ${audit.guardrails.unsafeTrustedOverwrites}`);
  console.log(`Ready for merge preview: ${audit.summary.readyForMergePreview}`);
  console.log(`Needs recruiter review: ${audit.summary.needsRecruiterReview}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditImportStagingBatch.ts")) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
