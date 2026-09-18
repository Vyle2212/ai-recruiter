import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  auditSourceText,
  auditEmploymentDateComplete,
  auditEmploymentIncomplete,
  auditPopulationScope,
} from "../lib/profileSourceAuditEvidence";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
for (const key of ["raw_text", "resume_text", "cv_text", "raw_cv"])
  assert.match(
    auditSourceText({ [key]: "Employment History" }),
    /Employment History/,
  );
const job = normalizeActualCandidateSchema({
  employment_history: [
    {
      company: "Example Services",
      title: "Analyst",
      start_date: "Jan 2020",
      current: true,
    },
  ],
}).enterpriseProfile.employmentTimeline[0];
assert.equal(auditEmploymentDateComplete(job), true);
assert.equal(auditEmploymentIncomplete(job), false);
assert.equal(auditEmploymentDateComplete({ ...job, start: "" }), false);
assert.equal(
  auditEmploymentDateComplete({ ...job, current: false, end: "" }),
  false,
);
assert.equal(
  auditEmploymentDateComplete({ ...job, current: false, end: "Dec 2019" }),
  false,
);
assert.equal(auditPopulationScope(277, 970, true).unauditedSources, 693);
assert.equal(
  auditPopulationScope(277, null, true).coverage,
  "UNKNOWN_POPULATION",
);
assert.equal(
  auditPopulationScope(277, 200, true).coverage,
  "INCONSISTENT_EXPORT_METADATA",
);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "source-audit-"));
try {
  const input = path.join(dir, "input.json"),
    report = path.join(dir, "report.json"),
    review = path.join(dir, "review.json");
  fs.writeFileSync(
    input,
    JSON.stringify({
      population: 970,
      samples: [
        {
          source: {
            id: "synthetic-current",
            cv_text: "Employment History",
            employment_history: [
              {
                company: "Example Services",
                title: "Analyst",
                start_date: "Jan 2020",
                current: true,
              },
            ],
          },
        },
        {
          source: {
            id: "synthetic-review",
            cv_text: "Employment History",
            employment_history: [
              {
                company: "Example Services",
                title: "Analyst",
                start_date: "Jan 2020",
              },
            ],
          },
        },
      ],
    }),
  );
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/auditProfileSourceRecovery.ts",
      "--input",
      input,
      "--output",
      report,
      "--review-sources",
      review,
    ],
    { stdio: "pipe" },
  );
  const result = JSON.parse(fs.readFileSync(report, "utf8"));
  assert.equal(result.sourceTextPresent, 2);
  assert.equal(result.completeness.dateRange, 1);
  assert.equal(
    result.profileChecks.filter(
      (x: { status: string }) => x.status === "INCOMPLETE_EMPLOYMENT",
    ).length,
    1,
  );
  const exported = JSON.parse(fs.readFileSync(review, "utf8"));
  assert.equal(
    exported.population,
    970,
    "re-exporting a subset must retain the full declared population",
  );
  assert.equal(exported.auditedSources, 2);
  assert.equal(
    exported.count,
    1,
    "a current role with a known start is not falsely exported as incomplete",
  );
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/auditProfileSourceRecovery.ts",
      "--input",
      review,
      "--output",
      report,
    ],
    { stdio: "pipe" },
  );
  assert.equal(
    JSON.parse(fs.readFileSync(report, "utf8")).scope.unauditedSources,
    969,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Audit evidence, current dates and re-export population remain truthful: passed",
);
