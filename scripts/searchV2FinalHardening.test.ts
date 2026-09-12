import assert from "node:assert/strict";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier } from "../lib/recruiterSearchPresentation";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

const request = {
  query: "Senior SAP FICO Malaysia implementation",
  filters: { skills: ["SAP FICO", "Implementation"], sapModules: ["FICO"], countries: ["Malaysia"] },
  pageSize: 20,
};
const candidates = [
  {
    candidateId: "exact-verified", canonicalCandidateId: "exact-verified", candidateName: "Exact Verified",
    currentTitle: "Senior SAP FICO Consultant", location: "Malaysia", country: "Malaysia", totalYearsExperience: 12,
    skills: ["FICO", "GL", "AP", "AR", "Implementation", "MM", "PP", "SD", "ABAP", "Java"], sapModules: ["FICO", "FI", "CO", "MM", "PP", "SD", "ABAP"],
    domainEvidence: { FICO: "PRIMARY" as const }, domainImplementationEvidence: { FICO: "VERIFIED" as const }, implementationEvidenceLevel: "verified_structured_evidence" as const,
    seniorityEvidenceLevel: "verified_structured_evidence" as const, locationEvidenceState: "VERIFIED" as const,
    profileQualityScore: 90, dataConfidenceScore: 90,
  },
  {
    candidateId: "exact-supported", canonicalCandidateId: "exact-supported", candidateName: "Exact Supported",
    currentTitle: "Senior SAP FICO Consultant", location: "Malaysia", country: "Malaysia", totalYearsExperience: 11,
    skills: ["FICO", "Implementation"], sapModules: ["FICO", "FI", "CO"],
    domainEvidence: { FICO: "PRIMARY" as const }, implementationEvidenceLevel: "source_text_evidence" as const,
    seniorityEvidenceLevel: "verified_structured_evidence" as const, locationEvidenceState: "VERIFIED" as const,
    profileQualityScore: 90, dataConfidenceScore: 90,
  },
  {
    candidateId: "adjacent-volume", canonicalCandidateId: "adjacent-volume", candidateName: "Adjacent Volume",
    currentTitle: "SAP Project Manager", location: "Malaysia", country: "Malaysia", totalYearsExperience: 15,
    skills: ["GL", "AP", "AR", "AA", "CO", "TRM", "MM", "PP", "SD", "BW", "ABAP", "BASIS"], sapModules: ["FICO", "MM", "PP", "SD", "BW", "ABAP"],
    domainEvidence: { FICO: "EXPOSURE" as const }, implementationEvidenceLevel: "unverified" as const,
    seniorityEvidenceLevel: "verified_structured_evidence" as const, locationEvidenceState: "VERIFIED" as const,
    profileQualityScore: 95, dataConfidenceScore: 95,
  },
  {
    candidateId: "junior", canonicalCandidateId: "junior", candidateName: "Junior Profile",
    currentTitle: "SAP Junior FICO Consultant", location: "Malaysia", country: "Malaysia", totalYearsExperience: 2,
    skills: ["FICO", "Implementation"], sapModules: ["FICO"],
    domainEvidence: { FICO: "STRONG" as const }, implementationEvidenceLevel: "verified_structured_evidence" as const,
    seniorityEvidenceLevel: "inferred_evidence" as const, locationEvidenceState: "VERIFIED" as const,
    profileQualityScore: 90, dataConfidenceScore: 90,
  },
];

const first = searchCandidatesV2(candidates, request);
const repeated = searchCandidatesV2([...candidates].reverse(), request);
assert.deepEqual(first.results.map((item) => item.candidateId), repeated.results.map((item) => item.candidateId));
assert.equal(first.summary.totalMatched, repeated.summary.totalMatched);
assert.equal(first.results[0].candidateId, "exact-verified");
assert.equal(first.results.some((item) => item.candidateId === "adjacent-volume"), false, "generic project-management profiles with exposure-only evidence remain below eligibility");
assert.equal(first.results.find((item) => item.candidateId === "junior")?.score.seniorityMatch, "mismatch");
assert.ok((first.results.find((item) => item.candidateId === "junior")?.score.finalScore || 100) < 70);
const exact = first.results.find((item) => item.candidateId === "exact-verified")!;
assert.deepEqual(exact.queryRelevantSkills.slice(0, 6), ["FICO", "FI", "CO", "GL", "AP", "AR"]);
assert.equal(exact.queryRelevantSkills.includes("MM"), false);
assert.ok(exact.score.implementationStrength > first.results.find((item) => item.candidateId === "exact-supported")!.score.implementationStrength);
assert.notEqual(exact.score.confidenceScore, exact.score.finalScore);
assert.equal(exact.primaryRoleFit, "exact");
assert.equal(exact.implementationFit, "verified_domain_implementation");
assert.equal(recruiterMatchTier(exact, parseRecruiterSearchIntent(request.query)), "Strong Match");

const semanticCaps = searchCandidatesV2([
  {
    candidateId: "seniority-unclear", currentTitle: "SAP FICO Consultant", location: "Malaysia", country: "Malaysia",
    skills: ["FICO", "Implementation"], sapModules: ["FICO"], domainEvidence: { FICO: "PRIMARY" as const },
    implementationEvidenceLevel: "verified_structured_evidence" as const, seniorityEvidenceLevel: "unverified" as const,
    locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
  {
    candidateId: "abap-conflict", currentTitle: "Senior SAP ABAP Consultant", location: "Malaysia", country: "Malaysia",
    skills: ["FICO", "Implementation"], sapModules: ["FICO", "ABAP"], domainEvidence: { FICO: "EXPOSURE" as const, ABAP: "PRIMARY" as const },
    implementationEvidenceLevel: "verified_structured_evidence" as const, seniorityEvidenceLevel: "verified_structured_evidence" as const,
    locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
  {
    candidateId: "mm-conflict", currentTitle: "SAP MM Consultant", location: "Malaysia", country: "Malaysia",
    skills: ["FICO", "FI", "Implementation"], sapModules: ["FICO", "MM"], domainEvidence: { FICO: "EXPOSURE" as const, MM: "PRIMARY" as const },
    implementationEvidenceLevel: "verified_structured_evidence" as const, seniorityEvidenceLevel: "inferred_evidence" as const,
    locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
  {
    candidateId: "location-missing", currentTitle: "Senior SAP FICO Consultant",
    skills: ["FICO", "Implementation"], sapModules: ["FICO"], domainEvidence: { FICO: "PRIMARY" as const },
    implementationEvidenceLevel: "verified_structured_evidence" as const, seniorityEvidenceLevel: "verified_structured_evidence" as const,
    locationEvidenceState: "UNKNOWN" as const, profileQualityScore: 90,
  },
  {
    candidateId: "implementation-missing", currentTitle: "Senior SAP FICO Consultant", location: "Malaysia", country: "Malaysia",
    skills: ["FICO"], sapModules: ["FICO"], domainEvidence: { FICO: "PRIMARY" as const },
    implementationEvidenceLevel: "unverified" as const, seniorityEvidenceLevel: "verified_structured_evidence" as const,
    locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
  {
    candidateId: "project-manager", currentTitle: "SAP Project Manager", location: "Malaysia", country: "Malaysia",
    skills: ["Finance", "Implementation"], sapModules: ["FICO"], domainEvidence: { FICO: "EXPOSURE" as const },
    implementationEvidenceLevel: "verified_structured_evidence" as const, seniorityEvidenceLevel: "verified_structured_evidence" as const,
    locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
], request);
const intent = parseRecruiterSearchIntent(request.query);
const tier = (id: string) => recruiterMatchTier(semanticCaps.results.find((item) => item.candidateId === id)!, intent);
assert.notEqual(tier("seniority-unclear"), "Strong Match");
assert.equal(tier("location-missing"), "Good Match", "exact specialization with location uncertainty remains actionable but cannot be Strong");
for (const id of ["abap-conflict", "mm-conflict", "project-manager"]) {
  assert.equal(semanticCaps.results.some((item) => item.candidateId === id), false, `${id} has only incidental/conflicting anchor evidence`);
}
assert.notEqual(tier("implementation-missing"), "Strong Match");

const contextualImplementation = searchCandidatesV2([
  { ...candidates[0], candidateId: "fico-linked", canonicalCandidateId: "fico-linked", domainImplementationEvidence: { FICO: "VERIFIED" as const } },
  { ...candidates[0], candidateId: "mm-linked", canonicalCandidateId: "mm-linked", domainImplementationEvidence: { MM: "VERIFIED" as const } },
], request);
assert.equal(contextualImplementation.results.find((item) => item.candidateId === "fico-linked")?.implementationFit, "verified_domain_implementation");
assert.equal(contextualImplementation.results.find((item) => item.candidateId === "mm-linked")?.implementationFit, "supported_domain_implementation", "MM implementation must not verify FICO implementation");

const generalized = searchCandidatesV2([
  {
    candidateId: "mm-primary", currentTitle: "Senior SAP MM Consultant", location: "Singapore", country: "Singapore",
    skills: ["MM", "Rollout"], sapModules: ["MM"], domainEvidence: { MM: "PRIMARY" as const, FICO: "EXPOSURE" as const },
    seniorityEvidenceLevel: "verified_structured_evidence" as const, locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
  {
    candidateId: "fico-adjacent", currentTitle: "Senior SAP FICO Consultant", location: "Singapore", country: "Singapore",
    skills: ["MM", "Rollout"], sapModules: ["MM", "FICO"], domainEvidence: { MM: "EXPOSURE" as const, FICO: "PRIMARY" as const },
    seniorityEvidenceLevel: "verified_structured_evidence" as const, locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90,
  },
], { query: "Senior SAP MM Singapore rollout", filters: { skills: ["Rollout"], sapModules: ["MM"], countries: ["Singapore"] } });
assert.equal(generalized.results[0].candidateId, "mm-primary", "the role/lifecycle model must generalize beyond FICO");
assert.equal(generalized.results[0].primaryRoleFit, "exact");
assert.equal(generalized.results.some((item) => item.candidateId === "fico-adjacent"), false);

const qualityFloorCandidates: CandidateSearchV2Document[] = [
  { ...candidates[0], candidateId: "direct-malaysia", canonicalCandidateId: "direct-malaysia" },
  {
    ...candidates[0], candidateId: "direct-location-unknown", canonicalCandidateId: "direct-location-unknown",
    location: null, country: null, locationEvidenceState: "UNKNOWN" as const,
  },
  {
    ...candidates[0], candidateId: "scm-fico-exposure", canonicalCandidateId: "scm-fico-exposure",
    currentTitle: "Senior SAP SCM Solution Architect", sapModules: ["FICO", "SCM"],
    domainEvidence: { FICO: "EXPOSURE" as const, SCM: "PRIMARY" as const },
    domainImplementationEvidence: { SCM: "VERIFIED" as const },
  },
  {
    ...candidates[0], candidateId: "fico-no-implementation", canonicalCandidateId: "fico-no-implementation",
    implementationEvidenceLevel: "unverified" as const, domainImplementationEvidence: {},
  },
];
const qualityFloor = searchCandidatesV2(qualityFloorCandidates, { ...request, pageSize: 100 });
assert.equal(qualityFloor.results[0]?.candidateId, "direct-malaysia");
assert.equal(qualityFloor.results.some((item) => item.candidateId === "scm-fico-exposure"), false, "SCM primary plus isolated FICO exposure must not survive the role-quality floor");
assert.equal(qualityFloor.results.find((item) => item.candidateId === "fico-no-implementation")?.implementationFit, "not_verified");
assert.equal(tier("location-missing"), "Good Match");

const globalOrder = qualityFloor.results.map((item) => item.candidateId);
const pagedOne = searchCandidatesV2(qualityFloorCandidates, { ...request, page: 1, pageSize: 2 }).results;
const pagedTwo = searchCandidatesV2(qualityFloorCandidates, { ...request, page: 2, pageSize: 2 }).results;
assert.deepEqual([...pagedOne, ...pagedTwo].map((item) => item.candidateId), globalOrder.slice(0, 4), "pagination must slice one global ranking");
assert.deepEqual(
  searchCandidatesV2([...qualityFloorCandidates].reverse(), { ...request, pageSize: 100 }).results.map((item) => item.candidateId),
  globalOrder,
  "input order must not change deterministic ranking",
);

const balancedPotential = searchCandidatesV2([
  {
    ...candidates[0], candidateId: "target-core-contradicted-capability", canonicalCandidateId: "target-core-contradicted-capability",
    implementationEvidenceLevel: "contradicted_evidence" as const, domainImplementationEvidence: {},
  },
  {
    ...candidates[0], candidateId: "outside-weak-seniority-with-capability", canonicalCandidateId: "outside-weak-seniority-with-capability",
    location: "Singapore", country: "Singapore", locationEvidenceState: "VERIFIED" as const,
    currentTitle: "SAP FICO Consultant", seniorityEvidenceLevel: "unverified" as const,
  },
], { query: request.query, filters: { skills: ["Implementation"], sapModules: ["FICO"] }, pageSize: 100 });
assert.equal(balancedPotential.results[0]?.candidateId, "target-core-contradicted-capability", "strong target geography and seniority must outweigh a non-target candidate's single capability advantage");
assert.ok(balancedPotential.results[0]!.score.highValueConstraintCoverageScore > balancedPotential.results[1]!.score.highValueConstraintCoverageScore);

console.log("searchV2FinalHardening.test.ts passed");
