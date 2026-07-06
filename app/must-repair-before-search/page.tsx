"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Priority = "all" | "critical_identity" | "invalid_title" | "invalid_company" | "status_issue" | "low_quality" | "other";

type MustRepairItem = {
  candidateId: string;
  displayName: string;
  title: string;
  company: string;
  modules: string[];
  location: string;
  score: number;
  riskFlags: string[];
  missingFields: string[];
  reasons: string[];
  recommendedAction: string;
  profileHref: string;
  repairPriority: Exclude<Priority, "all">;
  suggestedNextStep: string;
};

type MustRepairResponse = {
  items: MustRepairItem[];
  totalMatched: number;
  returnedCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalMustRepair: number;
    byPriority: Record<string, number>;
    bySuggestedNextStep: Record<string, number>;
  };
  mode: string;
  error?: string;
};

const PRIORITIES: Array<{ key: Priority; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical_identity", label: "Critical Identity" },
  { key: "invalid_title", label: "Invalid Title" },
  { key: "invalid_company", label: "Invalid Company" },
  { key: "status_issue", label: "Status Issue" },
  { key: "low_quality", label: "Low Quality" },
  { key: "other", label: "Other" },
];

function priorityTone(priority: string) {
  if (priority === "critical_identity" || priority === "status_issue") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (priority === "invalid_title" || priority === "invalid_company") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (priority === "low_quality") return "border-purple-500/30 bg-purple-500/10 text-purple-100";
  return "border-slate-500/30 bg-slate-500/10 text-slate-100";
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function MustRepairBeforeSearchPage() {
  const [data, setData] = useState<MustRepairResponse | null>(null);
  const [priority, setPriority] = useState<Priority>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "25", priority });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/must-repair-before-search?${params.toString()}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load must-repair review");
        setData(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load must-repair review");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [priority, query, page]);

  useEffect(() => setPage(1), [priority, query]);

  const cards = useMemo(() => [
    ["Must Repair", data?.summary.totalMustRepair],
    ["Invalid Title", data?.summary.byPriority.invalid_title],
    ["Invalid Company", data?.summary.byPriority.invalid_company],
    ["Status Issue", data?.summary.byPriority.status_issue],
    ["Manual Review", data?.summary.bySuggestedNextStep.manual_review_required],
  ], [data]);

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#080B10]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Must Repair Before Search</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Profiles to fix before market release</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">READ-ONLY / No DB Write</span>
            <Link href="/repair-review" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Repair Review</Link>
            <Link href="/search" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Talent Search</Link>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-4 md:grid-cols-5">
          {cards.map(([label, value]) => (
            <div key={String(label)} className="border border-slate-800 bg-[#0B0F16] p-4">
              <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{value ?? "-"}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 border border-slate-800 bg-[#0B0F16] p-4">
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((entry) => (
              <button key={entry.key} onClick={() => setPriority(entry.key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${priority === entry.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>{entry.label}</button>
            ))}
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, title, company, module, risk" className="h-10 min-w-0 rounded-md border border-slate-700 bg-[#05070A] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400 md:w-96" />
        </div>

        {error ? <div className="mt-6 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="mt-6 border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading must-repair review...</div> : null}

        {!loading && !error ? (
          <div className="mt-6 overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0B0F16] px-4 py-3 text-sm text-slate-300">
              <div>Page {data?.currentPage || 1} of {data?.totalPages || 0} - {data?.returnedCount || 0} shown from {data?.totalMatched || 0}</div>
              <div className="flex gap-2">
                <button onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={!data || data.currentPage <= 1} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <button onClick={() => setPage((current) => current + 1)} disabled={!data || data.currentPage >= data.totalPages} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
            <div className="divide-y divide-slate-800 bg-[#070A0F]">
              {(data?.items || []).map((item) => (
                <article key={item.candidateId} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{item.displayName || item.candidateId}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.title || "No title"} / {item.company || "Not disclosed"}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.modules.join(", ") || "No module"} / {item.location || "No location"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityTone(item.repairPriority)}`}>{titleCase(item.repairPriority)}</span>
                      <span className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-200">Score {item.score}</span>
                      <Link href={item.profileHref} className="rounded-md bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">Candidate360</Link>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="border border-slate-800 bg-[#0B0F16] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Current Bad Field Values</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-300">
                        <div>Title: <span className="text-slate-100">{item.title || "empty"}</span></div>
                        <div>Company: <span className="text-slate-100">{item.company || "empty"}</span></div>
                        <div>Modules: <span className="text-slate-100">{item.modules.join(", ") || "empty"}</span></div>
                      </div>
                    </div>
                    <div className="border border-slate-800 bg-[#0B0F16] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Risk Flags</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.riskFlags.map((flag) => <span key={flag} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200">{flag}</span>)}
                      </div>
                    </div>
                    <div className="border border-slate-800 bg-[#0B0F16] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Suggested Next Step</div>
                      <div className="mt-2 text-sm font-semibold text-cyan-100">{titleCase(item.suggestedNextStep)}</div>
                      <div className="mt-2 text-xs text-slate-500">Action: {item.recommendedAction}</div>
                      <div className="mt-2 text-xs text-slate-500">{item.reasons.join("; ") || "Manual review required"}</div>
                    </div>
                  </div>
                </article>
              ))}
              {!data?.items?.length ? <div className="p-6 text-slate-400">No must-repair profiles in this view.</div> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}