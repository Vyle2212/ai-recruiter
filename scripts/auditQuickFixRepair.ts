import { buildQuickFixRepairAudit, writeQuickFixRepairAudit } from "../lib/quickFixRepairAudit";

async function main() {
  const audit = buildQuickFixRepairAudit();
  const outputPath = writeQuickFixRepairAudit(audit);
  console.log("Mode: read-only quick fix repair audit; no candidate DB writes");
  console.log(`Suggestions loaded: ${audit.suggestionsLoaded}`);
  console.log(`Safe suggestions: ${audit.summary.safeSuggestions}`);
  console.log(`Manual review suggestions: ${audit.summary.needsManualReview}`);
  console.log(`Blocked suggestions: ${audit.summary.blockedSuggestions}`);
  console.log(`Existing approvals preserved: ${audit.existingApprovalsPreserved}`);
  console.log(`Ready for approval preview: ${audit.readyForApprovalPreview}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditQuickFixRepair.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
