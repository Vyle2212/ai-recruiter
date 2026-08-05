import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/talent-search/v2/page.tsx";

const clientPath =
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx";

assert.ok(
  fs.existsSync(
    pagePath,
  ),
  "Candidate Search V2 page must exist.",
);

assert.ok(
  fs.existsSync(
    clientPath,
  ),
  "Candidate Search V2 client component must exist.",
);

const page =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

const client =
  fs.readFileSync(
    clientPath,
    "utf8",
  );

assert.match(
  page,
  /CandidateSearchV2Client/,
);

assert.match(
  client,
  /"use client"/,
);

assert.match(
  client,
  /\/api\/recruiter\/search-v2/,
);

assert.match(
  client,
  /Candidate Search V2/,
);

assert.match(
  client,
  /Minimum score/,
);

assert.match(
  client,
  /Matched skills/,
);

assert.match(
  client,
  /Open Candidate 360/,
);

assert.match(
  client,
  /Unnamed Candidate/,
);

assert.match(
  client,
  /Candidate ID:/,
);

assert.match(
  client,
  /Employer not verified/,
);

assert.match(
  client,
  /aria-expanded={showReasons}/,
);

assert.match(
  client,
  /aria-expanded={showWarnings}/,
);

assert.match(
  client,
  /Match reasons/,
);

assert.match(
  client,
  /Review warnings/,
);

assert.match(
  client,
  /#{shortCandidateId}/,
);

assert.doesNotMatch(
  client,
  /Candidate ID:/,
);

assert.doesNotMatch(
  client,
  /REVIEW WARNINGS/,
);

assert.match(
  client,
  /match reasons/,
);

assert.match(
  client,
  /Review warnings/,
);

assert.doesNotMatch(
  client,
  /calibrated ranking score/,
);

assert.doesNotMatch(
  client,
  /Employer requires validation/,
);

assert.match(
  client,
  /readOnly|READ ONLY/,
);

assert.doesNotMatch(
  client,
  /\.insert\s*\(/,
);

assert.doesNotMatch(
  client,
  /\.update\s*\(/,
);

assert.doesNotMatch(
  client,
  /\.delete\s*\(/,
);

console.log(
  "candidateSearchV2Ui.test.ts passed",
);
