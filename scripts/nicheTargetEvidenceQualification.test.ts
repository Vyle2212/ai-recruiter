import assert from "node:assert/strict";
import { hasStableNicheEligibility, qualifyNicheTargetEvidence } from "../lib/nicheTargetEvidence";
import { normalizeCandidateSearchV2Request } from "../lib/candidateSearchV2Request";
import { candidateHasSearchV2PrimaryModuleRelevance } from "../lib/candidateSearchV2ModuleRelevance";
import { paginateRankedCandidatesV2, searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { scoreCandidateSearchV2Document } from "../lib/candidateSearchV2Scoring";
import { parseRecruiterSearchIntent, recruiterMatchTier, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";
const trusted = (candidateId: string, title: string, text: string, skills: string[] = []) => ({ candidateId, values: [
  ...(title ? [{ value: title, sourceType: "raw_title" as const, sourceField: "request_candidate.title", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
  ...(text ? [{ value: text, sourceType: "raw_professional_text" as const, sourceField: "request_candidate.raw_text", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
  ...skills.map((value) => ({ value, sourceType: "direct_skill" as const, sourceField: "request_candidate.skills", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true })),
] });

const profileEvidence = { name: true, title: true, employer: true, location: true, experienceDuration: true, employmentHistory: true, projectHistory: true, education: false, certifications: false, skills: true };
const doc = (id: string, title: string, modules: string[], text: string, location = "Singapore", domainEvidence: Record<string, any> = {}) => ({
  candidateId: id, candidateName: `Fixture ${id}`, currentTitle: title, currentEmployer: "Fixture Employer", location, country: location,
  totalYearsExperience: 10, skills: modules, sapModules: modules, industries: [], languages: [], searchableText: text,
  domainEvidence, trustedCandidateEvidence: trusted(id, title, text), profileQualityScore: 80, dataConfidenceScore: 80, locationEvidenceState: "VERIFIED" as const,
  seniorityEvidenceLevel: "verified_structured_evidence" as const, profileEvidence,
});
const score = (query: string, candidate: ReturnType<typeof doc>) => scoreCandidateSearchV2Document(candidate, normalizeCandidateSearchV2Request({ query, minimumScore: 0, pageSize: 100 }));
const tier = (query: string, result: ReturnType<typeof score>) => recruiterMatchTier(result, parseRecruiterSearchIntent(query));
const potential = (value: string) => ["Potential Match", "Broad Match"].includes(value);
const assertNotSupported = (target: string, candidate: ReturnType<typeof doc>) => {
  const qualified = qualifyNicheTargetEvidence(target, candidate);
  assert.ok(["related", "none"].includes(qualified.level), `${candidate.candidateId} unexpectedly qualified ${target}: ${qualified.level}`);
};
const assertScoredNotSupported = (query: string, candidate: ReturnType<typeof doc>) => {
  const result = score(query, candidate);
  assert.notEqual(result.specializationEvidenceLevel, "exact_verified");
  assert.notEqual(result.specializationEvidenceLevel, "exact_supported");
  assert.ok(potential(tier(query, result)), `${candidate.candidateId} unexpectedly became ${tier(query, result)}`);
  return result;
};

const otcQuery = "SAP OTC Consultant Singapore";
for (const candidate of [
  doc("otc-sd", "SAP SD Consultant", ["SD"], "SAP SD configuration."),
  doc("otc-abap", "SAP ABAP Consultant", ["ABAP"], "ABAP development."),
  doc("otc-fico", "SAP FICO Consultant", ["FICO"], "Financial accounting and controlling."),
  doc("otc-sf", "SAP SuccessFactors Consultant", ["SUCCESSFACTORS"], "Employee Central delivery."),
  doc("otc-forged", "SAP Project Manager", ["OTC"], "General SAP programme delivery.", "Singapore", { OTC: "SUPPORTED" }),
  doc("otc-words", "SAP Project Manager", ["SAP"], "Sales reporting. Pricing review. Delivery governance. Billing reporting. Customer support and returns analysis."),
]) assertScoredNotSupported(otcQuery, candidate);
const otcExplicit = score(otcQuery, doc("otc-explicit", "SAP SD Consultant", ["SD"], "Implemented end-to-end Order-to-Cash for SAP SD."));
const otcCluster = score(otcQuery, doc("otc-cluster", "SAP SD Consultant", ["SD"], "Configured sales order management, pricing, delivery, billing and credit management."));
assert.equal(otcExplicit.specializationEvidenceLevel, "exact_verified");
assert.equal(otcCluster.specializationEvidenceLevel, "exact_supported");
assert.ok(["Strong Match", "Good Match"].includes(tier(otcQuery, otcCluster)));
assert.ok(potential(tier(otcQuery, score(otcQuery, doc("otc-conflict", "SAP SD Consultant", ["SD"], "Configured sales order management, pricing, delivery, billing and credit management.", "Malaysia")))));
assert.match(recruiterQueryStatements(score(otcQuery, doc("otc-sd-label", "SAP SD Consultant", ["SD"], "SAP SD configuration.")), parseRecruiterSearchIntent(otcQuery)).supported.join(" "), /Related (?:SAP )?SD experience/i);

const cpiQuery = "SAP CPI Consultant Singapore";
for (const candidate of [
  doc("cpi-btp", "SAP BTP Consultant", ["BTP"], "SAP BTP integration extension development."),
  doc("cpi-abap", "SAP ABAP Consultant", ["ABAP"], "ABAP development."),
  doc("cpi-pipo", "SAP PI/PO Consultant", ["PIPO"], "PI/PO interface development."),
  doc("cpi-generic", "SAP Integration Architect", ["BTP"], "Integration architecture, APIs and middleware."),
  doc("cpi-forged", "SAP HCM Consultant", ["CPI"], "Human capital management.", "Singapore", { CPI: "SUPPORTED" }),
]) assertScoredNotSupported(cpiQuery, candidate);
const cpiExplicit = score(cpiQuery, doc("cpi-explicit", "SAP Integration Consultant", ["BTP"], "Implemented SAP CPI integrations."));
const cpiIflow = score(cpiQuery, doc("cpi-iflow", "SAP Integration Consultant", ["BTP"], "Developed CPI iFlows for production interfaces."));
const cpiCluster = score(cpiQuery, doc("cpi-cluster", "SAP BTP Consultant", ["BTP"], "Delivered Cloud Integration message mapping, integration packages and integration adapters."));
assert.equal(cpiExplicit.specializationEvidenceLevel, "exact_verified");
assert.equal(cpiIflow.specializationEvidenceLevel, "exact_verified");
assert.equal(cpiCluster.specializationEvidenceLevel, "exact_supported");
assert.ok(["Strong Match", "Good Match"].includes(tier(cpiQuery, cpiCluster)));
assert.ok(potential(tier(cpiQuery, score(cpiQuery, doc("cpi-conflict", "SAP BTP Consultant", ["BTP"], "Delivered Cloud Integration message mapping, integration packages and integration adapters.", "Malaysia")))));

const mbcQuery = "SAP MBC Consultant Malaysia";
for (const candidate of [
  doc("mbc-fico", "SAP FICO Consultant", ["FICO"], "Financial accounting and controlling.", "Malaysia"),
  doc("mbc-trm", "SAP Treasury Consultant", ["TRM"], "Treasury and risk management.", "Malaysia"),
  doc("mbc-bcm", "SAP Treasury Consultant", ["BCM"], "Bank Communication Management support.", "Malaysia"),
  doc("mbc-tag", "SAP ABAP Consultant", ["ABAP", "TRM"], "ABAP development.", "Malaysia", { MBC: "SUPPORTED" }),
  doc("mbc-generic", "SAP Technical Consultant", ["FICO"], "Payments, cash management, bank integration and payment formats.", "Malaysia"),
  doc("mbc-forged", "SAP FICO Consultant", ["MBC"], "Financial accounting.", "Malaysia", { MBC: "SUPPORTED" }),
]) assertScoredNotSupported(mbcQuery, candidate);
const mbcExplicit = score(mbcQuery, doc("mbc-explicit", "SAP Treasury Consultant", ["TRM"], "Implemented SAP MBC for regional banks.", "Malaysia"));
const mbcNamed = score(mbcQuery, doc("mbc-named", "SAP Treasury Consultant", ["TRM"], "Delivered Multi-Bank Connectivity implementation.", "Malaysia"));
const mbcCluster = score(mbcQuery, doc("mbc-cluster", "SAP Treasury Consultant", ["TRM"], "Implemented bank connectivity with BCM, SWIFT connectivity and host-to-host connectivity.", "Malaysia"));
assert.equal(mbcExplicit.specializationEvidenceLevel, "exact_verified");
assert.equal(mbcNamed.specializationEvidenceLevel, "exact_verified");
assert.equal(mbcCluster.specializationEvidenceLevel, "exact_supported");
assert.ok(["Strong Match", "Good Match"].includes(tier(mbcQuery, mbcCluster)));
assert.ok(potential(tier(mbcQuery, score(mbcQuery, doc("mbc-conflict", "SAP Treasury Consultant", ["TRM"], "Implemented bank connectivity with BCM, SWIFT connectivity and host-to-host connectivity.", "Singapore")))));

const datasphereQuery = "SAP Datasphere Consultant Malaysia";
const datasphereExactUnknown = score(datasphereQuery, doc("ds-exact", "SAP Datasphere Consultant", ["DATASPHERE"], "Implemented SAP Datasphere models.", ""));
const datasphereSupported = score(datasphereQuery, doc("ds-supported", "SAP BTP Consultant", ["BTP"], "Developed Data Warehouse Cloud spaces, data builder and replication flows.", "Malaysia"));
const sacOnly = assertScoredNotSupported(datasphereQuery, doc("ds-sac", "SAP SAC / BW Consultant", ["SAC", "BW"], "SAC dashboards and BW models.", "Malaysia"));
assert.equal(datasphereExactUnknown.specializationEvidenceLevel, "exact_verified");
assert.ok(["Strong Match", "Good Match"].includes(tier(datasphereQuery, datasphereExactUnknown)));
assert.equal(datasphereSupported.specializationEvidenceLevel, "exact_supported");
assert.ok(["Strong Match", "Good Match"].includes(tier(datasphereQuery, datasphereSupported)));
assert.notEqual(sacOnly.specializationEvidenceLevel, "exact_supported");

const ranks = searchCandidatesV2([
  doc("rank-related", "SAP BTP Consultant", ["BTP"], "SAP BTP integration extension development."),
  doc("rank-supported-conflict", "SAP BTP Consultant", ["BTP"], "Delivered Cloud Integration message mapping, integration packages and integration adapters.", "Malaysia"),
  doc("rank-supported", "SAP BTP Consultant", ["BTP"], "Delivered Cloud Integration message mapping, integration packages and integration adapters."),
  doc("rank-exact-conflict", "SAP CPI Consultant", ["CPI"], "Implemented SAP CPI.", "Malaysia"),
  doc("rank-exact-unknown", "SAP CPI Consultant", ["CPI"], "Implemented SAP CPI.", ""),
  doc("rank-exact", "SAP CPI Consultant", ["CPI"], "Implemented SAP CPI."),
], { query: cpiQuery, minimumScore: 0, pageSize: 100 }).results.map((item) => item.candidateId);
const before = (a: string, b: string) => assert.ok(ranks.indexOf(a) < ranks.indexOf(b), `${a} should rank before ${b}: ${ranks.join(", ")}`);
assert.deepEqual(ranks, ["rank-exact", "rank-supported"]);
assert.ok(!ranks.includes("rank-exact-unknown"));
assert.ok(!ranks.includes("rank-exact-conflict"));
assert.ok(!ranks.includes("rank-supported-conflict"));
before("rank-exact", "rank-supported");
const relatedRank = score(cpiQuery, doc("rank-related-score", "SAP BTP Consultant", ["BTP"], "SAP BTP integration extension development.")).score.specializationEvidenceRank;
const noEvidenceRank = score(cpiQuery, doc("rank-none-score", "SAP Consultant", [], "General SAP consulting.")).score.specializationEvidenceRank;
assert.ok(relatedRank > noEvidenceRank, "related evidence tier must outrank no target evidence independent of role proximity");

const seed = otcExplicit;
for (const total of [14, 15, 19, 20, 21, 24, 31, 81, 85]) {
  const ranked = Array.from({ length: total }, (_, index) => ({ ...seed, candidateId: `page-${total}-${index}` }));
  const page1 = paginateRankedCandidatesV2(ranked, total, { query: otcQuery, page: 1, pageSize: 20, minimumScore: 0 });
  assert.equal(page1.results.length, Math.min(20, total));
  assert.equal(Math.ceil(page1.summary.totalMatched / page1.summary.pageSize), Math.ceil(total / 20));
  const lastPage = Math.ceil(total / 20);
  const final = paginateRankedCandidatesV2(ranked, total, { query: otcQuery, page: lastPage, pageSize: 20, minimumScore: 0 });
  assert.equal(final.results.length, total % 20 || 20);
}

// Cross-source contamination: retrieval and presentation inputs are never trusted qualification sources.
const contaminated = {
  ...doc("contaminated", "SAP Project Manager", ["OTC", "SD"], "Order to Cash OTC O2C expanded retrieval keywords.", "Singapore", { OTC: "SUPPORTED" }),
  trustedCandidateEvidence: trusted("contaminated", "SAP Project Manager", "General SAP programme delivery."),
  queryRelevantSkills: ["OTC", "Order to Cash"],
  evidence: [{ label: "OTC / O2C verified", value: "cached presentation label", source: "cache" }],
};
const contaminatedResult = assertScoredNotSupported(otcQuery, contaminated);
const contaminatedPresentation = recruiterQueryStatements(({
  ...contaminatedResult,
  verifiedSkills: ["OTC"], queryRelevantSkills: ["OTC"], domainEvidence: { OTC: "SUPPORTED" },
} as any), parseRecruiterSearchIntent(otcQuery));
assert.ok(!contaminatedPresentation.supported.some((value) => /OTC \/ O2C (?:verified|supported)/i.test(value)));
assert.ok(contaminatedPresentation.gaps.some((value) => /OTC.*not verified/i.test(value)));

// Qualification cannot change the candidate population that passed retrieval.
const populationRequest = normalizeCandidateSearchV2Request({ query: mbcQuery, minimumScore: 0, pageSize: 2 });
const populationFixture = [
  doc("population-exact", "SAP MBC Consultant", ["MBC"], "Implemented SAP MBC.", "Malaysia"),
  doc("population-related", "SAP Treasury Consultant", ["TRM"], "Treasury transformation.", "Malaysia"),
  { ...doc("population-none", "SAP Consultant", ["SAP"], "MBC retrieval keyword.", "Malaysia"), trustedCandidateEvidence: trusted("population-none", "SAP Consultant", "General SAP consulting.") },
];
const retrievalIds = populationFixture.filter((candidate) => candidateHasSearchV2PrimaryModuleRelevance(candidate, populationRequest)).map((candidate) => candidate.candidateId).sort();
const eligibleIds = populationFixture.filter((candidate) => candidateHasSearchV2PrimaryModuleRelevance(candidate, populationRequest) && hasStableNicheEligibility("MBC", candidate)).map((candidate) => candidate.candidateId).sort();
const populationPage1 = searchCandidatesV2(populationFixture, { query: mbcQuery, minimumScore: 0, page: 1, pageSize: 2 });
const populationPage2 = searchCandidatesV2(populationFixture, { query: mbcQuery, minimumScore: 0, page: 2, pageSize: 2 });
const pagedIds = [...populationPage1.results, ...populationPage2.results].map((candidate) => candidate.candidateId);
assert.deepEqual([...pagedIds].sort(), ["population-exact"], "explicit target requirements exclude related-only candidates");
assert.ok(retrievalIds.includes("population-none") && !eligibleIds.includes("population-none"), "broad retrieval noise is excluded by stable eligibility");
assert.equal(new Set(pagedIds).size, pagedIds.length, "each retrieved candidate appears exactly once across pages");
assert.equal(populationPage1.summary.totalMatched, 1);
// Direct boundary controls prove cached/precomputed signals cannot self-qualify.
assertNotSupported("OTC", doc("direct-otc", "SAP SD Consultant", ["OTC"], "SAP SD configuration.", "Singapore", { OTC: "SUPPORTED" }));
assertNotSupported("CPI", doc("direct-cpi", "SAP ABAP Consultant", ["CPI"], "ABAP development.", "Singapore", { CPI: "SUPPORTED" }));
assertNotSupported("MBC", doc("direct-mbc", "SAP FICO Consultant", ["MBC"], "FICO support.", "Malaysia", { MBC: "SUPPORTED" }));


// v17 identity/provenance isolation: a trusted value must belong to the candidate being scored.
const stolenEvidence = {
  ...doc("candidate-b", "SAP ABAP Consultant", ["ABAP", "SD"], "ABAP delivery.", "Singapore"),
  trustedCandidateEvidence: trusted("candidate-a", "SAP OTC Consultant", "Implemented Order-to-Cash."),
};
const stolenVerdict = qualifyNicheTargetEvidence("OTC", stolenEvidence);
assert.notEqual(stolenVerdict.tier, "exact_verified");
assert.notEqual(stolenVerdict.tier, "exact_supported");
const indexOnlyEvidence = {
  ...doc("index-only", "SAP Consultant", ["SAP"], "General SAP delivery.", "Singapore"),
  trustedCandidateEvidence: { candidateId: "index-only", values: [{ value: "SAP CPI", sourceType: "raw_professional_text" as const, sourceField: "candidate_search_index.search_text", sourceRecordId: "index-only", provenance: "search_index" as const, trusted: true }] },
};
assert.equal(qualifyNicheTargetEvidence("CPI", indexOnlyEvidence).tier, "none");
const auditedExact = qualifyNicheTargetEvidence("CPI", doc("audited-cpi", "SAP Technical Consultant", ["BTP"], "Implemented SAP CPI integrations."));
assert.equal(auditedExact.tier, "exact_verified");
assert.equal(auditedExact.sourceRecordId, "audited-cpi");
assert.equal(auditedExact.sourceValueProvenance, "candidate_record_raw");
assert.ok(auditedExact.sourceField);
assert.ok(auditedExact.matchedLiteral);
assert.equal(auditedExact.reasonCode, "trusted_literal");
console.log("Central niche target evidence qualification tests passed");
