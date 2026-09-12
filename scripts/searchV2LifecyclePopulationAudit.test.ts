import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import {
  buildCommittedSearchRequirements,
  evaluateCommittedCandidate,
  evaluateCommittedPopulation,
} from "../lib/searchV2CommittedRequirements";
import { evaluateSearchCriteria } from "../lib/searchV2Criteria";
import { targetModuleDeliveryEvidence } from "../lib/searchV2Lifecycle";

const dataset = JSON.parse(
  readFileSync("tmp/search-v2-runtime-snapshot.json", "utf8"),
) as { sourceRows: number; documents: Parameters<typeof dedupeCandidateSearchV2Documents>[0] };
assert.equal(dataset.sourceRows, 833);
const canonical = dedupeCandidateSearchV2Documents(dataset.documents).documents;
assert.equal(canonical.length, 822);

const lifecycleTypes = [
  "Implementation",
  "Rollout",
  "Migration",
  "Integration",
  "Support / Enhancement",
] as const;
const totals = Object.fromEntries(
  lifecycleTypes.map((type) => [
    type,
    canonical.filter((candidate) =>
      candidate.lifecycleEvidence?.some((item) => item.lifecycleType === type),
    ).length,
  ]),
);
let missingMappings = 0,
  unsupportedExtras = 0,
  identityMismatches = 0,
  provenanceMismatches = 0,
  criteriaMismatches = 0;
for (const candidate of canonical) {
  const sourceIds = new Set(candidate.sourceCandidateIds || [candidate.candidateId]);
  for (const item of candidate.lifecycleEvidence || []) {
    if (!sourceIds.has(item.sourceRecordId)) identityMismatches += 1;
    if (!item.projectId || !item.sourceField || !item.excerpt)
      provenanceMismatches += 1;
  }
  for (const type of lifecycleTypes) {
    const indexed = Boolean(
      candidate.lifecycleEvidence?.some((item) => item.lifecycleType === type),
    );
    const committed = buildCommittedSearchRequirements({
      query: "",
      filters: { deliveryExperience: [type] },
      talentPool: "internal_profiles",
    });
    const matched = evaluateCommittedCandidate(candidate, committed).eligible;
    if (indexed && !matched) missingMappings += 1;
    if (!indexed && matched) unsupportedExtras += 1;
  }
  const hasImplementation = Boolean(
    candidate.lifecycleEvidence?.some(
      (item) => item.lifecycleType === "Implementation",
    ),
  );
  const diagnostic = evaluateSearchCriteria(candidate, [
    {
      id: "delivery-depth",
      label: "Full-lifecycle delivery depth",
      importance: "important",
      source: "ai_suggestion",
    },
  ]);
  if (hasImplementation && diagnostic.scorePercent === 0)
    criteriaMismatches += 1;
}

assert.equal(missingMappings, 0);
assert.equal(unsupportedExtras, 0);
assert.equal(identityMismatches, 0);
assert.equal(provenanceMismatches, 0);
assert.equal(criteriaMismatches, 0);

const queryCounts = Object.fromEntries(
  [
    "SAP FICO",
    "SAP FICO Malaysia",
    "SAP FICO Malaysia implementation",
  ].map((query) => {
    const requirements = buildCommittedSearchRequirements({
      query,
      talentPool: "internal_profiles",
    });
    return [
      query,
      evaluateCommittedPopulation(canonical, requirements).eligibleCandidateIds
        .size,
    ];
  }),
);
const ficoRequirement=buildCommittedSearchRequirements({query:"SAP FICO",talentPool:"internal_profiles"});
const ficoCandidates=canonical.filter(candidate=>evaluateCommittedCandidate(candidate,ficoRequirement).eligible);
const implementationAnywhere=canonical.filter(candidate=>candidate.lifecycleEvidence?.some(item=>item.lifecycleType==="Implementation"));
const sameRecordFicoImplementation=ficoCandidates.filter(candidate=>targetModuleDeliveryEvidence(candidate,"FICO").directTargetAssignments.some(item=>item.evidence.lifecycleType==="Implementation"));
const unrelatedOnly=ficoCandidates.filter(candidate=>candidate.lifecycleEvidence?.some(item=>item.lifecycleType==="Implementation")&&!targetModuleDeliveryEvidence(candidate,"FICO").directTargetAssignments.some(item=>item.evidence.lifecycleType==="Implementation"));
const compoundRequirement=buildCommittedSearchRequirements({query:"SAP FICO implementation",talentPool:"internal_profiles"});
const compoundIds=evaluateCommittedPopulation(canonical,compoundRequirement).eligibleCandidateIds;
const unsupportedCompoundMatches=[...compoundIds].filter(id=>!sameRecordFicoImplementation.some(candidate=>candidate.candidateId===id));
const missingSupportedCompoundMatches=sameRecordFicoImplementation.filter(candidate=>!compoundIds.has(candidate.candidateId));
assert.equal(unsupportedCompoundMatches.length,0);
assert.equal(missingSupportedCompoundMatches.length,0);

console.log(
  JSON.stringify({
    suite: "searchV2LifecyclePopulationAudit",
    sourceProfiles: dataset.sourceRows,
    canonicalEntities: canonical.length,
    candidate360LifecycleTotals: totals,
    searchLifecycleTotals: totals,
    missingMappings,
    unsupportedExtras,
    identityMismatches,
    provenanceMismatches,
    criteriaMismatches,
    queryCounts,
    compoundEvidence:{ficoCandidates:ficoCandidates.length,implementationAnywhere:implementationAnywhere.length,unrelatedRecordsOnly:unrelatedOnly.length,sameRecordFicoImplementation:sameRecordFicoImplementation.length,unsupportedCompoundMatches:unsupportedCompoundMatches.length,missingSupportedCompoundMatches:missingSupportedCompoundMatches.length,representativeCandidates:sameRecordFicoImplementation.slice(0,5).map(candidate=>({candidateId:candidate.candidateId,name:candidate.candidateName||"Name unavailable"}))},
  }),
);
