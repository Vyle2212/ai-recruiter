import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { executeCandidateRollback, loadCandidateRollbackPlan } from "../lib/aiExtractionCandidateRollback";

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function supabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Candidate rollback failed: missing Supabase URL/key.");
  return createClient(supabaseUrl, supabaseKey);
}

async function main() {
  const rollbackPath = argValue("rollbackPath", "reports/candidate-apply-rollback.json");
  const rollback = loadCandidateRollbackPlan(rollbackPath) || { mode: "empty rollback dry-run", createdAt: new Date().toISOString(), entries: [] };
  const writeCandidateUpdates = hasFlag("writeCandidateUpdates");
  const confirmRollback = hasFlag("confirmRollback");
  if (!(writeCandidateUpdates && confirmRollback)) {
    const result = await executeCandidateRollback(rollback);
    console.log("Mode: dry-run rollback only; no candidate DB writes");
    console.log(`Rollback entries loaded: ${rollback.entries.length}`);
    console.log(`Would restore count: ${result.wouldRestoreCount}`);
    console.log("Real rollback requires --confirmRollback --writeCandidateUpdates.");
    return;
  }

  const supabase = supabaseClient();
  const result = await executeCandidateRollback(rollback, {
    writeCandidateUpdates,
    confirmRollback,
    updateCandidate: async (candidateId, update) => {
      const { error } = await supabase.from("candidates").update(update).eq("id", candidateId);
      if (error) throw new Error(`Failed to rollback candidate ${candidateId}: ${error.message}`);
    },
  });
  const resultPath = path.resolve("reports", "candidate-rollback-result.json");
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(resultPath, `${JSON.stringify({ exportedAt: new Date().toISOString(), ...result }, null, 2)}\n`);
  console.log(`Rollback restored fields: ${result.restoredCount}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/rollbackCandidateChangesFromStaging.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
