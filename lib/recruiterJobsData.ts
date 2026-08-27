import "server-only";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createCandidateSupabaseAdminClient } from "@/lib/candidateSupabase";

export type RecruiterJobOption = {
  id: string;
  title: string;
  clientName: string;
  location: string;
  employmentType: string;
  status: string;
  structuredRequirementsAvailable: boolean;
  requirements: unknown;
  skills: unknown;
  modules: unknown;
  sap_modules: unknown;
  primary_module: unknown;
  languages: unknown;
  years_required: unknown;
  level: unknown;
  project_types: unknown;
  requires_implementation: unknown;
  requires_ams_support: unknown;
  requires_rollout: unknown;
  requires_migration: unknown;
  requires_s4hana: unknown;
  requires_consulting: unknown;
};

export type JobsQueryClient = Pick<SupabaseClient, "from">;
const SELECT_COLUMNS = "id,title,company,location,status,requirements,skills,modules,sap_modules,primary_module,languages,years_required,level,project_types,requires_implementation,requires_ams_support,requires_rollout,requires_migration,requires_s4hana,requires_consulting,updated_at";

export function createRecruiterJobsClient() {
  return createCandidateSupabaseAdminClient();
}

function hasStructuredRequirements(row: Record<string, unknown>) {
  const values = [row.requirements,row.skills,row.modules,row.sap_modules,row.primary_module,row.languages,row.years_required,row.level,row.project_types,row.requires_implementation,row.requires_ams_support,row.requires_rollout,row.requires_migration,row.requires_s4hana,row.requires_consulting];
  return values.some((value) => Array.isArray(value) ? value.length > 0 : typeof value === "boolean" ? value : value !== null && value !== undefined && String(value).trim() !== "");
}

export function normalizeRecruiterJob(row: Record<string, unknown>): RecruiterJobOption {
  return {
    id: String(row.id ?? "").trim(), title: String(row.title ?? "").trim(), clientName: String(row.company ?? "").trim(),
    location: String(row.location ?? "").trim(), employmentType: "", status: String(row.status ?? "").trim(),
    structuredRequirementsAvailable: hasStructuredRequirements(row), requirements: row.requirements ?? [], skills: row.skills ?? [], modules: row.modules ?? [],
    sap_modules: row.sap_modules ?? [], primary_module: row.primary_module ?? "", languages: row.languages ?? [], years_required: row.years_required ?? null,
    level: row.level ?? "", project_types: row.project_types ?? [], requires_implementation: row.requires_implementation ?? false,
    requires_ams_support: row.requires_ams_support ?? false, requires_rollout: row.requires_rollout ?? false, requires_migration: row.requires_migration ?? false,
    requires_s4hana: row.requires_s4hana ?? false, requires_consulting: row.requires_consulting ?? false,
  };
}

export async function listEligibleRecruiterJobs(client: JobsQueryClient = createRecruiterJobsClient()) {
  const { data, error } = await client.from("jobs").select(SELECT_COLUMNS).eq("status", "active").order("updated_at", { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data ?? []).map((row) => normalizeRecruiterJob(row as Record<string, unknown>)).filter((job) => job.id && job.title);
}

export async function getEligibleRecruiterJob(id: string, client: JobsQueryClient = createRecruiterJobsClient()) {
  const { data, error } = await client.from("jobs").select(SELECT_COLUMNS).eq("id", id).eq("status", "active").maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data ? normalizeRecruiterJob(data as Record<string, unknown>) : null;
}
