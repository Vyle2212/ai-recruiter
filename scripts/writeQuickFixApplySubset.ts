import { buildQuickFixApplySubset, writeQuickFixApplySubsetFile } from "../lib/quickFixApplySubsetAudit";
function argValue(name: string, fallback = "") { const p = `--${name}=`; return process.argv.find((a) => a.startsWith(p))?.slice(p.length) || fallback; }
function hasFlag(name: string) { return process.argv.includes(`--${name}`); }
async function main() {
  const subset = buildQuickFixApplySubset({ decisionsPath: argValue("decisionsPath", "reports/quick-fix-apply-decisions.json"), stagingPath: argValue("stagingPath", "reports/ai-extraction-staging.json") });
  const write = hasFlag("writeSubsetFile");
  const outputPath = writeQuickFixApplySubsetFile(subset, write);
  console.log(write ? "Mode: subset file write only; no candidate DB writes" : "Mode: subset write preview only; subset file not changed; no candidate DB writes");
  console.log(`Decisions loaded: ${subset.decisionsLoaded}`);
  console.log(`Staged items loaded: ${subset.stagedItemsLoaded}`);
  console.log(`Approved decisions: ${subset.approvedDecisions}`);
  console.log(`Held/rejected/keep existing excluded: ${subset.excludedCount}`);
  console.log(`Would write subset items: ${subset.wouldWriteSubsetItems}`);
  if (write) console.log(`Subset items written: ${subset.subsetItems.length}`);
  console.log(`Output path: ${outputPath}`);
}
if (process.argv[1]?.replace(/\\/g,"/").endsWith("scripts/writeQuickFixApplySubset.ts")) main().catch((e)=>{console.error(e instanceof Error?e.message:e);process.exitCode=1});
