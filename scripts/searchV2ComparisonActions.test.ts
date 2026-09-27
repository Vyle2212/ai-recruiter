import assert from "node:assert/strict";
import fs from "node:fs";
import { searchV2ComparisonCandidates } from "../lib/searchV2Comparison";

const candidates = ["first", "baseline", "third"].map((candidateId) => ({
  candidateId,
}));

assert.deepEqual(
  searchV2ComparisonCandidates(
    candidates,
    new Set(["first"]),
    "matches",
    "baseline",
  ).map((candidate) => candidate.candidateId),
  ["baseline", "first", "third"],
  "the drawer candidate becomes the comparison baseline without losing matches",
);
assert.deepEqual(
  searchV2ComparisonCandidates(
    candidates,
    new Set(["first"]),
    "shortlisted",
    "baseline",
  ).map((candidate) => candidate.candidateId),
  ["baseline", "first"],
  "the baseline remains visible when comparing only shortlisted alternatives",
);
assert.deepEqual(
  searchV2ComparisonCandidates(
    candidates,
    new Set(["first"]),
    "shortlisted",
    "missing",
  ).map((candidate) => candidate.candidateId),
  ["first"],
  "an unknown baseline never synthesizes or duplicates a candidate",
);

const search = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(search, /searchV2ComparisonCandidates\(/);
assert.match(
  search,
  /Comparing from \{cleanCandidateName\(compareAnchorCandidate\)\}/,
);
assert.match(search, />\s*Quick View\s*</);
assert.doesNotMatch(search, />\s*Compare Pack\s*</);
assert.equal((drawer.match(/aria-pressed=\{shortlisted\}/g) || []).length, 1);
assert.match(drawer, /aria-label="Compare this candidate"/);

console.log("Search V2 comparison actions tests passed.");
