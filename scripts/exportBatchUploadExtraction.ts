import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { auditBatchUploadExtractionSimulation } from "../lib/batchUploadExtractionSimulator";
import { parseBatchUploadExtractionArgs } from "./auditBatchUploadExtraction";

export const BATCH_UPLOAD_EXTRACTION_AUDIT_PATH = path.join("reports", "batch-upload-extraction-audit.json");

export function writeBatchUploadExtractionAudit(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), BATCH_UPLOAD_EXTRACTION_AUDIT_PATH), options = parseBatchUploadExtractionArgs()) {
  const report = auditBatchUploadExtractionSimulation(candidates, options);
  const payload = { exportedAt: new Date().toISOString(), outputPath: BATCH_UPLOAD_EXTRACTION_AUDIT_PATH, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), BATCH_UPLOAD_EXTRACTION_AUDIT_PATH);
  const report = writeBatchUploadExtractionAudit(candidates, outputPath, parseBatchUploadExtractionArgs());
  console.log(`Batch upload extraction simulation exported: ${outputPath}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Total tested: ${report.summary.totalTested}`);
  console.log(`Existing DB search-ready: ${report.summary.existingDbSearchReady}`);
  console.log(`Simulated extraction search-ready: ${report.summary.simulatedExtractionSearchReady}`);
  console.log(`Profiles improved by simulated extraction: ${report.summary.profilesImprovedBySimulatedExtraction}`);
  console.log(`Profiles worse than existing DB: ${report.summary.profilesWorseThanExistingDb}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportBatchUploadExtraction.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
