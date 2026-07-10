import fs from "node:fs";
import path from "node:path";
import type { CandidateApplyBackup } from "./aiExtractionCandidateBackup";

export type CandidateRollbackEntry = {
  candidateId: string;
  fieldName: string;
  candidateField: string;
  restoreValue: any;
  appliedValue: any;
  stagingId: string;
};

export type CandidateRollbackPlan = {
  mode: string;
  createdAt: string;
  entries: CandidateRollbackEntry[];
};

export function buildCandidateRollbackPlan(backup: CandidateApplyBackup): CandidateRollbackPlan {
  return {
    mode: "candidate rollback plan; restores only fields changed by staged apply; no deletes",
    createdAt: new Date().toISOString(),
    entries: backup.entries.map((entry) => ({
      candidateId: entry.candidateId,
      fieldName: entry.fieldName,
      candidateField: entry.candidateField,
      restoreValue: entry.previousValue,
      appliedValue: entry.approvedValue,
      stagingId: entry.stagingId,
    })),
  };
}

export function writeCandidateRollbackPlan(rollback: CandidateRollbackPlan, outputPath = path.join("reports", "candidate-apply-rollback.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(rollback, null, 2)}\n`);
  return fullPath;
}

export function loadCandidateRollbackPlan(rollbackPath = path.join("reports", "candidate-apply-rollback.json")): CandidateRollbackPlan | null {
  const fullPath = path.resolve(rollbackPath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export async function executeCandidateRollback(
  rollback: CandidateRollbackPlan,
  options: { writeCandidateUpdates?: boolean; confirmRollback?: boolean; updateCandidate?: (candidateId: string, update: Record<string, any>) => Promise<void> } = {},
) {
  const dryRun = !(options.writeCandidateUpdates && options.confirmRollback);
  if (dryRun) {
    return { mode: "dry-run rollback only; no candidate DB writes", dryRun: true, restoredCount: 0, wouldRestoreCount: rollback.entries.length };
  }
  if (!options.updateCandidate) throw new Error("Rollback refused: updateCandidate implementation is required for real rollback.");
  let restoredCount = 0;
  for (const entry of rollback.entries) {
    await options.updateCandidate(entry.candidateId, { [entry.candidateField]: entry.restoreValue });
    restoredCount += 1;
  }
  return { mode: "confirmed rollback applied; no deletes", dryRun: false, restoredCount, wouldRestoreCount: rollback.entries.length };
}
