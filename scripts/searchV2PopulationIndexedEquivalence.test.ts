import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
  evaluateCommittedPopulation,
} from "../lib/searchV2CommittedRequirements";
import { rankCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
} from "../lib/candidateSearchV2Types";

const payload = JSON.parse(
  readFileSync("tmp/search-v2-runtime-snapshot.json", "utf8"),
) as { documents: CandidateSearchV2Document[]; sourceRows: number };
assert.equal(payload.sourceRows, 833);
assert.equal(payload.documents.length, 833);
const canonicalDocuments = dedupeCandidateSearchV2Documents(
  payload.documents,
).documents;
assert.equal(canonicalDocuments.length, 822);

const requests: CandidateSearchV2Request[] = [
  {
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
    ],
  },
  {
    query: "SAP OTC Consultant in Singapore",
    talentPool: "internal_profiles",
  },
  {
    query:
      "Senior software engineer in Malaysia with at least 5 years experience",
    talentPool: "internal_profiles",
  },
  { query: "Consultant", talentPool: "linkedin_talent_pool" },
];

for (const request of requests) {
  const requirements = buildCommittedSearchRequirements(request);
  const reference = new Map(
    canonicalDocuments.map((candidate) => [
      candidate.candidateId,
      evaluateCommittedCandidate(candidate, requirements),
    ]),
  );
  const indexed = evaluateCommittedPopulation(canonicalDocuments, requirements);
  const referenceIds = [...reference]
    .filter(([, evaluation]) => evaluation.eligible)
    .map(([candidateId]) => candidateId)
    .sort();
  assert.deepEqual([...indexed.eligibleCandidateIds].sort(), referenceIds);
  for (const candidateId of referenceIds)
    assert.deepEqual(
      indexed.evaluations.get(candidateId),
      reference.get(candidateId),
    );

  const indexedRanking = rankCandidatesV2(
    canonicalDocuments,
    request,
    undefined,
    true,
  );
  const referenceDocuments = canonicalDocuments.map((candidate) => ({
    ...candidate,
    searchTargetEvidence: undefined,
    searchConceptIds: undefined,
    searchConceptEvidence: undefined,
  }));
  const referenceRanking = rankCandidatesV2(
    referenceDocuments,
    request,
    undefined,
    true,
  );
  assert.deepEqual(
    indexedRanking.map(({ candidateId, score }) => [
      candidateId,
      score.finalScore,
    ]),
    referenceRanking.map(({ candidateId, score }) => [
      candidateId,
      score.finalScore,
    ]),
  );
}

console.log(
  JSON.stringify({
    suite: "searchV2PopulationIndexedEquivalence",
    sourceProfiles: payload.sourceRows,
    canonicalEntities: canonicalDocuments.length,
    representativeRequests: requests.length,
    eligibilityOrderingStatusEvidenceScores: "identical",
  }),
);
