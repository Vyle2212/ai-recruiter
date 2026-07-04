"use client";

import { useEffect, useMemo, useState } from "react";

type Candidate = Record<string, any>;

type Tone = "green" | "yellow" | "red" | "slate" | "blue";

const COUNTRIES = ["Malaysia", "Singapore", "Thailand", "Vietnam", "Indonesia", "Philippines", "Australia", "Japan", "India", "China"];
const MODULES = ["BTP", "FICO", "SD", "MM", "ABAP", "BASIS", "EWM", "TM", "FI", "CO", "PP", "SuccessFactors"];
const COMPANIES = ["Accenture", "Deloitte", "IBM", "cbs", "Capgemini", "NTT DATA", "Fujitsu", "Hitachi", "PwC", "EY", "KPMG", "TCS", "Infosys", "DXC", "SAP"];
const INDUSTRIES = ["Consulting", "Technology", "Manufacturing", "Financial Services", "Retail", "Logistics", "Utilities", "Public Sector"];

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function text(value: any) {
  return String(value || "").trim();
}

function lower(candidate: Candidate) {
  return JSON.stringify(candidate || {}).toLowerCase();
}

function normalizeModule(value: any) {
  const raw = text(value).toUpperCase().replace(/^SAP\s+/, "").replace(/[\s/_-]/g, "");
  if (!raw) return "UNKNOWN";
  if (raw === "SUCCESSFACTORS" || raw === "SF") return "SuccessFactors";
  if (raw === "S4HANA") return "S/4HANA";
  return raw;
}

function moduleOf(candidate: Candidate) {
  return normalizeModule(candidate.primary_module || candidate.primaryModule || candidate.module || candidate.requiredModule);
}

function countryOf(candidate: Candidate) {
  const value = `${candidate.country || ""} ${candidate.current_location || ""} ${candidate.location || ""} ${candidate.display_location || ""}`.toLowerCase();
  return COUNTRIES.find((country) => value.includes(country.toLowerCase())) || "Unknown";
}

function companyOf(candidate: Candidate) {
  return text(candidate.current_company || candidate.company || candidate.display_company || candidate.employer || "Unknown");
}

function scoreOf(candidate: Candidate) {
  return n(candidate.score ?? candidate.matchScore ?? candidate.finalScore ?? candidate.profile_quality_score ?? candidate.quality_score ?? candidate.recruiter_priority_score);
}

function yearsOf(candidate: Candidate) {
  return n(candidate.years ?? candidate.yearsOfExperience ?? candidate.total_years);
}

function salaryOf(candidate: Candidate) {
  return n(candidate.expected_salary ?? candidate.expectedSalary ?? candidate.salary_expectation ?? candidate.salary ?? candidate.current_salary);
}

function noticeDays(candidate: Candidate) {
  const value = `${candidate.notice_period || candidate.noticePeriod || candidate.notice || ""}`.toLowerCase();
  const days = value.match(/(\d+)\s*day/);
  if (days) return n(days[1]);
  const months = value.match(/(\d+)\s*month/);
  if (months) return n(months[1]) * 30;
  if (value.includes("immediate")) return 0;
  return null;
}

function isArchitect(candidate: Candidate) {
  return /architect|solution design|enterprise architecture|blueprint/.test(lower(candidate));
}

function isLeadership(candidate: Candidate) {
  return /lead|manager|principal|director|head|practice lead|team lead/.test(`${candidate.title || ""} ${candidate.current_title || ""} ${candidate.headline || ""}`.toLowerCase());
}

function isAvailableNow(candidate: Candidate) {
  return /immediate|available now|actively looking|open/.test(`${candidate.availability || ""} ${candidate.open_status || ""} ${candidate.notice_period || ""}`.toLowerCase());
}

function isConsulting(candidate: Candidate) {
  return /consulting|consultant|accenture|deloitte|ey|pwc|kpmg|ibm|capgemini|infosys|tcs|dxc|ntt/.test(lower(candidate));
}

function recruiterActivity(candidate: Candidate) {
  const explicit = n(candidate.outreach_count ?? candidate.contact_count ?? candidate.recruiter_activity_count ?? candidate.activity_count, -1);
  if (explicit >= 0) return explicit;
  if (candidate.contacted || candidate.contacted_at || candidate.last_contacted_at || candidate.recruiter_notes) return 1;
  return null;
}

function toneForDifficulty(value: number): Tone {
  if (value >= 75) return "red";
  if (value >= 45) return "yellow";
  return "green";
}

function toneClass(tone: Tone) {
  if (tone === "green") return "bg-emerald-500/12 text-emerald-200 ring-emerald-500/20";
  if (tone === "yellow") return "bg-amber-500/12 text-amber-200 ring-amber-500/20";
  if (tone === "red") return "bg-red-500/12 text-red-200 ring-red-500/20";
  if (tone === "blue") return "bg-cyan-500/12 text-cyan-200 ring-cyan-500/20";
  return "bg-slate-500/12 text-slate-300 ring-slate-700/35";
}

function marketHealth(difficulty: number) {
  if (difficulty >= 88) return "Critical";
  if (difficulty >= 72) return "Difficult";
  if (difficulty >= 56) return "Competitive";
  if (difficulty >= 35) return "Healthy";
  return "Excellent";
}

function fmt(value: any) {
  return value === null || value === undefined || value === "" ? "Insufficient Market Data" : String(value);
}

function Card({ label, value, tone = "slate", note }: { label: string; value: string; tone?: Tone; note?: string }) {
  return (
    <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {note ? <div className="mt-2 text-xs leading-5 text-slate-400">{note}</div> : null}
      <div className={"mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 " + toneClass(tone)}>{tone}</div>
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

function Bar({ value, tone = "green" }: { value: number; tone?: Tone }) {
  const width = Math.max(4, Math.min(100, Math.round(value || 0)));
  const color = tone === "red" ? "bg-red-300" : tone === "yellow" ? "bg-amber-300" : "bg-emerald-300";
  return <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={"h-full rounded-full " + color} style={{ width: width + "%" }} /></div>;
}

export default function MarketMapPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("Malaysia");
  const [module, setModule] = useState("BTP");
  const [seniority, setSeniority] = useState("Senior+");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/candidates", { cache: "no-store" });
        const json = await res.json();
        setCandidates(Array.isArray(json) ? json : json.data || json.candidates || []);
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const map = useMemo(() => {
    const targetModule = normalizeModule(module);
    const relevant = candidates.filter((candidate) => moduleOf(candidate) === targetModule || lower(candidate).includes(targetModule.toLowerCase()));
    const countryRelevant = relevant.filter((candidate) => countryOf(candidate) === country);
    const activeTalent = countryRelevant.length;
    const strong = countryRelevant.filter((candidate) => scoreOf(candidate) >= 75).length;
    const architects = countryRelevant.filter(isArchitect).length;
    const immediate = countryRelevant.filter(isAvailableNow).length;
    const notices = countryRelevant.map(noticeDays).filter((value): value is number => value !== null);
    const avgNotice = notices.length ? Math.round(notices.reduce((sum, value) => sum + value, 0) / notices.length) : null;
    const salaries = countryRelevant.map(salaryOf).filter(Boolean);
    const difficulty = Math.min(96, Math.max(22, 82 - activeTalent * 2 + architects * -1 + (immediate <= 2 ? 12 : 0)));

    const heat = COUNTRIES.map((item) => {
      const pool = relevant.filter((candidate) => countryOf(candidate) === item);
      const supply = pool.length;
      const salaryValues = pool.map(salaryOf).filter(Boolean);
      const available = pool.filter(isAvailableNow).length;
      const leadership = pool.filter(isLeadership).length;
      const diff = Math.min(100, Math.max(10, 84 - supply * 3 + (available ? -8 : 8)));
      return {
        country: item,
        supply,
        demand: "Insufficient Market Data",
        salaryGrowth: salaryValues.length ? "Benchmark Required" : "Insufficient Market Data",
        competition: leadership >= 4 || item === "Singapore" || item === "Malaysia" ? "High" : supply >= 4 ? "Medium" : "Insufficient Market Data",
        difficulty: marketHealth(diff),
        availability: available ? String(available) : "Insufficient Market Data",
        tone: toneForDifficulty(diff),
      };
    }).sort((a, b) => b.supply - a.supply);

    const companyRows = COMPANIES.map((company) => {
      const pool = relevant.filter((candidate) => companyOf(candidate).toLowerCase().includes(company.toLowerCase()) || lower(candidate).includes(company.toLowerCase()));
      const activityValues = pool.map(recruiterActivity).filter((value): value is number => value !== null);
      const contacted = activityValues.length ? activityValues.reduce((sum, value) => sum + value, 0) : null;
      const architectureCount = pool.filter(isArchitect).length;
      const leadershipCount = pool.filter(isLeadership).length;
      const availableCount = pool.filter(isAvailableNow).length;
      return {
        company,
        estimatedTalent: pool.length,
        architectureLevel: pool.length ? (architectureCount >= Math.max(2, pool.length * 0.35) ? "High" : architectureCount ? "Moderate" : "Limited") : "Insufficient Market Data",
        leadership: pool.length ? (leadershipCount ? String(leadershipCount) : "Limited") : "Insufficient Market Data",
        attritionRisk: pool.length && availableCount ? "Medium" : pool.length ? "Insufficient Market Data" : "Insufficient Market Data",
        likelihoodToMove: availableCount ? "Higher" : "Insufficient Market Data",
        recruiterOpportunity: contacted === null ? "Insufficient Market Data" : pool.length - contacted >= 3 ? "High" : "Medium",
        contacted,
      };
    }).sort((a, b) => b.estimatedTalent - a.estimatedTalent);

    const untapped = companyRows
      .filter((row) => row.estimatedTalent > 0)
      .map((row) => ({
        ...row,
        contactedLabel: row.contacted === null ? "Insufficient Market Data" : String(row.contacted),
        potential: row.contacted === null ? "Insufficient Market Data" : row.estimatedTalent - row.contacted >= 3 ? "High" : "Medium",
      }))
      .sort((a, b) => b.estimatedTalent - a.estimatedTalent)
      .slice(0, 6);

    const byModule = MODULES.map((item) => ({ label: item, value: candidates.filter((candidate) => moduleOf(candidate) === normalizeModule(item)).length }));
    const bySeniority = ["Architect", "Lead", "Manager", "Senior", "Consultant"].map((label) => ({ label, value: candidates.filter((candidate) => lower(candidate).includes(label.toLowerCase())).length }));
    const byIndustry = INDUSTRIES.map((item) => ({ label: item, value: candidates.filter((candidate) => lower(candidate).includes(item.toLowerCase())).length }));
    const byCountry = COUNTRIES.map((item) => ({ label: item, value: candidates.filter((candidate) => countryOf(candidate) === item).length }));
    const consulting = relevant.filter(isConsulting).length;
    const endUser = relevant.length ? relevant.length - consulting : 0;
    const leadership = relevant.filter(isLeadership).length;

    const competitors = companyRows.slice(0, 8).map((row) => ({
      company: row.company,
      modules: row.estimatedTalent ? module : "Insufficient Market Data",
      locations: row.estimatedTalent ? country : "Insufficient Market Data",
      salaryInflation: salaries.length ? "Likely Increasing" : "Insufficient Market Data",
      momentum: row.estimatedTalent >= 5 ? "High" : row.estimatedTalent ? "Moderate" : "Insufficient Market Data",
    }));

    const headhunt = countryRelevant
      .slice()
      .sort((a, b) => scoreOf(b) - scoreOf(a) || Number(isArchitect(b)) - Number(isArchitect(a)))
      .slice(0, 10)
      .map((candidate, index) => ({
        rank: index + 1,
        name: text(candidate.name || candidate.candidate_name || `Profile ${index + 1}`),
        company: companyOf(candidate),
        reason: isArchitect(candidate) ? "Architecture signal" : scoreOf(candidate) ? "Strong profile quality" : "Relevant module signal",
      }));

    return {
      relevant,
      countryRelevant,
      activeTalent,
      strong,
      architects,
      immediate,
      avgNotice,
      salaries,
      difficulty,
      health: marketHealth(difficulty),
      heat,
      companyRows,
      untapped,
      byModule,
      bySeniority,
      byIndustry,
      byCountry,
      consulting,
      endUser,
      leadership,
      competitors,
      headhunt,
    };
  }, [candidates, country, module]);

  const strategyCompanies = map.companyRows.filter((row) => row.estimatedTalent > 0).slice(0, 10);
  const fastestMarkets = map.heat.filter((row) => row.tone === "green" || row.tone === "yellow").slice(0, 3);
  const hardestMarkets = map.heat.filter((row) => row.tone === "red").slice(0, 3);
  const actions = [
    `Target ${strategyCompanies[0]?.company || "Insufficient Market Data"} first if recruiter activity is confirmed low.`,
    `Expand sourcing in ${fastestMarkets[0]?.country || "Insufficient Market Data"} for faster market response.`,
    `Treat ${hardestMarkets[0]?.country || country} as a high-friction hiring market for SAP ${module}.`,
    "Validate recruiter activity data before calling a company untapped.",
    "Prioritize enterprise architects before broader consultant outreach.",
    "Benchmark compensation before client shortlist release.",
    "Separate consulting-firm talent from end-user talent for client positioning.",
    "Map leadership profiles by company before outreach sequencing.",
  ];

  return (
    <main className="min-h-screen bg-[#080d12] p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-[28px] bg-gradient-to-br from-[#111820] via-[#0d141c] to-[#091018] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ring-1 ring-slate-800/45">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">AI Market Map</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Executive Search Market Command</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Maps where SAP talent sits, which companies employ it, where recruiter activity is missing, and which markets need immediate sourcing focus.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select value={module} onChange={(event) => setModule(event.target.value)} className="rounded-xl border border-slate-700/60 bg-[#0b1118] px-3 py-2 text-sm font-semibold text-white">
                {MODULES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-xl border border-slate-700/60 bg-[#0b1118] px-3 py-2 text-sm font-semibold text-white">
                {COUNTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={seniority} onChange={(event) => setSeniority(event.target.value)} className="rounded-xl border border-slate-700/60 bg-[#0b1118] px-3 py-2 text-sm font-semibold text-white">
                {["Senior+", "Architect", "Lead", "Manager", "Consultant"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </header>

        <Section title="Executive Market Overview" subtitle="Market health for the selected search context.">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-8">
            <Card label={`${module} ${country}`} value={map.health} tone={toneForDifficulty(map.difficulty)} note="Market health" />
            <Card label="Market Difficulty" value={map.difficulty >= 72 ? "High" : map.difficulty >= 45 ? "Medium" : "Low"} tone={toneForDifficulty(map.difficulty)} />
            <Card label="Estimated Active Talent" value={String(map.activeTalent)} tone="blue" />
            <Card label="Strong Candidates" value={String(map.strong)} tone={map.strong ? "green" : "red"} />
            <Card label="Enterprise Architects" value={String(map.architects)} tone={map.architects ? "green" : "yellow"} />
            <Card label="Immediately Available" value={String(map.immediate)} tone={map.immediate ? "green" : "red"} />
            <Card label="Average Notice" value={map.avgNotice === null ? "Insufficient Market Data" : `${(map.avgNotice / 30).toFixed(1)} months`} tone={map.avgNotice === null ? "slate" : map.avgNotice > 60 ? "red" : "yellow"} />
            <Card label="Salary Trend" value={map.salaries.length ? "Increasing" : "Insufficient Market Data"} tone={map.salaries.length ? "yellow" : "slate"} />
          </div>
        </Section>

        <Section title="Market Heat Map" subtitle="Country ranking by supply, competition and availability.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {map.heat.map((row) => (
              <div key={row.country} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
                <div className="flex items-center justify-between gap-3"><div className="text-lg font-black">{row.country}</div><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 " + toneClass(row.tone)}>{row.difficulty}</span></div>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between"><span>Talent Supply</span><b>{row.supply}</b></div>
                  <div className="flex justify-between"><span>Hiring Demand</span><b>{row.demand}</b></div>
                  <div className="flex justify-between"><span>Salary Growth</span><b>{row.salaryGrowth}</b></div>
                  <div className="flex justify-between"><span>Competition</span><b>{row.competition}</b></div>
                  <div className="flex justify-between"><span>Availability</span><b>{row.availability}</b></div>
                </div>
                <div className="mt-3"><Bar value={row.supply * 8} tone={row.tone} /></div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Company Intelligence" subtitle="Talent-source view across major SAP employers.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-500"><tr>{["Company", "Estimated SAP Talent", "Architecture Level", "Leadership", "Attrition Risk", "Likelihood to Move", "Recruiter Opportunity"].map((h) => <th key={h} className="border-b border-slate-800 px-3 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {map.companyRows.map((row) => (
                  <tr key={row.company} className="border-b border-slate-900/80">
                    <td className="px-3 py-3 font-bold text-white">{row.company}</td>
                    <td className="px-3 py-3 text-slate-200">{row.estimatedTalent || "Insufficient Market Data"}</td>
                    <td className="px-3 py-3 text-slate-300">{row.architectureLevel}</td>
                    <td className="px-3 py-3 text-slate-300">{row.leadership}</td>
                    <td className="px-3 py-3 text-slate-300">{row.attritionRisk}</td>
                    <td className="px-3 py-3 text-slate-300">{row.likelihoodToMove}</td>
                    <td className="px-3 py-3 text-cyan-100">{row.recruiterOpportunity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Untapped Market" subtitle="Companies with matching profiles where recruiter activity is missing or low.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(map.untapped.length ? map.untapped : [{ company: "Insufficient Market Data", estimatedTalent: 0, contactedLabel: "Insufficient Market Data", potential: "Insufficient Market Data" }]).map((row) => (
              <div key={row.company} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
                <div className="text-xl font-black text-white">{row.company}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div><div className="text-slate-500">Matching</div><b>{row.estimatedTalent ? `${row.estimatedTalent} ${module} candidates` : "Insufficient Market Data"}</b></div>
                  <div><div className="text-slate-500">Contacted</div><b>{row.contactedLabel}</b></div>
                  <div><div className="text-slate-500">Pipeline</div><b>{row.potential}</b></div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Talent Distribution" subtitle="Macro view by module, seniority, industry, company type, leadership and country.">
          <div className="grid gap-4 xl:grid-cols-3">
            {[
              ["By Module", map.byModule],
              ["By Seniority", map.bySeniority],
              ["By Industry", map.byIndustry],
              ["By Country", map.byCountry],
            ].map(([label, rows]: any) => (
              <div key={label} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
                <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
                <div className="mt-3 space-y-3">{rows.map((row: any) => <div key={row.label}><div className="mb-1 flex justify-between text-xs"><span>{row.label}</span><b>{row.value || "Insufficient Market Data"}</b></div><Bar value={row.value * 8} /></div>)}</div>
              </div>
            ))}
            <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Consulting vs End User</div>
              <div className="mt-4 grid grid-cols-2 gap-3"><Card label="Consulting" value={String(map.consulting)} /><Card label="End User" value={String(map.endUser)} /></div>
              <div className="mt-4"><Card label="Leadership Profiles" value={String(map.leadership)} tone={map.leadership ? "green" : "yellow"} /></div>
            </div>
          </div>
        </Section>

        <Section title="Competitor Hiring Intelligence" subtitle="Estimated hiring pressure by company, module and location.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {map.competitors.map((row) => <div key={row.company} className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><div className="font-black">{row.company}</div><div className="mt-3 space-y-2 text-xs text-slate-300"><div>Modules: <b>{row.modules}</b></div><div>Locations: <b>{row.locations}</b></div><div>Salary Inflation: <b>{row.salaryInflation}</b></div><div>Momentum: <b>{row.momentum}</b></div></div></div>)}
          </div>
        </Section>

        <Section title="Executive Search Strategy" subtitle="Where to source, who to approach and which markets to prioritize.">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><h3 className="font-black text-cyan-100">Top 10 Companies to Target</h3><div className="mt-3 grid gap-2">{(strategyCompanies.length ? strategyCompanies : [{ company: "Insufficient Market Data", estimatedTalent: 0 }]).map((row, index) => <div key={row.company} className="flex justify-between rounded-xl bg-[#0b1118] px-3 py-2 text-sm"><span>{index + 1}. {row.company}</span><b>{row.estimatedTalent || "Insufficient Market Data"}</b></div>)}</div></div>
            <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><h3 className="font-black text-cyan-100">Top 10 Candidates to Headhunt</h3><div className="mt-3 grid gap-2">{(map.headhunt.length ? map.headhunt : [{ rank: 1, name: "Insufficient Market Data", company: "", reason: "" }]).map((row) => <div key={`${row.rank}-${row.name}`} className="rounded-xl bg-[#0b1118] px-3 py-2 text-sm"><b>{row.rank}. {row.name}</b><div className="text-xs text-slate-500">{fmt(row.company)} · {fmt(row.reason)}</div></div>)}</div></div>
            <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><h3 className="font-black text-cyan-100">Top 5 Industries</h3><div className="mt-3 flex flex-wrap gap-2">{map.byIndustry.filter((row) => row.value > 0).slice(0, 5).map((row) => <span key={row.label} className="rounded-full bg-cyan-950/25 px-3 py-1.5 text-xs font-bold text-cyan-100">{row.label}</span>)}{!map.byIndustry.some((row) => row.value > 0) ? <span className="text-sm text-slate-400">Insufficient Market Data</span> : null}</div></div>
            <div className="rounded-2xl bg-[#0f151d] p-4 ring-1 ring-slate-800/55"><h3 className="font-black text-cyan-100">Market Calls</h3><div className="mt-3 space-y-2 text-sm text-slate-300"><div>Fastest: <b>{fastestMarkets.map((row) => row.country).join(", ") || "Insufficient Market Data"}</b></div><div>Hardest: <b>{hardestMarkets.map((row) => row.country).join(", ") || "Insufficient Market Data"}</b></div><div>Biggest Opportunity: <b>{map.untapped[0]?.company || "Insufficient Market Data"}</b></div></div></div>
          </div>
        </Section>

        <Section title="Recruiter Actions" subtitle="Prioritized market-building actions for this search.">
          <div className="grid gap-2 md:grid-cols-2">
            {actions.map((item, index) => <div key={item} className="flex gap-3 rounded-2xl bg-[#0f151d] p-3 ring-1 ring-slate-800/55"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-950/35 text-xs font-black text-cyan-100 ring-1 ring-cyan-500/20">{index + 1}</span><span className="text-sm font-semibold leading-6 text-slate-100">{item}</span></div>)}
          </div>
        </Section>
      </div>
    </main>
  );
}


