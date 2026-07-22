import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildCandidate360Profile } from "../lib/candidate360Profile";

function readJson(fileName: string): any {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "reports", fileName), "utf8")); } catch { return null; }
}

export async function buildCandidate360Audit() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const workflow = readJson("recruiter-workflow-state.json");
  const repair = readJson("repair-queue-audit.json");
  const approvals = readJson("ai-extraction-approvals.json");
  const decisions = readJson("quick-fix-apply-decisions.json");
  const history = readJson("candidate-apply-history.json") || readJson("quick-fix-post-apply-verification.json");
  const workflowById = new Map((workflow?.states || []).map((item: any) => [item.candidateId, item]));
  const repairById = new Map((repair?.items || []).map((item: any) => [item.candidateId, item]));
  const profiles = candidates.map((candidate) => {
    const candidateId = String(candidate.id || candidate.candidate_id || "");
    const state: any = workflowById.get(candidateId) || {};
    const repairItem: any = repairById.get(candidateId);
    return buildCandidate360Profile(candidate, { ...state, repairQueueStatus: repairItem?.repairCategory }, approvals, decisions, history);
  });
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only Candidate360 audit; no candidate DB writes",
    profilesAnalyzed: profiles.length,
    readyForShortlist: profiles.filter((item) => item.readiness.readyForShortlist).length,
    needsCandidateConfirmation: profiles.filter((item) => item.readiness.needsCandidateConfirmation).length,
    missingCurrentCompany: profiles.filter((item) => item.missingFields.includes("currentCompany")).length,
    missingTitle: profiles.filter((item) => item.missingFields.includes("currentTitle")).length,
    missingLocation: profiles.filter((item) => item.missingFields.includes("location")).length,
    highCompletenessProfiles: profiles.filter((item) => item.completeness.highCompleteness).length,
    lowCompletenessProfiles: profiles.filter((item) => item.completeness.lowCompleteness).length,
    policy: { candidateDbWrites: false, supabaseWrites: false, delete: false, fullReupload: false, openAiCalls: false },
  };
}

async function main() {
  const report = await buildCandidate360Audit();
  const outputPath = path.join(process.cwd(), "reports", "candidate360-audit.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Mode: read-only Candidate360 audit; no candidate DB writes");
  console.log(`Profiles analyzed: ${report.profilesAnalyzed}`);
  console.log(`Ready for shortlist: ${report.readyForShortlist}`);
  console.log(`Needs candidate confirmation: ${report.needsCandidateConfirmation}`);
  console.log(`Missing current company: ${report.missingCurrentCompany}`);
  console.log(`Missing title: ${report.missingTitle}`);
  console.log(`Missing location: ${report.missingLocation}`);
  console.log(`High completeness profiles: ${report.highCompletenessProfiles}`);
  console.log(`Low completeness profiles: ${report.lowCompletenessProfiles}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditCandidate360Profiles.ts")) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
