import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildExtractionDecisionLayer } from "../lib/extractionDecisionLayer";
import { parseExtractionDecisionArgs } from "./auditExtractionDecisionLayer";

export const EXTRACTION_DECISION_LAYER_PATH = path.join("reports", "extraction-decision-layer.json");

export function writeExtractionDecisionLayerReport(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), EXTRACTION_DECISION_LAYER_PATH), options = parseExtractionDecisionArgs()) {
  const report = buildExtractionDecisionLayer(candidates, options);
  const payload = { exportedAt: new Date().toISOString(), outputPath: EXTRACTION_DECISION_LAYER_PATH, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), EXTRACTION_DECISION_LAYER_PATH);
  const report = writeExtractionDecisionLayerReport(candidates, outputPath, parseExtractionDecisionArgs());
  console.log(`Extraction decision layer report exported: ${outputPath}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Total checked: ${report.summary.totalChecked}`);
  console.log(`Existing search-ready: ${report.summary.existingSearchReady}`);
  console.log(`Simulated search-ready: ${report.summary.simulatedSearchReady}`);
  console.log(`Decision-safe search-ready: ${report.summary.decisionSafeSearchReady}`);
  console.log(`Keep existing record: ${report.summary.keepExistingRecord}`);
  console.log(`Safe to overwrite later: ${report.summary.safeToOverwriteLater}`);
  console.log(`Send to AI extraction queue: ${report.summary.sendToAiExtractionQueue}`);
  console.log(`Requires original file reupload: ${report.summary.requiresOriginalFileReupload}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportExtractionDecisionLayer.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
