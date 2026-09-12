import assert from "node:assert/strict";
import fs from "node:fs";
import type { Candidate360Profile } from "../lib/candidate360Types";
import { buildSearchV2RecruiterCandidateDetail } from "../lib/searchV2CandidateDetailContract";
import { authorizeSearchV2CandidateDetailRequest } from "../lib/searchV2CandidateDetailAuthorization";
import {
  candidateProfileTabAccessibility,
  candidateProfileTabClassName,
  candidateProfileTabLabel,
  candidateProfileTabState,
} from "../lib/candidateProfilePresentation";
import {
  candidatePresentationResponsibilityIssues,
  cleanCandidatePresentationEntity,
  cleanCandidatePresentationText,
  splitCandidatePresentationSegments,
} from "../lib/candidatePresentationText";
import { sanitizeSearchV2RecruiterResponse } from "../lib/searchV2RecruiterResponse";

const accessCases = [
  ["standard recruiter", true, true, "recruiter", true, true, 200, "recruiter"],
  [
    "unauthorized authenticated user",
    true,
    true,
    "client",
    true,
    true,
    403,
    null,
  ],
  [
    "admin with debug disabled",
    true,
    true,
    "admin",
    true,
    false,
    200,
    "recruiter",
  ],
  [
    "qa with debug enabled",
    true,
    true,
    "qa",
    true,
    true,
    200,
    "technical_debug",
  ],
  ["qa with debug disabled", true, true, "qa", true, false, 200, "recruiter"],
  [
    "admin with debug enabled",
    true,
    true,
    "admin",
    true,
    true,
    200,
    "technical_debug",
  ],
  ["unauthenticated request", false, false, "guest", true, true, 401, null],
] as const;
for (const [
  label,
  authenticated,
  active,
  role,
  requested,
  enabled,
  status,
  scope,
] of accessCases) {
  const decision = authorizeSearchV2CandidateDetailRequest({
    authenticated,
    active,
    role,
    debugRequested: requested,
    debugFeatureEnabled: enabled,
  });
  assert.equal(decision.status, status, label);
  assert.equal("scope" in decision ? decision.scope : null, scope, label);
}
assert.equal(
  authorizeSearchV2CandidateDetailRequest({
    authenticated: true,
    active: true,
    role: "recruiter",
    debugRequested: true,
    debugFeatureEnabled: true,
  }).scope,
  "recruiter",
  "URL manipulation cannot grant recruiter debug access",
);

const candidateDetailRoute = fs.readFileSync(
  "app/api/recruiter/search-v2/candidate-details/[candidateId]/route.ts",
  "utf8",
);
assert.match(candidateDetailRoute, /authorizeRecruiterJobsRead\(\)/);
assert.match(candidateDetailRoute, /authorizeSearchV2CandidateDetailRequest\(/);
assert.match(candidateDetailRoute, /searchParams\.get\("debug"\) === "1"/);
assert.match(candidateDetailRoute, /candidateDetailDebugFeatureEnabled\(\)/);
assert.match(candidateDetailRoute, /const scope = access\.scope/);
assert.match(
  candidateDetailRoute,
  /loadSearchV2CandidateDetail\([\s\S]*scope,/,
);
assert.match(
  candidateDetailRoute,
  /buildSearchV2RecruiterCandidateDetail\(profile\)/,
);

const tabs = [
  "Overview",
  "Experience",
  "Projects",
  "Education",
  "Skills",
] as const;
for (const selected of tabs) {
  const states = tabs.map((tab) =>
    candidateProfileTabAccessibility(tab === selected),
  );
  assert.equal(states.filter((state) => state["aria-selected"]).length, 1);
  assert.equal(states.filter((state) => state.tabIndex === 0).length, 1);
}
const active = candidateProfileTabClassName(true, true);
const inactive = candidateProfileTabClassName(false, true);
assert.match(active, /border-b-2/);
assert.match(active, /border-cyan-300/);
assert.match(active, /text-cyan-200/);
assert.match(inactive, /border-b-2/);
assert.match(inactive, /border-transparent/);
assert.match(inactive, /text-slate-400/);
assert.doesNotMatch(inactive, /hover:border-cyan/);
assert.doesNotMatch(inactive, /focus-visible:rounded/);
assert.match(active, /focus-visible:outline-cyan-300/);
assert.equal(
  candidateProfileTabClassName(true, true),
  active,
  "active state is independent of browser focus",
);
for (const token of ["border-b-2", "px-3", "py-2", "text-sm"])
  assert.ok(
    active.includes(token) && inactive.includes(token),
    `${token} prevents tab layout shift`,
  );
const drawerSource = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.equal(
  (
    drawerSource.match(
      /data-testid="candidate-detail-active-tab-indicator"/g,
    ) || []
  ).length,
  1,
);
assert.match(
  drawerSource,
  /tab === item \? \([\s\S]*candidate-detail-active-tab-indicator[\s\S]*h-0\.5 bg-cyan-300/,
);
assert.match(drawerSource, /event\.key === "Home"/);
assert.match(drawerSource, /event\.key === "End"/);
assert.match(drawerSource, /event\.key === "ArrowRight"/);
assert.match(drawerSource, /event\.key === "ArrowLeft"/);
assert.match(drawerSource, /setTab\(nextTab\)/);
assert.match(drawerSource, /\.focus\(\)/);
assert.match(drawerSource, /className="shrink-0 border-b/);
assert.match(
  drawerSource,
  /aria-label="Close candidate details"[\s\S]*tabIndex=\{-1\}/,
);
assert.match(drawerSource, /cache: "no-store"/);
assert.match(drawerSource, /profile\.contractVersion !==/);
assert.match(
  drawerSource,
  /candidateProfileTabLabel\(item, count, hasRecords\)/,
);
const fullProfileSource = fs.readFileSync(
  "app/recruiter/candidate360-v2/[candidateId]/Candidate360V2Client.tsx",
  "utf8",
);
assert.match(fullProfileSource, /cleanProjectResponsibilities/);
assert.doesNotMatch(
  fullProfileSource,
  /project\.responsibilities\s*\.slice\(/,
  "full recruiter profile must not render raw project responsibility slices",
);

const overview = (
  employment: number,
  projects: number,
  education: number,
  skills: number,
) =>
  ({
    career: { employmentCount: employment, projectCount: projects },
    education: { count: education },
    certifications: { count: 0 },
    training: { count: 0 },
    skills: {
      totalCount: skills,
      lifecycle: [],
      sapModules: [],
      technical: [],
      functional: Array.from({ length: skills }, (_, index) => ({
        value: `Skill ${index + 1}`,
      })),
    },
  }) as never;
for (const [candidate, counts] of Object.entries({
  "#0BD318": [14, 2, 5, 4],
  "#A8CCB8": [12, 8, 4, 15],
  "#F59634": [0, 3, 0, 11],
  "#757B32": [2, 5, 4, 3],
})) {
  const state = candidateProfileTabState(
    overview(...(counts as [number, number, number, number])),
  );
  assert.deepEqual(
    state.map((item) => item.count),
    [null, ...counts],
    `${candidate} displayed canonical counts remain stable`,
  );
  assert.ok(
    state.every((item) => item.enabled),
    `${candidate} zero-count tabs remain accessible`,
  );
}
const gunawanState = candidateProfileTabState(overview(0, 3, 0, 11));
assert.equal(
  candidateProfileTabLabel(
    "Experience",
    gunawanState[1].count,
    gunawanState[1].hasRecords,
  ),
  "Experience · Not provided",
);
assert.equal(
  candidateProfileTabLabel(
    "Education",
    gunawanState[3].count,
    gunawanState[3].hasRecords,
  ),
  "Education · Not provided",
);
assert.equal(gunawanState[1].count, 0);
assert.equal(gunawanState[3].count, 0);
assert.match(
  drawerSource,
  /No grounded employment history was provided in the selected[\s\S]*Three[\s\S]*project assignment/,
);
assert.match(
  drawerSource,
  /No education, qualifications, certifications or training[\s\S]*information was provided in the selected profile source/,
);

assert.equal(
  cleanCandidatePresentationEntity("DXC Technology/"),
  "DXC Technology",
);
assert.equal(
  cleanCandidatePresentationEntity("Hewlett-Packard / DXC Technology"),
  "Hewlett-Packard / DXC Technology",
);
assert.equal(
  cleanCandidatePresentationEntity("Consultant | ; /"),
  "Consultant",
);
assert.equal(
  cleanCandidatePresentationText("ECC 6.0 and S/4HANA"),
  "ECC 6.0 and S/4HANA",
);
assert.equal(cleanCandidatePresentationText("2010 - 2014"), "2010 - 2014");
assert.equal(
  cleanCandidatePresentationText(
    "Genovate SAP Financials [phone redacted] Kuala Lumpur",
  ),
  "Genovate SAP Financials Kuala Lumpur",
);
assert.deepEqual(
  splitCandidatePresentationSegments([
    "Configured SAP FI. □ Supported ECC 6.0 rollout. � Resolved issues.  Conducted UAT. ï‚· Closed defects.",
  ]),
  [
    "Configured SAP FI.",
    "Supported ECC 6.0 rollout.",
    "Resolved issues.",
    "Conducted UAT.",
    "Closed defects.",
  ],
);
assert.deepEqual(
  splitCandidatePresentationSegments([
    "0\u00a0EHP7 Implementation Project - Phase I. 0\u200b Implementation Phase II - HR, PP, Product Costing.",
  ]),
  [
    "EHP7 Implementation Project - Phase I.",
    "Implementation Phase II - HR, PP, Product Costing.",
  ],
);
assert.deepEqual(
  splitCandidatePresentationSegments([
    "0 EHP7 Implementation Project - Phase I. 0 Implementation Phase II - HR, PP, Product Costing.",
  ]),
  [
    "EHP7 Implementation Project - Phase I.",
    "Implementation Phase II - HR, PP, Product Costing.",
  ],
);
assert.deepEqual(
  splitCandidatePresentationSegments([
    "0 Implementation Prototyping Project. 0 Reimplementation for PSAK10..",
  ]),
  ["Implementation Prototyping Project.", "Reimplementation for PSAK10."],
);
for (const malformed of [
  "□ Liaise and work with other team members...",
  " Conduct training and UAT sessions...",
  "0 EHP7 Implementation Project - Phase I.",
  "0 Reimplementation for PSAK10..",
])
  assert.ok(
    candidatePresentationResponsibilityIssues(malformed).length > 0,
    `the final-renderer audit must reject ${malformed}`,
  );
for (const safe of [
  "SAP ECC 6.0",
  "S/4HANA 2020",
  "PSAK10",
  "January 2020 – March 2021",
  "24 months",
  "1. Validate the configuration.",
  "0. Confirm the zero-balance step.",
]) {
  assert.deepEqual(splitCandidatePresentationSegments([safe]), [safe]);
  assert.deepEqual(candidatePresentationResponsibilityIssues(safe), []);
}

const fakeProfile = {
  candidateId: "privacy-candidate",
  canonicalOverview: {
    version: "test",
    identity: {
      candidateId: "privacy-candidate",
      name: "Candidate",
      nameAvailable: true,
      publicIdentityToken: "#TEST",
      talentPool: "internal_profiles",
      profileTitle: "SAP Consultant",
      headline: null,
      location: "Malaysia",
      country: "Malaysia",
    },
    profileQuality: {
      profileDataConfidencePercent: 90,
      sourceCompletenessPercent: 80,
      profileCompletenessPercent: 80,
    },
    professionalSummary: "SAP consultant [phone redacted] person@example.com",
    career: {
      totalExperienceYears: 10,
      currentEmployment: null,
      currentEmployments: [],
      latestEmployment: null,
      employmentCount: 1,
      projectCount: 1,
      supportedGapCount: null,
    },
    skills: {
      sapModules: [],
      functional: [],
      technical: [],
      lifecycle: [],
      industries: [],
      totalCount: 0,
    },
    employmentHighlights: [],
    projectHighlights: [],
    education: { count: 1, highestOrLatest: null },
    certifications: { count: 0, items: [] },
    training: {
      count: 1,
      items: [
        {
          value: "Genovate course [phone redacted]",
          evidenceStatus: "source_supported",
          verificationStatus: "not_verified",
        },
      ],
    },
    languages: [],
    workArrangement: {
      location: "Malaysia",
      workAuthorization: null,
      remote: null,
      relocation: null,
      travel: null,
      noticePeriod: null,
      availability: null,
      evidence: {},
    },
    provenance: {
      sourceTypes: ["parsed_resume"],
      groundedCategories: ["professionalSummary"],
      unavailableCategories: ["workArrangement"],
      canonicalProfileVersion: "internal",
    },
  },
  enterpriseProfile: {
    identity: {
      name: "Candidate",
      profileTitle: "SAP Consultant",
      currentTitle: "SAP Consultant",
      currentCompany: "DXC Technology/",
      headline: "",
      location: "Malaysia",
      country: "Malaysia",
    },
    employmentTimeline: [
      {
        id: "e1",
        company: "DXC Technology/",
        title: "Consultant",
        location: "Malaysia",
        modules: ["ECC 6.0"],
        achievements: ["Delivered support."],
        start: "2020",
        end: "Present",
        duration: "4 years",
        current: true,
        linkedProjectIds: ["p1"],
        provenance: [{ fieldPath: "resume.experience.0" }],
      },
    ],
    projects: [
      {
        id: "p1",
        name: "Project",
        client: "Client",
        employer: "DXC Technology/",
        industry: "",
        country: "Malaysia",
        role: "Consultant",
        modules: ["ECC 6.0"],
        projectType: "Implementation",
        implementationType: "",
        start: "2020",
        end: "2021",
        duration: "1 year",
        responsibilities: [
          "0 EHP7 Implementation Project - Phase I.",
          "0\u00a0Implementation Phase II - HR, PP, Product Costing.",
          "0 Implementation Prototyping Project.",
          "0 Reimplementation for PSAK10..",
          "Configured SAP FI. □ Supported ECC 6.0 rollout.  Conducted UAT.",
        ],
        teamSize: null,
        environment: "",
        evidenceState: "source_extracted",
        fieldEvidence: {
          client: {
            value: "Client",
            evidenceState: "source_extracted",
            provenance: [
              {
                sourceType: "parsed_resume",
                fieldPath: "resume.narrativeProjects.2.client",
                label: "raw",
                excerpt: "secret",
              },
            ],
          },
        },
      },
    ],
    certifications: ["Genovate course [phone redacted]"],
    quality: {
      extraction: {
        experience: { status: "available" },
        projects: { status: "available" },
      },
    },
  },
  education: [
    {
      id: "ed1",
      institution: { value: "IPB" },
      qualification: { value: "Degree" },
      fieldOfStudy: { value: "Finance" },
      graduationYear: { value: "2000" },
    },
  ],
  location: { value: "Malaysia" },
  contactInfo: {
    email: { value: "person@example.com" },
    phone: { value: "+60 12 345 6789" },
  },
} as unknown as Candidate360Profile;
const publicDetail = buildSearchV2RecruiterCandidateDetail(fakeProfile);
const publicJson = JSON.stringify(publicDetail);
for (const project of publicDetail.enterpriseProfile.projects)
  for (const responsibility of project.responsibilities)
    assert.deepEqual(
      candidatePresentationResponsibilityIssues(responsibility),
      [],
      "the serialized recruiter DTO contains only presentation-safe responsibilities",
    );
assert.doesNotMatch(
  publicJson,
  /fieldEvidence|provenance|sourceType|sourceField|sourceRef|fieldPath|contactInfo|parsed_resume/,
);
assert.doesNotMatch(
  publicJson,
  /\[(?:phone|email) redacted\]|person@example\.com|\+60 12/i,
);
assert.match(publicJson, /Genovate course/);
assert.match(publicJson, /ECC 6\.0/);
assert.equal(publicDetail.enterpriseProfile.projects.length, 1);
assert.equal(publicDetail.enterpriseProfile.employmentTimeline.length, 1);
assert.deepEqual(publicDetail.enterpriseProfile.projects[0].responsibilities, [
  "EHP7 Implementation Project - Phase I.",
  "Implementation Phase II - HR, PP, Product Costing.",
  "Implementation Prototyping Project.",
  "Reimplementation for PSAK10.",
  "Configured SAP FI.",
  "Supported ECC 6.0 rollout.",
  "Conducted UAT.",
]);
assert.deepEqual(
  buildSearchV2RecruiterCandidateDetail(fakeProfile).enterpriseProfile
    .projects[0].responsibilities,
  publicDetail.enterpriseProfile.projects[0].responsibilities,
  "final recruiter responsibility normalization is deterministic and idempotent",
);

const safeSearch = sanitizeSearchV2RecruiterResponse({
  source: { type: "candidate_api", rawMatchingRows: 1 },
  executionProfile: { hash: "private" },
  eligibilityDiagnostic: { reason: "private" },
  results: [
    {
      candidateId: "privacy-candidate",
      score: { finalScore: 88, keywordScore: 40, qualityScore: 90 },
      criteriaDiagnostic: {
        scorePercent: 90,
        criteria: [{ provenance: { sourceField: "resume.skills" } }],
      },
      targetEvidence: {
        target: "FICO",
        tier: "exact_verified",
        strength: 1,
        matchedIndicators: ["FICO"],
        relatedConcepts: [],
        professionalContextType: "project",
        sourceField: "resume.skills",
        matchedLiteral: "private",
        evidenceSourceType: "raw_professional_text",
      },
      explanation: {
        matchedTerms: ["FICO"],
        matchedSkills: ["FICO"],
        matchedSapModules: ["FICO"],
        matchedIndustries: [],
        missingSkills: [],
        confidenceLevel: "high",
        reasons: ["raw block"],
        warnings: [],
      },
      evidence: [
        {
          label: "Profile evidence",
          value: "Call +60 12 345 6789 or person@example.com for details",
          source: "parsed_resume",
        },
      ],
      integrity: {
        attention: false,
        requirements: [
          {
            id: "r1",
            label: "FICO",
            state: "verified",
            reason: "Supported",
            provenance: { sourceField: "resume.skills" },
          },
        ],
      },
    },
  ],
});
const searchJson = JSON.stringify(safeSearch);
assert.doesNotMatch(
  searchJson,
  /executionProfile|eligibilityDiagnostic|criteriaDiagnostic|keywordScore|qualityScore|sourceField|matchedLiteral|evidenceSourceType|parsed_resume|person@example\.com|\+60 12/,
);
assert.match(searchJson, /"finalScore":88/);

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
const overviewUi = fs.readFileSync(
  "components/CanonicalProfileOverview.tsx",
  "utf8",
);
assert.match(drawer, /role="tablist"/);
assert.match(drawer, /role="tab"/);
assert.match(drawer, /aria-controls=/);
assert.match(drawer, /role="tabpanel"/);
assert.match(drawer, /aria-labelledby=/);
assert.match(drawer, /candidateProfileTabAccessibility\(tab === item\)/);
assert.match(drawer, /event\.pointerType === "mouse"/);
assert.match(drawer, /event\.currentTarget\.blur\(\)/);
assert.match(drawer, /ArrowRight/);
assert.match(drawer, /\.focus\(\)/);
assert.match(drawer, /header className="shrink-0/);
assert.doesNotMatch(
  `${drawer}\n${overviewUi}`,
  /Source details|Search details|fieldEvidence|sourceField|sourceType/,
);

console.log("searchV2AuthenticatedRuntimeFinalBatch.test.ts passed");
