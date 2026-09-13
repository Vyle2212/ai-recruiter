import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { type ReactNode } from "react";

import { CompactCandidateCard } from "../app/recruiter/talent-search/v2/CandidateSearchV2Client";
import { normalizeExaPersonResult } from "../lib/exaPeopleSearchProvider";
import {
  buildExternalTalentProfilePresentation,
  calculateCanonicalExternalExperience,
  normalizeExternalEmploymentRecords,
} from "../lib/externalTalentProfile";
import { evaluateExternalCandidate } from "../lib/externalTalentScoring";
import { deterministicExternalSearchPlan } from "../lib/externalTalentSearchPlan";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup(node: ReactNode): string;
};

const person = (
  name: string,
  properties: Record<string, unknown>,
  title: string = name,
) =>
  normalizeExaPersonResult(
    {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      title,
      url: `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "-")}`,
      entities: [
        {
          id: name,
          type: "person",
          properties: {
            displayName: name,
            location: "Malaysia",
            ...properties,
          },
        },
      ],
    },
    0,
    "named-profile-regression",
  )!;

const lee = person("Lee Choon Fei", {
  headline: "SAP Group Reporting Consultant",
  workHistory: [
    {
      title: "SAP Group Reporting Consultant",
      company: { title: "SAP Group Reporting Consultant" },
    },
    { title: "SAP BPC Consultant", company: { title: "BPC Consultant" } },
  ],
});
assert.equal(lee.profileTitle, "SAP Group Reporting Consultant");
assert.notEqual(lee.profileTitle, "Lee Choon Fei");
assert.equal(lee.currentTitle, undefined);
assert.equal(lee.currentEmployer, undefined);
assert.equal(lee.employmentRecords?.[0].employer, null);
assert.equal(
  lee.employmentRecords?.some((record) => record.current),
  false,
  "source order and undated records must not manufacture current employment",
);

const srinivas = person("Srinivas Vasireddy", {
  headline: "SAP S/4HANA FICO Consultant",
  workHistory: [
    {
      title: "SAP S/4HANA FICO Consultant",
      company: { name: "Grounded Consulting Sdn Bhd" },
      startDate: "2023-01",
      endDate: "Present",
    },
  ],
});
assert.equal(srinivas.currentTitle, "SAP S/4HANA FICO Consultant");
assert.equal(srinivas.currentEmployer, "Grounded Consulting Sdn Bhd");

const carey = person("Carey Lian", {
  headline: "Finance Analyst",
  currentTitle: "Finance Analyst",
  workHistory: [
    {
      title: "SAP FICO Intern",
      company: { name: "Historical Employer" },
      startDate: "2018-01-01",
      endDate: "2018-06-30",
    },
  ],
});
assert.equal(carey.currentTitle, "Finance Analyst");

const plan = deterministicExternalSearchPlan({
  query: "SAP FICO Malaysia",
  talentPool: "linkedin_talent_pool",
  filters: { sapModules: ["FICO"], locations: ["Malaysia"] },
});
const score = (candidate: typeof lee) =>
  evaluateExternalCandidate(
    {
      ...candidate,
      source: "external_talent_network",
      provider: "exa",
      profileUrlDomain: "linkedin.com",
      sourceRequestId: "named-profile-regression",
      explanationStatus: "grounded",
      duplicateReviewStatus: "not_reviewed",
      skills: candidate.skills || [],
      providerEvidence: [],
      providerRank: candidate.providerRank || 1,
    },
    plan,
  ).candidate;
const leeScore = score(lee);
const srinivasScore = score(srinivas);
const careyScore = score(carey);
assert.notEqual(
  leeScore.targetEvidence.temporalContext,
  "current",
  "Group Reporting/BPC must not become direct current FICO evidence",
);
assert.equal(srinivasScore.targetEvidence.temporalContext, "current");
assert.equal(careyScore.targetEvidence.temporalContext, "historical");
assert.ok(
  srinivasScore.overallMatchScore > careyScore.overallMatchScore,
  "direct current FICO must rank above historical internship evidence",
);
assert.ok(srinivasScore.overallMatchScore > leeScore.overallMatchScore);

const nazril = person("Nazril Nordin", {
  workHistory: Array.from({ length: 9 }, (_, index) => ({
    title: `External role ${index + 1}`,
    company: { name: `Employer ${index + 1}` },
  })),
});
const nazrilPresentation = buildExternalTalentProfilePresentation(nazril);
assert.equal(nazrilPresentation.employmentRecords.length, 9);
assert.equal(nazrilPresentation.experienceCalculation.status, "unavailable");
assert.equal(nazrilPresentation.currentEmployment, null);
assert.equal(nazrilPresentation.latestEmployment, null);

const markup = renderToStaticMarkup(
  <CompactCandidateCard
    result={
      {
        candidateId: "nazril",
        talentPool: "linkedin_talent_pool",
        candidateName: "Nazril Nordin",
        currentTitle: null,
        currentEmployer: null,
        location: "Malaysia",
        country: null,
        totalYearsExperience: null,
        experienceCalculationStatus: "unavailable",
        score: null,
        explanation: null,
        verifiedSkills: [],
        verifiedSapModules: [],
        implementationEvidenceCount: 0,
        implementationEvidenceLevel: "unverified",
        seniorityEvidenceLevel: "unverified",
        externalProfile: nazrilPresentation,
        profilePreview: {
          employmentCount: 9,
          projectCount: 0,
          educationCount: 0,
          certificationCount: 0,
          trainingCount: 0,
          skillCount: 0,
          currentEmployment: null,
          latestEmployment: null,
          employment: nazrilPresentation.employmentRecords.slice(0, 2),
          projects: [],
          education: null,
          certifications: [],
          training: [],
          skills: [],
        },
      } as never
    }
    rank={1}
    searchContextId="named-profile-regression"
    intent={{} as never}
    expanded={false}
    diagnostic={
      {
        matchLevel: "Potential Match",
        evidenceConfidence: "Limited",
        evidenceCoveragePercent: 0,
        requirements: [],
        criteria: [],
      } as never
    }
    onToggle={() => {}}
    identityLookup
  />,
);
assert.equal(
  (markup.match(/aria-label="Recent experience"/g) || []).length,
  1,
  "result card must contain exactly one Recent Experience section",
);
assert.match(markup, /Recent experience \(9\)/);
assert.match(markup, /External role 1/);
assert.match(markup, /External role 2/);
assert.doesNotMatch(markup, /External role 3/);
assert.match(
  markup,
  /Total professional experience: Not established from source/,
);

const now = new Date("2025-07-15T00:00:00.000Z");
const overlap = normalizeExternalEmploymentRecords(
  [
    { title: "Role A", startDate: "2020-01-01", endDate: "2022-12-31" },
    { title: "Role B", startDate: "2021-01-01", endDate: "2023-12-31" },
  ],
  "Fixture",
  now,
);
const overlapExperience = calculateCanonicalExternalExperience(overlap, now);
assert.equal(overlapExperience.status, "established");
assert.ok(
  overlapExperience.totalYears! > 3.9 && overlapExperience.totalYears! < 4.1,
  "overlapping employment must be merged rather than double-counted",
);
const mixed = normalizeExternalEmploymentRecords(
  [
    { title: "Partial", startDate: "2024", endDate: "2025-07" },
    { title: "Undated" },
    { title: "Reversed", startDate: "2024-12-01", endDate: "2020-01-01" },
    { title: "Future", startDate: "2030-01-01", endDate: "2031-01-01" },
  ],
  "Fixture",
  now,
);
const mixedExperience = calculateCanonicalExternalExperience(mixed, now);
assert.equal(mixedExperience.status, "partial");
assert.equal(mixedExperience.datedRecords, 1);
assert.equal(mixedExperience.undatedRecords, 1);
assert.equal(mixedExperience.rejectedDateRecords, 2);

const clientSource = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.doesNotMatch(clientSource, /function inferEmployerFromTitle/);
assert.match(
  clientSource,
  /\.slice\(\s*0,\s*result\.talentPool === "linkedin_talent_pool" \? 2 : 3/,
);
const drawerSource = readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(
  drawerSource,
  /Optional AI narrative unavailable\. Preliminary deterministic match remains available\./,
);
const routeSource = readFileSync(
  "app/api/recruiter/search-v2/route.ts",
  "utf8",
);
assert.match(routeSource, /externalProfile,/);
assert.match(routeSource, /employment: previewEmployment/);

console.log(
  JSON.stringify(
    {
      LeeChoonFei: {
        profileTitle: lee.profileTitle,
        currentTitle: lee.currentTitle || null,
        currentEmployer: lee.currentEmployer || null,
        temporalContext: leeScore.targetEvidence.temporalContext,
        score: leeScore.overallMatchScore,
      },
      SrinivasVasireddy: {
        temporalContext: srinivasScore.targetEvidence.temporalContext,
        score: srinivasScore.overallMatchScore,
      },
      CareyLian: {
        temporalContext: careyScore.targetEvidence.temporalContext,
        score: careyScore.overallMatchScore,
      },
      NazrilNordin: {
        cardEmploymentRecords: 2,
        drawerEmploymentRecords: nazrilPresentation.employmentRecords.length,
        totalExperienceStatus: nazrilPresentation.experienceCalculation.status,
      },
      overlapExperience,
      mixedExperience,
    },
    null,
    2,
  ),
);
console.log("Search V2 external canonical profile regression tests passed.");
