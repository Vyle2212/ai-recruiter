"use client";

import { useEffect, useMemo, useState } from "react";

type Row = Record<string, any>;
type Tone = "green" | "amber" | "red" | "blue" | "slate";

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function text(value: any, fallback = "Unknown") {
  const out = String(value || "").trim();
  return out || fallback;
}

function normalizeModule(value: any) {
  const raw = String(value || "SAP").toUpperCase().replace(/^SAP\s+/, "").replace(/[\s/_-]/g, "");
  if (raw === "SUCCESSFACTORS" || raw === "SF") return "SuccessFactors";
  if (raw === "S4HANA") return "S/4HANA";
  return raw || "SAP";
}

function jobModule(job: Row) {
  return normalizeModule(job.primary_module || job.primaryModule || job.required_primary_module || job.requiredModule || job.title);
}

function candidateModule(candidate: Row) {
  return normalizeModule(candidate.primary_module || candidate.primaryModule || candidate.module);
}

function score(candidate: Row) {
  return n(candidate.score ?? candidate.matchScore ?? candidate.finalScore ?? candidate.profile_quality_score ?? candidate.quality_score ?? candidate.recruiter_priority_score);
}

function candidateName(candidate: Row) {
  return text(candidate.name || candidate.candidate_name, "Unknown Candidate");
}

function candidateCompany(candidate: Row) {
  return text(candidate.current_company || candidate.company || candidate.display_company, "Unknown Company");
}

function lastTouch(candidate: Row) {
  const value = candidate.last_contacted_at || candidate.lastContactedAt || candidate.updated_at || candidate.created_at;
  const time = value ? new Date(value).getTime() : 0;
  if (!time || Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function noticeUnknown(candidate: Row) {
  return !candidate.notice_period && !candidate.noticePeriod && !candidate.notice;
}

function salaryUnknown(candidate: Row) {
  return !candidate.expected_salary && !candidate.expectedSalary && !candidate.salary_expectation && !candidate.salary;
}

function status(candidate: Row) {
  return String(candidate.stage || candidate.status || "").toLowerCase();
}

function isSubmitted(candidate: Row) {
  return /submitted|submission/.test(status(candidate)) || candidate.submitted || candidate.is_submitted;
}

function isInterview(candidate: Row) {
  return /interview/.test(status(candidate)) || candidate.interviewed || candidate.is_interviewed;
}

function isOffer(candidate: Row) {
  return /offer/.test(status(candidate)) || candidate.offered || candidate.offer;
}

function isPlaced(candidate: Row) {
  return /hired|placed|accepted/.test(status(candidate)) || candidate.hired || candidate.placed || candidate.accepted;
}

function toneClass(tone: Tone) {
  if (tone === "green") return "bg-emerald-500/12 text-emerald-200 ring-emerald-500/20";
  if (tone === "amber") return "bg-amber-500/12 text-amber-200 ring-amber-500/20";
  if (tone === "red") return "bg-red-500/12 text-red-200 ring-red-500/20";
  if (tone === "blue") return "bg-cyan-500/12 text-cyan-200 ring-cyan-500/20";
  return "bg-slate-500/12 text-slate-300 ring-slate-700/35";
}

function healthTone(value: string): Tone {
  if (value === "Healthy") return "green";
  if (value === "Warning") return "amber";
  return "red";
}

function Kpi({ label, value, tone = "slate", note }: { label: string; value: string; tone?: Tone; note?: string }) {
  return (
    <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {note ? <div className="mt-2 text-xs leading-5 text-slate-400">{note}</div> : null}
      <span className={"mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 " + toneClass(tone)}>{tone}</span>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-[#0b1118] p-5 ring-1 ring-slate-800/45">
      <div className="mb-4">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function DailyCopilotPage() {
  const [jobs, setJobs] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [shortlists, setShortlists] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [jobsRes, candidatesRes, shortlistsRes] = await Promise.all([
          fetch("/api/jobs", { cache: "no-store" }),
          fetch("/api/candidates", { cache: "no-store" }),
          fetch("/api/shortlists?includeCandidates=true&limit=200", { cache: "no-store" }),
        ]);
        const jobsJson = await jobsRes.json();
        const candidatesJson = await candidatesRes.json();
        const shortlistsJson = await shortlistsRes.json().catch(() => ({}));
        setJobs(Array.isArray(jobsJson) ? jobsJson : jobsJson.jobs || []);
        setCandidates(Array.isArray(candidatesJson) ? candidatesJson : candidatesJson.data || candidatesJson.candidates || []);
        setShortlists(shortlistsJson.shortlists || []);
      } catch {
        setJobs([]);
        setCandidates([]);
        setShortlists([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const brief = useMemo(() => {
    const activeJobs = jobs.filter((job) => !/closed|filled|cancelled/i.test(String(job.status || "active")));
    const submitted = candidates.filter(isSubmitted);
    const interviewed = candidates.filter(isInterview);
    const offers = candidates.filter(isOffer);
    const placements = candidates.filter(isPlaced);
    const cold = candidates
      .map((candidate) => ({ candidate, days: lastTouch(candidate) }))
      .filter((row): row is { candidate: Row; days: number } => row.days !== null && row.days >= 3)
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);
    const strong = candidates.filter((candidate) => score(candidate) >= 75);
    const highQuality = strong.slice().sort((a, b) => score(b) - score(a)).slice(0, 8);
    const jobsHealth = activeJobs.slice(0, 8).map((job) => {
      const module = jobModule(job);
      const pool = candidates.filter((candidate) => candidateModule(candidate) === module || JSON.stringify(candidate).toUpperCase().includes(module));
      const strongPool = pool.filter((candidate) => score(candidate) >= 75);
      const unknownSalary = pool.filter(salaryUnknown).length;
      const unknownNotice = pool.filter(noticeUnknown).length;
      const health = strongPool.length >= 5 ? "Healthy" : strongPool.length >= 2 ? "Warning" : "Critical";
      const reason = strongPool.length < 2 ? `Only ${strongPool.length} strong candidates.` : unknownSalary || unknownNotice ? "Validation gaps remain before submission." : "Pipeline supports recruiter action.";
      return { job, module, pool: pool.length, strong: strongPool.length, health, reason };
    });
    const followUps = highQuality.slice(0, 6).map((candidate, index) => {
      const risk = salaryUnknown(candidate) || noticeUnknown(candidate) ? "Validation risk" : lastTouch(candidate) && lastTouch(candidate)! >= 7 ? "Interest cooling" : "Competing attention";
      return { candidate, reason: index === 0 ? "Top profile needs same-day movement" : "High-quality candidate requires recruiter touch", deadline: index < 2 ? "Today" : "48 hours", risk };
    });
    const jobsAtRisk = jobsHealth.filter((job) => job.health !== "Healthy").slice(0, 5);
    const offerWatch = (offers.length ? offers : highQuality.slice(0, 4)).map((candidate) => {
      const risk = salaryUnknown(candidate) ? "Package Unknown" : noticeUnknown(candidate) ? "Notice Unknown" : "Counter-offer possible";
      const probability = score(candidate) >= 82 ? "High" : score(candidate) >= 65 ? "Medium" : "Unknown";
      return { candidate, risk, probability, urgency: risk === "Package Unknown" ? "Today" : "24-48 hours" };
    });
    const yesterday = {
      submissions: submitted.filter((candidate) => lastTouch(candidate) !== null && lastTouch(candidate)! <= 1).length,
      interviews: interviewed.filter((candidate) => lastTouch(candidate) !== null && lastTouch(candidate)! <= 1).length,
      offers: offers.filter((candidate) => lastTouch(candidate) !== null && lastTouch(candidate)! <= 1).length,
      responseRate: candidates.length ? Math.round((candidates.filter((candidate) => lastTouch(candidate) !== null && lastTouch(candidate)! <= 7).length / candidates.length) * 100) + "%" : "Unknown",
      engagement: cold.length >= 8 ? "Weak" : cold.length >= 3 ? "Watch" : "Healthy",
    };
    const priorities = [
      highQuality[0] ? `Interview ${candidateName(highQuality[0])} for SAP ${candidateModule(highQuality[0])}.` : "Generate matches for the highest priority job.",
      followUps[0] ? `Follow up ${candidateName(followUps[0].candidate)} before ${followUps[0].deadline.toLowerCase()} ends.` : "Create a high-priority follow-up list.",
      jobsAtRisk[0] ? `Rebuild ${jobsAtRisk[0].module} pipeline; ${jobsAtRisk[0].reason}` : "Move strong profiles into submissions.",
      offerWatch[0] ? `Call ${candidateName(offerWatch[0].candidate)} before offer risk increases.` : "Confirm offer watchlist status.",
      shortlists[0] ? `Review shortlist ${text(shortlists[0].name, "current shortlist")} for client readiness.` : "Create today’s client-ready shortlist.",
    ];
    const recommendations = [
      highQuality[0] ? `Interview ${candidateName(highQuality[0])} today.` : "Generate a top-candidate slate today.",
      jobsAtRisk[0] ? `Add sourcing for SAP ${jobsAtRisk[0].module}; pipeline is ${jobsAtRisk[0].health.toLowerCase()}.` : "Protect healthy jobs by moving candidates faster.",
      cold[0] ? `Re-engage ${candidateName(cold[0].candidate)}; no touch for ${cold[0].days} days.` : "No cold-candidate risk detected from available timestamps.",
      candidates.some(salaryUnknown) ? "Run salary benchmark before client submission." : "Use current salary data to position offers.",
      candidates.some(noticeUnknown) ? "Confirm notice period on all shortlisted profiles." : "Package candidates with confirmed notice first.",
    ];
    const marketSignals = [
      candidates.filter((candidate) => candidateModule(candidate) === "BTP").length < 5 ? "SAP BTP scarcity requires proactive sourcing." : "SAP BTP supply appears workable in current pool.",
      candidates.some(salaryUnknown) ? "Salary movement is Unknown; package fields are incomplete." : "Salary movement can be benchmarked from available package data.",
      jobsAtRisk.length ? `${jobsAtRisk.length} job(s) show pipeline risk.` : "No critical job risk from current visible data.",
      "Competition remains Unknown without competitor activity feed.",
    ];
    return { activeJobs, submitted, interviewed, offers, placements, cold, jobsHealth, followUps, jobsAtRisk, offerWatch, priorities, recommendations, marketSignals, yesterday };
  }, [jobs, candidates, shortlists]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  return (
    <main className="min-h-screen bg-[#080d12] p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-[28px] bg-gradient-to-br from-[#111820] via-[#0d141c] to-[#091018] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 ring-slate-800/45">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Good Morning</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Today&apos;s Executive Brief</h1>
              <p className="mt-3 text-sm text-slate-400">{today} · Recruiter: Executive Search Team · {loading ? "Loading live pipeline" : "Live morning briefing"}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Kpi label="Active Jobs" value={String(brief.activeJobs.length)} tone="blue" />
              <Kpi label="Strong Candidates" value={String(candidates.filter((candidate) => score(candidate) >= 75).length)} tone="green" />
              <Kpi label="Cold Risks" value={String(brief.cold.length)} tone={brief.cold.length ? "amber" : "green"} />
            </div>
          </div>
        </header>

        <Section title="1. Today's Priorities" subtitle="Top five actions that matter today.">
          <div className="grid gap-2 md:grid-cols-5">{brief.priorities.map((item, index) => <div key={item} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="text-xs font-black text-cyan-300">#{index + 1}</div><div className="mt-2 text-sm font-semibold leading-6 text-slate-100">{item}</div></div>)}</div>
        </Section>

        <Section title="2. Pipeline Health" subtitle="Per-job health and failure risk.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(brief.jobsHealth.length ? brief.jobsHealth : [{ module: "Unknown", health: "Critical", reason: "No active jobs available.", pool: 0, strong: 0 }]).map((job: any) => <div key={`${job.module}-${job.reason}`} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="flex items-center justify-between"><div className="font-black">SAP {job.module}</div><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 " + toneClass(healthTone(job.health))}>{job.health}</span></div><div className="mt-3 text-sm text-slate-300">{job.reason}</div><div className="mt-3 text-xs text-slate-500">Pipeline {job.pool} · Strong {job.strong}</div></div>)}</div>
        </Section>

        <Section title="3. Candidates Becoming Cold" subtitle="No contact signals at 3, 7 and 14 days.">
          <div className="grid gap-3 md:grid-cols-3">{[3, 7, 14].map((days) => <div key={days} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="text-lg font-black">{days}+ days</div><div className="mt-3 space-y-2">{brief.cold.filter((row) => row.days >= days).slice(0, 4).map((row) => <div key={`${days}-${candidateName(row.candidate)}`} className="rounded-xl bg-[#0b1118] px-3 py-2 text-xs"><b>{candidateName(row.candidate)}</b><div className="text-slate-500">Likely losing interest · {row.days} days</div></div>)}{!brief.cold.some((row) => row.days >= days) ? <div className="text-sm text-slate-500">Unknown or no cold candidates.</div> : null}</div></div>)}</div>
        </Section>

        <Section title="4. High Priority Follow-ups" subtitle="Candidate-level follow-ups with deadline and risk.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{brief.followUps.map((row) => <div key={candidateName(row.candidate)} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="font-black">{candidateName(row.candidate)}</div><div className="mt-2 text-sm text-slate-300">{row.reason}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div>Deadline: <b>{row.deadline}</b></div><div>Risk: <b>{row.risk}</b></div></div></div>)}</div>
        </Section>

        <Section title="5. Jobs At Risk" subtitle="Predicted job failures and why.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{(brief.jobsAtRisk.length ? brief.jobsAtRisk : [{ module: "None", reason: "No at-risk jobs from available data.", health: "Healthy" }]).map((row: any) => <div key={row.module} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="font-black">SAP {row.module}</div><div className="mt-2 text-sm text-slate-300">{row.reason}</div><div className="mt-3 text-xs text-amber-200">Action: add sourcing or validate shortlist today.</div></div>)}</div>
        </Section>

        <Section title="6. Offer Watch" subtitle="Pending offer risk and urgency.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{brief.offerWatch.map((row) => <div key={candidateName(row.candidate)} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="font-black">{candidateName(row.candidate)}</div><div className="mt-2 text-sm text-slate-300">Risk: {row.risk}</div><div className="mt-2 text-sm text-slate-300">Acceptance: {row.probability}</div><div className="mt-3 text-xs text-cyan-100">Urgency: {row.urgency}</div></div>)}</div>
        </Section>

        <Section title="7. AI Recommendations" subtitle="Director-level actions from today’s signals.">
          <div className="grid gap-2 md:grid-cols-5">{brief.recommendations.map((item) => <div key={item} className="rounded-2xl bg-cyan-950/15 p-4 text-sm font-semibold leading-6 text-cyan-50 ring-1 ring-cyan-500/20">{item}</div>)}</div>
        </Section>

        <Section title="8. Market Signals" subtitle="Hiring trend, salary movement, scarcity and competition.">
          <div className="grid gap-3 md:grid-cols-4">{brief.marketSignals.map((item) => <div key={item} className="rounded-2xl bg-[#0f151d] p-4 text-sm font-semibold leading-6 text-slate-100 ring-1 ring-slate-800/55">{item}</div>)}</div>
        </Section>

        <Section title="9. Productivity Summary" subtitle="Yesterday’s visible activity.">
          <div className="grid gap-3 md:grid-cols-5"><Kpi label="Submissions" value={String(brief.yesterday.submissions)} /><Kpi label="Interviews" value={String(brief.yesterday.interviews)} /><Kpi label="Offers" value={String(brief.yesterday.offers)} /><Kpi label="Response Rate" value={brief.yesterday.responseRate} /><Kpi label="Engagement" value={brief.yesterday.engagement} /></div>
        </Section>

        <Section title="10. One-click Actions" subtitle="Execution shortcuts for today.">
          <div className="flex flex-wrap gap-3">{["Call Candidate", "Generate Submission", "Compare Candidates", "Schedule Interview", "Send Follow-up", "Generate LinkedIn Message"].map((item) => <button key={item} type="button" className="rounded-full bg-[#0f151d] px-4 py-2 text-sm font-bold text-white ring-1 ring-slate-700/60 transition hover:ring-cyan-500/40">{item}</button>)}</div>
        </Section>
      </div>
    </main>
  );
}
