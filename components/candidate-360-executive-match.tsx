"use client";

import { useEffect, useState } from "react";
import { readStoredWorkflow, type CandidateWorkflowSnapshot } from "./candidate-360-workflow-machine";

type Candidate360ExecutiveMatchProps = {
  candidateId: string;
  initialSnapshot: CandidateWorkflowSnapshot;
  bestFit: string;
  primaryValidation: string;
  contactStatus: string;
};


export default function Candidate360ExecutiveMatch({
  candidateId,
  initialSnapshot,
  bestFit,
  primaryValidation,
  contactStatus,
}: Candidate360ExecutiveMatchProps) {
  const [snapshot, setSnapshot] = useState<CandidateWorkflowSnapshot>(initialSnapshot);

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<CandidateWorkflowSnapshot & { candidateId?: string }>).detail;
      if (!detail || detail.candidateId !== candidateId) return;
      setSnapshot((current) => ({ ...current, ...detail }));
    }

    setSnapshot((current) => ({ ...current, ...readStoredWorkflow(candidateId) }));
    window.addEventListener("candidate360-workflow", handle);
    return () => window.removeEventListener("candidate360-workflow", handle);
  }, [candidateId]);

  return (
    <div className="c360-surface-1 c360-hover-lift flex h-full flex-col rounded-[24px] p-4 ring-1 transition duration-200">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Executive Match</div>
      <div className={(snapshot.allComplete ? "bg-emerald-950/18 ring-emerald-500/18" : "c360-surface-2") + " mt-3 rounded-2xl px-3 py-2 ring-1 transition-all duration-200"}>
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Submission Status</div>
        <div className={(snapshot.allComplete ? "text-emerald-100" : "text-white") + " mt-1 text-2xl font-black tracking-tight transition-colors duration-200"}>{snapshot.submissionStatus}</div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="c360-surface-2 rounded-2xl px-3 py-2 ring-1 transition duration-200">
          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200">Current Stage</div>
          <div className="mt-1 text-lg font-black text-cyan-100">{snapshot.currentStage}</div>
        </div>
        <div className="c360-surface-2 rounded-2xl px-3 py-2 transition duration-200">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Next Best Action</div>
          <div className="mt-1 text-sm font-black text-white">{snapshot.nextBestAction}</div>
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-slate-800/45 pt-4 text-sm">
        <div className="flex items-start justify-between gap-4"><span className="text-slate-500">Best Fit</span><span className="text-right font-semibold text-white">{bestFit}</span></div>
        <div className="flex items-start justify-between gap-4"><span className="text-slate-500">Primary Validation</span><span className={(snapshot.allComplete ? "text-emerald-100" : "text-amber-100") + " text-right font-semibold transition-colors duration-200"}>{snapshot.allComplete ? "Verified" : primaryValidation}</span></div>
        <div className="flex items-start justify-between gap-4"><span className="text-slate-500">Contact Status</span><span className="text-right font-semibold text-white">{contactStatus}</span></div>
      </div>
    </div>
  );
}
