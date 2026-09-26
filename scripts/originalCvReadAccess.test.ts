import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { originalCvReadGrant } from "../lib/originalCvAccess";
import { recruiterOriginalCvAllowed } from "../lib/recruiterOriginalCvPolicy";

const id = "11111111-1111-4111-8111-111111111111";
const reference = `candidate-original-cvs/${id}.pdf`;
assert.equal(originalCvReadGrant("client", reference), null);
assert.equal(originalCvReadGrant("recruiter", reference), null);
assert.equal(originalCvReadGrant("client", reference, true), null);
assert.equal(originalCvReadGrant("admin", "https://example.com/cv.pdf"), null);
assert.equal(
  originalCvReadGrant("admin", "candidate-original-cvs/../secret.pdf"),
  null,
);
assert.deepEqual(originalCvReadGrant("admin", reference), {
  objectKey: `${id}.pdf`,
  contentType: "application/pdf",
  disposition: 'inline; filename="candidate-cv.pdf"',
});
assert.equal(
  originalCvReadGrant("admin", `candidate-original-cvs/${id}.docx`)
    ?.disposition,
  'attachment; filename="candidate-cv.docx"',
);
const recruiterId = "22222222-2222-4222-8222-222222222222";
const approvedBy = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-09-26T12:00:00.000Z");
const grant = {
  candidate_id: id,
  recruiter_profile_id: recruiterId,
  approved_by_profile_id: approvedBy,
  purpose: "headhunting" as const,
  client_id: null,
  approved_at: "2026-09-25T12:00:00.000Z",
  expires_at: "2026-10-26T12:00:00.000Z",
  revoked_at: null,
  status: "active",
};
const evidence = {
  candidateId: id,
  recruiterProfileId: recruiterId,
  grant,
  now,
};
assert.equal(recruiterOriginalCvAllowed(evidence), true);
assert.ok(originalCvReadGrant("recruiter", reference, true));
assert.equal(recruiterOriginalCvAllowed({ ...evidence, grant: null }), false);
assert.equal(
  recruiterOriginalCvAllowed({ ...evidence, recruiterProfileId: approvedBy }),
  false,
);
assert.equal(
  recruiterOriginalCvAllowed({ ...evidence, candidateId: approvedBy }),
  false,
);
assert.equal(
  recruiterOriginalCvAllowed({
    ...evidence,
    grant: { ...grant, revoked_at: now.toISOString() },
  }),
  false,
);
assert.equal(
  recruiterOriginalCvAllowed({
    ...evidence,
    grant: { ...grant, expires_at: now.toISOString() },
  }),
  false,
);
const scoped = {
  ...grant,
  purpose: "client_support" as const,
  client_id: approvedBy,
};
assert.equal(recruiterOriginalCvAllowed({ ...evidence, grant: scoped }), false);
for (const missing of [
  "assigned",
  "candidateShared",
  "candidateVisible",
  "featureActive",
] as const) {
  const support = {
    assigned: true,
    candidateShared: true,
    candidateVisible: true,
    featureActive: true,
  };
  support[missing] = false;
  assert.equal(
    recruiterOriginalCvAllowed({ ...evidence, grant: scoped, support }),
    false,
  );
}
assert.equal(
  recruiterOriginalCvAllowed({
    ...evidence,
    grant: scoped,
    support: {
      assigned: true,
      candidateShared: true,
      candidateVisible: true,
      featureActive: true,
    },
  }),
  true,
);

const route = readFileSync(
  "app/api/candidate360/[candidateId]/resume/route.ts",
  "utf8",
);
assert.ok(
  route.indexOf('scope.role !== "admin"') <
    route.indexOf('.from("candidates")'),
);
assert.match(route, /\.from\("recruiter_original_cv_grants"\)/);
assert.match(route, /recruiterOriginalCvAllowed/);
assert.match(route, /\.from\("client_candidate_access"\)/);
assert.match(route, /\.select\("source_file"\)/);
assert.match(route, /\.from\(ORIGINAL_CV_BUCKET\)/);
assert.match(route, /"X-Content-Type-Options": "nosniff"/);
assert.doesNotMatch(route, /getPublicUrl|createSignedUrl/);
const approvalRoute = readFileSync(
  "app/api/admin/original-cv-grants/route.ts",
  "utf8",
);
assert.match(approvalRoute, /validateRecruiterApiWriteRequest/);
assert.match(approvalRoute, /scope\.role !== "admin"/);
assert.match(
  approvalRoute,
  /originalCvReference\(candidate\.data\?\.source_file\)/,
);
assert.match(approvalRoute, /\.from\("recruiter_original_cv_grants"\)/);
const sharingRoute = readFileSync(
  "app/api/client/recruiter-shares/route.ts",
  "utf8",
);
assert.match(sharingRoute, /auth\.auth\.getUser\(\)/);
assert.match(sharingRoute, /client_memberships/);
assert.match(sharingRoute, /client_candidate_access/);
assert.match(sharingRoute, /client_job_ownership/);
assert.doesNotMatch(sharingRoute, /recruiter_original_cv_grants/);
const schema = readFileSync(
  "supabase/manual/202609260006_recruiter_client_entitlements.sql",
  "utf8",
);
assert.match(schema, /recruiter_original_cv_grant_event_immutable/);
assert.match(schema, /force row level security/g);
assert.match(schema, /from public, anon, authenticated/);
console.log("originalCvReadAccess.test.ts passed");
