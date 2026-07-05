"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type QueueIssue = {
  key: string;
  label: string;
  evidence: string;
};

type QueueItem = {
  id: string;
  displayName: string;
  title: string;
  company: string;
  module: string;
  location: string;
  contact: string;
  profileQualityScore: number;
  validationStatus: string;
  validationQueueReason: string;
  primaryIssue: string;
  issues: QueueIssue[];
  profileHref: string;
};

type QueueGroup = {
  key: string;
  label: string;
  count: number;
};

type QueueResponse = {
  items: QueueItem[];
  totalBlocked: number;
  totalMatched: number;
  returnedCount: number;
  filteredCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  groups: QueueGroup[];
  activeGroup: string;
  mode: string;
  error?: string;
};

const ALL_GROUP = { key: "all", label: "All blocked", count: 0 };

function reasonTone(key: string) {
  if (key === "invalid-name") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (key === "missing-contact" || key === "missing-location") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (key === "missing-sap-module") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  if (key === "invalid-title" || key === "invalid-company") return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100";
  return "border-slate-500/30 bg-slate-500/10 text-slate-100";
}

export default function ValidationQueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [activeGroup, setActiveGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadQueue() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ group: activeGroup, page: String(page), pageSize: "25" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/validation-queue?${params.toString()}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load validation queue");
        setData(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load validation queue");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadQueue();
    return () => controller.abort();
  }, [activeGroup, query, page]);

  useEffect(() => {
    setPage(1);
  }, [activeGroup, query]);

  const groups = useMemo(() => {
    const allCount = data?.totalBlocked || 0;
    return [{ ...ALL_GROUP, count: allCount }, ...(data?.groups || [])];
  }, [data]);

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#080B10]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Validation Queue</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Candidate extraction review</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/search" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">
              Talent Search
            </Link>
            <Link href="/audit" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">
              Audit
            </Link>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="border border-slate-800 bg-[#0B0F16] p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Blocked</div>
            <div className="mt-2 text-3xl font-semibold text-white">{data?.totalBlocked ?? "-"}</div>
          </div>
          <div className="border border-slate-800 bg-[#0B0F16] p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Matched</div>
            <div className="mt-2 text-3xl font-semibold text-white">{data?.totalMatched ?? "-"}</div>
          </div>
          <div className="border border-slate-800 bg-[#0B0F16] p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Mode</div>
            <div className="mt-2 text-lg font-semibold text-cyan-100">Read-only</div>
          </div>
          <div className="border border-slate-800 bg-[#0B0F16] p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Talent Search</div>
            <div className="mt-2 text-lg font-semibold text-emerald-100">Clean profiles only</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border border-slate-800 bg-[#0B0F16] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.key}
                onClick={() => setActiveGroup(group.key)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${activeGroup === group.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}
              >
                {group.label} <span className="ml-1 text-slate-500">{group.count}</span>
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocked candidates"
            className="h-10 min-w-0 rounded-md border border-slate-700 bg-[#05070A] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400 md:w-80"
          />
        </div>

        {error ? <div className="mt-6 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="mt-6 border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading validation queue...</div> : null}

        {!loading && !error ? (
          <div className="mt-6 overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0B0F16] px-4 py-3 text-sm text-slate-300">
              <div>
                Page {data?.currentPage || 1} of {data?.totalPages || 0} - {data?.returnedCount || 0} shown
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={!data || data.currentPage <= 1}
                  className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!data || data.currentPage >= data.totalPages}
                  className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_150px_150px_180px] border-b border-slate-800 bg-[#0B0F16] px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              <div>Candidate</div>
              <div>Primary issue</div>
              <div>Module</div>
              <div>Contact</div>
              <div></div>
            </div>
            <div className="divide-y divide-slate-800 bg-[#070A0F]">
              {(data?.items || []).map((candidate) => (
                <article key={candidate.id} className="grid grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_150px_150px_180px] gap-4 px-4 py-4 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{candidate.displayName}</div>
                    <div className="mt-1 truncate text-slate-400">{candidate.title}</div>
                    <div className="mt-1 truncate text-slate-500">{candidate.company} · {candidate.location}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      {candidate.issues.slice(0, 3).map((issue) => (
                        <span key={`${candidate.id}-${issue.key}`} className={`rounded-md border px-2 py-1 text-xs font-semibold ${reasonTone(issue.key)}`} title={issue.evidence}>
                          {issue.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 truncate text-xs text-slate-500">{candidate.validationQueueReason}</div>
                  </div>
                  <div className="text-slate-300">{candidate.module}</div>
                  <div className="text-slate-300">{candidate.contact}</div>
                  <div className="flex justify-end gap-2">
                    <Link href={candidate.profileHref} className="rounded-md bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">
                      View Profile
                    </Link>
                  </div>
                </article>
              ))}
              {!data?.items?.length ? <div className="p-6 text-slate-400">No blocked candidates in this view.</div> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}