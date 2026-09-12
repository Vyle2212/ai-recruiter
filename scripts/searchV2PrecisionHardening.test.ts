import assert from "node:assert/strict";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { hasStableNicheEligibility, qualifyNicheTargetEvidence } from "../lib/nicheTargetEvidence";
import { parseRecruiterSearchIntent, recruiterMatchTier, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";
const trusted = (candidateId: string, title: string, text: string, skills: string[] = []) => ({ candidateId, values: [
  ...(title ? [{ value: title, sourceType: "raw_title" as const, sourceField: "request_candidate.title", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
  ...(text ? [{ value: text, sourceType: "raw_professional_text" as const, sourceField: "request_candidate.raw_text", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
  ...skills.map((value) => ({ value, sourceType: "direct_skill" as const, sourceField: "request_candidate.skills", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true })),
] });

const profileEvidence = { name: true, title: true, employer: true, location: true, experienceDuration: true, employmentHistory: true, projectHistory: true, education: false, certifications: false, skills: true };
const doc = (id: string, title: string, modules: string[], text: string, location: string | null) => ({
  candidateId: id, candidateName: `Fixture ${id}`, currentTitle: title, currentEmployer: "Fixture", location, country: location,
  totalYearsExperience: 10, skills: modules, sapModules: modules, industries: [], languages: [], searchableText: `${title} ${modules.join(" ")} ${text}`,
  trustedCandidateEvidence: trusted(id, title, text), domainEvidence: {},
  profileQualityScore: 80, dataConfidenceScore: 80, locationEvidenceState: location ? "VERIFIED" as const : "UNKNOWN" as const,
  seniorityEvidenceLevel: "verified_structured_evidence" as const, profileEvidence,
});
const run = (query: string, docs: ReturnType<typeof doc>[], pageSize = 100, page = 1) => searchCandidatesV2(docs, { query, page, pageSize, minimumScore: 0 });
const assertRelatedBeforeNone = (query: string, related: ReturnType<typeof doc>, none: ReturnType<typeof doc>) => {
  const retrievedRelated = { ...related, searchableText: `${related.searchableText} ${query}` };
  const retrievedNone = { ...none, searchableText: `${none.searchableText} ${query}` };
  const results = run(query, [retrievedNone, retrievedRelated]).results;
  assert.deepEqual(results, [], "related and none both fail an explicit target requirement");
};

assertRelatedBeforeNone("SAP MBC Consultant Malaysia",
  doc("mbc-fico-related", "SAP FICO Consultant", ["FICO"], "Financial accounting transformation.", "Malaysia"),
  doc("mbc-none-my", "SAP HR Manager", ["SAP"], "Managed HR operations.", "Malaysia"));
assertRelatedBeforeNone("SAP MBC Consultant Malaysia",
  doc("mbc-trm-related", "SAP Treasury Consultant", ["TRM"], "Treasury transformation.", "Malaysia"),
  doc("mbc-none-confidence", "SAP HR Director", ["SAP"], "Managed HR operations.", "Malaysia"));
assertRelatedBeforeNone("SAP Datasphere Consultant Malaysia",
  doc("ds-bw-related", "SAP BW Consultant", ["BW"], "BW reporting models.", "Malaysia"),
  doc("ds-none-my", "SAP HR Architect", ["SAP"], "Led HR architecture.", "Malaysia"));
assertRelatedBeforeNone("SAP CPI Consultant Malaysia",
  doc("cpi-btp-related", "SAP BTP Integration Consultant", ["BTP"], "SAP BTP integration delivery.", "Malaysia"),
  doc("cpi-none-my", "SAP HR Programme Manager", ["SAP"], "Led HR governance.", "Malaysia"));
assertRelatedBeforeNone("SAP OTC Consultant Malaysia",
  doc("otc-sd-related", "SAP SD Consultant", ["SD"], "SAP SD configuration.", "Malaysia"),
  doc("otc-none-my", "SAP HR Analyst", ["SAP"], "Led HR reporting.", "Malaysia"));

const cpiRelatedUnknown = doc(
  "cpi-related-unknown",
  "SAP BTP Integration Consultant",
  ["BTP"],
  "SAP BTP integration delivery.",
  "Malaysia",
);
const cpiEligibleNoneMalaysia = doc(
  "cpi-none-eligible-malaysia",
  "SAP BTP Consultant",
  ["BTP"],
  "Extension development.",
  "Malaysia",
);
assert.equal(hasStableNicheEligibility("CPI", cpiEligibleNoneMalaysia), true);
assert.equal(
  qualifyNicheTargetEvidence("CPI", cpiEligibleNoneMalaysia).tier,
  "none",
);
const tierFirst = run(
  "SAP CPI Consultant Malaysia",
  [cpiEligibleNoneMalaysia, cpiRelatedUnknown],
).results;
assert.deepEqual(
  tierFirst.map((item) => item.targetEvidence.tier),
  [],
  "related and none cannot enter an explicit target result set",
);

const sameTier = run("SAP CPI Consultant Malaysia", [
  doc("related-unknown-strong-role", "SAP BTP Integration Lead", ["BTP"], "BTP delivery.", "Malaysia"),
  doc("related-malaysia-weaker-role", "SAP BTP Integration Analyst", ["BTP"], "SAP BTP integration analysis.", "Malaysia"),
]).results;
assert.deepEqual(sameTier, []);

const pageFixture = [
  ...Array.from({ length: 21 }, (_, index) => ({ ...doc(`related-${String(index).padStart(2, "0")}`, "SAP FICO Consultant", ["FICO"], "Finance transformation.", "Malaysia"), searchableText: "SAP FICO MBC retrieval" })),
  doc("none-last", "SAP HR Manager", ["SAP"], "Managed HR operations.", "Malaysia"),
];
const full = run("SAP MBC Consultant Malaysia", pageFixture).results;
assert.equal(full.length, 0);
assert.equal(full.some((item) => item.candidateId === "none-last"), false);
const page1 = run("SAP MBC Consultant Malaysia", pageFixture, 20, 1);
const page2 = run("SAP MBC Consultant Malaysia", pageFixture, 20, 2);
assert.equal(page1.results.length, 0);
assert.equal(page2.results.length, 0);
assert.deepEqual([...page1.results, ...page2.results].map((item) => item.candidateId), full.map((item) => item.candidateId));

const tierBoundaryFixture = [
  ...Array.from({ length: 21 }, (_, index) => ({
    ...cpiRelatedUnknown,
    candidateId: `cpi-related-page-${String(index).padStart(2, "0")}`,
    candidateName: `Related Fixture ${index}`,
    trustedCandidateEvidence: trusted(
      `cpi-related-page-${String(index).padStart(2, "0")}`,
      "SAP BTP Integration Consultant",
      "SAP BTP integration delivery.",
    ),
  })),
  cpiEligibleNoneMalaysia,
];
const tierBoundaryPage1 = run(
  "SAP CPI Consultant Malaysia",
  tierBoundaryFixture,
  20,
  1,
);
const tierBoundaryPage2 = run(
  "SAP CPI Consultant Malaysia",
  tierBoundaryFixture,
  20,
  2,
);
assert.equal(tierBoundaryPage1.results.length, 0);
assert.equal(tierBoundaryPage2.results.length, 0);

const eligibleExact = doc("eligible-exact", "SAP CPI Consultant", ["CPI"], "Implemented SAP CPI.", "Singapore");
const eligibleSupported = doc("eligible-supported", "SAP BTP Consultant", ["BTP"], "Delivered Cloud Integration message mapping, integration packages and integration adapters.", "Singapore");
const eligibleRelated = doc("eligible-related", "SAP BTP Integration Consultant", ["BTP"], "SAP BTP integration extension delivery.", "Singapore");
const downgradedRelated = { ...eligibleRelated, domainEvidence: { CPI: "SUPPORTED" as const }, searchableText: `${eligibleRelated.searchableText} CPI expanded retrieval` };
const genericLocationOnly = doc("ineligible-location", "SAP Consultant", ["SAP"], "General SAP consulting.", "Singapore");
const precomputedOnly = { ...genericLocationOnly, candidateId: "ineligible-precomputed", domainEvidence: { CPI: "SUPPORTED" as const }, searchableText: "CPI expanded retrieval" };
assert.equal(hasStableNicheEligibility("CPI", eligibleExact), true);
assert.equal(hasStableNicheEligibility("CPI", eligibleSupported), true);
assert.equal(hasStableNicheEligibility("CPI", eligibleRelated), true);
assert.equal(qualifyNicheTargetEvidence("CPI", downgradedRelated).tier, "related");
assert.equal(hasStableNicheEligibility("CPI", downgradedRelated), true, "downgrade to related does not change stable eligibility");
assert.equal(hasStableNicheEligibility("CPI", genericLocationOnly), false);
assert.equal(hasStableNicheEligibility("CPI", precomputedOnly), false, "precomputed support and retrieval text cannot establish eligibility");
const eligibilityPopulation = run("SAP CPI Consultant Singapore", [eligibleExact, eligibleSupported, { ...eligibleRelated, searchableText: `${eligibleRelated.searchableText} CPI retrieval` }, precomputedOnly, genericLocationOnly]).results;
assert.deepEqual(new Set(eligibilityPopulation.map((item) => item.candidateId)), new Set(["eligible-exact", "eligible-supported"]));
const cpiRaw = doc("prov-cpi", "SAP Technical Consultant", ["BTP"], "Developed SAP CPI iFlows for integrations.", "Singapore");
const cpiEvidence = qualifyNicheTargetEvidence("CPI", cpiRaw);
assert.equal(cpiEvidence.tier, "exact_verified");
assert.equal(cpiEvidence.trusted, true);
assert.equal(cpiEvidence.evidenceSourceType, "raw_professional_text");
assert.ok(cpiEvidence.matchedLiteral);
assert.equal(cpiEvidence.sourceField, "request_candidate.raw_text");
assert.equal(cpiEvidence.sourceValueProvenance, "candidate_record_raw");
assert.equal(cpiEvidence.sourceRecordId, "prov-cpi");
assert.equal(cpiEvidence.reasonCode, "trusted_literal");
const datasphereSkill = { ...doc("prov-ds", "SAP Technical Consultant", ["SAC"], "Analytics delivery.", "Malaysia"), trustedCandidateEvidence: trusted("prov-ds", "SAP Technical Consultant", "Analytics delivery.", ["SAP Datasphere"]) };
const dsEvidence = qualifyNicheTargetEvidence("DATASPHERE", datasphereSkill);
assert.equal(dsEvidence.tier, "exact_verified");
assert.equal(dsEvidence.evidenceSourceType, "direct_skill");
assert.equal(dsEvidence.matchedLiteral, "sap datasphere");
assert.equal(dsEvidence.trusted, true);
for (const candidate of [
  doc("no-cpi-integration", "SAP Integration Lead", ["SAP"], "Integration architecture and APIs.", "Singapore"),
  doc("no-cpi-abap", "SAP ABAP Consultant", ["ABAP"], "ABAP development.", "Singapore"),
  doc("no-cpi-hcm", "SAP HCM Consultant", ["HCM"], "HCM configuration.", "Singapore"),
  doc("no-cpi-fiori", "SAP Fiori Consultant", ["Fiori"], "Fiori applications and OData.", "Singapore"),
  doc("no-cpi-basis", "SAP Basis Consultant", ["Basis"], "Basis administration and interfaces.", "Singapore"),
  doc("no-cpi-cloud-generic", "Cloud Integration Lead", ["Integration"], "Led cloud integration across non-SAP platforms.", "Singapore"),
  doc("no-cpi-data", "SAP Data Architect", ["SAP"], "Data architecture.", "Singapore"),
]) assert.notEqual(qualifyNicheTargetEvidence("CPI", candidate).tier, "exact_verified");
const sacPlanning = doc("sac-planning", "SAP SAC Planning Consultant", ["SAC", "BW"], "SAC planning delivery.", "Malaysia");
assert.equal(qualifyNicheTargetEvidence("DATASPHERE", sacPlanning).tier, "related");
const enrichedOnly = { ...doc("enriched-ds", "SAP Consultant", ["SAP"], "General SAP consulting.", "Malaysia"), searchableText: "SAP Datasphere DWC expanded retrieval", domainEvidence: { DATASPHERE: "SUPPORTED" as const } };
assert.notEqual(qualifyNicheTargetEvidence("DATASPHERE", enrichedOnly).tier, "exact_verified");
const queryOnlyCpi = {
  ...doc("query-only-cpi", "SAP Consultant", ["SAP"], "General SAP consulting.", "Malaysia"),
  searchableText: "SAP CPI Cloud Integration query expansion cache presentation",
};
assert.notEqual(
  qualifyNicheTargetEvidence("CPI", queryOnlyCpi).tier,
  "exact_verified",
);
const dsCluster = doc("ds-cluster", "SAP Data Consultant", ["SAP"], "Developed Data Warehouse Cloud spaces, data builder and replication flows.", "Malaysia");
assert.equal(qualifyNicheTargetEvidence("DATASPHERE", dsCluster).tier, "exact_supported");
assert.equal(qualifyNicheTargetEvidence("DATASPHERE", dsCluster).evidenceSourceType, "professional_cluster");
assert.equal(qualifyNicheTargetEvidence("DATASPHERE", dsCluster).matchedLiteral, null);

for (const result of run("SAP MBC Consultant Malaysia", [doc("tier-none", "Bank Integration Manager", ["SAP"], "Managed payments.", "Malaysia")]).results) {
  assert.ok(["Potential Match", "Broad Match"].includes(recruiterMatchTier(result, parseRecruiterSearchIntent("SAP MBC Consultant Malaysia"))));
}
console.log("Search V2 precision hardening tests passed");
