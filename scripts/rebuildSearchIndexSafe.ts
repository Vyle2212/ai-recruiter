import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { planCanonicalSearchIndexRebuild } from "../lib/searchIndexRebuildPlan";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";

type AnyRecord = Record<string, any>;

const PAGE_SIZE = 1000;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key])
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function supabaseClient() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey)
    throw new Error(
      "Search index rebuild refused: server service-role URL/key required.",
    );
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

async function fetchAll(
  supabase: ReturnType<typeof supabaseClient>,
  table: string,
  columns: string,
) {
  const rows: AnyRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function parseArgs(argv: string[]) {
  if (argv.includes("--write"))
    throw new Error(
      "Search index rebuild refused: standalone writes require an independently reviewed exact-set transaction, backup and source-version readback.",
    );
  if (argv.some((value) => value !== "--refresh-existing"))
    throw new Error("Search index rebuild refused: unsupported argument");
  return {
    refreshExisting: argv.includes("--refresh-existing"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabase = supabaseClient();
  const [{ buildCandidateSearchIndexRow }, candidates, indexRows] =
    await Promise.all([
      import("../lib/candidateSearchIndex"),
      fetchAll(supabase, "candidates", "*"),
      fetchAll(
        supabase,
        "candidate_search_index",
        "candidate_id,updated_at,source_updated_at",
      ),
    ]);

  const report = buildSearchIndexAudit({
    candidates,
    indexRows,
    sampleSize: 0,
  });
  const plan = planCanonicalSearchIndexRebuild({
    candidates,
    indexRows,
    refreshExisting: args.refreshExisting,
    buildRow: buildCandidateSearchIndexRow,
  });

  console.log("==================================================");
  console.log("PRIMUS AI Recruiter");
  console.log("Read-only Search Index Rebuild Plan");
  console.log("==================================================");
  console.log("");
  console.log("Mode: READ_ONLY");
  console.log(`Refresh existing: ${args.refreshExisting ? "yes" : "no"}`);
  console.log(`Candidates count: ${report.candidatesCount}`);
  console.log(`Search index count: ${report.searchIndexRows}`);
  console.log(`Missing index rows: ${report.missingIndexRows}`);
  console.log(`Stale index rows: ${report.staleIndexRows}`);
  console.log(`Duplicate index rows: ${report.duplicateIndexRows}`);
  console.log(`Rows that would be inserted: ${plan.missingCandidates}`);
  console.log(`Rows buildable for insert: ${plan.buildableMissing}`);
  console.log(`Existing rows selected for refresh: ${plan.selectedExisting}`);
  console.log(`Rows not buildable / not index-eligible: ${plan.notBuildable}`);
  console.log(`Estimated write count: ${plan.rowsToWrite.length}`);
  console.log("");

  console.log("Read-only plan. No database updates were made.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
