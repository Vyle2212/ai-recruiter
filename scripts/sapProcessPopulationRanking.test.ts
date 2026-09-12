import assert from "node:assert/strict";
import { buildSearchIndexRow } from "../lib/search/buildSearchIndexRow";
import { candidateSearchV2ProjectionDocument } from "../lib/candidateSearchV2Projection";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";

const indexed = (candidate: Record<string, any>) => {
  const row = buildSearchIndexRow(candidate);
  assert.ok(row, `fixture ${candidate.id} must be indexable`);
  return candidateSearchV2ProjectionDocument({ ...row!, _trusted_candidate_evidence_values: [
    ...(candidate.current_title ? [{ value: candidate.current_title, sourceType: "raw_title", sourceField: "request_candidate.currentTitle", sourceRecordId: String(candidate.id), provenance: "candidate_record_raw", trusted: true }] : []),
    ...(candidate.raw_text ? [{ value: candidate.raw_text, sourceType: "raw_professional_text", sourceField: "request_candidate.raw_text", sourceRecordId: String(candidate.id), provenance: "candidate_record_raw", trusted: true }] : []),
  ] });
};
const rank = (query: string, candidates: Record<string, any>[], page = 1, pageSize = 100) =>
  searchCandidatesV2(candidates.map(indexed), { query, minimumScore: 0, page, pageSize });
const genericPopulation = (prefix: string, module: string, count: number, narrative: string) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`, name: `${prefix} Person ${index}`, current_title: `Senior SAP ${module} Consultant`,
  current_location: "Malaysia", country: "Malaysia", primary_module: module, sap_modules: [module], years: 20,
  raw_text: narrative,
}));

const p2pCandidates = [
  { id: "p2p-my", name: "Exact Ptwo", current_title: "SAP P2P Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "MM", sap_modules: ["MM", "P2P"], raw_text: "Owned end-to-end Procure-to-Pay delivery." },
  { id: "p2p-semantic-my", name: "Semantic Ptwo", current_title: "SAP MM Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "MM", sap_modules: ["MM"], raw_text: "Configured purchasing, purchase requisitions, purchase orders, goods receipt, vendor management and logistics invoice verification." },
  { id: "p2p-outside", name: "Remote Ptwo", current_title: "SAP P2P Consultant", current_location: "Singapore", country: "Singapore", primary_module: "MM", sap_modules: ["MM", "P2P"], raw_text: "P2P implementation consultant." },
  { id: "mm-inventory", name: "Inventory Person", current_title: "Senior SAP MM Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "MM", sap_modules: ["MM"], years: 20, raw_text: "Inventory management, material master and warehouse-related MM activities." },
  ...genericPopulation("Generic MM", "MM", 16, "SAP MM configuration and support."),
  { id: "incidental-p2p-abap", name: "Incidental Ptwo", current_title: "Senior SAP ABAP Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "ABAP", sap_modules: ["ABAP"], years: 20, raw_text: "Training covered end-to-end streams including P2P." },
  { id: "unrelated-abap", name: "Unrelated Person", current_title: "Senior SAP ABAP Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "ABAP", sap_modules: ["ABAP"], years: 22, raw_text: "ABAP development." },
];

for (const query of [
  "SAP P2P Consultant Malaysia", "SAP Procure to Pay Consultant Malaysia",
  "SAP Procure-to-Pay Consultant Malaysia", "SAP Source to Pay Consultant Malaysia",
]) {
  const response = rank(query, p2pCandidates);
  const ids = response.results.map((candidate) => candidate.candidateId);
  assert.equal(ids[0], "p2p-my", `${query}: target-location exact process evidence ranks first`);
  assert.ok(ids.indexOf("p2p-semantic-my") >= 0 && ids.indexOf("p2p-semantic-my") < ids.indexOf("mm-inventory"), `${query}: semantic lifecycle evidence beats MM-only seniority`);
  assert.ok(ids.indexOf("p2p-outside") >= 0 && ids.indexOf("p2p-outside") < ids.indexOf("mm-inventory"), `${query}: exact process evidence can overcome location mismatch`);
  assert.ok(response.results.slice(0, 3).every((candidate) => ["exact_verified", "exact_supported"].includes(candidate.specializationEvidenceLevel)), `${query}: generic MM cannot contaminate the process-evidence top cohort`);
  assert.equal(response.results.find((candidate) => candidate.candidateId === "mm-inventory")?.specializationEvidenceLevel, "parent_verified");
  assert.notEqual(response.results.find((candidate) => candidate.candidateId === "incidental-p2p-abap")?.specializationEvidenceLevel, "exact_verified", `${query}: unrelated-primary training mention cannot verify P2P`);
}

const p2pIntent = parseRecruiterSearchIntent("SAP P2P Consultant Malaysia");
const p2pRanked = rank("SAP P2P Consultant Malaysia", p2pCandidates).results;
const mmStatements = recruiterQueryStatements(p2pRanked.find((candidate) => candidate.candidateId === "mm-inventory")!, p2pIntent);
assert.ok(mmStatements.supported.some((label) => /Related .*MM experience/i.test(label)));
assert.ok(mmStatements.gaps.some((label) => /P2P.*not verified/i.test(label)));

const rtrCandidates = [
  { id: "rtr-my", name: "Exact Rtwo", current_title: "Senior SAP RTR Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "FICO", sap_modules: ["FICO", "FI"], years: 12, raw_text: "Led Record-to-Report delivery." },
  { id: "rtr-semantic-my", name: "Semantic Rtwo", current_title: "SAP FI Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "FICO", sap_modules: ["FICO", "FI", "GL"], years: 10, raw_text: "Owned month-end close, GL closing activities, journal entries, accruals and balance-sheet reconciliation." },
  { id: "rtr-outside", name: "Remote Rtwo", current_title: "SAP R2R Consultant", current_location: "Singapore", country: "Singapore", primary_module: "FICO", sap_modules: ["FICO", "FI"], years: 9, raw_text: "R2R consultant." },
  { id: "group-reporting", name: "Group Reporting", current_title: "SAP Group Reporting Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "FICO", sap_modules: ["FICO", "GR"], years: 15, raw_text: "SAP Group Reporting implementation." },
  { id: "financial-reporting-only", name: "Finance Reporting", current_title: "Senior SAP FICO Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "FICO", sap_modules: ["FICO", "FI"], years: 20, raw_text: "Financial reporting." },
  ...genericPopulation("Generic FICO", "FICO", 16, "SAP FICO configuration and support."),
  { id: "incidental-rtr-btp", name: "Incidental Rtwo", current_title: "Senior SAP BTP Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "BTP", sap_modules: ["BTP"], years: 20, raw_text: "Training covered end-to-end streams including RTR, OTC and P2P." },
  { id: "distributed-rtr", name: "Distributed Finance", current_title: "Senior SAP FICO Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "FICO", sap_modules: ["FICO", "FI"], years: 20, raw_text: `Financial reporting ${"unrelated ".repeat(80)} journal entries ${"unrelated ".repeat(80)} accruals.` },
  { id: "unrelated-sd", name: "Unrelated Sales", current_title: "Senior SAP SD Consultant", current_location: "Malaysia", country: "Malaysia", primary_module: "SD", sap_modules: ["SD"], years: 22, raw_text: "SAP SD support." },
];

for (const query of [
  "SAP RTR Consultant Malaysia", "SAP R2R Consultant Malaysia", "SAP Record to Report Consultant Malaysia",
  "SAP Record-to-Report Consultant Malaysia", "SAP RTR Lead Malaysia",
]) {
  const response = rank(query, rtrCandidates);
  const ids = response.results.map((candidate) => candidate.candidateId);
  assert.equal(ids[0], "rtr-my", `${query}: exact target-location RTR ranks first`);
  assert.ok(ids.indexOf("rtr-semantic-my") >= 0 && ids.indexOf("rtr-semantic-my") < ids.indexOf("financial-reporting-only"), `${query}: semantic close evidence beats generic FICO`);
  assert.ok(response.results.slice(0, 3).every((candidate) => ["exact_verified", "exact_supported"].includes(candidate.specializationEvidenceLevel)), `${query}: generic FICO cannot contaminate the RTR top cohort`);
  assert.equal(response.results.find((candidate) => candidate.candidateId === "financial-reporting-only")?.specializationEvidenceLevel, "parent_verified", "financial reporting alone is insufficient RTR evidence");
  assert.equal(response.results.find((candidate) => candidate.candidateId === "group-reporting")?.specializationEvidenceLevel, "parent_verified", "group reporting alone is not RTR");
  assert.notEqual(response.results.find((candidate) => candidate.candidateId === "incidental-rtr-btp")?.specializationEvidenceLevel, "exact_verified", `${query}: unrelated-primary training mention cannot verify RTR`);
  assert.equal(response.results.find((candidate) => candidate.candidateId === "distributed-rtr")?.specializationEvidenceLevel, "parent_verified", `${query}: distant terms cannot manufacture a close-process cluster`);
}

const firstPage = rank("SAP RTR Consultant Malaysia", rtrCandidates, 1, 7);
const secondPage = rank("SAP RTR Consultant Malaysia", rtrCandidates, 2, 7);
const repeatedFirstPage = rank("SAP RTR Consultant Malaysia", [...rtrCandidates].reverse(), 1, 7);
assert.equal(firstPage.summary.totalMatched, secondPage.summary.totalMatched);
assert.equal(new Set([...firstPage.results, ...secondPage.results].map((candidate) => candidate.canonicalCandidateId)).size, firstPage.results.length + secondPage.results.length);
assert.deepEqual(firstPage.results.map((candidate) => candidate.canonicalCandidateId), repeatedFirstPage.results.map((candidate) => candidate.canonicalCandidateId), "ranking remains deterministic across input order");

console.log("sapProcessPopulationRanking.test.ts passed");
