import fs from "node:fs";
import path from "node:path";

export type SupabaseEnvDiagnostics = {
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasSupabaseServiceRoleKey: boolean;
  missing: string[];
  sources: Record<string, "process.env" | ".env.local" | "missing">;
};

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

type EnvKey = typeof KEYS[number];

function parseDotEnv(content: string) {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

export function loadCliEnv(options: { cwd?: string; envFile?: string; mutateProcessEnv?: boolean } = {}) {
  const cwd = options.cwd || process.cwd();
  const envFile = options.envFile || path.join(cwd, ".env.local");
  const fileValues = fs.existsSync(envFile) ? parseDotEnv(fs.readFileSync(envFile, "utf8")) : {};
  const sources: SupabaseEnvDiagnostics["sources"] = {} as any;

  for (const key of KEYS) {
    if (process.env[key]) sources[key] = "process.env";
    else if (fileValues[key]) {
      sources[key] = ".env.local";
      if (options.mutateProcessEnv !== false) process.env[key] = fileValues[key];
    } else sources[key] = "missing";
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || fileValues.NEXT_PUBLIC_SUPABASE_URL || fileValues.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || fileValues.NEXT_PUBLIC_SUPABASE_ANON_KEY || fileValues.SUPABASE_ANON_KEY || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileValues.SUPABASE_SERVICE_ROLE_KEY || "";
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    diagnostics: {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
      missing,
      sources,
    },
  };
}

export function printSupabaseEnvDiagnostics(diagnostics: SupabaseEnvDiagnostics) {
  console.log(`Supabase URL present: ${diagnostics.hasSupabaseUrl ? "yes" : "no"}`);
  console.log(`Supabase anon key present: ${diagnostics.hasSupabaseAnonKey ? "yes" : "no"}`);
  console.log(`Supabase service role key present: ${diagnostics.hasSupabaseServiceRoleKey ? "yes" : "no"}`);
  const sourceSummary = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map((key) => `${key}:${diagnostics.sources[key] || "missing"}`).join(", ");
  console.log(`Source: ${sourceSummary}`);
}
