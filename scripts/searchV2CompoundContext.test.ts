import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
} from "../lib/searchV2CommittedRequirements";
import {
  dedupeSearchCriteria,
  evaluateSearchCriteria,
  generatedCriteriaForRequirementLabels,
} from "../lib/searchV2Criteria";
import { projectRequirementStatus } from "../lib/searchV2Lifecycle";

const evidence = (
  candidateId: string,
  contextConceptIds: string[],
  excerpt: string,
): NonNullable<CandidateSearchV2Document["lifecycleEvidence"]>[number] => ({
  projectId: `${candidateId}:project-1`,
  lifecycleType: "Implementation",
  sourceType: "project",
  sourceField: "candidate.projects",
  sourceRecordId: candidateId,
  excerpt,
  evidenceLevel: "supported",
  modules: contextConceptIds,
  contextConceptIds,
});
const candidate = (
  id: string,
  lifecycleEvidence: NonNullable<
    CandidateSearchV2Document["lifecycleEvidence"]
  >,
): CandidateSearchV2Document => ({
  candidateId: id,
  canonicalCandidateId: id,
  sourceCandidateIds: [id],
  talentPool: "internal_profiles",
  currentTitle: "SAP FICO Consultant",
  location: "Malaysia",
  country: "Malaysia",
  locationEvidenceState: "VERIFIED",
  sapModules: ["FICO"],
  skills: [],
  languages: [],
  lifecycleEvidence,
  searchConceptIds: ["FICO"],
  searchTargetEvidence: {
    FICO: {
      target: "FICO",
      tier: "exact_verified",
      strength: 1,
      evidenceSourceType: "raw_title",
      matchedLiteral: "SAP FICO",
      matchedIndicators: ["SAP FICO"],
      sourceField: "candidates.current_title",
      trusted: true,
      reasonCode: "trusted_literal",
      relatedConcepts: [],
      sourceRecordId: id,
      sourceValueProvenance: "candidate_record_raw",
      professionalContextType: "title",
    },
  },
  trustedCandidateEvidence: {
    candidateId: id,
    values: [
      {
        value: "SAP FICO Consultant",
        sourceType: "raw_title",
        sourceField: "candidates.current_title",
        sourceRecordId: id,
        provenance: "candidate_record_raw",
        trusted: true,
      },
    ],
  },
});
const committed = buildCommittedSearchRequirements({
  query: "SAP FICO Malaysia implementation",
  talentPool: "internal_profiles",
});
assert.equal(committed.requirements.length, 3);
assert.match(
  committed.requirements.find((item) => item.kind === "lifecycle")!.label,
  /SAP FICO Implementation/i,
);
assert.equal(
  evaluateCommittedCandidate(
    candidate("oracle", [
      evidence("oracle", ["ORACLE"], "Oracle MYSTICS implementation"),
    ]),
    committed,
  ).eligible,
  false,
);
assert.equal(
  evaluateCommittedCandidate(
    candidate("hardware", [
      evidence("hardware", [], "PC hardware delivery and installation"),
    ]),
    committed,
  ).eligible,
  false,
);
assert.equal(
  evaluateCommittedCandidate(
    candidate("fico", [
      evidence("fico", ["FICO"], "SAP FI/CO implementation assignment"),
    ]),
    committed,
  ).eligible,
  true,
);

const duplicate = dedupeSearchCriteria([
  {
    id: "full",
    label: "Full-lifecycle delivery depth",
    importance: "important",
    source: "ai_suggestion",
  },
  {
    id: "fico",
    label: "Demonstrated SAP FICO delivery depth",
    conceptId: "FICO",
    importance: "most_important",
    source: "ai_suggestion",
  },
]);
assert.equal(duplicate.length, 1);
assert.equal(duplicate[0].importance, "most_important");
const suggestions = generatedCriteriaForRequirementLabels(
  committed.requirements.map((item) => item.label),
);
assert.equal(
  new Set(suggestions.map((item) => item.id)).size,
  suggestions.length,
);
const criterion = evaluateSearchCriteria(candidate("title-only", []), [
  {
    id: "depth",
    label: "Demonstrated SAP FICO delivery depth",
    conceptId: "FICO",
    importance: "important",
    source: "filter",
  },
]);
assert.equal(criterion.scorePercent, 0);

const project = {
  id: "project-1",
  name: "Oracle MYSTICS implementation",
  client: "",
  role: "Consultant",
  country: "",
  industry: "",
  projectType: "Implementation",
  implementationType: "",
  modules: ["Oracle"],
  start: "",
  end: "",
  duration: "",
  responsibilities: ["Implemented Oracle MYSTICS"],
  evidenceState: "supported",
  fieldEvidence: {
    responsibilities: {
      value: ["Implemented Oracle MYSTICS"],
      evidenceState: "supported",
      provenance: [
        {
          sourceType: "parsed_resume",
          sourceRef: "candidate",
          fieldPath: "projects.0.responsibilities",
        },
      ],
    },
  },
} as any;
assert.equal(
  projectRequirementStatus("candidate", project, "SAP FICO Implementation"),
  "related_lifecycle",
);
const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(client, /startSearchV2ReadinessPolling/);
assert.match(client, /ensureSearchReadiness\(signal, retryFailed\)/);
assert.match(client, /return \(\) => polling\.stop\(\)/);
assert.doesNotMatch(client, /searchElapsedMs<350\?"Preparing candidate data"/);
assert.match(client, /X-Search-Request-Id/);
console.log("searchV2CompoundContext.test.ts passed");
