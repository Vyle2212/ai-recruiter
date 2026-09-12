"use client";

import { memo, useMemo } from "react";
import type { Candidate360Profile } from "@/lib/candidate360Types";

type Intelligence = Candidate360Profile["enterpriseProfile"]["intelligence"];
type Metric = Intelligence["promotionReadiness"];
type CalculationItem = { label: string; value: string };
const card = "rounded-xl border border-slate-800 bg-[#070A0F] transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20 motion-reduce:transform-none";

function rating(score: number | null) {
  if (score === null) return "Limited evidence";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 60) return "Established";
  if (score >= 40) return "Developing";
  return "Requires validation";
}

function calculationFor(metric: Metric): CalculationItem[] {
  if (/Uses the recorded/i.test(metric.reason)) return [{ label: "Recorded score", value: "100%" }, { label: "Evidence validation", value: "Required" }];
  const calculations: Record<string, CalculationItem[]> = {
    implementationAuthority: [{ label: "Evidence baseline", value: "35 pts" }, { label: "Implementation", value: "7 pts each" }, { label: "Rollout", value: "4 pts each" }, { label: "Migration", value: "10 pts" }],
    financeDepth: [{ label: "Evidence baseline", value: "35 pts" }, { label: "Finance signals", value: "10 pts each" }, { label: "Implementation", value: "3 pts each · max 20" }],
    technicalDepth: [{ label: "Evidence baseline", value: "35 pts" }, { label: "SAP and technical evidence", value: "7 pts each · max 55" }],
    leadershipReadiness: [{ label: "Leadership baseline", value: "45 pts" }, { label: "Leadership evidence", value: "25 pts" }, { label: "Team size", value: "1 pt each · max 20" }],
    promotionReadiness: [{ label: "Evidence baseline", value: "35 pts" }, { label: "Experience", value: "2 pts/year · max 30" }, { label: "Leadership score", value: "35% contribution" }, { label: "Seniority title", value: "12 pts" }],
    consultingDna: [{ label: "Consulting evidence", value: "80 pts" }, { label: "End-user evidence only", value: "35 pts" }],
    projectComplexity: [{ label: "Project baseline", value: "30 pts" }, { label: "Project count", value: "6 pts each · max 30" }, { label: "S/4HANA", value: "12 pts" }, { label: "Migration", value: "10 pts" }, { label: "Team size", value: "max 18 pts" }],
    regionalCoverage: [{ label: "Coverage baseline", value: "45 pts" }, { label: "Regional evidence", value: "12 pts each" }, { label: "Additional countries", value: "8 pts each" }],
    countryCoverage: [{ label: "Evidence baseline", value: "35 pts" }, { label: "Countries", value: "12 pts each" }],
    domainExpertise: [{ label: "Evidence baseline", value: "35 pts" }, { label: "Domain signals", value: "8 pts each · max 55" }],
    marketPosition: [{ label: "Profile completeness", value: "55%" }, { label: "Data confidence", value: "45%" }],
    clientTier: [{ label: "Recorded client-tier score", value: "100%" }, { label: "Client evidence", value: "Required" }],
    salaryPosition: [{ label: "Verified salary", value: "Required" }, { label: "Market benchmark", value: "Required" }],
  };
  return calculations[metric.key] || [{ label: "Extracted evidence signals", value: "Evidence-dependent" }];
}

const ConfidenceBar = memo(function ConfidenceBar({ value }: { value: number }) {
  return <div><div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-400"><span>Conclusion confidence</span><span>{value}%</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Evidence confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className="h-full rounded-full bg-cyan-300 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${value}%` }} /></div></div>;
});

const KpiRow = memo(function KpiRow({ metric }: { metric: Metric }) {
  const available = metric.score !== null;
  const calculation = calculationFor(metric);
  const conclusionConfidence = available ? Math.min(metric.confidence ?? 0, metric.evidence.length >= 3 ? 75 : metric.evidence.length ? 65 : 40) : 0;
  return <article className="border-t border-slate-800 py-4 first:border-t-0 first:pt-0 last:pb-0" aria-label={`${metric.label}: ${available ? `${metric.score} out of 100` : "Limited evidence"}`}>
    <div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-100">{metric.label}</h4><p className="mt-1 text-[11px] text-slate-400">{rating(metric.score)}</p></div>{available ? <p className="whitespace-nowrap text-xl font-semibold tabular-nums text-white">{metric.score}<span className="ml-1 text-[10px] font-normal text-slate-500">/100</span></p> : <p className="max-w-28 text-right text-xs font-medium leading-5 text-slate-300">Limited evidence</p>}</div>
    <div className="mt-3">{available ? <ConfidenceBar value={conclusionConfidence}/> : <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-500"><span>Conclusion confidence</span><span>Evidence unavailable</span></div>}</div>
    <p className="mt-2 line-clamp-1 text-xs text-slate-400">{metric.evidence[0] || metric.reason || "Not enough verified signals to score this KPI."}</p>
    <details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer select-none font-medium text-cyan-300 hover:text-cyan-200">View evidence provenance &amp; reasoning</summary><p className="mt-2 text-[10px] text-slate-500">System-derived conclusion. Resume evidence is not recruiter-confirmed unless explicitly marked.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Evidence</h5>{metric.evidence.length ? <ul className="mt-1.5 space-y-1">{metric.evidence.slice(0, 3).map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-slate-300"><span aria-hidden="true" className="text-cyan-300">•</span><span>{item}</span></li>)}</ul> : <p className="mt-1.5 text-xs leading-5 text-slate-400">Not enough verified signals to score this KPI.</p>}</div><div><h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reason</h5><p className="mt-1.5 text-xs leading-5 text-slate-300">{metric.reason || "A reason cannot be produced without verified evidence."}</p></div></div><dl className="mt-3 space-y-1.5 rounded-lg border border-slate-800 bg-black/20 p-3">{calculation.map((item) => <div key={item.label} className="flex justify-between gap-3"><dt>{item.label}</dt><dd className="text-right font-medium text-slate-300">{item.value}</dd></div>)}</dl></details>
  </article>;
});

function IntelligenceDomain({ title, description, metrics }: { title: string; description: string; metrics: Metric[] }) {
  const scored = metrics.filter((metric) => metric.score !== null).length;
  return <section className={`${card} p-4 md:p-5`} aria-labelledby={`intelligence-domain-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}><header className="mb-4 flex items-start justify-between gap-3"><div><h3 id={`intelligence-domain-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`} className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></div><div className="text-right text-[10px] uppercase tracking-wide text-slate-500">{scored}/{metrics.length} evidenced</div></header>{metrics.map((metric) => <KpiRow key={metric.key} metric={metric}/>)}</section>;
}

function InsightList({ title, items }: { title: string; items: string[] }) { return <div><h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>{items.length ? <ul className="mt-2 space-y-1">{items.slice(0,3).map((item) => <li key={item} className="text-xs leading-5 text-slate-300">{item}</li>)}</ul> : <p className="mt-2 text-xs text-slate-400">Not enough verified signals to establish this insight.</p>}</div>; }

export default memo(function CandidateIntelligencePanel({ intelligence }: { intelligence: Intelligence }) {
  const domains = useMemo(() => [
    { title: "Delivery", description: "Implementation ownership and delivery complexity", metrics: [intelligence.implementationAuthority, intelligence.projectComplexity] },
    { title: "Capability", description: "Functional, technical and domain depth", metrics: [intelligence.technicalDepth, intelligence.financeDepth, intelligence.domainExpertise] },
    { title: "Consulting", description: "Consulting context and client exposure", metrics: [intelligence.consultingDna, intelligence.clientTier] },
    { title: "Leadership", description: "Leadership and career progression readiness", metrics: [intelligence.leadershipReadiness, intelligence.promotionReadiness] },
    { title: "Market & Mobility", description: "Market position, compensation and geographic coverage", metrics: [intelligence.marketPosition, intelligence.salaryPosition, intelligence.regionalCoverage, intelligence.countryCoverage] },
  ], [intelligence]);
  return <section aria-labelledby="enterprise-intelligence-title" className="rounded-2xl border border-slate-800/90 bg-[#0B0F16] p-5 md:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="enterprise-intelligence-title" className="text-lg font-semibold tracking-tight text-white">Enterprise intelligence</h2><p className="mt-1 text-sm text-slate-400">Five evidence-backed intelligence domains replace the isolated score-card matrix.</p></div></div><div className="mt-5 grid items-start gap-4 xl:grid-cols-2">{domains.map((domain, index) => <div key={domain.title} className={index === domains.length - 1 ? "xl:col-span-2" : ""}><IntelligenceDomain {...domain}/></div>)}</div><div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2"><InsightList title="Best-fit roles" items={intelligence.insights.idealRoles}/><InsightList title="Priority risks" items={intelligence.insights.topRisks}/></div></section>;
});

