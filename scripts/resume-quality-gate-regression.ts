import { evaluateResumeQualityGate, isTrustedCandidateName, sanitizeCompanyName, classifyCompanyCategory, resolveCurrentCompany } from "../lib/resumeQualityGate";
import { buildCanonicalCandidateProfile } from "../lib/canonicalCandidateProfile";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const rejectedNames = [
  "Snvenkat Kurmala",
  "Hajar Iexora",
  "Needs manual name review",
  "Name requires validation",
  "Profile Under Review",
  "Identity under review",
  "Current Location",
  "Technology Consulting",
  "Academic Background",
  "Capital Market",
  "Software Testing",
  "Authorization Matrix Etc",
  "Customer Request",
  "Extended Star Schema Models",
  "Roll Out",
  "Information Technology",
  "Quality Of Outcomes",
  "Device Management",
  "Master Data Governance",
  "Period End Closing Process",
  "Preferred Working Location",
  "Installation Status",
  "Strictly Confidential",
  "Manufacturing Domain",
  "Contact Education",
  "External Stakeholders",
  "Gender",
  "Nationality",
  "Father's Name",
  "Mother's Name",
  "Original",
  "AMS",
  "SAP",
  "Functional Consultant",
  "Senior Consultant",
  "Current Position",
  "Employment",
  "Designation",
  "Position Title",
];

for (const name of rejectedNames) {
  assert(!isTrustedCandidateName(name, "other"), `Expected rejected name: ${name}`);
}

assert(isTrustedCandidateName("Lim Soo Ying", "structured"), "Expected real structured name to pass: Lim Soo Ying");
assert(sanitizeCompanyName("Malaysia Airports") === "Malaysia Airports", "Malaysia Airports should be accepted as company");
assert(classifyCompanyCategory("Malaysia Airports") === "End User", "Malaysia Airports should classify as End User, not consulting");
assert(classifyCompanyCategory("Petronas Digital") === "Energy", "Petronas Digital should classify as enterprise/in-house category");
assert(classifyCompanyCategory("Capgemini Services") === "SI", "Capgemini Services should classify as consulting/SI");
assert(!sanitizeCompanyName("Current Location"), "Current Location must not be accepted as company");
assert(!sanitizeCompanyName("SAP SD Consultant"), "SAP SD Consultant must not be accepted as company");
assert(!sanitizeCompanyName("SAP"), "Bare SAP keyword must not be accepted as current employer");
assert(!sanitizeCompanyName("PP & MM module"), "SAP module strings must not be accepted as companies");
assert(!sanitizeCompanyName("SAP SD"), "SAP SD must not be accepted as company");
assert(!sanitizeCompanyName("FICO"), "FICO must not be accepted as company");
assert(!sanitizeCompanyName("MM module"), "MM module must not be accepted as company");
assert(!sanitizeCompanyName("S/4HANA"), "S/4HANA must not be accepted as company");
assert(!sanitizeCompanyName("implementation"), "Implementation must not be accepted as company");
assert(!sanitizeCompanyName("rollout"), "Rollout must not be accepted as company");
assert(!sanitizeCompanyName("support"), "Support must not be accepted as company");
assert(!sanitizeCompanyName("studied general science, mathematics and computer"), "Education phrases must not be accepted as companies");

const badProfile = evaluateResumeQualityGate({
  name: "Technology Consulting",
  current_company: "Current Location",
  raw_text: "Technology Consulting\nAcademic Background\nCapital Market\nSoftware Testing",
});
assert(badProfile.rejected, "Heading-only profile should be rejected");
assert(!badProfile.allowedForRanking, "Rejected profile must not be rank eligible");
assert(!badProfile.allowedForExecutiveExport, "Rejected profile must not be PDF export eligible");

const goodProfile = evaluateResumeQualityGate({
  name: "Lim Soo Ying",
  current_company: "Malaysia Airports",
  email: "lim.soo.ying@example.com",
  raw_text: "Lim Soo Ying\nlim.soo.ying@example.com\nSAP SD Consultant\nMalaysia Airports\n2018 - Present",
});
assert(!goodProfile.rejected, "Valid profile should not be rejected");
assert(goodProfile.parserQualityScore >= 75, "Valid profile should pass parser quality threshold");
assert(goodProfile.allowedForRanking, "Valid profile should be rank eligible");


const blobNameProfile = buildCanonicalCandidateProfile({
  name: "Profile Under Review",
  raw_text: "DELOITTE SAP FICO Manager Prepared by: Thoa Ho CANDIDATE INFORMATION Full Name: JAMSHED KHAN Year of Birth: 1983 Gender: Male WORKING EXPERIENCE Aug 2021 - present Nexus Business Solution PVT LTD SAP FICO Lead Consultant",
});
assert(blobNameProfile.displayName === "Jamshed KHAN", "Blob-level Full Name should replace Profile Under Review display name");
assert(!blobNameProfile.allowedForExecutiveExport, "Profile Under Review placeholder must block executive export even when display name is recovered");
assert(blobNameProfile.identityReviewRequired, "Profile Under Review should be retained as an internal identity review flag");
assert(blobNameProfile.currentCompany === "Nexus Business Solution PVT LTD", "Current company should parse from latest raw work history");

const compactEmployerProfile = {
  name: "Shinta Nuraisya Arizky",
  email: "shinta.nuraisya@gmail.com",
  raw_text: "CANDIDATE INFORMATION Full Name: Shinta Nuraisya Arizky Year of birth: 1993 Gender: Male EXPERIENCE PT.Tokopedia,Jakarta,Indonesia OCTOBER2021-NOW Software Engineer",
};
assert(resolveCurrentCompany(compactEmployerProfile) === "PT.Tokopedia", "Current company should parse from company-before-current-date resume text");

const organizationEmployerProfile = {
  name: "Sake Anand",
  email: "sake.anand@gmail.com",
  raw_text: "EXPERIENCE Organization PWCIndia DurationJuly2023-Present Designation Manager KeyRoleSAPMM/PP OrganizationIBMDurationJanuary2023-July2023",
};
assert(resolveCurrentCompany(organizationEmployerProfile) === "PWCIndia", "Current company should parse from Organization/Duration resume text");

const workHistoryProfile = {
  name: "Lim Soo Ying",
  email: "lim.soo.ying@example.com",
  workExperience: [{ company: "Malaysia Airports", endDate: "Present" }, { company: "Capgemini Services", endDate: "2018" }],
};
assert(resolveCurrentCompany(workHistoryProfile) === "Malaysia Airports", "Current company should come from present work history");
const canonical = buildCanonicalCandidateProfile(workHistoryProfile);
assert(canonical.currentCompany === "Malaysia Airports", "Canonical current company should match resolver");
assert(canonical.companyType === "In-house", "Malaysia Airports must display as In-house");
assert(canonical.backgroundExperience === "Mixed (Consulting Firm + In-house)", "Mixed career history should classify as Mixed");

const metricDefaultProfile = buildCanonicalCandidateProfile({
  name: "Lim Soo Ying",
  email: "lim.soo.ying@example.com",
  current_company: "Malaysia Airports",
  implementationProjects: 1,
  rolloutProjects: 1,
  amsProjects: 1,
  s4hanaProjects: 1,
  raw_text: "Lim Soo Ying\nMalaysia Airports\nSAP SD Consultant",
});
assert(metricDefaultProfile.deliveryMetrics.implementation === 0, "Default implementation=1 should be removed without exact evidence");
assert(metricDefaultProfile.deliveryMetrics.rollout === 0, "Default rollout=1 should be removed without exact evidence");
assert(metricDefaultProfile.deliveryMetrics.s4 === 0, "Default S/4=1 should be removed without exact evidence");

console.log("Resume Quality Gate regression tests passed");
