"use client";

import { useEffect, useMemo, useState } from "react";

type AnyRecord = Record<string, any>;

type DashboardCounts = {
  totalCandidates?: number;
  totalFavorites?: number;
  totalShortlisted?: number;
};

const MODULES = ["BTP", "FICO", "SD", "MM", "ABAP", "BASIS", "EWM", "TM", "FI", "CO", "PP", "SuccessFactors"];

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pct(value: number) {
  if (!Number.isFinite(value)) return "Unknown";
  return String(Math.max(0, Math.min(100, Math.round(value)))) + "%";
}

function clean(value: any, fallback = "Unknown") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeModule(value: any) {
  const raw = String(value || "UNKNOWN").toUpperCase().replace(/^SAP\s+/, "").replace(/[\s/_-]/g, "");
  if (raw === "SUCCESSFACTORS" || raw === "SF") return "SuccessFactors";
  if (raw === "S4HANA") return "S/4HANA";
  return raw || "UNKNOWN";
}

function candidateModule(candidate: AnyRecord) {
  return normalizeModule(candidate.primary_module || candidate.primaryModule || candidate.module || candidate.requiredModule);
}

function candidateScore(candidate: AnyRecord) {
  return n(candidate.score ?? candidate.matchScore ?? candidate.finalScore ?? candidate.profile_quality_score ?? candidate.quality_score ?? candidate.recruiter_priority_score);
}

function hasContact(candidate: AnyRecord) {
  return Boolean(candidate.email || candidate.phone || candidate.contactable || candidate.email_masked || candidate.phone_masked);
}

function isSubmitted(candidate: AnyRecord) {
  return Boolean(candidate.submitted || candidate.is_submitted || candidate.status === "submitted" || candidate.stage === "submitted");
}

function isInterviewed(candidate: AnyRecord) {
  return Boolean(candidate.interviewed || candidate.is_interviewed || candidate.status === "interviewed" || candidate.stage === "interviewed");
}

function isOffered(candidate: AnyRecord) {
  return Boolean(candidate.offered || candidate.offer || candidate.status === "offered" || candidate.stage === "offered");
}

function isAccepted(candidate: AnyRecord) {
  return Boolean(candidate.accepted || candidate.hired || candidate.status === "hired" || candidate.stage === "hired" || candidate.stage === "accepted");
}

function salarySignal(candidate: AnyRecord) {
  return n(candidate.expected_salary ?? candidate.expectedSalary ?? candidate.salary_expectation ?? candidate.salary ?? candidate.current_salary);
}

function noticeDays(candidate: AnyRecord) {
  const raw = String(candidate.notice_period || candidate.noticePeriod || candidate.notice || "").toLowerCase();
  const days = raw.match(/(\d+)\s*day/);
  if (days) return n(days[1]);
  const months = raw.match(/(\d+)\s*month/);
  if (months) return n(months[1]) * 30;
  if (raw.includes("immediate")) return 0;
  return null;
}

function trendLabel(value: number, high: string, medium: string, low: string) {
  if (value >= 70) return high;
  if (value >= 40) return medium;
  return low;
}

function KpiCard({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: "neutral" | "green" | "amber" | "blue" }) {
  const toneClass = tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "blue" ? "text-cyan-300" : "text-white";
  return (
    <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={"mt-2 text-3xl font-black " + toneClass}>{value}</div>
      {note ? <div className="mt-2 text-xs leading-5 text-slate-400">{note}</div> : null}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-[#0b1118] p-5 ring-1 ring-slate-800/45">
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Bar({ value, label }: { value: number; label?: string }) {
  const width = Math.max(3, Math.min(100, Math.round(value || 0)));
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-300 transition-all duration-500" style={{ width: width + "%" }} />
      </div>
      {label ? <div className="mt-1 text-xs text-slate-500">{label}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [candidates, setCandidates] = useState<AnyRecord[]>([]);
  const [counts, setCounts] = useState<DashboardCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [candidateRes, dashboardRes] = await Promise.all([fetch("/api/candidates", { cache: "no-store" }), fetch("/api/dashboard", { cache: "no-store" })]);
        const candidateJson = await candidateRes.json();
        const dashboardJson = await dashboardRes.json();
        setCandidates(Array.isArray(candidateJson) ? candidateJson : candidateJson.data || candidateJson.candidates || []);
        setCounts(dashboardJson || {});
      } catch {
        setCandidates([]);
        setCounts({});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const intelligence = useMemo(() => {
    const total = counts.totalCandidates || candidates.length;
    const submitted = candidates.filter(isSubmitted).length || counts.totalShortlisted || 0;
    const interviewed = candidates.filter(isInterviewed).length;
    const offered = candidates.filter(isOffered).length;
    const accepted = candidates.filter(isAccepted).length;
    const qualityScores = candidates.map(candidateScore).filter(Boolean);
    const avgQuality = qualityScores.length ? Math.round(qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length) : 0;
    const contactable = candidates.filter(hasContact).length;
    const salaryValues = candidates.map(salarySignal).filter(Boolean);
    const notices = candidates.map(noticeDays).filter((value): value is number => value !== null);
    const avgNotice = notices.length ? Math.round(notices.reduce((sum, value) => sum + value, 0) / notices.length) : null;
    const interviewRate = submitted ? (interviewed / submitted) * 100 : 0;
    const submissionRate = total ? (submitted / total) * 100 : 0;
    const offerRate = interviewed ? (offered / interviewed) * 100 : 0;
    const acceptanceRate = offered ? (accepted / offered) * 100 : 0;
    const dropOffRate = submitted ? ((submitted - accepted) / submitted) * 100 : 0;
    const timeToFill = avgQuality >= 80 && contactable / Math.max(total, 1) > 0.55 ? "28-38 days" : avgQuality >= 65 ? "38-52 days" : "52+ days";
    const scarcity = total < 30 ? 82 : total < 80 ? 64 : 42;
    const moduleRows = MODULES.map((module) => {
      const pool = candidates.filter((candidate) => candidateModule(candidate) === normalizeModule(module));
      const avg = pool.length ? Math.round(pool.map(candidateScore).reduce((sum, value) => sum + value, 0) / pool.length) : 0;
      const shortage = pool.length <= 2 ? "High" : pool.length <= 6 ? "Medium" : "Low";
      const velocity = avg >= 78 ? "Fast" : avg >= 60 ? "Moderate" : pool.length ? "Slow" : "Blocked";
      const competition = module === "BTP" || module === "EWM" || module === "TM" ? "High" : shortage === "High" ? "High" : "Moderate";
      return { module, pool: pool.length, avg, shortage, velocity, competition };
    });
    const weakModules = moduleRows.filter((row) => row.shortage === "High").slice(0, 4);
    const expectedOffers = Math.max(0, Math.round(interviewed * Math.max(offerRate, 18) / 100));
    const expectedPlacements = Math.max(0, Math.round(expectedOffers * Math.max(acceptanceRate, 35) / 100));
    const nextHealth = avgQuality >= 75 && submissionRate >= 20 ? "Improving" : weakModules.length >= 3 ? "At Risk" : "Stable";

    return {
      total,
      submitted,
      interviewed,
      offered,
      accepted,
      avgQuality,
      contactable,
      avgNotice,
      salaryValues,
      interviewRate,
      submissionRate,
      offerRate,
      acceptanceRate,
      dropOffRate,
      timeToFill,
      scarcity,
      moduleRows,
      weakModules,
      expectedOffers,
      expectedPlacements,
      nextHealth,
    };
  }, [candidates, counts]);

  const insights = [
    intelligence.weakModules.length ? `${intelligence.weakModules.map((row) => row.module).join(", ")} shortage requires immediate sourcing focus.` : "No critical module shortage detected in the current visible slate.",
    intelligence.avgQuality < 70 ? "Pipeline quality is below submission standard." : "Pipeline quality is within recruiter-review range.",
    intelligence.avgNotice === null ? "Average notice period is Unknown." : intelligence.avgNotice > 45 ? "Average notice period increasing above 45 days." : "Notice period trend is manageable.",
    intelligence.salaryValues.length ? "Salary expectations require benchmark review before submission." : "Salary trend is Unknown because package data is unavailable.",
    intelligence.interviewRate < 30 ? "Interview conversion is weak or not fully tracked." : "Interview conversion is active enough to support near-term placements.",
  ];

  const recommendations = [
    "Prioritize BTP, EWM and TM sourcing before lower-scarcity modules.",
    "Convert the highest-quality shortlisted profiles into recruiter screens this week.",
    "Resolve Unknown notice period and salary fields before client submission.",
    "Create a focused shortlist for Malaysia if location demand remains high.",
    "Audit profiles below 70 quality before spending recruiter time.",
    "Move contactable high-quality candidates into interview scheduling first.",
    "Benchmark salary expectations before sending client submissions.",
    "Refresh weak module searches with adjacent senior architecture keywords.",
    "Review recruiter notes for blocked submissions and unblock the top five.",
    "Use Executive AI Compare before any client-facing shortlist is sent.",
  ];

  return (
    <main className="min-h-screen bg-[#080d12] p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-[28px] bg-gradient-to-br from-[#111820] via-[#0d141c] to-[#091018] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 ring-slate-800/45">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Hiring Intelligence Engine</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Executive Pipeline Command Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Recruitment director view across pipeline health, market pressure, recruiter output, module shortages and 30-day forecast.</p>
            </div>
            <div className="rounded-full bg-cyan-950/25 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100 ring-1 ring-cyan-500/20">{loading ? "Loading" : "Live pipeline view"}</div>
          </div>
        </header>

        <Section title="Pipeline Health" subtitle="Executive view of conversion, quality and fill risk.">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-8">
            <KpiCard label="Total Candidates" value={String(intelligence.total)} tone="blue" />
            <KpiCard label="Interview Rate" value={pct(intelligence.interviewRate)} />
            <KpiCard label="Submission Rate" value={pct(intelligence.submissionRate)} />
            <KpiCard label="Offer Rate" value={pct(intelligence.offerRate)} />
            <KpiCard label="Acceptance Rate" value={pct(intelligence.acceptanceRate)} />
            <KpiCard label="Drop-off Rate" value={pct(intelligence.dropOffRate)} tone="amber" />
            <KpiCard label="Time to Fill" value={intelligence.timeToFill} />
            <KpiCard label="Pipeline Quality" value={intelligence.avgQuality ? pct(intelligence.avgQuality) : "Unknown"} tone="green" />
          </div>
        </Section>

        <Section title="Market Intelligence" subtitle="Scarcity, compensation and competitive pressure.">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <KpiCard label="Talent Scarcity" value={trendLabel(intelligence.scarcity, "High", "Moderate", "Low")} note={`${intelligence.total} visible candidates in current pipeline.`} tone="amber" />
            <KpiCard label="Salary Trend" value={intelligence.salaryValues.length ? "Benchmark Required" : "Unknown"} note={intelligence.salaryValues.length ? "Package data exists; compare before submission." : "Salary data not consistently available."} />
            <KpiCard label="Notice Period Trend" value={intelligence.avgNotice === null ? "Unknown" : `${intelligence.avgNotice} days avg`} note="Derived from available notice fields only." />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <KpiCard label="Top Hiring Competitors" value="Unknown" note="Competitor data not available in current local feed." />
            <KpiCard label="Demand Trend" value={intelligence.weakModules.length ? "Rising" : "Stable"} note="Based on shortage pressure by SAP module." />
            <KpiCard label="Supply Trend" value={intelligence.scarcity >= 70 ? "Tightening" : "Stable"} note="Based on current visible candidate pool." />
          </div>
        </Section>

        <Section title="Recruiter Performance" subtitle="Conversion quality and execution indicators.">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Submission Quality" value={intelligence.avgQuality ? pct(intelligence.avgQuality) : "Unknown"} />
            <KpiCard label="Interview Conversion" value={pct(intelligence.interviewRate)} />
            <KpiCard label="Offer Conversion" value={pct(intelligence.offerRate)} />
            <KpiCard label="Placement Rate" value={pct(intelligence.acceptanceRate)} />
            <KpiCard label="Avg Response Time" value="Unknown" note="Response timestamps unavailable." />
            <KpiCard label="Candidate Quality" value={intelligence.avgQuality >= 75 ? "Strong" : intelligence.avgQuality ? "Needs Lift" : "Unknown"} />
          </div>
        </Section>

        <Section title="Module Intelligence" subtitle="Pipeline depth, shortage and market velocity by SAP domain.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {intelligence.moduleRows.map((row) => (
              <div key={row.module} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-black text-white">SAP {row.module}</div>
                  <div className={row.shortage === "High" ? "text-xs font-bold text-amber-300" : "text-xs font-bold text-emerald-300"}>{row.shortage} Shortage</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-slate-500">Pipeline</div><div className="mt-1 font-bold">{row.pool}</div></div>
                  <div><div className="text-slate-500">Velocity</div><div className="mt-1 font-bold">{row.velocity}</div></div>
                  <div><div className="text-slate-500">Competition</div><div className="mt-1 font-bold">{row.competition}</div></div>
                </div>
                <div className="mt-3"><Bar value={row.avg || row.pool * 10} label={row.avg ? `Quality ${row.avg}%` : "Quality Unknown"} /></div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="AI Insights" subtitle="Signals that require director attention.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {insights.map((item) => <div key={item} className="rounded-2xl bg-[#0f151d] p-4 text-sm font-semibold leading-6 text-slate-100 ring-1 ring-slate-800/55">{item}</div>)}
          </div>
        </Section>

        <Section title="Forecast" subtitle="30-day hiring outlook based on current visible pipeline.">
          <div className="grid gap-3 md:grid-cols-4">
            <KpiCard label="Predicted Time to Fill" value={intelligence.timeToFill} />
            <KpiCard label="Expected Placements" value={String(intelligence.expectedPlacements)} />
            <KpiCard label="Expected Offers" value={String(intelligence.expectedOffers)} />
            <KpiCard label="Pipeline Health Next 30 Days" value={intelligence.nextHealth} tone={intelligence.nextHealth === "At Risk" ? "amber" : "green"} />
          </div>
        </Section>

        <Section title="Executive Recommendations" subtitle="Top actions recruiters should take this week, prioritized by impact.">
          <div className="grid gap-2 md:grid-cols-2">
            {recommendations.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-[#0f151d] p-3 ring-1 ring-slate-800/55">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-950/35 text-xs font-black text-cyan-100 ring-1 ring-cyan-500/20">{index + 1}</div>
                <div className="text-sm font-semibold leading-6 text-slate-100">{item}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
