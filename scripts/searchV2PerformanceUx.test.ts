import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import {
  buildCommittedSearchRequirements,
  buildSearchV2EligibilityDiagnostic,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import { rankCandidatesV2 } from "../lib/candidateSearchV2Engine";
import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
} from "../lib/candidateSearchV2Types";

const request: CandidateSearchV2Request = {
  query:
    "Senior SAP FICO Consultant in Malaysia with Mandarin and at least 8 years of experience",
  talentPool: "internal_profiles",
  filters: { deliveryExperience: ["Implementation"] },
  criteria: [
    {
      id: "leadership",
      label: "Stakeholder leadership",
      importance: "important",
      source: "filter",
    },
    {
      id: "transformation",
      label: "Transformation delivery",
      importance: "nice_to_have",
      source: "filter",
    },
  ],
  clarificationAnswers: { title_scope: "Current or historical title" },
  page: 1,
  pageSize: 20,
};
const document = (index: number): CandidateSearchV2Document =>
  ({
    candidateId: `candidate-${index}`,
    canonicalCandidateId: `candidate-${index}`,
    sourceCandidateIds: [`candidate-${index}`],
    talentPool: "internal_profiles",
    candidateName: `Candidate ${index}`,
    currentTitle:
      index % 3 ? "Senior SAP FICO Consultant" : "Software Engineer",
    currentEmployer: "Example",
    location: index % 2 ? "Malaysia" : "Singapore",
    country: index % 2 ? "Malaysia" : "Singapore",
    totalYearsExperience: index % 4 ? 12 : 4,
    primaryModule: index % 3 ? "FICO" : null,
    sapModules: index % 3 ? ["FICO"] : [],
    skills: [],
    languages: index % 5 ? ["Mandarin"] : [],
    industries: [],
    projectTypes: index % 7 ? ["Implementation"] : [],
    evidence: [],
    trustedCandidateEvidenceValues:
      index % 3
        ? [
            {
              value: "Senior SAP FICO Consultant",
              sourceType: "raw_title",
              sourceField: "candidates.current_title",
              sourceRecordId: `candidate-${index}`,
              provenance: "candidate_record_raw",
              trusted: true,
              normalizedSegments: [],
            },
            {
              value: "Languages: Mandarin fluent",
              sourceType: "raw_professional_text",
              sourceField: "candidate_profile.language_section",
              sourceRecordId: `candidate-${index}`,
              provenance: "candidate_record_raw",
              trusted: true,
              normalizedSegments: [],
            },
            {
              value: "Led SAP FICO implementation assignment",
              sourceType: "raw_project",
              sourceField: "candidate.projects",
              sourceRecordId: `candidate-${index}`,
              provenance: "candidate_record_raw",
              trusted: true,
              normalizedSegments: [],
            },
          ]
        : [],
    updatedAt: "2026-09-01",
    searchText: "",
    qualityScore: 1,
    confidenceScore: 1,
    recencyScore: 1,
    domainEvidence: [],
    domainImplementationEvidence: [],
    ficoRelevance: "not_verified",
    locationEvidenceState: "VERIFIED",
    profileEvidence: {
      name: true,
      title: true,
      employer: true,
      location: true,
      experienceDuration: true,
      employmentHistory: true,
      projectHistory: true,
      education: false,
      certifications: false,
      skills: true,
    },
  }) as unknown as CandidateSearchV2Document;
const documents = Array.from({ length: 833 }, (_, index) => document(index));
const timings: number[] = [];
for (let run = 0; run < 12; run++) {
  const started = performance.now();
  rankCandidatesV2(documents, request, {}, true);
  timings.push(performance.now() - started);
}
const sorted = [...timings].sort((a, b) => a - b),
  median = sorted[Math.floor(sorted.length / 2)],
  p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
assert(
  p95 < 2000,
  `833-candidate p95 ${p95.toFixed(1)}ms exceeds regression ceiling`,
);
const committed = buildCommittedSearchRequirements(request),
  evaluations = new Map(
    documents.map((item) => [
      item.candidateId,
      evaluateCommittedCandidate(item, committed),
    ]),
  );
assert.equal(committed.requirements.length, 7);
for (const expected of [
  "SAP FICO",
  "Consultant",
  "Malaysia",
  "8+ years",
  "Senior",
  "Mandarin",
  "Implementation",
])
  assert(
    committed.requirements.some((item) => item.label.includes(expected)),
    `missing canonical value ${expected}`,
  );
const granular: any = {};
rankCandidatesV2(
  documents,
  {
    ...request,
    criteria: [{ ...request.criteria![0], label: "Changed ranking criterion" }],
  },
  granular,
  true,
);
assert(granular.hardFilterProfile.candidateRequirementEvaluations > 0);
assert(granular.hardFilterProfile.cacheHits > 0);
assert(granular.hardFilterProfile.byKind.target.calls > 0);
const funnel = buildSearchV2EligibilityDiagnostic(
  documents,
  committed,
  evaluations,
);
assert.equal(funnel.poolPopulation, 833);
assert.equal(funnel.funnel.length, committed.requirements.length);
assert(
  funnel.funnel.every(
    (item, index) =>
      index === 0 || item.entering === funnel.funnel[index - 1].remaining,
  ),
);
const linkedin = buildCommittedSearchRequirements({
    ...request,
    talentPool: "linkedin_talent_pool",
  }),
  linkedinEvaluations = new Map(
    documents.map((item) => [
      item.candidateId,
      evaluateCommittedCandidate(item, linkedin),
    ]),
  );
assert.deepEqual(
  buildSearchV2EligibilityDiagnostic(documents, linkedin, linkedinEvaluations),
  {
    selectedPool: "linkedin_talent_pool",
    poolPopulation: 0,
    emptyPool: true,
    funnel: linkedin.requirements.map((requirement) => ({
      requirementId: requirement.id,
      label: requirement.label,
      kind: requirement.kind,
      entering: 0,
      excluded: 0,
      remaining: 0,
      evaluated: false,
      evidencePolicy:
        "Candidate-bound verified or policy-approved supported evidence is required.",
      explanation:
        "Not evaluated because no candidates remained after earlier required filters.",
    })),
  },
);
const client = readFileSync(
    "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
    "utf8",
  ),
  filters = readFileSync(
    "app/recruiter/talent-search/v2/SearchFiltersPanel.tsx",
    "utf8",
  ),
  criteria = readFileSync(
    "app/recruiter/talent-search/v2/SearchCriteriaPanel.tsx",
    "utf8",
  ),
  dataset = readFileSync("lib/searchV2Dataset.ts", "utf8");
for (const state of [
  "not_committed",
  "searching_initial",
  "showing_results",
  "refreshing_existing_results",
  "completed_zero",
  "failed",
  "timed_out",
  "cancelled",
])
  assert(client.includes(state));
assert.match(client, /Searching candidates/);
assert.match(client, /previous results remain visible/i);
assert.match(client, /Search took longer than 15 seconds/);
assert.match(client, /pendingSearchKeyRef\.current ===/);
assert.match(client, /eligibilityDiagnostic\?\.funnel/);
assert.match(filters, /Project and delivery experience/);
assert.match(filters, /activeValues/);
assert.match(criteria, /<textarea/);
assert.match(criteria, /criteria"} will be applied/);
assert.doesNotMatch(criteria, /applied on update/);
assert.match(client, /searchUiState==="searching_initial"/);
assert.match(client, /!committedSnapshot \? "hidden"/);
assert.match(client, /refreshing_existing_results/);
assert.match(client, /searchElapsedMs>=2000/);
assert.match(client, /15000/);
assert.match(filters, /committed\.requirements/);
assert.match(criteria, /w-full resize-y/);
assert.equal((criteria.match(/title="Ranking Criteria"/g) || []).length, 1);
assert.match(dataset, /buildCandidateSearchV2ProfilePreview/);
assert.match(dataset, /explicitLanguageSectionEvidence/);
assert.doesNotMatch(client, /results\.map[\s\S]{0,300}fetch\(/);
console.log(
  JSON.stringify({
    suite: "searchV2PerformanceUx",
    population: documents.length,
    medianMs: +median.toFixed(1),
    p95Ms: +p95.toFixed(1),
    requirements: committed.requirements.length,
    linkedinPool: 0,
    hardFilterProfile: granular.hardFilterProfile,
  }),
);
