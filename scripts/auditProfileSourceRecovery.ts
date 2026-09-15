import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { normalizeActualCandidateSchema } from '../lib/candidate360SchemaNormalize';

// Read-only inventory. Never updates candidate IDs, source fields or recruiter data.
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
async function main() {
let rows: Record<string, unknown>[] = [];
if (arg('--input')) {
  const bytes = fs.readFileSync(arg('--input')!);
  const parsed = JSON.parse(bytes.toString(bytes[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''));
  rows = parsed.map((row: Record<string, unknown>) => row.source || row);
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
let sourceTextPresent = 0, sourceReferencePresent = 0, employmentProfiles = 0, employmentRecords = 0, educationProfiles = 0;
for (const row of rows) {
  const text = ['raw_text','resume_text','raw_cv'].map(key => typeof row[key] === 'string' ? row[key] : '').join('\n');
  const hasText = text.trim().length > 0;
  const hasReference = Boolean(row.source_file);
  sourceTextPresent += Number(hasText); sourceReferencePresent += Number(hasReference);
  const profile = normalizeActualCandidateSchema(row).enterpriseProfile;
  employmentProfiles += Number(profile.employmentTimeline.length > 0);
  employmentRecords += profile.employmentTimeline.length;
  educationProfiles += Number(profile.education.length > 0);
  const reasons: string[] = [];
  if (!hasText) reasons.push(hasReference ? 'SOURCE_TEXT_MISSING_RETRIEVE_REFERENCED_FILE' : 'SOURCE_TEXT_AND_REFERENCE_MISSING');
  if (/\b(?:EXPERINCE|EMPLOYMENT HISTORY|WORKING EXPERIENCE|PROFESSIONAL EXPERIENCE)\b/i.test(text) && !profile.employmentTimeline.length) reasons.push('EMPLOYMENT_SECTION_REQUIRES_REVIEW');
  if (/\b(?:EDUCATION|ACADEMIC QUALIFICATIONS)\b/i.test(text) && !profile.education.length) reasons.push('EDUCATION_SECTION_REQUIRES_REVIEW');
  if (profile.employmentTimeline.some(x => !x.title || !x.start || !x.end)) reasons.push('INCOMPLETE_EMPLOYMENT_FIELDS');
  if (reasons.length) review.push({token: crypto.createHash('sha256').update(String(row.id || rows.indexOf(row))).digest('hex').slice(0,12), reasons});
}
const report = {mode:'READ_ONLY', population: rows.length, sourceTextPresent, sourceReferencePresent, employmentProfiles, employmentRecords, educationProfiles, review,
  limits:['A source reference does not prove the original file is accessible.', 'Section detection flags possible omissions; it does not prove extraction completeness.', 'No database records changed. Production UI and scoring distribution remain unverified.']};
const output = JSON.stringify(report,null,2);
if (arg('--output')) fs.writeFileSync(arg('--output')!, output, 'utf8'); else console.log(output);

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
