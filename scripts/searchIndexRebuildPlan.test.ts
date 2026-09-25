import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildCandidateSearchIndexRow } from "../lib/candidateSearchIndex";
import { classifyCandidateSearchVisibility } from "../lib/candidateSearchVisibility";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";
import { planCanonicalSearchIndexRebuild } from "../lib/searchIndexRebuildPlan";

const eligible = {
  id: "synthetic-eligible",
  name: "Example Person",
  email: "profile@invalid.test",
  primary_module: "SD",
  current_title: "SAP SD Consultant",
  updated_at: "2026-09-24T01:00:00Z",
};
const candidates = [
  eligible,
  {
    ...eligible,
    id: "synthetic-skills-only",
    primary_module: null,
    skills: ["SAP SD"],
  },
  { ...eligible, id: "synthetic-noise", status: "REJECTED_NOISE" },
  { ...eligible, id: "synthetic-placeholder", name: "Profile Under Review" },
];
const plan = planCanonicalSearchIndexRebuild({
  candidates,
  indexRows: [],
  refreshExisting: false,
  buildRow: buildCandidateSearchIndexRow,
});
assert.equal(plan.missingCandidates, 4);
assert.equal(plan.buildableMissing, 1);
assert.equal(plan.notBuildable, 3);
assert.deepEqual(
  plan.rowsToWrite.map((row) => row.candidate_id),
  [eligible.id],
);
assert.equal(plan.rowsToWrite[0]?.primary_module, "SD");

for (const status of [
  "needs_review",
  "hidden",
  "archived",
  "deleted",
  "non_sap",
  "rejected_noise",
]) {
  assert.equal(
    buildCandidateSearchIndexRow({ ...eligible, status }),
    null,
    `${status} must never acquire a search index row even with a trusted name and module`,
  );
  assert.equal(
    classifyCandidateSearchVisibility({ ...eligible, status })
      .search_visibility,
    "VALIDATION_QUEUE",
    `${status} must never be shown in normal recruiter search`,
  );
}
assert.equal(
  buildCandidateSearchIndexRow({
    ...eligible,
    status: "active",
    extraction_coverage_status: "incomplete_needs_review",
  }),
  null,
  "active profile with incomplete source extraction must not enter index",
);
assert.ok(
  buildCandidateSearchIndexRow({
    ...eligible,
    status: "active",
    extraction_coverage_status: "complete_for_validation",
  }),
  "eligible profile must remain indexable",
);
const reviewWithOldIndex = {
  ...eligible,
  id: "synthetic-review-indexed",
  status: "needs_review",
};
const exactSet = buildSearchIndexAudit({
  candidates: [eligible, reviewWithOldIndex],
  indexRows: [
    { candidate_id: eligible.id, source_updated_at: eligible.updated_at },
    {
      candidate_id: reviewWithOldIndex.id,
      source_updated_at: eligible.updated_at,
    },
  ],
  indexableCandidateIds: [eligible, reviewWithOldIndex].flatMap((candidate) => {
    const row = buildCandidateSearchIndexRow(candidate);
    return row ? [String(row.candidate_id)] : [];
  }),
});
assert.equal(exactSet.blockedCandidateIndexRows, 1);
assert.equal(exactSet.exactSetAligned, false);

const indexed = planCanonicalSearchIndexRebuild({
  candidates: [eligible],
  indexRows: [{ candidate_id: eligible.id }],
  refreshExisting: false,
  buildRow: buildCandidateSearchIndexRow,
});
assert.equal(indexed.rowsToWrite.length, 0);
const refresh = planCanonicalSearchIndexRebuild({
  candidates: [eligible],
  indexRows: [{ candidate_id: eligible.id }],
  refreshExisting: true,
  buildRow: buildCandidateSearchIndexRow,
});
assert.equal(refresh.rowsToWrite.length, 1);

const source = fs.readFileSync(
  path.join(path.resolve(__dirname, ".."), "scripts/rebuildSearchIndexSafe.ts"),
  "utf8",
);
const packageScripts = JSON.parse(
  fs.readFileSync(
    path.join(path.resolve(__dirname, ".."), "package.json"),
    "utf8",
  ),
).scripts as Record<string, string>;
assert.match(
  packageScripts["search-index:rebuild:plan"],
  /^NODE_OPTIONS=--conditions=react-server node --import tsx scripts\/rebuildSearchIndexSafe\.ts$/,
);
const importProbe = spawnSync(
  process.execPath,
  ["--import", "tsx", "-e", 'import("./lib/candidateSearchIndex.ts")'],
  {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "--conditions=react-server" },
  },
);
assert.equal(importProbe.status, 0, importProbe.stderr);
assert.doesNotMatch(
  source,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY|buildCoverageSearchIndexRow/,
);
assert.doesNotMatch(source, /Sample (?:candidate|not-buildable) ids:/);
assert.doesNotMatch(source, /\.upsert\(|\.update\(|\.delete\(|\.insert\(/);
assert.match(source, /planCanonicalSearchIndexRebuild/);
const denied = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/rebuildSearchIndexSafe.ts", "--write"],
  { cwd: path.resolve(__dirname, ".."), encoding: "utf8" },
);
assert.equal(denied.status, 1);
assert.match(
  denied.stderr,
  /standalone writes require an independently reviewed exact-set transaction/,
);
assert.doesNotMatch(denied.stderr, /missing Supabase URL\/key/);
console.log("Search-index canonical rebuild boundary regression passed.");
