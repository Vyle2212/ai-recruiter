import assert from "node:assert/strict";
import { calculateTotalCareerYears, formatTotalCareerExperience } from "../lib/candidateCareerExperience";
import { numberedSearchPages, buildSearchReturnUrl } from "../lib/searchPagination";
import { adaptCandidateToSearchV2Document } from "../lib/candidateSearchV2Adapter";
import { candidate360SearchHref, candidate360SearchPosition, resolveCandidate360SearchContext } from "../lib/candidate360SearchContext";
import { parseRecruiterSearchIntent, recruiterCandidateEvidenceChips, recruiterCriticalGap, recruiterMatchTier, recruiterProfileConfidence, recruiterQueryStatements } from "../lib/recruiterSearchPresentation";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { buildCanonicalCandidateSnapshot, CANDIDATE_NORMALIZATION_VERSION, CANDIDATE_PARSER_VERSION } from "../lib/candidateCanonicalPipeline";
import { candidateSearchV2ProjectionDocument } from "../lib/candidateSearchV2Projection";

const now = new Date("2026-01-01T00:00:00Z");
assert.equal(calculateTotalCareerYears([
  { start: "2018-01-01", end: "2021-01-01" },
  { start: "2020-01-01", end: "2023-01-01" },
], now), 5, "overlapping employment must be counted once");
assert.equal(calculateTotalCareerYears([{ start: "unknown", end: "present" }], now), null);
assert.equal(formatTotalCareerExperience(null), "Experience not established");
assert.equal(formatTotalCareerExperience(15.8), "16 years experience");
assert.equal(formatTotalCareerExperience(2.8), "3 years experience");
assert.equal(formatTotalCareerExperience(0.3), "Less than 1 year experience");

const futureImportSnapshot = buildCanonicalCandidateSnapshot({
  id: "source-1", name: "CURRICULUM VITAE",
  current_title: "Currently working as Senior SAP FICO Consultant at Example Co",
  implementation_project_count: 3,
});
assert.equal(futureImportSnapshot.parser_version, CANDIDATE_PARSER_VERSION);
assert.equal(futureImportSnapshot.normalization_version, CANDIDATE_NORMALIZATION_VERSION);
assert.equal(futureImportSnapshot.identity_status, "NEEDS_REVIEW");
assert.equal(futureImportSnapshot.payload.enterpriseProfile.identity.currentTitle, "Senior SAP FICO Consultant");
assert.equal(futureImportSnapshot.capabilities.implementation.verification, "MENTION_ONLY");
assert.equal(futureImportSnapshot.domain_evidence.FICO, "PRIMARY");
assert.equal(normalizeActualCandidateSchema({ current_title: "Currently he is working as SAP FICO Lead +60 12-345 6789 at Employer" }).enterpriseProfile.identity.currentTitle, "SAP FICO Lead");

const isolatedFinanceModules = buildCanonicalCandidateSnapshot({
  id: "isolated-finance-modules", current_title: "ERP Project Manager", sap_modules: ["GL", "AP", "AR", "CO"],
});
assert.ok(["EXPOSURE", "UNVERIFIED"].includes(isolatedFinanceModules.domain_evidence.FICO), "isolated finance modules cannot prove FICO specialization");
const adjacentRole = buildCanonicalCandidateSnapshot({
  id: "adjacent-role", current_title: "Senior SAP ABAP Developer", sap_modules: ["ABAP", "FI"],
  raw_text: "Senior SAP ABAP Developer. FI interface exposure. Led implementation delivery.",
});
assert.ok(["EXPOSURE", "UNVERIFIED"].includes(adjacentRole.domain_evidence.FICO), "implementation and seniority cannot independently prove FICO specialization");
assert.equal(adjacentRole.domain_evidence.ABAP, "PRIMARY", "the generalized classifier must recognize unrelated domains with the same rules");

const recruiterSafeProjection = candidateSearchV2ProjectionDocument({
  candidate_id: "capability", display_name: "Valid Person", primary_module: "FICO", all_modules: ["FICO"],
  project_types: ["IMPLEMENTATION_EXPLICIT_SOURCE_TEXT_MENTION_ONLY", "AMS_EXPLICIT_SOURCE_TEXT_MENTION_ONLY"],
});
assert.equal(recruiterSafeProjection.skills?.some((item) => /EXPLICIT_SOURCE_TEXT|MENTION_ONLY/.test(item)), false);
assert.equal(recruiterSafeProjection.skills?.includes("Implementation"), false);

const trusted = (candidateId: string, values: string[]) => ({
  candidateId,
  values: values.map((value, index) => ({
    value,
    sourceType: index === 0 ? ("raw_title" as const) : ("raw_project" as const),
    sourceField: index === 0 ? "candidates.current_title" : "candidates.projects",
    sourceRecordId: candidateId,
    provenance: "candidate_record_raw" as const,
    trusted: true,
  })),
});
const implementationProject = (candidateId: string, excerpt: string) => [{
  projectId: `${candidateId}:implementation-1`,
  lifecycleType: "Implementation" as const,
  sourceType: "project" as const,
  sourceField: "projects.0",
  sourceRecordId: candidateId,
  excerpt,
  evidenceLevel: "verified" as const,
  modules: ["FICO"],
}];

const rankedDimensions = searchCandidatesV2([
  { candidateId: "complete", candidateName: "Complete Profile", currentTitle: "Senior SAP FICO Consultant", location: "Malaysia", country: "Malaysia", skills: ["FICO", "Implementation"], sapModules: ["FICO"], domainEvidence: { FICO: "PRIMARY" }, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "verified_structured_evidence", locationEvidenceState: "VERIFIED", trustedCandidateEvidence: trusted("complete", ["Senior SAP FICO Consultant", "SAP FICO implementation project"]), lifecycleEvidence: implementationProject("complete", "Delivered a grounded SAP FICO implementation project") },
  { candidateId: "weak-domain", candidateName: "Weak Domain", currentTitle: "Senior ERP Manager", location: "Malaysia", country: "Malaysia", skills: ["FICO", "Implementation"], sapModules: ["FICO"], domainEvidence: { FICO: "EXPOSURE" }, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "verified_structured_evidence", locationEvidenceState: "VERIFIED", trustedCandidateEvidence: trusted("weak-domain", ["Senior ERP Manager", "SAP FICO implementation exposure"]), lifecycleEvidence: implementationProject("weak-domain", "Participated in a grounded SAP FICO implementation assignment") },
  { candidateId: "missing-two", candidateName: "Partial Profile", currentTitle: "SAP FICO Consultant", location: "Malaysia", country: "Malaysia", skills: ["FICO"], sapModules: ["FICO"], domainEvidence: { FICO: "PRIMARY" }, implementationEvidenceLevel: "unverified", seniorityEvidenceLevel: "unverified", locationEvidenceState: "VERIFIED" },
], { query: "Senior SAP FICO Malaysia implementation", filters: { skills: ["SAP FICO", "Implementation"], sapModules: ["FICO"], countries: ["Malaysia"] } });
assert.equal(rankedDimensions.results[0].candidateId, "complete");
assert.ok(rankedDimensions.results[0].score.finalScore > rankedDimensions.results[1].score.finalScore);
assert.ok(rankedDimensions.results.find((item) => item.candidateId === "weak-domain")!.score.finalScore < 90, "Strong Match cannot contain a materially weak domain dimension");

const duplicateDocuments = [
  { candidateId: "source-a", canonicalCandidateId: "canonical-person", candidateName: "Wongyee Ching", currentTitle: "SAP FICO Consultant", sapModules: ["FICO"], skills: ["FICO"], location: "Malaysia", locationEvidenceState: "VERIFIED" as const, trustedCandidateEvidence: trusted("source-a", ["SAP FICO Consultant"]) },
  { candidateId: "source-b", canonicalCandidateId: "canonical-person", candidateName: "WONGYEE  CHING", currentTitle: "SAP FICO Consultant", sapModules: ["FICO"], skills: ["FICO"], location: "Malaysia", locationEvidenceState: "VERIFIED" as const, trustedCandidateEvidence: trusted("source-b", ["SAP FICO Consultant"]) },
  { candidateId: "source-c", candidateName: "Distinct Person", currentTitle: "SAP FICO Consultant", sapModules: ["FICO"], skills: ["FICO"], location: "Malaysia", locationEvidenceState: "VERIFIED" as const, trustedCandidateEvidence: trusted("source-c", ["SAP FICO Consultant"]) },
];
const duplicateResolution = dedupeCandidateSearchV2Documents(duplicateDocuments);
assert.equal(duplicateResolution.duplicateGroups, 1);
assert.equal(duplicateResolution.duplicateRowsCollapsed, 1);
const normalizedNameDuplicates = dedupeCandidateSearchV2Documents([
  { candidateId: "case-a", candidateName: "Azizul Anuar", currentTitle: "SAP Consultant", location: "Malaysia" },
  { candidateId: "case-b", candidateName: "  AZIZUL   ANUAR ", currentTitle: "SAP Consultant", location: "Malaysia" },
]);
assert.equal(normalizedNameDuplicates.uniqueCanonicalCandidates, 1, "case and spacing variants with corroborating identity signals must deduplicate");
assert.equal(candidateSearchV2ProjectionDocument({ candidate_id: "location-name", display_name: "Ho Chi Minh City", display_location: "Vietnam" }).candidateName, null, "location text must never render as a candidate name");
const pageOne = searchCandidatesV2(duplicateResolution.documents, { query: "SAP Consultant Malaysia", page: 1, pageSize: 1 });
const pageTwo = searchCandidatesV2(duplicateResolution.documents, { query: "SAP Consultant Malaysia", page: 2, pageSize: 1 });
assert.equal(new Set([...pageOne.results, ...pageTwo.results].map((result) => result.canonicalCandidateId)).size, 2, "canonical IDs must remain unique across pages");

assert.deepEqual(numberedSearchPages(3, 6), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(numberedSearchPages(4, 12), [1, 2, 3, 4, 5, "ellipsis", 12]);
const returnUrl = buildSearchReturnUrl({ query: "Senior SAP FICO Malaysia", countries: "Malaysia", skills: "Implementation", sapModules: "FI,CO", matchQuality: "relevant", page: 2 });
for (const value of ["q=Senior+SAP+FICO+Malaysia", "countries=Malaysia", "skills=Implementation", "modules=FI%2CCO", "quality=relevant", "page=2"]) assert.ok(returnUrl.includes(value));

const rich = adaptCandidateToSearchV2Document({
  id: "candidate-1", full_name: "Verified Person", location: "Malaysia",
  current_title: "Senior SAP FICO Consultant", current_company: "Evidence Ltd",
  work_experience: [
    { company: "Evidence Ltd", title: "Senior SAP FICO Consultant", start_date: "2020-01-01", end_date: "2026-01-01" },
    { company: "Earlier Ltd", title: "SAP Consultant", start_date: "2018-01-01", end_date: "2021-01-01" },
  ],
  sap_modules: ["FI", "CO"], raw_text: "stored source resume",
});
assert.equal(rich.currentEmployer, "Evidence Ltd");
assert.equal(rich.totalYearsExperience, 8);
assert.equal(rich.profileEvidence?.employmentHistory, true);

const suspicious = adaptCandidateToSearchV2Document({ id: "record-123456", name: "Green Channel Travel Services", location: "Malaysia" });
assert.equal(suspicious.candidateName, null, "non-person source labels must not render as names");
const labelledName = adaptCandidateToSearchV2Document({ id: "labelled-name", name: "Candidate profile pending validation", resume_text: "PERSONAL DETAILS Name : Lim Li Chyi Date of birth : 26 September 1980" });
assert.equal(labelledName.candidateName, "Lim Li Chyi", "supported resume identity must replace a placeholder name");
assert.equal(adaptCandidateToSearchV2Document({ id: "missing-name", name: "Candidate profile pending validation", resume_text: "SAP consultant profile" }).candidateName, null);

const context = { contextId: "ctx", candidateIds: ["a", "b", "c"], returnUrl, matchedByCandidate: {} };
assert.deepEqual(candidate360SearchPosition(context, "b"), { index: 1, total: 3, previousId: "a", nextId: "c" });
assert.equal(resolveCandidate360SearchContext(context, "b", "ctx")?.returnUrl, returnUrl);
assert.match(candidate360SearchHref("b", "ctx"), /candidate360-v2\/b\?from=search-v2&searchContext=ctx/);

const intent = parseRecruiterSearchIntent("Senior SAP FICO Malaysia");
const base = {
  score: { skillScore: 100, titleScore: 100, locationScore: 100, recencyScore: 0, finalScore: 95 },
  explanation: { matchedSkills: [], matchedSapModules: ["FI", "CO"], matchedTerms: [], missingSkills: [], warnings: [] },
  currentTitle: "Senior SAP FICO Consultant", location: "Malaysia", country: "Malaysia",
  verifiedSkills: [], verifiedSapModules: ["FICO", "FI", "CO"],
  seniorityEvidenceLevel: "verified_structured_evidence" as const,
  domainEvidence: { FICO: "PRIMARY" as const },
};
const sparseStrong = { ...base, profileEvidence: { name: true, title: true, employer: false, location: true, experienceDuration: false, employmentHistory: false, projectHistory: false, education: false, certifications: false, skills: true } };
assert.equal(recruiterMatchTier(sparseStrong, intent), "Strong Match");
assert.equal(recruiterProfileConfidence(sparseStrong), "limited", "match tier and completeness confidence must remain separate");
assert.equal(recruiterMatchTier({ ...base, score: { ...base.score, finalScore: 40 }, currentTitle: "Accountant", verifiedSapModules: ["FI"] }, intent), "Broad Match");

const malformedLanguage = normalizeActualCandidateSchema({
  id: "language-object",
  current_title: "1) Position: SAP FICO Consultant",
  languages: ["[object Object]"],
  resume_text: "Languages English, Bahasa Malaysia Profile SAP consultant",
});
assert.equal(malformedLanguage.enterpriseProfile.identity.currentTitle, "SAP FICO Consultant");
assert.deepEqual(malformedLanguage.enterpriseProfile.languages, [
  { language: "English", proficiency: "" },
  { language: "Bahasa Malaysia", proficiency: "" },
]);
assert.doesNotMatch(JSON.stringify(malformedLanguage), /\[object Object\]/);

for (const invalidIdentity of [
  "Kone Industry", "Pt. Emerio Indonesia", "Roll Out", "Global Rollout.",
  "Year Level Institution", "Kuibrahim Kumohamad Subject",
  "Samsol Awang o Roles as SAP FICO Lead", "Jingyin Yong Erpimplementation", "Robot Framework,", "Hobbies And",
  "Candidate Erpprojectmanager", "Candidate Associatemanagingconsultant",
]) {
  const normalized = normalizeActualCandidateSchema({ id: invalidIdentity, name: invalidIdentity });
  assert.equal(normalized.enterpriseProfile.identity.name, "", `${invalidIdentity} must not become a candidate identity`);
}

const resumeMapped = normalizeActualCandidateSchema({
  id: "resume-mapped",
  current_company: "Brightree Solutions Sdn Bhd",
  resume_text: "Career historySAP FICO Consultant at Brightree Solutions Sdn Bhd Feb 2011 - Jun 2011 (5 months) EducationBachelor of Computing from APIIT Finished 2007",
});
assert.equal(resumeMapped.enterpriseProfile.employmentTimeline.length, 1);
assert.equal(resumeMapped.enterpriseProfile.employmentTimeline[0].company, resumeMapped.enterpriseProfile.identity.currentCompany);
assert.equal(resumeMapped.enterpriseProfile.education.length, 1);
assert.equal(resumeMapped.enterpriseProfile.experienceSummary.totalCareerYears, 0.3);

const implementationIntent = parseRecruiterSearchIntent("Senior SAP FICO Malaysia implementation");
assert.equal(recruiterMatchTier({ ...base, score: { ...base.score, finalScore: 70 }, explanation: { ...base.explanation, missingSkills: ["Implementation"] } }, implementationIntent), "Potential Match");
assert.equal(recruiterCriticalGap({ ...base, explanation: { ...base.explanation, missingSkills: ["Implementation"] } }), "", "implementation must not be repeated as a second recruiter warning");
assert.equal(recruiterMatchTier({ ...base, score: { ...base.score, finalScore: 70 }, verifiedSkills: ["Implementation"] }, implementationIntent), "Potential Match", "generic skill text is not canonical delivery evidence");
assert.ok(recruiterCandidateEvidenceChips({ ...base, verifiedSkills: ["Implementation"], implementationEvidenceLevel: "source_text_evidence" }).includes("Implementation"), "supported implementation evidence may render as supported capability");
assert.equal(recruiterCandidateEvidenceChips({ ...base, verifiedSkills: ["Implementation"], implementationEvidenceLevel: "inferred_evidence" }).includes("Implementation"), false, "mention-only implementation must not render as a positive capability");
assert.equal(recruiterMatchTier({ ...base, verifiedSkills: ["Implementation"], implementationEvidenceCount: 1, implementationEvidenceLevel: "verified_structured_evidence" }, implementationIntent), "Strong Match");
assert.equal(recruiterCandidateEvidenceChips({ ...base, implementationEvidenceCount: 1, implementationEvidenceLevel: "verified_structured_evidence" }).includes("Implementation"), false, "unrequested implementation must not be injected without query-relevant evidence");
assert.equal(recruiterMatchTier({ ...base, score: { ...base.score, finalScore: 70 }, implementationEvidenceCount: 1, implementationEvidenceLevel: "verified_structured_evidence", seniorityEvidenceLevel: "unverified" }, implementationIntent), "Potential Match", "the canonical score must reflect a missing senior dimension");
assert.deepEqual(
  recruiterQueryStatements({ ...base, implementationEvidenceCount: 1, implementationEvidenceLevel: "verified_structured_evidence" }, implementationIntent).supported,
  ["SAP FICO title", "Malaysia", "Seniority role evidence", "Implementation verified"],
  "all four explicit query concepts must be explained",
);

const canonicalEmployment = normalizeActualCandidateSchema({
  id: "canonical-employment",
  current_company: "Supported Current Co",
  resume_text: [
    "Career history",
    "SAP FICO Consultant at Supported Current Co Jan 2022 - Present",
    "SAP FI Consultant at Previous Co Jun 2019 - Dec 2022",
  ].join(" "),
  implementation_project_count: 2,
  sap_modules: ["FI", "CO"],
}).enterpriseProfile;
assert.equal(canonicalEmployment.identity.currentCompany, "Supported Current Co");
assert.equal(canonicalEmployment.employmentTimeline.length, 2);
assert.ok(canonicalEmployment.experienceSummary.totalCareerYears);
assert.ok(canonicalEmployment.experienceSummary.currentEmployerTenureYears);
assert.ok(canonicalEmployment.experienceSummary.sapExperienceYears);
const canonicalSearch = adaptCandidateToSearchV2Document({
  id: "canonical-employment",
  current_company: "Supported Current Co",
  resume_text: "SAP FICO Consultant at Supported Current Co Jan 2022 - Present",
  implementation_project_count: 2,
  sap_modules: ["FI", "CO"],
});
assert.equal(canonicalSearch.currentEmployer, canonicalEmployment.identity.currentCompany);
assert.ok(canonicalSearch.skills?.includes("Implementation"));

const wongyeeShape = normalizeActualCandidateSchema({
  id: "wongyee-shape", full_name: "Wongyee Ching", current_company: "Brightree Solutions Sdn Bhd",
  resume_text: "SAP FICO Consultant at Brightree-NCG Group Jun 2011 - Present SAP FI Consultant at Prior Co Jan 2008 - May 2011",
  implementation_project_count: 7, ams_project_count: 13, rollout_project_count: 2,
}).enterpriseProfile;
assert.equal(wongyeeShape.identity.currentCompany, "Brightree-NCG Group");
assert.ok(wongyeeShape.experienceSummary.currentEmployerTenureYears);
const wongyeeSearch = adaptCandidateToSearchV2Document({ id: "wongyee-shape", full_name: "Wongyee Ching", current_company: "Brightree Solutions Sdn Bhd", resume_text: "SAP FICO Consultant at Brightree-NCG Group Jun 2011 - Present SAP FI Consultant at Prior Co Jan 2008 - May 2011", implementation_project_count: 7 });
assert.equal(wongyeeSearch.currentEmployer, wongyeeShape.identity.currentCompany);
assert.equal(wongyeeSearch.totalYearsExperience, wongyeeShape.experienceSummary.totalCareerYears);
assert.equal(wongyeeShape.projects.length, 0, "aggregate delivery counts must not synthesize project records");

console.log("searchCandidateCompleteness.test.ts passed");
