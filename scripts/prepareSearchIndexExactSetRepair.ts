import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { buildSearchIndexExactSetRepair } from "../lib/searchIndexExactSetRepair";

type AnyRecord = Record<string, any>;

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function required(value: string | undefined, code: string) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function privateOutputPath(outputPath: string, repositoryRoot: string) {
  if (!outputPath.endsWith(".search-index-repair-private.json"))
    throw new Error("search_index_repair_private_output_suffix_invalid");
  const root = fs.realpathSync(repositoryRoot);
  const parent = fs.realpathSync(path.dirname(path.resolve(outputPath)));
  const resolved = path.join(parent, path.basename(outputPath));
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error("search_index_repair_private_output_inside_repository");
  if (fs.existsSync(resolved))
    throw new Error("search_index_repair_private_output_exists");
  return resolved;
}

async function fetchAll(
  client: { from(table: string): any },
  table: string,
  columns: string,
) {
  const rows: AnyRecord[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const repositoryRoot = process.cwd();
  if (
    execFileSync("git", ["status", "--porcelain"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim()
  )
    throw new Error("search_index_repair_checkout_not_clean");
  const targetCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const outputPath = privateOutputPath(
    required(argument("output"), "search_index_repair_private_output_missing"),
    repositoryRoot,
  );
  const supabaseUrl = required(
    process.env.SUPABASE_URL || process.env.CANDIDATE_SUPABASE_URL,
    "search_index_repair_supabase_url_missing",
  );
  const serviceRoleKey = required(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY,
    "search_index_repair_service_role_missing",
  );
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [candidates, indexRows] = await Promise.all([
    fetchAll(client, "candidates", "*"),
    fetchAll(
      client,
      "candidate_search_index",
      "candidate_id,source_updated_at,updated_at",
    ),
  ]);
  const { request, report } = buildSearchIndexExactSetRepair({
    candidates,
    indexRows,
    targetCommitSha,
  });
  fs.writeFileSync(outputPath, `${JSON.stringify(request)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.chmodSync(outputPath, 0o600);
  console.log(JSON.stringify(report));
}

void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "search_index_repair_preview_failed",
  );
  process.exitCode = 1;
});
