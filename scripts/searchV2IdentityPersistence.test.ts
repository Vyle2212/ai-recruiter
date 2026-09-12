import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANDIDATE360_SEARCH_CONTEXT_KEY,
  candidate360MatchedByCandidate,
  resolveCandidate360SearchContext,
} from "../lib/candidate360SearchContext";
import { loadSearchV2SessionSnapshot } from "../lib/searchV2SessionMigration";
import {
  canonicalLookupMatches,
  detectSearchV2UnifiedIntent,
  identityOnlyCandidateProjection,
} from "../lib/searchV2UnifiedIntent";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

const documents: CandidateSearchV2Document[] = [
  ["indra", "Indra Permana", "Business Support Analyst (SAP FICO)"],
  ["gunawan", "Gunawan Lie", null],
  ["teck", "Teck Chiewlim", "SAP FICO Functional Consultant"],
  ["4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8", null, "SAP PS Team Lead"],
].map(([candidateId, candidateName, currentTitle]) => ({
  candidateId: String(candidateId),
  canonicalCandidateId: String(candidateId),
  sourceCandidateIds: [String(candidateId)],
  candidateName: candidateName as string | null,
  currentTitle: currentTitle as string | null,
  currentEmployer: null,
  location: null,
  country: null,
  totalYearsExperience: null,
  skills: ["FICO"],
  sapModules: ["FICO"],
  dataConfidenceScore: 78,
}));

for (const query of ["Indra Permana", "Gunawan", "Teck Chiewlim", "#A8CCB8"]) {
  const matched = canonicalLookupMatches(
    documents,
    detectSearchV2UnifiedIntent(query),
  );
  assert.equal(matched.length, 1, `${query} resolves one canonical person`);
  const result = identityOnlyCandidateProjection(matched[0].document);
  assert.equal(result.retrievalKind, "identity_match");
  assert.equal(result.evaluation, null);
  assert.equal(result.score, null);
  assert.equal(result.matchLabel, null);
  assert.equal(result.requiredCoveragePercent, null);
  assert.equal(result.criteriaDiagnostic, null);
  const matchedByCandidate = candidate360MatchedByCandidate(
    [result],
    "identity_only",
    () => {
      throw new Error(
        "identity persistence must not request recruiter-fit confidence",
      );
    },
  );
  assert.deepEqual(matchedByCandidate[result.candidateId], {
    kind: "identity_match",
    profileDataConfidencePercent: 78,
  });
  assert.equal("finalScore" in matchedByCandidate[result.candidateId], false);
  const response = {
    generatedAt: "2026-09-07T00:00:00.000Z",
    request: { query, mode: "hybrid", page: 1, pageSize: 20, minimumScore: 0 },
    summary: {
      totalDocuments: documents.length,
      totalMatched: 1,
      eligibleTotal: 1,
      visibleTotal: 1,
      verifiedVisible: 0,
      supportedVisible: 0,
      relatedVisible: 0,
      appliedMinimumScore: 0,
      appliedMatchQuality: "any",
      returned: 1,
      page: 1,
      pageSize: 20,
    },
    results: [result],
    evaluationMode: "identity_only",
  };
  const stored = JSON.stringify({
    contextId: "identity-context",
    query,
    response,
    candidateIds: [result.candidateId],
    matchedByCandidate,
    returnUrl: "/recruiter/talent-search/v2",
  });
  const storage = {
    getItem: (key: string) =>
      key === CANDIDATE360_SEARCH_CONTEXT_KEY ? stored : null,
    removeItem: () => undefined,
  };
  const restored = loadSearchV2SessionSnapshot(
    storage,
    CANDIDATE360_SEARCH_CONTEXT_KEY,
  );
  assert.equal(restored.status, "restored");
  if (restored.status !== "restored")
    throw new Error("identity snapshot was not restored");
  assert.equal(restored.response?.evaluationMode, "identity_only");
  assert.equal((restored.response?.results[0] as typeof result).score, null);
  const context = resolveCandidate360SearchContext(
    restored.snapshot,
    result.candidateId,
    "identity-context",
  );
  assert.equal(
    context?.matchedByCandidate?.[result.candidateId]?.kind,
    "identity_match",
  );
}

const partial = candidate360MatchedByCandidate(
  [{ candidateId: "partial", retrievalKind: "identity_match", score: null }],
  "identity_only",
  () => "limited",
);
assert.deepEqual(partial.partial, { kind: "identity_match" });
const legacy = resolveCandidate360SearchContext(
  {
    contextId: "legacy",
    candidateIds: ["legacy-candidate"],
    returnUrl: "/recruiter/talent-search/v2",
    matchedByCandidate: {
      "legacy-candidate": { finalScore: 82, matchedSkills: ["FICO"] },
    },
  },
  "legacy-candidate",
  "legacy",
);
assert.equal(
  legacy?.matchedByCandidate?.["legacy-candidate"] &&
    "finalScore" in legacy.matchedByCandidate["legacy-candidate"],
  true,
);
const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
const drawer = readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(client, /candidate360MatchedByCandidate/);
assert.doesNotMatch(client, /finalScore:\s*item\.score\.finalScore/);
assert.doesNotMatch(drawer, /Recruiter fit/);
assert.doesNotMatch(drawer, /Not evaluated/);
console.log(
  "Search V2 scoreless identity persistence and restore tests passed.",
);
