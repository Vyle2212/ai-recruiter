import fs from "node:fs";
import path from "node:path";
import { auditCandidateDisplay, repairsToCsv } from "../lib/candidateDisplayAudit";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { TALENT_SEARCH_DISPLAY_RESOLVER_VERSION } from "../lib/talentSearchDisplay";

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const result = auditCandidateDisplay(candidates);
  const previewPath = path.resolve("repair-preview.json");
  const csvPath = path.resolve("candidate-display-repair-review.csv");
  fs.writeFileSync(previewPath, JSON.stringify(result.repairs, null, 2) + "\n", "utf8");
  fs.writeFileSync(csvPath, repairsToCsv(result.repairs), "utf8");
  console.log(`Display resolver: ${TALENT_SEARCH_DISPLAY_RESOLVER_VERSION}`);
  console.log(`Candidates scanned: ${result.totalScanned}`);
  console.log(`Repair suggestions: ${result.repairs.length}`);
  console.log(`Critical display issues: ${result.criticalIssueCount}`);
  console.log(`Repair preview: ${previewPath}`);
  console.log(`Manual review CSV: ${csvPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
