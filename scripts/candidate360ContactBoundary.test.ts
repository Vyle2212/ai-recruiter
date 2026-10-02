import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { redactCandidate360Contact } from "../lib/candidate360ContactBoundary";
import { originalCvReadGrant } from "../lib/originalCvAccess";

const original = buildCandidate360Profile({
  id: "synthetic-candidate",
  name: "Synthetic Candidate",
  email: "synthetic@example.invalid",
  phone: "+10000000000",
  current_title: "SAP Consultant",
  current_company: "Example Employer",
});
assert.equal(original.contactInfo.email.value, "synthetic@example.invalid");
assert.equal(original.contactInfo.phone.value, "+10000000000");
const safe = redactCandidate360Contact(original);
assert.equal(safe.contactInfo.email.value, "");
assert.equal(safe.contactInfo.phone.value, "");
assert.equal(safe.contactInfo.email.evidence, "");
assert.equal(safe.contactInfo.phone.evidence, "");
assert.equal(safe.currentCompany.value, original.currentCompany.value);
assert.equal(original.contactInfo.email.value, "synthetic@example.invalid");

const loader = fs.readFileSync(
  new URL("../lib/candidate360Data.ts", import.meta.url),
  "utf8",
);
const resumeRoute = fs.readFileSync(
  new URL(
    "../app/api/candidate360/[candidateId]/resume/route.ts",
    import.meta.url,
  ),
  "utf8",
);
assert.match(loader, /return redactCandidate360Contact\(result\)/);
assert.match(resumeRoute, /authorization\.scope\.role !== "admin"/);
assert.match(resumeRoute, /original_cv_entitlement_required/);
assert.match(resumeRoute, /recruiterSearchPrivateNoStoreHeaders/);
assert.match(resumeRoute, /originalCvReadGrant/);

const originalCvReference =
  "candidate-original-cvs/00000000-0000-4000-8000-000000000000.pdf";
assert.equal(originalCvReadGrant("client", originalCvReference), null);
assert.equal(originalCvReadGrant("recruiter", originalCvReference), null);
assert.ok(originalCvReadGrant("admin", originalCvReference));
console.log("Candidate360 contact boundary tests passed");
