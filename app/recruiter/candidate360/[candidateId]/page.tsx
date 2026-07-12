"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type QuickFixPanel = { candidateId: string; candidateName: string; suggestions: Array<{ suggestionId: string; fieldName: string; suggestedValue: string; confidence: number; evidenceSnippet: string; validationStatus: string; approvalReadiness: string; validationReasons: string[] }>; suggestedNextAction: string; safetyNote: string };

type RepairPanel = { candidateId: string; repairCategory: string; priority: string; missingFields: string[]; recommendedRepairAction: string; evidenceAvailability: string; blockedFromShortlistReason: string; suggestedNextStep: string; aiReviewStatus: string; applyHistoryStatus: string; safetyNote: string };

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
  recommendedNextAction?: string;
  blockerReasons?: string[];
  missingFields?: string[];
  applyHistoryStatus?: string;
  lastUpdatedAt?: string;
  stateSource?: string;
};

export default function Candidate360WorkflowPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const [candidateId, setCandidateId] = useState("");
  const [panel, setPanel] = useState<Candidate360Panel | null>(null);
  const [repairPanel, setRepairPanel] = useState<RepairPanel | null>(null);
  const [quickFixPanel, setQuickFixPanel] = useState<QuickFixPanel | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    params.then(({ candidateId }) => {
      if (!active) return;
      setCandidateId(candidateId);
      fetch(`/api/recruiter/repair-queue/candidate/${candidateId}`).then(async (res) => { if (res.ok) setRepairPanel(await res.json()); }).catch(() => undefined);
      fetch(`/api/recruiter/quick-fix-repair/candidate/${candidateId}`).then(async (res) => { if (res.ok) setQuickFixPanel(await res.json()); }).catch(() => undefined);
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
      <div className="border-b border-slate-800 bg-[#070A0F] px-6 py-5"><div className="mx-auto max-w-[1200px]"><Link href="/recruiter/workflow" className="text-sm text-cyan-100">Back to workflow</Link><h1 className="mt-2 text-2xl font-semibold text-white">Candidate360 Action Panel</h1><p className="mt-1 text-sm text-slate-400">Dry-run workflow actions only. Candidate records are not updated.</p>{panel?.stateSource ? <p className="mt-1 text-sm text-cyan-100">State source: {panel.stateSource}</p> : null}</div></div>
      <section className="mx-auto max-w-[1200px] px-6 py-6">
        {loading ? <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading Candidate360 workflow...</div> : null}
        {error ? <div className="border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {panel ? <div className="space-y-5">
          <div className="border border-slate-800 bg-[#0B0F16] p-5"><h2 className="text-xl font-semibold text-white">{panel.candidateName}</h2><p className="mt-1 text-sm text-slate-400">{candidateId}</p><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">{[["Workflow status", panel.currentWorkflowStatus], ["Next action", panel.recommendedNextAction || panel.recommendedNextActions[0]?.recommendedNextAction || "No action"], ["Profile quality", panel.profileQualityStatus], ["Validation", panel.validationStatus], ["AI extraction", panel.aiExtractionReviewStatus], ["Staging/apply", panel.stagingApplyHistoryStatus], ["Apply history", panel.applyHistoryStatus || "Not available"], ["Last updated", panel.lastUpdatedAt || "Not available"]].map(([label, value]) => <div key={label} className="border border-slate-800 bg-[#05070A] p-3"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-sm font-semibold text-white">{value}</div></div>)}</div></div>

          {repairPanel ? <div className="border border-cyan-500/20 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Repair queue</h3><div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{[["Repair category", repairPanel.repairCategory], ["Priority", repairPanel.priority], ["Missing fields", repairPanel.missingFields.join(", ") || "None"], ["Evidence", repairPanel.evidenceAvailability], ["Suggested next step", repairPanel.suggestedNextStep], ["AI review", repairPanel.aiReviewStatus], ["Apply history", repairPanel.applyHistoryStatus]].map(([label, value]) => <div key={label} className="border border-slate-800 bg-[#05070A] p-3"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-sm font-semibold text-white">{value}</div></div>)}</div><div className="mt-4 border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300"><div className="font-semibold text-cyan-100">{repairPanel.recommendedRepairAction}</div><div className="mt-1 text-amber-100">Why blocked: {repairPanel.blockedFromShortlistReason}</div><div className="mt-1 text-xs text-slate-500">{repairPanel.safetyNote}</div></div></div> : null}
          {quickFixPanel?.suggestions?.length ? <div className="border border-emerald-500/20 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Quick fix suggestions</h3><p className="mt-1 text-sm text-slate-400">{quickFixPanel.suggestedNextAction}</p><div className="mt-3 grid gap-3 md:grid-cols-2">{quickFixPanel.suggestions.map((item) => <div key={item.suggestionId} className="border border-slate-800 bg-[#05070A] p-3 text-sm"><div className="font-semibold text-cyan-100">{item.fieldName}: {item.suggestedValue || "Not available"}</div><div className="mt-1 text-slate-300">Confidence: {item.confidence}%</div><div className="mt-1 text-slate-400">{item.evidenceSnippet || "Missing evidence"}</div><div className="mt-1 text-xs text-amber-100">{item.validationStatus.replace(/_/g, " ")} ? {item.approvalReadiness.replace(/_/g, " ")}</div></div>)}</div><p className="mt-3 text-xs text-slate-500">{quickFixPanel.safetyNote}</p></div> : null}
          <div className="grid gap-5 lg:grid-cols-2"><div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Recommended next actions</h3><div className="mt-3 space-y-2">{panel.recommendedNextActions.map((item) => <div key={item.actionId} className="border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300"><div className="font-semibold text-cyan-100">{item.recommendedNextAction.replace(/_/g, " ")}</div><div className="mt-1">{item.reason}</div><div className="mt-1 text-xs text-slate-500">{item.safetyNote}</div></div>)}{!panel.recommendedNextActions.length ? <div className="text-sm text-slate-400">No immediate workflow action.</div> : null}</div></div><div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Allowed actions</h3><div className="mt-3 grid gap-2">{panel.allowedActions.map((item) => <button key={item.action} className="rounded-md border border-cyan-500/30 px-3 py-2 text-left text-sm text-cyan-100">{item.action.replace(/_/g, " ")}<span className="block text-xs text-slate-500">Dry-run preview</span></button>)}</div></div></div>
          <div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Blocked actions</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{panel.blockedActions.map((item) => <div key={item.action} className="border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100"><div className="font-semibold">{item.action.replace(/_/g, " ")}</div><div className="mt-1 text-xs">{item.reasons.join("; ")}</div></div>)}</div></div>
          <div className="border border-slate-800 bg-[#0B0F16] p-5"><h3 className="font-semibold text-white">Timeline / audit history</h3><div className="mt-3 space-y-2">{panel.timeline.map((item) => <div key={`${item.at}-${item.event}`} className="border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300"><div className="text-xs text-slate-500">{item.at}</div><div className="font-semibold text-white">{item.event.replace(/_/g, " ")}</div><div>{item.note}</div></div>)}</div>{panel.missingFields?.length ? <p className="mt-4 text-sm text-amber-100">Missing fields: {panel.missingFields.join(", ")}</p> : null}{panel.blockerReasons?.length ? <p className="mt-2 text-sm text-amber-100">Blockers: {panel.blockerReasons.join("; ")}</p> : null}<p className="mt-4 text-sm text-cyan-100">{panel.safetyNote}</p></div>
        </div> : null}
      </section>
    </main>
  );
}
