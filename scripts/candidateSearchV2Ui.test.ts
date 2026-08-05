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
  /Open Candidate 360/,
);

assert.match(
  client,
  /Why this candidate/,
);

assert.match(
  client,
  /review/,
);

assert.match(
  client,
  /Recruiter rank/,
);

assert.match(
  client,
  /AI score/,
);

assert.match(
  client,
  /Shortlist/,
);

assert.match(
  client,
  /Compare/,
);

assert.match(
  client,
  /Unnamed Candidate/,
);

assert.match(
  client,
  /shortCandidateId/,
);

assert.match(
  client,
  /Employer pending verification/,
);

assert.match(
  client,
  /aria-expanded/,
);

assert.match(
  client,
  /matchedSkills/,
);

assert.match(
  client,
  /matchedTerms/,
);

assert.match(
  client,
  /matchedSapModules/,
);

assert.match(
  client,
  /readOnly|READ ONLY/,
);

assert.doesNotMatch(
  client,
  /Matched skills/,
);

assert.doesNotMatch(
  client,
  /Candidate ID:/,
);

assert.doesNotMatch(
  client,
  /Employer requires validation/,
);

assert.doesNotMatch(
  client,
  /calibrated ranking score/,
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