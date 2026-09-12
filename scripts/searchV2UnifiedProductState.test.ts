import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement, type ReactNode } from "react";
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: ReactNode) => string;
};
import {
  confirmedClarificationValues,
  initialPreparation,
  preparationIdentity,
  questionsForSearch,
  searchPreparationReducer,
} from "../lib/searchV2Preparation";
import {
  addCriterion,
  editCriterion,
  promoteCriterion,
  removeCriterion,
  reorderCriterion,
} from "../lib/searchV2ReviewState";
import { evaluateSearchCriteria } from "../lib/searchV2Criteria";
import type {
  CandidateSearchCriterion,
  CandidateSearchV2Document,
} from "../lib/candidateSearchV2Types";
import { buildCommittedSearchRequirements } from "../lib/searchV2CommittedRequirements";
import { resolveSearchV2SourceReadiness } from "../lib/searchV2SourceReadiness";
import SearchPreparationReview from "../app/recruiter/talent-search/v2/SearchPreparationReview";

const query = "SAP EWM Consultant";
const identity = preparationIdentity(query);
const questions = questionsForSearch(query, {
  locations: ["Malaysia"],
  minimumTotalYearsExperience: 5,
  languages: ["Japanese"],
});
assert(!questions.some((item) => item.id === "location"));
assert(!questions.some((item) => item.id === "experience"));
assert(!questions.some((item) => item.id === "language"));
assert(questions.some((item) => item.id === "title_scope"));
const conflicts = questionsForSearch("SAP EWM Consultant Malaysia Mandarin", {
  locations: ["Singapore"],
  languages: ["Japanese"],
});
assert(conflicts.some((item) => item.id === "conflict_location"));
assert(conflicts.some((item) => item.id === "conflict_language"));
assert(
  conflicts.every(
    (item) => !item.options.length || item.options.includes("No preference"),
  ),
);

let state = searchPreparationReducer(initialPreparation(query), {
  type: "prepare",
  query,
});
state = searchPreparationReducer(state, {
  type: "prepared",
  identity,
  questions,
});
const first = state.questions[0];
state = searchPreparationReducer(state, {
  type: "answer",
  identity,
  questionId: first.id,
  values: first.options.slice(0, 1),
});
assert.equal(state.currentIndex, 1);
state = searchPreparationReducer(state, { type: "back", identity });
assert.equal(state.currentIndex, 0);
state = searchPreparationReducer(state, {
  type: "skip",
  identity,
  questionId: first.id,
});
assert.equal(state.answers[first.id].skipped, true);
state = searchPreparationReducer(state, {
  type: "revise",
  identity,
  questionId: first.id,
});
assert.equal(state.currentIndex, 0);
assert.deepEqual(confirmedClarificationValues(state), {});

const base: CandidateSearchCriterion[] = [];
const one = addCriterion(base, {
  id: "one",
  label: "Kubernetes",
  importance: "important",
  source: "filter",
});
const two = addCriterion(one, {
  id: "two",
  label: "Leadership",
  importance: "nice_to_have",
  source: "filter",
});
assert.equal(
  editCriterion(two, "two", { importance: "most_important" })[1].importance,
  "most_important",
);
assert.deepEqual(
  reorderCriterion(two, "two", 0).map((item) => item.id),
  ["two", "one"],
);
assert.deepEqual(
  removeCriterion(two, "one").map((item) => item.id),
  ["two"],
);
const promoted = promoteCriterion(one, "one", {});
assert.equal(promoted.criteria.length, 0);
assert.deepEqual(promoted.filters.skills, ["Kubernetes"]);

const candidate: CandidateSearchV2Document = {
  candidateId: "criterion-candidate",
  talentPool: "internal_profiles",
  trustedCandidateEvidence: {
    candidateId: "criterion-candidate",
    values: [
      {
        value: "No Kubernetes production experience",
        sourceType: "raw_experience",
        sourceField: "candidates.experience",
        sourceRecordId: "criterion-candidate",
        provenance: "candidate_record_raw",
        trusted: true,
      },
    ],
  },
};
const diagnostic = evaluateSearchCriteria(candidate, one);
assert.equal(diagnostic.criteria[0].state, "conflicting");
assert.equal(diagnostic.criteria[0].score, 0);
assert.equal(
  diagnostic.criteria[0].provenance?.candidateId,
  candidate.candidateId,
);

const filtersPanel = fs.readFileSync(
  "app/recruiter/talent-search/v2/SearchFiltersPanel.tsx",
  "utf8",
);
const criteriaPanel = fs.readFileSync(
  "app/recruiter/talent-search/v2/SearchCriteriaPanel.tsx",
  "utf8",
);
const review = fs.readFileSync(
  "app/recruiter/talent-search/v2/SearchPreparationReview.tsx",
  "utf8",
);
const client = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
// Transactional drawers use action-specific copy; these assertions protect the real visible controls.
for (const label of [
  "Apply filters",
  "Cancel",
  "Reset all",
  "Role:",
  "Seniority:",
  "Any:",
])
  assert.match(filtersPanel, new RegExp(label));
for (const label of ["Apply criteria", "Cancel", "Make required", "Move "])
  assert.match(criteriaPanel, new RegExp(label));
for (const label of [
  "Back",
  "Continue",
  "Skip",
  "Other",
  "Review before Search",
  "revise",
])
  assert.match(review, new RegExp(label, "i"));
assert.match(client, /latestRequestIdRef\.current !== requestId/);
assert.match(client, /abortController\.signal\.aborted/);
assert.match(client, /SAP Talent Hub/);
assert.match(client, /External Talent Network/);

const reviewState = searchPreparationReducer(initialPreparation(query), {
  type: "manual",
  identity,
});
const renderReadiness = (
  talentPool: "internal_profiles" | "linkedin_talent_pool",
  internalReady: boolean,
  external: Parameters<typeof resolveSearchV2SourceReadiness>[0]["external"],
  searchQuery = query,
) =>
  renderToStaticMarkup(
    createElement(SearchPreparationReview, {
      state: reviewState,
      dispatch: () => undefined,
      preview: buildCommittedSearchRequirements({
        query: searchQuery,
        talentPool,
      }),
      onOpenFilters: () => undefined,
      onOpenCriteria: () => undefined,
      onCommit: () => undefined,
      onCancel: () => undefined,
      sourceReadiness: resolveSearchV2SourceReadiness({
        talentPool,
        internalReady,
        external,
      }),
    }),
  );

const externalReadyMarkup = renderReadiness("linkedin_talent_pool", false, {
  available: true,
  connected: true,
  reason: null,
  status: "ready",
});
assert.match(externalReadyMarkup, />Commit Search</);
assert.doesNotMatch(externalReadyMarkup, /disabled=""/);
assert.doesNotMatch(
  externalReadyMarkup,
  /Preparing candidate data|shared candidate index/,
);

const externalDisconnectedMarkup = renderReadiness(
  "linkedin_talent_pool",
  false,
  {
    available: false,
    connected: false,
    reason: "SOURCE_NOT_CONNECTED",
    status: "not_connected",
  },
);
assert.match(
  externalDisconnectedMarkup,
  /External Talent Network is disconnected/,
);
assert.doesNotMatch(
  externalDisconnectedMarkup,
  /Preparing candidate data|shared candidate index/,
);

const externalUnavailableMarkup = renderReadiness(
  "linkedin_talent_pool",
  false,
  {
    available: false,
    connected: true,
    reason: "SOURCE_UNAVAILABLE",
    status: "unavailable",
  },
);
assert.match(
  externalUnavailableMarkup,
  /External Talent Network is unavailable/,
);
assert.doesNotMatch(
  externalUnavailableMarkup,
  /Preparing candidate data|shared candidate index/,
);

const sapPreparingMarkup = renderReadiness("internal_profiles", false, null);
assert.match(sapPreparingMarkup, /Preparing candidate search/);
assert.doesNotMatch(
  sapPreparingMarkup,
  /Ready when you are|shared candidate index/i,
);
assert.match(sapPreparingMarkup, /disabled=""/);
const tokenMarkup = renderReadiness(
  "internal_profiles",
  false,
  null,
  "#0BD318",
);
assert.match(tokenMarkup, />Commit Search</);
assert.doesNotMatch(tokenMarkup, /disabled=""|Preparing candidate search/);
console.log("Unified Search V2 product-state and interaction tests passed");
