import fs from "node:fs";
import path from "node:path";
import type { CandidateApplyPlan } from "./aiExtractionCandidateApplyPlan";

export type CandidateApplyBackupEntry = {
  candidateId: string;
  fieldName: string;
  candidateField: string;
  previousValue: any;
  approvedValue: any;
  stagingId: string;
};

export type CandidateApplyBackup = {
  mode: string;
  createdAt: string;
  entries: CandidateApplyBackupEntry[];
};

export function buildCandidateApplyBackup(plan: CandidateApplyPlan): CandidateApplyBackup {
  return {
    mode: "candidate apply backup; required before real update; no deletes",
    createdAt: new Date().toISOString(),
    entries: plan.eligibleItems.map((item) => ({
      candidateId: item.candidateId,
      fieldName: item.fieldName,
      candidateField: item.candidateField,
      previousValue: item.currentDbValue,
      approvedValue: item.approvedValue,
      stagingId: item.stagingId,
    })),
  };
}

export function writeCandidateApplyBackup(backup: CandidateApplyBackup, outputPath = path.join("reports", "candidate-apply-backup.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(backup, null, 2)}\n`);
  return fullPath;
}

export function loadCandidateApplyBackup(backupPath = path.join("reports", "candidate-apply-backup.json")): CandidateApplyBackup | null {
  const fullPath = path.resolve(backupPath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}
