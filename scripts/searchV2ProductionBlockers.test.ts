import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractExplicitResponsibilityProjects,
  normalizeActualCandidateSchema,
} from "../lib/candidate360SchemaNormalize";
import {
  canonicalLifecycleEvidence,
  canonicalProjectRequirementClassification,
  targetModuleDeliveryEvidence,
} from "../lib/searchV2Lifecycle";
import { canonicalTalentSearchIdentity } from "../lib/talentSearchDisplay";
import {
  canonicalLookupMatches,
  detectSearchV2UnifiedIntent,
  identityOnlyCandidateProjection,
} from "../lib/searchV2UnifiedIntent";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import { evaluateSearchCriteria } from "../lib/searchV2Criteria";
import { resetCandidateDetailsScroll } from "../lib/candidateDetailsScroll";

const indraSource = `
  Work and Project Experience
  PT Farpoint Prima (Oct 2015 - Present) As Business Support Analyst (SAP FICO)
  PT Krakatau Information Technology (Oct 2012 - Oct 2015) As SAP FICO Consultant
  Pipe Industry DATE: July 2012 - January 2013 CLIENT: PT Latinusa, Indonesia
  PROJECT DESCRIPTION: SAP ERP ECC 6.0 Reimplementation for PSAK10.
  RESPONSIBILITY: FI/CO Team Member (AA and CCA)
  Pipe Industry DATE: February 2013 - June 2013 CLIENT: PT KHI Pipe Industries, Indonesia
  PROJECT DESCRIPTION: SAP ERP ECC 6.0 Reimplementation for PSAK10.
  RESPONSIBILITY: FI/CO Team Member (GL, AA, CCA, IO, PCA and Data Migration)
  Pipe Industry DATE: July 2013 - January 2014 CLIENT: PT KHI Pipe Industries, Indonesia
  PROJECT DESCRIPTION: SAP ERP ECC 6.0 Implementation Phase II - HR, PP, Product Costing
  RESPONSIBILITY: CO Team Member (PC)
  Bars Industry DATE: February 2014 - September 2014 CLIENT: PT Krakatau Wajatama, Indonesia
  PROJECT DESCRIPTION: SAP ERP ECC 6.0 Implementation Prototyping Project
  RESPONSIBILITY: CO Team Leader
  Steel Industry DATE: February 2015 - October 2015 CLIENT: PT Krakatau Nippon Steel, Indonesia
  PROJECT DESCRIPTION: SAP ERP ECC 6.0 EHP7 Implementation Project - Phase I
  RESPONSIBILITY: FICO Team Leader
`;
const explicitProjects = extractExplicitResponsibilityProjects([
  { resume_text: indraSource },
]);
assert.equal(
  explicitProjects.length,
  5,
  "each DATE/CLIENT/DESCRIPTION/RESPONSIBILITY block is a canonical assignment boundary",
);
assert.ok(
  explicitProjects.every(
    (project) => project.client && project.role && project.start && project.end,
  ),
);
const indraEvidence = targetModuleDeliveryEvidence(
  {
    lifecycleEvidence: canonicalLifecycleEvidence(
      "indra-fixture",
      explicitProjects,
    ),
  },
  "FICO",
);
assert.equal(indraEvidence.totalGroundedProjects, 5);
assert.equal(
  indraEvidence.directTargetAssignments.length,
  3,
  "general SAP FICO delivery retains the migration assignment",
);
const indraCriterion = evaluateSearchCriteria(
  {
    candidateId: "indra-fixture",
    lifecycleEvidence: canonicalLifecycleEvidence(
      "indra-fixture",
      explicitProjects,
    ),
  } as CandidateSearchV2Document,
  [
    {
      id: "criterion:implementation-depth:fico",
      label: "Demonstrated SAP FICO implementation depth",
      conceptId: "FICO",
      importance: "most_important",
      source: "query",
    },
  ],
).criteria[0];
assert.equal(indraCriterion.assignmentEvidence?.totalGroundedProjects, 5);
assert.equal(indraCriterion.assignmentEvidence?.directTargetAssignments, 3);
assert.equal(
  indraCriterion.assignmentEvidence?.directTargetLifecycleAssignments,
  2,
);
assert.equal(indraCriterion.assignmentEvidence?.adjacentAssignments, 0);
assert.equal(indraCriterion.assignmentEvidence?.unsupportedAssignments, 2);
assert.equal(
  indraCriterion.score,
  85,
  "two lifecycle-qualified assignments use the existing deterministic depth threshold",
);
assert.match(
  indraCriterion.reason,
  /exactly 2 direct grounded SAP FICO implementation assignments/,
);
assert.equal(
  explicitProjects.filter(
    (project) =>
      canonicalProjectRequirementClassification(
        "indra-fixture",
        project,
        "SAP FICO implementation",
      ).satisfiesRequirement,
  ).length,
  2,
  "the requirement and criterion consume the same lifecycle-qualified assignments",
);

const teck = normalizeActualCandidateSchema({
  id: "teck-fixture",
  current_title: "SAP FICO Functional Consultant",
  resume_text: `Career history SAP FICO Consultant at Magnus Management Consultants Jan 2004 - Present
    Current Employment Company Name: Magnus Management Consultants Sdn. Bhd Position: SAP FICO Functional Consultant
    Company Name: Magnus Management Consultants Sdn. Bhd From / To: Jan 2004 - Present
    Position: .-Analyzed the client's Activity Based Costing and Market Share/Growth matrix. Other Responsibilities: SAP support.
    Post-production support Project Consultant at IBM Consulting Services - Peter Tang & Associate Mar 2003 - Present`,
});
assert.equal(
  teck.enterpriseProfile.employmentTimeline.filter((item) =>
    /Magnus/i.test(item.company),
  ).length,
  1,
);
assert.doesNotMatch(
  JSON.stringify(teck.enterpriseProfile.employmentTimeline),
  /Analyzed the client's Activity Based Costing/i,
);
const ibm = teck.enterpriseProfile.employmentTimeline.find((item) =>
  /IBM/i.test(item.company),
);
assert.equal(
  ibm?.current,
  true,
  "an open role is current only because the fixture explicitly says Present",
);

const bounded = normalizeActualCandidateSchema({
  id: "section-bounds",
  resume_text: `PROFESSIONAL EXPERIENCE
    Account & Admin Officer — SMR Technologies Berhad (Aug 2009 - Apr 2010)
    Maintained account records. person@example.test +60 12 345 6789
    EDUCATION, TRAINING & CERTIFICATIONS MBA, Example University. SAP FI certification.
    LANGUAGES English
    PROJECT PROFILE
    Year: 2021-2022 Client: Delivery Client Employer: Evidence Employer Role: SAP FICO Consultant Project: Finance rollout. Implemented SAP FICO configuration.`,
});
const normalizedBounded = JSON.stringify(bounded.enterpriseProfile);
assert.doesNotMatch(normalizedBounded, /person@example\.test|\+60 12 345 6789/);
assert.doesNotMatch(
  JSON.stringify(bounded.enterpriseProfile.employmentTimeline),
  /MBA|certification|LANGUAGES/i,
);
assert.ok(
  bounded.enterpriseProfile.projects.every(
    (project) =>
      !/Account & Admin Officer|SMR Technologies/i.test(
        `${project.name} ${project.client} ${project.role}`,
      ),
  ),
);

const stableId = "4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8";
assert.equal(
  canonicalTalentSearchIdentity(stableId, "").identityToken,
  "#A8CCB8",
);
assert.equal(
  canonicalTalentSearchIdentity(stableId, "Any later normalized name")
    .identityToken,
  "#A8CCB8",
);
const identityDocument = {
  candidateId: stableId,
  canonicalCandidateId: "canonical-rebuilt-person",
  sourceCandidateIds: [stableId],
  candidateName: null,
} as CandidateSearchV2Document;
assert.equal(
  canonicalLookupMatches(
    [identityDocument],
    detectSearchV2UnifiedIntent("#A8CCB8"),
  ).length,
  1,
);
assert.equal(
  canonicalLookupMatches(
    [identityDocument],
    detectSearchV2UnifiedIntent("#A8CCC8"),
  ).length,
  1,
);
const identityProjection = identityOnlyCandidateProjection(identityDocument);
assert.equal(identityProjection.fitEvaluation, null);
assert.equal(
  identityProjection.score,
  null,
  "identity projection must explicitly represent recruiter-fit scoring as not applicable",
);

const drawer = readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
const overviewUi = readFileSync(
  "components/CanonicalProfileOverview.tsx",
  "utf8",
);
const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
const route = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
const scrollContainer = { scrollTop: 842 };
resetCandidateDetailsScroll(scrollContainer as HTMLElement);
assert.equal(
  scrollContainer.scrollTop,
  0,
  "the production scroll reset synchronously moves the drawer content container to the top",
);
assert.match(
  drawer,
  /resetCandidateDetailsScroll\(contentScrollRef\.current\)/,
);
assert.match(drawer, /\[tab, candidate\.candidateId\]/);
assert.doesNotMatch(drawer, /\.\.\.\(diagnostic\.targetSkill/);
assert.doesNotMatch(
  drawer,
  /requirements: "Not applicable for identity lookup"/,
);
assert.doesNotMatch(overviewUi, /sourceContext\.requirements/);
assert.doesNotMatch(drawer, /Profile-data confidence/);
assert.match(client, /Recruiter fit: Not evaluated/);
assert.match(client, /named candidate.*evaluated/);
assert.match(route, /identityOnlyCandidateProjection/);
assert.match(route, /evaluationMode: "identity_only"/);

console.log("Search V2 production blocker regressions passed.");
