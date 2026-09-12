import assert from "node:assert/strict";
import { createElement } from "react";
import type { ReactNode } from "react";
import {
  buildCandidateMatchPreview,
  buildCandidateSearchV2ProfilePreview,
  dedupeCandidatePreviewSkills,
  orderedCandidatePreviewSkills,
} from "../lib/candidateSearchV2ProfilePreview";
import { CompactCandidateCard } from "../app/recruiter/talent-search/v2/CandidateSearchV2Client";
import { parseRecruiterSearchIntent } from "../lib/recruiterSearchPresentation";
import type { CanonicalProfileOverview } from "../lib/candidateProfileOverview";
import {
  canonicalCandidateSkillCollection,
  relevantCandidateSkills,
} from "../lib/candidateProfileSkills";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

assert.deepEqual(
  dedupeCandidatePreviewSkills([
    "SAP FICO",
    "FICO",
    "FI/CO",
    "SAP S/4HANA",
    "SAP S/4HANA",
  ]),
  ["SAP FICO", "SAP S/4HANA"],
);

const matchPreview = buildCandidateMatchPreview(
  [
    {
      id: "target:FICO",
      label: "SAP FICO",
      kind: "target",
      state: "supported",
    },
    {
      id: "location",
      label: "Malaysia",
      kind: "location",
      state: "manual_review",
    },
    {
      id: "contract",
      label: "Contract availability",
      kind: "skill",
      state: "not_available",
    },
  ],
  [
    {
      id: "depth",
      label: "Implementation experience",
      state: "supported",
      score: 85,
      assignmentEvidence: {
        directTargetAssignments: 3,
        directTargetLifecycleAssignments: 2,
      },
    },
  ],
);
assert.deepEqual(
  matchPreview.map((item) => item.state),
  ["met", "partly_supported", "not_found", "met"],
);
assert.match(matchPreview[3]!.explanation, /2 relevant delivery assignments/);

const overview = {
  identity: {
    name: "Synthetic Candidate",
    publicToken: "#123ABC",
    talentPool: "SAP Talent Hub",
    profileTitle: "SAP FICO Consultant",
    location: "Kuala Lumpur, Malaysia",
    summary: null,
  },
  confidence: {
    profileDataConfidencePercent: 80,
    sourceCompletenessPercent: 75,
    profileCompletenessPercent: 70,
    label: "Good",
  },
  career: {
    totalExperienceYears: 12,
    currentEmployment: null,
    currentEmployments: [],
    latestEmployment: {
      id: "employment-1",
      title: "Senior SAP FICO Consultant",
      employer: "Example Consulting",
      start: "Jan 2020",
      end: "Dec 2024",
      current: false,
    },
    currentRoleTenureYears: null,
    latestEmployer: "Example Consulting",
    latestRole: "Senior SAP FICO Consultant",
    employmentCount: 4,
    projectCount: 3,
    employmentGaps: [],
  },
  skills: {
    sapModules: [{ value: "SAP FICO" }, { value: "FI/CO" }],
    functional: [{ value: "Financial accounting" }],
    technical: [{ value: "SAP S/4HANA" }],
    lifecycle: ["Implementation"],
    totalCount: 4,
  },
  employmentHighlights: [
    {
      id: "employment-1",
      title: "Senior SAP FICO Consultant",
      employer: "Example Consulting",
      start: "Jan 2020",
      end: "Dec 2024",
      current: false,
    },
    {
      id: "employment-2",
      title: "SAP Finance Consultant",
      employer: "Earlier Consulting",
      start: "Jan 2017",
      end: "Dec 2019",
      current: false,
    },
    {
      id: "employment-3",
      title: "Finance Analyst",
      employer: "Example Industry",
      start: "Jan 2013",
      end: "Dec 2016",
      current: false,
    },
  ],
  projectHighlights: [
    {
      id: "project-1",
      name: "Finance transformation",
      client: "Example Client",
      role: "FICO Lead",
      start: "Jan 2022",
      end: "Dec 2022",
      lifecycle: ["Implementation"],
      modules: ["FICO"],
    },
    {
      id: "project-2",
      name: "S/4HANA rollout",
      client: "Second Client",
      role: "FICO Consultant",
      start: "Jan 2021",
      end: "Jun 2021",
      lifecycle: ["Rollout"],
      modules: ["FICO"],
    },
  ],
  education: {
    count: 1,
    highestOrLatest: {
      qualification: "Bachelor's degree",
      fieldOfStudy: "Accounting",
      institution: "Example University",
      completionDate: null,
    },
  },
  certifications: { count: 1, items: [{ value: "SAP Finance certification" }] },
  training: { count: 0, items: [] },
  languages: [{ value: "English" }],
  workArrangement: {},
  dataQuality: {
    groundedCategories: [],
    unavailableCategories: [],
    sourceTypes: [],
    indexedVersion: "test",
  },
} as unknown as CanonicalProfileOverview;

const profilePreview = buildCandidateSearchV2ProfilePreview(overview);
const canonicalSkills = canonicalCandidateSkillCollection(overview);
assert.equal(profilePreview.employment.length, 3);
assert.equal(profilePreview.projects.length, 2);
assert.equal(profilePreview.employmentCount, 4);
assert.equal(profilePreview.projectCount, 3);
assert.equal(profilePreview.skillCount, canonicalSkills.total);
assert.deepEqual(
  relevantCandidateSkills(profilePreview.skills, ["FICO", "project-only BPC"]),
  ["SAP FICO"],
  "query-only project terms cannot inflate the canonical skill preview",
);
assert.deepEqual(
  orderedCandidatePreviewSkills(
    profilePreview,
    ["SAP FICO"],
    ["BPC", "GL", "BW", "MM"],
  ),
  profilePreview.skills,
  "legacy scoring fallbacks must not be merged into a canonical Internal preview",
);

const markup = renderToStaticMarkup(
  createElement(CompactCandidateCard, {
    result: {
      retrievalKind: "evaluated_match",
      evaluation: { kind: "recruiter_fit" },
      candidateId: "synthetic-candidate",
      talentPool: "internal_profiles",
      candidateName: "Synthetic Candidate",
      currentTitle: "SAP FICO Consultant",
      currentEmployer: null,
      location: "Kuala Lumpur",
      country: "Malaysia",
      totalYearsExperience: 12,
      score: { finalScore: 88 },
      rankingScore: 88,
      overallMatchScore: 88,
      matchLabel: "Strong Match",
      explanation: null,
      verifiedSkills: [],
      verifiedSapModules: ["SAP FICO"],
      queryRelevantSkills: ["SAP FICO", "FICO"],
      implementationEvidenceCount: 2,
      implementationEvidenceLevel: "source_text_evidence",
      seniorityEvidenceLevel: "source_text_evidence",
      profilePreview,
      integrity: {
        version: "test",
        eligible: true,
        broadeningApplied: false,
        verified: 0,
        supported: 1,
        attention: 0,
        requirements: [
          {
            id: "target:FICO",
            criterionId: "target:FICO",
            label: "SAP FICO",
            kind: "target",
            required: true,
            state: "supported",
            reason: "Supported by the candidate profile.",
          },
        ],
      },
    } as never,
    rank: 1,
    searchContextId: "rich-preview-test",
    intent: parseRecruiterSearchIntent("SAP FICO implementation consultant"),
    expanded: false,
    diagnostic: {
      matchLevel: "Strong Match",
      evidenceConfidence: "High",
      evidenceCoveragePercent: 85,
      requirementCoveragePercent: 100,
      requirements: [],
      criteria: [
        {
          id: "depth",
          label: "Implementation experience",
          state: "supported",
          score: 85,
          reason: "Supported",
          assignmentEvidence: {
            directTargetAssignments: 3,
            directTargetLifecycleAssignments: 2,
          },
        },
      ],
    } as never,
    onToggle: () => undefined,
  }),
);
for (const expected of [
  "Latest known role",
  "88% Strong Match",
  "Match summary",
  "Met: SAP FICO",
  "SAP FICO",
  "Recent experience",
  "Relevant projects",
  "Education",
  "View all experience",
  "View all projects",
  "Open profile",
])
  assert.match(markup, new RegExp(expected));
assert.doesNotMatch(markup, /Company not provided|Evidence confidence/);
assert.doesNotMatch(markup, /project-only BPC/);

const unnamedMarkup = renderToStaticMarkup(
  createElement(CompactCandidateCard, {
    result: {
      retrievalKind: "identity_match",
      evaluation: null,
      candidateId: "0bd318-fixture",
      candidateName: null,
      talentPool: "internal_profiles",
      currentTitle: null,
      currentEmployer: null,
      location: "Malaysia",
      country: "Malaysia",
      totalYearsExperience: null,
      score: null,
      verifiedSkills: [],
      verifiedSapModules: [],
      queryRelevantSkills: ["BPC", "GL", "BW", "MM"],
      profilePreview: {
        employmentCount: 14,
        projectCount: 2,
        educationCount: 0,
        certificationCount: 0,
        trainingCount: 0,
        skillCount: 4,
        currentEmployment: null,
        latestEmployment: null,
        employment: [],
        projects: [],
        education: null,
        certifications: [],
        training: [],
        skills: [
          "FICO",
          "Migration",
          "Support / Enhancement",
          "Bahasa Malaysia",
        ],
      },
    } as never,
    rank: 1,
    searchContextId: "unnamed-profile-test",
    intent: parseRecruiterSearchIntent("#0BD318"),
    expanded: false,
    diagnostic: {
      matchLevel: "Identity match",
      evidenceConfidence: "Limited",
      evidenceCoveragePercent: 0,
      requirements: [],
      criteria: [],
    } as never,
    onToggle: () => undefined,
    identityLookup: true,
  }),
);
assert.match(unnamedMarkup, /Candidate #[A-Z0-9]{6}/);
assert.match(unnamedMarkup, /Name not provided/);
assert.match(unnamedMarkup, /Profile skills \(4\)/);
for (const skill of [
  "FICO",
  "Migration",
  "Support / Enhancement",
  "Bahasa Malaysia",
])
  assert.match(unnamedMarkup, new RegExp(skill.replace("/", "\\/")));
assert.doesNotMatch(
  unnamedMarkup,
  /Name unavailable|Profile identity incomplete/,
);
assert.doesNotMatch(unnamedMarkup, /BPC|>GL<|>BW<|>MM<|\+\d+ more/);

const clientSource = require("node:fs").readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(clientSource, /profilePreview/);
assert.match(clientSource, /onPointerEnter=\{\(\) =>/);
assert.match(clientSource, /onFocus=\{\(\) =>/);
assert.match(
  clientSource,
  /knownRequestReadiness\.ready[\s\S]*\? knownRequestReadiness[\s\S]*loadSearchV2SourceReadiness/,
  "a ready Internal index must not trigger a second serial readiness request",
);
assert.match(clientSource, /onOpenTab=\{\(tab\) =>/);
assert.match(clientSource, /initialTab=\{drawerInitialTab\}/);
assert.match(clientSource, /aria-label="Search criteria summary"/);
assert.match(clientSource, /Edit search/);
assert.match(clientSource, /New search/);
assert.match(
  clientSource,
  /guidedWorkspace === "review" \|\| showCompactSearchSummary/,
);
assert.doesNotMatch(clientSource, /results\.map[\s\S]{0,300}fetch\(/);

const drawerSource = require("node:fs").readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(drawerSource, /initialTab\?: CandidateProfileTab/);
assert.match(drawerSource, /availableTabs\.includes\(initialTab\)/);

console.log("Search V2 rich candidate preview regression tests passed.");
