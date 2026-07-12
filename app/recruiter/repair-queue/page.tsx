"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RepairItem = { repairId: string; candidateId: string; candidateName: string; workflowStatus: string; repairCategory: string; categories: string[]; priority: string; missingFields: string[]; evidenceAvailability: string; recommendedRepairAction: string; blockerReason: string; suggestedBatch: string; readyAfterQuickFix: boolean; safetyNote: string };
type RepairQueueResponse = { generatedAt: string; summary: Record<string, number>; items: RepairItem[] };

const CARDS: Array<[string, string]> = [["Needs repair", "needsRepair"], ["Quick fixes", "quickFixes"], ["AI extractable", "aiExtractable"], ["Manual review", "manualReview"], ["Duplicate conflicts", "duplicateConflicts"], ["Reupload required", "reuploadRequired"], ["Low evidence", "lowEvidence"], ["Archive review", "archiveReview"], ["P0", "p0"], ["P1", "p1"], ["P2", "p2"], ["P3", "p3"], ["P4", "p4"], ["P5", "p5"]];

function tone(priority: string) {
  if (priority === "P0") return "border-red-500/40 bg-red-500/10 text-red-100";
  if (priority === "P1") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  if (priority === "P2") return "border-cyan-500/40 bg-cyan-500/10 text-cyan-100";
  if (priority === "P3") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-slate-700 bg-slate-500/10 text-slate-200";
}

export default function RepairQueuePage() {
  const [data, setData] = useState<RepairQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/recruiter/repair-queue/summary", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load repair queue");
        setData(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load repair queue");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const items = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.items || []).filter((item) => {
      const matchesFilter = filter === "all" || item.priority === filter || item.repairCategory === filter || item.categories.includes(filter) || (filter === "missing_company" && item.missingFields.includes("currentCompany")) || (filter === "missing_title" && item.missingFields.includes("title")) || (filter === "missing_module" && item.missingFields.includes("primarySapModule")) || (filter === "missing_location" && item.missingFields.includes("location")) || (filter === "ready_after_quick_fix" && item.readyAfterQuickFix);
      const haystack = `${item.candidateName} ${item.candidateId} ${item.repairCategory} ${item.priority} ${item.missingFields.join(" ")} ${item.recommendedRepairAction}`.toLowerCase();
      return matchesFilter && (!text || haystack.includes(text));
    });
  }, [data, filter, query]);

  const filters = ["all", "P0", "P1", "P2", "P3", "P4", "P5", "quick_fix_missing_company", "quick_fix_missing_title", "quick_fix_missing_module", "quick_fix_missing_location", "ai_extractable", "manual_review_required", "duplicate_conflict", "requires_original_file_reupload", "ready_after_quick_fix"];

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#070A0F] px-6 py-5"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-white">Repair Queue</h1><p className="mt-1 text-sm text-slate-400">REPAIR QUEUE IS READ-ONLY. This page does not update candidate records.</p></div><span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100">No DB writes</span></div></div>
      <section className="mx-auto max-w-[1500px] px-6 py-6">
        {error ? <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading repair queue...</div> : null}
        {data ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{CARDS.map(([label, key]) => <div key={key} className="border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold text-white">{data.summary[key] ?? 0}</div></div>)}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border border-slate-800 bg-[#0B0F16] p-4">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${filter === item ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>{item.replace(/_/g, " ")}</button>)}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate, category, missing field" className="min-w-72 flex-1 rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" /></div>
        <div className="mt-5 overflow-auto border border-slate-800 bg-[#0B0F16]"><table className="min-w-[1300px] w-full border-collapse text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr className="border-b border-slate-800">{["Candidate", "Candidate ID", "Repair category", "Priority", "Missing fields", "Evidence", "Recommended repair action", "Blocker reason", "Suggested batch", "Workflow status", "Safety note"].map((head) => <th key={head} className="px-3 py-3 font-semibold">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{items.map((item) => <tr key={item.repairId} className="align-top hover:bg-slate-900/40"><td className="px-3 py-3 text-slate-100"><Link href={`/recruiter/candidate360/${item.candidateId}`} className="hover:text-cyan-100">{item.candidateName}</Link></td><td className="px-3 py-3 text-xs text-slate-400">{item.candidateId}</td><td className="px-3 py-3 text-cyan-100">{item.repairCategory.replace(/_/g, " ")}</td><td className="px-3 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone(item.priority)}`}>{item.priority}</span></td><td className="px-3 py-3 text-slate-300">{item.missingFields.join(", ") || "None"}</td><td className="px-3 py-3 text-slate-300">{item.evidenceAvailability.replace(/_/g, " ")}</td><td className="px-3 py-3 text-slate-300">{item.recommendedRepairAction}</td><td className="px-3 py-3 text-slate-400">{item.blockerReason}</td><td className="px-3 py-3 text-slate-300">{item.suggestedBatch.replace(/_/g, " ")}</td><td className="px-3 py-3 text-slate-300">{item.workflowStatus.replace(/_/g, " ")}</td><td className="px-3 py-3 text-slate-400">{item.safetyNote}</td></tr>)}</tbody></table>{!items.length ? <div className="p-5 text-sm text-slate-400">No repair queue items match this view.</div> : null}</div></> : null}
      </section>
    </main>
  );
}
