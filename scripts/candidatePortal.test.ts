import assert from "node:assert/strict";
import fs from "node:fs";
import {
  contactHeaderPhone,
  candidateLanguageLevels,
  candidateDateParts,
  sapProjectTypeEvidence,
} from "../lib/candidatePortalEditEvidence";
import { buildCandidatePortalAudit } from "./auditCandidatePortal";
import {
  candidateCountries,
  splitCandidateLocation,
  joinCandidateLocation,
} from "../lib/candidateEditOptions";
import { recruiterRouteRegistry } from "../lib/recruiterRouteRegistry";

async function main() {
  assert.equal(candidateCountries.length, 249);
  for (const location of [
    "Manila, Philippines",
    "Singapore",
    "Perth, Australia",
    "Łódź, Poland",
    "City not listed, Philippines",
  ]) {
    const parts = splitCandidateLocation(location);
    assert.equal(
      joinCandidateLocation(parts.city, parts.country),
      location,
      "Changing presentation must preserve existing location",
    );
  }
  assert.equal(
    splitCandidateLocation("Unrecognised location text").city,
    "Unrecognised location text",
  );
  assert.equal(splitCandidateLocation("HCMC, Vietnam").country, "Vietnam");
  assert.equal(
    contactHeaderPhone(
      "Aruna\n+61 435189635 | email@example.invalid\nPROFILE SUMMARY\nFinance",
    ),
    "+61435189635",
  );
  assert.equal(
    contactHeaderPhone(
      "Aruna\nPROFILE SUMMARY\nA project had phone +6591234567",
    ),
    undefined,
    "A number in project text must not become contact",
  );
  assert.equal(
    contactHeaderPhone("Aruna\n+6591234567 | +84912345678\nPROFILE SUMMARY"),
    undefined,
    "Ambiguous phones require candidate choice",
  );
  assert.ok(candidateLanguageLevels("Japanese").includes("JLPT N2"));
  assert.ok(!candidateLanguageLevels("French").includes("JLPT N2"));
  assert.ok(candidateLanguageLevels("Korean").includes("TOPIK 6"));
  assert.deepEqual(candidateDateParts("1998"), { year: "1998", month: "" });
  assert.deepEqual(candidateDateParts("September 2025"), {
    year: "2025",
    month: "09",
  });
  assert.equal(
    sapProjectTypeEvidence("SAP BPC implementation with post-go-live support"),
    "Implementation, Support",
  );
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
  assert.match(
    source,
    /finalizePossiblyCompletedSignedCvUpload\(\{[\s\S]*uploadError: uploaded\.error/,
    "candidate upload must ask the server to resolve an ambiguous Storage response",
  );
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
