import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidatePortalAudit } from "./auditCandidatePortal";
import { recruiterRouteRegistry } from "../lib/recruiterRouteRegistry";

async function main() {
  const audit = await buildCandidatePortalAudit();
  assert.equal(audit.ownershipResolvedServerSide, true);
  assert.equal(audit.arbitraryCandidateIdInputRemoved, true);
  assert.equal(audit.twoConsentsRequired, true);
  assert.equal(audit.confirmationFeatureFlagged, true);
  assert.equal(audit.atomicConfirmationRpc, true);
  assert.equal(audit.cvUploadAvailable, true);
  assert.equal(audit.routesRegistered, true);
  assert.equal(audit.candidateFacingAdminLinksExposed, false);
  assert.equal(audit.recruiterReviewReadOnly, true);
  assert.equal(audit.productionEnabledByDefault, false);
  const portal = recruiterRouteRegistry.find(
    (item) => item.route === "/candidate/portal",
  );
  assert.equal(portal?.readOnly, false);
  assert.equal(portal?.candidateDbWrites, true);
  const source = [
    "app/candidate/portal/page.tsx",
    "app/candidate/portal/CandidatePortalClient.tsx",
    "app/api/candidate/profile/route.ts",
    "app/api/candidate/profile/confirmation/route.ts",
  ]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.match(source, /Legal employer/);
  assert.match(source, /Client \(not employer\)/);
  assert.match(source, /setStructured\("workExperience"/);
  assert.match(source, /setStructured\("projectExperience"/);
  assert.match(source, /setStructured\("education"/);
  assert.match(source, /setStructured\("languages"/);
  assert.doesNotMatch(
    source,
    /new OpenAI|responses\.create|sendMail|sendEmail/i,
  );
  console.log("candidatePortal.test.ts passed");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
