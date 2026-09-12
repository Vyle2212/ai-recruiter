import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";

import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import type {
  CandidateSearchV2Document,
  TrustedCandidateEvidenceValue,
} from "../lib/candidateSearchV2Types";
import {
  buildCommittedSearchRequirements,
  canonicalInternalDeliveryDepth,
} from "../lib/searchV2CommittedRequirements";
import {
  CompactCandidateCard,
  displayedRankingScore,
} from "../app/recruiter/talent-search/v2/CandidateSearchV2Client";
import {
  canonicalMatchLabel,
  compareCanonicalSearchResults,
} from "../lib/searchV2Match";
import { canonicalLifecycleEvidenceFromCandidateSource } from "../lib/searchV2Lifecycle";
import { parseRecruiterSearchIntent } from "../lib/recruiterSearchPresentation";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

const trusted = (
  candidateId: string,
  value: string,
  sourceType: TrustedCandidateEvidenceValue["sourceType"],
  sourceField: string,
): TrustedCandidateEvidenceValue => ({
  value,
  sourceType,
  sourceField,
  sourceRecordId: candidateId,
  provenance: "candidate_record_raw",
  trusted: true,
});

const lifecycle = (
  candidateId: string,
  project: string,
  lifecycleType: string,
) => ({
  projectId: `${candidateId}:${project}`,
  lifecycleType,
  sourceType: "project" as const,
  sourceField: "request_candidate.projects",
  sourceRecordId: candidateId,
  excerpt: `${lifecycleType} SAP FICO assignment`,
  evidenceLevel: "supported" as const,
  modules: ["SAP FICO"],
  contextConceptIds: ["FICO"],
});

const candidate = (
  id: string,
  title: string | null,
  options: {
    lifecycle?: ReturnType<typeof lifecycle>[];
    historicalTitles?: string[];
    experienceEstablished?: boolean;
    competingDomain?: string;
    includeFicoSkill?: boolean;
    projectText?: string;
  } = {},
): CandidateSearchV2Document => {
  const values = [
    ...(title
      ? [trusted(id, title, "raw_title", "request_candidate.title")]
      : []),
    ...(options.includeFicoSkill === false
      ? []
      : [trusted(id, "SAP FICO", "direct_skill", "request_candidate.skills")]),
    ...(options.projectText
      ? [
          trusted(
            id,
            options.projectText,
            "raw_project",
            "request_candidate.projects",
          ),
        ]
      : []),
  ];
  return {
    candidateId: id,
    canonicalCandidateId: id,
    sourceCandidateIds: [id],
    talentPool: "internal_profiles",
    candidateName: `Synthetic ${id}`,
    currentTitle: title,
    historicalTitles: options.historicalTitles || [],
    currentEmployer: "Synthetic employer",
    location: "Malaysia",
    country: "Malaysia",
    skills: options.includeFicoSkill === false ? [] : ["SAP FICO"],
    sapModules: options.includeFicoSkill === false ? [] : ["SAP FICO"],
    domainEvidence: {
      FICO: options.includeFicoSkill === false ? "UNVERIFIED" : "SUPPORTED",
      ...(options.competingDomain
        ? { [options.competingDomain]: "PRIMARY" as const }
        : {}),
    },
    domainImplementationEvidence: {},
    lifecycleEvidence: options.lifecycle || [],
    implementationEvidenceCount: options.lifecycle?.length || 0,
    implementationEvidenceLevel: options.lifecycle?.length
      ? "source_text_evidence"
      : "unverified",
    seniorityEvidenceLevel: "unverified",
    totalYearsExperience: options.experienceEstablished ? 10 : null,
    locationEvidenceState: "VERIFIED",
    profileQualityScore: 90,
    dataConfidenceScore: 90,
    profileEvidence: {
      name: true,
      title: Boolean(title),
      employer: true,
      location: true,
      experienceDuration: options.experienceEstablished === true,
      employmentHistory: Boolean(options.projectText),
      projectHistory: Boolean(options.lifecycle?.length),
      education: false,
      certifications: false,
      skills: options.includeFicoSkill !== false,
    },
    trustedCandidateEvidence: { candidateId: id, values },
  };
};

const exactGroundedId = "exact-fico-grounded";
const exactGrounded = candidate(exactGroundedId, "Senior SAP FICO Consultant", {
  lifecycle: [
    lifecycle(exactGroundedId, "implementation-a", "Implementation"),
    lifecycle(exactGroundedId, "rollout-b", "Rollout"),
    lifecycle(exactGroundedId, "support-c", "Support / Enhancement"),
  ],
  experienceEstablished: true,
  projectText:
    "Led SAP FICO implementation, rollout, configuration, and production support.",
});
const exactNoDelivery = candidate(
  "exact-fico-no-delivery",
  "SAP FICO Consultant",
);
const exactOneAssignmentId = "exact-fico-one-assignment";
const exactOneAssignment = candidate(
  exactOneAssignmentId,
  "SAP FICO Consultant",
  {
    lifecycle: [
      lifecycle(exactOneAssignmentId, "one-grounded-project", "Implementation"),
    ],
    projectText: "Implemented SAP FICO in one grounded assignment.",
  },
);
const sdSkillOnly = candidate("sd-fico-skill-only", "SAP SD Consultant", {
  competingDomain: "SD",
});
const mmSkillOnly = candidate("mm-fico-skill-only", "SAP MM Manager", {
  competingDomain: "MM",
});
const adjacentSkillOnly = [
  candidate("abap-fico-skill-only", "SAP ABAP Consultant", {
    competingDomain: "ABAP",
  }),
  candidate("successfactors-fico-skill-only", "SAP SuccessFactors Consultant", {
    competingDomain: "HCM",
  }),
  candidate("ps-fico-skill-only", "SAP PS Solutions Consultant", {
    competingDomain: "PS",
  }),
];
const abapHistoricalId = "abap-historical-fico";
const abapHistorical = candidate(abapHistoricalId, "SAP ABAP Consultant", {
  competingDomain: "ABAP",
  historicalTitles: ["SAP FICO Consultant"],
  lifecycle: [lifecycle(abapHistoricalId, "historical-fico", "Implementation")],
  projectText: "Implemented SAP FICO in a grounded historical assignment.",
});
const genericSap = candidate("generic-sap", "SAP Consultant");
const missingTitle = candidate("missing-title-fico-skill", null);
const duplicateId = "duplicate-fico-project";
const duplicateEvidence = candidate(duplicateId, "SAP FICO Consultant", {
  lifecycle: [
    lifecycle(duplicateId, "one-project", "Implementation"),
    lifecycle(duplicateId, "one-project", "Implementation"),
    lifecycle(duplicateId, "one-project", "Go-live"),
  ],
  projectText: "Implemented SAP FICO and completed go-live.",
});

const request = {
  query: "SAP FICO",
  talentPool: "internal_profiles" as const,
  minimumScore: 0,
  pageSize: 20,
  criteria: [
    {
      id: "fico-delivery-depth",
      label: "Demonstrated SAP FICO delivery depth",
      conceptId: "FICO",
      importance: "most_important" as const,
      source: "query" as const,
    },
  ],
};
const documents = [
  exactGrounded,
  exactNoDelivery,
  exactOneAssignment,
  sdSkillOnly,
  mmSkillOnly,
  ...adjacentSkillOnly,
  abapHistorical,
  genericSap,
  missingTitle,
  duplicateEvidence,
];
const response = searchCandidatesV2(documents, request);
const byId = new Map(
  response.results.map((result) => [result.candidateId, result]),
);

assert.equal(response.results.length, documents.length);
assert.equal(response.results[0]?.candidateId, exactGroundedId);
assert.equal(byId.get(exactGroundedId)?.primaryRoleFit, "exact");
assert.equal(byId.get(sdSkillOnly.candidateId)?.primaryRoleFit, "adjacent");
assert.equal(byId.get(mmSkillOnly.candidateId)?.primaryRoleFit, "adjacent");
assert.equal(
  byId.get(sdSkillOnly.candidateId)?.targetEvidence.tier,
  "exact_supported",
);
assert.equal(
  byId.get(mmSkillOnly.candidateId)?.targetEvidence.tier,
  "exact_supported",
);
assert.notEqual(
  byId.get(sdSkillOnly.candidateId)?.targetEvidence.professionalContextType,
  "title",
);
assert.notEqual(
  byId.get(mmSkillOnly.candidateId)?.targetEvidence.professionalContextType,
  "title",
);
assert.equal(
  byId.get(sdSkillOnly.candidateId)?.criteriaDiagnostic?.scorePercent,
  0,
);
assert.equal(
  byId.get(mmSkillOnly.candidateId)?.criteriaDiagnostic?.scorePercent,
  0,
);
for (const adjacent of adjacentSkillOnly) {
  assert.equal(byId.get(adjacent.candidateId)?.primaryRoleFit, "adjacent");
  assert.equal(
    byId.get(adjacent.candidateId)?.criteriaDiagnostic?.scorePercent,
    0,
  );
  assert.notEqual(byId.get(adjacent.candidateId)?.matchLabel, "Strong Match");
}
assert.ok(
  (byId.get(exactGroundedId)?.criteriaDiagnostic?.scorePercent || 0) >
    (byId.get(exactNoDelivery.candidateId)?.criteriaDiagnostic?.scorePercent ||
      0),
);
assert.ok(
  (byId.get(exactGroundedId)?.overallMatchScore || 0) >
    (byId.get(sdSkillOnly.candidateId)?.overallMatchScore || 0),
);
assert.ok(
  (byId.get(exactGroundedId)?.overallMatchScore || 0) >
    (byId.get(mmSkillOnly.candidateId)?.overallMatchScore || 0),
);
assert.ok(
  (byId.get(exactGroundedId)?.overallMatchScore || 0) >
    (byId.get(exactOneAssignmentId)?.overallMatchScore || 0),
  "multiple grounded assignments rank above one grounded assignment",
);
assert.ok(
  (byId.get(exactOneAssignmentId)?.overallMatchScore || 0) >
    (byId.get(exactNoDelivery.candidateId)?.overallMatchScore || 0),
  "one grounded assignment ranks above an exact title with no delivery evidence",
);
assert.ok(
  (byId.get(exactNoDelivery.candidateId)?.overallMatchScore || 0) >
    (byId.get(sdSkillOnly.candidateId)?.overallMatchScore || 0),
  "an exact professional title ranks above a pure skill-only adjacent role",
);
assert.notEqual(byId.get(sdSkillOnly.candidateId)?.matchLabel, "Strong Match");
assert.notEqual(byId.get(mmSkillOnly.candidateId)?.matchLabel, "Strong Match");
assert.notEqual(byId.get(missingTitle.candidateId)?.matchLabel, "Strong Match");
assert.ok(
  (byId.get(abapHistoricalId)?.supportedProfessionalEvidenceDepth || 0) > 0,
);
assert.equal(
  byId.get(abapHistoricalId)?.primaryRoleFit,
  "exact",
  "a grounded historical FICO role can establish professional relevance after a career transition",
);

const committed = buildCommittedSearchRequirements(request);
const singleProject = candidate("single-fico-project", "SAP FICO Consultant", {
  lifecycle: [
    lifecycle("single-fico-project", "one-project", "Implementation"),
  ],
});
assert.equal(
  canonicalInternalDeliveryDepth(duplicateEvidence, committed),
  canonicalInternalDeliveryDepth(singleProject, committed),
  "duplicate lifecycle rows and labels from one project count once",
);
assert.equal(
  byId.get(duplicateId)?.criteriaDiagnostic?.scorePercent,
  searchCandidatesV2([singleProject], request).results[0]?.criteriaDiagnostic
    ?.scorePercent,
);
assert.equal(canonicalInternalDeliveryDepth(sdSkillOnly, committed), 0);
assert.equal(canonicalInternalDeliveryDepth(exactNoDelivery, committed), 0);
assert.equal(
  byId.get(exactNoDelivery.candidateId)?.criteriaDiagnostic?.scorePercent,
  0,
);
assert.ok(
  (byId.get(exactGroundedId)?.profileCompletenessPercent || 0) >
    (byId.get(missingTitle.candidateId)?.profileCompletenessPercent || 0),
);

const exactNoDeliveryWithExperience = candidate(
  "exact-fico-no-delivery-grounded-years",
  "SAP FICO Consultant",
  { experienceEstablished: true },
);
const experiencePair = searchCandidatesV2(
  [exactNoDelivery, exactNoDeliveryWithExperience],
  request,
).results;
assert.ok(
  experiencePair.find(
    (result) =>
      result.candidateId === exactNoDeliveryWithExperience.candidateId,
  )!.profileCompletenessPercent! >
    experiencePair.find(
      (result) => result.candidateId === exactNoDelivery.candidateId,
    )!.profileCompletenessPercent!,
  "grounded experience duration must increase evidence completeness",
);
assert.ok(
  experiencePair.find(
    (result) =>
      result.candidateId === exactNoDeliveryWithExperience.candidateId,
  )!.evidenceConfidencePercent! >
    experiencePair.find(
      (result) => result.candidateId === exactNoDelivery.candidateId,
    )!.evidenceConfidencePercent!,
  "missing experience lowers evidence confidence without changing basic-query eligibility",
);

const runtimeLifecycle = canonicalLifecycleEvidenceFromCandidateSource(
  "runtime-shaped-candidate",
  {
    current_title: "SAP FICO Consultant",
    raw_text: [
      "SAP FICO Consultant",
      "Implemented, configured and deployed SAP FICO for client: Example Alpha.",
      "Supported SAP FICO cutover and go-live for client: Example Alpha.",
      "Implemented SAP FICO for client: Example Beta.",
      "SAP FICO implementation configuration deployment support.",
    ].join("\n"),
  },
).filter((entry) => entry.contextConceptIds?.includes("FICO"));
assert.equal(
  new Set(runtimeLifecycle.map((entry) => entry.projectId)).size,
  1,
  "runtime narrative lifecycle sentences without a stable parsed assignment boundary count as one evidence body",
);

const groundedCardResult = byId.get(exactGroundedId)!;
const groundedCardMarkup = renderToStaticMarkup(
  createElement(CompactCandidateCard, {
    result: groundedCardResult as never,
    rank: 1,
    searchContextId: "synthetic-internal-calibration",
    intent: parseRecruiterSearchIntent("SAP FICO"),
    expanded: false,
    diagnostic: {
      matchLevel: groundedCardResult.matchLabel,
      evidenceConfidence: "High",
      evidenceCoveragePercent: groundedCardResult.evidenceConfidencePercent,
      requirements: [],
      criteria: groundedCardResult.criteriaDiagnostic?.criteria || [],
    } as never,
    onToggle: () => undefined,
  }),
);
assert.match(groundedCardMarkup, /SAP FICO delivery depth/);
assert.match(
  groundedCardMarkup,
  /Supported by 3 relevant delivery assignments/,
);
assert.match(
  groundedCardMarkup,
  new RegExp(`${groundedCardResult.rankingScore}%`),
);

const noDeliveryResult = byId.get(exactNoDelivery.candidateId)!;
const noDeliveryCardMarkup = renderToStaticMarkup(
  createElement(CompactCandidateCard, {
    result: noDeliveryResult as never,
    rank: 1,
    searchContextId: "synthetic-internal-calibration",
    intent: parseRecruiterSearchIntent("SAP FICO"),
    expanded: false,
    diagnostic: {
      matchLevel: noDeliveryResult.matchLabel,
      evidenceConfidence: "Moderate",
      evidenceCoveragePercent: noDeliveryResult.evidenceConfidencePercent,
      requirements: [],
      criteria: noDeliveryResult.criteriaDiagnostic?.criteria || [],
    } as never,
    onToggle: () => undefined,
  }),
);
assert.match(
  noDeliveryCardMarkup,
  /Supporting information was not found in the profile/,
);

for (const result of response.results) {
  assert.equal(result.rankingScore, result.overallMatchScore);
  assert.equal(result.score.finalScore, result.rankingScore);
  assert.equal(displayedRankingScore(result), result.rankingScore);
  assert.equal(result.matchLabel, canonicalMatchLabel(result.rankingScore!));
}
assert.deepEqual(
  [...response.results]
    .sort(compareCanonicalSearchResults)
    .map((result) => result.candidateId),
  response.results.map((result) => result.candidateId),
);
assert.equal(
  response.bucketCounts!.strong +
    response.bucketCounts!.good +
    response.bucketCounts!.potential,
  response.summary.totalMatched,
);
const thresholdedResponse = searchCandidatesV2(documents, {
  ...request,
  minimumScore: 70,
});
assert.ok(
  thresholdedResponse.results.every(
    (result) => result.rankingScore! >= 70 && result.score.finalScore >= 70,
  ),
  "minimum-score visibility is enforced against the canonical displayed score",
);

const belowEightId = "compound-below-eight";
const compoundBelowEight = {
  ...candidate(belowEightId, "SAP FICO Consultant", {
    lifecycle: [lifecycle(belowEightId, "implementation", "Implementation")],
    experienceEstablished: true,
  }),
  totalYearsExperience: 5,
};
const compoundResponse = searchCandidatesV2(
  [exactGrounded, exactOneAssignment, compoundBelowEight],
  {
    query:
      "SAP FICO consultant in Malaysia with 8+ years and implementation experience",
    talentPool: "internal_profiles",
    minimumScore: 0,
    pageSize: 20,
    filters: {
      locations: ["Malaysia"],
      minimumTotalYearsExperience: 8,
      deliveryExperience: ["Implementation"],
    },
    criteria: request.criteria,
  },
);
assert.deepEqual(
  compoundResponse.results.map((result) => result.candidateId),
  [exactGroundedId],
  "the five-filter internal compound query still rejects unknown and below-eight experience",
);

const plainFicoResponse = searchCandidatesV2(documents, {
  query: "SAP FICO",
  talentPool: "internal_profiles",
  minimumScore: 0,
  pageSize: 20,
});
const plainById = new Map(
  plainFicoResponse.results.map((result) => [result.candidateId, result]),
);
assert.equal(plainFicoResponse.results[0]?.candidateId, exactGroundedId);
for (const skillOnlyId of [sdSkillOnly.candidateId, mmSkillOnly.candidateId]) {
  assert.notEqual(plainById.get(skillOnlyId)?.matchLabel, "Strong Match");
  assert.ok(
    (plainById.get(skillOnlyId)?.supportedProfessionalEvidenceDepth || 0) <
      (plainById.get(exactGroundedId)?.supportedProfessionalEvidenceDepth || 0),
  );
}
assert.notEqual(
  plainById.get(genericSap.candidateId)?.matchLabel,
  "Strong Match",
);
assert.notEqual(
  plainById.get(missingTitle.candidateId)?.matchLabel,
  "Strong Match",
);

const pageBoundaryDocuments = Array.from({ length: 25 }, (_, index) =>
  candidate(
    `page-boundary-${String(index).padStart(2, "0")}`,
    "SAP FICO Consultant",
    {
      lifecycle:
        index < 5
          ? [
              lifecycle(
                `page-boundary-${String(index).padStart(2, "0")}`,
                `project-${index}-a`,
                "Implementation",
              ),
              lifecycle(
                `page-boundary-${String(index).padStart(2, "0")}`,
                `project-${index}-b`,
                "Rollout",
              ),
            ]
          : index < 15
            ? [
                lifecycle(
                  `page-boundary-${String(index).padStart(2, "0")}`,
                  `project-${index}`,
                  "Implementation",
                ),
              ]
            : [],
      experienceEstablished: index % 2 === 0,
    },
  ),
);
const boundaryPageOne = searchCandidatesV2(pageBoundaryDocuments, {
  ...request,
  page: 1,
  pageSize: 20,
});
const boundaryPageTwo = searchCandidatesV2(pageBoundaryDocuments, {
  ...request,
  page: 2,
  pageSize: 20,
});
assert.ok(
  Number(boundaryPageOne.results.at(-1)!.overallMatchScore) >=
    Number(boundaryPageTwo.results[0]!.overallMatchScore),
  "canonical ranking remains globally descending across local page boundaries",
);

console.log("SAP Talent Hub FICO ranking calibration tests passed.");
