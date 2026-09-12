import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import CanonicalProfileOverview from "../components/CanonicalProfileOverview";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import {
  buildCanonicalProfileOverview,
  buildExternalCanonicalProfileOverview,
  CANONICAL_PROFILE_OVERVIEW_VERSION,
} from "../lib/candidateProfileOverview";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};

const profileFrom = (raw: Record<string, unknown>) => {
  const normalized = normalizeActualCandidateSchema(raw);
  return buildCandidate360Profile({ ...raw, ...normalized });
};

const employment = (count: number, current = false) =>
  Array.from({ length: count }, (_, index) => ({
    id: `employment-${index + 1}`,
    company:
      index === 0
        ? "CBS Corporate Business Solution Malaysia Sdn Bhd"
        : `Grounded employer ${index + 1}`,
    title: index === 0 ? "SAP PS Team Lead" : "SAP FICO Consultant",
    start_date: index === 0 ? "Nov 2023" : `Jan ${2010 + index}`,
    end_date: index === 0 ? "May 2025" : `Dec ${2010 + index}`,
    current: current && index === 0,
  }));
const projects = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `project-${index + 1}`,
    project: `Grounded assignment ${index + 1}`,
    client: `Client ${index + 1}`,
    role: "SAP FICO Consultant",
    start_date: `Jan ${2010 + index}`,
    end_date: `Jun ${2010 + index}`,
    project_type: index % 2 ? "Migration" : "Implementation",
    modules: ["FICO"],
    responsibilities: [
      "Configured SAP FI/CO for the grounded client assignment.",
    ],
  }));

const stableId = "4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8";
const mohamed = profileFrom({
  id: stableId,
  name: "MOHAMED SHAKEER ABDUL RAHIM",
  current_title: "SAP PS Team Lead",
  location: "Malaysia",
  experience: employment(12),
  projects: projects(10),
  sap_modules: ["FICO", "PS"],
  languages: ["English", "Malay", "Hindi"],
  certifications: [
    "SAP Certified Application Associate - Financial Accounting",
    "HCL Axon - SAP Certified Application Associate - Management Accounting",
    "ITIL Foundation Certificate in ITSM",
    "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
  ],
});
mohamed.enterpriseProfile.experienceSummary.totalCareerYears = 14.5;
const mohamedOverview = buildCanonicalProfileOverview(mohamed);
assert.equal(mohamedOverview.version, CANONICAL_PROFILE_OVERVIEW_VERSION);
assert.equal(mohamedOverview.identity.name, "MOHAMED SHAKEER ABDUL RAHIM");
assert.equal(mohamedOverview.identity.publicIdentityToken, "#A8CCB8");
assert.equal(mohamedOverview.identity.profileTitle, "SAP PS Team Lead");
assert.equal(
  mohamedOverview.career.currentEmployment,
  null,
  "profile title does not create current employment",
);
assert.equal(
  mohamedOverview.career.latestEmployment?.employer,
  "CBS Corporate Business Solution Malaysia Sdn Bhd",
);
assert.equal(mohamedOverview.career.latestEmployment?.end, "May 2025");
assert.equal(mohamedOverview.career.totalExperienceYears, 14.5);
assert.equal(mohamedOverview.career.employmentCount, 12);
assert.equal(mohamedOverview.career.projectCount, 10);
assert.equal(mohamedOverview.certifications.count, 3);
assert.equal(mohamedOverview.training.count, 1);
assert.deepEqual(
  mohamedOverview.languages.map((item) => item.value),
  ["English", "Malay", "Hindi"],
);
assert.equal(mohamedOverview.education.count, 0);

const indra = profileFrom({
  id: "indra",
  name: "Indra Permana",
  current_title: "Business Support Analyst (SAP FICO)",
  location: "Indonesia",
  experience: [
    {
      id: "farpoint",
      company: "PT Farpoint Prima",
      title: "Business Support Analyst (SAP FICO)",
      start_date: "Oct 2015",
      end_date: "Present",
      current: true,
    },
    {
      id: "krakatau",
      company: "Krakatau Information Technology",
      title: "SAP FICO Consultant",
      start_date: "Oct 2012",
      end_date: "Oct 2015",
    },
  ],
  projects: projects(5),
  sap_modules: ["FICO"],
});
indra.enterpriseProfile.experienceSummary.totalCareerYears = 14;
const identityOverview = buildCanonicalProfileOverview(indra);
const hybridOverview = buildCanonicalProfileOverview(indra);
assert.deepEqual(
  identityOverview,
  hybridOverview,
  "search context cannot alter profile truth",
);
assert.equal(
  identityOverview.career.currentEmployment?.employer,
  "PT Farpoint Prima",
);
assert.equal(identityOverview.career.employmentCount, 2);
assert.equal(identityOverview.career.projectCount, 5);
assert.equal(
  identityOverview.skills.sapModules.find((item) => item.value === "FICO")
    ?.state,
  "Not verified",
);
assert.equal(identityOverview.education.count, 0);

const teck = profileFrom({
  id: "teck",
  name: "Teck Chiewlim",
  current_title: "SAP FICO Functional Consultant",
  location: "Malaysia",
  experience: [
    {
      id: "magnus",
      company: "Magnus Management Consultants Sdn. Bhd",
      title: "SAP FICO Functional Consultant",
      start_date: "Jan 2004",
      end_date: "Present",
      current: true,
    },
    {
      id: "ibm",
      company: "IBM Consulting Services",
      title: "Project Consultant",
      start_date: "Mar 2003",
      end_date: "Dec 2003",
    },
  ],
  education: [
    {
      id: "rmit",
      degree: "Degree",
      institution: "RMIT",
      graduation_year: "2002",
    },
  ],
  languages: ["Bahasa Malaysia", "Mandarin", "English"],
  sap_modules: ["FICO"],
});
const teckOverview = buildCanonicalProfileOverview(teck);
assert.equal(teckOverview.career.employmentCount, 2);
assert.equal(teckOverview.career.projectCount, 0);
assert.equal(
  teckOverview.career.currentEmployment?.employer,
  "Magnus Management Consultants Sdn. Bhd",
);
assert.equal(teckOverview.education.highestOrLatest?.institution, "RMIT");
assert.equal(teckOverview.education.highestOrLatest?.completionDate, "2002");
assert.deepEqual(
  teckOverview.languages.map((item) => item.value),
  ["Bahasa Malaysia", "Mandarin", "English"],
);

const gunawan = profileFrom({
  id: "gunawan",
  name: "Gunawan Lie",
  location: "Singapore",
  raw_text:
    "PROFESSIONAL SUMMARY Senior SAP consultant with experience of over 20 years covering various roles within SAP programmes. PROJECTS Client: Alpha Role: SAP Consultant 2019 - 2020 implementation delivery.",
  projects: projects(3),
  sap_modules: ["FICO"],
  languages: ["English", "Bahasa Indonesia"],
});
const gunawanOverview = buildCanonicalProfileOverview(gunawan);
assert.match(gunawanOverview.professionalSummary || "", /over 20 years/i);
assert.equal(gunawanOverview.career.currentEmployment, null);
assert.equal(gunawanOverview.career.employmentCount, 0);
assert.equal(gunawanOverview.career.projectCount, 3);
assert.equal(gunawanOverview.education.count, 0);
const gunawanMarkup = renderToStaticMarkup(
  React.createElement(CanonicalProfileOverview, {
    overview: gunawanOverview,
    onNavigate: () => undefined,
  }),
);
assert.match(gunawanMarkup, /View all Projects/);
assert.match(gunawanMarkup, /View all Skills/);
assert.match(
  gunawanMarkup,
  /Information not available: Employment, formal education, Certifications, work arrangement\./,
);
assert.doesNotMatch(
  gunawanMarkup,
  /No employment history available in this profile/,
);
assert.doesNotMatch(gunawanMarkup, /No education information available/);
assert.doesNotMatch(gunawanMarkup, /No certifications available/);
assert.doesNotMatch(gunawanMarkup, /Source details/);

const certificationOnly = buildCanonicalProfileOverview(
  profileFrom({
    id: "cert-only",
    name: "Certification Only",
    certifications: ["SAP Certified Application Associate"],
  }),
);
assert.equal(certificationOnly.education.count, 0);
assert.equal(
  certificationOnly.certifications.count,
  1,
  "certifications remain visible without education",
);

const employmentOnly = buildCanonicalProfileOverview(
  profileFrom({
    id: "employment-only",
    name: "Employment Only",
    experience: employment(1, true),
  }),
);
assert.equal(employmentOnly.career.employmentCount, 1);
assert.equal(employmentOnly.career.projectCount, 0);
const projectOnly = buildCanonicalProfileOverview(
  profileFrom({
    id: "project-only",
    name: "Project Only",
    projects: projects(1),
  }),
);
assert.equal(projectOnly.career.employmentCount, 0);
assert.equal(projectOnly.career.projectCount, 1);

const external = buildExternalCanonicalProfileOverview({
  candidateId: "external-1",
  candidateName: "External Person",
  profileTitle: "Consultant",
  location: "Malaysia",
});
assert.equal(external.identity.talentPool, "linkedin_talent_pool");
assert.equal(external.career.employmentCount, 0);
assert.ok(external.provenance.unavailableCategories.includes("employment"));

const overviewComponentSource = fs.readFileSync(
  "components/CanonicalProfileOverview.tsx",
  "utf8",
);
assert.match(overviewComponentSource, /View all \{destination\}/);
assert.match(overviewComponentSource, /destination="Experience"/);
assert.match(overviewComponentSource, /Information not available:/);
assert.match(overviewComponentSource, /Employment highlights/);
assert.doesNotMatch(overviewComponentSource, /Profile completeness/);
assert.match(
  fs.readFileSync(
    "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
    "utf8",
  ),
  /CanonicalProfileOverview/,
);
assert.match(
  fs.readFileSync(
    "app/recruiter/candidate360-v2\/\[candidateId\]\/Candidate360V2Client.tsx",
    "utf8",
  ),
  /CanonicalProfileOverview/,
);
for (const consumer of [
  "lib/smartShortlist.ts",
  "lib/candidateCompare.ts",
  "lib/submissionGenerator.ts",
])
  assert.match(
    fs.readFileSync(consumer, "utf8"),
    /canonicalOverview/,
    `${consumer} must prefer the canonical overview projection`,
  );

console.log("Search V2 canonical Profile Overview tests passed.");
