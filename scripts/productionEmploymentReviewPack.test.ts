import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildEmploymentReviewInputsFromCandidateRows,
  buildPrivateEmploymentReviewPack,
  finalizePrivateEmploymentReviewPack,
  type EmploymentReviewCandidateInput,
  type PrivateEmploymentReviewPack,
} from "../lib/productionEmploymentReviewPack";
import type { EnterpriseEmployment } from "../lib/candidate360SchemaNormalize";
import type { StoredEmploymentRow } from "../lib/productionEmploymentAdditivePromotion";

const commitSha = "f".repeat(40);
const sourceUpdatedAt = "2026-09-24T06:00:00Z";

function projected(
  id: string,
  company: string,
  title: string,
  start: string,
  end: string,
): EnterpriseEmployment {
  return {
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
        sourceRef: "synthetic.fixture",
        label: "Synthetic fixture",
      },
    ],
  };
}

const storedRole: StoredEmploymentRow = {
  id: "stored-role",
  company: "Stored Private Example",
  title: "ERP Analyst",
  startDate: "2018",
  endDate: "2019",
  current: false,
};

const candidates: EmploymentReviewCandidateInput[] = [
  {
    candidateId: "private-empty-additive",
    sourceUpdatedAt,
    employmentHistory: [],
    projectedEmployment: [
      projected(
        "new-a",
        "Private Alpha Example",
        "SAP Consultant",
        "2020",
        "2021",
      ),
    ],
    sourceText: "PRIVATE CONTACT [private-contact-alpha]",
  },
  {
    candidateId: "private-existing-additive",
    sourceUpdatedAt,
    employmentHistory: [storedRole],
    projectedEmployment: [
      projected(
        "stored-copy",
        "Stored Private Example",
        "ERP Analyst",
        "2018",
        "2019",
      ),
      projected("new-b", "Private Beta Example", "SAP Lead", "2022", ""),
    ],
    sourceText: "PRIVATE CONTACT [private-contact-beta]",
  },
  {
    candidateId: "private-unchanged",
    sourceUpdatedAt,
    employmentHistory: [storedRole],
    projectedEmployment: [
      projected(
        "stored-copy",
        "Stored Private Example",
        "ERP Analyst",
        "2018",
        "2019",
      ),
    ],
    sourceText: "unchanged private source",
  },
  {
    candidateId: "private-conflict",
    sourceUpdatedAt,
    employmentHistory: [storedRole],
    projectedEmployment: [
      projected(
        "different-role",
        "Different Private Example",
        "SAP Manager",
        "2020",
        "2023",
      ),
    ],
    sourceText: "conflicting private source",
  },
  {
    candidateId: "private-still-empty",
    sourceUpdatedAt,
    employmentHistory: [],
    projectedEmployment: [],
    sourceText: "short private source",
  },
];

const built = buildPrivateEmploymentReviewPack({
  candidates,
  capturedAt: "2026-09-24T06:01:00Z",
  generatedAt: "2026-09-24T06:02:00Z",
  targetCommitSha: commitSha,
});
assert.equal(built.report.population, 5);
assert.equal(built.report.reviewItems, 3);
assert.equal(built.report.additiveReviewItems, 2);
assert.equal(built.report.conflictReviewItems, 1);
assert.equal(built.report.proposedAdditions, 3);
assert.deepEqual(built.report.queueCounts, {
  empty_to_populated_review: 1,
  existing_additive_review: 1,
  unchanged: 1,
  conflict_review: 1,
  still_empty: 1,
});
assert.doesNotMatch(
  JSON.stringify(built.report),
  /private-|Private|SAP Consultant|SAP Lead|private-contact/,
);
assert.match(JSON.stringify(built.pack), /private-contact-alpha/);

const pendingPack = structuredClone(built.pack);
assert.throws(
  () =>
    finalizePrivateEmploymentReviewPack({
      pack: pendingPack,
      finalizedAt: "2026-09-24T06:10:00Z",
      expectedCommitSha: commitSha,
    }),
  /additive decisions are pending/,
);

const reviewedPack = structuredClone(built.pack);
for (const item of reviewedPack.items) {
  if (item.plan.queue === "empty_to_populated_review") {
    item.review = {
      decision: "approve_additions",
      reviewedBy: "private-reviewer",
      reviewedAt: "2026-09-24T06:05:00Z",
    };
  } else if (item.plan.queue === "existing_additive_review") {
    item.review = {
      decision: "hold",
      reviewedBy: "private-reviewer",
      reviewedAt: "2026-09-24T06:06:00Z",
    };
  }
}
const finalized = finalizePrivateEmploymentReviewPack({
  pack: reviewedPack,
  finalizedAt: "2026-09-24T06:10:00Z",
  expectedCommitSha: commitSha,
});
assert.equal(finalized.report.additiveReviewItems, 2);
assert.equal(finalized.report.approvedEntries, 1);
assert.equal(finalized.report.approvedAdditions, 1);
assert.equal(finalized.report.heldEntries, 1);
assert.equal(finalized.report.rejectedEntries, 0);
assert.equal(finalized.report.conflictsReviewedKeepStored, 0);
assert.equal(finalized.report.conflictsOutstanding, 1);
assert.equal(finalized.report.readyForBackup, true);
assert.equal(finalized.report.readyForWrite, false);
assert.equal(finalized.bundle.backup, undefined);
assert.equal(finalized.bundle.authorization, undefined);
assert.equal(finalized.bundle.manifest.entries.length, 1);
assert.doesNotMatch(
  JSON.stringify(finalized.report),
  /private-|Private|SAP Consultant|private-contact/,
);

const conflictApproved = structuredClone(reviewedPack);
const conflict = conflictApproved.items.find(
  ({ plan }) => plan.queue === "conflict_review",
);
assert.ok(conflict);
conflict.review = {
  decision: "approve_additions",
  reviewedBy: "private-reviewer",
  reviewedAt: "2026-09-24T06:07:00Z",
};
assert.throws(
  () =>
    finalizePrivateEmploymentReviewPack({
      pack: conflictApproved,
      finalizedAt: "2026-09-24T06:10:00Z",
      expectedCommitSha: commitSha,
    }),
  /conflict cannot enter additive manifest/,
);

const conflictRejected = structuredClone(reviewedPack);
const rejectedConflict = conflictRejected.items.find(
  ({ plan }) => plan.queue === "conflict_review",
);
assert.ok(rejectedConflict);
rejectedConflict.review = {
  decision: "reject",
  reviewedBy: "private-reviewer",
  reviewedAt: "2026-09-24T06:07:00Z",
};
const conflictResolution = finalizePrivateEmploymentReviewPack({
  pack: conflictRejected,
  finalizedAt: "2026-09-24T06:10:00Z",
  expectedCommitSha: commitSha,
});
assert.equal(conflictResolution.report.conflictsReviewedKeepStored, 1);
assert.equal(conflictResolution.report.conflictsOutstanding, 0);

const invalidDecision = structuredClone(reviewedPack);
invalidDecision.items[0].review.decision = "unsafe_replace" as never;
assert.throws(
  () =>
    finalizePrivateEmploymentReviewPack({
      pack: invalidDecision,
      finalizedAt: "2026-09-24T06:10:00Z",
      expectedCommitSha: commitSha,
    }),
  /invalid review decision/,
);

const tampered = structuredClone(reviewedPack);
tampered.items[0].sourceText = "changed after review";
assert.throws(
  () =>
    finalizePrivateEmploymentReviewPack({
      pack: tampered,
      finalizedAt: "2026-09-24T06:10:00Z",
      expectedCommitSha: commitSha,
    }),
  /immutable content changed/,
);

const converted = buildEmploymentReviewInputsFromCandidateRows([
  {
    id: "private-converted",
    updated_at: sourceUpdatedAt,
    raw_text: "PRIVATE CONTACT [private-contact-converted]",
    parsed_json: {
      canonical_candidate: {
        payload: { employmentHistory: [storedRole] },
      },
    },
  },
]);
assert.equal(converted[0]?.candidateId, "private-converted");
assert.equal(converted[0]?.sourceUpdatedAt, sourceUpdatedAt);
assert.equal(converted[0]?.employmentHistory.length, 1);
assert.match(converted[0]?.sourceText || "", /private-contact-converted/);

const runner = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "scripts/prepareProductionEmploymentReviewPack.ts",
  ),
  "utf8",
);
assert.match(runner, /mode: 0o600/);
assert.match(runner, /flag: "wx"/);
assert.match(runner, /outside the repository/);
assert.match(runner, /\.employment-promotion-private\.json/);
assert.doesNotMatch(runner, /console\.log\([^)]*(?:pack|bundle|snapshot|rows)/);

const serializedReviewedPack = JSON.stringify(
  reviewedPack,
) as unknown as string;
const roundTrip = JSON.parse(
  serializedReviewedPack,
) as PrivateEmploymentReviewPack;
assert.equal(roundTrip.reviewPackFingerprint, built.pack.reviewPackFingerprint);

console.log("Production employment private review pack regression passed.");
