import assert from "node:assert/strict";
import { buildThreeTierRecoveryPlan } from "../lib/threeTierRecovery";

const source = (name: string, raw: string) => ({ id: name, name, raw_text: raw });
const base = "Email: person@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation, data migration, UAT, SIT and SAP Finance delivery across several projects and employment history.";
const report = buildThreeTierRecoveryPlan([
  source("Priya Raman", `Full Name: Priya Raman\n${base}`),
  source("Candidate profile pending validation", `Candidate profile pending validation\n${base}`),
  source("Profile Under Review", "x SAP"),
], { aiReviewBudget: 1 });

assert.equal(report.mode, "read-only");
assert.deepEqual(report.safety, { openAiCalls: 0, databaseWrites: 0, automaticBackfill: false });
assert.equal(report.tiers.aiReview.queued <= 1, true);
assert.equal(report.tiers.aiReview.deferred >= 0, true);
assert.equal(report.tiers.reupload.count >= 1, true);
assert.equal(report.tiers.aiReview.candidateIds.includes("Profile Under Review"), false);
console.log("Three-tier recovery plan is credit-capped and read-only: PASS");
