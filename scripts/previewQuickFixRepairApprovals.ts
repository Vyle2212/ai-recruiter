import { buildQuickFixApprovalPreview, writeQuickFixApprovalPreview } from "../lib/quickFixRepairApprovalBridge";
import { loadQuickFixRepairSuggestions } from "../lib/quickFixRepairReview";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const suggestions = loadQuickFixRepairSuggestions(argValue("suggestionsPath", "reports/quick-fix-repair-suggestions.json"));
  const preview = buildQuickFixApprovalPreview(suggestions);
  const outputPath = writeQuickFixApprovalPreview(preview);
  console.log("Mode: approval preview only; approvals file not changed; no candidate DB writes");
  console.log(`Would create approval decisions: ${preview.wouldCreateApprovalDecisions}`);
  console.log(`Would preserve existing approvals: ${preview.wouldPreserveExistingApprovals}`);
  console.log(`Would block suggestions: ${preview.wouldBlockSuggestions}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/previewQuickFixRepairApprovals.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
