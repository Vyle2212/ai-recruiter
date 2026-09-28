import Link from "next/link";
import { redirect } from "next/navigation";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";
import RecruiterAdminChat from "./RecruiterAdminChat";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const card = "rounded-xl border border-slate-800 bg-[#0B0F16] p-5";
type SharedCandidate = { share_id: string; candidate_name: string | null; current_title: string | null; shared_at: string };
type SharedJob = { share_id: string; job_title: string | null; company: string | null; shared_at: string };

function cursor(date: string | undefined, id: string | undefined) {
  if (!date && !id) return { date: null, id: null };
  if (!date || !id || !uuid.test(id) || !Number.isFinite(Date.parse(date)) || date.length > 40) return null;
  return { date, id };
}

export default async function RecruiterAssignedWork({ searchParams }: {
  searchParams: Promise<{ candidateBefore?: string; candidateId?: string; jobBefore?: string; jobId?: string }>;
}) {
  const auth = await createClient();
  const { data: identity, error: authError } = await auth.auth.getUser();
  if (authError || !identity.user) redirect("/auth/login?next=%2Frecruiter%2Fassigned-work");
  const { data: profile, error: profileError } = await auth.from("user_profiles")
    .select("id,role,status,organization_id").eq("auth_user_id", identity.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "recruiter" || profile.status !== "active") redirect("/portal");

  const params = await searchParams;
  const candidateCursor = cursor(params.candidateBefore, params.candidateId);
  const jobCursor = cursor(params.jobBefore, params.jobId);
  if (!candidateCursor || !jobCursor) redirect("/recruiter/assigned-work");
  const enabled = process.env.RECRUITER_SHARED_WORK_ENABLED === "true";
  if (!enabled) return <main className="min-h-screen bg-[#05070A] p-8 text-slate-100"><div className="mx-auto max-w-5xl"><h1 className="text-3xl font-semibold">Assigned Work</h1><p className="mt-4 text-slate-400">Client sharing is not available in this environment yet.</p></div></main>;

  const db = createLazySupabaseServiceClient();
  const [candidateResult, jobResult, adminResult] = await Promise.all([
    db.rpc("recruiter_shared_candidates", {
      p_recruiter_profile_id: profile.id, p_before: candidateCursor.date,
      p_before_id: candidateCursor.id, p_limit: 21,
    }),
    db.rpc("recruiter_shared_jobs", {
      p_recruiter_profile_id: profile.id, p_before: jobCursor.date,
      p_before_id: jobCursor.id, p_limit: 21,
    }),
    process.env.CHAT_ENABLED === "true" && profile.organization_id
      ? db.from("user_profiles").select("id,full_name")
        .eq("organization_id", profile.organization_id).eq("role", "admin")
        .eq("status", "active").order("id", { ascending: true }).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const unavailable = !!candidateResult.error || !!jobResult.error;
  const candidateRows: SharedCandidate[] = unavailable ? [] : (candidateResult.data || []).slice(0, 20);
  const jobRows: SharedJob[] = unavailable ? [] : (jobResult.data || []).slice(0, 20);
  const next = (kind: "candidate" | "job") => {
    const rows = kind === "candidate" ? candidateRows : jobRows;
    const hasMore = (kind === "candidate" ? candidateResult.data : jobResult.data)?.length === 21;
    if (!hasMore || !rows.length) return null;
    const last = rows.at(-1);
    if (!last) return null;
    const query = new URLSearchParams();
    if (kind === "candidate") {
      query.set("candidateBefore", last.shared_at); query.set("candidateId", last.share_id);
      if (jobCursor.date && jobCursor.id) { query.set("jobBefore", jobCursor.date); query.set("jobId", jobCursor.id); }
    } else {
      query.set("jobBefore", last.shared_at); query.set("jobId", last.share_id);
      if (candidateCursor.date && candidateCursor.id) { query.set("candidateBefore", candidateCursor.date); query.set("candidateId", candidateCursor.id); }
    }
    return `/recruiter/assigned-work?${query}`;
  };

  return <main className="min-h-screen bg-[#05070A] px-6 py-10 text-slate-100"><div className="mx-auto max-w-5xl space-y-8">
    <header><h1 className="text-3xl font-semibold">Assigned Work</h1><p className="mt-2 text-slate-400">Active jobs and candidates shared by clients you support.</p></header>
    {process.env.CHAT_ENABLED === "true" && !adminResult.error && !!adminResult.data?.length &&
      <RecruiterAdminChat admins={adminResult.data.map(admin => ({ id: admin.id, name: admin.full_name || "Admin" }))} />}
    {unavailable && <p role="alert" className="rounded-xl border border-amber-500/30 p-5 text-amber-200">Assigned work is unavailable. No client access is assumed.</p>}
    {!unavailable && <>
      <section><h2 className="mb-4 text-xl font-semibold">Shared candidates</h2><div className="space-y-3">{candidateRows.map(row => <article key={row.share_id} className={card}><h3 className="font-medium">{row.candidate_name || "Candidate"}</h3><p className="mt-1 text-sm text-slate-400">{row.current_title || "Title not provided"}</p></article>)}{!candidateRows.length && <p className="text-slate-400">No active candidate shares.</p>}</div>{next("candidate") && <Link className="mt-4 inline-block text-cyan-200 underline" href={next("candidate")!}>More candidates</Link>}</section>
      <section><h2 className="mb-4 text-xl font-semibold">Shared jobs</h2><div className="space-y-3">{jobRows.map(row => <article key={row.share_id} className={card}><h3 className="font-medium">{row.job_title || "Job"}</h3><p className="mt-1 text-sm text-slate-400">{row.company || "Company not provided"}</p></article>)}{!jobRows.length && <p className="text-slate-400">No active job shares.</p>}</div>{next("job") && <Link className="mt-4 inline-block text-cyan-200 underline" href={next("job")!}>More jobs</Link>}</section>
      <p className="text-sm text-slate-500">A client share does not grant original CV access. Request it separately for admin approval.</p>
    </>}
  </div></main>;
}
