import assert from "node:assert/strict";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";

const base = { profileQualityScore: 90, dataConfidenceScore: 90, locationEvidenceState: "VERIFIED" as const };
const run = (query: string, candidates: any[], page = 1, pageSize = 20) => searchCandidatesV2(candidates.map((candidate) => ({ ...candidate, trustedCandidateEvidence: { candidateId: candidate.candidateId, values: [...(candidate.currentTitle ? [{ value: candidate.currentTitle, sourceType: "raw_title" as const, sourceField: "request_candidate.title", sourceRecordId: candidate.candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []), ...(candidate.searchableText ? [{ value: candidate.searchableText, sourceType: "raw_professional_text" as const, sourceField: "request_candidate.raw_text", sourceRecordId: candidate.candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : [])] } })), { query, minimumScore: 0, page, pageSize });

const p2pCandidates = [
  { ...base, candidateId: "p2p-exact", currentTitle: "SAP P2P Consultant", location: "Malaysia", country: "Malaysia", skills: ["P2P"], sapModules: ["P2P", "MM"], domainEvidence: { P2P: "PRIMARY" as const } },
  { ...base, candidateId: "p2p-supported", currentTitle: "SAP MM Consultant", location: "Malaysia", country: "Malaysia", skills: ["MM"], sapModules: ["MM"], searchableText: "SAP MM procurement and purchasing responsibilities covering purchase requisitions, purchase orders, vendor management and invoice verification." },
  { ...base, candidateId: "p2p-parent", currentTitle: "SAP MM Consultant", location: "Malaysia", country: "Malaysia", skills: ["MM"], sapModules: ["MM"], searchableText: "SAP MM consultant." },
];
const p2p = run("SAP P2P Consultant Malaysia", p2pCandidates);
assert.deepEqual(p2p.results.map((item) => item.candidateId), ["p2p-exact", "p2p-supported", "p2p-parent"]);
assert.deepEqual(p2p.results.map((item) => item.specializationEvidenceLevel), ["exact_verified", "exact_supported", "parent_verified"]);
const p2pIntent = parseRecruiterSearchIntent("SAP P2P Consultant Malaysia");
assert.ok(["Strong Match", "Good Match"].includes(recruiterMatchTier(p2p.results[0]!, p2pIntent)));
assert.equal(recruiterMatchTier(p2p.results[1]!, p2pIntent), "Good Match");
assert.equal(recruiterMatchTier(p2p.results[2]!, p2pIntent), "Potential Match");
assert.ok(recruiterQueryStatements(p2p.results[2]!, p2pIntent).gaps.some((label) => /P2P.*not verified/i.test(label)));

const otcCandidates = [
  { ...base, candidateId: "otc-exact-remote", currentTitle: "Senior Functional Consultant OTC SME", location: "Philippines", country: "Philippines", skills: ["OTC"], sapModules: ["OTC", "SD"], domainEvidence: { OTC: "PRIMARY" as const }, seniorityEvidenceLevel: "verified_structured_evidence" as const },
  { ...base, candidateId: "otc-supported-my", currentTitle: "SAP SD Consultant", location: "Malaysia", country: "Malaysia", skills: ["SD"], sapModules: ["SD"], searchableText: "SAP SD delivery covering sales order management, pricing, delivery, billing, credit management and returns." },
  { ...base, candidateId: "otc-parent-my", currentTitle: "SAP SD Consultant", location: "Malaysia", country: "Malaysia", skills: ["SD"], sapModules: ["SD"], searchableText: "SAP SD consultant." },
];
const otc = run("SAP OTC Malaysia", otcCandidates);
assert.deepEqual(otc.results.map((item) => item.candidateId), ["otc-exact-remote", "otc-supported-my", "otc-parent-my"], "exact specialization may overcome a location mismatch");
assert.deepEqual(otc.results.map((item) => item.specializationEvidenceLevel), ["exact_verified", "exact_supported", "parent_verified"]);
const otcIntent = parseRecruiterSearchIntent("SAP OTC Malaysia");
assert.equal(recruiterMatchTier(otc.results[0]!, otcIntent), "Potential Match", "explicit non-target location caps the presentation tier without removing exact-skill recall");
assert.equal(otc.results[0]!.locationFit, "conflicting");
assert.equal(recruiterMatchTier(otc.results[2]!, otcIntent), "Potential Match");

const rtr = run("SAP RTR Lead Malaysia", [
  { ...base, candidateId: "rtr-exact", currentTitle: "Senior SAP RTR Consultant", location: "Malaysia", country: "Malaysia", skills: ["RTR"], sapModules: ["RTR", "FI"], domainEvidence: { RTR: "PRIMARY" as const }, seniorityEvidenceLevel: "verified_structured_evidence" as const },
  { ...base, candidateId: "rtr-semantic", currentTitle: "Senior SAP FI Consultant", location: "Malaysia", country: "Malaysia", skills: ["FI"], sapModules: ["FI", "FICO"], searchableText: "Owned month-end close, journal entries, accruals, balance-sheet reconciliation and statutory financial reporting.", seniorityEvidenceLevel: "verified_structured_evidence" as const },
  { ...base, candidateId: "rtr-fico", currentTitle: "SAP FICO Consultant", location: "Malaysia", country: "Malaysia", skills: ["FICO"], sapModules: ["FICO", "FI"], domainEvidence: { FICO: "PRIMARY" as const } },
]);
assert.equal(rtr.results[0]?.candidateId, "rtr-exact");
assert.equal(rtr.results[0]?.specializationEvidenceLevel, "exact_verified");
assert.equal(rtr.results[1]?.candidateId, "rtr-semantic");
assert.equal(rtr.results[1]?.specializationEvidenceLevel, "exact_supported", "financial-close evidence supports RTR without literal RTR");
assert.equal(rtr.results[2]?.specializationEvidenceLevel, "parent_verified", "generic FICO remains related parent evidence");
assert.equal(recruiterMatchTier(rtr.results[0]!, parseRecruiterSearchIntent("SAP RTR Lead Malaysia")), "Strong Match");
assert.notEqual(rtr.results.find((item) => item.candidateId === "rtr-fico")?.specializationEvidenceLevel, "exact_verified", "FICO alone never verifies RTR");
const rtrStatements = recruiterQueryStatements(rtr.results[2]!, parseRecruiterSearchIntent("SAP RTR Lead Malaysia"));
assert.ok(rtrStatements.supported.some((label) => /Related .*FI.* experience/i.test(label)));
assert.ok(rtrStatements.gaps.some((label) => /RTR.*not verified/i.test(label)));

const p2pFalsePositive = run("SAP P2P Consultant Malaysia", [
  { ...base, candidateId: "mm-inventory", currentTitle: "Senior SAP MM Consultant", location: "Malaysia", country: "Malaysia", skills: ["MM", "Inventory Management", "Material Master"], sapModules: ["MM"], searchableText: "SAP MM inventory management and material master maintenance.", totalYearsExperience: 20 },
  { ...base, candidateId: "p2p-junior", currentTitle: "SAP P2P Consultant", location: "Singapore", country: "Singapore", skills: ["P2P"], sapModules: ["P2P"], searchableText: "Procure-to-Pay delivery.", totalYearsExperience: 3 },
]);
assert.equal(p2pFalsePositive.results[0]?.candidateId, "p2p-junior", "exact domain evidence outranks location and generic seniority");
assert.equal(p2pFalsePositive.results[1]?.specializationEvidenceLevel, "parent_verified", "inventory/material-master MM evidence never verifies P2P");

assert.equal(p2p.results[2]!.specializationEvidenceLevel, "parent_verified", "query expansion itself must not become candidate evidence");
const p2pPageOne = run("SAP P2P Consultant Malaysia", p2pCandidates, 1, 1);
const p2pPageTwo = run("SAP P2P Consultant Malaysia", p2pCandidates, 2, 1);
assert.equal(p2pPageOne.summary.totalMatched, p2pPageTwo.summary.totalMatched);
assert.deepEqual([p2pPageOne.results[0]!.candidateId, p2pPageTwo.results[0]!.candidateId], ["p2p-exact", "p2p-supported"]);

console.log("sapProcessEvidenceRanking.test.ts passed");
