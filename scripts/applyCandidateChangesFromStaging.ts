import { createClient } from "@supabase/supabase-js";
import { buildCandidateApplyBackup, writeCandidateApplyBackup } from "../lib/aiExtractionCandidateBackup";
import { buildCandidateApplyPostAudit, executeCandidateApplyPlan, writeCandidateApplyResult, writeCandidatePostAudit } from "../lib/aiExtractionCandidateApplyExecutor";
import { buildCandidateRollbackPlan, writeCandidateRollbackPlan } from "../lib/aiExtractionCandidateRollback";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildPlanFromArgs, printCandidateApplyPlan } from "./auditCandidateApplyFromStaging";

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function supabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Candidate apply failed: missing Supabase URL/key.");
  return createClient(supabaseUrl, supabaseKey);
}

export function candidateApplyModeFromFlags(writeCandidateUpdates: boolean, confirmApply: boolean) {
  if (writeCandidateUpdates && confirmApply) return "confirmed_apply" as const;
  if (writeCandidateUpdates && !confirmApply) throw new Error("Refusing candidate updates: --writeCandidateUpdates requires --confirmApply.");
  if (confirmApply && !writeCandidateUpdates) throw new Error("Refusing candidate updates: --confirmApply requires --writeCandidateUpdates.");
  return "dry_run" as const;
}

async function main() {
  const writeCandidateUpdates = hasFlag("writeCandidateUpdates");
  const confirmApply = hasFlag("confirmApply");
  const mode = candidateApplyModeFromFlags(writeCandidateUpdates, confirmApply);
  const realApply = mode === "confirmed_apply";
  const plan = await buildPlanFromArgs();
  printCandidateApplyPlan(plan, realApply ? "Mode: CONFIRMED REAL APPLY; candidate DB field updates enabled" : "Mode: dry-run only; no candidate DB writes");
  if (!realApply) {
    const result = await executeCandidateApplyPlan(plan);
    writeCandidateApplyResult(result);
    console.log("Dry run only. No candidate DB updates were made. Real apply requires --writeCandidateUpdates --confirmApply.");
    return;
  }

  console.log("WARNING: confirmed candidate DB field update requested. Backup and rollback files will be written before updates.");
  const backup = buildCandidateApplyBackup(plan);
  const backupPath = writeCandidateApplyBackup(backup);
  const rollback = buildCandidateRollbackPlan(backup);
  const rollbackPath = writeCandidateRollbackPlan(rollback);
  console.log(`Backup written: ${backupPath}`);
  console.log(`Rollback written: ${rollbackPath}`);

  const supabase = supabaseClient();
  const result = await executeCandidateApplyPlan(plan, {
    writeCandidateUpdates,
    confirmApply,
    backup,
    rollback,
    backupPath,
    rollbackPath,
    updateCandidate: async (candidateId, update) => {
      const { error } = await supabase.from("candidates").update(update).eq("id", candidateId);
      if (error) throw new Error(`Failed to update candidate ${candidateId}: ${error.message}`);
    },
  });
  const { candidates } = await loadRealTalentPoolCandidates();
  const postAudit = buildCandidateApplyPostAudit(result, candidates);
  const postAuditPath = writeCandidatePostAudit(postAudit);
  writeCandidateApplyResult({ ...result, postAuditPath });
  console.log(`Applied field updates: ${result.appliedCount}`);
  console.log(`Post-apply verified: ${postAudit.verifiedCount}`);
  console.log(`Post-apply mismatch: ${postAudit.mismatchCount}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/applyCandidateChangesFromStaging.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}