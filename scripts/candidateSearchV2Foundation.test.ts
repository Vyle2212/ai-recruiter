import assert from "node:assert/strict";
import fs from "node:fs";

const auditScriptPath =
  "scripts/auditCandidateSearchV2.cjs";

const specPath =
  "docs/candidate-search-v2-spec.md";

assert.ok(
  fs.existsSync(
    auditScriptPath,
  ),
  "Candidate Search V2 audit script must exist.",
);

assert.ok(
  fs.existsSync(
    specPath,
  ),
  "Candidate Search V2 specification must exist.",
);

const auditSource =
  fs.readFileSync(
    auditScriptPath,
    "utf8",
  );

const spec =
  fs.readFileSync(
    specPath,
    "utf8",
  );

assert.match(
  auditSource,
  /candidate-search-v2-audit\.json/,
);

assert.match(
  auditSource,
  /candidate-search-v2-audit\.md/,
);

assert.match(
  spec,
  /Semantic search/,
);

assert.match(
  spec,
  /Hybrid ranking/,
);

assert.match(
  spec,
  /Explainability/,
);

assert.match(
  spec,
  /Read-only search/,
);

assert.match(
  spec,
  /No automatic shortlist/,
);

console.log(
  "candidateSearchV2Foundation.test.ts passed",
);