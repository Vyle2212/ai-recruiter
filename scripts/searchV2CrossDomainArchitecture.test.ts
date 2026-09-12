import assert from "node:assert/strict";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent } from "../lib/recruiterSearchPresentation";

const base = { locationEvidenceState: "VERIFIED" as const, profileQualityScore: 90, dataConfidenceScore: 90 };
const ranked = (query: string, candidates: any[], filters: any = {}) => searchCandidatesV2(candidates, { query, filters, pageSize: 100 }).results;

const reactIntent = parseRecruiterSearchIntent("Senior React Developer Singapore e-commerce");
assert.deepEqual(reactIntent.roleConcepts, ["REACT"]);
assert.deepEqual(reactIntent.lifecycle, ["E-commerce"]);
const react = ranked("Senior React Developer Singapore e-commerce", [
  { ...base, candidateId: "react", currentTitle: "Senior React Developer", location: "Singapore", country: "Singapore", skills: ["React", "TypeScript", "E-commerce"], seniorityEvidenceLevel: "verified_structured_evidence" },
  { ...base, candidateId: "javascript", currentTitle: "Senior JavaScript Developer", location: "Singapore", country: "Singapore", skills: ["JavaScript", "E-commerce"], seniorityEvidenceLevel: "verified_structured_evidence" },
]);
assert.equal(react[0].candidateId, "react");
assert.equal(react[0].primaryRoleFit, "exact");
assert.notEqual(react[1].primaryRoleFit, "exact", "a parent/related concept must not equal direct React role evidence");

const go = ranked("Lead Golang Backend Vietnam", [
  { ...base, candidateId: "go", currentTitle: "Lead Golang Backend Engineer", location: "Vietnam", country: "Vietnam", skills: ["Golang", "Microservices"], seniorityEvidenceLevel: "verified_structured_evidence" },
  { ...base, candidateId: "java", currentTitle: "Lead Java Backend Engineer", location: "Vietnam", country: "Vietnam", skills: ["Java", "Microservices"], seniorityEvidenceLevel: "verified_structured_evidence" },
]);
assert.equal(go[0].candidateId, "go");

const mechanical = ranked("Mechanical Engineer Malaysia data center commissioning", [
  { ...base, candidateId: "mechanical", currentTitle: "Mechanical Engineer", location: "Malaysia", country: "Malaysia", skills: ["Data Center", "Commissioning"] },
  { ...base, candidateId: "project", currentTitle: "Project Manager", location: "Malaysia", country: "Malaysia", skills: ["Data Center", "Commissioning"] },
]);
assert.equal(mechanical[0].candidateId, "mechanical");
assert.equal(mechanical[0].primaryRoleFit, "exact");

const mm = ranked("Senior SAP MM Philippines implementation", [
  { ...base, candidateId: "mm", currentTitle: "Senior SAP MM Consultant", location: "Philippines", country: "Philippines", skills: ["MM", "Implementation"], sapModules: ["MM"], domainEvidence: { MM: "PRIMARY" }, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "verified_structured_evidence" },
  { ...base, candidateId: "fico", currentTitle: "Senior SAP FICO Consultant", location: "Philippines", country: "Philippines", skills: ["FICO", "Implementation", "MM"], sapModules: ["FICO", "MM"], domainEvidence: { FICO: "PRIMARY", MM: "EXPOSURE" }, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "verified_structured_evidence" },
], { skills: ["Implementation"], sapModules: ["MM"], countries: ["Philippines"] });
assert.equal(mm[0].candidateId, "mm");
const ficoForMm = ranked("Senior SAP MM Philippines implementation", [{ ...base, candidateId: "fico", currentTitle: "Senior SAP FICO Consultant", location: "Philippines", country: "Philippines", skills: ["FICO", "Implementation", "MM"], sapModules: ["FICO", "MM"], domainEvidence: { FICO: "PRIMARY", MM: "EXPOSURE" }, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "verified_structured_evidence" }], { skills: ["Implementation"], sapModules: ["MM"], countries: ["Philippines"] })[0];
assert.ok(!ficoForMm || ficoForMm.primaryRoleFit !== "exact");

// Architecture invariants: unrelated volume and missing evidence cannot help.
const clean = ranked("Senior React Developer Singapore", [{ ...base, candidateId: "clean", currentTitle: "Senior React Developer", location: "Singapore", country: "Singapore", skills: ["React"], seniorityEvidenceLevel: "verified_structured_evidence" }])[0];
const noisy = ranked("Senior React Developer Singapore", [{ ...base, candidateId: "noisy", currentTitle: "Senior React Developer", location: "Singapore", country: "Singapore", skills: ["React", "MM", "SD", "ABAP", "Java", "Finance"], seniorityEvidenceLevel: "verified_structured_evidence" }])[0];
assert.equal(clean.score.finalScore, noisy.score.finalScore, "unrelated skill volume must not improve role relevance");
const unknownLocation = ranked("Senior React Developer Singapore", [{ ...base, candidateId: "unknown", currentTitle: "Senior React Developer", skills: ["React"], seniorityEvidenceLevel: "verified_structured_evidence", locationEvidenceState: "UNKNOWN" }])[0];
assert.ok(unknownLocation.score.finalScore < clean.score.finalScore, "missing requested location must not improve ranking");

const deduped = searchCandidatesV2([
  { ...base, candidateId: "source-a", canonicalCandidateId: "person", currentTitle: "Senior React Developer", location: "Singapore", skills: ["React"] },
  { ...base, candidateId: "source-b", canonicalCandidateId: "person", currentTitle: "Senior React Developer", location: "Singapore", skills: ["React", "TypeScript"] },
], { query: "React Developer Singapore", pageSize: 1 });
assert.equal(deduped.summary.totalMatched, 1);
assert.equal(deduped.results.length, 1, "deduplication must precede pagination");

console.log("searchV2CrossDomainArchitecture.test.ts passed");
