import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { candidateSearchV2ProjectionDocument, normalizedDisplayCompany } from "../lib/candidateSearchV2Projection";
import { isPlausibleCandidateName, normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { auditLinkedInProfileUrl } from "../lib/linkedinProfileUrl";

const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Candidate database configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false } });

async function all(table: string, columns: string) {
  const rows: Array<Record<string, any>> = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db.from(table).select(columns).order(table === "candidates" ? "id" : "candidate_id").range(from, from + 199);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 200) break;
  }
  return rows;
}

async function main() {
  const [candidates, indexRows] = await Promise.all([
    all("candidates", "*"),
    all("candidate_search_index", "candidate_id,display_name,display_title,display_company,display_location,country,city,years,primary_module,all_modules,all_submodules,project_types,greenfield_count,brownfield_count,rollout_count,ams_count,quality_score,search_text,source_updated_at"),
  ]);
  const candidatesById = new Map(candidates.map((row) => [String(row.id), row]));
  const mismatches: string[] = [];
  const extraction = {
    experience: { extracted: 0, genuinely_none: 0, source_unavailable: 0, extraction_pending: 0, extraction_failed: 0 },
    projects: { extracted: 0, genuinely_none: 0, source_unavailable: 0, extraction_pending: 0, extraction_failed: 0 },
  };
  let internalProfiles = 0;
  let linkedInProfiles = 0;
  const linkedInUrls={supportedCandidateOwned:0,missing:0,malformed:0,unsupportedDomain:0,unsupportedPath:0};
  const routes = { experience: {} as Record<string, { count: number; candidateIds: string[] }>, projects: {} as Record<string, { count: number; candidateIds: string[] }> };
  const failures = { experience: {} as Record<string, { count: number; candidateIds: string[] }>, projects: {} as Record<string, { count: number; candidateIds: string[] }> };
  const linkedinMarkerFields = ["talent_pool", "talentPool", "source_type", "sourceType", "profile_source", "profileSource", "origin", "ingestion_source", "ingestionSource", "import_source", "importSource", "provider"];
  const record = (target: Record<string, { count: number; candidateIds: string[] }>, key: string, candidateId: string) => {
    const bucket = target[key] ||= { count: 0, candidateIds: [] };
    bucket.count += 1;
    if (bucket.candidateIds.length < 8) bucket.candidateIds.push(candidateId);
  };
  for (const row of indexRows) {
    const candidateRow = candidatesById.get(String(row.candidate_id));
    const freshEnterprise = candidateRow
      ? normalizeActualCandidateSchema({ ...candidateRow, parsed_json: null }).enterpriseProfile
      : null;
    const enterprise = candidateRow?.parsed_json?.canonical_candidate?.payload?.enterpriseProfile;
    if (!enterprise) continue;
    for (const section of ["experience", "projects"] as const) {
      const status = freshEnterprise?.quality?.extraction?.[section]?.status || "source_unavailable";
      if (status in extraction[section]) extraction[section][status as keyof typeof extraction[typeof section]] += 1;
      const detail = freshEnterprise?.quality?.extraction?.[section];
      if (status === "extraction_failed") record(failures[section], detail?.failureReason || "unexplained_failure", String(row.candidate_id));
    }
    // URL/text mentions are intentionally ignored. The current index projection
    // has no authoritative LinkedIn pool marker and therefore fails closed.
    internalProfiles += 1;
    const authoritativeLinkedIn = linkedinMarkerFields.some((field) => /^(?:linkedin|linkedin_talent_pool|linkedin_import)$/i.test(String(candidateRow?.[field] || "").trim()));
    if (authoritativeLinkedIn) { internalProfiles -= 1; linkedInProfiles += 1; }
    const linkedInUrlAudit=auditLinkedInProfileUrl(candidateRow?.linkedin_url);
    if(linkedInUrlAudit.reason==="valid")linkedInUrls.supportedCandidateOwned+=1;
    else if(linkedInUrlAudit.reason==="missing")linkedInUrls.missing+=1;
    else if(linkedInUrlAudit.reason==="malformed")linkedInUrls.malformed+=1;
    else if(linkedInUrlAudit.reason==="unsupported_domain")linkedInUrls.unsupportedDomain+=1;
    else linkedInUrls.unsupportedPath+=1;
    for (const item of freshEnterprise?.employmentTimeline || []) record(routes.experience, item.provenance?.[0]?.sourceRef || "legacy_without_provenance", String(row.candidate_id));
    for (const item of freshEnterprise?.projects || []) {
      const provenance = Object.values(item.fieldEvidence || {}).flatMap((field: any) => field?.provenance || [])[0];
      record(routes.projects, provenance?.sourceRef || "legacy_without_provenance", String(row.candidate_id));
    }
    const projected = candidateSearchV2ProjectionDocument(row);
    const expectedYears = enterprise.experienceSummary?.totalCareerYears ?? null;
    const expectedName = isPlausibleCandidateName(enterprise.identity?.name) ? enterprise.identity.name : "";
    if ((projected.candidateName || "") !== expectedName) mismatches.push(`${row.candidate_id}:name`);
    if ((projected.currentEmployer || "") !== (normalizedDisplayCompany(enterprise.identity?.currentCompany) || "")) mismatches.push(`${row.candidate_id}:company`);
    if (projected.totalYearsExperience !== expectedYears) mismatches.push(`${row.candidate_id}:experience`);
    const capability = candidateRow?.parsed_json?.canonical_candidate?.capabilities?.implementation;
    const expectedPositive = capability?.verification === "VERIFIED" || capability?.verification === "SUPPORTED";
    const projectedPositive = projected.implementationEvidenceLevel === "verified_structured_evidence";
    if (projectedPositive !== (capability?.verification === "VERIFIED")) mismatches.push(`${row.candidate_id}:implementation`);
    if (!expectedPositive && projected.skills?.includes("Implementation")) mismatches.push(`${row.candidate_id}:implementation-chip`);
  }
  assert.equal(mismatches.length, 0, mismatches.slice(0, 25).join(", "));
  assert.equal(Object.values(failures.experience).reduce((sum, item) => sum + item.count, 0), 0);
  assert.equal(Object.values(failures.projects).reduce((sum, item) => sum + item.count, 0), 0);
  const report = {
    generatedAt: new Date().toISOString(),
    population: indexRows.length,
    before: { experience: { extracted: 204, extraction_failed: 617 }, projects: { extracted: 1, extraction_failed: 781 } },
    after: extraction,
    failureReasons: failures,
    extractionRoutes: routes,
    talentPools: { internal_profiles: internalProfiles, linkedin_talent_pool: linkedInProfiles },
    linkedinAudit: { authoritativeFieldsInspected: linkedinMarkerFields, urlOrTextMentionUsedForPoolClassification: false, ...linkedInUrls },
    canonicalMismatches: 0,
  };
  fs.writeFileSync("reports/search-v2-extraction-diagnostic-v22.json", JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
