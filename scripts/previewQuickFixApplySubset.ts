import { buildQuickFixApplySubsetPreview, writeQuickFixApplySubsetPreview, writeQuickFixApplySubset } from "../lib/quickFixApplySubsetBuilder";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}
function hasFlag(name: string) { return process.argv.includes(`--${name}`); }

async function main() {
  const preview = buildQuickFixApplySubsetPreview({ decisionsPath: argValue("decisionsPath", "") || undefined });
  const outputPath = writeQuickFixApplySubsetPreview(preview);
  if (hasFlag("writeSubset")) writeQuickFixApplySubset(preview);
  console.log("Mode: apply subset preview only; no candidate DB writes");
  console.log(`Review board items: ${preview.reviewBoardItems}`);
  console.log(`Decisions loaded: ${preview.decisionsLoaded}`);
  console.log(`Approved for apply: ${preview.approvedForApply}`);
  console.log(`Held for review: ${preview.heldForReview}`);
  console.log(`Rejected: ${preview.rejected}`);
  console.log(`Preserved existing: ${preview.preservedExisting}`);
  console.log(`Would include in apply subset: ${preview.wouldIncludeInApplySubset}`);
  console.log(`Would exclude from apply subset: ${preview.wouldExcludeFromApplySubset}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/previewQuickFixApplySubset.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
