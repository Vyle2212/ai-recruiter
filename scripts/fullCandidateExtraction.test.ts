import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { auditFullCandidateExtraction, extractFullCandidateProfile } from "../lib/fullCandidateExtractionEngine";
import { writeFullCandidateExtractionReport, FULL_CANDIDATE_EXTRACTION_PATH } from "./exportFullCandidateExtraction";

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
assert.equal(titleAtCompany.extractedCurrentTitle, "SAP BI Consultant", "title at company is split to clean title");
assert.notEqual(titleAtCompany.extractedCurrentCompany, "Bluefin Solutions Sdn. Bhd.", "company fragment is not accepted without employer evidence");

const notDisclosedSearchReady = extractFullCandidateProfile(cv({ id: "not-disclosed-ready", name: "Jane Fruelda", current_company: "", raw_text: "Jane Fruelda\nEmail: jane@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nS/4HANA FICO implementation support data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities across finance, controlling, rollout, enhancement, hypercare, integration testing, cutover preparation, user training, configuration documentation, defect triage, stakeholder workshops, and production support" }));
assert.equal(notDisclosedSearchReady.extractedCurrentCompany, "Not disclosed", "missing employer stays Not disclosed");
assert.equal(notDisclosedSearchReady.reviewClassification, "search_ready_after_extraction", "Not disclosed company can be search ready when other fields are clean");

const flavorCompany = extractFullCandidateProfile(cv({ id: "flavor-company", name: "Nguyen Minh Thu", current_company: "Food Flavor & Fragrance Solutions", raw_text: "Nguyen Minh Thu\nEmail: thu.nguyen@example.com\nHo Chi Minh Vietnam\nSAP FICO Consultant\nFood Flavor & Fragrance Solutions\nSAP FICO implementation support S/4HANA data migration UAT SIT project experience education skills and repeated SAP implementation responsibilities" }));
assert.equal(flavorCompany.extractedCurrentCompany, "Not disclosed", "Food Flavor & Fragrance Solutions is not accepted as employer without label evidence");
assert.equal(flavorCompany.reviewClassification, "parser_recoverable", "dirty employer reset is parser recoverable, not search ready");
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
