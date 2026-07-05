import { auditCandidateDisplay, formatDisplayAuditReport } from "../lib/candidateDisplayAudit";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const result = auditCandidateDisplay(candidates);
  console.log(formatDisplayAuditReport(result));
  if (result.criticalIssueCount > 0) {
    console.error(`Candidate display audit failed: ${result.criticalIssueCount} critical display issues detected.`);
    process.exit(1);
  }
  console.log("Candidate display audit passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
