import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canonicalizeEnterpriseProjects,
  normalizeActualCandidateSchema,
} from "../lib/candidate360SchemaNormalize";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { buildCanonicalProfileOverview } from "../lib/candidateProfileOverview";
import {
  calculateTotalCareerYears,
  formatTotalCareerExperience,
} from "../lib/candidateCareerExperience";
import { identityOnlyCandidateProjection } from "../lib/searchV2UnifiedIntent";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import { canonicalLifecycleEvidence } from "../lib/searchV2Lifecycle";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

const profileFrom = (raw: Record<string, unknown>) => {
  const normalized = normalizeActualCandidateSchema(raw);
  return buildCandidate360Profile({ ...raw, ...normalized });
};

const confidenceProfile = profileFrom({
  id: "confidence",
  name: "Confidence Candidate",
  extraction_confidence: 91,
  profile_quality_score: 63,
  sap_modules: ["FICO"],
  languages: ["English"],
});
const confidenceOverview = buildCanonicalProfileOverview(confidenceProfile);
assert.equal(
  confidenceOverview.profileQuality.profileDataConfidencePercent,
  91,
);
assert.equal(
  confidenceOverview.profileQuality.profileCompletenessPercent,
  confidenceProfile.enterpriseProfile.quality.profileCompleteness,
);
assert.equal(
  confidenceOverview.profileQuality.sourceCompletenessPercent,
  Math.round(
    (confidenceProfile.enterpriseProfile.quality.completenessComponents.filter(
      (item) => item.state !== "missing",
    ).length /
      confidenceProfile.enterpriseProfile.quality.completenessComponents
        .length) *
      100,
  ),
);
const identityProjection = identityOnlyCandidateProjection({
  candidateId: "confidence",
  candidateName: "Confidence Candidate",
  dataConfidenceScore: 91,
  profileQualityScore: 63,
  profileEvidence: {
    name: true,
    title: false,
    employer: false,
    location: false,
    experienceDuration: false,
    employmentHistory: false,
    projectHistory: false,
    education: false,
    certifications: false,
    skills: true,
  },
});
assert.equal(
  identityProjection.profileDataConfidencePercent,
  91,
  "identity cards use canonical profile-data confidence rather than completeness",
);
assert.equal(
  identityProjection.profileCompletenessPercent,
  63,
  "identity cards use canonical profile completeness unchanged",
);
assert.notEqual(
  confidenceOverview.profileQuality.profileDataConfidencePercent,
  confidenceOverview.profileQuality.profileCompletenessPercent,
);
const language = confidenceOverview.languages[0];
assert.equal(language.evidenceStatus, "source_supported");
assert.equal(language.verificationStatus, "not_verified");
assert.equal(
  confidenceOverview.skills.sapModules[0].verificationStatus,
  "not_verified",
);

const gunawan = profileFrom({
  id: "gunawan",
  name: "Gunawan Lie",
  current_title:
    "Senior SAP consultant with experience of over 20 years covering various roles within",
  raw_text: `PROFESSIONAL SUMMARY Senior SAP consultant with experience of over 20 years covering various roles within SAP.
  RELEVANT PROJECT EXPERIENCE
  Company client: Vestas wind energy Company: Vestas wind energy Duration: November 2008 – July 2009 Position: Senior SAP Consultant Responsibilities (SAP Go-live support) Configured FI/CO and conducted testing for a global SAP rollout.
  Company client: Schering Plough Company: Schering Plough Duration: October 2006 – October 2008 Position: Senior SAP Consultant (FICO) / Lead Consultant Application: SAP rollout for FICO Project Implementation Responsibilities: Configured and tested SAP FICO.`,
});
assert.equal(gunawan.enterpriseProfile.identity.profileTitle, "");
assert.match(
  gunawan.enterpriseProfile.professionalSummary || "",
  /over 20 years/i,
);
assert.equal(
  gunawan.enterpriseProfile.employmentTimeline.length,
  0,
  "project fields do not manufacture employment",
);
const vestas = gunawan.enterpriseProfile.projects.find((item) =>
  /Vestas/i.test(item.client),
);
const schering = gunawan.enterpriseProfile.projects.find((item) =>
  /Schering/i.test(item.client),
);
assert.deepEqual(
  [vestas?.start, vestas?.end, vestas?.role],
  ["November 2008", "July 2009", "Senior SAP Consultant"],
);
assert.deepEqual(
  [schering?.start, schering?.end],
  ["October 2006", "October 2008"],
);
assert.match(schering?.role || "", /Senior SAP Consultant.*FICO/i);

const teck = profileFrom({
  id: "teck-concurrent",
  name: "Teck Chiewlim",
  experience: [
    {
      id: "magnus",
      company: "Magnus",
      title: "SAP FICO Functional Consultant",
      start_date: "Jan 2004",
      end_date: "Present",
    },
    {
      id: "ibm",
      company: "IBM",
      title: "Project Consultant",
      start_date: "Mar 2003",
      end_date: "Present",
    },
  ],
});
const teckOverview = buildCanonicalProfileOverview(teck);
assert.equal(
  teckOverview.career.currentEmployments.length,
  2,
  "both explicitly Present roles remain auditable",
);
assert.equal(
  teckOverview.career.currentEmployment?.employer,
  "Magnus",
  "latest-starting current role is primary",
);
assert.equal(
  teck.enterpriseProfile.experienceSummary.totalCareerYears,
  calculateTotalCareerYears(teck.enterpriseProfile.employmentTimeline),
  "concurrent intervals are counted as a union",
);
assert.equal(formatTotalCareerExperience(23.6), "24 years experience");

const project = (id: string, role: string) => ({
  id,
  name: `Implementation ${id}`,
  client: `Client ${id}`,
  role,
  modules: ["FICO"],
  projectType: "Implementation",
  implementationType: "Implementation",
  responsibilities: [
    "Configured and implemented SAP FICO for this client assignment.",
  ],
  start: "",
  end: "",
  duration: null,
  country: "",
  industry: "",
  environment: "",
  teamSize: null,
  evidenceState: "source_extracted" as const,
  fieldEvidence: {
    responsibilities: {
      value: [
        "Configured and implemented SAP FICO for this client assignment.",
      ],
      evidenceState: "source_extracted" as const,
      provenance: [
        {
          sourceType: "parsed_resume" as const,
          sourceRef: id,
          fieldPath: `projects.${id}`,
        },
      ],
    },
  },
});
const projects = [
  project("one", "FICO Team Leader"),
  project("two", "FI/CO Team Member"),
];
const complementaryFragments = canonicalizeEnterpriseProjects([
  {
    ...project("dated-fragment", ""),
    name: "",
    client: "Project JLRM Retail",
    start: "Nov 2018",
    end: "Jan 2021",
  },
  {
    ...project("role-fragment", "SAP Senior Consultant - FICO"),
    name: "",
    client: "Jaguar Land Rover Malaysia / Delivery Partner",
    start: "",
    end: "",
  },
] as never);
assert.equal(
  complementaryFragments.length,
  1,
  "acronym and expanded-client fragments form one canonical assignment",
);
assert.deepEqual(
  [complementaryFragments[0].start, complementaryFragments[0].end],
  ["Nov 2018", "Jan 2021"],
);
assert.match(complementaryFragments[0].role, /FICO/i);
assert.equal(
  complementaryFragments[0].sourceAssignmentIds?.length,
  2,
  "merged assignment retains both provenance identities",
);
const indraDocument: CandidateSearchV2Document = {
  candidateId: "indra",
  candidateName: "Indra Permana",
  currentTitle: "Business Support Analyst (SAP FICO)",
  canonicalRoleEvidence: [
    {
      title: "Business Support Analyst (SAP FICO)",
      sourceType: "canonical_employment",
      sourceRecordId: "farpoint",
      sourceField: "enterpriseProfile.employmentTimeline.title",
      current: true,
    },
    {
      title: "SAP FICO Consultant",
      sourceType: "canonical_employment",
      sourceRecordId: "krakatau",
      sourceField: "enterpriseProfile.employmentTimeline.title",
      current: false,
    },
    {
      title: "FICO Team Leader",
      sourceType: "canonical_project",
      sourceRecordId: "one",
      sourceField: "enterpriseProfile.projects.role",
      current: false,
    },
  ],
  sapModules: ["FICO"],
  skills: ["FICO"],
  searchConceptIds: ["FICO"],
  searchTargetEvidence: {
    FICO: {
      target: "FICO",
      tier: "exact_supported",
      strength: 96,
      evidenceSourceType: "direct_skill",
      matchedLiteral: "SAP FICO",
      matchedIndicators: ["SAP FICO"],
      sourceField: "request_candidate.skills",
      trusted: true,
      reasonCode: "trusted_professional_cluster",
      relatedConcepts: [],
      sourceRecordId: "indra",
      sourceValueProvenance: "candidate_record_raw",
      professionalContextType: "direct_skill",
    },
  },
  lifecycleEvidence: canonicalLifecycleEvidence("indra", projects as never),
  trustedCandidateEvidence: {
    candidateId: "indra",
    values: [
      {
        value: "SAP FICO",
        sourceType: "direct_skill",
        sourceField: "request_candidate.skills",
        sourceRecordId: "indra",
        provenance: "candidate_record_raw",
        trusted: true,
      },
    ],
  },
};
const request = {
  query: "SAP FICO Consultant with implementation experience",
  talentPool: "internal_profiles" as const,
  filters: {},
  criteria: [],
};
const committed = buildCommittedSearchRequirements(request);
const evaluation = evaluateCommittedCandidate(indraDocument, committed);
assert.equal(
  evaluation.requirements.find((item) => item.kind === "professional_role")
    ?.state,
  "verified",
);
assert.match(
  evaluation.requirements.find((item) => item.kind === "professional_role")
    ?.reason || "",
  /historical role/i,
);
assert.equal(
  evaluation.requirements.find((item) => item.kind === "lifecycle")?.state,
  "supported",
);
assert.equal(
  evaluation.eligible,
  true,
  "the exact query retains a candidate with grounded historical Consultant and implementation assignments",
);

const drawerSource = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
const overviewSource = fs.readFileSync(
  "components/CanonicalProfileOverview.tsx",
  "utf8",
);
const cardSource = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(drawerSource, /Name not provided/);
assert.doesNotMatch(drawerSource, /label: "Certifications"/);
assert.match(drawerSource, /Education and qualifications/);
assert.doesNotMatch(drawerSource, /Verified \/ supported/);
assert.doesNotMatch(drawerSource, /Source-supported · Not verified/);
assert.match(
  overviewSource,
  /destination="Education"\s+focus="certifications"/,
);
assert.doesNotMatch(overviewSource, /Additional current roles/);
assert.match(
  overviewSource,
  /Current employment is not confirmed in this profile/,
);
const missingArrangement = buildCanonicalProfileOverview(
  profileFrom({
    id: "missing-arrangement",
    visa: "Not yet verified",
    relocation: "Not yet verified",
  }),
);
assert.equal(missingArrangement.workArrangement.workAuthorization, null);
assert.equal(missingArrangement.workArrangement.relocation, null);
assert.equal(
  missingArrangement.workArrangement.evidence.workAuthorization.evidenceStatus,
  "unsupported",
);
assert.match(
  overviewSource,
  /onNavigate=\{overview\.education\.count \? onNavigate : undefined\}/,
);
assert.match(
  cardSource,
  /\{!identityLookup \? \([\s\S]*Search-evidence confidence/,
);

console.log("Search V2 final profile consistency tests passed.");
