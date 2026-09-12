import assert from "node:assert/strict";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import {
  clarificationQuestionsFor,
  experienceRangeInText,
  languagesInText,
  professionalRolesInText,
} from "../lib/searchV2RequirementOntology";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

const candidate = (
  id: string,
  pool: "internal_profiles" | "linkedin_talent_pool",
  location: string,
  evidence: string[],
  years = 10,
): CandidateSearchV2Document => ({
  candidateId: id,
  sourceRecordId: id,
  talentPool: pool,
  candidateName: id,
  currentTitle: evidence[0] || null,
  location,
  country: location.includes("Singapore") ? "Singapore" : location.includes("Japan") ? "Japan" : "Malaysia",
  locationEvidenceState: location ? "VERIFIED" : "UNKNOWN",
  totalYearsExperience: years,
  skills: [],
  sapModules: [],
  industries: [],
  languages: [],
  trustedCandidateEvidence: {
    candidateId: id,
    values: evidence.map((value, index) => ({
      value,
      sourceType: index === 0 ? "raw_title" : "raw_experience",
      sourceField: index === 0 ? "request_candidate.currentTitle" : /mandarin|japanese|english/i.test(value) ? "candidate_profile.language_section" : "request_candidate.raw_text",
      sourceRecordId: id,
      provenance: "candidate_record_raw",
      trusted: true,
    })),
  },
});

const ficoText = buildCommittedSearchRequirements({
  query: "SAP FICO Malaysia Mandarin",
});
assert.deepEqual(
  ficoText.requirements.map((item) => item.kind),
  ["target", "location", "language"],
);
assert.match(ficoText.summary, /SAP FICO/);
assert.match(ficoText.summary, /Malaysia/);
assert.match(ficoText.summary, /Mandarin/);

const ficoFilters = buildCommittedSearchRequirements({
  query: "",
  filters: {
    sapModules: ["SAP FICO"],
    countries: ["Malaysia"],
    languages: ["Mandarin"],
  },
});
assert.deepEqual(
  ficoFilters.requirements.map((item) => [item.kind, item.label]),
  ficoText.requirements.map((item) => [item.kind, item.label]),
  "equivalent natural text and filters produce equivalent hard groups",
);
assert.equal(
  ficoFilters.semanticIdentity,
  ficoText.semanticIdentity,
  "equivalent natural text and Filters must share committed semantic identity",
);

const consultantText = buildCommittedSearchRequirements({
  query: "SAP FICO Consultant Malaysia Mandarin",
});
const consultantFilters = buildCommittedSearchRequirements({
  query: "",
  filters: {
    anyTitles: ["Consultant"],
    sapModules: ["SAP FICO"],
    countries: ["Malaysia"],
    languages: ["Mandarin"],
  },
});
assert.deepEqual(
  consultantFilters.requirements.map((item) => [item.kind, item.label]),
  consultantText.requirements.map((item) => [item.kind, item.label]),
);
assert.equal(consultantFilters.semanticIdentity, consultantText.semanticIdentity);

for (const [query, concept, role, location] of [
  ["SAP ABAP Developer Singapore", "ABAP", "Developer", "Singapore"],
  ["SAP Basis Lead Thailand 10+ years", "BASIS", "Lead", "Thailand"],
  ["SAP EWM Consultant Malaysia or Singapore", "EWM", "Consultant", "Malaysia or Singapore"],
  ["SAP Datasphere Architect Japan", "DATASPHERE", "Architect", "Japan"],
] as const) {
  const committed = buildCommittedSearchRequirements({ query });
  assert.ok(committed.requirements.some((item) => item.kind === "target" && item.conceptId === concept));
  assert.ok(committed.requirements.some((item) => item.kind === "professional_role" && item.label === role));
  assert.ok(committed.requirements.some((item) => item.kind === "location" && item.label.includes(location)));
}

assert.equal(languagesInText("FICO consultant with Mandarin").at(0)?.label, "Mandarin");
assert.equal(professionalRolesInText("Senior SAP FICO Consultant").at(0)?.label, "Consultant");
assert.deepEqual(experienceRangeInText("minimum 8 years"), { minimum: 8, maximum: null });

const eligible = candidate(
  "internal-fico",
  "internal_profiles",
  "Malaysia",
  ["SAP FICO Consultant", "Business-level Mandarin", "SAP FI/CO delivery."],
);
assert.equal(evaluateCommittedCandidate(eligible, ficoText).eligible, true);
assert.equal(
  evaluateCommittedCandidate(
    candidate("no-language", "internal_profiles", "Malaysia", ["SAP FICO Consultant"]),
    ficoText,
  ).eligible,
  false,
);
assert.equal(
  evaluateCommittedCandidate(
    candidate("wrong-pool", "linkedin_talent_pool", "Malaysia", ["SAP FICO Consultant", "Mandarin"]),
    ficoText,
  ).eligible,
  false,
  "source pools cannot cross-qualify",
);

const linkedInSnapshot = buildCommittedSearchRequirements({
  query: "SAP FICO Malaysia Mandarin",
  talentPool: "linkedin_talent_pool",
});
assert.notEqual(linkedInSnapshot.semanticIdentity, ficoText.semanticIdentity);
assert.equal(evaluateCommittedCandidate(candidate("linkedin-fico", "linkedin_talent_pool", "Malaysia", ["SAP FICO Consultant", "Mandarin"]), linkedInSnapshot).eligible, true);

const questions = clarificationQuestionsFor({
  wording: "SAP FICO",
  hasLocation: false,
  hasExperience: false,
  hasLanguage: false,
  hasDelivery: false,
});
assert.deepEqual(questions.map((item) => item.id), ["location", "experience", "delivery", "language"]);
assert.equal(
  clarificationQuestionsFor({
    wording: "SAP FICO Malaysia Mandarin 8+ years implementation",
    hasLocation: true,
    hasExperience: true,
    hasLanguage: true,
    hasDelivery: true,
  }).length,
  0,
);

const criteriaOnly = buildCommittedSearchRequirements({
  query: "SAP FICO Malaysia",
  criteria: [{
    id: "criterion:s4hana",
    label: "S/4HANA implementation",
    conceptId: "S4HANA",
    importance: "most_important",
    source: "ai_suggestion",
  }],
});
assert.equal(criteriaOnly.requirements.some((item) => item.id === "target:S4HANA"), false);
assert.equal(criteriaOnly.criteria.length, 1, "ranking criteria do not become hard filters");

console.log("Unified Search V2 architecture tests passed");
