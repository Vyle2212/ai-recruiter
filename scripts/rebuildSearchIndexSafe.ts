import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";

type AnyRecord = Record<string, any>;
type SearchIndexRow = Record<string, any>;

const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 100;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function supabaseClient() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Search index rebuild failed: missing Supabase URL/key.");
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

async function fetchAll(supabase: ReturnType<typeof supabaseClient>, table: string, columns: string) {
  const rows: AnyRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function idOf(row: AnyRecord) {
  return String(row.id || row.candidate_id || "").trim();
}

function parseArgs(argv: string[]) {
  return {
    write: argv.includes("--write"),
    refreshExisting: argv.includes("--refresh-existing"),
  };
}

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function arrayFrom(value: any): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map(clean).filter(Boolean);
  }
  return [];
}

function unique(values: any[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function maskEmail(email: any) {
  const value = clean(email).toLowerCase();
  if (!value.includes("@")) return null;
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: any) {
  const value = clean(phone);
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return `${value.slice(0, 3)} ***** ${digits.slice(-3)}`;
}

function numberValue(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstCanonicalModule(candidate: AnyRecord, canonicalSapKey: (value: any) => string) {
  const values = [
    candidate.primary_module,
    candidate.primaryModule,
    candidate.sap_module,
    ...arrayFrom(candidate.sap_modules),
    ...arrayFrom(candidate.secondary_modules),
    ...arrayFrom(candidate.skills),
  ];
  for (const value of values) {
    const module = canonicalSapKey(value);
    if (module && !["SAP", "UNKNOWN", "GENERAL_SAP", "SAP_GENERAL"].includes(module)) return module;
  }
  return "";
}

function projectTypes(candidate: AnyRecord) {
  const types: string[] = [];
  if (numberValue(candidate.implementation_project_count ?? candidate.implementation_projects) > 0) types.push("IMPLEMENTATION");
  if (numberValue(candidate.rollout_project_count ?? candidate.rollout_projects) > 0) types.push("ROLLOUT");
  if (numberValue(candidate.ams_support_project_count ?? candidate.ams_projects ?? candidate.support_projects) > 0) types.push("AMS");
  if (numberValue(candidate.s4hana_project_count ?? candidate.s4_implementation_count ?? candidate.s4hana_projects) > 0) types.push("S4");
  if (numberValue(candidate.s4_greenfield_count ?? candidate.greenfield_projects) > 0) types.push("GREENFIELD");
  if (numberValue(candidate.s4_conversion_count ?? candidate.brownfield_projects) > 0) types.push("BROWNFIELD");
  return unique([...types, ...arrayFrom(candidate.project_types)]);
}

function buildCoverageSearchIndexRow(candidate: AnyRecord, helpers: {
  canonicalSapKey: (value: any) => string;
  cleanTalentSearchTitle: (value: any, primaryModule?: string) => string;
  extractTalentSearchExplicitName: (candidate: any) => string;
  isTalentSearchBadDisplayName: (value: any) => boolean;
  isTalentSearchPlaceholderName: (value: any) => boolean;
  safeTalentSearchCompany: (value: any) => string;
}) {
  const candidateId = clean(candidate.id || candidate.candidate_id);
  if (!candidateId) return null;
  const primary = firstCanonicalModule(candidate, helpers.canonicalSapKey);
  if (!primary) return null;
  const rawName = clean(candidate.display_name || candidate.displayName || candidate.full_name || candidate.candidate_name || candidate.normalized_name || candidate.name || helpers.extractTalentSearchExplicitName(candidate));
  const displayName = rawName && !helpers.isTalentSearchPlaceholderName(rawName) && !helpers.isTalentSearchBadDisplayName(rawName)
    ? rawName
    : "Candidate profile pending validation";
  const displayCompany = helpers.safeTalentSearchCompany(candidate.display_company || candidate.current_company || candidate.currentCompany || candidate.current_employer || candidate.company || candidate.employer);
  const displayTitle = helpers.cleanTalentSearchTitle(candidate.display_title || candidate.current_title || candidate.title || candidate.headline || "", primary);
  const allModules = unique([
    primary,
    ...arrayFrom(candidate.sap_modules).map(helpers.canonicalSapKey),
    ...arrayFrom(candidate.secondary_modules).map(helpers.canonicalSapKey),
    ...arrayFrom(candidate.skills).map(helpers.canonicalSapKey),
  ]).filter((module) => !["SAP", "UNKNOWN", "GENERAL_SAP", "SAP_GENERAL"].includes(module));
  const submodules = unique(arrayFrom(candidate.sap_submodules).map(helpers.canonicalSapKey)).filter(Boolean);
  const searchText = unique([
    displayName,
    clean(displayName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    displayTitle,
    displayCompany,
    candidate.current_location,
    candidate.location,
    candidate.country,
    primary,
    ...allModules,
    ...submodules,
    candidate.role_type,
    candidate.consulting_level,
    ...projectTypes(candidate),
  ]).join(" ").slice(0, 8000);

  return {
    candidate_id: candidateId,
    primary_module: primary,
    all_modules: allModules,
    all_submodules: submodules,
    country: clean(candidate.country || candidate.current_location || candidate.location) || null,
    city: clean(candidate.city || candidate.current_city) || null,
    years: numberValue(candidate.years ?? candidate.years_experience ?? candidate.years_of_experience),
    role_type: clean(candidate.role_type || candidate.roleType) || null,
    consulting_level: clean(candidate.consulting_level || candidate.consultingLevel) || null,
    company_type: clean(candidate.company_type || candidate.companyType || candidate.company_background) || null,
    consulting_firms: unique([...arrayFrom(candidate.consulting_firm_evidence), ...arrayFrom(candidate.consulting_firms)]),
    project_types: projectTypes(candidate),
    greenfield_count: numberValue(candidate.s4_greenfield_count ?? candidate.greenfield_projects),
    brownfield_count: numberValue(candidate.s4_conversion_count ?? candidate.brownfield_projects),
    rollout_count: numberValue(candidate.rollout_project_count ?? candidate.rollout_projects),
    s4_count: numberValue(candidate.s4hana_project_count ?? candidate.s4_implementation_count ?? candidate.s4hana_projects),
    s4_ams_count: numberValue(candidate.s4_support_count ?? candidate.s4_ams_projects),
    ams_count: numberValue(candidate.ams_support_project_count ?? candidate.ams_projects ?? candidate.support_projects),
    quality_score: Math.max(55, Math.min(88, numberValue(candidate.profile_quality_score ?? candidate.confidence, displayName === "Candidate profile pending validation" ? 60 : 76))),
    search_text: searchText,
    source_updated_at: candidate.updated_at || candidate.latest_cv_uploaded_at || candidate.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    display_name: displayName,
    display_title: displayTitle || null,
    display_company: displayCompany,
    display_location: clean(candidate.current_location || candidate.location || candidate.country) || null,
    email_masked: maskEmail(candidate.email),
    phone_masked: maskPhone(candidate.phone),
  };
}
async function writeRows(supabase: ReturnType<typeof supabaseClient>, rows: SearchIndexRow[]) {
  let written = 0;
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const batch = rows.slice(i, i + WRITE_BATCH_SIZE);
    const { error } = await supabase.from("candidate_search_index").upsert(batch, { onConflict: "candidate_id" });
    if (error) throw error;
    written += batch.length;
  }
  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.refreshExisting && !args.write) {
    throw new Error("--refresh-existing is a write-mode option. Re-run with --write --refresh-existing after reviewing dry-run output.");
  }

  const supabase = supabaseClient();
  const [{ buildCandidateSearchIndexRow }, displayHelpers, sapHelpers, candidates, indexRows] = await Promise.all([
    import("../lib/candidateSearchIndex"),
    import("../lib/talentSearchDisplay"),
    import("../lib/sapCanonicalModuleEngine"),
    fetchAll(supabase, "candidates", "*"),
    fetchAll(supabase, "candidate_search_index", "candidate_id,updated_at,source_updated_at"),
  ]);

  const report = buildSearchIndexAudit({ candidates, indexRows, sampleSize: 20 });
  const indexedIds = new Set(indexRows.map(idOf).filter(Boolean));
  const missingCandidates = candidates.filter((candidate) => candidate.id && !indexedIds.has(String(candidate.id)));
  const refreshCandidates = args.refreshExisting ? candidates.filter((candidate) => indexedIds.has(String(candidate.id))) : [];
  const targetCandidates = [...missingCandidates, ...refreshCandidates];
  const rowsToWrite: SearchIndexRow[] = [];
  const notBuildableIds: string[] = [];

  for (const candidate of targetCandidates) {
    const row = buildCandidateSearchIndexRow(candidate) || buildCoverageSearchIndexRow(candidate, {
      canonicalSapKey: sapHelpers.canonicalSapKey,
      cleanTalentSearchTitle: displayHelpers.cleanTalentSearchTitle,
      extractTalentSearchExplicitName: displayHelpers.extractTalentSearchExplicitName,
      isTalentSearchBadDisplayName: displayHelpers.isTalentSearchBadDisplayName,
      isTalentSearchPlaceholderName: displayHelpers.isTalentSearchPlaceholderName,
      safeTalentSearchCompany: displayHelpers.safeTalentSearchCompany,
    });
    if (row) rowsToWrite.push(row);
    else notBuildableIds.push(String(candidate.id));
  }

  console.log("==================================================");
  console.log("PRIMUS AI Recruiter");
  console.log("Safe Search Index Rebuild");
  console.log("==================================================");
  console.log("");
  console.log(`Mode: ${args.write ? "WRITE" : "DRY RUN"}`);
  console.log(`Refresh existing: ${args.refreshExisting ? "yes" : "no"}`);
  console.log(`Candidates count: ${report.candidatesCount}`);
  console.log(`Search index count: ${report.searchIndexRows}`);
  console.log(`Missing index rows: ${report.missingIndexRows}`);
  console.log(`Stale index rows: ${report.staleIndexRows}`);
  console.log(`Duplicate index rows: ${report.duplicateIndexRows}`);
  console.log(`Rows that would be inserted: ${missingCandidates.length}`);
  console.log(`Rows buildable for insert: ${rowsToWrite.filter((row) => !indexedIds.has(String(row.candidate_id))).length}`);
  console.log(`Existing rows selected for refresh: ${refreshCandidates.length}`);
  console.log(`Rows not buildable / not index-eligible: ${notBuildableIds.length}`);
  console.log(`Estimated write count: ${rowsToWrite.length}`);
  console.log(`Sample candidate ids: ${missingCandidates.slice(0, 20).map((candidate) => candidate.id).join(", ") || "None"}`);
  console.log(`Sample not-buildable ids: ${notBuildableIds.slice(0, 20).join(", ") || "None"}`);
  console.log("");

  if (!args.write) {
    console.log("Dry run only. No database updates were made. Re-run with -- --write to insert missing candidate_search_index rows.");
    return;
  }

  const written = await writeRows(supabase, rowsToWrite);
  console.log(`Inserted/refreshed rows: ${written}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});