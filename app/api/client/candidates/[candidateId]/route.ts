import { normalizeActualCandidateSchema } from "@/lib/candidate360SchemaNormalize";
import { authorizeClientCandidateLookup, clientLookupReply as reply } from "@/lib/clientCandidateLookupAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ candidateId: string }> }) {
  if (process.env.CLIENT_CANDIDATE_LOOKUP_ENABLED !== "true")
    return reply({ error: "profile_unavailable" }, 503);
  const { candidateId } = await context.params;
  if (!uuid.test(candidateId)) return reply({ error: "candidate_not_found" }, 404);
  const authorization = await authorizeClientCandidateLookup();
  if (authorization.denial || !authorization.clientId)
    return authorization.denial || reply({ error: "profile_not_available" }, 404);
  const db = createLazySupabaseServiceClient();
  const { data: access, error: accessError } = await db.from("client_candidate_access")
    .select("candidate_id").eq("client_id", authorization.clientId)
    .eq("candidate_id", candidateId).eq("status", "active").limit(1);
  if (accessError) return reply({ error: "profile_unavailable" }, 503);
  if (!access?.length) return reply({ error: "profile_not_available" }, 404);

  const { data, error } = await db.from("candidates")
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
