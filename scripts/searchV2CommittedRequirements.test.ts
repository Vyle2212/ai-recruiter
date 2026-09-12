import assert from "node:assert/strict";
import fs from "node:fs";
import { rankCandidatesV2, searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import { buildSearchExecutionProfile } from "../lib/searchV2ExecutionProfile";
import type {
  CandidateSearchV2Document,
  TrustedCandidateEvidenceValue,
} from "../lib/candidateSearchV2Types";

const profileEvidence = {
  name: true,
  title: true,
  employer: true,
  location: true,
  experienceDuration: true,
  employmentHistory: true,
  projectHistory: true,
  education: false,
  certifications: false,
  skills: true,
};
function document(
  id: string,
  title: string,
  country: string,
  evidence: Array<
    [TrustedCandidateEvidenceValue["sourceType"], string, string?, string?]
  >,
): CandidateSearchV2Document {
  return {
    candidateId: id,
    candidateName: id,
    currentTitle: title,
    currentEmployer: "Fixture",
    country,
    location: country,
    locationEvidenceState: country ? "VERIFIED" : "UNKNOWN",
    totalYearsExperience: 10,
    skills: [],
    sapModules: [],
    industries: [],
    languages: [],
    searchableText: [title, ...evidence.map((item) => item[1])].join(" "),
    trustedCandidateEvidence: {
      candidateId: id,
      values: evidence.map(([sourceType, value, sourceId, sourceField]) => ({
        value,
        sourceType,
        sourceField: sourceField || (
          sourceType === "raw_title"
            ? "request_candidate.title"
            : sourceType === "direct_skill"
              ? "request_candidate.skills"
              : "request_candidate.raw_text"),
        sourceRecordId: sourceId || id,
        provenance: "candidate_record_raw",
        trusted: true,
      })),
    },
    domainEvidence: {},
    profileQualityScore: 80,
    dataConfidenceScore: 80,
    profileEvidence,
  };
}

const cpiExact = document("cpi-exact", "SAP CPI Consultant", "Malaysia", [
  ["raw_title", "SAP CPI Consultant"],
  ["raw_experience", "Implemented SAP Cloud Platform Integration interfaces."],
]);
const cpiLong = document("cpi-long", "Integration Consultant", "Malaysia", [
  ["raw_title", "Integration Consultant"],
  ["raw_experience", "Implemented SAP Cloud Platform Integration interfaces."],
]);
const cpiGeneric = document("cpi-generic", "Integration Consultant", "Malaysia", [
  ["raw_title", "Integration Consultant"],
  ["raw_experience", "Led enterprise integration and generic middleware."],
]);
const cpiAdjacent = document("cpi-adjacent", "SAP PI/PO Consultant", "Malaysia", [
  ["raw_title", "SAP PI/PO Consultant"],
  ["raw_experience", "Implemented SAP PI/PO interfaces."],
]);
const abap = document("abap", "SAP ABAP Consultant", "Malaysia", [
  ["raw_title", "SAP ABAP Consultant"],
  ["raw_experience", "Developed ABAP and Fiori applications."],
]);

const cpiRequest = {
  query: "SAP CPI Consultant Malaysia",
  minimumScore: 0,
  pageSize: 20,
};
assert.deepEqual(
  rankCandidatesV2(
    [cpiGeneric, cpiAdjacent, abap, cpiLong, cpiExact],
    cpiRequest,
  ).map((item) => item.candidateId),
  ["cpi-exact", "cpi-long"],
);

for (const candidate of [cpiGeneric, cpiAdjacent, abap]) {
  const evaluation = evaluateCommittedCandidate(
    candidate,
    buildCommittedSearchRequirements(cpiRequest),
  );
  assert.equal(evaluation.eligible, false);
}

const otcSupported = document("otc-supported", "SAP SD Consultant", "Singapore", [
  ["raw_title", "SAP SD Consultant"],
  [
    "raw_experience",
    "Implemented sales order management, pricing, delivery, billing and credit management.",
  ],
]);
const otcRelated = document("otc-related", "SAP SD Consultant", "Singapore", [
  ["raw_title", "SAP SD Consultant"],
  ["raw_experience", "Configured SAP SD."],
]);
assert.deepEqual(
  rankCandidatesV2([otcRelated, otcSupported], {
    query: "SAP OTC Consultant Singapore",
    minimumScore: 0,
  }).map((item) => item.candidateId),
  ["otc-supported"],
);

const ficoConsultant = document("fico-consultant", "SAP FICO Consultant", "Malaysia", [
  ["raw_title", "SAP FICO Consultant"],
]);
const ficoDeveloper = document("fico-developer", "SAP FICO Developer", "Malaysia", [
  ["raw_title", "SAP FICO Developer"],
]);
assert.deepEqual(
  rankCandidatesV2([ficoDeveloper, ficoConsultant], {
    query: "SAP FICO Consultant Malaysia",
    minimumScore: 0,
  }).map((item) => item.candidateId),
  ["fico-consultant"],
);
assert.equal(
  buildCommittedSearchRequirements({ query: "SAP FICO Malaysia" }).requirements.some(
    (item) => item.kind === "professional_role",
  ),
  false,
);

const stolen = document("candidate-b", "Integration Consultant", "Malaysia", [
  ["raw_experience", "Implemented SAP CPI integrations.", "candidate-a"],
]);
assert.equal(
  evaluateCommittedCandidate(
    stolen,
    buildCommittedSearchRequirements(cpiRequest),
  ).eligible,
  false,
);

const malaysia = document("malaysia", "SAP CPI Consultant", "Malaysia", [
  ["raw_title", "SAP CPI Consultant"],
]);
const singapore = document("singapore", "SAP CPI Consultant", "Singapore", [
  ["raw_title", "SAP CPI Consultant"],
]);
const philippines = document("philippines", "SAP CPI Consultant", "Philippines", [
  ["raw_title", "SAP CPI Consultant"],
]);
const multiLocation = rankCandidatesV2([philippines, singapore, malaysia], {
  query: "SAP CPI Consultant Malaysia or Singapore",
  minimumScore: 0,
});
assert.deepEqual(
  new Set(multiLocation.map((item) => item.candidateId)),
  new Set(["malaysia", "singapore"]),
);
for (const result of multiLocation) {
  const integrity = (result as typeof result & {
    integrity: { requirements: Array<{ kind: string; reason: string }> };
  }).integrity;
  assert.match(
    integrity.requirements.find((item) => item.kind === "location")!.reason,
    /Meets required location/,
  );
}

const tokyo = document("tokyo", "SAP FICO Consultant", "Japan", [
  ["raw_title", "SAP FICO Consultant"],
]);
tokyo.location = "Tokyo, Japan";
const osaka = { ...tokyo, candidateId: "osaka", location: "Osaka, Japan", trustedCandidateEvidence: { candidateId: "osaka", values: tokyo.trustedCandidateEvidence!.values.map((entry) => ({ ...entry, sourceRecordId: "osaka" })) } };
assert.deepEqual(
  rankCandidatesV2([osaka, tokyo], {
    query: "SAP FICO Consultant Tokyo, Japan",
    minimumScore: 0,
  }).map((item) => item.candidateId),
  ["tokyo"],
);
assert.equal(
  buildCommittedSearchRequirements({
    query: "SAP FICO Consultant Tokyo, Japan",
  }).requirements.find((item) => item.kind === "location")!.label,
  "Location: Tokyo, Japan · Required",
);

const mandarin = document("mandarin", "SAP FICO Consultant", "Malaysia", [
  ["raw_title", "SAP FICO Consultant"],
  ["raw_professional_text", "Mandarin and English", undefined, "candidate_profile.language_section"],
]);
const rawMandarinMention = document("raw-mandarin", "SAP FICO Consultant", "Malaysia", [["raw_title", "SAP FICO Consultant"],["raw_professional_text", "A Mandarin keyword appears in unstructured resume text."]]);
const noMandarin = document("no-mandarin", "SAP FICO Consultant", "Malaysia", [
  ["raw_title", "SAP FICO Consultant"],
  ["raw_professional_text", "Languages: English."],
]);
const languageRequest = {
  query: "SAP FICO Consultant Malaysia",
  filters: { languages: ["Mandarin"] },
  minimumScore: 0,
};
const languageResponse = searchCandidatesV2(
  [mandarin, noMandarin, rawMandarinMention],
  languageRequest,
);
assert.deepEqual(
  languageResponse.results.map((item) => item.candidateId),
  ["mandarin"],
);
assert.equal(languageResponse.summary.totalMatched, 1);
assert.equal(evaluateCommittedCandidate(rawMandarinMention,buildCommittedSearchRequirements(languageRequest)).eligible,false,"A raw unstructured language mention must not satisfy a Required Language");

const baseProfile = buildSearchExecutionProfile(languageRequest, {
  datasetRevision: "fixture",
  authorizationScopeHash: "tenant",
});
const otherLanguage = buildSearchExecutionProfile(
  { ...languageRequest, filters: { languages: ["Japanese"] } },
  { datasetRevision: "fixture", authorizationScopeHash: "tenant" },
);
const broadened = buildSearchExecutionProfile(
  { ...languageRequest, includeRelocationRemote: true },
  { datasetRevision: "fixture", authorizationScopeHash: "tenant" },
);
assert.notEqual(
  baseProfile.committedRequirements.semanticIdentity,
  otherLanguage.committedRequirements.semanticIdentity,
);
assert.notEqual(
  baseProfile.committedRequirements.semanticIdentity,
  broadened.committedRequirements.semanticIdentity,
);
for (const filters of [
  { candidateNames: ["Alex Tan"] },
  { anyTitles: ["Finance Manager"] },
  { minimumRelevantYearsExperience: 5 },
  { maximumNoticePeriodDays: 30 },
  { maximumExpectedSalary: 15000 },
  { workAuthorization: ["Malaysia citizen"] },
  { workflowStatuses: ["screened"] },
  { qualityStatuses: ["verified"] },
  { education: ["Bachelor"] },
  { certifications: ["SAP certified"] },
  { exclusions: ["Example Consulting"] },
]) {
  const extended = buildSearchExecutionProfile(
    { ...languageRequest, filters: { ...languageRequest.filters, ...filters } },
    { datasetRevision: "fixture", authorizationScopeHash: "tenant" },
  );
  assert.notEqual(
    baseProfile.committedRequirements.semanticIdentity,
    extended.committedRequirements.semanticIdentity,
    `Extended filter must change committed identity: ${JSON.stringify(filters)}`,
  );
}

for (const result of [
  ...multiLocation,
  ...languageResponse.results,
  ...rankCandidatesV2([cpiLong, cpiExact], cpiRequest),
]) {
  const integrity = (result as typeof result & {
    integrity: { eligible: boolean; requirements: Array<{ state: string; provenance: unknown }> };
  }).integrity;
  assert.equal(integrity.eligible, true);
  assert.ok(
    integrity.requirements.every((item) =>
      ["verified", "supported"].includes(item.state),
    ),
  );
  assert.ok(
    integrity.requirements
      .filter((item) => ["verified", "supported"].includes(item.state))
      .every((item) => item.provenance),
  );
}

const client = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(client, /buildCommittedSearchRequirements/);
assert.match(client, /committedRequirements:\s*requestCommittedRequirements/);
assert.match(client, /languages:\s*requestFilters\.effectiveLanguages/);
assert.match(client, /Language:.*Required/);
assert.match(client, /setLanguages\(\(item\.filters\.languages \|\| \[\]\)\.join/);
assert.doesNotMatch(client, /outsidePreferredCountry|preferredCountry/);
assert.match(client, /locationRequirement\.reason/);
console.log("Search V2 committed-requirement integrity tests passed");
