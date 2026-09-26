import assert from "node:assert/strict";
import {
  buildApprovedAdditiveEmploymentMerge,
  buildEmploymentPromotionPlan,
  type EmploymentPromotionApproval,
  type StoredEmploymentRow,
} from "../lib/productionEmploymentAdditivePromotion";
import type { EnterpriseEmployment } from "../lib/candidate360SchemaNormalize";

const projected = (
  id: string,
  company: string,
  title: string,
  start = "",
  end = "",
): EnterpriseEmployment => ({
  id,
  company,
  title,
  location: "",
  companyType: "",
  modules: [],
  achievements: [],
  start,
  end,
  duration: "",
  current: false,
  provenance: [
    {
      sourceType: "employment",
      sourceRef: "employment.fixture",
      label: "Synthetic employment fixture",
    },
  ],
});

const stored: StoredEmploymentRow[] = [
  {
    id: "stored-1",
    company: "Existing Systems",
    title: "ERP Analyst",
    startDate: "2018",
    endDate: "2019",
    current: false,
  },
];

const additive = buildEmploymentPromotionPlan({
  candidateId: "synthetic-candidate",
  sourceUpdatedAt: "2026-09-24T00:00:00Z",
  stored,
  projected: [
    projected(
      "projected-existing",
      "Existing Systems",
      "ERP Analyst",
      "2018",
      "2019",
    ),
    projected("projected-new", "New Consulting", "SAP Consultant", "2020", ""),
  ],
});
assert.equal(additive.queue, "existing_additive_review");
assert.equal(additive.writeEligibleAfterReview, true);
assert.equal(additive.additions.length, 1);
assert.equal(
  additive.additions[0].endDate,
  "",
  "missing end date stays missing",
);

const approval: EmploymentPromotionApproval = {
  candidateId: additive.candidateId,
  sourceUpdatedAt: additive.sourceUpdatedAt,
  storedFingerprint: additive.storedFingerprint,
  projectedFingerprint: additive.projectedFingerprint,
  planFingerprint: additive.planFingerprint,
  decision: "approve_additions",
  reviewedBy: "synthetic-reviewer",
  reviewedAt: "2026-09-24T00:05:00Z",
};
const merge = buildApprovedAdditiveEmploymentMerge(additive, approval, stored);
assert.deepEqual(merge.employmentHistory.slice(0, stored.length), stored);
assert.equal(merge.preservedStoredRows, 1);
assert.equal(merge.addedRows, 1);

const conflict = buildEmploymentPromotionPlan({
  candidateId: "synthetic-conflict",
  sourceUpdatedAt: "2026-09-24T00:00:00Z",
  stored,
  projected: [
    projected("changed", "Different Company", "ERP Analyst", "2018", "2019"),
  ],
});
assert.equal(conflict.queue, "conflict_review");
assert.equal(conflict.writeEligibleAfterReview, false);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(
      conflict,
      { ...approval, candidateId: conflict.candidateId },
      stored,
    ),
  /not additive-only/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(
      { ...conflict, writeEligibleAfterReview: true },
      {
        ...approval,
        candidateId: conflict.candidateId,
        storedFingerprint: conflict.storedFingerprint,
        projectedFingerprint: conflict.projectedFingerprint,
        planFingerprint: conflict.planFingerprint,
      },
      stored,
    ),
  /plan contents changed/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(
      additive,
      { ...approval, sourceUpdatedAt: "2026-09-24T00:10:00Z" },
      stored,
    ),
  /source version changed/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(additive, approval, [
      ...stored,
      { company: "Concurrent Change", title: "Consultant" },
    ]),
  /no longer matches/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(
      {
        ...additive,
        additions: [{ ...additive.additions[0], company: "Tampered" }],
      },
      approval,
      stored,
    ),
  /plan contents changed/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(
      {
        ...additive,
        writeEligibleAfterReview: false,
      },
      approval,
      stored,
    ),
  /not additive-only/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(
      {
        ...additive,
        additions: [
          { ...additive.additions[0], achievements: ["Tampered detail"] },
        ],
      },
      approval,
      stored,
    ),
  /plan contents changed/,
);
assert.throws(
  () =>
    buildApprovedAdditiveEmploymentMerge(additive, approval, [
      ...stored,
      ...stored,
    ]),
  /no longer matches/,
);

const publicResult = JSON.stringify({
  queue: additive.queue,
  storedRows: additive.storedRows,
  projectedRows: additive.projectedRows,
  additions: additive.additions.length,
});
assert.doesNotMatch(
  publicResult,
  /synthetic-candidate|Existing Systems|New Consulting/,
);

console.log("Production employment additive promotion regression passed.");
