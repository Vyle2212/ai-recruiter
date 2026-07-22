import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { buildImportStagingBatch } from "../lib/importStaging";
import { buildImportMergePlan, buildImportMergeProposals } from "../lib/importMergeApproval";

const existing = [
  { id: "empty", name: "Empty Company", email: "empty@example.com", current_company: "", current_title: "SAP Lead" },
  { id: "confirmed", name: "Confirmed Person", email: "confirmed@example.com", current_company: "Candidate Co", field_metadata: { currentCompany: { value: "Candidate Co", source: "candidate_confirmed" } } },
  { id: "approved", name: "Approved Person", email: "approved@example.com", current_company: "Recruiter Co", field_metadata: { currentCompany: { value: "Recruiter Co", source: "recruiter_approved" } } },
  { id: "conflict", name: "Conflict Person", email: "conflict@example.com", location: "Singapore" },
  { id: "low", name: "Low Confidence", email: "low@example.com", location: "" },
];
const imported = [
  { existingCandidateId: "empty", name: "Empty Company", current_company: "Safe Imported Co", currentCompanyConfidence: 95 },
  { existingCandidateId: "confirmed", name: "Confirmed Person", current_company: "Overwrite Candidate Co", currentCompanyConfidence: 95 },
  { existingCandidateId: "approved", name: "Approved Person", current_company: "Overwrite Recruiter Co", currentCompanyConfidence: 95 },
  { existingCandidateId: "conflict", name: "Conflict Person", location: "Thailand", locationConfidence: 90 },
  { existingCandidateId: "low", name: "Low Confidence", location: "Vietnam", locationConfidence: 45 },
  { existingCandidateId: "empty", name: "Empty Company", current_company: "Financial Services", currentCompanyConfidence: 95 },
];
const batch = buildImportStagingBatch(imported, existing, { batchName: "merge-test" });
const profiles = existing.map((candidate) => buildCandidate360Profile(candidate));
const proposals = buildImportMergeProposals(batch, profiles);
const find = (candidateId: string, fieldName: string, importedValue?: string) => proposals.find((item) => item.candidateId === candidateId && item.fieldName === fieldName && (importedValue === undefined || item.importedValue === importedValue));
assert.equal(find("empty", "currentCompany", "Safe Imported Co")?.decision, "approve_merge", "empty field and safe import is auto-approvable");
assert.equal(find("confirmed", "currentCompany")?.decision, "keep_existing", "candidate confirmed field is not overwritten");
assert.equal(find("approved", "currentCompany")?.decision, "keep_existing", "recruiter approved field is not overwritten");
assert.equal(find("empty", "currentCompany", "Financial Services")?.decision, "reject_merge", "generic bad imported value rejected");
assert.equal(find("conflict", "location")?.decision, "hold_for_review", "conflicting non-empty field held");
assert.equal(find("low", "location")?.decision, "ask_candidate_to_confirm", "low confidence asks candidate confirmation");
const plan = buildImportMergePlan(proposals);
assert.equal(plan.items.every((item) => item.decision === "approve_merge"), true);
assert.equal(plan.excluded.some((item) => ["hold_for_review", "reject_merge", "keep_existing"].includes(item.decision)), true, "merge plan excludes held, rejected, and keep existing");
assert.equal(plan.items.some((item) => item.candidateId === "confirmed" || item.candidateId === "approved"), false, "trusted fields absent from plan");

const sources = ["../lib/importMergeApproval.ts", "../app/api/import-merge/proposals/route.ts", "../app/api/import-merge/preview/route.ts"].map((file) => fs.readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
assert.equal(/\.update\(|\.insert\(|\.delete\(/.test(sources), false, "approval and preview code has no candidate DB writes");
assert.equal(/\b(?:unlink|rmSync|rmdir)\b/.test(sources), false, "no delete");
assert.equal(/from ["']openai["']|new OpenAI|\.responses\.create/.test(sources), false, "no OpenAI calls");
console.log("Import merge approval tests passed");
