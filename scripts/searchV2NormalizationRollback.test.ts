import assert from "node:assert/strict";
import {
  canonicalizeEnterpriseProjects,
  normalizeActualCandidateSchema,
} from "../lib/candidate360SchemaNormalize";
import { validEmploymentTitle } from "../lib/candidate360Employment";
import { dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import { canonicalLifecycleEvidence, targetModuleDeliveryEvidence } from "../lib/searchV2Lifecycle";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

for (const invalid of [
  "com",
  "www",
  "or position held",
  "the implementation. I am actually the CO Consultant who handled all the product",
  "A passionate, dedicated and resourceful professional",
  "Results-oriented and chartered certified professional",
  "Highly skilled and results-oriented consultant",
]) assert.equal(validEmploymentTitle(invalid), "", `${invalid} is not a job title`);

const invalidTitle = normalizeActualCandidateSchema({
  id: "invalid-title",
  name: "Teck Chiewlim",
  current_title: "com",
  experience: [{ company: "Example Consulting", title: "com", start_date: "2004-01", end_date: "Present" }],
});
assert.equal(invalidTitle.enterpriseProfile.identity.currentTitle, "");
assert.equal(invalidTitle.enterpriseProfile.employmentTimeline.length, 0);
assert.equal(invalidTitle.enterpriseProfile.experienceSummary.totalCareerYears, null);

const labelledHistory = normalizeActualCandidateSchema({
  id: "labelled-history",
  name: "Weir Minerals March",
  raw_text: `WORKING EXPERIENCE
    Company Name : Mineral Systems March 2015 – Present Work Description Project : Finance Conversion Project Duration : March 2015 – Jan 2016 Role : SAP Data Consultant (Business Analyst) Responsible for FI/CO migration.
    Company Name : Evidence Consulting Nov 2013 – Oct 2014 Work Description Client : Utility Client Project : SAP Implementation Project Duration : Nov 2013 – Oct 2014 Role : SAP FICO & PS Data Migration Consultant Delivered FI/CO conversion.
    Company Name : Technology Services May 2013 – Nov 2013 Work Description Client : Energy Client Project Duration : May 2013 – Nov 2013 Role : Application Support Analyst (SAP BW) Handled application support.`,
});
assert.deepEqual(labelledHistory.enterpriseProfile.employmentTimeline.map((item) => [item.company, item.title]), [
  ["Mineral Systems", "SAP Data Consultant (Business Analyst)"],
  ["Evidence Consulting", "SAP FICO & PS Data Migration Consultant"],
  ["Technology Services", "Application Support Analyst (SAP BW)"],
]);
assert.equal(labelledHistory.enterpriseProfile.employmentTimeline.some((item) => item.company === "Utility Client"), false);

const labelledVariants = normalizeActualCandidateSchema({
  id: "labelled-variants",
  raw_text: `Working Experience Company Name: Enterprise ICT Sdn Bhd From / To : May 2009 – Present Position Title: Senior SAP Consultant / Solution Architect Responsibilities: Supported enterprise applications.
  WORKING EXPERIENCES July 2021 - Current Company Name: Distribution Services SDN BHD Position SPECIALIST, SAP BUSINESS PI/PO and SAP ABAP Responsibilities: Delivered integration support.`,
}).enterpriseProfile.employmentTimeline;
assert.deepEqual(labelledVariants.map((item) => [item.company, item.title]), [
  ["Distribution Services SDN BHD", "SPECIALIST, SAP BUSINESS PI/PO and SAP ABAP"],
  ["Enterprise ICT Sdn Bhd", "Senior SAP Consultant / Solution Architect"],
]);

for (const raw_text of [
  "PROFILE Experienced SAP professional who supported implementation programmes.",
  "PROFESSIONAL SUMMARY Senior SAP consultant with over 20 years supporting projects.",
  "TECHNICAL SKILLS SAP Modules: FI-GL, FI-AP, FI-AR; implementation and support.",
  "Worked in full life cycle implementation, rollout, support and upgrade projects.",
]) {
  const profile = normalizeActualCandidateSchema({ id: raw_text.slice(0, 12), skills: ["SAP FICO"], raw_text }).enterpriseProfile;
  assert.equal(profile.projects.length, 0, "summary, skill and generic lifecycle prose is not a canonical project");
  const diagnostic = targetModuleDeliveryEvidence({ lifecycleEvidence: canonicalLifecycleEvidence("fixture", profile.projects) }, "FICO");
  assert.equal(diagnostic.directTargetAssignments.length, 0, "candidate-level FICO cannot manufacture assignment delivery");
}

const duplicateProjects = normalizeActualCandidateSchema({
  id: "duplicate-project-fragments",
  projects: [
    { id: "structured-one", client: "Food Client", project_name: "New GL", role: "SAP FICO Lead", start_date: "2020-01", end_date: "2020-09", project_type: "Migration", responsibilities: ["Led FI migration and cutover"] },
    { id: "descriptive-one", customer: "Food Client", name: "New GL", position: "SAP FICO Lead", from: "2020-01", to: "2020-09", type: "Migration", description: "Led FI migration and cutover with reconciliation" },
  ],
}).enterpriseProfile.projects;
assert.equal(duplicateProjects.length, 1);
assert.equal(duplicateProjects[0].sourceAssignmentIds?.length, 2);

const acronymFragments = normalizeActualCandidateSchema({
  id: "acronym-fragments",
  projects: [
    { id: "jlr-short", client: "Project JLRM Retail", description: "SAP FICO support for Jaguar Land Rover Malaysia" },
    { id: "jlr-full", client: "Jaguar Land Rover Malaysia Sdn Bhd", role: "SAP FICO Consultant", start_date: "2020", end_date: "2021", description: "Delivered SAP FICO production support" },
  ],
}).enterpriseProfile.projects;
assert.equal(acronymFragments.length, 1, "a sparse acronym fragment merges into its grounded client assignment");
assert.equal(acronymFragments[0].sourceAssignmentIds?.length, 2);

const person = (candidateId: string, overrides: Partial<CandidateSearchV2Document> = {}): CandidateSearchV2Document => ({
  candidateId,
  candidateName: "Shared Person",
  currentTitle: "Senior FICO Consultant",
  location: "Malaysia",
  skills: [], sapModules: [], languages: [], industries: [], projectTypes: [],
  searchableText: "", profileEvidence: {},
  identitySignals: {
    sourceProfileId: candidateId,
    normalizedName: "shared person",
    title: "senior fico consultant",
    location: "malaysia",
    documentEvidenceKeys: ["source-a", "source-b", "source-c"],
  },
  ...overrides,
} as CandidateSearchV2Document);

const limLike = dedupeCandidateSearchV2Documents([
  person("lim-source-one", { candidateName: "Lim Li Chyi" }),
  person("lim-source-two", { candidateName: "Lim Li Chyi", identitySignals: { sourceProfileId: "lim-source-two", title: "senior fico consultant", location: "malaysia", documentEvidenceKeys: ["source-b", "source-c", "source-d"] } }),
]);
assert.equal(limLike.documents.length, 1);
assert.deepEqual(limLike.documents[0].sourceCandidateIds, ["lim-source-one", "lim-source-two"]);

const mdLike = dedupeCandidateSearchV2Documents([
  person("md-source-one", { candidateName: "Md Husaimi Abd Wahab", identitySignals: { sourceProfileId: "md-source-one", sourceDocumentHash: "md-shared-cv" } }),
  person("md-source-two", { candidateName: "Md Husaimi Abd Wahab", identitySignals: { sourceProfileId: "md-source-two", sourceDocumentHash: "md-shared-cv" } }),
]);
assert.equal(mdLike.documents.length, 1, "stable source-document identity collapses the duplicate search person");

const documentLinked = dedupeCandidateSearchV2Documents([
  person("document-source-one", { candidateName: "Profile Pending", identitySignals: { sourceProfileId: "document-source-one", sourceDocumentHash: "same-cv" } }),
  person("document-source-two", { candidateName: "Resolved Person", identitySignals: { sourceProfileId: "document-source-two", sourceDocumentHash: "same-cv" } }),
]);
assert.equal(documentLinked.documents.length, 1, "a stable source-document relationship merges records despite extraction differences");

const sameNameDifferentPeople = dedupeCandidateSearchV2Documents([
  person("distinct-one", { candidateName: "MICAELA JOYCE OLEDAN", identitySignals: { sourceProfileId: "distinct-one", title: "senior fico consultant", location: "malaysia", documentEvidenceKeys: ["document-one"] } }),
  person("distinct-two", { candidateName: "MICAELA JOYCE OLEDAN", identitySignals: { sourceProfileId: "distinct-two", title: "senior fico consultant", location: "malaysia", documentEvidenceKeys: ["document-two"] } }),
]);
assert.equal(sameNameDifferentPeople.documents.length, 2, "name, title and location alone do not merge people");

assert.equal(canonicalizeEnterpriseProjects(duplicateProjects).length, 1);
console.log("Search V2 normalization rollback regressions passed.");
