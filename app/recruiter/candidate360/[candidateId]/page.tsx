"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate360Panel = {
  candidateId: string;
  candidateName: string;
  currentWorkflowStatus: string;
  profileQualityStatus: string;
  validationStatus: string;
  aiExtractionReviewStatus: string;
  stagingApplyHistoryStatus: string;
  recommendedNextActions: Array<{ actionId: string; recommendedNextAction: string; reason: string; priority: string; safetyNote: string }>;
  allowedActions: Array<{ action: string; reasons: string[] }>;
  blockedActions: Array<{ action: string; reasons: string[] }>;
  timeline: Array<{ at: string; event: string; note: string }>;
  safetyNote: string;
};

export default function Candidate360WorkflowPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const [candidateId, setCandidateId] = useState("");
  const [panel, setPanel] = useState<Candidate360Panel | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    params.then(({ candidateId }) => {
      if (!active) return;
      setCandidateId(candidateId);
      fetch(`/api/recruiter/workflow/candidate/${candidateId}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Unable to load Candidate360 workflow");
          setPanel(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Unable to load Candidate360 workflow"))
        .finally(() => setLoading(false));
    });
    return () => { active = false; };
  }, [params]);

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#070A0F] px-6 py-5"><div className="mx-auto max-w-[1200px]"><Link href="/recruiter/workflow" className="text-sm text-cyan-100">Back to workflow</Link><h1 className="mt-2 text-2xl font-semibold text-white">Candidate360 Action Panel</h1><p className="mt-1 text-sm text-slate-400">Dry-run workflow actions only. Candidate records are not updated.</p></div></div>
      <section className="mx-auto max-w-[1200px] px-6 py-6">
        {loading ? <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading Candidate360 workflow...</div> : null}
        {error ? <div className="border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {panel ? <div className="space-y-5">
          <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="text-xl font-semibold text-white">{panel.candidateName}</h2><p className="mt-1 text-sm text-slate-400">{candidateId}</p><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">{[["Workflow status", panel.currentWorkflowStatus], ["Profile quality", panel.profileQualityStatus], ["Validation", panel.validationStatus], ["AI extraction", panel.aiExtractionReviewStatus], ["Staging/apply", panel.stagingApplyHistoryStatus]].map(([label, value]) => <div key={label} className="border border-slate-800 bg-[#05070A] p-3"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-sm font-semibold text-white">{value}</div></div>)}</div></div>
          <div className="grid gap-5 lg:grid-cols-2"><div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Recommended next actions</h3><div className="mt-3 space-y-2">{panel.recommendedNextActions.map((item) => <div key={item.actionId} className="border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300"><div className="font-semibold text-cyan-100">{item.recommendedNextAction.replace(/_/g, " ")}</div><div className="mt-1">{item.reason}</div><div className="mt-1 text-xs text-slate-500">{item.safetyNote}</div></div>)}{!panel.recommendedNextActions.length ? <div className="text-sm text-slate-400">No immediate workflow action.</div> : null}</div></div><div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Allowed actions</h3><div className="mt-3 grid gap-2">{panel.allowedActions.map((item) => <button key={item.action} className="rounded-md border border-cyan-500/30 px-3 py-2 text-left text-sm text-cyan-100">{item.action.replace(/_/g, " ")}<span className="block text-xs text-slate-500">Dry-run preview</span></button>)}</div></div></div>
          <div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Blocked actions</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{panel.blockedActions.map((item) => <div key={item.action} className="border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100"><div className="font-semibold">{item.action.replace(/_/g, " ")}</div><div className="mt-1 text-xs">{item.reasons.join("; ")}</div></div>)}</div></div>
          <div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Timeline / audit history</h3><div className="mt-3 space-y-2">{panel.timeline.map((item) => <div key={`${item.at}-${item.event}`} className="border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300"><div className="text-xs text-slate-500">{item.at}</div><div className="font-semibold text-white">{item.event.replace(/_/g, " ")}</div><div>{item.note}</div></div>)}</div><p className="mt-4 text-sm text-cyan-100">{panel.safetyNote}</p></div>
        </div> : null}
      </section>
    </main>
  );
}
