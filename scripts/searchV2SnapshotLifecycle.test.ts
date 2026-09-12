import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEARCH_V2_CACHE_VERSION } from "../lib/searchV2Shared";
import {
  searchV2SnapshotSchemaVersion,
  validateSearchV2SnapshotPayload,
} from "../lib/searchV2Snapshot";

const schema = searchV2SnapshotSchemaVersion(SEARCH_V2_CACHE_VERSION);
const valid = {
  schemaVersion: schema,
  createdAt: 1,
  sourceCreatedAt: 1,
  revision: "dataset-revision-123",
  sourceRows: 833,
  documents: [{ candidateId: "candidate-1", lifecycleEvidence: [] }],
};
assert(validateSearchV2SnapshotPayload(valid, schema));
assert(
  !validateSearchV2SnapshotPayload({ ...valid, schemaVersion: "old" }, schema),
);
assert(!validateSearchV2SnapshotPayload({ ...valid, documents: [] }, schema));
assert(
  !validateSearchV2SnapshotPayload(
    { ...valid, documents: [{ candidateId: "" }] },
    schema,
  ),
);
assert(
  !validateSearchV2SnapshotPayload(
    { ...valid, documents: [{ candidateId: "candidate-1" }] },
    schema,
  ),
  "a structurally old snapshot without canonical lifecycle indexes must be rejected",
);
assert(!validateSearchV2SnapshotPayload({ ...valid, sourceRows: 0 }, schema));
const source = readFileSync("lib/searchV2Dataset.ts", "utf8");
assert.match(
  source,
  /rename\(temporary, SNAPSHOT_PATH\)/,
  "snapshot replacement is atomic",
);
assert.match(source, /backgroundRefreshPromise/);
assert.match(source, /loadCandidateSource\(true\)/);
assert.match(source, /invalidateCandidateSearchV2DatasetSnapshot/);
assert.match(source, /snapshotBacked/);
assert.match(
  source,
  /Date\.now\(\) - persisted\.sourceCreatedAt > DATASET_CACHE_TTL_MS/,
  "a fresh persisted index must not start a competing full-population refresh during the recruiter interaction window",
);
console.log("Search V2 validated snapshot lifecycle tests passed");
