"use client";

import { useEffect, useState } from "react";
import { CANDIDATE_WORKFLOW_STAGES, readStoredWorkflow, type CandidateWorkflowSnapshot, type CandidateWorkflowStageStatus } from "./candidate-360-workflow-machine";

type Candidate360WorkflowStripProps = {
  candidateId: string;
  initialSnapshot: CandidateWorkflowSnapshot;
};


function stageIcon(status: CandidateWorkflowStageStatus) {
  if (status === "Completed") return "\u2713";
  if (status === "Current" || status === "Active") return "\u25CF";
  if (status === "Blocked") return "Blocked";
  if (status === "Waiting") return "Waiting";
  return "\u25CB";
}

function stageClass(status: CandidateWorkflowStageStatus) {
  if (status === "Completed") return "bg-emerald-950/16 text-emerald-100 ring-emerald-500/15";
  if (status === "Blocked") return "bg-amber-950/18 text-amber-100 ring-amber-500/20 shadow-[0_0_22px_rgba(251,191,36,0.08)]";
  if (status === "Current" || status === "Active") return "bg-cyan-950/25 text-cyan-100 ring-cyan-500/25 shadow-[0_0_22px_rgba(103,232,249,0.08)]";
  if (status === "Waiting") return "c360-surface-2 text-slate-300 ring-1";
  return "c360-surface-1 text-slate-500 ring-1 opacity-70";
}

export default function Candidate360WorkflowStrip({ candidateId, initialSnapshot }: Candidate360WorkflowStripProps) {
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

  function handleNextAction() {
    window.dispatchEvent(new CustomEvent("candidate360-complete-task", {
      detail: { candidateId, taskId: snapshot.nextActionId, workspaceSection: "next-follow-up" },
    }));

    window.setTimeout(() => {
      const target = snapshot.nextActionId === "submit-candidate" ? "recruiter-notes" : "validation-checklist";
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <section className="c360-surface-1 rounded-3xl px-4 py-3 ring-1 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Candidate Workflow</div>
          <div className="mt-1 text-sm font-semibold text-slate-200">Current stage: {snapshot.currentStage}</div>
        </div>
        <button type="button" aria-label={"Next best action: " + snapshot.nextBestAction} onClick={handleNextAction} className={(snapshot.allComplete ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/25" : "bg-cyan-950/25 text-cyan-100 ring-cyan-500/20") + " c360-focus-ring rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition duration-200 hover:bg-white/10"}>
          {snapshot.nextBestAction}
        </button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-8">
        {CANDIDATE_WORKFLOW_STAGES.map((stage) => {
          const status = snapshot.stageStatuses?.[stage] || "Locked";
          return (
            <div key={stage} aria-current={status === "Current" || status === "Active" || status === "Blocked" ? "step" : undefined} className={stageClass(status) + " c360-hover-lift rounded-2xl px-3 py-2 ring-1 transition-all duration-200"}>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em]">{stageIcon(status)}</div>
              <div className="mt-1 text-xs font-semibold leading-4">{stage}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
