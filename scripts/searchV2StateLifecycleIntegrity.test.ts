import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCommittedSearchRequirements,
  canonicalHardRequirementCounts,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import { evaluateSearchCriteria } from "../lib/searchV2Criteria";
import {
  redactSearchV2VisibleEvidence,
  sanitizeSearchV2VisiblePayload,
} from "../lib/searchV2VisibleEvidence";
import { candidateSearchV2ProjectionDocument } from "../lib/candidateSearchV2Projection";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

const fresh = buildCommittedSearchRequirements({ query: "SAP FICO" });
assert.deepEqual(
  fresh.requirements.map((item) => item.kind),
  ["target"],
);
const malaysia = buildCommittedSearchRequirements({
  query: "SAP FICO Malaysia",
});
assert.deepEqual(
  malaysia.requirements.map((item) => item.kind),
  ["target", "location"],
);
const implementation = buildCommittedSearchRequirements({
  query: "SAP FICO Malaysia implementation",
});
assert.deepEqual(
  implementation.requirements.map((item) => item.kind),
  ["target", "location", "lifecycle"],
);

const anyLifecycle = buildCommittedSearchRequirements({
  query: "SAP FICO",
  filters: {
    deliveryExperience: ["Implementation", "Rollout", "Migration"],
    deliveryExperienceOperator: "any",
  },
});
assert.equal(canonicalHardRequirementCounts(anyLifecycle).counts.delivery, 1);
const lifecycleGroup = anyLifecycle.requirements.find(
  (item) => item.kind === "lifecycle",
);
assert.equal(lifecycleGroup?.operator, "any");

const titleEvidence = {
  value: "SAP FI/CO Consultant",
  sourceType: "raw_title" as const,
  sourceField: "candidates.current_title",
  sourceRecordId: "candidate-1",
  provenance: "candidate_record_raw" as const,
  trusted: true,
};
const base: CandidateSearchV2Document = {
  candidateId: "candidate-1",
  candidateName: "Candidate One",
  currentTitle: "SAP FI/CO Consultant",
  talentPool: "internal_profiles",
  trustedCandidateEvidence: {
    candidateId: "candidate-1",
    values: [titleEvidence],
  },
  lifecycleEvidence: [],
} as CandidateSearchV2Document;
const criterion = [
  {
    id: "depth",
    label: "Demonstrated SAP FICO delivery depth",
    conceptId: "FICO",
    importance: "important" as const,
    source: "ai_suggestion" as const,
  },
];
assert.equal(evaluateSearchCriteria(base, criterion).scorePercent, 0);
const grounded: CandidateSearchV2Document = {
  ...base,
  lifecycleEvidence: [
    {
      projectId: "candidate-1:project-1",
      lifecycleType: "Implementation",
      sourceType: "project",
      sourceField: "projects.1",
      sourceRecordId: "candidate-1",
      excerpt: "Delivered SAP FICO implementation for a client",
      evidenceLevel: "supported",
      modules: ["FICO"],
    },
  ],
};
assert(evaluateSearchCriteria(grounded, criterion).scorePercent > 0);
assert.equal(
  evaluateCommittedCandidate(grounded, implementation).eligible,
  false,
  "Malaysia remains independently required",
);
const implementationOnly = buildCommittedSearchRequirements({
  query: "implementation",
});
assert.equal(
  evaluateCommittedCandidate(base, implementationOnly).eligible,
  false,
  "title-only evidence cannot satisfy implementation",
);
assert.equal(
  evaluateCommittedCandidate(grounded, implementationOnly).eligible,
  true,
);

const visible = sanitizeSearchV2VisiblePayload({
  projects: [
    {
      summary: "Call +60 12-345 6789 or person@example.com for project details",
    },
  ],
});
assert.doesNotMatch(JSON.stringify(visible), /person@example\.com|12-345 6789/);
assert.equal(
  redactSearchV2VisibleEvidence("person@example.com +60 12-345 6789"),
  "",
);
assert.doesNotMatch(JSON.stringify(visible), /\[(?:email|phone) redacted\]/i);

const repairedIdentity = candidateSearchV2ProjectionDocument({
  candidate_id: "candidate-quality-1",
  display_name: "Candidate Quality",
  display_title: "SAP FI/CO Consultant in CapgeminiMalaysiasdnbhd form",
  display_company: "CapgeminiMalaysiasdnbhd form",
});
assert.equal(repairedIdentity.currentTitle, "SAP FI/CO Consultant");
assert.equal(repairedIdentity.currentEmployer, "Capgemini Malaysia Sdn Bhd");

const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(client, /setExtendedFilters\(\{\}\)/);
assert.match(
  client,
  /dispatchPreparation\(\{ type: "reset", query: nextQuery \}\)/,
);
assert.match(client, /Start new search/);
assert.match(client, /Results from previous search/);
assert.doesNotMatch(client, />\s*Criteria \(\{criteria\.length\}\)\s*</);
const review = readFileSync(
  "app/recruiter/talent-search/v2/SearchPreparationReview.tsx",
  "utf8",
);
assert.equal((review.match(/Edit Criteria/g) || []).length, 1);

console.log(
  "Search V2 query ownership, lifecycle semantics, grounded Criteria, duplicate UX, and PII tests passed",
);
