import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { TALENT_SEARCH_DISPLAY_RESOLVER_VERSION } from "../lib/talentSearchDisplay";
import { buildDisplayRepairApplySummary, buildRollbackEntries, loadRepairPreview, type DisplayRepairUpdatePlan } from "../lib/candidateDisplayRepairApply";

function supabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Display repair apply failed: missing Supabase URL/key.");
  return createClient(supabaseUrl, supabaseKey);
}

function printPlanSample(title: string, plans: DisplayRepairUpdatePlan[]) {
  console.log("");
  console.log(title);
  const sample = plans.slice(0, 8);
  if (!sample.length) {
    console.log("- None");
    return;
  }
  for (const plan of sample) {
    if (!plan.changedFields.length) {
      console.log(`- ${plan.candidate_id} | no auto-write fields | confidence: ${plan.confidence} | source: ${plan.source_field} | reason: ${plan.reason} | write eligibility: ${plan.writeEligibility}`);
      continue;
    }
    for (const field of plan.changedFields) {
      console.log(`- ${plan.candidate_id} | ${field} | ${String(plan.oldValues[field] ?? "")} -> ${String(plan.newValues[field] ?? "")} | confidence: ${plan.confidence} | source: ${plan.source_field} | reason: ${plan.reason} | write eligibility: ${plan.writeEligibility}`);
    }
  }
}

function printSummary(summary: ReturnType<typeof buildDisplayRepairApplySummary>, mode: string) {
  console.log("==================================================");
  console.log("PRIMUS AI Recruiter");
  console.log("Candidate Display Repair Apply");
  console.log("==================================================");
  console.log("");
  console.log(`Display resolver: ${TALENT_SEARCH_DISPLAY_RESOLVER_VERSION}`);
  console.log(`Mode: ${mode}`);
  console.log(`Total suggestions: ${summary.totalSuggestions}`);
  console.log(`safeDisplayRepairs: ${summary.safeDisplayRepairs.length}`);
  console.log(`structuredEmployerRepairs: ${summary.structuredEmployerRepairs.length}`);
  console.log(`rawTextEmployerCandidates: ${summary.rawTextEmployerCandidates.length}`);
  console.log(`manualReview: ${summary.manualReview.length}`);
  printPlanSample("safeDisplayRepairs samples", summary.safeDisplayRepairs);
  printPlanSample("structuredEmployerRepairs samples", summary.structuredEmployerRepairs);
  printPlanSample("rawTextEmployerCandidates samples", summary.rawTextEmployerCandidates);
  printPlanSample("manualReview samples", summary.manualReview);
}

function selectedWritePlans(summary: ReturnType<typeof buildDisplayRepairApplySummary>, args: string[]) {
  const plans: DisplayRepairUpdatePlan[] = [];
  if (args.includes("--write-safe-only")) plans.push(...summary.safeDisplayRepairs);
  if (args.includes("--write-structured-employer")) plans.push(...summary.structuredEmployerRepairs);
  return plans;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const writeSafeOnly = args.includes("--write-safe-only");
  const writeStructuredEmployer = args.includes("--write-structured-employer");
  if (write && !writeSafeOnly && !writeStructuredEmployer) {
    throw new Error("Refusing to write: use --write-safe-only and/or --write-structured-employer with --write. Full write is not allowed.");
  }

  const suggestions = loadRepairPreview(path.resolve("repair-preview.json"));
  const { candidates } = await loadRealTalentPoolCandidates();
  const candidatesById = new Map(candidates.map((candidate: Record<string, any>) => [String(candidate.id || candidate.candidate_id), candidate]));
  const summary = buildDisplayRepairApplySummary(suggestions, candidatesById);
  const writePlans = selectedWritePlans(summary, args);
  const mode = write ? `WRITE (${[writeSafeOnly ? "safe-display" : "", writeStructuredEmployer ? "structured-employer" : ""].filter(Boolean).join(" + ")})` : "DRY RUN";
  printSummary(summary, mode);

  if (!write) {
    console.log("");
    console.log("Dry run only. No database updates were made. Re-run with -- --write --write-safe-only and/or --write-structured-employer to apply eligible updates.");
    return;
  }

  const rollbackPath = path.resolve("candidate-display-repair-rollback.json");
  const rollback = buildRollbackEntries(writePlans);
  fs.writeFileSync(rollbackPath, JSON.stringify(rollback, null, 2) + "\n", "utf8");
  console.log("");
  console.log(`Rollback file written: ${rollbackPath}`);

  const supabase = supabaseClient();
  let applied = 0;
  for (const plan of writePlans) {
    if (!plan.changedFields.length) continue;
    const { error } = await supabase.from("candidates").update(plan.update).eq("id", plan.candidate_id);
    if (error) throw new Error(`Failed to update candidate ${plan.candidate_id}: ${error.message}`);
    applied += 1;
  }
  console.log(`Applied updates: ${applied}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
