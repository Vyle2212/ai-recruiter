import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadRealTalentPoolCandidates } from "@/lib/candidateAudit";
import { buildCandidateApplyBackup, writeCandidateApplyBackup } from "@/lib/aiExtractionCandidateBackup";
import { executeCandidateApplyPlan, writeCandidateApplyResult, writeCandidatePostAudit } from "@/lib/aiExtractionCandidateApplyExecutor";
import { buildCandidateApplyPlan, loadStagingItems } from "@/lib/aiExtractionCandidateApplyPlan";
import { buildCandidateRollbackPlan, writeCandidateRollbackPlan } from "@/lib/aiExtractionCandidateRollback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Candidate apply failed: missing Supabase URL/key.");
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const writeCandidateUpdates = body?.writeCandidateUpdates === true;
    const confirmApply = body?.confirmApply === true;
    if (writeCandidateUpdates !== confirmApply) {
      return NextResponse.json({ error: "Real candidate updates require both writeCandidateUpdates=true and confirmApply=true." }, { status: 403 });
    }

    const { candidates } = await loadRealTalentPoolCandidates();
    const plan = buildCandidateApplyPlan(loadStagingItems(), candidates);
    const backup = buildCandidateApplyBackup(plan);
    const rollback = buildCandidateRollbackPlan(backup);

    if (!writeCandidateUpdates || !confirmApply) {
      const result = await executeCandidateApplyPlan(plan, { backup, rollback });
      return NextResponse.json({ ...result, dryRun: true, message: "Dry run only. No candidate DB updates were made." });
    }

    const backupPath = writeCandidateApplyBackup(backup);
    const rollbackPath = writeCandidateRollbackPlan(rollback);
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
    const resultPath = writeCandidateApplyResult(result);
    const postAuditPath = writeCandidatePostAudit(result);
    return NextResponse.json({ ...result, backupPath, rollbackPath, resultPath, postAuditPath });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to execute candidate apply preview" }, { status: 500 });
  }
}