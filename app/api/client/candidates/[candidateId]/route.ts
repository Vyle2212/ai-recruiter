import { normalizeActualCandidateSchema } from "@/lib/candidate360SchemaNormalize";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function requireClientCandidateDetailAuthorization(candidateId: string) {
  const auth = await createClient();
  const { data: identity, error: authError } = await auth.auth.getUser();
  if (authError || !identity.user) return { allowed: false, denial: reply({ error: "authentication_required" }, 401) };
  const { data: profile, error: profileError } = await auth.from("user_profiles")
    .select("id,role,status,client_id").eq("auth_user_id", identity.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "client" || profile.status !== "active" || !profile.client_id)
    return { allowed: false, denial: reply({ error: "active_client_required" }, 403) };
  const db = createLazySupabaseServiceClient();
  const [membership, access, entitlement] = await Promise.all([
    db.from("client_memberships").select("id").eq("user_profile_id", profile.id)
      .eq("client_id", profile.client_id).eq("status", "active").limit(1),
    db.from("client_candidate_access").select("candidate_id").eq("client_id", profile.client_id)
      .eq("candidate_id", candidateId).eq("status", "active").limit(1),
    db.from("client_feature_entitlements").select("status,valid_from,valid_until")
      .eq("client_id", profile.client_id).eq("feature", "unlimited_search").limit(1),
  ]);
  if (membership.error || access.error || entitlement.error)
    return { allowed: false, denial: reply({ error: "profile_unavailable" }, 503) };
  const feature = entitlement.data?.[0];
  const now = Date.now();
  if (!membership.data?.length || !access.data?.length || feature?.status !== "active" ||
      !Number.isFinite(Date.parse(String(feature.valid_from))) || Date.parse(String(feature.valid_from)) > now ||
      (feature.valid_until && (!Number.isFinite(Date.parse(String(feature.valid_until))) || Date.parse(String(feature.valid_until)) <= now)))
    return { allowed: false, denial: reply({ error: "profile_not_available" }, 404) };
  return { allowed: true, denial: null };
}

export async function GET(_request: Request, context: { params: Promise<{ candidateId: string }> }) {
  if (process.env.CLIENT_CANDIDATE_LOOKUP_ENABLED !== "true")
    return reply({ error: "profile_unavailable" }, 503);
  const { candidateId } = await context.params;
  if (!uuid.test(candidateId)) return reply({ error: "candidate_not_found" }, 404);
  const authorization = await requireClientCandidateDetailAuthorization(candidateId);
  if (!authorization.allowed) return authorization.denial || reply({ error: "profile_not_available" }, 404);

  const { data, error } = await createLazySupabaseServiceClient().from("candidates")
    .select("*").eq("id", candidateId).maybeSingle();
  if (error) return reply({ error: "profile_unavailable" }, 503);
  if (!data) return reply({ error: "candidate_not_found" }, 404);
  try {
    const profile = normalizeActualCandidateSchema(data).enterpriseProfile;
    return reply({
      id: candidateId,
      overview: {
        name: profile.identity.name,
        currentTitle: profile.identity.currentTitle,
        currentCompany: profile.identity.currentCompany,
        location: profile.identity.location,
      },
      experience: profile.employmentTimeline.map(item => ({
        id: item.id, company: item.company, title: item.title,
        start: item.start, end: item.end, current: item.current,
        responsibilities: item.responsibilities || [],
      })),
      projects: profile.projects.map(item => ({
        id: item.id, name: item.name, client: item.client, employer: item.employer || "",
        role: item.role, start: item.start, end: item.end,
        modules: item.modules, responsibilities: item.responsibilities,
      })),
      education: profile.education.map(item => ({
        id: item.id, qualification: item.qualification, institution: item.institution,
        fieldOfStudy: item.fieldOfStudy, startYear: item.startYear, endYear: item.endYear,
      })),
      skills: profile.technicalSkills,
      sapModules: profile.sapModules,
    });
  } catch {
    return reply({ error: "profile_unavailable" }, 503);
  }
}
