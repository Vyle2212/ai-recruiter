import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/candidates/[id]/route.ts", "utf8");
const page = fs.readFileSync("app/candidates/[id]/page.tsx", "utf8");

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
console.log("candidateDetailAuthorization.test.ts passed");
