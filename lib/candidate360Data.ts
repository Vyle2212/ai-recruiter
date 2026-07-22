import fs from "node:fs";
import path from "node:path";
import { supabase } from "./supabase";
import { buildCandidate360Profile } from "./candidate360Profile";

function readJson(fileName: string): any {
  const filePath = path.join(process.cwd(), "reports", fileName);
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

export async function loadCandidate360Profile(candidateId: string) {
  const { data: candidate, error } = await supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!candidate) return null;
  const workflowFile = readJson("recruiter-workflow-state.json");
  const repairFile = readJson("repair-queue-audit.json");
  const workflowState = (workflowFile?.states || []).find((item: any) => item.candidateId === candidateId) || {};
  const repair = (repairFile?.items || []).find((item: any) => item.candidateId === candidateId);
  const approvals = readJson("ai-extraction-approvals.json");
  const decisions = readJson("quick-fix-apply-decisions.json");
  const applyHistory = readJson("candidate-apply-history.json") || readJson("quick-fix-post-apply-verification.json");
  return buildCandidate360Profile(candidate, {
    ...workflowState,
    repairQueueStatus: repair?.repairCategory || "not_in_repair_queue",
  }, approvals, decisions, applyHistory);
}
