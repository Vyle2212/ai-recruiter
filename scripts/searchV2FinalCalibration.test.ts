import assert from "node:assert/strict";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier } from "../lib/recruiterSearchPresentation";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import type { CandidateSearchV2Request } from "../lib/candidateSearchV2Types";

const base = {
  locationEvidenceState: "VERIFIED" as const,
  profileQualityScore: 90,
  dataConfidenceScore: 90,
};

const ficoRequest = {
  query: "Senior SAP FICO Malaysia implementation",
  filters: { skills: ["SAP FICO", "Implementation"], sapModules: ["FICO"], countries: ["Malaysia"] },
  pageSize: 100,
};

const rank = (candidates: CandidateSearchV2Document[], request: CandidateSearchV2Request = ficoRequest) =>
  searchCandidatesV2(candidates, request).results;
const tierFor = (candidate: ReturnType<typeof rank>[number], query = ficoRequest.query) =>
  recruiterMatchTier(candidate, parseRecruiterSearchIntent(query));

const directUnknown: CandidateSearchV2Document = {
  ...base,
  candidateId: "direct-unknown",
  currentTitle: "Senior SAP FICO Consultant",
  location: "Malaysia",
  country: "Malaysia",
  skills: ["FICO"],
  sapModules: ["FICO"],
  domainEvidence: { FICO: "PRIMARY" },
  implementationEvidenceLevel: "unverified",
  seniorityEvidenceLevel: "verified_structured_evidence",
};

const adjacentVerified: CandidateSearchV2Document = {
  ...base,
  candidateId: "adjacent-verified",
  currentTitle: "SAP Project Manager",
  historicalTitles: ["Finance Transformation Manager"],
  location: "Malaysia",
  country: "Malaysia",
  skills: ["FICO", "Implementation"],
  sapModules: ["FICO"],
  domainEvidence: { FICO: "STRONG" },
  implementationEvidenceLevel: "verified_structured_evidence",
  seniorityEvidenceLevel: "verified_structured_evidence",
};

// A + H: core current-role proximity dominates a verified secondary dimension.
assert.equal(rank([adjacentVerified, directUnknown])[0]?.candidateId, "direct-unknown");

// B: unknown is uncertainty; a contradiction receives the material penalty.
const contradicted = { ...directUnknown, candidateId: "direct-contradicted", implementationEvidenceLevel: "contradicted_evidence" as const };
const unknownVsContradicted = rank([contradicted, directUnknown]);
assert.equal(unknownVsContradicted[0]?.candidateId, "direct-unknown");
assert.equal(unknownVsContradicted[1]?.implementationFit, "mismatch");

// C: an unrelated profession with an isolated normalized token is not eligible.
const isolatedKeyword: CandidateSearchV2Document = {
  ...base,
  candidateId: "isolated-keyword",
  currentTitle: "Communications and Marketing Specialist",
  location: "Malaysia",
  country: "Malaysia",
  skills: ["FICO", "Implementation"],
  sapModules: ["FICO"],
  domainEvidence: { FICO: "EXPOSURE" },
  implementationEvidenceLevel: "source_text_evidence",
};
const isolatedKeywordResult = rank([isolatedKeyword, directUnknown]).find((item) => item.candidateId === "isolated-keyword");
if (isolatedKeywordResult) assert.equal(tierFor(isolatedKeywordResult), "Potential Match");

// D: explicit title evidence is stronger than inferred/supported domain evidence.
const inferredDomain = { ...adjacentVerified, candidateId: "inferred-domain", domainEvidence: { FICO: "SUPPORTED" as const } };
const explicitVsInferred = rank([inferredDomain, directUnknown]);
assert.ok(explicitVsInferred[0]!.score.roleProximityRank > explicitVsInferred[1]!.score.roleProximityRank);

// E: adding self-derived normalized skill aliases cannot amplify role relevance.
const directWithDerivedAliases = { ...directUnknown, candidateId: "direct-derived-aliases", skills: ["FICO", "SAP FICO", "FI", "CO"] };
const circular = rank([directUnknown, directWithDerivedAliases]);
assert.equal(circular[0]!.score.roleRelevanceScore, circular[1]!.score.roleRelevanceScore);
assert.equal(circular[0]!.score.roleProximityRank, circular[1]!.score.roleProximityRank);

// F: verified senior > unknown > confirmed junior mismatch.
const seniorUnknown = { ...directUnknown, candidateId: "senior-unknown", currentTitle: "SAP FICO Consultant", seniorityEvidenceLevel: "unverified" as const };
const juniorMismatch = { ...directUnknown, candidateId: "junior-mismatch", currentTitle: "Junior SAP FICO Consultant", seniorityEvidenceLevel: "verified_structured_evidence" as const };
assert.deepEqual(rank([juniorMismatch, seniorUnknown, directUnknown]).map((item) => item.candidateId), ["direct-unknown", "senior-unknown", "junior-mismatch"]);

// G: verified location > unknown > confirmed conflict.
const locationUnknown = { ...directUnknown, candidateId: "location-unknown", location: null, country: null, locationEvidenceState: "UNKNOWN" as const };
const locationConflict = { ...directUnknown, candidateId: "location-conflict", location: "Singapore", country: "Singapore", locationEvidenceState: "CONFLICTING" as const };
const locationRequest = { query: ficoRequest.query, pageSize: 100 };
assert.deepEqual(rank([locationConflict, locationUnknown, directUnknown], locationRequest).map((item) => item.candidateId), ["direct-unknown", "location-unknown", "location-conflict"]);

// I: the same rule holds for a non-FICO role and specialization.
const reactRequest = { query: "Senior React Developer Singapore e-commerce", pageSize: 100 };
const reactDirect = { ...base, candidateId: "react-direct", currentTitle: "Senior React Developer", location: "Singapore", country: "Singapore", skills: ["React"], seniorityEvidenceLevel: "verified_structured_evidence" as const };
const reactAdjacent = { ...base, candidateId: "react-adjacent", currentTitle: "Senior Frontend Project Manager", historicalTitles: ["Frontend Developer"], location: "Singapore", country: "Singapore", skills: ["React", "E-commerce"], domainEvidence: { REACT: "SUPPORTED" as const }, seniorityEvidenceLevel: "verified_structured_evidence" as const };
assert.equal(rank([reactAdjacent, reactDirect], reactRequest)[0]?.candidateId, "react-direct");

// Historical direct evidence remains above merely adjacent same-domain evidence.
const historicalDirect = { ...adjacentVerified, candidateId: "historical-direct", historicalTitles: ["SAP FICO Consultant"] };
assert.equal(rank([adjacentVerified, historicalDirect])[0]?.candidateId, "historical-direct");

// J: stable evidence-derived ordering is independent of source order.
const deterministicSet = [adjacentVerified, directUnknown, contradicted, seniorUnknown, juniorMismatch, locationUnknown];
assert.deepEqual(
  rank(deterministicSet).map((item) => item.candidateId),
  rank([...deterministicSet].reverse()).map((item) => item.candidateId),
);

// Match-tier role-proximity ceiling: score coverage cannot replace professional evidence.
const directVerified = {
  ...directUnknown,
  candidateId: "direct-verified-tier",
  skills: ["FICO", "Implementation"],
  implementationEvidenceLevel: "verified_structured_evidence" as const,
};
const directSupported = {
  ...directUnknown,
  candidateId: "direct-supported-tier",
  skills: ["FICO", "Implementation"],
  implementationEvidenceLevel: "source_text_evidence" as const,
};
const tierCandidates = rank([directVerified, directSupported, directUnknown]);
assert.equal(tierFor(tierCandidates.find((item) => item.candidateId === "direct-verified-tier")!), "Strong Match");
assert.ok(["Strong Match", "Good Match"].includes(tierFor(tierCandidates.find((item) => item.candidateId === "direct-supported-tier")!)));
assert.equal(tierFor(tierCandidates.find((item) => item.candidateId === "direct-unknown")!), "Good Match");

const unrelatedCoverage: CandidateSearchV2Document = {
  ...base,
  candidateId: "unrelated-coverage-tier",
  currentTitle: "E-Commerce Manager",
  location: "Malaysia",
  country: "Malaysia",
  skills: ["FICO", "Implementation", "GL", "AP", "AR", "AA"],
  sapModules: ["FICO"],
  domainEvidence: { FICO: "STRONG" },
  implementationEvidenceLevel: "verified_structured_evidence",
  seniorityEvidenceLevel: "verified_structured_evidence",
};
const genericSapCoverage: CandidateSearchV2Document = {
  ...unrelatedCoverage,
  candidateId: "generic-sap-tier",
  currentTitle: "SAP Consultant",
  domainEvidence: { FICO: "EXPOSURE" },
  implementationEvidenceLevel: "source_text_evidence",
};
const ceilingCandidates = rank([unrelatedCoverage, genericSapCoverage, directUnknown]);
assert.equal(tierFor(ceilingCandidates.find((item) => item.candidateId === "unrelated-coverage-tier")!), "Potential Match");
assert.equal(tierFor(ceilingCandidates.find((item) => item.candidateId === "generic-sap-tier")!), "Potential Match", "explicit exposure in a generic SAP profile may remain only as fallback recall");
assert.ok(ceilingCandidates.findIndex((item) => item.candidateId === "direct-unknown") < ceilingCandidates.findIndex((item) => item.candidateId === "unrelated-coverage-tier"));

const historicalProfessional = {
  ...adjacentVerified,
  candidateId: "historical-professional-tier",
  historicalTitles: ["Senior SAP FICO Consultant"],
  implementationEvidenceLevel: "verified_structured_evidence" as const,
};
const historicalResult = rank([historicalProfessional])[0]!;
assert.equal(historicalResult.score.roleEvidenceKind, "historical_direct");
assert.ok(["Strong Match", "Good Match"].includes(tierFor(historicalResult)));

// Requested specialization distance controls global order before qualifiers:
// an exact anchor with a capability gap remains ahead of an adjacent anchor.
const directContradictedTier = {
  ...directUnknown,
  candidateId: "direct-contradicted-tier-order",
  skills: ["FICO", "Implementation"],
  implementationEvidenceLevel: "contradicted_evidence" as const,
};
const adjacentProfessionalGood: CandidateSearchV2Document = {
  ...base,
  candidateId: "adjacent-professional-good",
  currentTitle: "Senior SAP Finance Architect",
  historicalTitles: ["SAP Finance Functional Consultant"],
  location: "Malaysia",
  country: "Malaysia",
  skills: ["FICO", "Implementation"],
  sapModules: ["FICO"],
  domainEvidence: { FICO: "STRONG", FINANCE: "PRIMARY" },
  domainImplementationEvidence: { FICO: "VERIFIED" },
  implementationEvidenceLevel: "verified_structured_evidence",
  seniorityEvidenceLevel: "verified_structured_evidence",
};
const tierOrdered = rank([directContradictedTier, adjacentProfessionalGood]);
assert.equal(tierOrdered[0]!.candidateId, "direct-contradicted-tier-order");
assert.equal(tierFor(tierOrdered[0]!), "Potential Match");
assert.equal(tierFor(tierOrdered[1]!), "Good Match");
const tierPageOne = searchCandidatesV2([directContradictedTier, adjacentProfessionalGood], { ...ficoRequest, page: 1, pageSize: 1 });
const tierPageTwo = searchCandidatesV2([directContradictedTier, adjacentProfessionalGood], { ...ficoRequest, page: 2, pageSize: 1 });
assert.equal(tierFor(tierPageOne.results[0]!), "Potential Match");
assert.equal(tierFor(tierPageTwo.results[0]!), "Good Match");

// Derived aliases remain display evidence only and do not create a second role bonus.
assert.equal(circular[0]!.score.roleRelevanceScore, circular[1]!.score.roleRelevanceScore);
assert.equal(circular[0]!.score.roleProximityRank, circular[1]!.score.roleProximityRank);

// The tier ceiling is domain-independent.
for (const fixture of [
  { query: "Senior SAP MM Malaysia implementation", domain: "MM", directTitle: "Senior SAP MM Consultant", unrelatedTitle: "E-Commerce Manager", location: "Malaysia" },
  { query: "Senior React Developer Singapore", domain: "REACT", directTitle: "Senior React Developer", unrelatedTitle: "Operations Manager", location: "Singapore" },
  { query: "Mechanical Engineer Data Center Malaysia", domain: "MECHANICAL_ENGINEERING", directTitle: "Senior Mechanical Engineer", unrelatedTitle: "Marketing Manager", location: "Malaysia" },
  { query: "Finance Manager Vietnam", domain: "FINANCE", directTitle: "Senior Finance Manager", unrelatedTitle: "Operations Manager", location: "Vietnam" },
]) {
  const domainResults = rank([
    { ...base, profileQualityScore: 100, candidateId: `${fixture.domain}-direct`, currentTitle: fixture.directTitle, location: fixture.location, country: fixture.location, skills: [fixture.domain, "Implementation"], domainEvidence: { [fixture.domain]: "PRIMARY" }, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "verified_structured_evidence" },
    { ...base, candidateId: `${fixture.domain}-unrelated`, currentTitle: fixture.unrelatedTitle, location: fixture.location, country: fixture.location, skills: [fixture.domain], domainEvidence: { [fixture.domain]: "STRONG" }, seniorityEvidenceLevel: "verified_structured_evidence" },
  ], { query: fixture.query, pageSize: 100 });
  const direct = domainResults.find((item) => item.candidateId === `${fixture.domain}-direct`)!;
  assert.notEqual(tierFor(direct, fixture.query), "Potential Match");
  const unrelated = domainResults.find((item) => item.candidateId === `${fixture.domain}-unrelated`);
  if (unrelated) {
    assert.ok(direct.score.roleProximityRank > unrelated.score.roleProximityRank);
    assert.equal(tierFor(unrelated, fixture.query), "Potential Match");
  }
}

// Requested dimensions, not optional implementation enrichment, determine tiers.
const sdRequest = { query: "Senior SAP SD Malaysia", pageSize: 100 };
const explicitSdNoImplementation: CandidateSearchV2Document = {
  ...base,
  candidateId: "sd-explicit-no-implementation",
  canonicalCandidateId: "canonical-sd-explicit",
  currentTitle: "SAP SD Consultant",
  location: "Malaysia",
  country: "Malaysia",
  skills: ["SD"],
  sapModules: ["SD"],
  domainEvidence: { SD: "PRIMARY" },
  implementationEvidenceLevel: "unverified",
  seniorityEvidenceLevel: "inferred_evidence",
};
const explicitSdWithImplementation = {
  ...explicitSdNoImplementation,
  candidateId: "sd-explicit-with-implementation",
  canonicalCandidateId: "canonical-sd-with-implementation",
  implementationEvidenceLevel: "verified_structured_evidence" as const,
};
const sdWithoutImplementation = rank([explicitSdNoImplementation], sdRequest)[0]!;
const sdWithImplementation = rank([explicitSdWithImplementation], sdRequest)[0]!;
assert.ok(["Good Match", "Strong Match"].includes(tierFor(sdWithoutImplementation, sdRequest.query)));
assert.equal(tierFor(sdWithImplementation, sdRequest.query), tierFor(sdWithoutImplementation, sdRequest.query));
assert.equal(sdWithImplementation.score.finalScore, sdWithoutImplementation.score.finalScore);
assert.equal(sdWithImplementation.score.implementationStrength, 0);

const sdImplementationRequest = { query: "Senior SAP SD Malaysia implementation", pageSize: 100 };
const requestedImplementationResults = rank([explicitSdNoImplementation, explicitSdWithImplementation], sdImplementationRequest);
assert.equal(requestedImplementationResults[0]?.candidateId, explicitSdWithImplementation.candidateId);
assert.ok(requestedImplementationResults[0]!.score.finalScore - requestedImplementationResults[1]!.score.finalScore >= 12);
assert.ok(requestedImplementationResults[0]!.score.dimensionScore > requestedImplementationResults[1]!.score.dimensionScore);

const juniorSd = {
  ...explicitSdWithImplementation,
  candidateId: "sd-explicit-junior",
  canonicalCandidateId: "canonical-sd-junior",
  currentTitle: "Junior SAP Consultant",
  totalYearsExperience: 11,
};
const juniorSdResult = rank([juniorSd], sdRequest)[0]!;
assert.equal(juniorSdResult.seniorityFit, "mismatch");
assert.equal(tierFor(juniorSdResult, sdRequest.query), "Potential Match");

const inferredSd: CandidateSearchV2Document = {
  ...explicitSdNoImplementation,
  candidateId: "sd-inferred-generic",
  canonicalCandidateId: "canonical-sd-inferred",
  currentTitle: "SAP Consultant",
  domainEvidence: { SD: "EXPOSURE" },
};
const explicitOverInferred = rank([inferredSd, explicitSdNoImplementation], sdRequest);
assert.equal(explicitOverInferred[0]?.candidateId, explicitSdNoImplementation.candidateId);

const explicitSdUnknownSeniority = {
  ...explicitSdNoImplementation,
  candidateId: "sd-explicit-unknown-seniority",
  canonicalCandidateId: "canonical-sd-explicit-unknown",
  seniorityEvidenceLevel: "unverified" as const,
  totalYearsExperience: null,
};
const genericSdSupportedSeniority = {
  ...inferredSd,
  candidateId: "sd-generic-supported-seniority",
  canonicalCandidateId: "canonical-sd-generic-supported",
  domainEvidence: { SD: "SUPPORTED" as const },
};
const explicitUnknownOverGeneric = rank([genericSdSupportedSeniority, explicitSdUnknownSeniority], sdRequest);
assert.equal(explicitUnknownOverGeneric[0]?.candidateId, explicitSdUnknownSeniority.candidateId);
assert.equal(tierFor(explicitUnknownOverGeneric[0]!, sdRequest.query), "Good Match");

const duplicateSd = {
  ...explicitSdNoImplementation,
  candidateId: "sd-explicit-duplicate-source",
};
const dedupedSd = searchCandidatesV2([explicitSdNoImplementation, duplicateSd], { ...sdRequest, page: 1, pageSize: 1 });
assert.equal(dedupedSd.summary.totalMatched, 1);
assert.equal(dedupedSd.results.length, 1);

// An explicitly requested primary specialization must be evidence-verified,
// even when a title or derived tag happens to contain the requested token.
const abapRequest = { query: "Senior SAP ABAP Malaysia", pageSize: 100 };
const unverifiedAbap: CandidateSearchV2Document = {
  ...base,
  candidateId: "abap-title-tag-unverified",
  currentTitle: "Senior SAP ABAP Consultant",
  location: "Malaysia",
  country: "Malaysia",
  skills: ["ABAP", "Implementation"],
  sapModules: [],
  domainEvidence: { ABAP: "UNVERIFIED", BASIS: "PRIMARY" },
  implementationEvidenceLevel: "verified_structured_evidence",
  seniorityEvidenceLevel: "verified_structured_evidence",
};
const verifiedAbap: CandidateSearchV2Document = {
  ...unverifiedAbap,
  candidateId: "abap-verified",
  skills: ["ABAP"],
  sapModules: ["ABAP"],
  domainEvidence: { ABAP: "PRIMARY" },
  implementationEvidenceLevel: "unverified",
};
const abapEvidenceResults = rank([unverifiedAbap, verifiedAbap], abapRequest);
assert.equal(tierFor(abapEvidenceResults.find((item) => item.candidateId === unverifiedAbap.candidateId)!, abapRequest.query), "Potential Match");
assert.ok(["Good Match", "Strong Match"].includes(tierFor(abapEvidenceResults.find((item) => item.candidateId === verifiedAbap.candidateId)!, abapRequest.query)));
assert.equal(abapEvidenceResults.find((item) => item.candidateId === verifiedAbap.candidateId)!.score.implementationStrength, 0);
assert.ok(abapEvidenceResults.findIndex((item) => item.candidateId === verifiedAbap.candidateId) < abapEvidenceResults.findIndex((item) => item.candidateId === unverifiedAbap.candidateId));

const abapImplementationResults = rank([unverifiedAbap, verifiedAbap, { ...verifiedAbap, candidateId: "abap-verified-implementation", domainImplementationEvidence: { ABAP: "VERIFIED" }, implementationEvidenceLevel: "verified_structured_evidence" }], { query: "Senior SAP ABAP Malaysia implementation", pageSize: 100 });
assert.equal(abapImplementationResults[0]?.candidateId, "abap-verified-implementation");
assert.equal(tierFor(abapImplementationResults.find((item) => item.candidateId === unverifiedAbap.candidateId)!, "Senior SAP ABAP Malaysia implementation"), "Potential Match");

const ficoAliasEvidence: CandidateSearchV2Document = {
  ...verifiedAbap,
  candidateId: "fico-fi-alias-verified",
  currentTitle: "Senior SAP FI Consultant",
  skills: ["FI"],
  sapModules: ["FI"],
  domainEvidence: {},
};
const ficoAliasResult = rank([ficoAliasEvidence], { query: "Senior SAP FICO Malaysia", pageSize: 100 })[0]!;
assert.notEqual(tierFor(ficoAliasResult, "Senior SAP FICO Malaysia"), "Potential Match");

console.log("searchV2FinalCalibration.test.ts passed");
