import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  employmentTimelineDiagnostics,
  extractCanonicalEmploymentFromResume,
} from "../lib/candidate360Employment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { calculateTotalCareerYears } from "../lib/candidateCareerExperience";
import { canonicalTalentSearchIdentity } from "../lib/talentSearchDisplay";

const groundedProfile = normalizeActualCandidateSchema({
  id: "fixture-a8ccb8",
  name: "And Driving High-impact Digital Outcomes.",
  current_title:
    "SAP PS Team Lead - CBS Corporate Business Solution Malaysia Sdn Bhd",
  location: "Malaysia",
  resume_text: `
    PROFESSIONAL EXPERIENCE
    SAP PS Team Lead — CBS Corporate Business Solution Malaysia Sdn Bhd (Nov 2023 – May 2025)
    Client: Project Energy | Regional Utility. Led SAP delivery.
    Senior SAP FICO Consultant — DXC Technology (Dec 2021 – Oct 2023)
    Client: Global Communications. Delivered SAP FICO migration.
    Senior SAP FICO Consultant — Virtual Calibre Sdn Bhd (Aug 2021 – Nov 2021)
    Client: AIA Shared Services. Provided L3 SAP FICO support.
  `,
  projects: [
    {
      id: "client-aia",
      client: "AIA Shared Services",
      role: "Senior SAP FICO Consultant",
      start_date: "2021-08",
      end_date: "2021-11",
      modules: ["FICO"],
      responsibilities: [
        "Employer: Virtual Calibre Sdn Bhd; client delivery support",
      ],
    },
  ],
});
const groundedEmployment = groundedProfile.enterpriseProfile.employmentTimeline;
assert.equal(groundedProfile.enterpriseProfile.identity.name, "");
assert.equal(
  groundedProfile.enterpriseProfile.identity.currentTitle,
  "SAP PS Team Lead",
);
assert.equal(
  groundedProfile.enterpriseProfile.identity.currentCompany,
  "CBS Corporate Business Solution Malaysia Sdn Bhd",
);
assert.ok(
  groundedEmployment.length > 1,
  "explicit professional history is not reduced to one current-role placeholder",
);
assert.equal(
  groundedEmployment.some((item) => item.company === "AIA Shared Services"),
  false,
  "a project client is never promoted to employer",
);
const virtualCalibre = groundedEmployment.find((item) =>
  /Virtual Calibre/i.test(item.company),
);
assert.ok(virtualCalibre);
assert.equal(
  virtualCalibre!.linkedProjectIds?.length,
  1,
  "compatible project provenance may link without changing employer identity",
);
assert.doesNotMatch(
  JSON.stringify(groundedEmployment),
  /And Driving High-impact Digital Outcomes/i,
);

const embeddedHeaderProfile = normalizeActualCandidateSchema({
  id: "4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8",
  name: "And Driving High-impact Digital Outcomes.",
  current_title: "Senior SAP FICO Consultant — DXC Technology",
  resume_text: `PROFESSIONAL EXPERIENCE
    Senior SAP FICO Consultant — DXC Technology (Dec 2021 – Oct 2023)
    Client: Project WeMove | Eutelsat Telecommunications (Dec 2022 – Oct 2023) Migrated Oracle ERP into SAP S/4HANA. Configured FI module for multi-currency.
    MOHAMED SHAKEER ABDUL RAHIM SAP Senior Consultant | ERP Solutions Leader | Project Manager | Petaling Jaya, Selangor, Malaysia Client: Jollibee Food Corporation (Dec 2021 – Nov 2022) Led Asia SAP FICO support via SOLMAN & ServiceNow.`,
  projects: [
    {
      id: "jollibee-structured",
      client: "Jollibee Food Corporation",
      role: "SAP FICO Team Lead",
      modules: ["FICO"],
      project_type: "Support",
      responsibilities: ["Led Asia SAP FICO support via SOLMAN & ServiceNow."],
    },
  ],
});
assert.equal(
  embeddedHeaderProfile.candidateName,
  "MOHAMED SHAKEER ABDUL RAHIM",
  "an unambiguous repeated CV identity header may recover the canonical name",
);
assert.equal(
  canonicalTalentSearchIdentity(
    embeddedHeaderProfile.enterpriseProfile.candidateId,
  ).identityToken,
  "#A8CCB8",
);
const embeddedDxc =
  embeddedHeaderProfile.enterpriseProfile.employmentTimeline.find(
    (item) => item.company === "DXC Technology",
  );
assert.ok(embeddedDxc);
assert.doesNotMatch(
  JSON.stringify(embeddedDxc!.responsibilities),
  /MOHAMED SHAKEER|ERP Solutions Leader|Client\s*:/i,
);
const embeddedJollibee = embeddedHeaderProfile.enterpriseProfile.projects.find(
  (item) => item.client === "Jollibee Food Corporation",
);
assert.ok(embeddedJollibee);
assert.equal(embeddedJollibee!.start, "Dec 2021");
assert.equal(embeddedJollibee!.end, "Nov 2022");
assert.match(
  embeddedJollibee!.responsibilities.join(" "),
  /Led Asia SAP FICO support via SOLMAN & ServiceNow/,
);
assert.doesNotMatch(
  embeddedJollibee!.responsibilities.join(" "),
  /MOHAMED SHAKEER|ERP Solutions Leader|Petaling Jaya|Client\s*:/i,
);
assert.ok(
  embeddedJollibee!.fieldEvidence.responsibilities?.provenance.some((item) =>
    /resume\.inlineClientAssignments/.test(item.sourceRef || ""),
  ),
);
assert.ok(
  embeddedDxc!.linkedProjectIds?.includes(embeddedJollibee!.id),
  "the client assignment remains linked without becoming the employer",
);
assert.equal(
  embeddedHeaderProfile.enterpriseProfile.employmentTimeline.length,
  1,
);
assert.equal(
  embeddedHeaderProfile.enterpriseProfile.projects.length,
  2,
  "the explicit WeMove project and Jollibee engagement remain distinct",
);
assert.doesNotMatch(
  JSON.stringify(embeddedHeaderProfile.enterpriseProfile.projects),
  /ERP Solutions Leader|Petaling Jaya/,
  "a redacted repeated CV header cannot leak into either project",
);

const summaryOnly = normalizeActualCandidateSchema({
  id: "summary-only",
  name: "Grounded Candidate",
  current_title:
    "Senior SAP consultant with experience of over 20 years covering various roles within",
  current_company: "experience of over 20 years covering various roles within",
  resume_text:
    "PROFESSIONAL SUMMARY Senior SAP consultant with experience of over 20 years covering various roles within SAP projects.",
});
assert.equal(summaryOnly.enterpriseProfile.employmentTimeline.length, 0);
assert.equal(summaryOnly.enterpriseProfile.identity.currentTitle, "");
assert.equal(summaryOnly.enterpriseProfile.identity.currentCompany, "");

const summaryWithGroundedHistory = normalizeActualCandidateSchema({
  id: "summary-grounded",
  current_title:
    "Senior SAP consultant with experience of over 20 years covering various roles within",
  experience: [
    {
      id: "grounded-role",
      company: "Evidence Consulting",
      title: "SAP FICO Consultant",
      start_date: "2018-01",
      end_date: "2022-12",
    },
  ],
});
assert.deepEqual(
  summaryWithGroundedHistory.enterpriseProfile.employmentTimeline.map(
    (item) => item.id,
  ),
  ["grounded-role"],
);

const indraShape = normalizeActualCandidateSchema({
  id: "indra-shape",
  current_title: "As Business Support Analyst (SAP FICO)",
  resume_text: `Work and Project Experience
    PT Farpoint Prima (Oct 2015 – Present) As Business Support Analyst (SAP FICO) Summary Supported SAP FICO operations.
    PT. Krakatau Information Technology (Oct 2012 – Oct 2015) As SAP FICO Consultant Summary Delivered SAP FICO implementations.
    DATE: February 2015 - Oct 2015 CLIENT: Project Client RESPONSIBILITY: FICO Team Leader`,
});
assert.deepEqual(
  indraShape.enterpriseProfile.employmentTimeline.map((item) => [
    item.company,
    item.title,
  ]),
  [
    ["PT Farpoint Prima", "Business Support Analyst (SAP FICO)"],
    ["Krakatau Information Technology", "SAP FICO Consultant"],
  ],
);
assert.equal(
  indraShape.enterpriseProfile.employmentTimeline.some(
    (item) => item.company === "Project Client",
  ),
  false,
);

const oneEmploymentManyProjects = normalizeActualCandidateSchema({
  id: "one-employment-many-projects",
  experience: [
    {
      id: "employment-one",
      company: "Virtual Calibre Sdn Bhd",
      title: "SAP FICO Consultant",
      start_date: "2020-01",
      end_date: "2022-12",
    },
  ],
  projects: [
    {
      id: "project-one",
      client: "AIA Shared Services",
      role: "SAP FICO Consultant",
      start_date: "2020-03",
      end_date: "2020-12",
      modules: ["FICO"],
    },
    {
      id: "project-two",
      client: "Another Client",
      role: "SAP FICO Consultant",
      start_date: "2021-01",
      end_date: "2022-06",
      modules: ["FICO"],
    },
  ],
});
assert.equal(
  oneEmploymentManyProjects.enterpriseProfile.employmentTimeline.length,
  1,
);
assert.equal(oneEmploymentManyProjects.enterpriseProfile.projects.length, 2);
assert.equal(
  oneEmploymentManyProjects.enterpriseProfile.employmentTimeline[0]
    .linkedProjectIds?.length,
  2,
);
assert.equal(
  oneEmploymentManyProjects.enterpriseProfile.experienceSummary
    .totalCareerYears,
  2.9,
);

const promotion = normalizeActualCandidateSchema({
  id: "promotion",
  experience: [
    {
      id: "analyst-role",
      company: "Employer One",
      title: "SAP Analyst",
      start_date: "2018-01",
      end_date: "2020-12",
    },
    {
      id: "consultant-role",
      company: "Employer One",
      title: "SAP Consultant",
      start_date: "2020-06",
      end_date: "2023-01",
    },
  ],
});
assert.equal(
  promotion.enterpriseProfile.employmentTimeline.length,
  2,
  "supported promotions remain separate roles",
);
assert.equal(
  promotion.enterpriseProfile.experienceSummary.totalCareerYears,
  5,
  "overlapping promotion months are counted once",
);
assert.equal(
  calculateTotalCareerYears([{ start: "2099-01", end: "2099-12" }]),
  null,
  "future ranges are rejected",
);

const duplicate = extractCanonicalEmploymentFromResume(`
  SAP FICO Consultant at Evidence Consulting Feb 2011 - Jun 2011
  SAP FICO Consultant at Evidence Consulting Feb 2011 - Jun 2011
`);
assert.equal(duplicate.length, 1);
assert.equal(employmentTimelineDiagnostics(duplicate).duplicateRecords, 0);

const fusedBoundary = normalizeActualCandidateSchema({
  id: "fused-boundary",
  current_title: "SAP FI/CO Consultant in CapgeminiMalaysiasdnbhd form",
  current_company: "CapgeminiMalaysiasdnbhd form",
  resume_text:
    "Currently working as SAP FI/CO Consultant in CapgeminiMalaysiasdnbhd form June’2024 to 20 November 2024.",
});
assert.equal(
  fusedBoundary.enterpriseProfile.identity.profileTitle,
  "SAP FI/CO Consultant",
);
assert.deepEqual(
  fusedBoundary.enterpriseProfile.employmentTimeline.map((item) => [
    item.title,
    item.company,
    item.start,
    item.end,
    item.current,
  ]),
  [
    [
      "SAP FI/CO Consultant",
      "Capgemini Malaysia Sdn Bhd",
      "June 2024",
      "November 2024",
      false,
    ],
  ],
  "an explicit ended role is normalized without manufacturing current employment",
);

const companyPositionClient = normalizeActualCandidateSchema({
  id: "company-position-client",
  current_title: "Senior FICO Support Consultant",
  resume_text: `
    Dec 2009- Dec 2011 (2 years contract) Company : Accenture Malaysia SdnBhd Position : SAP FI Analyst Client – Exxon Mobil Business Support Center Sdn Bhd (SAP Application Services) Specific Responsibilities Role as FI analyst provided functional SAP FI/CO support and break/fix remediation.
    SAP ECC 6.0 Deployment project Client-Unilever Kenya Limited (U2K2- Central Africa Deployment) - (Feb to May 2012) Data Migration and Cutover Specific Responsibilities Report to Project Manager and FICO lead. Role as FI SAP Consultant during cutover and reconciled AP/AR/Asset balances.
  `,
});
assert.deepEqual(
  companyPositionClient.enterpriseProfile.employmentTimeline.map((item) => [
    item.company,
    item.title,
    item.start,
    item.end,
    item.current,
  ]),
  [
    [
      "Accenture Malaysia Sdn Bhd",
      "SAP FI Analyst",
      "Dec 2009",
      "Dec 2011",
      false,
    ],
  ],
  "Company, Position and dates create one employment while Client remains separate",
);
const exxonProject = companyPositionClient.enterpriseProfile.projects.find(
  (item) => /Exxon Mobil/i.test(item.client),
);
assert.ok(exxonProject, "an en-dash Client delimiter is recovered");
assert.equal(
  companyPositionClient.enterpriseProfile.employmentTimeline[0].linkedProjectIds?.includes(
    exxonProject!.id,
  ),
  true,
);
const unileverProject = companyPositionClient.enterpriseProfile.projects.find(
  (item) => /Unilever Kenya/i.test(item.client),
);
assert.ok(unileverProject, "a compact Client- delimiter is recovered");
assert.deepEqual(
  [unileverProject!.start, unileverProject!.end, unileverProject!.projectType],
  ["Feb 2012", "May 2012", "Migration"],
);
assert.equal(
  calculateTotalCareerYears(
    companyPositionClient.enterpriseProfile.employmentTimeline,
  ),
  2,
  "project dates never extend employment duration",
);

const drawer = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  ),
  "utf8",
);
assert.match(
  drawer,
  /No grounded employment history was provided in the selected[\s\S]*profile source/,
);
assert.match(drawer, /Role not provided/);
assert.match(drawer, /Company not provided/);
assert.match(drawer, /linked project/);
assert.doesNotMatch(
  drawer,
  /\{text\(item\.title\)\} - \{text\(item\.company\)\}/,
);

console.log("Search V2 canonical employment timeline tests passed.");
