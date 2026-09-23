import assert from "node:assert/strict";
import { headedChronologicalEmployment } from "../lib/headedChronologicalEmployment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const chronology = normalizeActualCandidateSchema({ raw_text:
  "WORK EXPERIENCE Oct 2021 – Present Example Software PROJECT MANAGER Managed several delivery projects. " +
  "Sep 2018 – Sep 2021 Example Systems LLC PROJECT MANAGER / MES SPECIALIST Led an internal support team. " +
  "Jan 2018 – Sep 2018 Example IT Ltd. SENIOR ERP CONSULTANT Provided implementation advice. " +
  "Education Jul 2014 – Jun 2017 Example University SYSTEM ANALYST Responsibilities: studied." });
assert.deepEqual(chronology.enterpriseProfile.employmentTimeline.map(j => [j.company, j.title, j.start, j.end]), [
  ["Example Software", "PROJECT MANAGER", "Oct 2021", "Present"],
  ["Example Systems LLC", "PROJECT MANAGER / MES SPECIALIST", "Sep 2018", "Sep 2021"],
  ["Example IT Ltd", "SENIOR ERP CONSULTANT", "Jan 2018", "Sep 2018"],
]);
assert.equal(chronology.enterpriseProfile.experienceSummary.sapExperienceYears || 0, 0,
  "A general project manager / ERP title never establishes SAP delivery tenure");

const legalAndClient = headedChronologicalEmployment(
  "WORK EXPERIENCE SUMMARY Sept 2023 - Sept 2024 SAP BW Sr. Analyst/Developer - Example Consulting Inc. - Example Buyer, Manila " +
  "Created SAP data flows. Aug 2021 - Mar 2023 Business Architecture Associate Manager - Example Consulting Inc. - Example Treasury " +
  "Implemented new flows. PROJECT EXPERIENCE Jan 2020 - Dec 2020 SAP Consultant - Example Client Ltd. - Internal Team " +
  "Supported a customer project."
);
assert.deepEqual(legalAndClient.map(j => [j.company, j.title]), [
  ["Example Consulting Inc", "SAP BW Sr. Analyst/Developer"],
  ["Example Consulting Inc", "Business Architecture Associate Manager"],
]);

const companyRole = headedChronologicalEmployment(
  "WORK EXPERIENCE Dec 2012 - Sep 2013 SAP Consultant Module SD Example Advisory Master in configuration of SAP. " +
  "Oct 2013 - Now SAP Consultant Module MM Example Partner Master in inventory management."
);
assert.deepEqual(companyRole.map(j => [j.company, j.title]), [
  ["Example Advisory", "SAP Consultant Module SD"], ["Example Partner", "SAP Consultant Module MM"]
]);

const dated = headedChronologicalEmployment(
  "WORK EXPERIENCE [ 09/04/2024 – Current] SAP Senior SAP FI/CO Consultant Example Consulting City: Somewhere " +
  "Created SAP reports. [ 05/06/2023 – 31/03/2024] SAP Project Lead - FI/CO Example Systems Limited City: Somewhere " +
  "Directed delivery. [ 01/03/2017 – 31/05/2023] Senior SAP FI/CO Consultant Example Partner City: Somewhere " +
  "Configured SAP."
);
assert.deepEqual(dated.map(j => [j.company, j.start, j.end]), [
  ["Example Consulting", "Apr 2024", "Current"], ["Example Partner", "Mar 2017", "May 2023"]
]);
assert.deepEqual(headedChronologicalEmployment(
  "WORK EXPERIENCE [ 09/04/2024 – Current] SAP Senior SAP FI/CO Consultant Example Consulting City: Somewhere " +
  "Created SAP reports."), [], "An isolated day/month date is ambiguous");
assert.deepEqual(headedChronologicalEmployment(
  "WORK EXPERIENCE [ 09/04/2024 – Current] SAP Senior SAP FI/CO Consultant Example Consulting City: Somewhere " +
  "Created SAP reports. [ 31/02/2023 – 31/02/2024] SAP FI/CO Consultant Example Partner City: Somewhere " +
  "Configured SAP."), [], "An invalid calendar day cannot prove day-first notation");
assert.deepEqual(headedChronologicalEmployment(
  "PROJECT EXPERIENCE Jan 2021 - Dec 2021 SAP Consultant Module MM Example Customer Master in purchasing. " +
  "WORK EXPERIENCE Education Jan 2019 - Dec 2020 Example College SYSTEM ANALYST Responsibilities: studied."), [],
"Project and education dates cannot produce employer periods");
assert.deepEqual(headedChronologicalEmployment(
  "WORK EXPERIENCE Dec 2021 - Jan 2020 SAP Consultant Module SD Example Partner Master in configuration."), [],
  "An inverted source range cannot become an employment period");
console.log("Headed career chronology and SAP-only boundaries: PASS");
