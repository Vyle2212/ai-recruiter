import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { auditFullCandidateExtraction, extractFullCandidateProfile } from "../lib/fullCandidateExtractionEngine";
import { writeFullCandidateExtractionReport, FULL_CANDIDATE_EXTRACTION_PATH } from "./exportFullCandidateExtraction";
import { auditBatchUploadExtractionSimulation } from "../lib/batchUploadExtractionSimulator";

function cv(overrides: Record<string, any> = {}) {
  return {
    id: "candidate-1",
    name: "Name Charlie A.J",
    current_title: "SAP Consultant",
    email: "charlie@example.com",
    phone: "+60 12 345 6789",
    country: "Malaysia",
    raw_text: `Name Charlie A.J
Email: charlie@example.com Mobile: +60 12 345 6789
Kuala Lumpur, Malaysia
SAP FICO Consultant
Jan 2022 - Present Osram Opto Semiconductors Malaysia SDN BHD SAP FICO Consultant
Client Name Yash Technologies
S/4HANA implementation data migration UAT SIT WRICEF BAPI
Expected Salary MYR 8,000 monthly
Notice period: 1 month`,
    ...overrides,
  };
}

const validName = extractFullCandidateProfile(cv());
assert.equal(validName.extractedFullName, "Charlie A.J", "Name Charlie A.J extracts clean person name");
assert.equal(validName.isNameSuspicious, false, "valid extracted name is not suspicious");

const treesa = extractFullCandidateProfile(cv({ id: "treesa", name: "Name TREESA MARY GEORGE", raw_text: "Name TREESA MARY GEORGE\nEmail: treesa@example.com\nSingapore\nSAP SD Consultant\nS/4HANA support" }));
assert.equal(treesa.extractedFullName, "TREESA MARY GEORGE", "uppercase Name prefix is stripped");

const cha = extractFullCandidateProfile(cv({ id: "cha", name: "Cha Hui Fung-ep Pm", raw_text: "Cha Hui Fung-ep Pm\nEmail: cha@example.com\nKuala Lumpur Malaysia\nSAP Basis Consultant\nS/4HANA support" }));
assert.equal(cha.extractedFullName, "Cha Hui Fung", "role/module suffix is cleaned from name");

for (const badName of ["Candidate profile pending validation", "Robot Framework", "Pp Erp Benjamin", "SAP Consultant"]) {
  const item = extractFullCandidateProfile(cv({ id: `bad-${badName}`, name: badName, raw_text: `${badName}\nEmail: bad@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills` }));
  assert.equal(item.isNameSuspicious, true, `${badName} is rejected as person name`);
  assert.equal(item.reviewClassification, "blocked_identity", `${badName} blocks identity`);
}

const profileUnderReviewRecovered = extractFullCandidateProfile(cv({ id: "profile-under-review-recovered", name: "Profile Under Review", raw_text: "Name: Priya Raman\nEmail: priya.raman@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across multiple rollout and support engagements" }));
assert.equal(profileUnderReviewRecovered.extractedFullName, "Priya Raman", "Profile Under Review can recover labelled real name from raw CV");
assert.equal(profileUnderReviewRecovered.identityRecoveryBucket, "recovered_from_labelled_name", "labelled recovery bucket is reported");
assert.equal(profileUnderReviewRecovered.reviewClassification, "search_ready_after_extraction", "clean recovered identity can become search ready");

for (const badName of ["Profile Under Review", "Personal Particulars", "Monitoring Compliance.", "Robot Framework", "Linhtongbp Ueh", "Fi Ar Asset Abdul", "Pp Erp Benjamin"]) {
  const item = extractFullCandidateProfile(cv({ id: `identity-reject-${badName}`, name: badName, raw_text: `${badName}\nEmail: reject@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills` }));
  assert.equal(item.reviewClassification, "blocked_identity", `${badName} remains blocked identity without strong name evidence`);
  assert.equal(item.identityRecoveryAttempted, true, `${badName} records identity recovery attempt`);
}

const amsSupported = extractFullCandidateProfile(cv({ id: "ams-supported", name: "Ams Ph Bianca Dominique", raw_text: "Name: Ams Ph Bianca Dominique\nEmail: bianca.dominique@example.com\nManila Philippines\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across multiple rollout and support engagements" }));
assert.equal(amsSupported.extractedFullName, "Bianca Dominique", "Ams Ph prefix is removed with labelled/email support");
assert.equal(amsSupported.isNameSuspicious, false, "supported AMS name is accepted");

const amsUnsupported = extractFullCandidateProfile(cv({ id: "ams-unsupported", name: "Ams Ph Bianca Dominique", raw_text: "Ams Ph Bianca Dominique\nEmail: unrelated@example.com\nManila Philippines\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across multiple rollout and support engagements" }));
assert.equal(amsUnsupported.reviewClassification, "blocked_identity", "Ams Ph name is rejected without supporting evidence");

const amsMySupported = extractFullCandidateProfile(cv({ id: "ams-my-supported", name: "Ams My Lee Wah Ken", raw_text: "Name: Ams My Lee Wah Ken\nEmail: lee.wah.ken@example.com\nKuala Lumpur Malaysia\nSAP MM Consultant\nWork Experience Jan 2022 - Present Deloitte SAP MM Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across multiple rollout and support engagements" }));
assert.equal(amsMySupported.extractedFullName, "Lee Wah Ken", "Ams My prefix is removed with labelled/email support");

const labelledLinhtong = extractFullCandidateProfile(cv({ id: "labelled-linhtong", name: "Linhtongbp Ueh", raw_text: "Full Name: Linhtongbp Ueh\nEmail: linhtongbp.ueh@example.com\nVietnam\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across multiple rollout and support engagements" }));
assert.equal(labelledLinhtong.extractedFullName, "Linhtongbp Ueh", "Linhtongbp Ueh is accepted only when labelled Full Name evidence exists");

const vietnameseName = extractFullCandidateProfile(cv({ id: "vn-name", name: "Candidate profile pending validation", raw_text: "Nguyen Minh Thu\nEmail: thu.nguyen@example.com\nHo Chi Minh Vietnam\nSAP SD Consultant\nWork Experience Jan 2022 - Present Deloitte SAP SD Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across multiple rollout and support engagements" }));
assert.equal(vietnameseName.extractedFullName, "Nguyen Minh Thu", "Vietnamese name accepted from header");

const externalStakeholders = extractFullCandidateProfile(cv({ id: "external-stakeholders", name: "External Stakeholders.", raw_text: "External Stakeholders.\nEmail: stakeholder@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills" }));
assert.equal(externalStakeholders.reviewClassification, "blocked_identity", "External Stakeholders remains rejected as identity");

const compressedFullName = extractFullCandidateProfile(cv({ id: "compressed-fullname", name: "Candidate profile pending validation", raw_text: "FullName:TranQuocTrieuDateofbirth:18/11/1992 Nationality:VietNamGender:Male\nEmail: tran.quoc.trieu@example.com\nHo Chi Minh Vietnam\nSAP ABAP Consultant\nWork Experience Jan 2022 - Present Deloitte SAP ABAP Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP technical implementation responsibilities" }));
assert.equal(compressedFullName.extractedFullName, "Tran Quoc Trieu", "compressed FullName recovers spaced candidate name");
assert.equal(compressedFullName.identityRecoveryFinalDecision, "recovered_high_confidence", "compressed FullName is high confidence evidence");

const fiArLabelled = extractFullCandidateProfile(cv({ id: "fi-ar-labelled", name: "Fi Ar Asset Abdul", raw_text: "Full Name: Abdul Rahman\nEmail: abdul.rahman@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities" }));
assert.equal(fiArLabelled.extractedFullName, "Abdul Rahman", "Fi Ar Asset source-prefix name can recover only from Full Name evidence");

const ppErpLabelled = extractFullCandidateProfile(cv({ id: "pp-erp-labelled", name: "Pp Erp Benjamin", raw_text: "Full Name: Benjamin Tan\nEmail: benjamin.tan@example.com\nSingapore\nSAP PP Consultant\nWork Experience Jan 2022 - Present Deloitte SAP PP Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP manufacturing implementation responsibilities" }));
assert.equal(ppErpLabelled.extractedFullName, "Benjamin Tan", "Pp Erp source-prefix name can recover only from Full Name evidence");

const emailOnlyPossible = extractFullCandidateProfile(cv({ id: "email-only-possible", name: "", email: "", phone: "", raw_text: "Email: john.doe@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities across rollout, support, testing, configuration, and hypercare" }));
assert.equal(emailOnlyPossible.possibleNameCandidates.includes("John Doe"), true, "email first.last creates possibleName candidate");
assert.notEqual(emailOnlyPossible.reviewClassification, "search_ready_after_extraction", "email-only possible name does not become search ready");
assert.equal(emailOnlyPossible.identityRecoveryFinalDecision, "recovered_medium_confidence_review_only", "email-only name remains review-only");

const contactBlockName = extractFullCandidateProfile(cv({ id: "contact-block-name", name: "Profile Under Review", raw_text: "Contact Details\nPriya Raman\nEmail: priya.raman@example.com\nPhone: +60 12 222 3333\nKuala Lumpur Malaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities" }));
assert.equal(contactBlockName.extractedFullName, "Priya Raman", "valid name near email/phone in top CV section is recovered");
assert.equal(contactBlockName.identityRecoveryFinalDecision, "recovered_high_confidence", "contact-block recovery is high confidence");
const ewmTitle = extractFullCandidateProfile(cv({ id: "ewm-title", current_title: "SAP Functional Consultant", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP Functional Consultant EWM implementation S/4HANA" }));
assert.equal(ewmTitle.extractedCurrentTitle, "SAP EWM Consultant", "SAP Functional Consultant + EWM evidence is enriched");

const managerNoSap = extractFullCandidateProfile(cv({ id: "manager", name: "Jane Fruelda", current_title: "Manager", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nManager delivery operations" }));
assert.equal(managerNoSap.isTitleSuspicious, true, "generic Manager without SAP context is rejected");

const appDev = extractFullCandidateProfile(cv({ id: "app-dev", name: "Jane Fruelda", current_title: "Application Development Analyst", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nApplication Development Analyst\nABAP BAPI BADI OData CDS IDoc implementation" }));
assert.equal(appDev.extractedCurrentTitle, "SAP ABAP Consultant", "Application Development Analyst + ABAP evidence becomes SAP ABAP Consultant");

for (const company of ["Osram Opto Semiconductors Malaysia SDN BHD", "DXC Technologies", "TDI APJ Vietnam Co., Ltd"]) {
  const item = extractFullCandidateProfile(cv({ id: `company-${company}`, name: "Jane Fruelda", raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nJan 2023 - Present ${company} SAP FICO Consultant\nS/4HANA implementation` }));
  assert.equal(item.extractedCurrentCompany, company, `${company} accepted as employer`);
}

for (const company of ["by achieving 2nd", "form requirements Analyzed and designed new solutions", "Client Name Yash Technologies"]) {
  const item = extractFullCandidateProfile(cv({ id: `bad-company-${company}`, name: "Jane Fruelda", current_company: company, raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nJan 2023 - Present ${company}\nS/4HANA implementation` }));
  assert.equal(item.extractedCurrentCompany, "Not disclosed", `${company} rejected as current employer`);
}

for (const company of ["L3 Specialist", "2024 - present", "Led IT systems", "Maker at CIMB Thai Bank", "Business & Industrial Imaging Products", "PETRONAS Malaysia from"]) {
  const item = extractFullCandidateProfile(cv({ id: `invalid-current-${company}`, name: "Jane Fruelda", current_company: company, raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills\nJan 2024 - Present ${company}` }));
  assert.equal(item.extractedCurrentCompany, "Not disclosed", `${company} is rejected as current employer`);
  assert.equal(item.currentCompanyYearsExperience, null, `${company} has no current company tenure`);
  assert.equal(Boolean(item.companyRejectReason), true, `${company} records current employer reject reason`);
}

for (const company of ["nguagesBahasa Malaysia, English Current statusCurrent", "Research issues on various computer systems", "cultures both at onsite", "Nov 2016 - April 2022)"]) {
  const item = extractFullCandidateProfile(cv({ id: `invalid-previous-${company}`, name: "Jane Fruelda", raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant at Deloitte Jan 2023 - Present\nSAP FICO Consultant at ${company} Jun 2020 - Dec 2022\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills` }));
  assert.notEqual(item.previousCompany, company, `${company} is rejected as previous employer`);
  assert.equal(item.previousCompanyYearsExperience, null, `${company} has no previous company tenure`);
}

for (const company of ["TDI APJ Vietnam Co., Ltd", "Deloitte Consulting", "ABeam Consulting", "NTT DATA Business Solutions Malaysia", "Bluefin Solutions Sdn. Bhd", "Cognizant Technologies", "IBM India Pvt Ltd", "Innovation Associates Consulting", "KPMG VIET NAM", "Accenture Solutions Sdn Bhd"]) {
  const item = extractFullCandidateProfile(cv({ id: `accepted-employer-${company}`, name: "Jane Fruelda", raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant at ${company} Jan 2023 - Present\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills` }));
  assert.equal(item.extractedCurrentCompany, company, `${company} accepted as employer with role/date evidence`);
  assert.equal(item.currentCompanyYearsExperience > 0, true, `${company} tenure is calculated`);
}

for (const [text, expectedTotal, expectedSap] of [
  ["15+ years of experience", "15", ""],
  ["over 10 years of SAP experience", "", "10"],
  ["12 years in SAP FICO", "", "12"],
  ["Overall 11+ years in SAP", "11", ""],
  ["having 5.1 years of SAP FICO", "", "5.1"],
] as Array<[string,string,string]>) {
  const item = extractFullCandidateProfile(cv({ id: `yoe-accept-${text}`, name: "Jane Fruelda", raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\n${text}\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills` }));
  if (expectedTotal) assert.equal(item.totalYearsExperience, expectedTotal, `${text} extracts total YOE`);
  if (expectedSap) assert.equal(item.sapYearsExperience, expectedSap, `${text} extracts SAP YOE`);
}

for (const text of ["over 1000 users", "13 subsidiaries", "RM70 mil over 5 years", "200 SAP team members", "2017 - 2020", "+60 12 345 6789"]) {
  const item = extractFullCandidateProfile(cv({ id: `yoe-reject-${text}`, name: "Jane Fruelda", raw_text: `Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\n${text}\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills` }));
  assert.equal(item.totalYearsExperience, "", `${text} does not extract total YOE`);
  assert.equal(item.sapYearsExperience, "", `${text} does not extract SAP YOE`);
}

for (const badName of ["Lamkieumy Work", "OP process, collaborating with", "cultures both at onsite", "B EVENT MARKETING", "Shermaan Vijayasekaran Technicallea"]) {
  const item = extractFullCandidateProfile(cv({ id: `bad-identity-${badName}`, name: badName, raw_text: `${badName}\nEmail: bad.identity@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills` }));
  assert.notEqual(item.reviewClassification, "search_ready_after_extraction", `${badName} is not search ready as identity`);
}
const summaryTitle = extractFullCandidateProfile(cv({ id: "summary-title", name: "Fakhrin bin Mohd Ramli", current_title: "11 years as SAP Consultant: 5 new implementation projects, 2 roll-out projects,", raw_text: "Fakhrin bin Mohd Ramli\nEmail: fakhrin@example.com\nKuala Lumpur Malaysia\n11 years as SAP Consultant: 5 new implementation projects, 2 roll-out projects,\nSAP MM Consultant implementation rollout support S/4HANA migration data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities across finance modules" }));
assert.equal(summaryTitle.isTitleSuspicious, true, "summary experience sentence is invalid as title");
assert.notEqual(summaryTitle.reviewClassification, "search_ready_after_extraction", "summary title cannot be search ready");

const certTitle = extractFullCandidateProfile(cv({ id: "cert-title", name: "Ts M.yusazlan Bin Mat Yusoff", current_title: "SAP Certified Professional - Solution Architect - SAP BTP", raw_text: "Ts M.yusazlan Bin Mat Yusoff\nEmail: yusazlan@example.com\nKuala Lumpur Malaysia\nSAP Certified Professional - Solution Architect - SAP BTP\nSAP MM MM MM implementation support logistics procurement S/4HANA BTP Business Technology Platform project experience education skills and repeated SAP implementation responsibilities" }));
assert.equal(certTitle.extractedCurrentTitle, "SAP BTP Solution Architect", "certification phrase is normalized to market-safe title");
assert.equal(certTitle.primarySapModule, "BTP", "BTP title corrects primary module from title evidence");
assert.equal(certTitle.primaryModuleAlignmentStatus, "corrected_from_title", "module correction is recorded");

const ficoCorrected = extractFullCandidateProfile(cv({ id: "fico-corrected", name: "Nguyen Minh Thu", current_title: "SAP FICO Consultant", raw_text: "Nguyen Minh Thu\nEmail: thu.nguyen@example.com\nHo Chi Minh Vietnam\nSAP FICO Consultant\nSAP SD SD SD sales distribution support plus SAP FICO finance controlling implementation S/4HANA data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities" }));
assert.equal(ficoCorrected.primarySapModule, "FICO", "SAP FICO title corrects primary module when FICO evidence exists");
assert.equal(["aligned", "corrected_from_title"].includes(ficoCorrected.primaryModuleAlignmentStatus), true, "FICO alignment is resolved");

const unresolvedMismatch = extractFullCandidateProfile(cv({ id: "unresolved-mismatch", name: "Jane Fruelda", current_title: "SAP FICO Consultant", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP SD Consultant\nSD SD SD order to cash sales distribution S/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities" }));
assert.equal(unresolvedMismatch.primaryModuleAlignmentStatus, "evidence_conflict", "unresolved title/module conflict is recorded");
assert.notEqual(unresolvedMismatch.reviewClassification, "search_ready_after_extraction", "unresolved title/module mismatch is not search ready");


const companyFragmentTitle = extractFullCandidateProfile(cv({ id: "company-fragment-title", name: "Jane Fruelda", current_title: "Application Development Team Lead, Accenture inc. Taguig city", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nApplication Development Team Lead, Accenture inc. Taguig city\nABAP BAPI BADI OData CDS IDoc S/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities across technical delivery and production support" }));
assert.equal(companyFragmentTitle.isTitleSuspicious, true, "company/location fragment title is suspicious");
assert.notEqual(companyFragmentTitle.reviewClassification, "search_ready_after_extraction", "company/location fragment title cannot be search ready");

const genericSapNoModule = extractFullCandidateProfile(cv({ id: "generic-sap-no-module", name: "Jane Fruelda", current_title: "SAP Consultant", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP Consultant\nSAP project coordination stakeholder support documentation training workshop issue tracking and general enterprise application support without clear module evidence across implementation support data migration UAT SIT project experience education skills" }));
assert.equal(genericSapNoModule.isTitleSuspicious, true, "generic SAP Consultant without module evidence is suspicious");
assert.notEqual(genericSapNoModule.reviewClassification, "search_ready_after_extraction", "generic SAP Consultant without module evidence cannot be search ready");
const titleAtCompany = extractFullCandidateProfile(cv({ id: "title-at-company", name: "Jane Fruelda", current_title: "SAP BI Consultant at Bluefin Solutions Sdn. Bhd.", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP BI Consultant at Bluefin Solutions Sdn. Bhd.\nSAP BW BI BW implementation support S/4HANA data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities" }));
assert.equal(titleAtCompany.extractedCurrentTitle, "SAP BW Consultant", "title at company is split and normalized to clean SAP BW title");
assert.notEqual(titleAtCompany.extractedCurrentCompany, "Bluefin Solutions Sdn. Bhd.", "company fragment is not accepted without employer evidence");

const notDisclosedSearchReady = extractFullCandidateProfile(cv({ id: "not-disclosed-ready", name: "Jane Fruelda", current_company: "", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nS/4HANA FICO implementation support data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities across finance, controlling, rollout, enhancement, hypercare, integration testing, cutover preparation, user training, configuration documentation, defect triage, stakeholder workshops, and production support" }));
assert.equal(notDisclosedSearchReady.extractedCurrentCompany, "Not disclosed", "missing employer stays Not disclosed");
assert.equal(notDisclosedSearchReady.reviewClassification, "search_ready_after_extraction", "Not disclosed company can be search ready when other fields are clean");

const flavorCompany = extractFullCandidateProfile(cv({ id: "flavor-company", name: "Nguyen Minh Thu", current_company: "Food Flavor & Fragrance Solutions", raw_text: "Nguyen Minh Thu\nEmail: thu.nguyen@example.com\nHo Chi Minh Vietnam\nSAP FICO Consultant\nFood Flavor & Fragrance Solutions\nSAP FICO implementation support S/4HANA data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities" }));
assert.equal(flavorCompany.extractedCurrentCompany, "Not disclosed", "Food Flavor & Fragrance Solutions is not accepted as employer without label evidence");
assert.equal(flavorCompany.reviewClassification, "search_ready_after_extraction", "dirty employer reset to Not disclosed can be search ready when other fields are clean");
const clientSeparated = extractFullCandidateProfile(cv());
assert.equal(clientSeparated.clientCompanies.includes("Yash Technologies"), true, "Client Name Yash Technologies stored as client/project company");
assert.notEqual(clientSeparated.extractedCurrentCompany, "Yash Technologies", "client is not current employer by default");
assert.equal(clientSeparated.expectedSalary, "MYR 8,000 monthly", "expected salary is extracted");
assert.equal(clientSeparated.salaryCurrency, "MYR", "salary currency normalized");
assert.equal(clientSeparated.salaryPeriod, "monthly", "salary period normalized");
assert.equal(clientSeparated.noticePeriod, "1 month", "notice period extracted");
assert.equal(clientSeparated.city, "Kuala Lumpur", "city extracted");
assert.equal(clientSeparated.normalizedCountry, "Malaysia", "country normalized");
assert.equal(clientSeparated.sapModules.includes("FICO"), true, "SAP module extracted");
assert.equal(clientSeparated.primarySapModule, "FICO", "primary SAP module selected");
assert.equal(clientSeparated.projectTypes.includes("Implementation"), true, "project type extracted");
assert.equal(clientSeparated.reviewClassification, "search_ready_after_extraction", "clean candidate is search ready");
assert.equal(clientSeparated.safeApplyCandidates, undefined, "single item does not expose report-only fields");

const parserRecoverable = extractFullCandidateProfile(cv({ id: "parser", name: "Jane Fruelda", country: "", city: "", raw_text: "Jane Fruelda\nEmail: jane@example.com\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation data migration UAT SIT support enhancement project experience education skills and repeated SAP implementation responsibilities across finance modules" }));
assert.equal(parserRecoverable.reviewClassification, "search_ready_after_extraction", "contact plus clean SAP/title/name is search ready even if location is missing");

const manualReview = extractFullCandidateProfile(cv({ id: "manual", name: "Jane Fruelda", status: "deleted", raw_text: "Jane Fruelda\nEmail: jane@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation" }));
assert.equal(manualReview.reviewReasons.includes("blocked_status_existing_db"), true, "blocked existing status is surfaced for review");

const reupload = extractFullCandidateProfile({ id: "short", name: "Jane Fruelda", raw_text: "Jane Fruelda SAP" });
assert.equal(reupload.reviewClassification, "likely_reupload_required", "short raw text is likely reupload required");

const currentTenure = extractFullCandidateProfile(cv({ id: "current-tenure", name: "Jane Fruelda", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSenior SAP BI Consultant at Bluefin Solutions Sdn. Bhd. Sep 2015 - Present\nSAP BW BI S/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP analytics implementation responsibilities" }));
assert.equal(currentTenure.extractedCurrentCompany, "Bluefin Solutions Sdn. Bhd", "current company is extracted from title at company date range");
assert.equal(currentTenure.currentCompanyStartDate, "Sep 2015", "current company start date is extracted");
assert.equal(currentTenure.currentCompanyEndDate, "Present", "current company end date preserves Present");
assert.equal(currentTenure.currentCompanyYearsExperience > 0, true, "current company years experience is calculated");
assert.equal(Boolean(currentTenure.currentCompanyTenureText), true, "current company tenure text is present");

const multipleEmployment = extractFullCandidateProfile(cv({ id: "multiple-employment", name: "Jane Fruelda", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nCareer history SAP Consultant at Abeam Consulting Jun 2023 - Present SAP FICO Consultant at Deloitte May 2020 - May 2023\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities" }));
assert.equal(multipleEmployment.extractedCurrentCompany, "Abeam Consulting", "latest/current employer is selected from employment history");
assert.equal(multipleEmployment.previousCompany, "Deloitte", "previous employer is second distinct employer");
assert.equal(multipleEmployment.previousCompanyStartDate, "May 2020", "previous company start date is extracted");
assert.equal(multipleEmployment.previousCompanyEndDate, "May 2023", "previous company end date is extracted");
assert.equal(Math.abs(Number(multipleEmployment.previousCompanyYearsExperience) - 3) < 0.2, true, "previous company years experience is approximately 3 years");

const clientEmployerTenure = extractFullCandidateProfile(cv({ id: "client-employer-tenure", name: "Jane Fruelda", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nClient: PETRONAS Project: S/4HANA Implementation Employer: Deloitte Consulting Jan 2022 - Present\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities" }));
assert.equal(clientEmployerTenure.extractedCurrentCompany, "Deloitte Consulting", "employer label is used for current company");
assert.equal(clientEmployerTenure.clientCompanies.includes("PETRONAS"), true, "client company remains separated from employer");
assert.equal(clientEmployerTenure.currentCompanyYearsExperience > 0, true, "employer labelled tenure is calculated");

const totalYoe = extractFullCandidateProfile(cv({ id: "total-yoe", name: "Jane Fruelda", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\n15+ years of experience in SAP FICO and 12 years SAP implementation\nS/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities" }));
assert.equal(totalYoe.totalYearsExperience, "15", "explicit total years of experience is extracted");
assert.equal(totalYoe.sapYearsExperience, "12", "explicit SAP years of experience is extracted");

const yearOnlyRange = extractFullCandidateProfile(cv({ id: "year-only-range", name: "Jane Fruelda", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant at Deloitte 2020 - Present\nSAP FICO S/4HANA implementation support data migration UAT SIT project experience education skills and repeated SAP finance implementation responsibilities" }));
assert.equal(yearOnlyRange.currentCompanyStartDate, "2020", "year-only start date is extracted");
assert.equal(yearOnlyRange.currentCompanyEndDate, "Present", "year-only current end date is extracted");
assert.equal(yearOnlyRange.currentCompanyYearsExperience > 0, true, "year-only tenure is calculated with lower precision");

const wanNur = extractFullCandidateProfile(cv({ id: "wan-nur", name: "Wan Nur Hayatiyaakob", current_title: "SAP FICO Consultant", raw_text: "Wan Nur Hayatiyaakob\nEmail: wan@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nSAP BW BW reporting exposure plus SAP FICO finance controlling S/4HANA implementation support data migration UAT SIT project experience education skills" }));
assert.equal(wanNur.primarySapModule, "FICO", "Wan Nur Hayatiyaakob SAP FICO title does not resolve to BW");

const sanjayRk = extractFullCandidateProfile(cv({ id: "sanjay-rk", name: "Sanjay Rk", current_title: "SAP FICO Consultant", raw_text: "Sanjay Rk\nEmail: sanjay@example.com\nIndia\nSAP FICO Consultant\nSAP SD SD order to cash exposure plus SAP FICO finance controlling S/4HANA implementation support data migration UAT SIT project experience education skills" }));
assert.equal(sanjayRk.primarySapModule, "FICO", "Sanjay Rk SAP FICO title does not resolve to SD");

const superPheung = extractFullCandidateProfile(cv({ id: "super-pheung", name: "Super Pheung", current_title: "SAP BW Consultant", raw_text: "Super Pheung\nEmail: super@example.com\nSingapore\nSAP BW Consultant\nSAP FICO finance exposure plus SAP BW BI reporting analytics implementation support data migration UAT SIT project experience education skills" }));
assert.equal(superPheung.primarySapModule, "BW", "Super Pheung SAP BW title does not resolve to FICO");

const shewaramani = extractFullCandidateProfile(cv({ id: "shewaramani", name: "Shewaramani Devendra Ramesh", current_title: "SAP ABAP Consultant", raw_text: "Shewaramani Devendra Ramesh\nEmail: shewaramani@example.com\nIndia\nSAP ABAP Consultant\nSAP SD sales exposure plus ABAP BAPI BADI OData CDS IDoc WRICEF S/4HANA implementation support data migration UAT SIT project experience education skills" }));
assert.equal(shewaramani.primarySapModule, "ABAP", "Shewaramani SAP ABAP title does not resolve to SD");

const muhammadWasim = extractFullCandidateProfile(cv({ id: "muhammad-wasim", name: "Muhammad Wasim Qureshi", current_title: "SAP Functional Consultant", raw_text: "Muhammad Wasim Qureshi\nEmail: wasim@example.com\nKuala Lumpur Malaysia\nSAP EWM Consultant at Deloitte Consulting Jan 2023 - Present\nSAP EWM warehouse management S/4HANA implementation support data migration UAT SIT project experience education skills" }));
assert.equal(muhammadWasim.extractedCurrentTitle, "SAP EWM Consultant", "Muhammad Wasim Qureshi recovers EWM title");
assert.equal(muhammadWasim.primarySapModule, "EWM", "Muhammad Wasim Qureshi recovers EWM module");
assert.notEqual(muhammadWasim.reviewClassification, "blocked_title", "Muhammad Wasim Qureshi is near search-ready, not title-blocked");

const drJames = extractFullCandidateProfile(cv({ id: "dr-james", name: "Candidate profile pending validation", raw_text: "Name: Dr James Paul Asirvatham\nEmail: james@example.com\nKuala Lumpur Malaysia\nSAP Project Manager at EY Consulting Jan 2022 - Present\nSAP FICO S/4HANA implementation rollout support migration UAT SIT project experience education skills" }));
assert.equal(drJames.extractedFullName.includes("James Paul Asirvatham"), true, "Dr James Paul Asirvatham identity is extracted");
assert.equal(drJames.extractedCurrentCompany, "EY Consulting", "Dr James Paul Asirvatham employer is extracted");
assert.equal(drJames.primarySapModule, "FICO", "Dr James Paul Asirvatham SAP module is extracted");

const mariaTeresa = extractFullCandidateProfile(cv({ id: "maria-teresa", name: "Maria Teresa Briñas", current_title: "SAP FICO Consultant", raw_text: "Maria Teresa Briñas\nEmail: maria@example.com\nManila Philippines\nSAP FICO Consultant\nSAP FICO finance controlling implementation support data migration UAT SIT project experience education skills" }));
assert.equal(mariaTeresa.extractedCurrentTitle, "SAP FICO Consultant", "Maria Teresa Briñas title is SAP FICO Consultant");
assert.equal(mariaTeresa.primarySapModule, "FICO", "Maria Teresa Briñas primary module is FICO");

const abdulHadie = extractFullCandidateProfile(cv({ id: "abdul-hadie", name: "Abdul Hadie Bin Noorudin", current_title: "SAP FICO Consultant", raw_text: "Abdul Hadie Bin Noorudin\nEmail: abdul.hadie@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant at EY Consulting Jan 2021 - Present\nSAP FICO finance controlling S/4HANA implementation support data migration UAT SIT project experience education skills" }));
assert.equal(abdulHadie.extractedCurrentCompany, "EY Consulting", "Abdul Hadie Bin Noorudin employer EY Consulting is extracted");
assert.equal(abdulHadie.primarySapModule, "FICO", "Abdul Hadie Bin Noorudin primary module is FICO");

const surachai = extractFullCandidateProfile(cv({ id: "surachai", name: "Surachai Siripreechavidh", current_title: "SAP FICO Consultant", raw_text: "Surachai Siripreechavidh\nEmail: surachai@example.com\nBangkok Thailand\nPosition: SAP FICO Consultant\nSAP FICO finance controlling implementation support data migration UAT SIT project experience education skills" }));
assert.notEqual(surachai.reviewClassification, "blocked_title", "Surachai does not fail title when SAP title evidence exists");

const shayne = extractFullCandidateProfile(cv({ id: "shayne", name: "Shayne Huang", current_title: "Project Lead", raw_text: "Shayne Huang\nEmail: shayne@example.com\nSingapore\nProject Lead\nSAP implementation stakeholder coordination documentation support data migration UAT SIT project experience education skills" }));
assert.equal(shayne.isTitleSuspicious, true, "Shayne Huang Project Lead is low confidence without SAP title evidence");
assert.notEqual(shayne.reviewClassification, "search_ready_after_extraction", "Shayne Huang generic Project Lead is not search-ready");

const dirtyEmploymentHistoryCompany = extractFullCandidateProfile(cv({ id: "dirty-employment-history-company", name: "Md Husaimi Abd Wahab", current_title: "SAP FICO Consultant", current_company: "enhancement and consultation EMPLOYMENT HISTORY Date Company Name Role", raw_text: "Md Husaimi Abd Wahab\nEmail: husaimi@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nSAP FICO implementation support data migration UAT SIT project experience education skills" }));
assert.equal(dirtyEmploymentHistoryCompany.extractedCurrentCompany, "Not disclosed", "dirty employment history employer is rejected");
assert.equal(Boolean(dirtyEmploymentHistoryCompany.companyRejectReason), true, "dirty employment history employer records reject reason");

const dirtyCimbCompany = extractFullCandidateProfile(cv({ id: "dirty-cimb-company", name: "Zuhelmiza Zullkefli", current_title: "SAP FICO Consultant", current_company: "yahoo.com PROFESSIONAL EXPERIENCES CIMB Bank Berhad", raw_text: "Zuhelmiza Zullkefli\nEmail: zuhelmiza@yahoo.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nyahoo.com PROFESSIONAL EXPERIENCES CIMB Bank Berhad Jan 2021 - Present SAP FICO Consultant\nSAP FICO implementation support data migration UAT SIT project experience education skills" }));
assert.equal(dirtyCimbCompany.extractedCurrentCompany, "CIMB Bank Berhad", "CIMB Bank Berhad is recovered from dirty employer text");

const hpAlmName = extractFullCandidateProfile(cv({ id: "hp-alm-name", name: "HP ALM, Service Now", raw_text: "HP ALM, Service Now\nEmail: hp@example.com\nSingapore\nSAP Solution Architect\nSAP SD implementation support data migration UAT SIT project experience education skills" }));
assert.equal(hpAlmName.reviewClassification, "blocked_identity", "tool list name HP ALM, Service Now is rejected");

const smartGasCompany = extractFullCandidateProfile(cv({ id: "smart-gas-company", name: "Jane Fruelda", current_title: "SAP SD Consultant", current_company: "technology enablement solutions to clients. Smart-Gas Pte. Ltd., Singapore", raw_text: "Jane Fruelda\nEmail: jane@example.com\nSingapore\nSAP SD Consultant\ntechnology enablement solutions to clients. Smart-Gas Pte. Ltd., Singapore Jan 2022 - Present SAP SD Consultant\nSAP SD implementation support data migration UAT SIT project experience education skills" }));
assert.equal(smartGasCompany.extractedCurrentCompany, "Smart-Gas Pte. Ltd", "Smart-Gas Pte. Ltd is recovered from dirty employer text");

const bwDominates = extractFullCandidateProfile(cv({ id: "bw-dominates", name: "Super Pheung", current_title: "SAP BW Consultant", raw_text: "Super Pheung\nEmail: super@example.com\nSingapore\nSAP BW Consultant\nFICO FICO finance exposure and SAP BW reporting implementation support data migration UAT SIT project experience education skills" }));
assert.equal(bwDominates.primarySapModule, "BW", "SAP BW Consultant resolves to BW, not FICO");

const abapDominates = extractFullCandidateProfile(cv({ id: "abap-dominates", name: "Tran Quoc Trieu", current_title: "SAP ABAP Consultant", raw_text: "Tran Quoc Trieu\nEmail: tran@example.com\nVietnam\nSAP ABAP Consultant\nMM MM logistics exposure and ABAP BAPI BADI OData CDS IDoc implementation support data migration UAT SIT project experience education skills" }));
assert.equal(abapDominates.primarySapModule, "ABAP", "SAP ABAP Consultant resolves to ABAP, not MM");

const ficoDominates = extractFullCandidateProfile(cv({ id: "fico-dominates", name: "Jane Fruelda", current_title: "SAP FICO Consultant", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nBW BW reporting exposure and SAP FICO finance controlling implementation support data migration UAT SIT project experience education skills" }));
assert.equal(ficoDominates.primarySapModule, "FICO", "SAP FICO Consultant resolves to FICO, not BW or SD");

const piPoDominates = extractFullCandidateProfile(cv({ id: "pi-po-dominates", name: "Aaron Jakegutierrez", current_title: "SAP PI Consultant", raw_text: "Aaron Jakegutierrez\nEmail: aaron@example.com\nManila Philippines\nSAP PI Consultant\nSAP PI/PO integration support implementation data migration UAT SIT project experience education skills" }));
assert.equal(piPoDominates.primarySapModule, "PI/PO", "SAP PI Consultant resolves to PI/PO");

const keepExistingGuardrail = auditBatchUploadExtractionSimulation([cv({ id: "keep-existing", name: "Patrick Lawrence Esposo Chico", current_title: "SAP FICO Consultant", current_company: "Deloitte Consulting", sap_modules: ["FICO"], country: "Malaysia", raw_text: "Patrick Lawrence Esposo Chico\nEmail: patrick@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nSAP FICO implementation support data migration UAT SIT project experience education skills" })], { limit: 1, useExistingRawText: true, noOpenAI: true });
assert.equal(keepExistingGuardrail.items[0].recommendedAction === "keep_existing_record" || keepExistingGuardrail.items[0].safeToOverwrite === true, true, "existing search-ready records are kept or only overwritten when simulated extraction is safe");
const audit = auditFullCandidateExtraction([cv(), parserRecoverable, reupload, cv({ id: "audit-bad-title", name: "Fakhrin bin Mohd Ramli", current_title: "11 years as SAP Consultant: 5 new implementation projects, 2 roll-out projects,", raw_text: "Fakhrin bin Mohd Ramli\nEmail: fakhrin@example.com\nKuala Lumpur Malaysia\n11 years as SAP Consultant: 5 new implementation projects, 2 roll-out projects,\nSAP MM Consultant implementation rollout support S/4HANA migration data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities across finance modules" })]);
assert.equal(audit.summary.totalCandidates, 4, "audit counts candidates");
assert.equal(audit.searchReadyItems.length >= 1, true, "audit includes search ready items");
assert.equal(audit.safeApplyCandidates.some((item) => item.isNameSuspicious || item.isTitleSuspicious || item.isCompanySuspicious), false, "safe apply candidates exclude suspicious fields");
assert.equal(audit.distributions.reviewClassificationDistribution.search_ready_after_extraction >= 1, true, "classification distribution is present");
assert.equal(audit.summary.titleSuspiciousButStillSearchReadyCount, 0, "title suspicious but search-ready count stays zero");
assert.equal(audit.suspiciousExamples.titleSuspiciousStillSearchReady.length, 0, "no suspicious title examples remain search ready");
assert.equal(audit.summary.downgradedFromSearchReadyDueToTitleQuality >= 1, true, "title quality downgrade counter increments");

const reportPath = path.join(process.cwd(), "reports", "full-candidate-extraction.test.json");
const exported = writeFullCandidateExtractionReport([cv()], reportPath);
assert.equal(exported.mode, "read-only", "export is read-only");
assert.equal(exported.items.length, 1, "export includes one item per candidate");
assert.equal(exported.summary.totalCandidates, 1, "export includes summary");
assert.equal(FULL_CANDIDATE_EXTRACTION_PATH, path.join("reports", "full-candidate-extraction.json"), "report path is stable");
if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

const sources = [
  fs.readFileSync(new URL("../lib/fullCandidateExtractionEngine.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./auditFullCandidateExtraction.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./exportFullCandidateExtraction.ts", import.meta.url), "utf8"),
].join("\n");
assert.equal(sources.includes(".update("), false, "no DB update behavior");
assert.equal(sources.includes(".insert("), false, "no DB insert behavior");
assert.equal(sources.includes(".delete("), false, "no DB delete behavior");

console.log("Full candidate extraction tests passed");
