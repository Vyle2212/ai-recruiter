import assert from "node:assert/strict";
import fs from "node:fs";

import { buildCandidateEducationPresentation } from "../lib/candidateProfilePresentation";

const mohamed = buildCandidateEducationPresentation({
  educationRecords: [],
  credentialRecords: [
    "SAP Certified Application Associate - Financial Accounting",
    "HCL Axon - SAP Certified Application Associate - Management Accounting",
    "ITIL Foundation Certificate in ITSM",
    "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
  ],
});
assert.deepEqual(
  {
    educationRecords: mohamed.educationRecords.length,
    certificationRecords: mohamed.certificationRecords.length,
    qualificationRecords: mohamed.qualificationRecords.length,
    trainingRecords: mohamed.trainingRecords.length,
    totalEducationRelatedRecords: mohamed.totalEducationRelatedRecords,
  },
  {
    educationRecords: 0,
    certificationRecords: 3,
    qualificationRecords: 0,
    trainingRecords: 1,
    totalEducationRelatedRecords: 4,
  },
);
assert.deepEqual(mohamed.trainingRecords, [
  "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
]);

const gunawan = buildCandidateEducationPresentation({});
assert.equal(gunawan.totalEducationRelatedRecords, 0);
assert.deepEqual(gunawan.educationRecords, []);
assert.deepEqual(gunawan.certificationRecords, []);
assert.deepEqual(gunawan.trainingRecords, []);

const indra = buildCandidateEducationPresentation({
  educationRecords: [
    "IPB",
    "SMA La Tansa",
    "SMP La Tansa",
    "SDN Kramat Watu 2",
  ].map((institution, index) => ({ id: `indra-${index}`, institution })),
});
assert.equal(indra.educationRecords.length, 4);
assert.equal(indra.totalEducationRelatedRecords, 4);

const mixed = buildCandidateEducationPresentation({
  educationRecords: [
    {
      id: "degree-1",
      institution: "Example University",
      qualification: "Bachelor of Accounting",
    },
  ],
  qualificationRecords: ["Chartered Accountant"],
  credentialRecords: ["PMP Certification", "Finance Systems Workshop"],
});
assert.deepEqual(
  [
    mixed.educationRecords.length,
    mixed.certificationRecords.length,
    mixed.qualificationRecords.length,
    mixed.trainingRecords.length,
    mixed.totalEducationRelatedRecords,
  ],
  [1, 1, 1, 1, 4],
);

const duplicateTraining = buildCandidateEducationPresentation({
  credentialRecords: [
    "GKK Consultants Sdn Bhd - SAP Data Medium Excha",
    "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
    " GKK Consultants Sdn Bhd - SAP Data Medium Exchange ",
  ],
});
assert.deepEqual(duplicateTraining.trainingRecords, [
  "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
]);
assert.equal(duplicateTraining.totalEducationRelatedRecords, 1);

for (const malformed of ["", "---", "Not provided", "N/A", "\u200b"]) {
  const rejected = buildCandidateEducationPresentation({
    credentialRecords: [malformed],
  });
  assert.equal(rejected.totalEducationRelatedRecords, 0, malformed);
  assert.deepEqual(rejected.trainingRecords, [], malformed);
}

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(drawer, /Training and courses \(\{trainingRecords\.length\}\)/);
assert.match(drawer, /trainingRecords\.map\(\(item\)/);
assert.match(drawer, /Certifications \(\{certificationRecords\.length\}\)/);
assert.match(drawer, /certificationRecords\.map\(\(item\)/);
assert.doesNotMatch(drawer, /credentials\.(?:training|certifications)/);

const contract = fs.readFileSync(
  "lib/searchV2CandidateDetailContract.ts",
  "utf8",
);
assert.match(contract, /educationPresentation,/);
assert.match(contract, /canonical-education-presentation/);

console.log("Canonical candidate education presentation tests passed.");
