import { buildQuickFixApprovalAudit, writeQuickFixApprovalAudit } from "../lib/quickFixApprovalAudit";

async function main() {
  const audit = buildQuickFixApprovalAudit();
  const outputPath = writeQuickFixApprovalAudit(audit);
  console.log("Mode: read-only quick fix approvals audit; no candidate DB writes");
  console.log(`Quick fix approvals found: ${audit.quickFixApprovalsFound}`);
  console.log(`Approved currentCompany: ${audit.approvedCurrentCompany}`);
  console.log(`Approved title: ${audit.approvedTitle}`);
  console.log(`Approved primarySapModule: ${audit.approvedPrimarySapModule}`);
  console.log(`Approved location: ${audit.approvedLocation}`);
  console.log(`Existing approvals preserved: ${audit.existingApprovalsPreserved}`);
  console.log(`Ready for staging preview: ${audit.readyForStagingPreview}`);
  console.log(`Blocked from staging: ${audit.blockedFromStaging}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditQuickFixRepairApprovals.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
