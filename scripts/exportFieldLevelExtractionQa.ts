import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { auditFieldLevelExtractionQa } from "../lib/fieldLevelExtractionQa";
import { parseFieldQaArgs } from "./auditFieldLevelExtractionQa";

export const FIELD_LEVEL_EXTRACTION_QA_PATH = path.join("reports", "field-level-extraction-qa.json");

export function writeFieldLevelExtractionQaReport(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), FIELD_LEVEL_EXTRACTION_QA_PATH), options = parseFieldQaArgs()) {
  const report = auditFieldLevelExtractionQa(candidates, options);
  const payload = { exportedAt: new Date().toISOString(), outputPath: FIELD_LEVEL_EXTRACTION_QA_PATH, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), FIELD_LEVEL_EXTRACTION_QA_PATH);
  const report = writeFieldLevelExtractionQaReport(candidates, outputPath, parseFieldQaArgs());
  console.log(`Field-level extraction QA report exported: ${outputPath}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Total checked: ${report.summary.totalChecked}`);
  console.log(`Search-ready existing: ${report.summary.searchReadyExisting}`);
  console.log(`Search-ready simulated: ${report.summary.searchReadySimulated}`);
  console.log(`Worse than existing: ${report.summary.worseThanExisting}`);
  console.log(`Requires AI: ${report.summary.requiresAi}`);
  console.log(`Requires original file reupload: ${report.summary.requiresOriginalFileReupload}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportFieldLevelExtractionQa.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
