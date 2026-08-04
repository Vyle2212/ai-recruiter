"use client";

import { useEffect, useState } from "react";
import { readStoredWorkflow, type CandidateWorkflowSnapshot } from "./candidate-360-workflow-machine";

type RiskItem = {
  taskId: string;
  risk: string;
  status: string;
  action: string;
};

type Candidate360RiskWorkflowProps = {
  candidateId: string;
  initialSnapshot: CandidateWorkflowSnapshot;
  riskItems: RiskItem[];
};


function workspaceForTask(taskId: string) {
  if (/compensation|salary/i.test(taskId)) return "salary-discussion";
  if (/implementation|delivery|project|s4hana|btp/i.test(taskId)) return "key-risks";
  return "next-follow-up";
}

export default function Candidate360RiskWorkflow({ candidateId, initialSnapshot, riskItems }: Candidate360RiskWorkflowProps) {
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

  const completedIds = new Set(snapshot.completedIds || []);
  const unresolved = riskItems.filter((item) => !completedIds.has(item.taskId));

  function validate(item: RiskItem) {
    window.dispatchEvent(new CustomEvent("candidate360-complete-task", {
      detail: { candidateId, taskId: item.taskId, workspaceSection: workspaceForTask(item.taskId) },
    }));
    window.setTimeout(() => {
      document.getElementById("validation-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function generateSubmission() {
    window.dispatchEvent(new CustomEvent("candidate360-complete-task", { detail: { candidateId, taskId: "submit-candidate", workspaceSection: "client-positioning" } }));
    window.setTimeout(() => {
      document.getElementById("recruiter-notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  return (
    <section className="c360-surface-1 rounded-[24px] p-3 ring-1" id="remaining-risks">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Remaining Risks</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">Unresolved blockers only</div>
        </div>
        <div className="text-xs font-semibold text-slate-500">{unresolved.length ? String(unresolved.length) + " open" : "All clear"}</div>
      </div>
      {unresolved.length ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {unresolved.map((item) => (
            <div key={item.risk} className="c360-hover-lift rounded-2xl bg-amber-950/12 p-3 ring-1 ring-amber-500/12 transition-all duration-200 hover:bg-amber-950/18 hover:ring-amber-500/20">
              <div className="text-sm font-bold text-amber-100">{item.risk}</div>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Status</div>
              <div className="mt-1 text-xs font-semibold leading-5 text-slate-200">{item.status}</div>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Next Action</div>
              <div className="mt-1 text-xs font-semibold text-amber-100">{item.action}</div>
              {snapshot.nextActionId === item.taskId ? (
                <button type="button" onClick={() => validate(item)} className="c360-focus-ring mt-3 inline-flex rounded-full bg-amber-950/20 px-2.5 py-1 text-[11px] font-bold text-amber-100 ring-1 ring-amber-500/15 transition duration-200 hover:bg-amber-500/15">{snapshot.nextActionLabel}</button>
              ) : (
                <span className="mt-3 inline-flex rounded-full bg-slate-950/35 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-800/45">Queued</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="c360-hover-lift rounded-2xl bg-emerald-950/16 p-3 ring-1 ring-emerald-500/20 transition-all duration-200">
          <div className="text-sm font-bold text-emerald-100">All validations complete</div>
          <div className="mt-1 text-xs leading-5 text-emerald-100/80">No unresolved submission blockers remain. Prepare the client submission package.</div>
          <button type="button" onClick={generateSubmission} className="c360-focus-ring mt-3 inline-flex rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 ring-1 ring-emerald-500/25 transition hover:bg-emerald-500/20">{snapshot.nextActionLabel}</button>
        </div>
      )}
    </section>
  );
}
