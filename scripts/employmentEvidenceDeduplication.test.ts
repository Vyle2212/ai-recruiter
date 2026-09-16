import assert from "node:assert/strict";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
const base = {
  company: "Example Services",
  title: "SAP Consultant",
  start_date: "Jan 2020",
  end_date: "Dec 2020",
};
const conflicts = [
  { ...base, start_date: "Feb 2020" },
  { ...base, end_date: "Nov 2020" },
  { ...base, title: "Senior SAP Consultant" },
  { ...base, start_date: "", end_date: "" },
];
for (const other of conflicts) {
  for (const employment_history of [
    [base, other],
    [other, base],
  ]) {
    const jobs = normalizeActualCandidateSchema({ employment_history })
      .enterpriseProfile.employmentTimeline;
    assert.equal(
      jobs.length,
      2,
      "conflicting explicit evidence and unanchored records stay separate",
    );
    assert.ok(
      jobs.some(
        (job) =>
          job.start === base.start_date &&
          job.end === base.end_date &&
          job.title === base.title,
      ),
    );
    assert.ok(
      jobs.some(
        (job) =>
          job.start === other.start_date &&
          job.end === other.end_date &&
          job.title === other.title,
      ),
    );
  }
}
for (const other of [
  { ...base },
  { ...base, start_date: "2020-01", end_date: "2020-12" },
  { ...base, end_date: "" },
  { ...base, start_date: "" },
]) {
  const jobs = normalizeActualCandidateSchema({
    employment_history: [base, other],
  }).enterpriseProfile.employmentTimeline;
  assert.equal(
    jobs.length,
    1,
    "consistent duplicates and anchored partial evidence still merge",
  );
}
const month = new Date().toISOString().slice(0, 7);
for (const employment_history of [
  [
    { ...base, end_date: month },
    { ...base, end_date: "Present" },
  ],
  [
    { ...base, end_date: "Present" },
    { ...base, end_date: month },
  ],
]) {
  const jobs = normalizeActualCandidateSchema({ employment_history })
    .enterpriseProfile.employmentTimeline;
  assert.equal(
    jobs.length,
    2,
    "current and historical assertions are not collapsed even in the same month",
  );
  assert.deepEqual(jobs.map((job) => job.current).sort(), [false, true]);
}
console.log(
  "Employment deduplication preserves conflicting evidence and supported duplicates: passed",
);
