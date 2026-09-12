import assert from "node:assert/strict";
import {
  evaluateIntegrityCandidate,
  applySearchIntegrity,
  SEARCH_INTEGRITY_VERSION,
} from "../lib/searchIntegrityV20";
import type { GuidedSearchHandoff } from "../lib/guidedSourcingTypes";
const plan: GuidedSearchHandoff["integrityPlan"] = {
  version: SEARCH_INTEGRITY_VERSION,
  planIdentity: "jp-fico",
  includeRelocationRemote: false,
  requirements: [
    {
      id: "R1",
      criterionId: "location",
      label: "Location: Japan",
      kind: "location",
      required: true,
      values: ["Japan"],
      country: "Japan",
      city: "Tokyo",
    },
    {
      id: "R2",
      criterionId: "experience",
      label: "Minimum five years",
      kind: "experience",
      required: true,
      values: ["5"],
      minimum: 5,
    },
    {
      id: "R3",
      criterionId: "languages",
      label: "Japanese and English",
      kind: "language",
      required: true,
      values: ["Japanese", "English"],
    },
    {
      id: "R4",
      criterionId: "projects",
      label: "Two end-to-end implementations",
      kind: "implementation",
      required: true,
      values: ["implementation"],
      minimum: 2,
    },
  ],
};
const result: any = {
  candidateId: "jp",
  implementationEvidenceCount: 2,
  score: { finalScore: 80 },
};
const jp: any = {
  candidateId: "jp",
  country: "Japan",
  location: "Tokyo, Japan",
  locationEvidenceState: "VERIFIED",
  totalYearsExperience: 7,
  languages: ["Japanese", "English"],
  groundedImplementationProjectCount: 2,
  evidence: [],
};
const accepted = evaluateIntegrityCandidate(result, jp, plan);
assert.equal(accepted.eligible, true);
assert.equal(accepted.requirements.length, plan.requirements.length);
for (const country of ["Malaysia", "Philippines", "Vietnam"])
  assert.equal(
    evaluateIntegrityCandidate(
      result,
      { ...jp, country, location: country },
      plan,
    ).eligible,
    false,
  );
assert.equal(
  evaluateIntegrityCandidate(
    result,
    { ...jp, country: null, location: null },
    plan,
  ).eligible,
  false,
);
assert.equal(
  evaluateIntegrityCandidate(
    result,
    { ...jp, totalYearsExperience: null },
    plan,
  ).eligible,
  false,
);
assert.equal(
  evaluateIntegrityCandidate(result, { ...jp, languages: [] }, plan).eligible,
  false,
);
assert.equal(
  evaluateIntegrityCandidate(
    result,
    { ...jp, groundedImplementationProjectCount: 0 },
    plan,
  ).requirements.find((item) => item.kind === "implementation")?.state,
  "not_verified",
);
assert.equal(
  applySearchIntegrity(
    [result, { ...result, candidateId: "my" }],
    [
      jp,
      {
        ...jp,
        candidateId: "my",
        country: "Malaysia",
        location: "Kuala Lumpur",
      },
    ],
    plan,
  ).length,
  1,
);
assert.equal(
  evaluateIntegrityCandidate(
    result,
    { ...jp, country: "Malaysia", location: "Kuala Lumpur" },
    { ...plan, includeRelocationRemote: true },
  ).broadeningApplied,
  true,
);
console.log("Search Integrity v20 tests passed");
