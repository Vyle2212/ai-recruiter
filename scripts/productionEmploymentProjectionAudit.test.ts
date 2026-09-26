import assert from "node:assert/strict";
import {
  auditProductionEmploymentProjection,
  productionEmploymentGapQueue,
} from "../lib/productionEmploymentProjectionAudit";

const stored = (employmentHistory: Array<Record<string, unknown>>) => ({
  canonical_candidate: {
    version: "test-stored-v1",
    payload: { employmentHistory },
  },
});

const rows = [
  {
    id: "fixture-additive",
    raw_text:
      "Professional Experience Company: Example Advice Role: SAP Consultant Duration: Jan 2020 - Dec 2021",
    parsed_json: stored([]),
  },
  {
    id: "fixture-unchanged",
    experience: "Example Systems|ERP Analyst|2018|2019",
    parsed_json: stored([
      {
        company: "Example Systems",
        title: "ERP Analyst",
        startDate: "2018",
        endDate: "2019",
        current: false,
      },
    ]),
  },
  {
    id: "fixture-empty",
    raw_text: "Project Experience Client: Buyer Project: Upgrade",
    parsed_json: stored([]),
  },
];

const report = auditProductionEmploymentProjection(rows);
assert.equal(report.population, 3);
assert.equal(report.databaseWrites, 0);
assert.deepEqual(report.privacy, {
  candidateIdentifiersSerialized: 0,
  sourceExcerptsSerialized: 0,
  contactFieldsSerialized: 0,
});
assert.equal(
  productionEmploymentGapQueue(
    "Project Experience Client: Buyer Project: Upgrade",
  ),
  "short-or-missing-source",
);
assert.equal(
  productionEmploymentGapQueue(
    "Project Experience Client: Buyer Project: Upgrade ".repeat(8),
  ),
  "project-or-client-heavy-needs-employment-evidence",
);
assert.equal(
  Object.values(report.unresolvedQueues).reduce((sum, value) => sum + value, 0),
  report.projected.unresolvedSources,
);
assert.equal(
  Object.values(report.changeClasses).reduce((sum, value) => sum + value, 0),
  report.population,
);
assert.equal(
  Object.values(report.promotionQueues).reduce((sum, value) => sum + value, 0),
  report.population,
);
assert.equal(
  report.promotionRows.emptyToPopulatedAdditions +
    report.promotionRows.existingAdditiveAdditions +
    report.promotionRows.conflictProposedAdditions,
  report.tupleComparison.addedProjectedTuples,
);
assert.equal(
  report.tupleComparison.preservedStoredTuples +
    report.tupleComparison.removedOrChangedStoredTuples,
  report.tupleComparison.storedTuples,
);
assert.doesNotMatch(JSON.stringify(report), /fixture-|Example|Buyer/);

console.log("Production employment projection audit regression passed.");
