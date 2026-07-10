import { createClient } from "@supabase/supabase-js";
import { buildCandidateApplyBackup, writeCandidateApplyBackup } from "../lib/aiExtractionCandidateBackup";
import { executeCandidateApplyPlan, writeCandidateApplyResult, writeCandidatePostAudit } from "../lib/aiExtractionCandidateApplyExecutor";
import { buildCandidateRollbackPlan, writeCandidateRollbackPlan } from "../lib/aiExtractionCandidateRollback";
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

async function main() {
  const writeCandidateUpdates = hasFlag("writeCandidateUpdates");
  const confirmApply = hasFlag("confirmApply");
  const realApply = writeCandidateUpdates && confirmApply;
  const plan = await buildPlanFromArgs();
  printCandidateApplyPlan(plan);
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
    updateCandidate: async (candidateId, update) => {
      const { error } = await supabase.from("candidates").update(update).eq("id", candidateId);
      if (error) throw new Error(`Failed to update candidate ${candidateId}: ${error.message}`);
    },
  });
  writeCandidateApplyResult(result);
  writeCandidatePostAudit(result);
  console.log(`Applied field updates: ${result.appliedCount}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/applyCandidateChangesFromStaging.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
