"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CandidateLifecycleRecord } from "@/lib/candidateLifecycleTypes";
import { WorkflowNotificationBadge } from "@/app/recruiter/components/WorkflowNotificationBadge";
import { WorkflowSlaBadge } from "@/app/recruiter/components/WorkflowSlaBadge";
import { WorkflowKanbanBoard } from "./WorkflowKanbanBoard";

type WorkflowSummaryResponse = {
  generatedAt: string;
  lastUpdatedAt?: string;
  stateSource?: string;
  summary: Record<string, number>;
  actionQueue: Array<{ actionId: string; candidateId: string; candidateName: string; currentStatus: string; recommendedNextAction: string; reason: string; priority: "high" | "medium" | "low"; missingData: string[]; lastUpdated: string; safetyNote: string; lifecycle?: CandidateLifecycleRecord | null }>;
};

const CARDS: Array<[string, string]> = [
  ["New profiles", "newProfiles"],
  ["Needs validation", "needsValidation"],
  ["AI review needed", "aiReviewNeeded"],
  ["Needs repair", "needsRepair"],
  ["Ready for shortlist", "readyForShortlist"],
  ["Shortlisted", "shortlisted"],
  ["Submitted", "submitted"],
  ["Interview process", "interviewProcess"],
  ["Offer process", "offerProcess"],
  ["Placed", "placed"],
  ["Rejected", "rejected"],
  ["Archived", "archived"],
  ["Action required today", "actionRequiredToday"],
];

function priorityTone(priority: string) {
  if (priority === "high") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (priority === "medium") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-slate-600 bg-slate-500/10 text-slate-200";
}

export default function RecruiterWorkflowPage() {
  const [data, setData] = useState<WorkflowSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/recruiter/workflow/summary", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load workflow summary");
        setData(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load workflow summary");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const queue = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.actionQueue || []).filter((item) => {
      const matchesFilter = filter === "all" || item.priority === filter || item.currentStatus === filter;
      const haystack = [
        item.candidateName,
        item.candidateId,
        item.currentStatus,
        item.recommendedNextAction,
        item.reason,
        item.missingData.join(" "),
        item.lifecycle?.stage,
        item.lifecycle?.ownerName,
        item.lifecycle?.nextAction,
        item.lifecycle?.nextActionDueAt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!text || haystack.includes(text));
    });
  }, [data, filter, query]);

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#070A0F] px-6 py-5">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold text-white">Data Workflow</h1><span className="rounded-full border border-slate-600 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">Admin / Data</span></div>
            <p className="mt-1 text-sm text-slate-400">Internal data quality and workflow state.</p><p className="mt-2 text-xs text-amber-100">Admin/Data tool. Read-only preview unless an explicit approved flow is used.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/recruiter/workflow/timeline" className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-100">Timeline</Link><WorkflowSlaBadge compact /><WorkflowNotificationBadge compact /><Link href="/recruiter/workflow/copilot" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">Copilot</Link><Link href="/recruiter/workflow/analytics" className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-100">Analytics</Link><Link href="/recruiter/smart-shortlist" className="rounded-md bg-cyan-400 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-950">Smart Shortlist</Link><Link href="/recruiter/import-staging" className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100">Import staging</Link><span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100">No candidate DB writes</span>{data?.stateSource ? <span className="rounded-md border border-slate-700 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">State source: {data.stateSource}</span> : null}</div>
        </div>
      </div>
      <section className="mx-auto max-w-[1500px] px-6 py-6">
        {error ? <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading workflow...</div> : null}
        {data ? (
          <>
            <div className="mb-5 border border-slate-800 bg-[#0B0F16] p-3 text-sm text-slate-400">State source: <span className="font-semibold text-cyan-100">{data.stateSource || "live inference"}</span> - Generated: {data.generatedAt || "Not available"} - Last updated: {data.lastUpdatedAt || data.generatedAt || "Not available"}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {CARDS.map(([label, key]) => <div key={key} className="border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold text-white">{data.summary[key] ?? 0}</div></div>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border border-slate-800 bg-[#0B0F16] p-4">
              {["all", "high", "medium", "low", "needs_validation", "needs_repair", "ai_review_needed", "ready_for_shortlist"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${filter === item ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>{item.replace(/_/g, " ")}</button>)}
              <div className="flex rounded-md border border-slate-700 bg-[#05070A] p-1">
                <button
                  className={`rounded px-3 py-1.5 text-sm font-semibold ${
                    viewMode === "board"
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setViewMode("board")}
                  type="button"
                >
                  Board
                </button>

                <button
                  className={`rounded px-3 py-1.5 text-sm font-semibold ${
                    viewMode === "table"
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setViewMode("table")}
                  type="button"
                >
                  Table
                </button>
              </div>

              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate, status, action, missing data" className="min-w-72 flex-1 rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
            </div>
            <div className={viewMode === "board" ? "mt-5" : "hidden"}>
              <WorkflowKanbanBoard items={queue} />
            </div>

            <div className={viewMode === "table" ? "block" : "hidden"}>
              <div className="mt-5 text-xs text-slate-500">
                Scroll horizontally to review complete workflow evidence and safety notes.
              </div>

              <div className="mt-2 overflow-auto rounded-xl border border-slate-800 bg-[#0B0F16]">
              <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr className="border-b border-slate-800">{["Candidate", "Candidate ID", "Pipeline stage", "Owner", "Lifecycle next action", "Due date", "Legacy status", "Reason", "Priority", "Missing data", "Last updated", "Safety note"].map((head) => <th key={head} className={`px-3 py-3 font-semibold ${head==="Candidate"?"sticky left-0 z-20 bg-[#0B0F16]":""}`}>{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {queue.map((item) => <tr key={item.actionId} className="align-top hover:bg-slate-900/40"><td className="sticky left-0 z-10 bg-[#0B0F16] px-3 py-3 text-slate-100"><Link href={`/recruiter/candidate360/${item.candidateId}`} className="hover:text-cyan-100">{item.candidateName}</Link></td><td className="px-3 py-3 text-xs text-slate-400">{item.candidateId}</td><td className="px-3 py-3 font-semibold text-cyan-100">{(item.lifecycle?.stage || "sourced").replace(/_/g, " ")}</td><td className="px-3 py-3 text-slate-300">{item.lifecycle?.ownerName || "Unassigned"}</td><td className="px-3 py-3 text-cyan-100">{(item.lifecycle?.nextAction || item.recommendedNextAction).replace(/_/g, " ")}</td><td className="px-3 py-3 text-xs text-slate-400">{item.lifecycle?.nextActionDueAt || "Not scheduled"}</td><td className="px-3 py-3 text-slate-400">{item.currentStatus.replace(/_/g, " ")}</td><td className="px-3 py-3 text-slate-400">{item.reason}</td><td className="px-3 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityTone(item.priority)}`}>{item.priority}</span></td><td className="px-3 py-3 text-slate-300">{item.missingData.join(", ") || "None"}</td><td className="px-3 py-3 text-xs text-slate-500">{item.lastUpdated}</td><td className="px-3 py-3 text-slate-400">{item.safetyNote}</td></tr>)}
                </tbody>
              </table>
                {!queue.length ? (
                  <div className="p-5 text-sm text-slate-400">
                    No workflow actions match this view.
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
