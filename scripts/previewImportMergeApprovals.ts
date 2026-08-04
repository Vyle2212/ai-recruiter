import { loadImportMergeProposals, writeImportJson } from "../lib/importMergeFiles";
import { summarizeImportMergeProposals } from "../lib/importMergeApproval";

async function main() {
  const proposals = await loadImportMergeProposals();
  const summary = summarizeImportMergeProposals(proposals);
  writeImportJson("import-merge-approvals-preview.json", { generatedAt: new Date().toISOString(), mode: "import merge approval preview only; no candidate DB writes", summary, proposals });
  console.log("Mode: import merge approval preview only; no candidate DB writes");
  console.log(`Proposals generated: ${summary.proposalsGenerated}`);
  console.log(`Auto-approvable safe merges: ${summary.autoApprovableSafeMerges}`);
  console.log(`Hold for review: ${summary.holdForReview}`);
  console.log(`Ask candidate confirmation: ${summary.askCandidateConfirmation}`);
  console.log(`Keep existing: ${summary.keepExisting}`);
  console.log(`Rejected: ${summary.rejected}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/previewImportMergeApprovals.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
