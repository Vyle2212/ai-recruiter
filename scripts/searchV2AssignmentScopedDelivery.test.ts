import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import { evaluateSearchCriteria } from "../lib/searchV2Criteria";
import { identityBoundTrustedCandidateValues } from "../lib/nicheTargetEvidence";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import {
  canonicalProjectRequirementClassification,
  canonicalLifecycleEvidence,
  targetModuleDeliveryEvidence,
} from "../lib/searchV2Lifecycle";
import {
  canonicalizeEnterpriseProjects,
  type EnterpriseProject,
} from "../lib/candidate360SchemaNormalize";
import { canonicalTalentSearchIdentity } from "../lib/talentSearchDisplay";
import { adaptCandidateToSearchV2Document } from "../lib/candidateSearchV2Adapter";
import { internalSearchV2ResultSummaryText } from "../lib/searchV2ResponseContract";

const project = (
  id: string,
  name: string,
  role: string,
  responsibilities: string[],
  projectType = "Implementation",
  modules: string[] = [],
) =>
  ({
    id,
    name,
    role,
    responsibilities,
    projectType,
    implementationType: "",
    modules,
    client: "Synthetic client",
    country: "",
    industry: "",
    start: "",
    end: "",
    duration: "",
    evidenceState: "supported",
    fieldEvidence: {
      responsibilities: {
        value: responsibilities,
        evidenceState: "supported",
        provenance: [
          {
            sourceType: "parsed_resume",
            sourceRef: id,
            fieldPath: `projects.${id}.responsibilities`,
          },
        ],
      },
    },
  }) as never;

const candidate = (
  id: string,
  title: string,
  projects: ReturnType<typeof project>[],
): CandidateSearchV2Document => ({
  candidateId: id,
  canonicalCandidateId: id,
  sourceCandidateIds: [id],
  talentPool: "internal_profiles",
  candidateName: `Synthetic ${id}`,
  currentTitle: title,
  currentEmployer: "Synthetic employer",
  location: "Malaysia",
  country: "Malaysia",
  locationEvidenceState: "VERIFIED",
  skills: ["SAP FICO"],
  sapModules: ["FICO"],
  searchConceptIds: ["FICO"],
  searchTargetEvidence: {
    FICO: {
      target: "FICO",
      tier: "exact_supported",
      strength: 1,
      evidenceSourceType: "direct_skill",
      matchedLiteral: "SAP FICO",
      matchedIndicators: ["SAP FICO"],
      sourceField: "request_candidate.skills",
      trusted: true,
      reasonCode: "trusted_professional_cluster",
      relatedConcepts: [],
      sourceRecordId: id,
      sourceValueProvenance: "candidate_record_raw",
      professionalContextType: "direct_skill",
    },
  },
  domainEvidence: { FICO: "SUPPORTED" },
  lifecycleEvidence: canonicalLifecycleEvidence(id, projects),
  implementationEvidenceCount: projects.length,
  implementationEvidenceLevel: projects.length
    ? "source_text_evidence"
    : "unverified",
  seniorityEvidenceLevel: "unverified",
  profileEvidence: {
    name: true,
    title: true,
    employer: false,
    location: false,
    experienceDuration: false,
    employmentHistory: true,
    projectHistory: projects.length > 0,
    education: false,
    certifications: false,
    skills: true,
  },
  trustedCandidateEvidence: {
    candidateId: id,
    values: [
      {
        value: title,
        sourceType: "raw_title",
        sourceField: "request_candidate.title",
        sourceRecordId: id,
        provenance: "candidate_record_raw",
        trusted: true,
      },
      {
        value: "SAP FICO",
        sourceType: "direct_skill",
        sourceField: "request_candidate.skills",
        sourceRecordId: id,
        provenance: "candidate_record_raw",
        trusted: true,
      },
    ],
  },
});

const conversion = project(
  "conversion",
  "SAP ECC conversion",
  "SAP FICO Conversion Consultant",
  ["Converted SAP FICO general-ledger balances and open items."],
  "Migration",
);
const ficoMigration = project(
  "fico-migration",
  "SAP FICO data migration",
  "SAP FICO Data Migration Consultant",
  ["Owned SAP FICO data conversion, reconciliation testing and cutover."],
  "Migration",
);
const security = project(
  "security",
  "SAP MM, SD, PM, PS & FICO implementation",
  "SAP Security and Authorization Consultant",
  [
    "Reviewed the blueprint for user and authorization administration.",
    "Created and maintained FICO roles and segregation-of-duties controls.",
  ],
  "Rollout",
);
const mmIntegration = project(
  "mm-integration",
  "SAP MM procurement rollout",
  "SAP MM Consultant",
  [
    "Tested integration with FI/CO and prepared cutover for Material Management objects and purchase orders.",
  ],
  "Integration",
);
const genericWithSkill = project(
  "generic",
  "ERP implementation",
  "Project member",
  ["Supported implementation and go-live activities."],
  "Implementation",
  ["FICO"],
);

const directConversion = candidate("direct-conversion", "SAP Data Consultant", [
  conversion,
]);
const directMigration = candidate("direct-migration", "SAP FICO Consultant", [
  ficoMigration,
]);
const securityOnly = candidate("security-only", "SAP Security Consultant", [
  security,
]);
const mmOnly = candidate("mm-only", "SAP MM Manager", [mmIntegration]);
const genericOnly = candidate("generic-only", "SAP Project Manager", [
  genericWithSkill,
]);

assert.equal(identityBoundTrustedCandidateValues(directMigration).length, 2);

assert.equal(
  targetModuleDeliveryEvidence(directConversion, "FICO").directTargetAssignments
    .length,
  1,
);
assert.equal(
  targetModuleDeliveryEvidence(directMigration, "FICO").directTargetAssignments
    .length,
  1,
);
assert.equal(
  targetModuleDeliveryEvidence(securityOnly, "FICO").directTargetAssignments
    .length,
  0,
);
assert.equal(
  targetModuleDeliveryEvidence(securityOnly, "FICO").adjacentAssignments[0]
    ?.reasonCode,
  "security_authorization_context",
);
assert.equal(
  targetModuleDeliveryEvidence(mmOnly, "FICO").directTargetAssignments.length,
  0,
);
assert.equal(
  targetModuleDeliveryEvidence(mmOnly, "FICO").adjacentAssignments[0]
    ?.reasonCode,
  "cross_module_integration_touchpoint",
);
assert.equal(
  targetModuleDeliveryEvidence(genericOnly, "FICO").directTargetAssignments
    .length,
  0,
);

const classificationFixtures = [
  conversion,
  ficoMigration,
  security,
  mmIntegration,
  genericWithSkill,
];
const classifications = classificationFixtures.map((item) =>
  canonicalProjectRequirementClassification(
    "classification-candidate",
    item,
    "SAP FICO implementation",
  ),
);
assert.equal(
  classifications.filter((item) => item.deliveryClassification === "direct")
    .length,
  2,
);
assert.equal(
  classifications.filter((item) => item.deliveryClassification === "adjacent")
    .length,
  3,
);
assert.equal(
  classifications.filter(
    (item) => item.deliveryClassification === "unsupported",
  ).length,
  0,
);
assert.equal(
  classifications[0].satisfiesRequirement,
  false,
  "a migration lifecycle is direct delivery depth but not an implementation requirement",
);
assert.equal(
  classifications[1].satisfiesRequirement,
  false,
  "FICO migration remains distinct from implementation",
);
assert.equal(classifications[2].contributesToDirectDepth, false);
assert.equal(classifications[3].contributesToDirectDepth, false);

const repeated = candidate("repeated", "SAP FICO Consultant", [
  project(
    "one-real-project",
    "SAP FICO implementation and rollout",
    "SAP FICO Consultant",
    [
      "Configured SAP FICO, completed migration testing and supported cutover and go-live.",
      "Configured SAP FICO, completed migration testing and supported cutover and go-live.",
    ],
  ),
]);
assert.equal(
  targetModuleDeliveryEvidence(repeated, "FICO").directTargetAssignments.length,
  1,
);

const threeDirect = candidate("three-direct", "SAP FICO Consultant", [
  conversion,
  ficoMigration,
  project(
    "support",
    "SAP FICO production support",
    "SAP FICO Functional Consultant",
    ["Owned FI/CO financial-closing configuration and production support."],
    "Support / Enhancement",
  ),
]);
const criterion = [
  {
    id: "depth",
    label: "Demonstrated SAP FICO delivery depth",
    conceptId: "FICO",
    importance: "important" as const,
    source: "query" as const,
  },
];
const oneEvaluation = evaluateSearchCriteria(directMigration, criterion)
  .criteria[0];
const threeEvaluation = evaluateSearchCriteria(threeDirect, criterion)
  .criteria[0];
assert.equal(oneEvaluation.assignmentEvidence?.directTargetAssignments, 1);
assert.equal(threeEvaluation.assignmentEvidence?.directTargetAssignments, 3);
assert.equal(
  threeEvaluation.assignmentEvidence?.directTargetLifecycleAssignments,
  3,
);
assert.deepEqual(
  threeEvaluation.assignmentEvidence?.requestedLifecycleTypes,
  [],
);
assert.ok(threeEvaluation.score > oneEvaluation.score);
assert.match(threeEvaluation.reason, /3 direct grounded SAP FICO assignments/);
assert.equal(evaluateSearchCriteria(securityOnly, criterion).scorePercent, 0);
assert.match(
  evaluateSearchCriteria(securityOnly, criterion).criteria[0].reason,
  /Security\/authorization/,
);
assert.equal(evaluateSearchCriteria(mmOnly, criterion).scorePercent, 0);
assert.match(
  evaluateSearchCriteria(mmOnly, criterion).criteria[0].reason,
  /integration touchpoint/,
);
assert.equal(evaluateSearchCriteria(genericOnly, criterion).scorePercent, 0);

const ficoImplementation = project(
  "fico-implementation-only",
  "SAP FICO implementation",
  "SAP FICO Functional Consultant",
  ["Implemented and configured SAP FICO general ledger for the client."],
  "Implementation",
);
const implementationOnly = candidate(
  "implementation-only",
  "SAP FICO Consultant",
  [ficoImplementation],
);
const implementationPlusMigration = candidate(
  "implementation-plus-migration",
  "SAP FICO Consultant",
  [ficoImplementation, ficoMigration],
);
const implementationCriterion = [
  {
    id: "implementation-depth",
    label: "Demonstrated SAP FICO implementation depth",
    conceptId: "FICO",
    importance: "most_important" as const,
    source: "query" as const,
  },
];
const migrationCriterion = [
  {
    id: "migration-depth",
    label: "Demonstrated SAP FICO migration depth",
    conceptId: "FICO",
    importance: "most_important" as const,
    source: "query" as const,
  },
];
const implementationOnlyEvaluation = evaluateSearchCriteria(
  implementationOnly,
  implementationCriterion,
).criteria[0];
const implementationPlusMigrationEvaluation = evaluateSearchCriteria(
  implementationPlusMigration,
  implementationCriterion,
).criteria[0];
assert.equal(
  implementationPlusMigrationEvaluation.assignmentEvidence
    ?.directTargetAssignments,
  2,
);
assert.equal(
  implementationPlusMigrationEvaluation.assignmentEvidence
    ?.directTargetLifecycleAssignments,
  1,
);
assert.deepEqual(
  implementationPlusMigrationEvaluation.assignmentEvidence
    ?.requestedLifecycleTypes,
  ["Implementation"],
);
assert.equal(
  implementationPlusMigrationEvaluation.score,
  implementationOnlyEvaluation.score,
  "a Migration assignment cannot increase an Implementation-scoped criterion",
);
assert.match(
  implementationPlusMigrationEvaluation.reason,
  /exactly 1 direct grounded SAP FICO implementation assignment/,
);

const migrationOnlyEvaluation = evaluateSearchCriteria(
  directMigration,
  migrationCriterion,
).criteria[0];
const migrationPlusImplementationEvaluation = evaluateSearchCriteria(
  implementationPlusMigration,
  migrationCriterion,
).criteria[0];
assert.equal(
  migrationPlusImplementationEvaluation.assignmentEvidence
    ?.directTargetAssignments,
  2,
);
assert.equal(
  migrationPlusImplementationEvaluation.assignmentEvidence
    ?.directTargetLifecycleAssignments,
  1,
);
assert.deepEqual(
  migrationPlusImplementationEvaluation.assignmentEvidence
    ?.requestedLifecycleTypes,
  ["Migration"],
);
assert.equal(
  migrationPlusImplementationEvaluation.score,
  migrationOnlyEvaluation.score,
  "an Implementation assignment cannot increase a Migration-scoped criterion",
);
assert.match(
  migrationPlusImplementationEvaluation.reason,
  /exactly 1 direct grounded SAP FICO migration assignment/,
);

const ranked = searchCandidatesV2(
  [threeDirect, directMigration, securityOnly, mmOnly, genericOnly],
  {
    query: "SAP FICO",
    talentPool: "internal_profiles",
    minimumScore: 0,
    pageSize: 20,
    criteria: criterion,
  },
);
const committed = buildCommittedSearchRequirements({
  query: "SAP FICO",
  talentPool: "internal_profiles",
  criteria: criterion,
});
assert.equal(
  evaluateCommittedCandidate(directMigration, committed).eligible,
  true,
  JSON.stringify(
    evaluateCommittedCandidate(directMigration, committed),
    null,
    2,
  ),
);
const byId = new Map(
  ranked.results.map((result) => [result.candidateId, result]),
);
assert.equal(ranked.results.length, 5, JSON.stringify(ranked, null, 2));
assert.ok(
  byId.get(threeDirect.candidateId)!.rankingScore! >
    byId.get(directMigration.candidateId)!.rankingScore!,
);
assert.ok(
  byId.get(directMigration.candidateId)!.rankingScore! >
    byId.get(securityOnly.candidateId)!.rankingScore!,
);
assert.ok(
  byId.get(directMigration.candidateId)!.rankingScore! >
    byId.get(mmOnly.candidateId)!.rankingScore!,
);
assert.notEqual(byId.get(securityOnly.candidateId)?.matchLabel, "Strong Match");
assert.notEqual(byId.get(mmOnly.candidateId)?.matchLabel, "Strong Match");

const duplicateProject = (
  id: string,
  client: string,
  role: string,
  responsibility: string,
  sourceRef: string,
  start = "",
  end = "",
) =>
  ({
    ...(project(id, client, role, [
      responsibility,
    ]) as unknown as EnterpriseProject),
    client,
    name: `${client} SAP delivery`,
    start,
    end,
    evidenceState: "source_extracted" as const,
    fieldEvidence: {
      responsibilities: {
        value: [responsibility],
        evidenceState: "source_extracted" as const,
        provenance: [
          {
            sourceType: "parsed_resume" as const,
            sourceRef,
            fieldPath: `${sourceRef}.responsibilities`,
            label: "Resume evidence",
          },
        ],
      },
    },
  }) satisfies EnterpriseProject;
const duplicateRuntimeProjects = [
  duplicateProject(
    "jollibee-structured",
    "Jollibee Food Corporation",
    "SAP FICO Team Lead",
    "Owned SAP FICO support and configuration.",
    "projects.1",
    "2022",
    "2023",
  ),
  duplicateProject(
    "jollibee-narrative",
    "Jollibee Food Corp.",
    "FICO Support Team Lead",
    "Led FICO production support for regional entities.",
    "resume.narrativeProjects.1",
    "2022",
    "2023",
  ),
  duplicateProject(
    "aia-structured",
    "AIA Shared Services",
    "SAP FICO L3 Consultant",
    "Delivered SAP FICO L3 configuration and support.",
    "projects.2",
    "2020",
    "2022",
  ),
  duplicateProject(
    "aia-narrative",
    "AIA Shared Services Sdn Bhd",
    "FICO Support Consultant",
    "Owned FI/CO incident resolution and configuration.",
    "resume.narrativeProjects.2",
    "2020",
    "2022",
  ),
  duplicateProject(
    "fpg",
    "FPG Oleochemicals",
    "SAP Senior Consultant FICO",
    "Led SAP FICO New GL migration and asset conversion.",
    "projects.3",
  ),
  duplicateProject(
    "jlr",
    "Jaguar Land Rover Malaysia",
    "SAP Senior Consultant FICO",
    "Led SAP FICO blueprinting, testing, go-live and production support.",
    "projects.4",
  ),
  duplicateProject(
    "oneweb",
    "OneWeb",
    "SAP FICO Consultant",
    "Configured FI structures and migrated finance master data to SAP S/4HANA.",
    "projects.5",
  ),
  duplicateProject(
    "regional-rollout",
    "Regional Foods",
    "SAP FICO Consultant",
    "Delivered SAP FICO rollout, testing and cutover.",
    "projects.6",
  ),
  duplicateProject(
    "finance-support",
    "Industrial Systems",
    "SAP FI CO Support Engineer",
    "Owned FI/CO configuration and production support.",
    "projects.7",
  ),
];
const canonicalRuntimeProjects = canonicalizeEnterpriseProjects(
  duplicateRuntimeProjects,
);
assert.equal(canonicalRuntimeProjects.length, 7);
const jollibee = canonicalRuntimeProjects.find((item) =>
  /jollibee/i.test(item.client),
);
const aia = canonicalRuntimeProjects.find((item) => /^aia/i.test(item.client));
assert.equal(jollibee?.sourceAssignmentIds?.length, 2);
assert.equal(aia?.sourceAssignmentIds?.length, 2);
assert.equal(jollibee?.fieldEvidence.responsibilities?.provenance.length, 2);
assert.equal(aia?.fieldEvidence.responsibilities?.provenance.length, 2);

const anonymousStrong = candidate(
  "00000000-0000-0000-0000-000000a8ccb8",
  "SAP PS Team Lead",
  canonicalRuntimeProjects as ReturnType<typeof project>[],
);
anonymousStrong.candidateName = "And Driving High-impact Digital Outcomes.";
const anonymousEvidence = targetModuleDeliveryEvidence(anonymousStrong, "FICO");
assert.equal(
  anonymousEvidence.totalGroundedProjects,
  canonicalRuntimeProjects.length,
);
assert.equal(anonymousEvidence.directTargetAssignments.length, 7);
assert.equal(
  anonymousEvidence.totalGroundedProjects,
  anonymousEvidence.directTargetAssignments.length +
    anonymousEvidence.adjacentAssignments.length +
    anonymousEvidence.unsupportedAssignments.length,
);
const anonymousResult = searchCandidatesV2([anonymousStrong], {
  query: "SAP FICO",
  talentPool: "internal_profiles",
  minimumScore: 0,
  pageSize: 20,
  criteria: criterion,
}).results[0];
assert.equal(anonymousResult?.matchLabel, "Strong Match");
assert.equal(
  anonymousResult?.criteriaDiagnostic?.criteria[0]?.assignmentEvidence
    ?.directTargetAssignments,
  7,
);
assert.deepEqual(
  canonicalTalentSearchIdentity(
    anonymousStrong.candidateId,
    anonymousStrong.candidateName,
  ),
  {
    displayName: "Name unavailable",
    identityToken: "#A8CCB8",
    nameAvailable: false,
  },
);
assert.equal(
  adaptCandidateToSearchV2Document({
    id: anonymousStrong.candidateId,
    display_name: anonymousStrong.candidateName,
    current_title: anonymousStrong.currentTitle,
  }).candidateName,
  null,
);
assert.equal(
  internalSearchV2ResultSummaryText({
    returned: 20,
    visibleTotal: 113,
    eligibleTotal: 161,
  }),
  "Showing top 20 of 113 matching candidates (161 met required filters)",
);

const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.doesNotMatch(
  client,
  /key={`criterion:\$\{criterion\.id\}`}\s+className="truncate/,
);
assert.match(client, /criterion\.label[\s\S]*criterion\.reason/);
assert.match(client, /internalSearchV2ResultSummaryText/);

const detailsDrawer = readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.doesNotMatch(detailsDrawer, /item\.reason/);
assert.doesNotMatch(
  detailsDrawer,
  /item\.assignmentEvidence\s*\.directTargetAssignments/,
);
assert.doesNotMatch(
  detailsDrawer,
  /item\.assignmentEvidence\s*\.adjacentAssignments/,
);
assert.match(detailsDrawer, /canonicalIdentity\.displayName/);
assert.match(detailsDrawer, /Projects \(\$\{projects\.length\}\)/);
assert.doesNotMatch(
  detailsDrawer,
  /profile\?\.displayName\.value \|\| candidate\.candidateName/,
);

console.log("Search V2 assignment-scoped module delivery tests passed.");
