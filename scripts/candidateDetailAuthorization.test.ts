import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/candidates/[id]/route.ts", "utf8");
const page = fs.readFileSync("app/candidates/[id]/page.tsx", "utf8");
const listRoute = fs.readFileSync("app/api/candidates/route.ts", "utf8");
const searchRoute = fs.readFileSync("app/api/search-candidates/route.ts", "utf8");
const getCandidatesRoute = fs.readFileSync("app/api/get-candidates/route.ts", "utf8");
const resumeRoute = fs.readFileSync("app/api/candidate360/[candidateId]/resume/route.ts", "utf8");
const dashboardRoute = fs.readFileSync("app/api/dashboard/route.ts", "utf8");
const validationRoute = fs.readFileSync("app/api/candidate-validation/route.ts", "utf8");

for (const source of [route, page]) {
  assert.match(source, /requireRecruiterSearchAuthorization/);
  assert.match(source, /candidate-detail:read/);
  assert.doesNotMatch(source, /from "@\/lib\/supabase"/);
}
assert.match(route, /createLazySupabaseServiceClient/);
assert.doesNotMatch(route, /searchParams\.get\("role"/);
assert.doesNotMatch(route, /searchParams\.get\("adminApproved"/);
assert.doesNotMatch(route, /searchParams\.get\("subscription"/);
assert.match(route, /redacted\.email = ""/);
assert.match(route, /redacted\.phone = ""/);
assert.match(route, /Candidate id must be a UUID/);
assert.match(page, /const contactUnlocked = false/);
for (const source of [listRoute, searchRoute]) {
  assert.match(source, /requireRecruiterSearchAuthorization/);
  assert.match(source, /permission: "search:read"/);
  assert.doesNotMatch(source, /from "@\/lib\/supabase"/);
}
assert.doesNotMatch(listRoute, /\.select\("\*"\)/);
assert.doesNotMatch(searchRoute, /requestedRole:\s*firstParam\(url, \["viewerRole", "role"\]/);
for (const source of [getCandidatesRoute, dashboardRoute]) {
  assert.match(source, /requireRecruiterSearchAuthorization/);
  assert.match(source, /permission: "search:read"/);
  assert.doesNotMatch(source, /from "@\/lib\/supabase"/);
}
assert.match(resumeRoute, /requireRecruiterSearchAuthorization/);
assert.match(resumeRoute, /permission: "candidate-detail:read"/);
assert.doesNotMatch(getCandidatesRoute, /\.select\("\*"\)/);
assert.match(validationRoute, /requireRecruiterSearchAuthorization/);
assert.match(validationRoute, /createLazySupabaseServiceClient/);
assert.doesNotMatch(validationRoute, /from "@\/lib\/supabase"/);
console.log("candidateDetailAuthorization.test.ts passed");
