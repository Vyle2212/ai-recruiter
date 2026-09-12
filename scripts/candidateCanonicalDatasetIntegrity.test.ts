import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { adaptCandidateToSearchV2Document } from "../lib/candidateSearchV2Adapter";
import { CANDIDATE_CANONICAL_VERSION, normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Candidate database configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false } });
async function main() {
const rows: Array<Record<string, unknown>> = [];
for (let from = 0; ; from += 100) {
  const { data, error } = await db.from("candidates").select("*").order("id").range(from, from + 99);
  if (error) throw new Error(JSON.stringify(error));
  rows.push(...((data || []) as Array<Record<string, unknown>>));
  if (!data || data.length < 100) break;
}
let contradictions = 0;
const mismatchDetails: string[] = [];
const coverage = { name: 0, company: 0, experience: 0, employment: 0, education: 0, certifications: 0, languages: 0 };
for (const row of rows) {
  const snapshot = (row.parsed_json as any)?.canonical_candidate;
  assert.equal(snapshot?.version, CANDIDATE_CANONICAL_VERSION, `canonical version missing: ${row.id}`);
  const canonical = normalizeActualCandidateSchema(row).enterpriseProfile;
  const search = adaptCandidateToSearchV2Document(row);
  if (canonical.identity.name) coverage.name += 1;
  if (canonical.identity.currentCompany) coverage.company += 1;
  if (canonical.experienceSummary.totalCareerYears !== null) coverage.experience += 1;
  if (canonical.employmentTimeline.length) coverage.employment += 1;
  if (canonical.education.length) coverage.education += 1;
  if (canonical.certifications.length) coverage.certifications += 1;
  if (canonical.languages.length) coverage.languages += 1;
  if ((search.candidateName || "") !== canonical.identity.name) { contradictions += 1; mismatchDetails.push(`${row.id}:name`); }
  if ((search.currentEmployer || "") !== canonical.identity.currentCompany) { contradictions += 1; mismatchDetails.push(`${row.id}:company`); }
  if (search.totalYearsExperience !== canonical.experienceSummary.totalCareerYears) { contradictions += 1; mismatchDetails.push(`${row.id}:experience`); }
  if (canonical.employmentTimeline.some((item) => item.current && item.start) && canonical.experienceSummary.currentEmployerTenureYears === null) { contradictions += 1; mismatchDetails.push(`${row.id}:tenure`); }
  assert.doesNotMatch(JSON.stringify(canonical.languages), /\[object Object\]/);
  assert.ok(canonical.projects.length === 0 || canonical.projects.every((project) => project.fieldEvidence && project.evidenceState));
}
assert.equal(contradictions, 0, mismatchDetails.join(", "));
assert.ok(coverage.name >= 840, `validated-name coverage regressed: ${coverage.name}`);
assert.ok(coverage.company >= 290, `company coverage regressed: ${coverage.company}`);
assert.ok(coverage.experience >= 205, `experience coverage regressed: ${coverage.experience}`);
assert.ok(coverage.employment >= 205, `employment coverage regressed: ${coverage.employment}`);
assert.ok(coverage.education >= 270, `education coverage regressed: ${coverage.education}`);
assert.ok(coverage.certifications >= 195, `certification coverage regressed: ${coverage.certifications}`);
assert.ok(coverage.languages >= 660, `language coverage regressed: ${coverage.languages}`);
console.log(`candidateCanonicalDatasetIntegrity.test.ts passed: ${rows.length} candidates, ${contradictions} contradictions`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
