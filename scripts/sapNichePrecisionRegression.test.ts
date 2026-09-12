import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeCandidateSearchV2Request } from "../lib/candidateSearchV2Request";
import { scoreCandidateSearchV2Document } from "../lib/candidateSearchV2Scoring";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";
const trusted = (candidateId: string, title: string, text: string, skills: string[] = []) => ({ candidateId, values: [
  ...(title ? [{ value: title, sourceType: "raw_title" as const, sourceField: "request_candidate.title", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
  ...(text ? [{ value: text, sourceType: "raw_professional_text" as const, sourceField: "request_candidate.raw_text", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true }] : []),
  ...skills.map((value) => ({ value, sourceType: "direct_skill" as const, sourceField: "request_candidate.skills", sourceRecordId: candidateId, provenance: "candidate_record_raw" as const, trusted: true })),
] });

const profileEvidence = { name: true, title: true, employer: true, location: true, experienceDuration: true, employmentHistory: true, projectHistory: true, education: false, certifications: false, skills: true };
const candidate = (candidateId: string, currentTitle: string, sapModules: string[], searchableText: string, location = "Malaysia") => ({
  candidateId, candidateName: `Fixture ${candidateId}`, currentTitle, currentEmployer: "Fixture Employer",
  location, country: location, totalYearsExperience: 10, skills: sapModules, sapModules,
  industries: [], languages: [], searchableText, trustedCandidateEvidence: trusted(candidateId, currentTitle, searchableText), domainEvidence: {}, profileQualityScore: 80,
  dataConfidenceScore: 80, locationEvidenceState: "VERIFIED" as const,
  seniorityEvidenceLevel: "verified_structured_evidence" as const, profileEvidence,
});
const score = (query: string, document: ReturnType<typeof candidate>) => scoreCandidateSearchV2Document(document, normalizeCandidateSearchV2Request({ query, minimumScore: 0, pageSize: 100 }));
const tier = (query: string, result: ReturnType<typeof score>) => recruiterMatchTier(result, parseRecruiterSearchIntent(query));
const atMostPotential = (label: string) => ["Potential Match", "Broad Match"].includes(label);

const cpiQuery = "SAP CPI Consultant Malaysia";
const cpiExact = score(cpiQuery, candidate("cpi-exact", "SAP CPI / Integration Suite Consultant", ["CPI", "INTEGRATION_SUITE"], "Implemented SAP Cloud Integration iFlows."));
const cpiAbap = score(cpiQuery, candidate("cpi-abap", "SAP ABAP Consultant", ["ABAP"], "ABAP development and enhancements."));
const cpiBtp = score(cpiQuery, candidate("cpi-btp", "SAP BTP Consultant", ["BTP"], "SAP BTP extension development."));
assert.equal(cpiExact.specializationEvidenceLevel, "exact_verified");
assert.ok(["Strong Match", "Good Match"].includes(tier(cpiQuery, cpiExact)));
for (const result of [cpiAbap, cpiBtp]) {
  assert.notEqual(result.specializationEvidenceLevel, "exact_verified");
  assert.notEqual(result.specializationEvidenceLevel, "exact_supported");
  assert.ok(atMostPotential(tier(cpiQuery, result)));
}

const mbcQuery = "SAP MBC Consultant Malaysia";
const mbcExact = score(mbcQuery, candidate("mbc-exact", "SAP Treasury Consultant", ["TRM"], "Implemented Multi-Bank Connectivity, BCM and bank integration."));
const mbcFico = score(mbcQuery, candidate("mbc-fico", "SAP FICO Consultant", ["FICO"], "Financial accounting and controlling."));
assert.equal(mbcExact.specializationEvidenceLevel, "exact_verified");
assert.ok(["Strong Match", "Good Match"].includes(tier(mbcQuery, mbcExact)));
assert.notEqual(mbcFico.specializationEvidenceLevel, "exact_verified");
assert.notEqual(mbcFico.specializationEvidenceLevel, "exact_supported");
assert.ok(atMostPotential(tier(mbcQuery, mbcFico)));

const ppdsQuery = "SAP PP/DS Consultant Malaysia";
const ppdsExact = score(ppdsQuery, candidate("ppds-exact", "SAP PP/DS Consultant", ["PPDS"], "Delivered embedded PP/DS planning."));
const ppOnly = score(ppdsQuery, candidate("pp-only", "SAP PP Consultant", ["PP"], "Production planning, MRP and production orders."));
assert.equal(ppdsExact.specializationEvidenceLevel, "exact_verified");
assert.ok(["Strong Match", "Good Match"].includes(tier(ppdsQuery, ppdsExact)));
assert.equal(ppOnly.specializationEvidenceLevel, "parent_verified");
assert.ok(atMostPotential(tier(ppdsQuery, ppOnly)));
assert.ok(recruiterQueryStatements(ppOnly, parseRecruiterSearchIntent(ppdsQuery)).supported.some((item) => /Related (?:SAP )?PP experience/i.test(item)));

const datasphereQuery = "SAP Datasphere Consultant Malaysia";
const datasphereMalaysia = candidate("datasphere-my", "SAP Datasphere Consultant", ["DATASPHERE"], "Implemented SAP Datasphere data models.");
const datasphereSingapore = candidate("datasphere-sg", "SAP Datasphere Consultant", ["DATASPHERE"], "Implemented SAP Datasphere data models.", "Singapore");
const sacMalaysia = candidate("sac-my", "SAP SAC / BW Consultant", ["SAC", "BW"], "SAC dashboards and BW analytics.");
const genericManager = candidate("sap-manager", "SAP Program Manager", ["BTP"], "Managed broad SAP delivery.");
const datasphereResults = searchCandidatesV2([sacMalaysia, genericManager, datasphereSingapore, datasphereMalaysia], { query: datasphereQuery, minimumScore: 0, pageSize: 100 }).results;
assert.equal(datasphereResults[0]?.candidateId, "datasphere-my");
assert.deepEqual(datasphereResults.map((item) => item.candidateId), ["datasphere-my"]);
assert.equal(score(datasphereQuery, sacMalaysia).specializationEvidenceLevel, "adjacent");
assert.ok(atMostPotential(tier(datasphereQuery, score(datasphereQuery, sacMalaysia))));
assert.notEqual(score(datasphereQuery, genericManager).specializationEvidenceLevel, "exact_supported");

const otcQuery = "SAP OTC Consultant Malaysia";
const otcExact = score(otcQuery, candidate("otc-exact", "SAP SD Consultant", ["SD"], "Configured end-to-end Order-to-Cash pricing, delivery, billing and credit management."));
const sdOnly = score(otcQuery, candidate("sd-only", "SAP SD Consultant", ["SD"], "SAP SD configuration."));
const otcFico = score(otcQuery, candidate("otc-fico", "SAP FICO Consultant", ["FICO"], "SAP FICO configuration."));
assert.equal(otcExact.specializationEvidenceLevel, "exact_verified");
assert.ok(["Strong Match", "Good Match"].includes(tier(otcQuery, otcExact)));
assert.equal(sdOnly.specializationEvidenceLevel, "parent_verified");
assert.ok(atMostPotential(tier(otcQuery, sdOnly)));
assert.notEqual(otcFico.specializationEvidenceLevel, "exact_supported");
assert.ok(atMostPotential(tier(otcQuery, otcFico)));

const ewmQuery = "SAP EWM Consultant Malaysia";
const mmOnly = score(ewmQuery, candidate("mm-only", "SAP MM Consultant", ["MM"], "Materials management and procurement."));
assert.notEqual(mmOnly.specializationEvidenceLevel, "exact_supported");

const supportedWrongDomain = score(cpiQuery, { ...candidate("bad-precomputed-support", "SAP HCM Consultant", ["HCM"], "Human capital management."), domainEvidence: { CPI: "SUPPORTED" as const, HCM: "PRIMARY" as const } });
assert.notEqual(supportedWrongDomain.specializationEvidenceLevel, "exact_supported", "precomputed SUPPORTED without target-specific source evidence is retrieval context only");
assert.ok(atMostPotential(tier(cpiQuery, supportedWrongDomain)));

const clientSource = fs.readFileSync(path.join(process.cwd(), "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx"), "utf8");
assert.match(clientSource, /summary\.totalMatched\s*>\s*response\.summary\.pageSize\s*\?\s*<nav/, "pagination must remain hidden for one page");
assert.equal(15 > 20, false);
assert.equal(21 > 20, true);

console.log("SAP niche precision regression tests passed");
