import assert from 'node:assert/strict';
import { normalizeActualCandidateSchema } from '../lib/candidate360SchemaNormalize';
import { formatCandidateProfileDate, formatCandidateProfilePeriod } from '../lib/candidateProfilePresentation';

const jobs = (raw_text: string) => normalizeActualCandidateSchema({raw_text}).enterpriseProfile.employmentTimeline;
const yearRow = 'Year June 2011 – todate Organization Example Consulting (https://example.com) Position Techno-functional Consultant (Basis /FICO) Description Configure systems.';
const year = jobs(`Working Experience ${yearRow} EDUCATION`);
assert.equal(year.length, 1);
assert.equal(year[0].company, 'Example Consulting');
assert.equal(year[0].current, true);
assert.equal(year[0].start, 'June 2011');
assert.ok(year[0].provenance?.length);
const positionRow = 'Example Bank Position Title : IT Project Manager Specialization : IT Industry : Banking Duration : 19th June 2023 – current Work Description: Manage delivery.';
const position = jobs(`Employment History ${positionRow}`);
assert.equal(position.length, 1);
assert.equal(position[0].title, 'IT Project Manager');
assert.equal(position[0].company, 'Example Bank');
assert.equal(position[0].current, true);
for (const row of [yearRow, positionRow]) {
  assert.equal(jobs(`PROJECT EXPERIENCE ${row}`).length, 0);
  assert.equal(jobs(`EDUCATION ${row}`).length, 0);
  assert.equal(jobs(`Employment History Projects/Assignments: ${row}`).length, 0);
  assert.equal(jobs(`Employment History Client: ${row}`).length, 0);
}
assert.equal(jobs(`Employment History Example Bank Position Title: Analyst Industry: Banking Projects: Duration: Jan 2020 – Jan 2022`).length, 0);
assert.equal(jobs(`Working Experience ${yearRow.replace('June 2011 – todate', 'June 2023 – May 2020')}`).length, 0);
assert.equal(formatCandidateProfileDate('2021-09'), 'Sep 2021');
assert.equal(formatCandidateProfileDate('2021-09-14'), 'Sep 2021');
assert.equal(formatCandidateProfilePeriod('2021-09', ''), 'Sep 2021 – End date not provided');
assert.equal(formatCandidateProfilePeriod('', '2021-09'), 'Start date not provided – Sep 2021');
assert.equal(formatCandidateProfilePeriod('2021-09', '', true), 'Sep 2021 – Present');
console.log('Ordered employment labels and precise period display: passed');
