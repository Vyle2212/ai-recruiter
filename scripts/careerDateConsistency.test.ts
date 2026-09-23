import assert from 'node:assert/strict';
import { formatEmploymentTenure } from '../lib/employmentTenure';
import { careerMonthIndex, calculateTotalCareerYears } from '../lib/candidateCareerExperience';
import { normalizeActualCandidateSchema } from '../lib/candidate360SchemaNormalize';
const now = new Date('2026-09-15T00:00:00Z');
assert.equal(formatEmploymentTenure('2021', 'Present', true, now), 'About 5 years (estimated; year precision)');
assert.equal(formatEmploymentTenure('2021', 'Present', true, new Date('2027-01-01T00:00:00Z')), 'About 6 years (estimated; year precision)');
assert.equal(formatEmploymentTenure('2021', '2024', false, now), 'About 3 years (estimated; year precision)');
assert.equal(formatEmploymentTenure('2026', 'Present', true, now), 'Less than 1 year (estimated; year precision)');
assert.equal(formatEmploymentTenure('Sep 2021', 'Curr', false, now), '5 years');
assert.equal(formatEmploymentTenure('2027', 'Present', true, now), '');
assert.equal(formatEmploymentTenure('Dec 2025', 'Mar 2025', false, now), '');
assert.equal(formatEmploymentTenure('', 'Present', true, now), '');
const yearOnlySource = 'Employment History 2021 QWER – CURR Applications consultant at Example Systems Pte Ltd Languages English';
const yearOnly = normalizeActualCandidateSchema({raw_text: yearOnlySource}).enterpriseProfile.employmentTimeline;
assert.equal(yearOnly.length, 1);
assert.equal(yearOnly[0].start, '2021');
assert.equal(yearOnly[0].current, true);
assert.match(yearOnly[0].duration, /estimated; year precision/);
assert.ok(yearOnly[0].provenance?.some(p => p.excerpt?.includes('QWER')));
for (const source of [yearOnlySource.replace('Employment History', 'Project History'), yearOnlySource.replace('Example Systems', 'Client: Example Systems'), yearOnlySource.replace('CURR', 'Mar 2020')]) {
  assert.equal(normalizeActualCandidateSchema({raw_text:source}).enterpriseProfile.employmentTimeline.length, 0);
}
assert.equal(normalizeActualCandidateSchema({raw_text:yearOnlySource.replace('2021 QWER', '2099 DEC')}).enterpriseProfile.employmentTimeline.length, 0);
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

const partial = normalizeActualCandidateSchema({employment_history:[
  {title:'SAP FICO Consultant',start_date:'Jan 2020'},
  {company:'Example Employer',end_date:'Dec 2022'},
  {title:'Senior SAP consultant with experience of over 20 years covering various roles within'}
]}).enterpriseProfile;
assert.equal(partial.employmentTimeline.length, 2);
const titleOnly = partial.employmentTimeline.find(job => job.title === 'SAP FICO Consultant')!;
assert.equal(titleOnly.company, '');
assert.equal(titleOnly.start, 'Jan 2020');
assert.equal(titleOnly.end, '');
assert.equal(titleOnly.current, false);
assert.equal(titleOnly.evidenceState, 'source_extracted');
assert.ok(titleOnly.provenance?.length);
const companyOnly = partial.employmentTimeline.find(job => job.company === 'Example Employer')!;
assert.equal(companyOnly.title, '');
assert.equal(companyOnly.end, 'Dec 2022');
assert.equal(partial.experienceSummary.totalCareerYears, null);
console.log('Grounded incomplete employment stays visible without invented tenure: passed');

for (const invalidDay of ['31st April 2024', '29th February 2023', '29 February 1900', '00 Jan 2020', '99 Jan 2020']) {
  assert.equal(careerMonthIndex(invalidDay, false, now), null, invalidDay);
  assert.equal(calculateTotalCareerYears([{start:invalidDay,end:'Jan 2025'}], now), null, 'Invalid day must not contribute career duration');
}
for (const [namedDay, isoDay] of [['29th February 2024','2024-02-29'],['29 Feb 00','2000-02-29'],['30 April 2024','2024-04-30'],['31st January 2020','2020-01-31']]) {
  assert.equal(careerMonthIndex(namedDay, false, now), careerMonthIndex(isoDay, false, now), namedDay);
}
const impossiblePeriod = normalizeActualCandidateSchema({raw_text:'Employment History Senior Systems Engineer Example Services Pte Ltd Period: 31st April 2024 - Jan 2025'}).enterpriseProfile;
assert.equal(impossiblePeriod.employmentTimeline.length, 0);
assert.equal(impossiblePeriod.experienceSummary.totalCareerYears, null);
console.log('Named calendar days reject impossible dates before career calculation: passed');

for (const alias of ['current', 'is_current', 'isCurrent']) {
  for (const flag of [true, 'true', 'yes', 1, false, 'false', 0]) {
    const job = normalizeActualCandidateSchema({employment_history:[{
      company:'Example Services', title:'Analyst', start_date:'Jan 2020', [alias]:flag,
    }]}).enterpriseProfile.employmentTimeline[0];
    const expected = flag === true || flag === 'true' || flag === 'yes' || flag === 1;
    assert.equal(job.current, expected, `${alias}: ${flag}`);
    assert.equal(job.start, 'Jan 2020');
    assert.equal(job.end, '', 'a current flag does not invent a dated endpoint');
    assert.equal(Boolean(job.duration), expected);
  }
}
const explicitFalse = normalizeActualCandidateSchema({employment_history:[{
  company:'Example Services', title:'Analyst', start_date:'Jan 2020', current:false, is_current:true,
}]}).enterpriseProfile.employmentTimeline[0];
assert.equal(explicitFalse.current, false, 'the first explicitly supplied flag retains alias precedence');
const currentWithoutStart = normalizeActualCandidateSchema({employment_history:[{
  company:'Example Services', title:'Analyst', current:true,
}]}).enterpriseProfile;
assert.equal(currentWithoutStart.employmentTimeline[0].current, true);
assert.equal(currentWithoutStart.employmentTimeline[0].start, '');
assert.equal(currentWithoutStart.experienceSummary.totalCareerYears, null);
console.log('Structured boolean current flags retain explicit evidence without inventing dates: passed');

for (const end of ['Dec 2022', 'Dec 2018', 'Present']) {
  const records = [
    {company:'Example Services', title:'Analyst', start_date:'Jan 2020'},
    {company:'Example Services', title:'Analyst', end_date:end},
  ];
  for (const rows of [records, [...records].reverse()]) {
    const profile = normalizeActualCandidateSchema({employment_history:rows}).enterpriseProfile;
    assert.equal(profile.employmentTimeline.length, 2, 'opposite partial dates cannot prove a shared employment');
    assert.equal(profile.experienceSummary.totalCareerYears, null, 'do not manufacture tenure from unrelated partial records');
    assert.ok(profile.employmentTimeline.every(job => !(job.start && job.end)));
    assert.ok(profile.employmentTimeline.every(job => !job.duration));
  }
}
const sharedStart = normalizeActualCandidateSchema({employment_history:[
  {company:'Example Services', title:'Analyst', start_date:'Jan 2020'},
  {company:'Example Services', title:'Analyst', start_date:'Jan 2020', end_date:'Dec 2022'},
]}).enterpriseProfile;
assert.equal(sharedStart.employmentTimeline.length, 1, 'a shared start still allows a supported duplicate merge');
assert.equal(sharedStart.employmentTimeline[0].end, 'Dec 2022');
console.log('Complementary partial employment dates do not manufacture a tenure: passed');

for (const start of ['', 'Jan 2019']) {
  const records = [
    {company:'Example Services', title:'Analyst', end_date:'Jan 2020'},
    {company:'Example Services', title:'Analyst', start_date:start, end_date:'Feb 2020'},
  ];
  for (const rows of [records, [...records].reverse()]) {
    const profile = normalizeActualCandidateSchema({employment_history:rows}).enterpriseProfile;
    assert.equal(profile.employmentTimeline.length, 2, 'different explicit ends remain separate when a start is missing');
    assert.deepEqual(profile.employmentTimeline.map(job => job.end).sort(), ['Feb 2020', 'Jan 2020']);
    assert.ok(profile.employmentTimeline.some(job => !job.start && job.end === 'Jan 2020'));
    assert.equal(profile.experienceSummary.totalCareerYears, start ? 1.1 : null);
  }
}
for (const start of ['', 'Jan 2019']) {
  const profile = normalizeActualCandidateSchema({employment_history:[
    {company:'Example Services', title:'Analyst', end_date:'Jan 2020'},
    {company:'Example Services', title:'Analyst', start_date:start, end_date:'Jan 2020'},
  ]}).enterpriseProfile;
  assert.equal(profile.employmentTimeline.length, 1, 'equal known ends still permit a supported duplicate merge');
  assert.equal(profile.employmentTimeline[0].start, start);
  assert.equal(profile.employmentTimeline[0].end, 'Jan 2020');
}
console.log('Distinct partial employment endpoints survive deduplication in either order: passed');

// Recruiter-authorized project envelope, separate from factual employment dates.
import { estimateEmploymentFromProjects, supportedSapYears, formatProjectTenureEstimate } from '../lib/projectEmploymentEstimate';
import type { EnterpriseEmployment, EnterpriseProject } from '../lib/candidate360SchemaNormalize';
const job = (overrides: Partial<EnterpriseEmployment> = {}): EnterpriseEmployment => ({id:'employment-fixture',company:'Example Systems Ltd',title:'SAP Consultant',location:'',companyType:'',modules:[],achievements:[],start:'',end:'',duration:'',current:false,...overrides});
const project = (overrides: Partial<EnterpriseProject> = {}): EnterpriseProject => ({id:'project-first',name:'Delivery',employer:'Example Systems Ltd',client:'Example Buyer',role:'SAP Consultant',start:'Jan 2020',end:'Jan 2021',industry:'',country:'',modules:[],projectType:'',implementationType:'',duration:null,responsibilities:[],teamSize:null,environment:'',evidenceState:'source_extracted',fieldEvidence:{},...overrides});
const assignments = [project(),project({id:'project-last',start:'Jan 2023',end:'Jan 2024'})];
const estimated = estimateEmploymentFromProjects([job()],assignments,now)[0];
assert.deepEqual([estimated.start,estimated.end],['','']);
assert.deepEqual(estimated.estimatedTenure, {start:'Jan 2020',end:'Jan 2024',projectIds:['project-first','project-last'],basis:'project_envelope'});
assert.match(formatProjectTenureEstimate(estimated.estimatedTenure),/estimated.*including time between projects/);
assert.equal(supportedSapYears([estimated],assignments,now),4,'same-employer SAP period includes time between projects');
assert.equal(estimateEmploymentFromProjects([job({start:'Jan 2019',end:'Jan 2025'})],assignments,now)[0].estimatedTenure,undefined,'exact employment tenure takes priority');
assert.equal(estimateEmploymentFromProjects([job()], [project({employer:'Other Ltd',client:'Example Systems Ltd'})],now)[0].estimatedTenure,undefined,'client matching is not employer ownership');
assert.equal(estimateEmploymentFromProjects([job()], [project({employer:''})],now)[0].estimatedTenure,undefined,'role similarity is not ownership');
assert.equal(estimateEmploymentFromProjects([job(),job({id:'second-role',title:'Accountant'})],assignments,now)[0].estimatedTenure,undefined,'same-employer promotions cannot inherit all projects');
assert.equal(estimateEmploymentFromProjects([job()], [project({start:'Jan 2024',end:'Jan 2020'})],now)[0].estimatedTenure,undefined);
assert.equal(estimateEmploymentFromProjects([job({start:'Jan 2022'})],assignments,now)[0].estimatedTenure?.start,'Jan 2023','source endpoint constrains eligible projects');
assert.equal(estimateEmploymentFromProjects([job({current:true})],assignments,now)[0].estimatedTenure?.end,'Jan 2024','current employer does not extend a finished project to today');
assert.equal(supportedSapYears([
 job({title:'Accountant',start:'Jan 2000',end:'Jan 2010',modules:['FI']}),
 job({title:'Sales Manager',start:'Jan 2010',end:'Jan 2015',modules:['SD']}),
 job({start:'Jan 2020',end:'Jan 2024'}),
],assignments,now),4,'only SAP delivery years; duplicate project coverage counted once');
assert.equal(supportedSapYears([job({title:'SAP end user',start:'Jan 2020',end:'Jan 2024'})],[],now),null);
const sapProfile = normalizeActualCandidateSchema({id:'synthetic-sap-duration-review',sap_experience_years:20,employment_history:[
 {company:'Example Finance Ltd',title:'Accountant',start:'Jan 2000',end:'Jan 2010'},
 {company:'Example Systems Ltd',title:'SAP Consultant',start:'Jan 2020',end:'Jan 2024'},
]}).enterpriseProfile;
assert.equal(sapProfile.experienceSummary.sapExperienceYears,4,'actual supported SAP ranges outrank a larger declared total');
assert.equal(sapProfile.experienceSummary.totalCareerYears,14,'career history retained separately from SAP');
const nestedProjectProfile = normalizeActualCandidateSchema({id:'synthetic-owned-assignment-range',raw_text:'Professional Experience Example Systems Sdn Bhd SAP Consultant Project Involvement: Example Buyer SAP Upgrade 01/20 - 01/21 Responsible to configure delivery. Example Other Sdn Bhd SAP Consultant Project Involvement: Example Client SAP Rollout 01/23 - 01/24 Responsible to configure delivery.'}).enterpriseProfile;
assert.equal(nestedProjectProfile.employmentTimeline.length,2);
assert.equal(nestedProjectProfile.employmentTimeline.filter(j=>j.estimatedTenure).length,2);
assert.equal(nestedProjectProfile.experienceSummary.sapExperienceYears,2);
assert.ok(nestedProjectProfile.employmentTimeline.every(j=>!j.start&&!j.end));
assert.equal(supportedSapYears([job({title:'Analyst',modules:['Excel'],start:'Jan 2020',end:'Jan 2024'})],[],now),null,'non-SAP skills cannot qualify a generic title');
assert.equal(supportedSapYears([job({title:'SAP Sales and Distribution Consultant',start:'Jan 2020',end:'Jan 2024'})],[],now),4,'SAP SD consulting is delivery, not a sales job');
assert.equal(supportedSapYears([job({title:'SAP Sales Distribution Consultant',start:'Jan 2020',end:'Jan 2024'})],[],now),4,'SAP SD consulting without a conjunction remains delivery');
assert.equal(supportedSapYears([job({title:'SAP Sales Distribution Functional Consultant',start:'Jan 2020',end:'Jan 2024'})],[],now),4,'functional SAP SD consulting remains delivery');
assert.equal(supportedSapYears([job({title:'Sales Distribution Consultant',start:'Jan 2020',end:'Jan 2024'})],[],now),null,'sales consulting without SAP is not SAP delivery');
assert.equal(supportedSapYears([job({title:'SAP Sales Manager',start:'Jan 2020',end:'Jan 2024'})],[],now),null,'SAP product sales is not consulting delivery');
assert.equal(supportedSapYears([job({title:'SAP end user',start:'Jan 2020',end:'Jan 2024'})],[],now),null,'SAP end-user work remains excluded');
import { ownedProjectRangesFromResume } from '../lib/projectEmploymentEstimate';
assert.equal(ownedProjectRangesFromResume([job()], 'Example Systems Ltd SAP Consultant Project Involvement: Undated work. Other Ltd SAP Consultant Project Involvement: SAP Upgrade 01/20 - 01/21').length,0,'next employer range cannot fill an undated assignment');
assert.equal(ownedProjectRangesFromResume([job()], 'Example Systems Ltd SAP Consultant Project Involvement: Responsibilities delivered support 01/20 - 01/21').length,0,'dates buried in duties are not a project heading');

assert.equal(
  supportedSapYears([], assignments, now),
  4,
  "explicit same-employer projects establish a continuous SAP period",
);
assert.equal(
  supportedSapYears(
    [],
    [
      assignments[0],
      project({
        id: "different-employer",
        employer: "Other Employer Ltd",
        start: "Jan 2023",
        end: "Jan 2024",
      }),
    ],
    now,
  ),
  2,
  "do not bridge the gap between different employers",
);
assert.equal(
  supportedSapYears(
    [],
    assignments.map((p) => ({ ...p, employer: "", client: "Same Client" })),
    now,
  ),
  2,
  "same client does not establish a common employer",
);
assert.equal(
  supportedSapYears(
    [
      job({ id: "first-spell", start: "Jan 2020", end: "Jan 2021" }),
      job({ id: "return-spell", start: "Jan 2023", end: "Jan 2024" }),
    ],
    assignments,
    now,
  ),
  2,
  "explicitly separate employment spells are not bridged",
);
assert.equal(
  supportedSapYears(
    [
      job({
        id: "accounting",
        title: "Accountant",
        start: "Jan 2015",
        end: "Jan 2019",
      }),
      job({ id: "sap-role", start: "Jan 2020", end: "Jan 2024" }),
    ],
    assignments,
    now,
  ),
  4,
  "retain non-SAP role exclusion and overlap deduplication",
);

assert.equal(supportedSapYears([job({title:'Vendor & SAP Material Management (Supply Chain Management)',start:'Jan 2020',end:'Jan 2021'})],[],now),null,'operational SAP usage is not a delivery role');
assert.equal(supportedSapYears([job({title:'FI Consultant',start:'Jan 2020',end:'Jan 2021'})],[],now),1,'explicit SAP module consulting qualifies without repeating SAP in title');

assert.equal(supportedSapYears([job({title:'Senior Associate - SAP MM',start:'Jan 2020',end:'Jan 2021'})],[],now),1,'SAP associate delivery remains eligible');
assert.equal(supportedSapYears([job({title:'SAP Sales and Distribution Consultant'})],assignments,now),4,'SAP SD consulting may own a continuous project period');
