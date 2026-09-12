import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { performance } from "node:perf_hooks";
import {
  candidateProfileMissingInformation,
  candidateProfileTabClassName,
  candidateProfileTabState,
  cleanEmploymentResponsibilities,
  splitCredentials,
} from "../lib/candidateProfilePresentation";
import {
  canonicalLookupMatches,
  confirmSearchV2IdentityIntent,
  detectSearchV2UnifiedIntent,
} from "../lib/searchV2UnifiedIntent";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import type { CanonicalProfileOverview } from "../lib/candidateProfileOverview";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { canonicalCandidateSkillCollection } from "../lib/candidateProfileSkills";

const document = (
  candidateId: string,
  candidateName: string | null,
): CandidateSearchV2Document => ({
  candidateId,
  canonicalCandidateId: candidateId,
  sourceCandidateIds: [candidateId],
  candidateName,
  alternateNames: [],
  currentTitle: null,
  currentEmployer: null,
  historicalEmployers: [],
  location: null,
  country: null,
  totalYearsExperience: null,
  skills: [],
  sapModules: [],
  languages: [],
  industries: [],
  searchableText: candidateName || "",
  profileEvidence: {
    name: Boolean(candidateName),
    title: false,
    employer: false,
    location: false,
    experienceDuration: false,
    employmentHistory: false,
    projectHistory: false,
    education: false,
    certifications: false,
    skills: false,
  },
  domainEvidence: {},
  implementationEvidenceLevel: "unverified",
  seniorityEvidenceLevel: "unverified",
  locationEvidenceState: "UNKNOWN",
  trustedCandidateEvidence: { candidateId, values: [] },
});

const gunawan = document("af0ddf0e-7e60-4271-a550-ad1044f59634", "Gunawan Lie");
for (const query of ["Gunawan Lie", "gunawan lie", "  Gunawan   Lie  "]) {
  const detected = detectSearchV2UnifiedIntent(query);
  const intent = confirmSearchV2IdentityIntent([gunawan], query, detected);
  assert.equal(intent.type, "candidate_name_lookup");
  assert.deepEqual(
    canonicalLookupMatches([gunawan], intent).map(
      (item) => item.document.candidateId,
    ),
    [gunawan.candidateId],
  );
}
assert.equal(
  detectSearchV2UnifiedIntent(
    "Job description: lead finance transformation responsibilities and required qualifications",
  ).type,
  "job_description_search",
);
assert.equal(
  canonicalLookupMatches(
    [gunawan],
    confirmSearchV2IdentityIntent(
      [gunawan],
      "Person Who Does Not Exist",
      detectSearchV2UnifiedIntent("Person Who Does Not Exist"),
    ),
  ).length,
  0,
);

const nameless = document("d488242f-24db-493c-987d-9e4bfbb975e8", null);
for (const query of ["#B975E8", "B975E8", "#b975e8", "b975e8"])
  assert.equal(
    canonicalLookupMatches([nameless], detectSearchV2UnifiedIntent(query))
      .length,
    1,
    `${query} must resolve the unavailable-name profile without fit scoring`,
  );

const population = Array.from({ length: 822 }, (_, index) => {
  const suffix = (index + 1).toString(16).toUpperCase().padStart(6, "0");
  return document(
    `00000000-0000-0000-0000-000000${suffix}`,
    `Person ${index + 1}`,
  );
});
for (const item of population) {
  const token = `#${item.candidateId
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()}`;
  assert.equal(
    canonicalLookupMatches(population, detectSearchV2UnifiedIntent(token))
      .length,
    1,
  );
}

const credentials = splitCredentials([
  "SAP Certified Application Associate - Financial Accounting",
  "HCL Axon - SAP Certified Application Associate - Management Accounting",
  "ITIL Foundation Certificate in ITSM",
  "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
]);
assert.equal(credentials.certifications.length, 3);
assert.deepEqual(credentials.training, [
  "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
]);
assert.deepEqual(
  splitCredentials(["GKK Consultants Sdn Bhd - SAP Data Medium Excha"])
    .training,
  ["GKK Consultants Sdn Bhd - SAP Data Medium Exchange"],
);
const recoveredCredential = normalizeActualCandidateSchema({
  id: "credential-boundary-fixture",
  certifications: ["GKK Consultants Sdn Bhd - SAP Data Medium Excha"],
  raw_text:
    "TRAINING GKK Consultants Sdn Bhd - SAP Data Medium Exchange Engine & Payment Medium Workbench",
});
assert.deepEqual(recoveredCredential.certifications, [
  "GKK Consultants Sdn Bhd - SAP Data Medium Exchange",
]);
const recoveredEducation = normalizeActualCandidateSchema({
  id: "source-complete-education-fixture",
  raw_text: `ACADEMIC BACKGROUND
Solution Consultant mySAP Financials& Managerial Accounting 1 (TFIN10) Genovate Training Academy (Kuala Lumpur) 2002 -2003
Postgraduate Certificates in Information Technology APIIT- Staffordshire University (Kuala Lumpur) 1996 -1999
Bachelor of Business (Accountancy) Royal Melbourne Institute of Technology University (RMIT) (Kuala Lumpur) 1992 -1994
STPM TAR College (Kuala Lumpur) 1990 -1991
SPM Sek Men Seri Garing (Rawang)
CAREER SUMMARY SAP support experience.`,
});
assert.deepEqual(
  recoveredEducation.enterpriseProfile.education.map((item) => ({
    qualification: item.qualification,
    institution: item.institution,
    startYear: item.startYear,
    endYear: item.endYear,
  })),
  [
    {
      qualification: "Postgraduate Certificates in Information Technology",
      institution: "APIIT- Staffordshire University",
      startYear: "1996",
      endYear: "1999",
    },
    {
      qualification: "Bachelor of Business (Accountancy)",
      institution: "Royal Melbourne Institute of Technology University (RMIT)",
      startYear: "1992",
      endYear: "1994",
    },
    {
      qualification: "STPM",
      institution: "TAR College",
      startYear: "1990",
      endYear: "1991",
    },
    {
      qualification: "SPM",
      institution: "Sek Men Seri Garing (Rawang)",
      startYear: "",
      endYear: "",
    },
  ],
);
assert.deepEqual(recoveredEducation.enterpriseProfile.certifications, [
  "Solution Consultant mySAP Financials& Managerial Accounting 1 (TFIN10) Genovate Training Academy (Kuala Lumpur) 2002 -2003",
]);
const recoveredGraduatedEducation = normalizeActualCandidateSchema({
  id: "graduated-education-fixture",
  raw_text:
    "EDUCATION Graduated from IPB, Majoring in Nutrition Science and Feed Technology (2012) Graduated from SMA La Tansa (2006) ORGANIZATION EXPERIENCE Volunteer",
});
assert.deepEqual(
  recoveredGraduatedEducation.enterpriseProfile.education.map((item) => [
    item.institution,
    item.fieldOfStudy,
    item.endYear,
  ]),
  [
    ["IPB", "Nutrition Science and Feed Technology", "2012"],
    ["SMA La Tansa", "", "2006"],
  ],
);

const overview = {
  career: { employmentCount: 12, projectCount: 10 },
  education: { count: 0 },
  certifications: { count: 3 },
  training: { count: 1 },
  skills: {
    totalCount: 8,
    sapModules: [
      { value: "FICO" },
      { value: "PS" },
      { value: "MM" },
      { value: "SD" },
    ],
    functional: [{ value: "Finance" }, { value: "Controlling" }],
    technical: [{ value: "SOLMAN" }, { value: "ServiceNow" }],
    lifecycle: ["Implementation"],
  },
  languages: [{ value: "English" }],
} as unknown as CanonicalProfileOverview;
const humanizedTaxonomySkills = canonicalCandidateSkillCollection({
  ...overview,
  skills: {
    ...overview.skills,
    sapModules: [{ value: "PI_PO" }],
  },
});
assert.deepEqual(
  humanizedTaxonomySkills.items.map((item) => item.value),
  [
    "SAP PI/PO",
    "Finance",
    "Controlling",
    "Implementation",
    "SOLMAN",
    "ServiceNow",
    "English",
  ],
);
assert.equal(
  humanizedTaxonomySkills.items.some((item) => item.value.includes("_")),
  false,
);
assert.deepEqual(
  Object.fromEntries(
    candidateProfileTabState(overview).map((item) => [
      item.tab,
      [item.count, item.enabled],
    ]),
  ),
  {
    Overview: [null, true],
    Experience: [12, true],
    Projects: [10, true],
    Education: [4, true],
    Skills: [10, true],
  },
);
const empty = {
  ...overview,
  career: { employmentCount: 0, projectCount: 1 },
  education: { count: 0 },
  certifications: { count: 0 },
  training: { count: 0 },
} as CanonicalProfileOverview;
assert.equal(
  candidateProfileTabState(empty).find((item) => item.tab === "Experience")
    ?.enabled,
  true,
);
assert.equal(
  candidateProfileTabState(empty).find((item) => item.tab === "Education")
    ?.enabled,
  true,
);

const activeTabClass = candidateProfileTabClassName(true, true);
const availableTabClass = candidateProfileTabClassName(false, true);
const disabledTabClass = candidateProfileTabClassName(false, false);
assert.match(activeTabClass, /border-cyan-300/);
assert.match(activeTabClass, /font-semibold/);
assert.match(activeTabClass, /text-cyan-200/);
assert.match(availableTabClass, /cursor-pointer/);
assert.match(availableTabClass, /text-slate-400/);
assert.match(availableTabClass, /hover:text-slate-200/);
assert.match(availableTabClass, /outline-none/);
assert.match(availableTabClass, /focus-visible:outline-cyan-300/);
assert.match(disabledTabClass, /cursor-pointer/);
assert.match(disabledTabClass, /text-slate-400/);
assert.notEqual(activeTabClass, availableTabClass);
assert.equal(availableTabClass, disabledTabClass);

const gunawanOverview = {
  ...overview,
  career: { employmentCount: 0, projectCount: 3 },
  education: { count: 0 },
  certifications: { count: 0 },
  training: { count: 0 },
  skills: {
    totalCount: 9,
    sapModules: [{ value: "FICO" }, { value: "CO" }, { value: "FI" }],
    functional: [{ value: "Financial accounting" }, { value: "Controlling" }],
    technical: [{ value: "SAP ECC" }, { value: "SAP S/4HANA" }],
    lifecycle: ["Implementation", "Support"],
  },
  languages: [{ value: "English" }, { value: "Bahasa Indonesia" }],
  workArrangement: {
    workAuthorization: null,
    remote: null,
    relocation: null,
    travel: null,
    noticePeriod: null,
    availability: null,
  },
} as unknown as CanonicalProfileOverview;
assert.deepEqual(
  Object.fromEntries(
    candidateProfileTabState(gunawanOverview).map((item) => [
      item.tab,
      [item.count, item.enabled],
    ]),
  ),
  {
    Overview: [null, true],
    Experience: [0, true],
    Projects: [3, true],
    Education: [0, true],
    Skills: [11, true],
  },
);
assert.deepEqual(candidateProfileMissingInformation(gunawanOverview), [
  "Employment",
  "formal education",
  "Certifications",
  "work arrangement",
]);
const tabSwitchStarted = performance.now();
for (let index = 0; index < 1_000; index += 1) {
  candidateProfileTabClassName(index % 3 === 0, index % 3 !== 2);
  candidateProfileTabState(gunawanOverview);
}
assert.ok(
  performance.now() - tabSwitchStarted < 100,
  "loaded tab-state transitions remain comfortably below 100 ms without profile reloading",
);

const broken = [
  "mplementation for Accountant General Office...",
  "I Operating Company SdnBhd Specific Responsibilities...",
  "lyst (FICO), Solution and Services Support Specific Responsibilities...",
  "ng senior auditors and managers...",
];
assert.deepEqual(cleanEmploymentResponsibilities(broken), []);
assert.deepEqual(
  cleanEmploymentResponsibilities([
    "Configured SAP FI/CO reporting and resolved production issues.",
    "Configured SAP FI/CO reporting and resolved production issues.",
  ]),
  ["Configured SAP FI/CO reporting and resolved production issues."],
);

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
const overviewUi = fs.readFileSync(
  "components/CanonicalProfileOverview.tsx",
  "utf8",
);
assert.doesNotMatch(drawer, /disabled={!enabled}/);
assert.match(drawer, /role="tablist"/);
assert.match(drawer, /role="tab"/);
assert.match(drawer, /role="tabpanel"/);
assert.match(drawer, /data-tab-state=/);
assert.match(drawer, /onClick=\{\(event\) => \{[\s\S]*setTab\(item\)/);
assert.match(
  drawer,
  /\[candidate\.candidateId, candidate\.talentPool, initialTab, retryRevision\]/,
);
assert.doesNotMatch(
  drawer,
  /Panel title=\{identityLookup \? "Identity lookup"/,
);
assert.match(drawer, /No information available/);
assert.match(drawer, /data-education-section="certifications"/);
assert.doesNotMatch(drawer, />No responsibilities provided</);
assert.doesNotMatch(drawer, /Source details/);
assert.doesNotMatch(drawer, /Complete grounded employment timeline/);
assert.doesNotMatch(drawer, /Canonical project assignments/);
assert.doesNotMatch(overviewUi, /Profile truth/);
assert.match(overviewUi, /focus="certifications"/);
assert.match(overviewUi, /destination="Education"/);
assert.match(overviewUi, /Information not available:/);
assert.doesNotMatch(overviewUi, /<Section title="Profile context">/);
assert.match(overviewUi, /canonicalCandidateSkillCollection\(overview\)/);
assert.doesNotMatch(overviewUi, /overview\.skills\.sapModules\.slice/);
assert.doesNotMatch(
  overviewUi,
  /No grounded employment history was provided in the selected[\s\S]*profile source/,
);
assert.doesNotMatch(overviewUi, /No education information available/);
assert.doesNotMatch(overviewUi, /sourceContext|Retrieval status|Source types/);

async function verifyDetailCache() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };
  const {
    clearSearchV2CandidateDetailCacheForTests,
    loadSearchV2CandidateDetail,
  } = await import("../lib/searchV2CandidateDetailCache");
  clearSearchV2CandidateDetailCacheForTests();
  let loads = 0;
  const loader = async () => {
    loads += 1;
    return { candidateId: "cached" } as never;
  };
  const [first, shared] = await Promise.all([
    loadSearchV2CandidateDetail("cached", loader),
    loadSearchV2CandidateDetail("cached", loader),
  ]);
  const warm = await loadSearchV2CandidateDetail("cached", loader);
  assert.equal(
    loads,
    1,
    "concurrent and warm detail reads reuse one versioned projection",
  );
  assert.equal(first.profile?.candidateId, "cached");
  assert.equal(shared.profile?.candidateId, "cached");
  assert.equal(warm.cacheHit, true);
}

void verifyDetailCache().then(() => {
  console.log("Search V2 recruiter profile daily-use regressions passed.");
});
