import "server-only";
import { createClient as createAuthClient } from "@/utils/supabase/server";
import { isStagingPortalGuardEnabled } from "@/utils/supabase/proxy";

export type RecruiterJobsAuthorization =
  | { allowed: true; mode: "local_preview" | "authenticated_recruiter"; actor: { id: string | null; role: string; label: string } }
  | { allowed: false; status: 401 | 403; code: string };

export async function authorizeRecruiterJobsRead(): Promise<RecruiterJobsAuthorization> {
  if (!isStagingPortalGuardEnabled()) return { allowed: true, mode: "local_preview", actor: { id: null, role: "local_preview", label: "Local preview recruiter" } };
  const auth = await createAuthClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { allowed: false, status: 401, code: "authentication_required" };
  const { data: profile, error: profileError } = await auth.from("user_profiles").select("id,role,status,full_name").eq("auth_user_id", user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active") return { allowed: false, status: 403, code: "active_recruiter_profile_required" };
  if (!["admin", "recruiter_manager", "recruiter"].includes(String(profile.role))) return { allowed: false, status: 403, code: "recruiter_role_required" };
  return { allowed: true, mode: "authenticated_recruiter", actor: { id: String(profile.id), role: String(profile.role), label: String(profile.full_name || user.email || "Recruiter") } };
}
