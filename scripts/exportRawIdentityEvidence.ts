import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { auditRawIdentityEvidence, parseRawIdentityEvidenceArgs } from "../lib/rawIdentityEvidenceAudit";

export const RAW_IDENTITY_EVIDENCE_AUDIT_PATH = path.join("reports", "raw-identity-evidence-audit.json");

export async function writeRawIdentityEvidenceReport(outputPath = path.join(process.cwd(), RAW_IDENTITY_EVIDENCE_AUDIT_PATH), argv = process.argv.slice(2)) {
  const options = parseRawIdentityEvidenceArgs(argv);
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditRawIdentityEvidence(candidates, options);
  const payload = { exportedAt: new Date().toISOString(), outputPath: RAW_IDENTITY_EVIDENCE_AUDIT_PATH, options, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return payload;
}

async function main() {
  const report = await writeRawIdentityEvidenceReport();
  console.log("Raw identity evidence export written");
  console.log(`Output: ${RAW_IDENTITY_EVIDENCE_AUDIT_PATH}`);
  console.log("Mode: read-only; no OpenAI calls; no Supabase update/insert/delete");
  console.log(`Total checked: ${report.summary.totalChecked}`);
  console.log(`Clear name evidence present: ${report.summary.clearNameEvidencePresent}`);
  console.log(`Reupload recommended: ${report.summary.reuploadRecommended}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportRawIdentityEvidence.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
