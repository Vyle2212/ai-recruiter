import fs from "node:fs";
import path from "node:path";
import { buildMustRepairBeforeSearchReview } from "../lib/mustRepairBeforeSearch";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

export const MUST_REPAIR_REPORT_PATH = path.join("reports", "must-repair-before-search.json");

export function writeMustRepairBeforeSearchReport(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), MUST_REPAIR_REPORT_PATH)) {
  const review = buildMustRepairBeforeSearchReview(candidates, { page: 1, pageSize: 100 });
  const report = {
    exportedAt: new Date().toISOString(),
    mode: "read-only",
    outputPath: MUST_REPAIR_REPORT_PATH,
    summary: review.summary,
    items: review.items,
    totalMustRepair: review.summary.totalMustRepair,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  return { ...report, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), MUST_REPAIR_REPORT_PATH);
  const report = writeMustRepairBeforeSearchReport(candidates, outputPath);
  console.log(`Must Repair Before Search exported: ${outputPath}`);
  console.log(`Total must repair: ${report.totalMustRepair}`);
  console.log(`Items exported: ${report.items.length}`);
  console.log(`Mode: ${report.mode}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportMustRepairBeforeSearch.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}