import { auditCandidates, formatAuditReport, loadRealTalentPoolCandidates } from "../lib/candidateAudit";

async function main() {
  const { candidates, source } = await loadRealTalentPoolCandidates();
  const report = auditCandidates(candidates, source);
  console.log(formatAuditReport(report));

  const criticalIssues = report.issues.filter((issue) => issue.severity === "critical");
  if (criticalIssues.length > 0) {
    throw new Error(`Candidate audit failed: ${criticalIssues.length} critical issues detected.`);
  }

  if (report.issues.length > 0) {
    console.warn(`Candidate audit warnings: ${report.issues.length} warnings detected.`);
  }

  console.log("Candidate audit passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
