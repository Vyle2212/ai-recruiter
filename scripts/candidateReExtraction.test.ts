import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { auditCandidateReExtraction, buildCandidateReExtractionSummary, reExtractCandidate } from "../lib/candidateReExtractionEngine";
import { writeCandidateReExtractionReview, CANDIDATE_REEXTRACTION_REVIEW_PATH } from "./exportCandidateReExtractionReview";

const rawCv = `
Muhammad Wasim Qureshi
Email: wasim.qureshi@example.com Mobile: +60 12 345 6789
Kuala Lumpur, Malaysia
SAP FICO Consultant with 12 years experience in S/4HANA, ECC, Fiori, IDoc, BAPI, data migration and cutover.
Expected Salary: MYR 8000+ monthly
Work Experience
Jan 2022 - Present Current Co SAP FICO Consultant implementation rollout AMS support S/4HANA
Feb 2018 - Dec 2021 Previous Co SAP FI/CO Analyst migration upgrade ECC UAT SIT
Education
Bachelor of Information Technology
`;

const candidate = {
  id: "reextract-1",
  name: "Candidate profile pending validation",
  current_title: "Professional summary with more than twelve years responsible for implementation cycles and stakeholder management",
  current_company: "in the domain of Cloud and SAP",
  primary_module: "UNKNOWN",
  location: "",
  raw_text: rawCv,
  updated_at: "2026-06-10T00:00:00.000Z",
};

const suggestion = reExtractCandidate(candidate);
assert.equal(suggestion.suggested.displayName, "Muhammad Wasim Qureshi", "real name from CV header is extracted");
assert.notEqual(suggestion.suggested.displayName, "Candidate profile pending validation", "placeholder name is rejected");
assert.equal(suggestion.suggested.currentCompany, "Current Co", "current employer is extracted from latest date range");
assert.equal(suggestion.suggested.previousCompany, "Previous Co", "previous employer is extracted from second date range");
assert.equal(suggestion.suggested.currentEmployerStartDate, "Jan 2022", "current employer start date is extracted");
assert.equal(suggestion.suggested.currentEmployerEndDate, "Present", "current employer end date is extracted");
assert.equal(Boolean(suggestion.suggested.currentEmployerDuration), true, "current employer duration is formatted when date range exists");
assert.equal(suggestion.suggested.previousEmployerStartDate, "Feb 2018", "previous employer start date is extracted");
assert.equal(suggestion.suggested.previousEmployerEndDate, "Dec 2021", "previous employer end date is extracted");
assert.equal(suggestion.suggested.currentTitle, "SAP FICO Consultant", "current title is extracted from latest experience and long summary title is rejected");
assert.equal(suggestion.suggested.sapModules.includes("FICO"), true, "SAP module is extracted from resume body");
assert.equal(suggestion.suggested.sapSkills.includes("S/4HANA"), true, "SAP S/4HANA skill is extracted");
assert.equal(suggestion.suggested.sapSkills.includes("IDoc"), true, "SAP technical skill is extracted");
assert.equal(suggestion.suggested.sapProjectTypes.includes("implementation"), true, "implementation project type is extracted");
assert.equal(suggestion.suggested.sapProjectTypes.includes("migration"), true, "migration project type is extracted");
assert.equal(suggestion.suggested.totalYearsExperience, "12", "total years experience is parsed when available");
assert.equal(suggestion.suggested.expectedSalary, "MYR 8000+ monthly", "expected salary is parsed when available");
assert.equal(suggestion.confidence.name >= 90, true, "name confidence should be high for resume header");
assert.equal(suggestion.confidence.modules >= 80, true, "module confidence should be high when SAP tokens are found");


const labelledName = reExtractCandidate({
  id: "labelled-name",
  name: "Candidate profile pending validation",
  raw_text: "Name: Fakhrin bin Mohd Ramli Telephone: 0123456789\nSAP MM Consultant\nEmail: fakhrin@example.com",
});
assert.equal(labelledName.suggested.displayName, "Fakhrin bin Mohd Ramli", "contact labels are stripped from parsed identity names");

const dateOnlyPhone = reExtractCandidate({
  id: "date-phone",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nSAP MM Consultant\nJan 2020 - Present Consulting Co SAP MM Consultant\nFeb 2018 - Dec 2021 Previous Co SAP FI/CO Analyst",
});
assert.equal(dateOnlyPhone.suggested.phone, "", "date ranges are not extracted as phone numbers");
const noSalary = reExtractCandidate({ id: "no-salary", name: "Jane Fruelda", raw_text: "Jane Fruelda\nSAP MM Consultant\nEmail: jane@example.com\nJan 2020 - Present Consulting Co SAP MM Consultant support rollout" });
assert.equal(noSalary.suggested.expectedSalary, "", "expected salary is parsed only when available");


const invalidCompanyFragments = [
  "SAP ECC (MM, P2P, PP, MDM),",
  "Data Enablement",
  "Administered",
  "Malaysia as an SAP Technical Manager from",
];
for (const fragment of invalidCompanyFragments) {
  const invalid = reExtractCandidate({
    id: `invalid-company-${fragment}`,
    name: "Jane Fruelda",
    current_company: fragment,
    current_title: "SAP FICO Consultant",
    primary_module: "FICO",
    email: "jane@example.com",
    country: "Malaysia",
    raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur, Malaysia\nSAP FICO Consultant with S/4HANA implementation experience\nJan 2021 - Present ${fragment} SAP FICO Consultant`,
  });
  assert.equal(invalid.suggested.currentCompany, "Not disclosed", `${fragment} is rejected as company`);
  assert.equal(invalid.auditFlags.invalidCompanySuggestionsRejected > 0, true, `${fragment} has company reject reason`);
}


const osramEmployer = reExtractCandidate({
  id: "osram-employer",
  name: "Ashok Kumar P",
  raw_text: "Ashok Kumar P\nEmail: ashok@example.com\nSAP EWM Consultant\nApril 2021 - September 2023 Osram Opto Semiconductors Malaysia SDN BHD. Duration :: April 2021 - September SAP EWM Consultant\nS/4HANA support rollout",
});
assert.equal(osramEmployer.suggested.currentCompany, "Osram Opto Semiconductors Malaysia SDN BHD", "extracts employer from line with Duration");
assert.equal(osramEmployer.auditFlags.employerLinesSanitized > 0, true, "sanitized employer lines are counted");

const cognizantEmployer = reExtractCandidate({
  id: "cognizant-employer",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP SD Consultant\nJan 2020 - Present Cognizant Technologies, Bangalore SAP SD Consultant\nS/4HANA implementation",
});
assert.equal(cognizantEmployer.suggested.currentCompany, "Cognizant Technologies", "extracts employer and trims trailing city");

const wiproEmployer = reExtractCandidate({
  id: "wipro-employer",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP FICO Consultant\nJuly 2015 - Present Wipro Technologies Hyderabad from July 13th 2015 to SAP FICO Consultant\nECC support",
});
assert.equal(wiproEmployer.suggested.currentCompany, "Wipro Technologies", "extracts employer before date text");

const notDisclosedSearchable = reExtractCandidate({
  id: "not-disclosed-searchable",
  name: "Jane Fruelda",
  current_title: "SAP FICO Consultant",
  primary_module: "FICO",
  email: "jane@example.com",
  country: "Malaysia",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur, Malaysia\nSAP FICO Consultant\nS/4HANA implementation data migration cutover",
});
assert.equal(notDisclosedSearchable.suggested.currentCompany, "Not disclosed", "company may remain Not disclosed");
assert.equal(notDisclosedSearchable.couldBecomeSearchableAfterReExtraction, true, "searchableAfter=true with Not disclosed company when other critical fields are clean");
const dedupePrevious = reExtractCandidate({
  id: "dedupe-previous",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP FICO Consultant\nJan 2022 - Present Deloitte SAP FICO Consultant\nJan 2022 - Present Deloitte SAP FICO Consultant",
});
assert.equal(dedupePrevious.suggested.previousCompany, "", "previousCompany is not copied from currentCompany for duplicate role evidence");
assert.equal(dedupePrevious.auditFlags.previousCompanyDeduplicated, true, "previous company duplicate is counted");

const strongerTitle = reExtractCandidate({
  id: "stronger-title",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nFunctional Consultant\nJan 2021 - Present Deloitte SAP FICO Consultant\nSAP MM Consultant support rollout",
});
assert.equal(strongerTitle.suggested.currentTitle, "SAP FICO Consultant", "SAP FICO Consultant is preferred over Functional Consultant");


const twoDistinctEmployers = reExtractCandidate({
  id: "two-distinct-employers",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP FICO Consultant\nJan 2022 - Present Deloitte SAP FICO Consultant\nFeb 2018 - Dec 2021 Wipro Technologies SAP FICO Consultant\nS/4HANA support migration",
});
assert.equal(twoDistinctEmployers.suggested.currentCompany, "Deloitte", "currentCompany is most recent employer");
assert.equal(twoDistinctEmployers.suggested.previousCompany, "Wipro Technologies", "previousCompany is second distinct employer");
assert.notEqual(twoDistinctEmployers.suggested.currentCompany, twoDistinctEmployers.suggested.previousCompany, "currentCompany and previousCompany are not identical");

const sameEmployerDifferentDates = reExtractCandidate({
  id: "same-employer-different-dates",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP FICO Consultant\nJan 2022 - Present Deloitte SAP FICO Consultant\nFeb 2018 - Dec 2021 Deloitte SAP FICO Analyst\nS/4HANA support migration",
});
assert.equal(sameEmployerDifferentDates.suggested.previousCompany, "", "same employer with different dates does not populate previousCompany");

const deletedCandidate = reExtractCandidate({
  id: "deleted-candidate",
  name: "Jane Fruelda",
  status: "deleted",
  current_title: "SAP FICO Consultant",
  primary_module: "FICO",
  email: "jane@example.com",
  country: "Malaysia",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur, Malaysia\nSAP FICO Consultant\nS/4HANA implementation data migration",
});
assert.equal(deletedCandidate.couldBecomeSearchableAfterReExtraction, false, "deleted status stays not searchableAfter");
assert.equal(deletedCandidate.whyBlockedAfterReExtraction.includes("blocked_status"), true, "deleted status has block reason");

const placeholderCandidate = reExtractCandidate({
  id: "placeholder-candidate",
  name: "Candidate profile pending validation",
  current_title: "SAP FICO Consultant",
  primary_module: "FICO",
  email: "placeholder@example.com",
  country: "Malaysia",
  raw_text: "Candidate profile pending validation\nEmail: placeholder@example.com\nKuala Lumpur, Malaysia\nSAP FICO Consultant\nS/4HANA implementation data migration",
});
assert.equal(placeholderCandidate.couldBecomeSearchableAfterReExtraction, false, "placeholder name blocks searchableAfter");
assert.equal(placeholderCandidate.whyBlockedAfterReExtraction.includes("invalid_or_placeholder_name"), true, "placeholder block reason is reported");
const invalidCompanySearchable = reExtractCandidate({
  id: "invalid-company-searchable",
  name: "Jane Fruelda",
  current_company: "Data Enablement",
  current_title: "SAP FICO Consultant",
  primary_module: "FICO",
  email: "jane@example.com",
  country: "Malaysia",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur, Malaysia\nSAP FICO Consultant\nS/4HANA implementation data migration",
});
assert.equal(invalidCompanySearchable.couldBecomeSearchableAfterReExtraction, false, "searchableAfter=false when company is an invalid fragment");

const cleanSearchable = reExtractCandidate({
  id: "clean-searchable",
  name: "Jane Fruelda",
  current_title: "SAP FICO Consultant",
  primary_module: "FICO",
  email: "jane@example.com",
  phone: "+60 12 345 6789",
  country: "Malaysia",
  raw_text: "Jane Fruelda\nEmail: jane@example.com Mobile: +60 12 345 6789\nKuala Lumpur, Malaysia\nSAP FICO Consultant\nJan 2021 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation data migration",
});
assert.equal(cleanSearchable.couldBecomeSearchableAfterReExtraction, true, "searchableAfter=true for clean name/title/module/contact/location and valid company");
assert.equal(cleanSearchable.sources.titleSource.length > 0, true, "title source label is present");
assert.equal(cleanSearchable.sources.moduleSource, "resume_module_tokens", "module source label is present");
const durationSuffixEmployer = reExtractCandidate({
  id: "duration-suffix-employer",
  name: "Jane Fruelda",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP EWM Consultant\nApril 2021 - September 2023 Organization:: Osram Opto Semiconductors Malaysia SDN BHD. Duration :: April 2021 - September SAP EWM Consultant\nJan 2019 - Mar 2021 Wipro Technologies SAP EWM Consultant\nS/4HANA support",
});
assert.equal(durationSuffixEmployer.suggested.currentCompany, "Osram Opto Semiconductors Malaysia SDN BHD", "Duration suffix is removed from employer");
const educationCompanyFragment = reExtractCandidate({
  id: "education-company-fragment",
  name: "Jane Fruelda",
  current_title: "SAP FICO Consultant",
  primary_module: "FICO",
  email: "jane@example.com",
  country: "Malaysia",
  raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP FICO Consultant\nJan 2020 - Present Bachelor of Science in Information Technology SAP FICO Consultant\nS/4HANA support migration",
});
assert.equal(educationCompanyFragment.suggested.currentCompany, "Not disclosed", "education text is rejected as employer");
const audit = auditCandidateReExtraction([candidate, noSalary]);
assert.equal(audit.totalCandidatesAudited, 2, "audit counts total candidates");
assert.equal(audit.candidatesWithRawCvText >= 1, true, "audit counts raw CV/resume text availability");
assert.equal(audit.candidatesSuccessfullyReExtracted >= 1, true, "audit counts successful re-extractions");
assert.equal(typeof audit.topMissingFieldsRecovered, "object", "audit includes recovered field counts");
assert.equal(audit.potentialSearchableCountAfterReExtraction, audit.currentSearchableCount + audit.newlyRecoverableNotCurrentlySearchableCount, "potential count includes current searchable plus newly recoverable");
assert.equal(typeof audit.stillBlockedAfterReExtractionCount, "number", "audit includes still blocked count");

const syntheticSummary = buildCandidateReExtractionSummary([
  { candidateId: "current-1", currentSearchable: true, couldBecomeSearchableAfterReExtraction: false, hasRawCvText: true, recoveredFields: ["city"], likelySapProfileRecovered: true },
  { candidateId: "current-2", currentSearchable: true, couldBecomeSearchableAfterReExtraction: false, hasRawCvText: true, recoveredFields: [], likelySapProfileRecovered: true },
  { candidateId: "newly-recoverable", currentSearchable: false, couldBecomeSearchableAfterReExtraction: true, hasRawCvText: true, recoveredFields: ["displayName"], likelySapProfileRecovered: true },
  { candidateId: "still-blocked", currentSearchable: false, couldBecomeSearchableAfterReExtraction: false, hasRawCvText: false, recoveredFields: [], likelySapProfileRecovered: false },
] as any);
assert.equal(syntheticSummary.totalCandidates, 4, "summary counts total candidates");
assert.equal(syntheticSummary.currentlySearchable, 2, "summary counts current searchable candidates");
assert.equal(syntheticSummary.candidatesThatCouldBecomeSearchableAfterReExtraction, 1, "summary counts searchableAfter=true candidates");
assert.equal(syntheticSummary.newlyRecoverableNotCurrentlySearchable, 1, "summary counts newly recoverable candidates");
assert.equal(syntheticSummary.stillBlockedAfterReExtraction, 1, "summary counts still blocked candidates");
assert.equal(syntheticSummary.potentialSearchableAfterReExtraction, 3, "potential count is current searchable plus newly recoverable");
assert.notEqual(syntheticSummary.candidatesThatCouldBecomeSearchableAfterReExtraction, syntheticSummary.potentialSearchableAfterReExtraction, "searchableAfter and potential counts are intentionally distinct concepts");
const reportPath = path.join(process.cwd(), "reports", "candidate-reextraction-review.test.json");
const exported = writeCandidateReExtractionReview([candidate], reportPath);
assert.equal(exported.mode, "read-only", "export is read-only");
assert.equal(exported.items.length, 1, "export includes items");
assert.deepEqual(exported.summary, auditCandidateReExtraction([candidate]).summary, "export summary matches audit summary helper");

assert.equal(CANDIDATE_REEXTRACTION_REVIEW_PATH, path.join("reports", "candidate-reextraction-review.json"), "report path is stable");
if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

const auditSource = fs.readFileSync(new URL("./auditCandidateReExtraction.ts", import.meta.url), "utf8");
const exportSource = fs.readFileSync(new URL("./exportCandidateReExtractionReview.ts", import.meta.url), "utf8");
for (const source of [auditSource, exportSource]) {
  assert.equal(source.includes(".update("), false, "no DB update behavior");
  assert.equal(source.includes(".insert("), false, "no DB insert behavior");
  assert.equal(source.includes(".delete("), false, "no DB delete behavior");
}

console.log("Candidate re-extraction tests passed");
