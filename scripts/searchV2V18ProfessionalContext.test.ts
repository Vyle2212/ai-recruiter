import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/recruiter/search-v2/route";
import { paginateRankedCandidatesV2, rankCandidatesV2, searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { qualifyNicheTargetEvidence } from "../lib/nicheTargetEvidence";
import { SEARCH_V2_VERSION } from "../lib/searchV2Shared";
import { searchV2DatasetRevision, searchV2DiagnosticHeaders } from "../lib/searchV2Server";
import type { CandidateSearchV2Document, TrustedCandidateEvidenceValue } from "../lib/candidateSearchV2Types";

async function main() {
const profileEvidence = { name: true, title: true, employer: true, location: true, experienceDuration: true, employmentHistory: true, projectHistory: true, education: false, certifications: false, skills: true };
function evidence(candidateId: string, title: string, text: string, skills: string[] = []): CandidateSearchV2Document["trustedCandidateEvidence"] {
  const values: TrustedCandidateEvidenceValue[] = [
    ...(title ? [{ value: title, sourceType: "raw_title" as const, sourceField: "request_candidate.title", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
    ...(text ? [{ value: text, sourceType: "raw_professional_text" as const, sourceField: "request_candidate.raw_text", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
    ...skills.map((value) => ({ value, sourceType: "direct_skill" as const, sourceField: "request_candidate.skills", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true })),
  ];
  return { candidateId, values };
}
function doc(id: string, title: string, text: string, location = "Singapore", skills: string[] = []): CandidateSearchV2Document {
  return { candidateId: id, candidateName: id, currentTitle: title, currentEmployer: "Fixture", country: location || null, location: location || null,
    totalYearsExperience: 10, skills, sapModules: skills, industries: [], languages: [], searchableText: `${title} ${text}`,
    trustedCandidateEvidence: evidence(id, title, text, skills), domainEvidence: {}, profileQualityScore: 80, dataConfidenceScore: 80,
    locationEvidenceState: location ? "VERIFIED" : "UNKNOWN", seniorityEvidenceLevel: "verified_structured_evidence", profileEvidence };
}
const tier = (target: string, candidate: CandidateSearchV2Document) => qualifyNicheTargetEvidence(target, candidate);

assert.notEqual(tier("OTC", doc("otc-list", "SAP ABAP Consultant", "Technology stack: ABAP, OTC, HANA.")).tier, "exact_verified");
assert.notEqual(tier("OTC", doc("otc-paragraph", "SAP ABAP Consultant", "Modules: OTC.\nImplemented ABAP reports for HR.")).tier, "exact_verified");
const otcTitle = tier("OTC", doc("otc-title", "SAP OTC Consultant", ""));
assert.equal(otcTitle.tier, "exact_verified");
assert.equal(otcTitle.professionalContextType, "title");
const otcResponsibility = tier("OTC", doc("otc-responsibility", "SAP SD Consultant", "Responsible for Order-to-Cash implementation and process ownership."));
assert.equal(otcResponsibility.tier, "exact_verified");
assert.equal(otcResponsibility.professionalContextType, "sentence");
const otcSkill = tier("OTC", doc("otc-skill", "SAP Consultant", "", "Singapore", ["OTC"]));
assert.equal(otcSkill.tier, "exact_supported");
assert.equal(otcSkill.professionalContextType, "direct_skill");
assert.equal(tier("OTC", doc("otc-sd", "SAP SD Consultant", "Configured SAP SD.")).tier, "related");
assert.equal(tier("OTC", doc("otc-cluster", "SAP SD Consultant", "Implemented sales order management, pricing, delivery and billing.")).tier, "exact_supported");

assert.notEqual(tier("CPI", doc("cpi-generic", "Integration Lead", "Developed integration flows, APIs and middleware.")).tier, "exact_verified");
assert.equal(tier("CPI", doc("cpi-branded", "SAP Integration Consultant", "Implemented SAP CPI integrations.")).tier, "exact_verified");
assert.equal(tier("CPI", doc("cpi-platform", "SAP Integration Consultant", "Delivered SAP Cloud Platform Integration implementation.")).tier, "exact_verified");
assert.equal(tier("MBC", doc("mbc-related", "SAP Treasury Consultant", "Delivered SAP TRM and Treasury transformation.", "Malaysia")).tier, "related");
assert.equal(tier("DATASPHERE", doc("ds-related", "SAP BW Consultant", "Delivered SAP BW and SAC reporting.", "Malaysia")).tier, "related");

const stolen = doc("candidate-b", "SAP ABAP Consultant", "ABAP delivery.");
stolen.trustedCandidateEvidence = evidence("candidate-a", "SAP OTC Consultant", "Responsible for Order-to-Cash.");
assert.notEqual(tier("OTC", stolen).tier, "exact_verified");

const paginationCounts = [13, 15, 20, 21, 25, 31, 75, 97, 120];
for (const count of paginationCounts) {
  const documents = Array.from({ length: count }, (_, index) => doc(`page-${count}-${index}`, `SAP OTC Consultant ${index}`, "", index % 2 ? "Singapore" : "Malaysia"));
  const ranked = rankCandidatesV2(documents, { query: "SAP OTC Consultant Singapore", minimumScore: 0, pageSize: 20 });
  const expectedEligible = Math.floor(count / 2);
  assert.equal(ranked.length, expectedEligible);
  const allIds: string[] = [];
  for (let page = 1; page <= Math.ceil(expectedEligible / 20); page += 1) allIds.push(...paginateRankedCandidatesV2(ranked, ranked.length, { query: "SAP OTC Consultant Singapore", minimumScore: 0, pageSize: 20, page }).results.map((item) => item.candidateId));
  assert.equal(allIds.length, expectedEligible);
  assert.equal(new Set(allIds).size, expectedEligible);
  assert.ok(allIds.every((id) => Number(id.split("-").at(-1)) % 2 === 1));
}

const fixture = [
  doc("api-exact", "SAP OTC Consultant", "", "Singapore"),
  doc("api-supported", "SAP SD Consultant", "Implemented sales order management, pricing, delivery and billing.", "Singapore"),
  doc("api-related", "SAP SD Consultant", "Configured SAP SD.", "Singapore"),
  doc("api-noise", "SAP HR Consultant", "Configured SAP HCM.", "Singapore"),
];
const requestBody = { query: "SAP OTC Consultant Singapore", minimumScore: 0, page: 1, pageSize: 20 };
const auditPayload = searchCandidatesV2(fixture, requestBody);
const apiRankedPopulation = rankCandidatesV2(fixture, requestBody);
const apiPayload = paginateRankedCandidatesV2(apiRankedPopulation, fixture.length, requestBody);
assert.equal(apiPayload.summary.totalMatched, auditPayload.summary.totalMatched);
assert.deepEqual(apiPayload.results.map((item) => item.candidateId), auditPayload.results.map((item) => item.candidateId));
const phases = { parse: 1, retrieval: 2, evidence: 3, projection: 4, qualification: 5, sort: 6, presentation: 7, cacheRead: 8, cacheWrite: 9, total: 45 };
const headers = searchV2DiagnosticHeaders("fixture-revision", "miss", phases);
assert.equal(headers["X-Search-Version"], SEARCH_V2_VERSION);
assert.equal(headers["X-Search-Dataset-Revision"], "fixture-revision");
assert.equal(headers["X-Search-Cache"], "miss");
for (const phase of Object.keys(phases)) assert.match(headers["Server-Timing"], new RegExp(`(?:^|, )${phase};dur=\\d`));
assert.doesNotMatch(headers["Server-Timing"], /resume|profile|candidateId|authorization/i);
const revisionRows = fixture.map((item) => ({ candidate_id: item.candidateId, source_updated_at: item.updatedAt || "" }));
assert.equal(searchV2DatasetRevision(revisionRows, new Map()), searchV2DatasetRevision([...revisionRows], new Map()));

console.log("Search V2 v18 professional-context/API consistency tests passed");
}
main().catch((error) => { console.error(error); process.exit(1); });
