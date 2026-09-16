import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const cases = [
  [
    "Professional Experience EXAMPLE，SAP SD Consultant，Sep. 2024 - Present - In charge of configuration",
    "EXAMPLE",
    "SAP SD Consultant",
    "Sep 2024",
  ],
  [
    "Work Experience 2021 | June - 2025 | May Example Consulting Pvt Ltd Senior Consultant- SAP MM/EWM Module Lead Responsibilities: delivery",
    "Example Consulting Pvt Ltd",
    "Senior Consultant- SAP MM/EWM Module Lead",
    "June 2021",
  ],
  [
    "EXPERIENCE Nov 2023-Present Example Co.,Ltd. Collections Team Lead Team = Ten agents",
    "Example Co.,Ltd.",
    "Collections Team Lead",
    "Nov 2023",
  ],
  [
    "Work Experience Industrial Trainee Example Institute Sdn. Bhd. Oct 2020 - Jan 2021, Example City Performed sample extraction",
    "Example Institute Sdn. Bhd.",
    "Industrial Trainee",
    "Oct 2020",
  ],
  [
    "Experience December 2021 to Present SAP B1 Functional Consultant, Example Service Pte Ltd Example Service Pte Ltd is a partner",
    "Example Service Pte Ltd",
    "SAP B1 Functional Consultant",
    "December 2021",
  ],
  [
    "Experience SAP FICO Consultant/ Example Associates Consulting Aug 2018– Present Consulting Firm",
    "Example Associates Consulting",
    "SAP FICO Consultant",
    "Aug 2018",
  ],
  [
    "Work Experience 2014 – 2019 Example Systems Sdn Bhd / SAP Project Manager Projects that I managed",
    "Example Systems Sdn Bhd",
    "SAP Project Manager",
    "2014",
  ],
  [
    "Experience Example Consulting 2024 – present Role: Senior SAP Consultant Configured SAP systems",
    "Example Consulting",
    "Senior SAP Consultant",
    "2024",
  ],
  [
    "Work Experience 1). Position: SAP MM Consultant. Company: Example Solutions Sdn.Bhd 2022 - Present Duties: delivery",
    "Example Solutions Sdn.Bhd",
    "SAP MM Consultant",
    "2022",
  ],
  [
    "Work Experience Application Development Team Lead, Example inc. Example city February 2023 - Present -Handles support",
    "Example inc. Example city",
    "Application Development Team Lead",
    "February 2023",
  ],
  [
    "Professional Experience SAP Senior Consultant (PP), Example Consulting (July 2014 – Present) S/4 implementation",
    "Example Consulting",
    "SAP Senior Consultant (PP)",
    "July 2014",
  ],
  [
    "Professional Experience SAP FICO Consultant Example Consulting (M) Sdn.Bhd, (Nov 2022- Present) Completed delivery",
    "Example Consulting (M) Sdn.Bhd",
    "SAP FICO Consultant",
    "Nov 2022",
  ],
  [
    "Work Experience September 2018 – Current Senior Specialist, RTR Employer: Example Corp Malaysia, Center Location: Example City Responsibilities finance",
    "Example Corp Malaysia, Center",
    "Senior Specialist, RTR",
    "September 2018",
  ],
  [
    "Experience Feb 2022 – TO PRESENT SAP FINANCE & CONTROLLING CONSULTANT, EXAMPLE CONSULTING Role: Applying ERP",
    "EXAMPLE CONSULTING",
    "SAP FINANCE & CONTROLLING CONSULTANT",
    "Feb 2022",
  ],
  [
    "Work Experience September 2023-To Present Example Delivery Center SAP FICO Consultant Delivered solutions",
    "Example Delivery Center",
    "SAP FICO Consultant",
    "September 2023",
  ],
  [
    "Work Experience SAP FICO Consultant Example (December 9,2024 – Present) Provides ongoing support",
    "Example",
    "SAP FICO Consultant",
    "9 December 2024",
  ],
] as const;
for (const [source, company, title, start] of cases) {
  assert.ok(
    read(source).some(
      (j) => j.company === company && j.title === title && j.start === start,
    ),
    source,
  );
  assert.ok(
    canonical(source).some(
      (j) =>
        j.company.toLowerCase().replace(/\s/g, "") ===
          company.toLowerCase().replace(/\s/g, "") &&
        j.title.toLowerCase() === title.toLowerCase(),
    ),
    source,
  );
}
const cards =
  "Experience Jan 2020 - Present(1 year) Senior Functional ConsultantEXAMPLE (M) Sdn Bhd Industry Computer / Information Technology (Software) Specialization IT/Computer - Software Role Functional Consultant Position Level Senior Executive Monthly Salary confidential. Jul 2016 - Dec 2016(6 months) SAP ABAP Specialist (Contract)Example Systems Industry Manufacturing / Production Specialization IT/Computer - Software Role Programmer Position Level Senior Executive";
assert.equal(
  read(cards).length,
  2,
  "camel and uppercase company boundaries on explicit export cards",
);
const table =
  "WORK EXPERIENCE Role Company Duration SAP SD Senior Consultant Example One Sdn Bhd, Example City Dec 2022- Till Now SAP SD Lead Consultant Example Two Pte Ltd, Example City April 2022- Dec 2022 CURRENT PROJECT Details Client: Buyer Duration: Jan 2010 - Dec 2010 Role: SAP Consultant";
assert.equal(canonical(table).length, 2);
const numbered =
  "Work Experience Organization Name Designation From Date To Date 1 Example One Sdn. Bhd. Senior Manager May 2023 Current 2 Example Two Sdn Bhd Manager April 2022 May 2023 3 Example Three Ltd. Sr. Consultant June 2018 March 2022";
assert.equal(canonical(numbered).length, 3);
const dotted =
  "EMPLOYMENT HISTORY : Example One SDN BHD - Senior SAP Consultant (May 2008 – July 2010) Example Associate Sdn Bhd - Senior SAP Functional Analyst (Nov 2006 - Apr 2008) Example Three Sdn. Bhd. - Analyst Programmer (Jun 2003 – Nov 2006)";
assert.equal(canonical(dotted).length, 3);
assert.ok(
  canonical(dotted).every((j) => j.company.startsWith("Example")),
  "no legal-suffix employer fragments survive grounded recovery",
);
const endLedger =
  "WORK EXPERIENCE Example One Sdn Bhd (2002 – 2004) Example Two Sdn Bhd (2004 – 2010) SAP Key Skills SD";
assert.equal(canonical(endLedger).length, 2);
assert.ok(
  canonical(endLedger).every((j) => !j.title),
  "employer tenure does not invent a SAP role",
);
const laterDuty =
  "Work History Example One (March 28,2016 – April 2017) – SAP FICO consultant Example Two (April 2017 – Present) – SAP FICO consultant - Engages in implementation Project Buyer Jan 2010 - Dec 2010";
assert.equal(canonical(laterDuty).length, 2);
for (const source of [
  "Project Experience Example，SAP SD Consultant，Sep. 2024 - Present",
  "Experience ERP SD, MM and Finance BUSINESS ANALYST, MARCH 2016 – PRESENT",
  "Experience Jan 2023-Present Functional Enterprise Resource Planning (ERP) Consultant – Example Software SDN BHD",
  "Experience Manager, SuccessFactors AMS Example Consulting May 2023-Present",
  "Experience SAP Billing Consultant Example Group, Buyer Berhad, Example City February 2022 - Present Conducted work",
  "Work Experience Role Company Duration SAP Consultant Client Buyer Inc Jan 2020 - Dec 2021",
  "Work Experience Role Company Duration SAP Consultant Example Inc Dec 2025 - Mar 2025",
  "Experience SAP Consultant, Example Inc Jan 2020 -",
  "Work Experience Project A 2021 | June - 2025 | May Example Consulting Ltd SAP Consultant Responsibilities: project",
])
  assert.equal(read(source).length, 0, source);
const p = normalizeActualCandidateSchema({
  resume_text:
    "Experience November 2023 - Present Example Ltd Collections Team Lead Team = Ten agents",
}).enterpriseProfile;
assert.equal(p.employmentTimeline.length, 1);
assert.equal(
  p.experienceSummary.sapExperienceYears,
  null,
  "collections history is not SAP experience",
);
const notesTable = canonical(
  "WORK EXPERIENCE Start End Title Comp. Name Notes 06-2024 03-2025 SAP Delivery Manager PT.Example One AMS Delivery Manager for Buyer 08-2011 02-2012 SAP FICO Consultant Senior Example Two SAP Implementation for Client Buyer 01-2014 03-2016 SAP Consultant Example Three SAP Project Support",
);
assert.equal(notesTable.length, 3);
assert.ok(
  notesTable.some(
    (j) =>
      j.company === "Example Two" && j.title === "SAP FICO Consultant Senior",
  ),
);
assert.ok(notesTable.every((j) => !j.company.includes("Buyer")));
assert.equal(
  read(
    "WORK EXPERIENCE Start End Title Comp. Name Notes 06-2025 03-2025 SAP Consultant Example One SAP Implementation for Buyer",
  ).length,
  0,
);
const form = canonical(
  "Experience Company : Example Consulting Sdn Bhd Position Title : SAP MM Support Consultant, Application Management Services Specialization : SAP MM Industry : IT Services Duration : Feb 2020 – Now Work Experiences: Provide support Project : Buyer",
);
assert.equal(form.length, 1);
assert.equal(form[0].company, "Example Consulting Sdn Bhd");
console.log("career heading batch: PASS");
