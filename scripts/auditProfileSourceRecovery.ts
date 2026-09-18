import { auditSourceText, auditEmploymentDateComplete, auditEmploymentIncomplete, auditPopulationScope } from '../lib/profileSourceAuditEvidence';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { employmentTimelineDiagnostics } from '../lib/candidate360Employment';
import { careerMonthIndex } from '../lib/candidateCareerExperience';
import { canonicalLifecycleEvidence, targetModuleDeliveryEvidence } from '../lib/searchV2Lifecycle';
import { createClient } from '@supabase/supabase-js';
import { CANDIDATE_CANONICAL_VERSION, normalizeActualCandidateSchema } from '../lib/candidate360SchemaNormalize';

// Read-only inventory. Never updates candidate IDs, source fields or recruiter data.
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
async function main() {
let rows: Record<string, unknown>[] = [];
let declaredPopulation: number | null = null;
if (arg('--input')) {
  const bytes = fs.readFileSync(arg('--input')!);
  const parsed = JSON.parse(bytes.toString(bytes[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''));
  const records = Array.isArray(parsed) ? parsed : parsed.samples;
  declaredPopulation = Number.isSafeInteger(parsed.population) && parsed.population >= 0 ? parsed.population : null;
  if (!Array.isArray(records)) throw new Error("Expected a records array or samples export");
  rows = records.map((row: Record<string, unknown>) => {
    const source = row.source || row;
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Invalid source record");
    return source as Record<string, unknown>;
  });
} else {
  const url = process.env.CANDIDATE_SUPABASE_URL;
  const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Candidate database configuration unavailable');
  const db = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  for (let offset = 0; ; offset += 500) {
    const {data, error} = await db.from('candidates').select('*').order('id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) break;
  }
}
const review: {token: string; reasons: string[]}[] = [];
const sourceExport: {token: string; reasons: string[]; source: Record<string, unknown>}[] = [];
// Opt-in diagnostic export. Never include unrelated top-level database fields.
const sourceFields = ['id', 'name', 'full_name', 'current_title', 'title', 'current_company', 'company',
  'years_experience', 'experience', 'employment_history', 'professional_history', 'education',
  'projects', 'project_experience', 'raw_text', 'resume_text', 'cv_text', 'raw_cv'];
if (arg('--review-sources') && arg('--review-sources') === arg('--output')) throw new Error('Source export and audit output must use different paths');
let sourceTextPresent = 0, sourceReferencePresent = 0, employmentProfiles = 0, employmentRecords = 0, educationProfiles = 0;
const diagnostics = {malformedNarrativeRecords: 0, duplicateRecords: 0, invalidRanges: 0, profilesWithOverlappingRanges: 0, possibleClientEmployerConflicts: 0};
const profileChecks: Record<string, unknown>[] = [];
const completeness = {company: 0, title: 0, dateRange: 0, currentEmployerProfiles: 0, projects: 0, projectsWithoutType: 0, paginationLeaks: 0};
for (const row of rows) {
  const text = auditSourceText(row);
  const hasText = text.trim().length > 0;
  const hasReference = Boolean(row.source_file);
  sourceTextPresent += Number(hasText); sourceReferencePresent += Number(hasReference);
  const profile = normalizeActualCandidateSchema(row).enterpriseProfile;
  employmentProfiles += Number(profile.employmentTimeline.length > 0);
  employmentRecords += profile.employmentTimeline.length;
  educationProfiles += Number(profile.education.length > 0);
  for (const job of profile.employmentTimeline) {
    completeness.company += Number(Boolean(job.company));
    completeness.title += Number(Boolean(job.title));
    completeness.dateRange += Number(auditEmploymentDateComplete(job));
  }
  completeness.currentEmployerProfiles += Number(profile.employmentTimeline.some(job => job.current && job.company));
  completeness.projects += profile.projects.length;
  completeness.projectsWithoutType += profile.projects.filter(project => !project.projectType).length;
  completeness.paginationLeaks += profile.projects.filter(project => project.responsibilities.some(item => /\bPage\s+\d+\s+of\s+\d+\b/i.test(item))).length;
  const reasons: string[] = [];
  if (!hasText) reasons.push(hasReference ? 'SOURCE_TEXT_MISSING_RETRIEVE_REFERENCED_FILE' : 'SOURCE_TEXT_AND_REFERENCE_MISSING');
  if (/\b(?:EXPERINCE|EMPLOYMENT HISTORY|WORKING EXPERIENCE|PROFESSIONAL EXPERIENCE)\b/i.test(text) && !profile.employmentTimeline.length) reasons.push('EMPLOYMENT_SECTION_REQUIRES_REVIEW');
  if (/\b(?:EDUCATION|ACADEMIC QUALIFICATIONS)\b/i.test(text) && !profile.education.length) reasons.push('EDUCATION_SECTION_REQUIRES_REVIEW');
  if (profile.employmentTimeline.some(auditEmploymentIncomplete)) reasons.push('INCOMPLETE_EMPLOYMENT_FIELDS');
  const token = crypto.createHash('sha256').update(String(row.id || rows.indexOf(row))).digest('hex').slice(0,12);
  const timeline = profile.employmentTimeline;
  const check = employmentTimelineDiagnostics(timeline);
  diagnostics.malformedNarrativeRecords += check.malformedNarrativeRecords;
  diagnostics.duplicateRecords += check.duplicateRecords;
  diagnostics.invalidRanges += check.invalidRanges;
  const intervals = timeline.map(job => [careerMonthIndex(job.start), careerMonthIndex(job.end, job.current)]);
  const overlaps = intervals.some(([start, end], index) => start !== null && end !== null && intervals.slice(index + 1).some(([otherStart, otherEnd]) => otherStart !== null && otherEnd !== null && start < otherEnd && otherStart < end));
  diagnostics.profilesWithOverlappingRanges += Number(overlaps);
  const clientNames = new Set(profile.projects.map(project => project.client.trim().toLowerCase()).filter(Boolean));
  const possibleClientEmployerConflict = timeline.some(job => clientNames.has(job.company.trim().toLowerCase()));
  diagnostics.possibleClientEmployerConflicts += Number(possibleClientEmployerConflict);
  const delivery = targetModuleDeliveryEvidence({lifecycleEvidence: canonicalLifecycleEvidence(token, profile.projects)}, 'FICO');
  profileChecks.push({token, employmentRecords: timeline.length, missingTitleRecords: timeline.filter(job => !job.title).length, missingCompanyRecords: timeline.filter(job => !job.company).length,
    missingDateRecords: timeline.filter(job => !auditEmploymentDateComplete(job)).length,
    totalCareerYears: profile.experienceSummary.totalCareerYears, currentRoleTenureYears: profile.experienceSummary.currentRoleTenureYears,
    projects: profile.projects.length, directFicoAssignments: delivery.directTargetAssignments.length,
    overlappingEmployment: overlaps, possibleClientEmployerConflict,
    status: timeline.length ? (timeline.some(auditEmploymentIncomplete) ? 'INCOMPLETE_EMPLOYMENT' : 'EXTRACTED_REQUIRES_SOURCE_REVIEW') : 'UNRESOLVED_SOURCE_REVIEW_REQUIRED'});

  if (reasons.length) review.push({token, reasons});
  if (arg('--review-sources') && reasons.some(reason => ['EMPLOYMENT_SECTION_REQUIRES_REVIEW', 'INCOMPLETE_EMPLOYMENT_FIELDS'].includes(reason))) {
    sourceExport.push({token, reasons, source: Object.fromEntries(sourceFields.filter(key => row[key] !== undefined).map(key => [key, row[key]]))});
  }
}
const scope = auditPopulationScope(rows.length, declaredPopulation, Boolean(arg('--input')));
const report = {mode:'READ_ONLY', scope, diagnostics, profileChecks, version: CANDIDATE_CANONICAL_VERSION, completeness, profilesWithoutEmployment: rows.length - employmentProfiles, population: rows.length, sourceTextPresent, sourceReferencePresent, employmentProfiles, employmentRecords, educationProfiles, review,
  limits:['Overlap and client/employer equality are review flags, not proof of an error.', 'Direct FICO assignment counts are evidence metrics, not Search V2 scores.', 'A source reference does not prove the original file is accessible.', 'Section detection flags possible omissions; it does not prove extraction completeness.', 'No database records changed. Production UI and scoring distribution remain unverified.']};
if (arg('--review-sources')) {
  fs.writeFileSync(arg('--review-sources')!, JSON.stringify({mode: 'READ_ONLY', version: CANDIDATE_CANONICAL_VERSION,
    population: declaredPopulation ?? (arg('--input') ? null : rows.length), auditedSources: rows.length, count: sourceExport.length, selection: 'employment review or incomplete employment',
    samples: sourceExport}, null, 2), 'utf8');
  console.log(`Exported ${sourceExport.length} employment review sources to ${arg('--review-sources')}`);
}
const output = JSON.stringify(report,null,2);
if (arg('--output')) fs.writeFileSync(arg('--output')!, output, 'utf8'); else console.log(output);

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
