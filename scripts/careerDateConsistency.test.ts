import assert from 'node:assert/strict';
import { careerMonthIndex, calculateTotalCareerYears } from '../lib/candidateCareerExperience';
import { normalizeActualCandidateSchema } from '../lib/candidate360SchemaNormalize';
const now = new Date('2026-09-15T00:00:00Z');
for (const date of ['2021-09', '09/2021', '09/21', 'September 2021', 'Sept 2021', '14th September 2021', '2021-09-14']) {
  assert.equal(careerMonthIndex(date, false, now), 2021 * 12 + 8, date);
}
for (const date of ['2099-01', 'Jan 2099', '2021-02-30', '13/2021', 'ambiguous date']) assert.equal(careerMonthIndex(date, false, now), null, date);
assert.equal(calculateTotalCareerYears([{start:'01/2020',end:'01/2022'},{start:'Jan 2021',end:'Jan 2023'}], now), 3);
assert.equal(calculateTotalCareerYears([{start:'2023',end:'2020'},{start:'2099-01',end:'2099-12'}], now), null);
const future = normalizeActualCandidateSchema({employment_history:[{company:'Example Services', title:'Analyst', start_date:'Jan 2099', end_date:'Dec 2099'}]}).enterpriseProfile;
assert.equal(future.experienceSummary.totalCareerYears, null);
assert.ok(future.employmentTimeline.every(job => !job.start && !job.end));
const rows = normalizeActualCandidateSchema({raw_text:'Employment History: Date Company Name Role 11/18 to Present Example Services SAP Consultant 03/17 to 10/18 Example Delivery SAP Analyst EDUCATION'}).enterpriseProfile.employmentTimeline;
assert.equal(rows.length, 2);
const role = normalizeActualCandidateSchema({raw_text:'EMPLOYMENT HISTORY 2024 – Current Example Services Position: Senior Project Manager ⮚ Responsibilities: Coordinate work.'}).enterpriseProfile.employmentTimeline;
assert.equal(role[0].title, 'Senior Project Manager');
console.log('Career month consistency and heading boundaries: passed');
const previousTimezone = process.env.TZ;
try {
  for (const zone of ['UTC', 'Asia/Ho_Chi_Minh', 'Asia/Tokyo', 'America/Los_Angeles']) {
    process.env.TZ = zone;
    assert.equal(calculateTotalCareerYears([{start:'Apr 2023',end:'Present'}], now), 3.4, zone);
  }
} finally {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
}
assert.equal(normalizeActualCandidateSchema({raw_text:'PROFESSIONAL EXPERIENCE Example Vendor – Custom Planning | Example Customer | Dec 2025 – Mar 2025'}).enterpriseProfile.employmentTimeline.length, 0);
console.log('Timezone-independent experience calculation: passed');
