import { auditQuickFixStagingRefresh, writeQuickFixStagingRefreshAudit } from "../lib/quickFixStagingRefresh";
async function main() {
  const audit = auditQuickFixStagingRefresh(); const outputPath = writeQuickFixStagingRefreshAudit(audit);
  console.log("Mode: read-only quick fix staging refresh audit; no candidate DB writes"); console.log(`Staging items expected: ${audit.stagingItemsExpected}`); console.log(`Staging items found: ${audit.stagingItemsFound}`);
  console.log(`Already applied excluded: ${audit.alreadyAppliedExcluded}`); console.log(`Pending staging items: ${audit.pendingStagingItems}`); console.log(`Mismatch: ${audit.mismatch}`); console.log(`Output path: ${outputPath}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditQuickFixStagingRefresh.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
