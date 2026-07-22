import { createClient } from "@supabase/supabase-js";
import { executeImportMergePlan, validateImportMergeApplyMode } from "../lib/importMergeApply";
import { loadImportMergePlan } from "../lib/importMergeFiles";
import { loadCliEnv, printSupabaseEnvDiagnostics } from "../lib/cliEnv";

function hasFlag(name: string) { return process.argv.includes(`--${name}`); }
async function main() {
  const writeCandidateUpdates = hasFlag("writeCandidateUpdates");
  const confirmImportMerge = hasFlag("confirmImportMerge");
  const mode = validateImportMergeApplyMode(writeCandidateUpdates, confirmImportMerge);
  const plan = await loadImportMergePlan();
  if (mode === "dry_run") {
    const execution = await executeImportMergePlan(plan);
    console.log("Mode: dry-run import merge; no candidate DB writes");
    console.log(`Candidate records affected: ${plan.candidateRecordsAffected}`);
    console.log(`Field updates planned: ${plan.fieldUpdatesPlanned}`);
    console.log(`Backup path: ${execution.backupPath}`);
    console.log(`Rollback path: ${execution.rollbackPath}`);
    console.log("Candidate DB writes: 0");
    return;
  }
  const env = loadCliEnv();
  printSupabaseEnvDiagnostics(env.diagnostics);
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) throw new Error("Confirmed import merge requires SUPABASE_SERVICE_ROLE_KEY and Supabase URL.");
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
  console.log("CONFIRMED IMPORT MERGE APPLY. Candidate DB field updates enabled.");
  const execution = await executeImportMergePlan(plan, {
    writeCandidateUpdates: true, confirmImportMerge: true,
    updateCandidate: async (candidateId, update) => { const { error } = await supabase.from("candidates").update(update).eq("id", candidateId); if (error) throw new Error(error.message); },
    readCandidates: async (candidateIds) => {
      const { data, error } = await supabase.from("candidates").select("*").in("id", candidateIds);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data || []).map((candidate) => [String(candidate.id), candidate]));
    },
  });
  console.log(`Applied field updates: ${execution.result.appliedCount}`);
  console.log(`Backup path: ${execution.backupPath}`);
  console.log(`Rollback path: ${execution.rollbackPath}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/applyImportMergePlan.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
