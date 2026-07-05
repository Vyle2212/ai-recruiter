import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";

type AnyRecord = Record<string, any>;

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
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Search index audit failed: missing Supabase URL/key.");
  return createClient(supabaseUrl, supabaseKey);
}

async function fetchAll(supabase: ReturnType<typeof supabaseClient>, table: string, columns: string) {
  const rows: AnyRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const supabase = supabaseClient();
  const [candidates, indexRows] = await Promise.all([
    fetchAll(supabase, "candidates", "id,updated_at"),
    fetchAll(supabase, "candidate_search_index", "candidate_id,updated_at,source_updated_at"),
  ]);
  const report = buildSearchIndexAudit({ candidates, indexRows, sampleSize: 20 });

  console.log("==================================================");
  console.log("PRIMUS AI Recruiter");
  console.log("Search Index Audit");
  console.log("==================================================");
  console.log("");
  console.log(`Candidates count: ${report.candidatesCount}`);
  console.log(`candidate_search_index count: ${report.searchIndexRows}`);
  console.log(`Missing index rows: ${report.missingIndexRows}`);
  console.log(`Stale index rows: ${report.staleIndexRows}`);
  console.log(`Duplicate index rows: ${report.duplicateIndexRows}`);
  console.log(`Sample missing candidate ids: ${report.sampleMissingCandidateIds.length ? report.sampleMissingCandidateIds.join(", ") : "None"}`);
  console.log(`Sample stale candidate ids: ${report.sampleStaleCandidateIds.length ? report.sampleStaleCandidateIds.join(", ") : "None"}`);
  console.log(`Sample duplicate candidate ids: ${report.sampleDuplicateCandidateIds.length ? report.sampleDuplicateCandidateIds.join(", ") : "None"}`);
  console.log("");
  console.log(`Recommendation: ${report.recommendation}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
