import assert from "node:assert/strict";
import { buildCanonicalCandidateSnapshot, classifyCandidateDomains } from "../lib/candidateCanonicalPipeline";
import { resolveCanonicalCandidateEntities } from "../lib/candidateEntityResolution";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";

const item = (id: string, raw: Record<string, unknown>) => ({ sourceRecordId: id, raw: { id, ...raw }, snapshot: buildCanonicalCandidateSnapshot({ id, ...raw }, id) });

const sameNameOnly = resolveCanonicalCandidateEntities([
  item("name-a", { full_name: "Alex Tan", location: "Malaysia", current_title: "SAP Consultant" }),
  item("name-b", { full_name: "Alex Tan", location: "Malaysia", current_title: "Java Developer" }),
]);
assert.equal(sameNameOnly.metrics.canonicalCandidateCount, 2, "same name alone must not merge identities");
assert.equal(sameNameOnly.metrics.ambiguousIdentityClusters, 1);

const verifiedVersions = resolveCanonicalCandidateEntities([
  item("cv-v1", { full_name: "Verified Person", email: "person@example.com", current_title: "SAP ABAP Developer", sap_modules: ["ABAP"] }),
  item("cv-v2", { full_name: "Verified Person", email: "PERSON@example.com", current_title: "SAP FICO Consultant", sap_modules: ["FICO"], implementation_project_count: 2 }),
]);
assert.equal(verifiedVersions.metrics.canonicalCandidateCount, 1, "verified CV versions must merge");
const merged = verifiedVersions.assignments.get("cv-v1")!;
assert.deepEqual(new Set(merged.linked_source_record_ids), new Set(["cv-v1", "cv-v2"]));
assert.ok(merged.payload.enterpriseProfile.sapModules.includes("ABAP") && merged.payload.enterpriseProfile.sapModules.includes("FICO"), "merged evidence must be unioned");
assert.ok(merged.evidence_graph.domains.FICO.some((entry: any) => entry.sourceRecordId === "cv-v2"), "merged facts must retain source provenance");

const isolated = buildCanonicalCandidateSnapshot({ id: "isolated", current_title: "ERP Project Manager", sap_modules: ["GL", "AP", "AR"], implementation_project_count: 9 });
assert.ok(["EXPOSURE", "UNVERIFIED"].includes(isolated.domain_evidence.FICO));
const adjacent = buildCanonicalCandidateSnapshot({ id: "adjacent", current_title: "SAP ABAP Developer", sap_modules: ["ABAP", "FI"], raw_text: "ABAP delivery with FI interface exposure" });
assert.equal(adjacent.domain_evidence.ABAP, "PRIMARY");
assert.ok(["EXPOSURE", "UNVERIFIED"].includes(adjacent.domain_evidence.FICO));

const historical = classifyCandidateDomains({}, {
  identity: { currentTitle: "Data Migration Manager" },
  employmentTimeline: [
    { title: "SAP FICO Lead", summary: "Configured FI and CO business processes", responsibilities: ["FICO configuration and implementation"] },
    { title: "SAP FI Consultant", summary: "Financial accounting configuration", responsibilities: ["Business process workshops"] },
  ],
  projects: [], certifications: [], sapModules: ["FICO"], technicalSkills: [],
});
assert.ok(["STRONG", "SUPPORTED"].includes(historical.FICO), "historical FICO career evidence must survive an adjacent current role");

const relevance = searchCandidatesV2([
  { candidateId: "named", candidateName: "Named Person", currentTitle: "Senior Java Developer", country: "Singapore", location: "Singapore", domainEvidence: { JAVA: "PRIMARY", MICROSERVICES: "STRONG" }, skills: ["Java", "Microservices"], seniorityEvidenceLevel: "verified_structured_evidence", locationEvidenceState: "VERIFIED" },
  { candidateId: "unnamed", candidateName: null, currentTitle: "Senior Java Developer", country: "Singapore", location: "Singapore", domainEvidence: { JAVA: "PRIMARY", MICROSERVICES: "STRONG" }, skills: ["Java", "Microservices"], seniorityEvidenceLevel: "verified_structured_evidence", locationEvidenceState: "VERIFIED" },
], { query: "Senior Java Developer Singapore microservices", filters: { skills: ["Java", "Microservices"], countries: ["Singapore"] }, pageSize: 20 });
assert.equal(relevance.results.find((result) => result.candidateId === "named")?.score.finalScore, relevance.results.find((result) => result.candidateId === "unnamed")?.score.finalScore, "missing display name must not reduce job relevance");

console.log("candidateEntityResolution.test.ts passed");
