"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { readStoredWorkflow, type CandidateWorkflowSnapshot } from "./candidate-360-workflow-machine";

type Candidate360ActionButtonProps = {
  candidateId: string;
  taskId?: string;
  workspaceSection?: string;
  href: string;
  children: ReactNode;
  completedLabel?: string;
  tone?: "cyan" | "amber";
};

function fallbackSnapshot(candidateId: string): Partial<CandidateWorkflowSnapshot> {
  return { candidateId, nextActionId: "implementation", completedIds: [] };
}


export default function Candidate360ActionButton({
  candidateId,
  taskId,
  workspaceSection,
  href,
  children,
  completedLabel,
  tone = "cyan",
}: Candidate360ActionButtonProps) {
  const [snapshot, setSnapshot] = useState<Partial<CandidateWorkflowSnapshot>>(() => fallbackSnapshot(candidateId));

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

  const completed = Boolean(taskId && snapshot.completedIds?.includes(taskId));
  const recommended = Boolean(!taskId || snapshot.nextActionId === taskId);

  function handleClick() {
    if (!recommended || completed) return;

    if (taskId) {
      window.dispatchEvent(new CustomEvent("candidate360-complete-task", {
        detail: { candidateId, taskId, workspaceSection },
      }));
    }

    window.setTimeout(() => {
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  if (completed) {
    return (
      <span className="mt-3 inline-flex rounded-full bg-emerald-950/20 px-2.5 py-1 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-500/20 transition duration-200">
        {completedLabel || "Completed"}
      </span>
    );
  }

  if (!recommended) {
    return (
      <span className="mt-3 inline-flex rounded-full bg-slate-950/35 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-800/45 transition duration-200">
        Queued
      </span>
    );
  }

  const toneClass = tone === "amber"
    ? "bg-amber-950/20 text-amber-100 ring-amber-500/15 hover:bg-amber-500/15"
    : "bg-cyan-950/20 text-cyan-100 ring-cyan-500/15 hover:bg-cyan-500/15";

  return (
    <button type="button" aria-current={recommended ? "step" : undefined} onClick={handleClick} className={"c360-focus-ring mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition duration-200 " + toneClass}>
      {children}
    </button>
  );
}
