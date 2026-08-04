import { buildQuickFixStagingRefresh, canWriteQuickFixStaging } from "../lib/quickFixStagingRefresh";
function hasFlag(name: string) { return process.argv.includes(`--${name}`); }
async function main() {
  const writeRequested = hasFlag("writeStaging"); const confirmed = hasFlag("confirmQuickFixStagingRefresh");
  if (writeRequested !== confirmed) throw new Error("Real staging refresh requires both --writeStaging and --confirmQuickFixStagingRefresh");
  const writeStaging = canWriteQuickFixStaging(writeRequested, confirmed); const report = buildQuickFixStagingRefresh({ writeStaging, confirmQuickFixStagingRefresh: confirmed });
  console.log(writeStaging ? "CONFIRMED QUICK FIX STAGING REFRESH. Staging file updates enabled." : "Mode: quick fix staging refresh preview only; staging file not changed; no candidate DB writes");
  console.log(`Approvals loaded: ${report.approvalsLoaded}`); console.log(`Valid approval items: ${report.validApprovalItems}`); console.log(`Already applied excluded: ${report.alreadyAppliedExcluded}`);
  console.log(`Preserved/held/rejected excluded: ${report.preservedHeldRejectedExcluded}`); console.log(`New staging items ready: ${report.newStagingItemsReady}`);
  console.log(writeStaging ? `Staging items written: ${report.stagingItemsWritten}` : `Would write staging items: ${report.wouldWriteStagingItems}`); console.log(`Output path: ${report.outputPath}`); if (writeStaging) console.log(`Staging path: ${report.stagingPath}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/refreshQuickFixStaging.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
