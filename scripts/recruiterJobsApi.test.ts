import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidateJobDecision } from "../lib/candidate360Decision";
import { filterOpenJobs, jobsFromPayload, jobClientName } from "../lib/candidate360JobPicker";

async function main() {
const base = process.env.JOBS_API_BASE_URL || "http://localhost:3000";
const candidateId = process.env.CANDIDATE360_TEST_CANDIDATE_ID || "361379db-0ce4-4ae0-a52c-0868a910b26f";
const authCookie = process.env.RECRUITER_JOBS_TEST_AUTH_COOKIE?.trim();
const headers:Record<string,string> = { accept: "application/json" };
if (authCookie) headers.cookie = authCookie;
const jobsResponse = await fetch(`${base}/api/jobs`, { headers });
const jobsText = await jobsResponse.text();
if (!authCookie) {
  assert.equal(jobsResponse.status, 401, jobsText);
  assert.equal(JSON.parse(jobsText).error, "authentication_required");
} else {
assert.equal(jobsResponse.status, 200, jobsText);
const payload = JSON.parse(jobsText);
const jobs = jobsFromPayload(payload);
assert.ok(jobs.length > 0, "real eligible Jobs are returned");
assert.ok(jobs.every((job) => job.status === "active"), "only active Jobs are returned");
assert.ok(jobs.every((job) => typeof job.id === "string" && typeof job.title === "string"), "canonical identity fields are present");
assert.ok(jobs.every((job) => "clientName" in job && "structuredRequirementsAvailable" in job), "canonical picker fields are present");
assert.equal(filterOpenJobs(jobs, String(jobs[0].title).slice(0, 8)).some((job) => job.id === jobs[0].id), true, "search finds the live Job");
assert.equal(jobClientName(jobs[0]), String(jobs[0].clientName || ""));

const targetJob = jobs.find((job) => /SAP Consultant \(FI\/CO\)/i.test(String(job.title))) || jobs[0];
const detailResponse = await fetch(`${base}/api/jobs/${encodeURIComponent(String(targetJob.id))}`);
assert.equal(detailResponse.status, 200);
const selectedJob = await detailResponse.json();
assert.equal(selectedJob.id, targetJob.id);
const missingResponse = await fetch(`${base}/api/jobs/00000000-0000-0000-0000-000000000000`);
assert.equal(missingResponse.status, 404);

const candidateResponse = await fetch(`${base}/api/candidate360/${candidateId}`);
assert.equal(candidateResponse.status, 200);
const candidate = await candidateResponse.json();
const decision = buildCandidateJobDecision(candidate, selectedJob);
assert.equal(decision.job.id, selectedJob.id);
assert.notEqual(decision.overall.status, "not_assessed");
assert.ok(decision.requirements.length > 0, "structured Job requirements drive the assessment");
assert.ok(decision.interviewFocus.length >= 3 && decision.interviewFocus.length <= 7, "Job-backed interview focus is grouped and actionable");
if (/SAP Consultant \(FI\/CO\)/i.test(String(selectedJob.title))) {
  assert.ok(decision.requirements.length < 25, `normalized requirement count is defensible: ${decision.requirements.length}`);
  assert.ok(!decision.requirements.some((item) => ["Finance", "Water", "English", "Manila", "ABAP"].includes(item.label)), "isolated formatting fragments are absent");
  assert.equal(decision.breakdown.find((item) => item.key === "experience")?.score, null, "unsupported SAP duration remains non-numeric");
  assert.equal(decision.breakdown.find((item) => item.key === "language")?.score, null, "English is not inferred");
  assert.equal(decision.breakdown.find((item) => item.key === "industry")?.score, null, "industry breadth is not target-industry match");
  assert.equal(decision.breakdown.find((item) => item.key === "location")?.score, null, "Malaysia is not a Manila match");
  assert.equal(decision.overall.recommendation, "Need Validation");
  assert.doesNotMatch(JSON.stringify(decision), /\u00e2\u0080|\u00c3|\u00c2/);
}
}

const collectionRoute = fs.readFileSync("app/api/jobs/route.ts", "utf8");
const detailRoute = fs.readFileSync("app/api/jobs/[id]/route.ts", "utf8");
const dataSource = fs.readFileSync("lib/recruiterJobsData.ts", "utf8");
const authorizationSource = fs.readFileSync("lib/recruiterJobsAuthorization.ts", "utf8");
for (const source of [collectionRoute, detailRoute]) assert.match(source, /authorizeRecruiterJobsRead/);
assert.match(authorizationSource, /status:\s*401,\s*code:\s*"authentication_required"/);
assert.match(authorizationSource, /\["admin",\s*"recruiter_manager",\s*"recruiter"\]/);
assert.match(authorizationSource, /status:\s*403,\s*code:\s*"recruiter_role_required"/);
assert.match(authorizationSource, /status:\s*403,\s*code:\s*"active_recruiter_profile_required"/);
assert.match(dataSource, /createCandidateSupabaseAdminClient/);
assert.match(dataSource, /\.eq\("status", "active"\)/);
console.log(authCookie?"recruiterJobsApi.test.ts passed with authenticated recruiter fixture":"recruiterJobsApi.test.ts passed: unauthenticated access denied; recruiter/admin allowlist and unauthorized-role denial retained");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
