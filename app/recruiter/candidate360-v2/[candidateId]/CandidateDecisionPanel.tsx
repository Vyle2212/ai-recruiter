"use client";

import { useMemo, useState } from "react";
import { buildCandidateJobDecision, type CandidateJobDecision, type DecisionSignal } from "@/lib/candidate360Decision";
import type { Candidate360Profile } from "@/lib/candidate360Types";

const card = "rounded-xl border border-slate-800 bg-[#070A0F]";
const tone = (score: number | null) => score === null ? "text-slate-400" : score >= 85 ? "text-emerald-300" : score >= 70 ? "text-cyan-300" : score >= 55 ? "text-amber-300" : "text-rose-300";

function AuditEvidence({ signal }: { signal: DecisionSignal }) {
  return <details className="mt-3 border-t border-slate-800 pt-3 text-xs"><summary className="cursor-pointer font-medium text-slate-400 hover:text-slate-200">View evidence</summary><div className="mt-3 space-y-3"><div><div className="font-semibold uppercase tracking-wide text-slate-500">Evidence</div>{signal.evidence.length ? <ul className="mt-1 space-y-1 text-slate-300">{signal.evidence.map((item, index) => <li key={`${item.source}-${index}`}>• {item.text}</li>)}</ul> : <p className="mt-1 text-slate-500">No supporting evidence located.</p>}</div>{signal.missingEvidence.length ? <div><div className="font-semibold uppercase tracking-wide text-amber-500/80">Missing evidence</div><p className="mt-1 text-slate-400">{signal.missingEvidence.join(" · ")}</p></div> : null}<div><div className="font-semibold uppercase tracking-wide text-slate-500">Reason</div><p className="mt-1 text-slate-400">{signal.reason}</p></div></div></details>;
}

function FitMetric({ signal }: { signal: DecisionSignal }) {
  return <article className={`${card} p-3`}><div className="flex items-start justify-between gap-2"><div><h3 className="text-xs font-semibold text-slate-200">{signal.label}</h3><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Confidence {signal.confidence}</p></div><div className={`text-xl font-semibold tabular-nums ${tone(signal.score)}`}>{signal.score === null ? "Limited evidence" : signal.score}</div></div><AuditEvidence signal={signal}/></article>;
}

function RequirementRow({ signal }: { signal: DecisionSignal }) {
  const icon = signal.status === "matched" ? "✓" : signal.status === "missing" ? "△" : "?";
  return <div className="border-b border-slate-800/80 py-3 last:border-0"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className={signal.status === "matched" ? "text-emerald-300" : signal.status === "missing" ? "text-amber-300" : "text-slate-400"}>{icon}</span><span className="truncate text-sm font-medium text-slate-200">{signal.label}</span></div><span className="text-[10px] uppercase tracking-wide text-slate-500">{signal.confidence}</span></div><AuditEvidence signal={signal}/></div>;
}

function Recommendation({ decision }: { decision: CandidateJobDecision }) {
  return <section className={`${card} p-5`} aria-labelledby="hiring-recommendation"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">Hiring recommendation</div><h3 id="hiring-recommendation" className={`mt-2 text-2xl font-semibold ${tone(decision.overall.score)}`}>{decision.overall.recommendation}</h3></div><div className="text-right"><div className="text-xs text-slate-500">Decision confidence</div><div className="mt-1 font-semibold text-white">{decision.overall.confidence}</div></div></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div><h4 className="text-xs font-semibold text-emerald-300">Strengths</h4><ul className="mt-2 space-y-1 text-xs text-slate-300">{decision.strengths.slice(0, 3).map((item) => <li key={item.key}>• {item.label}</li>)}</ul></div><div><h4 className="text-xs font-semibold text-amber-300">Risks</h4><ul className="mt-2 space-y-1 text-xs text-slate-300">{decision.risks.slice(0, 3).map((item) => <li key={item.key}>• {item.label}</li>)}</ul></div><div><h4 className="text-xs font-semibold text-slate-300">Missing evidence</h4><ul className="mt-2 space-y-1 text-xs text-slate-300">{decision.unknowns.slice(0, 3).map((item) => <li key={item.key}>• {item.label}</li>)}</ul></div></div><AuditEvidence signal={decision.overall}/></section>;
}

function DecisionHero({ profile, decision }: { profile: Candidate360Profile; decision: CandidateJobDecision | null }) {
  const enterprise = profile.enterpriseProfile;
  const score = decision?.overall.score ?? null;
  const lowConfidence = !decision || decision.overall.confidence === "Low";
  const action = !decision ? "Job Required" : score === null || lowConfidence ? "Need Validation" : score >= 72 ? "Interview" : score >= 55 ? "Hold" : score < 45 && decision.risks.some((item) => item.evidence.length > 0) ? "Reject" : "Need Validation";
  const actionTone = action === "Interview" ? "border-emerald-500/40 bg-emerald-950/20" : action === "Reject" ? "border-rose-500/40 bg-rose-950/20" : "border-amber-500/40 bg-amber-950/20";
  const facts = [
    ["Candidate", enterprise.identity.name || String(profile.displayName.value || "Candidate profile")],
    ["Current company", enterprise.identity.currentCompany || "Insufficient evidence"],
    ["Current role", enterprise.identity.currentTitle || "Insufficient evidence"],
    ["Country", enterprise.identity.country || enterprise.identity.location || "Insufficient evidence"],
    ["Years", enterprise.careerHighlights.yearsExperience ? `${enterprise.careerHighlights.yearsExperience} years` : "Insufficient evidence"],
    ["Primary module", enterprise.careerHighlights.primarySapModule || "Insufficient evidence"],
    ["Availability", enterprise.recruiterSignals.availability || "Not verified"],
    ["Salary", enterprise.recruiterSignals.salary || "Not verified"],
    ["Notice", enterprise.recruiterSignals.notice || "Not verified"],
  ];
  const reasons = decision?.strengths.slice(0, 6) || [];
  const risks = decision?.risks.slice(0, 4) || [];
  const focus = decision?.interviewFocus.slice(0, 4) || [];
  const stars = score === null ? 0 : Math.max(1, Math.min(5, Math.round(score / 20)));
  return <section className="rounded-2xl border border-slate-700/80 bg-[#0B0F16] p-5 shadow-2xl shadow-black/20 md:p-6" aria-labelledby="candidate-fit-title">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-400">AI Decision Workspace</div><h2 id="candidate-fit-title" className="mt-2 text-xl font-semibold text-white">Interview decision briefing</h2></div>{decision ? <div className="rounded-lg border border-slate-700 bg-black/20 px-3 py-2 text-right"><div className="text-[10px] uppercase tracking-wide text-slate-500">Compared with</div><div className="mt-1 text-sm font-medium text-slate-200">{decision.job.title}</div></div> : <div className="rounded-lg border border-amber-600/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">Select a Job to calculate fit</div>}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]"><div><dl className="grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-2">{facts.map(([label, value]) => <div key={label} className="min-w-0 bg-[#070A0F] p-3"><dt className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</dt><dd className="mt-1 truncate text-sm font-medium text-slate-100" title={value}>{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-slate-500">Candidate facts are extracted evidence. Missing commercial fields remain explicitly unverified.</p></div>
      <article className={`rounded-xl border p-5 ${actionTone}`} aria-label={`AI hiring recommendation: ${action}`}><div className="flex items-start justify-between gap-4"><div><div aria-label={`${stars} of 5 stars`} className="text-sm tracking-[.18em] text-amber-300"><span aria-hidden="true">{"★".repeat(stars)}{"☆".repeat(5-stars)}</span></div><h3 className={`mt-2 text-2xl font-semibold ${tone(score)}`}>{decision?.overall.recommendation || "Job Required"}</h3><p className="mt-1 text-sm font-semibold text-white">{action}</p></div><div className="text-right"><div className={`text-4xl font-semibold tabular-nums ${tone(score)}`}>{score === null ? "—" : score}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">Fit score /100</div><div className="mt-2 text-xs text-slate-400">Confidence <span className="font-semibold text-slate-200">{decision?.overall.confidence || "Evidence unavailable"}</span></div></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><h4 className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Top reasons</h4>{reasons.length ? <ul className="mt-2 space-y-1.5 text-xs text-slate-200">{reasons.map((item) => <li key={item.key} className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span><span>{item.evidence[0]?.text || item.label}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No Job-backed reasons available.</p>}</div><div><h4 className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Risks</h4>{risks.length ? <ul className="mt-2 space-y-1.5 text-xs text-slate-200">{risks.map((item) => <li key={item.key} className="flex gap-2"><span aria-hidden="true" className="text-amber-300">!</span><span>{item.label}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No evidenced risks identified.</p>}</div><div><h4 className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300">Interview focus</h4>{focus.length ? <ul className="mt-2 space-y-1.5 text-xs text-slate-200">{focus.map((item) => <li key={item.question}>• {item.question}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">Select a Job to generate focus areas.</p>}</div></div>{decision ? <AuditEvidence signal={decision.overall}/> : <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">No recommendation is produced without an explicit Job comparison.</p>}</article>
    </div>
  </section>;
}
export default function CandidateDecisionPanel({ profile, job, compact = false }: { profile: Candidate360Profile; job: Record<string, unknown> | null; compact?: boolean }) {
  const decision = useMemo(() => job ? buildCandidateJobDecision(profile, job) : null, [profile, job]);
  if (!decision) return <DecisionHero profile={profile} decision={null}/>;
  const matched = decision.requirements.filter((item) => item.status === "matched");
  const missing = decision.requirements.filter((item) => item.status === "missing");
  return <section className="space-y-4" aria-labelledby="candidate-fit-title">
    <DecisionHero profile={profile} decision={decision}/>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{decision.breakdown.map((item) => <FitMetric key={item.key} signal={item}/>)}</div>
    <div className="grid items-start gap-4 xl:grid-cols-2"><section className={`${card} p-5`} aria-labelledby="requirements-title"><div className="flex items-center justify-between gap-3"><h3 id="requirements-title" className="font-semibold text-white">Match vs Job requirements</h3><span className="text-xs text-slate-500">{matched.length}/{decision.requirements.length} evidenced</span></div>{decision.requirements.length ? <div className="mt-3 grid gap-x-5 lg:grid-cols-2">{[...matched, ...missing].map((item) => <RequirementRow key={item.key} signal={item}/>)}</div> : <p className="mt-4 text-sm text-slate-400">The selected Job has no structured requirements available for comparison.</p>}</section><Recommendation decision={decision}/></div>
    <div><section className={`${card} p-5`} aria-labelledby="interview-focus-title"><h3 id="interview-focus-title" className="font-semibold text-white">Interview focus</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{decision.interviewFocus.map((item) => <details key={item.question} className="rounded-lg border border-slate-800 p-3"><summary className="cursor-pointer text-sm font-medium text-slate-200">{item.question}</summary><p className="mt-2 text-xs leading-5 text-slate-400">{item.reason}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Confidence {item.confidence}</p>{item.evidence.map((ref, index) => <p key={`${ref.source}-${index}`} className="mt-1 text-[10px] text-slate-500">{ref.text}</p>)}</details>)}</div></section></div>
    <div className="grid gap-4 xl:grid-cols-3"><section className={`${card} p-5`}><h3 className="font-semibold text-white">Smart timeline insights</h3><dl className="mt-3 space-y-3">{decision.timelineInsights.map((item) => <div key={item.label} className="flex justify-between gap-4 border-b border-slate-800 pb-2 text-sm"><dt className="text-slate-500">{item.label}</dt><dd className="text-right font-medium text-slate-200">{item.value}</dd></div>)}</dl></section><section className={`${card} p-5`}><h3 className="font-semibold text-white">Implementation map</h3><div className="mt-4 grid grid-cols-2 gap-2">{decision.implementationMap.map((item) => <div key={item.label} className="rounded-lg border border-slate-800 p-3"><div className="text-2xl font-semibold text-cyan-200">{item.count}</div><div className="text-xs text-slate-400">{item.label}</div></div>)}</div></section><section className={`${card} p-5`}><h3 className="font-semibold text-white">Market position</h3>{decision.market.available ? <div className="mt-3 text-sm text-slate-300">Benchmark evidence is available for recruiter review.</div> : <p className="mt-3 text-sm text-slate-400">{decision.market.message}</p>}<div className="mt-5 border-t border-slate-800 pt-4"><h4 className="text-xs font-semibold text-slate-300">Client portfolio</h4><p className="mt-2 text-xs leading-5 text-slate-500">{decision.clientPortfolio.industries.slice(0, 5).map((item) => `${item.label} (${item.count})`).join(" · ") || "No verified industry portfolio available."}</p></div></section></div>
  </section>;
}





