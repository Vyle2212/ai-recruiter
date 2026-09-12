import assert from "node:assert/strict";
import { canonicalSearchConcept, searchConceptRelation } from "../lib/candidateSearchConcepts";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier } from "../lib/recruiterSearchPresentation";

const intent = parseRecruiterSearchIntent("Senior SAP OTC Malaysia");
assert.deepEqual(intent.roleConcepts, ["OTC"]);
assert.ok(intent.skills.includes("OTC / O2C"), "OTC must be visible in Understood query concepts");
assert.equal(canonicalSearchConcept("O2C"), "OTC");
assert.equal(canonicalSearchConcept("Order-to-Cash"), "OTC");
assert.equal(searchConceptRelation("OTC", "SD"), "PARENT");

const base = { profileQualityScore: 90, dataConfidenceScore: 90, seniorityEvidenceLevel: "verified_structured_evidence" as const };
const otc = searchCandidatesV2([
  { ...base, candidateId: "direct-malaysia", candidateName: "Direct OTC", currentTitle: "Senior SAP Order-to-Cash Consultant", country: "Malaysia", location: "Malaysia", locationEvidenceState: "VERIFIED" as const, skills: ["Order to Cash"], sapModules: ["OTC", "SD"], domainEvidence: { OTC: "PRIMARY" as const } },
  { ...base, candidateId: "o2c-malaysia", candidateName: "O2C Specialist", currentTitle: "Senior SAP O2C Consultant", country: "Malaysia", location: "Malaysia", locationEvidenceState: "VERIFIED" as const, skills: ["O2C", "Billing", "Pricing"], sapModules: ["SD", "O2C"] },
  { ...base, candidateId: "sd-malaysia", candidateName: "SD Supporting", currentTitle: "Senior SAP SD Consultant", country: "Malaysia", location: "Malaysia", locationEvidenceState: "VERIFIED" as const, skills: ["SD", "Billing", "Delivery"], sapModules: ["SD"] },
  { ...base, candidateId: "direct-singapore", candidateName: "Regional OTC", currentTitle: "Senior SAP OTC Consultant", country: "Singapore", location: "Singapore", locationEvidenceState: "VERIFIED" as const, skills: ["OTC"], sapModules: ["OTC", "SD"], domainEvidence: { OTC: "PRIMARY" as const } },
  { ...base, candidateId: "unrelated", candidateName: "Unrelated SAP", currentTitle: "Senior SAP ABAP Consultant", country: "Malaysia", location: "Malaysia", locationEvidenceState: "VERIFIED" as const, skills: ["ABAP"], sapModules: ["ABAP"] },
], { query: "Senior SAP OTC Malaysia", minimumScore: 0, pageSize: 100 });

const otcIds = otc.results.map((candidate) => candidate.candidateId);
assert.deepEqual(otcIds.slice(0, 2), ["direct-malaysia", "o2c-malaysia"], "explicit OTC/O2C evidence must lead the supporting SD pool");
assert.ok(otcIds.includes("sd-malaysia"), "the parent SAP SD pool must be retrieved before ranking");
assert.ok(!otcIds.includes("unrelated"), "unrelated SAP modules must not enter OTC retrieval");
const direct = otc.results.find((candidate) => candidate.candidateId === "direct-malaysia")!;
const supporting = otc.results.find((candidate) => candidate.candidateId === "sd-malaysia")!;
assert.equal(direct.primaryRoleFit, "exact");
assert.equal(supporting.specializationEvidenceLevel, "parent_verified", "two isolated SD process terms remain parent-module evidence");
assert.notEqual(supporting.specializationEvidenceLevel, "exact_verified", "supported process evidence is not explicit OTC verification");
assert.ok(direct.score.finalScore > supporting.score.finalScore);
assert.ok(["Strong Match", "Good Match"].includes(recruiterMatchTier(direct, intent)));

const fico = searchCandidatesV2([
  { ...base, candidateId: "fico-direct", currentTitle: "Senior SAP FICO Consultant", country: "Malaysia", location: "Malaysia", locationEvidenceState: "VERIFIED" as const, skills: ["FICO", "Implementation"], sapModules: ["FICO", "FI", "CO"], domainEvidence: { FICO: "PRIMARY" as const }, implementationEvidenceLevel: "verified_structured_evidence" as const, domainImplementationEvidence: { FICO: "VERIFIED" as const } },
  { ...base, candidateId: "fico-incidental", currentTitle: "Senior SAP ABAP Consultant", country: "Malaysia", location: "Malaysia", locationEvidenceState: "VERIFIED" as const, skills: ["ABAP", "FICO", "Implementation"], sapModules: ["ABAP", "FICO"], domainEvidence: { ABAP: "PRIMARY" as const, FICO: "EXPOSURE" as const }, implementationEvidenceLevel: "verified_structured_evidence" as const },
], { query: "Senior SAP FICO Malaysia implementation", minimumScore: 0, pageSize: 100 });
assert.equal(fico.results[0]?.candidateId, "fico-direct", "existing FICO anchor ranking must remain intact");
assert.equal(fico.results[0]?.primaryRoleFit, "exact");

console.log("searchV2SemanticAliases.test.ts passed");
