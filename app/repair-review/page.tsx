"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RepairAction = "all" | "safe_to_apply_later" | "needs_recruiter_review" | "insufficient_evidence";
type SearchableFilter = "all" | "true" | "false";

type RepairItem = {
  candidateId: string;
  current: Record<string, string>;
  suggested: Record<string, string>;
  confidence: Record<string, number>;
  evidence: Record<string, string>;
  overallConfidence: number;
  action: string;
  searchableAfterRepair: boolean;
  profileHref: string;
  reviewLabel: string;
};

type RepairResponse = {
  items: RepairItem[];
  totalMatched: number;
  returnedCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalValidationQueue: number;
    safeToApplyLater: number;
    needsRecruiterReview: number;
    insufficientEvidence: number;
    suggestedSearchableAfterRepair: number;
  };
  mode: string;
  error?: string;
};

const ACTION_TABS: Array<{ key: RepairAction; label: string }> = [
  { key: "all", label: "All" },
  { key: "safe_to_apply_later", label: "Safe to Apply Later" },
  { key: "needs_recruiter_review", label: "Needs Recruiter Review" },
  { key: "insufficient_evidence", label: "Insufficient Evidence" },
];

const FIELDS = ["displayName", "title", "company", "module", "location", "email", "phone"];

function evidenceParts(value: string) {
  const source = value.match(/source=([^;]+)/)?.[1] || "unknown";
  const evidence = value.match(/evidence=(.*)$/)?.[1] || value || "No evidence";
  return { source, evidence: evidence.replace(/;.*$/, "") };
}

function actionTone(action: string) {
  if (action === "safe_to_apply_later") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (action === "needs_recruiter_review") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-slate-500/30 bg-slate-500/10 text-slate-100";
}

export default function RepairReviewPage() {
  const [data, setData] = useState<RepairResponse | null>(null);
  const [action, setAction] = useState<RepairAction>("all");
  const [searchableAfterRepair, setSearchableAfterRepair] = useState<SearchableFilter>("all");
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
        const params = new URLSearchParams({ page: String(page), pageSize: "25", action, searchableAfterRepair });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/repair-review?${params.toString()}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load repair review");
        setData(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load repair review");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [action, searchableAfterRepair, query, page]);

  useEffect(() => setPage(1), [action, searchableAfterRepair, query]);

  const cards = useMemo(() => [
    ["Validation Queue", data?.summary.totalValidationQueue],
    ["Safe Later", data?.summary.safeToApplyLater],
    ["Recruiter Review", data?.summary.needsRecruiterReview],
    ["Insufficient", data?.summary.insufficientEvidence],
    ["Searchable After Repair", data?.summary.suggestedSearchableAfterRepair],
  ], [data]);

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#080B10]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Repair Review</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Candidate repair suggestions</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">READ-ONLY / No DB Write</span>
            <Link href="/validation-queue" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Validation Queue</Link>
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
            {ACTION_TABS.map((tab) => (
              <button key={tab.key} onClick={() => setAction(tab.key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${action === tab.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>{tab.label}</button>
            ))}
            <button onClick={() => setSearchableAfterRepair(searchableAfterRepair === "true" ? "all" : "true")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${searchableAfterRepair === "true" ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>Searchable After Repair</button>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, title, company, module" className="h-10 min-w-0 rounded-md border border-slate-700 bg-[#05070A] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400 md:w-96" />
        </div>

        {error ? <div className="mt-6 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="mt-6 border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading repair review...</div> : null}

        {!loading && !error ? (
          <div className="mt-6 overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0B0F16] px-4 py-3 text-sm text-slate-300">
              <div>Page {data?.currentPage || 1} of {data?.totalPages || 0} - {data?.returnedCount || 0} shown</div>
              <div className="flex gap-2">
                <button onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={!data || data.currentPage <= 1} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <button onClick={() => setPage((current) => current + 1)} disabled={!data || data.currentPage >= data.totalPages} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
            <div className="divide-y divide-slate-800 bg-[#070A0F]">
              {(data?.items || []).map((item) => (
                <article key={item.candidateId} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{item.suggested.displayName || item.current.displayName || item.candidateId}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.suggested.title || item.current.title} ? {item.suggested.company || item.current.company}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${actionTone(item.action)}`}>{item.reviewLabel}</span>
                      <span className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-200">Confidence {item.overallConfidence}</span>
                      <Link href={item.profileHref} className="rounded-md bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">Candidate360</Link>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {FIELDS.map((field) => {
                      const evidence = evidenceParts(item.evidence[field] || "");
                      const changed = item.suggested[field] && item.suggested[field] !== item.current[field];
                      return (
                        <div key={`${item.candidateId}-${field}`} className="border border-slate-800 bg-[#0B0F16] p-3 text-sm">
                          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{field}</div>
                          <div className="mt-1 text-slate-400">Current: <span className="text-slate-200">{item.current[field] || "empty"}</span></div>
                          <div className="mt-1 text-slate-400">Suggested: <span className={changed ? "font-semibold text-cyan-100" : "text-slate-300"}>{item.suggested[field] || "empty"}</span></div>
                          <div className="mt-1 text-xs text-slate-500">{item.confidence[field] || 0} ? {evidence.source}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">{evidence.evidence}</div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
              {!data?.items?.length ? <div className="p-6 text-slate-400">No repair suggestions in this view.</div> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
