import assert from "node:assert/strict";
import { canonicalSearchConcept, conceptsInText, searchConceptExpansion, searchConceptRelation } from "../lib/candidateSearchConcepts";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";

const interpretations: Array<[string, string[]]> = [
  ["Senior SAP OTC Malaysia", ["OTC"]],
  ["SAP P2P Consultant Malaysia", ["P2P"]],
  ["SAP RTR Lead", ["RTR"]],
  ["SAP BCM consultant", ["BCM"]],
  ["SAP MBC treasury", ["MBC", "TRM"]],
  ["SAP EWM Malaysia", ["EWM"]],
  ["SAP PPDS consultant", ["PPDS"]],
  ["SAP SAC Datasphere", ["SAC", "DATASPHERE"]],
  ["SAP BTP CPI", ["BTP", "CPI"]],
  ["SAP MDG", ["MDG"]],
  ["SAP GTS", ["GTS"]],
  ["Senior SAP FICO Malaysia implementation", ["FICO"]],
];
for (const [query, expected] of interpretations) {
  assert.deepEqual([...parseRecruiterSearchIntent(query).roleConcepts].sort(), [...expected].sort(), `${query} must normalize deterministically`);
}

assert.equal(canonicalSearchConcept("Order-to-Cash"), "OTC");
assert.equal(canonicalSearchConcept("Procure-to-Pay"), "P2P");
assert.equal(canonicalSearchConcept("R2R"), "RTR");
assert.equal(canonicalSearchConcept("Extended Warehouse Management"), "EWM");
assert.equal(canonicalSearchConcept("Production Planning and Detailed Scheduling"), "PPDS");
for (const [alias, concept] of Object.entries({
  "O2C": "OTC", "P2P": "P2P", "R2R": "RTR", "MBC": "MBC", "Treasury": "TRM", "BCM": "BCM",
  "EWM": "EWM", "WM": "WM", "PP/DS": "PPDS", "PP": "PP", "QM": "QM", "SAC": "SAC",
  "DWC": "DATASPHERE", "BW4HANA": "BW", "BTP": "BTP", "CPI": "CPI", "PI/PO": "PI_PO",
  "Ariba": "ARIBA", "SuccessFactors": "SUCCESSFACTORS", "MDG": "MDG", "GRC": "GRC",
})) assert.equal(canonicalSearchConcept(alias), concept, `${alias} canonicalization`);
assert.equal(searchConceptRelation("OTC", "SD"), "PARENT");
assert.equal(searchConceptRelation("P2P", "MM"), "PARENT");
assert.equal(searchConceptRelation("FICO", "AP"), "CHILD");
assert.equal(searchConceptRelation("EWM", "WM"), "ADJACENT");
assert.equal(searchConceptRelation("CPI", "PI_PO"), "RELATED");
assert.equal(searchConceptRelation("DATASPHERE", "BW"), "ADJACENT");
assert.ok(searchConceptExpansion("MBC").some((value) => /multi-bank connectivity/i.test(value)));
assert.ok(searchConceptExpansion("MBC").some((value) => /treasury|trm/i.test(value)));
assert.ok(parseRecruiterSearchIntent("SAP BTP CPI Malaysia").expandedConcepts.some((value) => /integration suite/i.test(value)));
assert.equal(conceptsInText("consumer price index CPI").includes("CPI"), false, "ambiguous CPI needs SAP context");
assert.equal(conceptsInText("talent management TM").includes("TM"), false, "ambiguous TM needs SAP context");
assert.equal(conceptsInText("SAP CPI integration").includes("CPI"), true);
assert.equal(conceptsInText("SAP TM freight order").includes("TM"), true);
assert.equal(conceptsInText("SAP PI/PO consultant").includes("P2P"), false, "PI/PO must not collide with purchase-order shorthand");

const base = { profileQualityScore: 90, dataConfidenceScore: 90, locationEvidenceState: "VERIFIED" as const };
function ranked(query: string, candidates: any[]) {
  return searchCandidatesV2(candidates.map((candidate) => ({ ...candidate, trustedCandidateEvidence: { candidateId: candidate.candidateId, values: candidate.currentTitle ? [{ value: candidate.currentTitle, sourceType: "raw_title" as const, sourceField: "request_candidate.currentTitle", sourceRecordId: candidate.candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : [] } })), { query, minimumScore: 0, pageSize: 100 }).results;
}

const p2p = ranked("SAP P2P Consultant Malaysia", [
  { ...base, candidateId: "p2p", currentTitle: "SAP P2P Consultant", country: "Malaysia", skills: ["P2P", "Purchase Order"], sapModules: ["P2P", "MM"], domainEvidence: { P2P: "PRIMARY" } },
  { ...base, candidateId: "mm", currentTitle: "SAP MM Consultant", country: "Malaysia", skills: ["MM"], sapModules: ["MM"], domainEvidence: { MM: "PRIMARY" } },
  { ...base, candidateId: "sd", currentTitle: "SAP SD Consultant", country: "Malaysia", skills: ["SD"], sapModules: ["SD"] },
]);
assert.equal(p2p[0]?.candidateId, "p2p");
assert.ok(p2p.some((candidate) => candidate.candidateId === "mm"), "MM must broaden P2P recall as supporting evidence");
assert.ok(!p2p.some((candidate) => candidate.candidateId === "sd"));
assert.notEqual(p2p.find((candidate) => candidate.candidateId === "mm")?.primaryRoleFit, "exact");

const ewm = ranked("SAP EWM Malaysia", [
  { ...base, candidateId: "ewm", currentTitle: "SAP EWM Consultant", country: "Malaysia", skills: ["EWM", "Implementation", "FICO"], sapModules: ["EWM", "MM"], domainEvidence: { EWM: "PRIMARY" } },
  { ...base, candidateId: "wm", currentTitle: "SAP WM Consultant", country: "Malaysia", skills: ["WM"], sapModules: ["WM"], domainEvidence: { WM: "PRIMARY" } },
]);
assert.equal(ewm[0]?.candidateId, "ewm");
assert.ok(!ewm.some((candidate) => candidate.candidateId === "wm"), "classic WM must not substitute for EWM");
assert.deepEqual(ewm[0]?.queryRelevantSkills, ["EWM"], "Relevant skills must exclude unrelated or unrequested SAP evidence");
assert.ok(recruiterQueryStatements(ewm[0], parseRecruiterSearchIntent("SAP EWM Malaysia")).supported.some((value) => /EWM verified/i.test(value)));

const ppds = ranked("Senior SAP PPDS Consultant Malaysia", [
  { ...base, candidateId: "ppds", currentTitle: "SAP PP/DS Consultant", country: "Malaysia", totalYearsExperience: 8, skills: ["Embedded PP/DS"], sapModules: ["PPDS", "PP"], domainEvidence: { PPDS: "STRONG", PP: "PRIMARY" }, seniorityEvidenceLevel: "source_text_evidence" },
  { ...base, candidateId: "pp", currentTitle: "Senior SAP PP Consultant", country: "Malaysia", totalYearsExperience: 20, skills: ["Production Planning"], sapModules: ["PP"], domainEvidence: { PP: "PRIMARY" }, seniorityEvidenceLevel: "verified_structured_evidence" },
]);
assert.equal(ppds[0]?.candidateId, "ppds", "exact PP/DS must outrank a more-senior generic PP candidate");
assert.ok((ppds[0]?.score.specializationStrength || 0) > (ppds[1]?.score.specializationStrength || 0));
assert.notEqual(ppds[1]?.primaryRoleFit, "exact", "PP parent evidence is fallback, not verified PP/DS");

const btp = ranked("SAP BTP CPI", [
  { ...base, candidateId: "btp-cpi", currentTitle: "SAP BTP CPI Consultant", skills: ["BTP", "CPI"], sapModules: ["BTP", "CPI"], domainEvidence: { BTP: "PRIMARY", CPI: "STRONG" } },
  { ...base, candidateId: "btp-pipo", currentTitle: "SAP BTP PI/PO Integration Consultant", skills: ["BTP", "PI/PO"], sapModules: ["BTP", "PI/PO"], domainEvidence: { BTP: "PRIMARY", PI_PO: "PRIMARY" } },
  { ...base, candidateId: "btp", currentTitle: "SAP BTP Consultant", skills: ["BTP"], sapModules: ["BTP"], domainEvidence: { BTP: "PRIMARY" } },
]);
assert.equal(btp[0]?.candidateId, "btp-cpi");
assert.ok(btp.some((candidate) => candidate.candidateId === "btp-pipo"), "BTP plus PI/PO is a related CPI fallback");
assert.equal(btp.some((candidate) => candidate.candidateId === "btp"), false, "generic BTP without integration evidence is not API-visible for CPI");
assert.ok(recruiterQueryStatements(btp.find((candidate) => candidate.candidateId === "btp-pipo")!, parseRecruiterSearchIntent("SAP BTP CPI")).gaps.some((value) => /CPI.*not verified/i.test(value)));
assert.ok((btp[0]?.score.specializationStrength || 0) > (btp.find((candidate) => candidate.candidateId === "btp-pipo")?.score.specializationStrength || 0));

const mbc = ranked("SAP MBC Treasury Malaysia", [
  { ...base, candidateId: "mbc", currentTitle: "SAP Multi-Bank Connectivity Consultant", country: "Malaysia", skills: ["MBC", "Treasury"], sapModules: ["MBC", "TRM"], domainEvidence: { MBC: "PRIMARY", TRM: "STRONG" } },
  { ...base, candidateId: "bcm", currentTitle: "SAP Treasury Consultant", country: "Malaysia", skills: ["BCM", "Bank Integration"], sapModules: ["TRM", "BCM"], domainEvidence: { TRM: "PRIMARY", BCM: "STRONG" } },
  { ...base, candidateId: "trm", currentTitle: "SAP TRM Consultant", country: "Malaysia", skills: ["Cash Management", "Payments"], sapModules: ["TRM"], domainEvidence: { TRM: "PRIMARY" } },
]);
assert.deepEqual(mbc.map((candidate) => candidate.candidateId), ["mbc", "bcm", "trm"]);
assert.ok(recruiterQueryStatements(mbc[1]!, parseRecruiterSearchIntent("SAP MBC Treasury Malaysia")).gaps.some((value) => /MBC.*not (?:explicitly )?verified/i.test(value)));

const datasphere = ranked("SAP Datasphere", [
  { ...base, candidateId: "datasphere", currentTitle: "SAP Datasphere Consultant", skills: ["Datasphere"], sapModules: ["DATASPHERE"], domainEvidence: { DATASPHERE: "PRIMARY" } },
  { ...base, candidateId: "bw", currentTitle: "SAP BW Consultant", skills: ["BW"], sapModules: ["BW"], domainEvidence: { BW: "PRIMARY" } },
]);
assert.equal(datasphere[0]?.candidateId, "datasphere");
assert.ok(!datasphere.some((candidate) => candidate.candidateId === "bw"), "generic BW must not substitute for Datasphere");

const fico = ranked("Senior SAP FICO Malaysia implementation", [
  { ...base, candidateId: "fico", currentTitle: "Senior SAP FICO Consultant", country: "Malaysia", skills: ["FICO", "Implementation"], sapModules: ["FICO"], domainEvidence: { FICO: "PRIMARY" }, seniorityEvidenceLevel: "verified_structured_evidence", implementationEvidenceLevel: "verified_structured_evidence", domainImplementationEvidence: { FICO: "VERIFIED" } },
  { ...base, candidateId: "ap", currentTitle: "Senior SAP Accounts Payable Consultant", country: "Malaysia", skills: ["AP", "Implementation"], sapModules: ["AP", "FI"], domainEvidence: { AP: "PRIMARY" }, seniorityEvidenceLevel: "verified_structured_evidence", implementationEvidenceLevel: "verified_structured_evidence" },
]);
assert.equal(fico[0]?.candidateId, "fico");
assert.notEqual(fico.find((candidate) => candidate.candidateId === "ap")?.primaryRoleFit, "exact", "AP alone cannot prove full FICO specialization");

const specializationCases = [
  { query: "SAP OTC Malaysia", concepts: ["OTC"], exact: "OTC", parent: "SD", exactTitle: "SAP OTC Consultant", parentTitle: "SAP SD Consultant" },
  { query: "SAP P2P Consultant Malaysia", concepts: ["P2P"], exact: "P2P", parent: "MM", exactTitle: "SAP P2P Consultant", parentTitle: "SAP MM Consultant" },
  { query: "SAP PPDS Consultant Malaysia", concepts: ["PPDS"], exact: "PPDS", parent: "PP", exactTitle: "SAP PP/DS Consultant", parentTitle: "SAP PP Consultant" },
  { query: "SAP EWM Consultant Malaysia", concepts: ["EWM"], exact: "EWM", parent: "WM", exactTitle: "SAP EWM Consultant", parentTitle: "SAP WM Consultant" },
  { query: "SAP BTP CPI Malaysia", concepts: ["BTP", "CPI"], exact: "CPI", parent: "BTP", exactTitle: "SAP BTP CPI Consultant", parentTitle: "SAP BTP Consultant" },
  { query: "SAP MBC Treasury Malaysia", concepts: ["MBC", "TRM"], exact: "MBC", parent: "TRM", exactTitle: "SAP MBC Treasury Consultant", parentTitle: "SAP Treasury Consultant" },
  { query: "SAP RTR Lead Malaysia", concepts: ["RTR"], exact: "RTR", parent: "FI", exactTitle: "SAP RTR Lead", parentTitle: "SAP FI Lead" },
  { query: "SAP SAC Datasphere Malaysia", concepts: ["SAC", "DATASPHERE"], exact: "DATASPHERE", parent: "BW", exactTitle: "SAP SAC Datasphere Consultant", parentTitle: "SAP BW Consultant", exactModules: ["SAC", "DATASPHERE"] },
  { query: "SAP FICO Malaysia implementation", concepts: ["FICO"], exact: "FICO", parent: "FI", exactTitle: "SAP FICO Consultant", parentTitle: "SAP FI Consultant", implementation: true },
];
for (const fixture of specializationCases) {
  const intent = parseRecruiterSearchIntent(fixture.query);
  assert.deepEqual([...intent.roleConcepts].sort(), [...fixture.concepts].sort(), `${fixture.query}: canonical parsing`);
  assert.ok(intent.expandedConcepts.length > 0, `${fixture.query}: expansion terms`);
  const exactCandidate = { ...base, candidateId: `${fixture.exact}-exact`, currentTitle: fixture.exactTitle, country: "Malaysia", location: "Malaysia", skills: [fixture.exact, ...(fixture.implementation ? ["Implementation"] : [])], sapModules: fixture.exactModules || [fixture.exact], domainEvidence: Object.fromEntries((fixture.exactModules || [fixture.exact]).map((id) => [id, "PRIMARY" as const])) as Record<string, "PRIMARY">, implementationEvidenceLevel: fixture.implementation ? "verified_structured_evidence" as const : "unverified" as const, domainImplementationEvidence: fixture.implementation ? { [fixture.exact]: "VERIFIED" as const } : {} };
  const parentCandidate = { ...base, candidateId: `${fixture.exact}-parent`, currentTitle: fixture.parentTitle, country: "Malaysia", location: "Malaysia", skills: [fixture.parent], sapModules: [fixture.parent], domainEvidence: { [fixture.parent]: "PRIMARY" as const } };
  const response = searchCandidatesV2([parentCandidate, exactCandidate].map((candidate) => ({ ...candidate, trustedCandidateEvidence: { candidateId: candidate.candidateId, values: [{ value: candidate.currentTitle, sourceType: "raw_title" as const, sourceField: "request_candidate.currentTitle", sourceRecordId: candidate.candidateId, provenance: "candidate_record_raw" as const, trusted: true }] } })), { query: fixture.query, minimumScore: 0, page: 1, pageSize: 1 });
  assert.equal(response.results[0]?.candidateId, exactCandidate.candidateId, `${fixture.query}: exact must rank first`);
  assert.equal(response.results[0]?.specializationEvidenceLevel, "exact_verified", `${fixture.query}: exact evidence verdict`);
  assert.equal(response.results[0]?.locationFit, "verified", `${fixture.query}: location evidence`);
  assert.ok(["Strong Match", "Good Match"].includes(recruiterMatchTier(response.results[0]!, intent)), `${fixture.query}: exact actionable tier`);
  assert.ok(recruiterQueryStatements(response.results[0]!, intent).supported.some((label) => /verified|title/i.test(label)), `${fixture.query}: exact evidence label`);
  const secondPage = searchCandidatesV2([parentCandidate, exactCandidate].map((candidate) => ({ ...candidate, trustedCandidateEvidence: { candidateId: candidate.candidateId, values: [{ value: candidate.currentTitle, sourceType: "raw_title" as const, sourceField: "request_candidate.currentTitle", sourceRecordId: candidate.candidateId, provenance: "candidate_record_raw" as const, trusted: true }] } })), { query: fixture.query, minimumScore: 0, page: 2, pageSize: 1 });
  assert.equal(secondPage.summary.totalMatched, response.summary.totalMatched, `${fixture.query}: pagination must not change result count`);
  if (secondPage.results[0]) {
    assert.notEqual(secondPage.results[0].specializationEvidenceLevel, "exact_verified", `${fixture.query}: parent is not exact`);
    assert.equal(recruiterMatchTier(secondPage.results[0], intent), "Potential Match", `${fixture.query}: parent/adjacent tier ceiling`);
    assert.ok(recruiterQueryStatements(secondPage.results[0], intent).gaps.some((label) => /not (?:explicitly )?verified|not confirmed/i.test(label)), `${fixture.query}: honest parent evidence label`);
  }
}

console.log("sapSearchTaxonomy.test.ts passed");
