import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import ClientRecruiterSharing from "./ClientRecruiterSharing";

export const dynamic = "force-dynamic";

const featureLabels: Record<string, string> = {
  unlimited_search: "Search V2",
  unlimited_job_posts: "Job posting",
  candidate_comparison: "Compare Pack",
  recruiter_support: "Recruiter support",
  candidate_chat: "Candidate chat",
  ats: "ATS",
};
const card = "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

export default async function ClientPortalPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = (await searchParams).page || "1";
  const page = /^[1-9]\d{0,5}$/.test(requestedPage) ? Math.min(Number(requestedPage), 100000) : 1;
  const auth = await createClient();
  const { data: user, error: authError } = await auth.auth.getUser();
  if (authError || !user.user) redirect("/auth/login?next=%2Fclient%2Fportal");
  const { data: profile, error: profileError } = await auth
    .from("user_profiles")
    .select("id,role,status,client_id")
    .eq("auth_user_id", user.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== "client" || profile.status !== "active" || !profile.client_id)
    redirect("/portal");

  const db = createLazySupabaseServiceClient();
  const membership = await db.from("client_memberships")
    .select("id").eq("user_profile_id", profile.id)
    .eq("client_id", profile.client_id).eq("status", "active").limit(1);
  if (membership.error || membership.data?.length !== 1)
    return <main className="min-h-screen bg-[#05070A] px-6 py-16 text-slate-100"><div className="mx-auto max-w-4xl rounded-2xl border border-amber-500/30 p-8"><h1 className="text-3xl font-semibold">Client Portal</h1><p className="mt-4 text-slate-300">Your client membership is not active or cannot be verified. Contact the platform administrator.</p></div></main>;

  const [candidates, jobs, recruiters, entitlements] = await Promise.all([
    db.from("client_candidate_access").select("candidate_id", { count: "exact", head: true }).eq("client_id", profile.client_id).eq("status", "active"),
    db.from("client_job_ownership").select("job_id", { count: "exact", head: true }).eq("client_id", profile.client_id).eq("status", "active"),
    db.from("client_recruiter_assignments").select("id", { count: "exact", head: true }).eq("client_id", profile.client_id).eq("status", "active"),
    db.from("client_feature_entitlements").select("feature,status,valid_from,valid_until,plan_code").eq("client_id", profile.client_id),
  ]);
  const available = !candidates.error && !jobs.error && !recruiters.error && !entitlements.error;
  const now = Date.now();
  const features = available ? (entitlements.data || []).filter(item =>
    item.status === "active" &&
    Number.isFinite(Date.parse(String(item.valid_from))) &&
    Date.parse(String(item.valid_from)) <= now &&
    (!item.valid_until || (Number.isFinite(Date.parse(String(item.valid_until))) && Date.parse(String(item.valid_until)) > now))
  ) : [];
  const plan = features[0]?.plan_code || "No active plan";
  const recruiterSupport = features.some(item => item.feature === "recruiter_support");
  let sharing: React.ReactNode = null;
  if (available && recruiterSupport) {
    const [access, assignments] = await Promise.all([
      db.from("client_candidate_access").select("candidate_id")
        .eq("client_id", profile.client_id).eq("status", "active")
        .order("created_at", { ascending: false }).order("candidate_id", { ascending: true })
        .range((page - 1) * 20, page * 20 - 1),
      db.from("client_recruiter_assignments").select("recruiter_profile_id")
        .eq("client_id", profile.client_id).eq("status", "active").limit(50),
    ]);
    if (access.error || assignments.error) {
      sharing = <p className="text-amber-200">Recruiter sharing is temporarily unavailable.</p>;
    } else {
      const candidateIds = (access.data || []).map(row => row.candidate_id);
      const recruiterIds = (assignments.data || []).map(row => row.recruiter_profile_id);
      const [candidateRows, recruiterRows, shareRows] = await Promise.all([
        candidateIds.length ? db.from("candidates").select("id,name,current_title").in("id", candidateIds) : Promise.resolve({ data: [], error: null }),
        recruiterIds.length ? db.from("user_profiles").select("id,full_name,email,role,status").in("id", recruiterIds).eq("role", "recruiter").eq("status", "active") : Promise.resolve({ data: [], error: null }),
        candidateIds.length ? db.from("client_candidate_shares").select("candidate_id,recruiter_profile_id,status")
          .eq("client_id", profile.client_id).in("candidate_id", candidateIds) : Promise.resolve({ data: [], error: null }),
      ]);
      sharing = candidateRows.error || recruiterRows.error || shareRows.error
        ? <p className="text-amber-200">Recruiter sharing is temporarily unavailable.</p>
        : <ClientRecruiterSharing
            candidates={(candidateRows.data || []).map(row => ({ id: row.id, name: row.name || "Candidate", title: row.current_title || "" }))}
            recruiters={(recruiterRows.data || []).map(row => ({ id: row.id, name: row.full_name || row.email || "Recruiter" }))}
            shares={(shareRows.data || []).filter(row => row.status === "active").map(row => ({ candidateId: row.candidate_id, recruiterId: row.recruiter_profile_id }))}
            totalCandidates={candidates.count || 0}
            page={page}
          />;
    }
  }

  return <main className="min-h-screen bg-[#05070A] text-slate-100">
    <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Client workspace</p><h1 className="mt-3 text-4xl font-semibold">Client Portal</h1><p className="mt-2 text-slate-400">Your jobs, candidate access and subscription features.</p></div></header>
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      {!available && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-amber-100">The client workspace data is unavailable. No candidate or subscription access is assumed.</section>}
      <section aria-label="Client overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Visible candidates", candidates.count], ["Owned jobs", jobs.count], ["Assigned recruiters", recruiters.count], ["Subscription", plan]].map(([label, value]) =>
          <article className={card} key={String(label)}><h2 className="text-sm text-slate-400">{label}</h2><p className="mt-3 text-2xl font-semibold">{available ? value ?? 0 : "Unavailable"}</p></article>)}
      </section>
      <section className={card}><h2 className="text-xl font-semibold">Features in your plan</h2>
        {features.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{features.map(item => <li className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-cyan-100" key={item.feature}>{featureLabels[item.feature] || item.feature}</li>)}</ul> : <p className="mt-3 text-slate-400">No active feature entitlement is available for this workspace.</p>}
        <p className="mt-4 text-sm text-slate-500">A listed entitlement does not grant access to a feature until its workspace is released.</p>
      </section>
      <section className={card}><h2 className="text-xl font-semibold">Your workspace</h2><p className="mt-3 text-slate-400">{available && (candidates.count || 0) === 0 && (jobs.count || 0) === 0 ? "No candidates or jobs have been assigned to your account yet." : "Only candidates and jobs explicitly assigned to your client account can appear here."}</p><p className="mt-3 text-sm text-slate-500">Search, Shortlist, Compare Pack, feedback and recruiter sharing will appear here as each authenticated flow passes acceptance testing.</p></section>
      {recruiterSupport && <section className={card}><h2 className="text-xl font-semibold">Share candidates with your recruiter</h2><p className="mt-2 text-sm text-slate-400">Only candidates visible to your account can be shared with an assigned recruiter. Opening an original CV requires separate admin approval.</p><div className="mt-5">{sharing}</div></section>}
    </div>
  </main>;
}
