import fs from "node:fs";
import path from "node:path";
import { buildCandidateRepairReview } from "../lib/candidateRepairReview";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const firstPage = buildCandidateRepairReview(candidates, { page: 1, pageSize: 100, action: "all", searchableAfterRepair: "all" });
  const items = [...firstPage.items];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = buildCandidateRepairReview(candidates, { page, pageSize: 100, action: "all", searchableAfterRepair: "all" });
    items.push(...nextPage.items);
  }
  const review = { ...firstPage, items, returnedCount: items.length, currentPage: 1, pageSize: items.length || 100, totalPages: 1 };
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, "candidate-repair-review.json");
  fs.writeFileSync(filePath, JSON.stringify({ ...review, exportedAt: new Date().toISOString(), mode: "read-only" }, null, 2));
  console.log(`Repair review exported: ${filePath}`);
  console.log(`Items exported: ${review.items.length}`);
  console.log(`Total matched: ${review.totalMatched}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
