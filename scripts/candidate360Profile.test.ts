import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { Candidate360FieldSource as Source, Candidate360VerificationStatus as Status } from "../lib/candidate360Types";

const candidate = {
  id: "candidate-1", name: "Jane Parser", current_title: "SAP Consultant", current_company: "Parser Co",
  location: "", email: "jane@example.com", years: 8, primary_module: "FICO", skills: ["S/4HANA"],
  work_experience: [{ title: "Consultant", company: "Parser Co", startDate: "2020" }],
  field_metadata: {
    displayName: { value: "Jane Confirmed", source: "candidate_confirmed", lastConfirmedBy: "candidate-1" },
  },
};
const approvals = { approvals: [
  { candidateId: "candidate-1", fieldName: "displayName", suggestedValue: "Jane Recruiter", decision: "approve_suggestion", updatedAt: "2026-01-01" },
  { candidateId: "candidate-1", fieldName: "currentCompany", suggestedValue: "Approved Co", decision: "approve_suggestion", updatedAt: "2026-01-01" },
] };
const profile = buildCandidate360Profile(candidate, { currentStatus: "ready_for_shortlist", readyForShortlist: true }, approvals);
assert.equal(profile.candidateId, "candidate-1", "builds Candidate360 profile from candidate and workflow");
assert.equal(profile.displayName.value, "Jane Confirmed", "candidate confirmed fields outrank parser and recruiter values");
assert.equal(profile.displayName.source, Source.CandidateConfirmed);
assert.equal(profile.displayName.verificationStatus, Status.CandidateConfirmed);
assert.equal(profile.currentCompany.value, "Approved Co", "recruiter-approved fields are preserved");
assert.equal(profile.currentCompany.source, Source.RecruiterApproved);
assert.equal(profile.readiness.readyForShortlist, true);
assert.equal(profile.missingFields.includes("location"), true, "missing fields detected");
assert.equal(profile.completeness.score > 0 && profile.completeness.score < 100, true, "completeness calculated");

const source = fs.readFileSync(new URL("../lib/candidate360Profile.ts", import.meta.url), "utf8");
const dataSource = fs.readFileSync(new URL("../lib/candidate360Data.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../app/api/candidate360/[candidateId]/route.ts", import.meta.url), "utf8");
assert.equal(/\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(source + dataSource + routes), false, "no candidate DB writes");
assert.equal(/from ["']openai["']|new OpenAI|\.responses\.create/.test(source + dataSource + routes), false, "no OpenAI calls");
assert.equal(/\b(?:unlink|rmSync|rmdir)\b/.test(source + dataSource + routes), false, "no delete");
console.log("Candidate360 profile tests passed");
