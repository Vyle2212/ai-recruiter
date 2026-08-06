"use client";

import { useMemo } from "react";
import { buildCandidateHiringOpinion } from "@/lib/candidate360Opinion";
import type { Candidate360Profile } from "@/lib/candidate360Types";

type Metric = Candidate360Profile["enterpriseProfile"]["intelligence"]["implementationAuthority"];

function level(score: number | null) {
  if (score === null) return "Limited evidence";
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  return "Limited";
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="min-w-0 rounded-xl border border-slate-800 bg-black/20 p-3"><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</div><div className="mt-1 truncate text-lg font-semibold text-slate-100" title={value}>{value}</div>{note ? <p className="mt-1 line-clamp-1 text-[10px] text-slate-500" title={note}>{note}</p> : null}</div>;
}

export default function HiringDashboard({ profile, job }: { profile: Candidate360Profile; job: Record<string, unknown> | null }) {
  const opinion = useMemo(() => buildCandidateHiringOpinion(profile, job), [profile, job]);
  const decision = opinion.jobDecision;
  const intelligence = profile.enterpriseProfile.intelligence;
  const confidence = opinion.mode === "job_fit" ? opinion.roleFit.confidence : opinion.candidateReadiness.confidence;
  const riskCount = decision?.risks.length ?? profile.enterpriseProfile.quality.reviewRisks.length;
  const risk = opinion.hiringRisk;
  const recommendation = opinion.mode === "job_fit" ? opinion.roleFit.decision : opinion.candidateReadiness.decision;
  const recommendationTone = recommendation === "Interview" || recommendation === "Proceed to Recruiter Screening" ? "text-emerald-300" : recommendation === "Hold" ? "text-blue-300" : recommendation === "Reject" ? "text-rose-300" : "text-amber-300";
  const metric = (item: Metric) => ({ value: level(item.score), note: item.evidence[0] || item.reason });
  const deliveryScores = [intelligence.implementationAuthority.score, intelligence.projectComplexity.score].filter((item): item is number => item !== null);
  const deliveryScore = deliveryScores.length ? Math.round(deliveryScores.reduce((sum, item) => sum + item, 0) / deliveryScores.length) : null;
  const delivery = { value: level(deliveryScore), note: [intelligence.implementationAuthority.evidence[0], intelligence.projectComplexity.evidence[0]].filter(Boolean).join(" · ") };
  const consulting = metric(intelligence.consultingDna);
  const leadership = metric(intelligence.leadershipReadiness);
  return <section aria-labelledby="hiring-dashboard-title" className="rounded-2xl border border-slate-700/90 bg-[#0B0F16] p-4 shadow-xl shadow-black/20 md:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-400">Decision at a glance</div><h2 id="hiring-dashboard-title" className="mt-1 text-lg font-semibold text-white">Hiring Dashboard</h2></div><div className="rounded-lg border border-slate-700 bg-black/20 px-4 py-2 text-right"><div className="text-[10px] uppercase tracking-wide text-slate-500">{opinion.mode === "job_fit" ? "Role-fit decision" : "Candidate readiness"}</div><div className={`mt-1 text-lg font-semibold ${recommendationTone}`}>{recommendation}</div></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8"><Kpi label="Fit" value={decision?.overall.score === null || !decision ? "Job Required" : `${decision.overall.score}/100`} note={decision?.job.title || "Role fit is not calculated without a selected Job."}/><Kpi label="Role-fit risk" value={risk} note={opinion.risks[0] || opinion.missingEvidence[0] || (riskCount ? `${riskCount} item(s) require review` : "No recorded risks")}/><Kpi label={opinion.mode === "job_fit" ? "Decision confidence" : "Readiness confidence"} value={confidence === null ? "Not assessed" : `${confidence}%`} note="Calibrated for evidence strength and critical gaps"/><Kpi label="Profile completeness" value={`${opinion.confidenceCalibration.completeness}%`} note="Coverage only; not decision certainty"/><Kpi label="Evidence quality" value={`${opinion.confidenceCalibration.evidenceQuality}%`} note="Source strength and verification level"/><Kpi label="Delivery" {...delivery}/><Kpi label="Consulting" {...consulting}/><Kpi label="Leadership" {...leadership}/></div>
  </section>;
}








