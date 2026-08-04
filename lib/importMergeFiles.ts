import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "./candidateAudit";
import { buildCandidate360Profile } from "./candidate360Profile";
import { buildImportMergePlan, buildImportMergeProposals } from "./importMergeApproval";
import type { ImportStagingBatch } from "./importStagingTypes";
import type { ImportMergeDecisionFile, ImportMergeProposal } from "./importMergeTypes";

export const IMPORT_DIR = path.join("reports", "import");
export function readImportJson<T>(fileName: string): T | null {
  try { return JSON.parse(fs.readFileSync(path.resolve(IMPORT_DIR, fileName), "utf8")) as T; } catch { return null; }
}
export function writeImportJson(fileName: string, value: unknown) {
  const outputPath = path.resolve(IMPORT_DIR, fileName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  return outputPath;
}
export async function loadImportMergeProposals(): Promise<ImportMergeProposal[]> {
  const batch = readImportJson<ImportStagingBatch>("import-staging-batch.json");
  if (!batch) throw new Error("Missing reports/import/import-staging-batch.json");
  const { candidates } = await loadRealTalentPoolCandidates();
  const wanted = new Set(batch.candidates.map((item) => item.preservedCandidateId).filter(Boolean));
  const profiles = candidates.filter((candidate) => wanted.has(String(candidate.id || candidate.candidate_id))).map((candidate) => buildCandidate360Profile(candidate));
  return buildImportMergeProposals(batch, profiles);
}
export async function loadImportMergePlan() {
  const proposals = readImportJson<{ proposals: ImportMergeProposal[] }>("import-merge-approvals-preview.json")?.proposals || await loadImportMergeProposals();
  const decisions = readImportJson<ImportMergeDecisionFile>("import-merge-decisions.json") || undefined;
  return buildImportMergePlan(proposals, decisions);
}
