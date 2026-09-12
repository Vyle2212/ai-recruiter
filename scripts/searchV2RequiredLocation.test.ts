import assert from "node:assert/strict";
import fs from "node:fs";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import {
  candidateMeetsRequiredLocation,
  requiredLocationAlternatives,
  requiredLocationDisplay,
} from "../lib/searchV2RequiredLocation";

const trusted = (id: string) => ({ candidateId: id, values: [
  { value: "SAP CPI Consultant", sourceType: "raw_title" as const, sourceField: "request_candidate.title", sourceRecordId: id, provenance: "candidate_record_raw" as const, trusted: true },
  { value: "Implemented SAP CPI integration flows.", sourceType: "raw_experience" as const, sourceField: "request_candidate.experience", sourceRecordId: id, provenance: "candidate_record_raw" as const, trusted: true },
] });
const candidate = (id: string, country: string | null, location: string | null, state: "VERIFIED" | "UNKNOWN" = "VERIFIED") => ({
  candidateId: id, candidateName: id, currentTitle: "SAP CPI Consultant", currentEmployer: "Fixture",
  country, location, locationEvidenceState: state, totalYearsExperience: 8,
  skills: ["CPI"], sapModules: ["CPI"], industries: [], languages: [],
  searchableText: "SAP CPI Consultant integration", trustedCandidateEvidence: trusted(id),
  domainEvidence: {}, profileQualityScore: 90, seniorityEvidenceLevel: "verified_structured_evidence" as const,
  profileEvidence: { name: true, title: true, employer: true, location: Boolean(location), experienceDuration: true, employmentHistory: true, projectHistory: false, education: false, certifications: false, skills: true },
});

const malaysia = requiredLocationAlternatives("SAP CPI Consultant Malaysia");
assert.equal(requiredLocationDisplay(malaysia), "Malaysia");
assert.equal(candidateMeetsRequiredLocation(candidate("my", "Malaysia", "Kuala Lumpur, Malaysia"), malaysia), true);
for (const [country, location] of [["Singapore", "Singapore"], ["Philippines", "Manila, Philippines"], ["Vietnam", "Ho Chi Minh City, Vietnam"]])
  assert.equal(candidateMeetsRequiredLocation(candidate(`outside-${country}`, country, location), malaysia), false);
assert.equal(candidateMeetsRequiredLocation(candidate("unknown", null, null, "UNKNOWN"), malaysia), false);

const singapore = requiredLocationAlternatives("SAP OTC Consultant Singapore");
assert.equal(candidateMeetsRequiredLocation(candidate("sg", "Singapore", "Singapore"), singapore), true);
assert.equal(candidateMeetsRequiredLocation(candidate("my2", "Malaysia", "Malaysia"), singapore), false);

const tokyo = requiredLocationAlternatives("SAP FICO Consultant Tokyo, Japan");
assert.deepEqual(tokyo, [{ label: "Tokyo, Japan", city: "Tokyo", country: "Japan" }]);
assert.equal(candidateMeetsRequiredLocation(candidate("tokyo", "Japan", "Tokyo, Japan"), tokyo), true);
assert.equal(candidateMeetsRequiredLocation(candidate("japan-only", "Japan", "Japan"), tokyo), false);
assert.equal(candidateMeetsRequiredLocation(candidate("osaka", "Japan", "Osaka, Japan"), tokyo), false);

const countries = requiredLocationAlternatives("SAP CPI Consultant Malaysia or Singapore");
assert.equal(requiredLocationDisplay(countries), "Malaysia or Singapore");
assert.equal(candidateMeetsRequiredLocation(candidate("my3", "Malaysia", "Malaysia"), countries), true);
assert.equal(candidateMeetsRequiredLocation(candidate("sg3", "Singapore", "Singapore"), countries), true);
assert.equal(candidateMeetsRequiredLocation(candidate("vn3", "Vietnam", "Vietnam"), countries), false);

const japanCities = requiredLocationAlternatives("SAP FICO Consultant Tokyo or Osaka, Japan");
assert.equal(requiredLocationDisplay(japanCities), "Tokyo, Japan or Osaka, Japan");
assert.equal(candidateMeetsRequiredLocation(candidate("t", "Japan", "Tokyo, Japan"), japanCities), true);
assert.equal(candidateMeetsRequiredLocation(candidate("o", "Japan", "Osaka, Japan"), japanCities), true);
assert.equal(candidateMeetsRequiredLocation(candidate("kyoto", "Japan", "Kyoto, Japan"), japanCities), false);

assert.deepEqual(requiredLocationAlternatives("SAP consultant with Japanese language"), []);
assert.deepEqual(requiredLocationAlternatives("SAP consultant with Japan statutory experience"), []);
assert.deepEqual(requiredLocationAlternatives("SAP consultant with Malaysia project exposure"), []);
assert.deepEqual(requiredLocationAlternatives("SAP consultant with Singapore implementation"), []);
assert.deepEqual(requiredLocationAlternatives("SAP consultant with Tokyo project exposure"), []);

const population = [
  candidate("eligible-my", "Malaysia", "Kuala Lumpur, Malaysia"),
  candidate("outside-sg", "Singapore", "Singapore"),
  candidate("outside-ph", "Philippines", "Manila, Philippines"),
  candidate("outside-vn", "Vietnam", "Vietnam"),
  candidate("missing", null, null, "UNKNOWN"),
];
const strict = searchCandidatesV2(population, { query: "SAP CPI Consultant Malaysia", minimumScore: 0, page: 1, pageSize: 20 });
assert.deepEqual(strict.results.map((item) => item.candidateId), ["eligible-my"]);
assert.equal(strict.summary.totalMatched, 1);
const broadened = searchCandidatesV2(population, { query: "SAP CPI Consultant Malaysia", includeRelocationRemote: true, minimumScore: 0, page: 1, pageSize: 20 });
assert.ok(broadened.summary.totalMatched > strict.summary.totalMatched);

const pagedPopulation = Array.from({ length: 25 }, (_, index) => candidate(`my-${index}`, "Malaysia", "Malaysia"))
  .concat(Array.from({ length: 10 }, (_, index) => candidate(`sg-${index}`, "Singapore", "Singapore")));
const page1 = searchCandidatesV2(pagedPopulation, { query: "SAP CPI Consultant Malaysia", minimumScore: 0, page: 1, pageSize: 20 });
const page2 = searchCandidatesV2(pagedPopulation, { query: "SAP CPI Consultant Malaysia", minimumScore: 0, page: 2, pageSize: 20 });
assert.equal(page1.summary.totalMatched, 25);
assert.equal(page1.results.length, 20);
assert.equal(page2.results.length, 5);
assert.ok([...page1.results, ...page2.results].every((item) => item.country === "Malaysia"));

const projectOnly = { ...candidate("project-only", null, null, "UNKNOWN"), trustedCandidateEvidence: { candidateId: "project-only", values: [{ value: "Delivered a Malaysia client project.", sourceType: "raw_project" as const, sourceField: "request_candidate.projects", sourceRecordId: "project-only", provenance: "candidate_record_raw" as const, trusted: true }] } };
assert.equal(candidateMeetsRequiredLocation(projectOnly, malaysia), false);

const client = fs.readFileSync("app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx", "utf8");
const drawer = fs.readFileSync("app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx", "utf8");
assert.match(client, /Location: \$\{requiredLocationDisplay\(effectiveRequiredLocations\)\} · Required/);
assert.match(client, /locations: requestFilters\.effectiveLocations/);
assert.doesNotMatch(client, /Location: \$\{country\} · Preferred/);
assert.match(client, /diagnostic=\{/);
assert.match(drawer, /diagnostic\.requirements/);
console.log("Search V2 deterministic required-location tests passed");
