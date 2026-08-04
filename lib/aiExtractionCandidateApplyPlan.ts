import fs from "node:fs";
import path from "node:path";
import type { AiExtractionStagingRecord } from "./aiExtractionStagingPreview";
import { candidateId, validateCandidateApplyItem } from "./aiExtractionCandidateApplyValidator";

export type CandidateApplyPlanItem = {
  stagingId: string;
  candidateId: string;
  candidateName: string;
  fieldName: string;
  candidateField: string;
  currentDbValue: any;
  stagingCurrentValue: string;
  approvedValue: string;
  eligible: boolean;
  blocked: boolean;
  preserved: boolean;
  applyStatus: "eligible_for_apply" | "blocked" | "preserved_already_applied";
  conflict: boolean;
  reasons: string[];
  update: Record<string, any>;
};

export type CandidateApplyPlan = {
  mode: string;
  stagedItemsLoaded: number;
  candidatesAffected: number;
  fieldsEligibleForApply: number;
  fieldsBlocked: number;
  conflictsDetected: number;
  fieldsAlreadyAppliedPreserved: number;
  backupRequired: boolean;
  rollbackReady: boolean;
  wouldUpdateCount: number;
  wouldPreserveCount: number;
  items: CandidateApplyPlanItem[];
  eligibleItems: CandidateApplyPlanItem[];
  blockedItems: CandidateApplyPlanItem[];
  preservedItems: CandidateApplyPlanItem[];
  conflicts: CandidateApplyPlanItem[];
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function loadStagingItems(stagingPath = path.join("reports", "ai-extraction-staging.json")): AiExtractionStagingRecord[] {
  const fullPath = path.resolve(stagingPath);
  if (!fs.existsSync(fullPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

export function buildCandidateApplyPlan(stagingItems: AiExtractionStagingRecord[], candidates: Record<string, any>[]): CandidateApplyPlan {
  const candidatesById = new Map(candidates.map((candidate) => [candidateId(candidate), candidate]));
  const items = stagingItems.map((item) => {
    const candidate = candidatesById.get(clean(item.candidateId));
    const validation = validateCandidateApplyItem(item, candidate);
    const preserved = !validation.eligible && !validation.blocked && validation.reasons.some((reason) => /preserved_already_applied/i.test(reason));
    const applyStatus: CandidateApplyPlanItem["applyStatus"] = validation.eligible ? "eligible_for_apply" : preserved ? "preserved_already_applied" : "blocked";
    return {
      stagingId: item.stagingId,
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      fieldName: item.fieldName,
      candidateField: validation.candidateField,
      currentDbValue: validation.currentDbValue,
      stagingCurrentValue: item.currentValue,
      approvedValue: item.approvedValue,
      eligible: validation.eligible,
      blocked: validation.blocked,
      preserved,
      applyStatus,
      conflict: !preserved && validation.reasons.some((reason) => /conflict|differs|downgrade/i.test(reason)),
      reasons: validation.reasons,
      update: validation.eligible ? { [validation.candidateField]: item.approvedValue } : {},
    };
  });
  const eligibleItems = items.filter((item) => item.eligible);
  const blockedItems = items.filter((item) => item.blocked);
  const preservedItems = items.filter((item) => item.preserved);
  const conflicts = items.filter((item) => item.conflict);
  return {
    mode: "dry-run only; no candidate DB writes",
    stagedItemsLoaded: stagingItems.length,
    candidatesAffected: new Set(items.map((item) => item.candidateId)).size,
    fieldsEligibleForApply: eligibleItems.length,
    fieldsBlocked: blockedItems.length,
    conflictsDetected: conflicts.length,
    fieldsAlreadyAppliedPreserved: preservedItems.length,
    backupRequired: eligibleItems.length > 0,
    rollbackReady: eligibleItems.length > 0,
    wouldUpdateCount: eligibleItems.length,
    wouldPreserveCount: preservedItems.length,
    items,
    eligibleItems,
    blockedItems,
    preservedItems,
    conflicts,
  };
}

export function writeCandidateApplyPreview(plan: CandidateApplyPlan, outputPath = path.join("reports", "candidate-apply-preview.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({ exportedAt: new Date().toISOString(), ...plan }, null, 2)}\n`);
  return fullPath;
}
