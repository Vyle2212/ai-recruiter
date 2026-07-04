"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const COMPARE_SHORTLIST_KEY = "primus.shortlist.workflow.v1";
const LAST_COMPARE_URL_KEY = "primus.compare.lastUrl.v1";

const STAGES = [
  "Shortlisted",
  "Ready to Submit",
  "Sent to Client",
  "Interview 1",
  "Interview 2",
  "Offer",
  "Hired",
  "Rejected",
] as const;

type ShortlistStage = (typeof STAGES)[number];

type ShortlistWorkflowItem = {
  id: string;
  candidateId: string;
  name: string;
  title: string;
  module: string;
  location: string;
  company: string;
  score: number;
  stage: ShortlistStage;
  sourceSearchId: string;
  sourceSearchTitle: string;
  compareUrl?: string;
  addedAt: string;
  status: "Shortlisted";
  rank?: number;
  source?: "Compare" | string;
  aiRecommended?: boolean;
  visibility?: {
    internalRecruiter: boolean;
    client: boolean;
    admin: boolean;
  };
};

function readShortlist(): ShortlistWorkflowItem[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPARE_SHORTLIST_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeShortlist(items: ShortlistWorkflowItem[]) {
  window.localStorage.setItem(COMPARE_SHORTLIST_KEY, JSON.stringify(items));
}

function validCompareHref(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    return url.pathname === "/compare" ? `${url.pathname}${url.search}${url.hash}` : "";
  } catch {
    return value.startsWith("/compare") ? value : "";
  }
}

function compareFallback(item?: ShortlistWorkflowItem) {
  if (!item) return "/search";
  const params = new URLSearchParams();
  if (item.candidateId) params.set("ids", item.candidateId);
  if (item.sourceSearchId && item.sourceSearchId !== "current-search") {
    params.set("searchId", item.sourceSearchId);
    params.set("searchSessionId", item.sourceSearchId);
  }
  if (item.module) params.set("module", item.module.startsWith("SAP ") ? item.module : `SAP ${item.module}`);
  const query = params.toString();
  return query ? `/compare?${query}` : "/search";
}

function resolveCompareHref(items: ShortlistWorkflowItem[]) {
  const saved = validCompareHref(window.sessionStorage.getItem(LAST_COMPARE_URL_KEY) || "");
  if (saved) return saved;
  const itemUrl = validCompareHref(items.find((item) => item.compareUrl)?.compareUrl);
  if (itemUrl) return itemUrl;
  return compareFallback(items[0]);
}

export default function ShortlistPage() {
  const [items, setItems] = useState<ShortlistWorkflowItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [backToCompareHref, setBackToCompareHref] = useState("/search");

  useEffect(() => {
    const shortlist = readShortlist();
    setItems(shortlist);
    setBackToCompareHref(resolveCompareHref(shortlist));
    setLoaded(true);
  }, []);

  function updateStage(candidateId: string, stage: ShortlistStage) {
    setItems((current) => {
      const next = current.map((item) => item.candidateId === candidateId ? { ...item, stage } : item);
      writeShortlist(next);
      return next;
    });
  }

  function removeCandidate(candidateId: string) {
    setItems((current) => {
      const next = current.filter((item) => item.candidateId !== candidateId);
      writeShortlist(next);
      return next;
    });
  }

  const searchTitle = useMemo(() => items[0]?.sourceSearchTitle || "Shortlist Workflow", [items]);
  const grouped = useMemo(() => STAGES.map((stage) => ({ stage, items: items.filter((item) => item.stage === stage) })), [items]);

  return (
    <main className="min-h-screen bg-[#05070A] p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={backToCompareHref} className="rounded-full border border-slate-700/45 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-500/30 hover:bg-cyan-500/10">Back to Compare</Link>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-950/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">Internal Recruiter Workflow</div>
        </div>

        <section className="rounded-[24px] bg-[#0B1118] p-5 ring-1 ring-slate-800/60">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">Shortlist Board</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{searchTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Move approved profiles from shortlist validation into client submission, interview, offer and placement stages. Client communication tools stay staged behind readiness instead of appearing inside Compare.</p>
        </section>

        {!loaded ? <div className="rounded-[20px] bg-[#0B1118] p-5 text-sm text-slate-400 ring-1 ring-slate-800/60">Loading shortlist...</div> : null}

        {loaded && items.length === 0 ? (
          <section className="rounded-[24px] bg-[#0B1118] p-8 text-center ring-1 ring-slate-800/60">
            <h2 className="text-xl font-black text-white">No shortlisted candidates yet</h2>
            <p className="mt-2 text-sm text-slate-400">Return to Compare and move the recommended profile into the shortlist workflow.</p>
            <Link href={backToCompareHref} className="mt-5 inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300">Back to Compare</Link>
          </section>
        ) : null}

        {loaded && items.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {grouped.map(({ stage, items: stageItems }) => (
              <div key={stage} className="rounded-[22px] bg-[#0B1118] p-4 ring-1 ring-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black text-white">{stage}</h2>
                  <span className="rounded-full bg-[#101923] px-2.5 py-1 text-[10px] font-bold text-cyan-100 ring-1 ring-cyan-500/15">{stageItems.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {stageItems.length ? stageItems.map((candidate) => (
                    <article key={candidate.id} className="rounded-2xl bg-[#101923] p-3 ring-1 ring-slate-800/65">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{candidate.name}</div>
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{candidate.title}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                            {candidate.rank ? <span className="rounded-full border border-cyan-300/40 bg-cyan-400/12 px-2 py-0.5 font-black text-cyan-50">Rank #{candidate.rank}</span> : null}
                            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-100 ring-1 ring-cyan-500/20">{candidate.score}% Match</span>
                            <span className="rounded-full bg-[#05070A] px-2 py-0.5 text-slate-300 ring-1 ring-slate-800/70">{candidate.module || "SAP"}</span>
                            <span className="rounded-full bg-[#05070A] px-2 py-0.5 text-slate-300 ring-1 ring-slate-800/70">{candidate.location || "Location pending"}</span>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-100 ring-1 ring-emerald-500/20">Added from Compare</span>
                            {candidate.aiRecommended ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-100 ring-1 ring-amber-500/20">AI Recommended</span> : null}
                          </div>
                        </div>
                        <select value={candidate.stage} onChange={(event) => updateStage(candidate.candidateId, event.target.value as ShortlistStage)} className="rounded-xl border border-slate-700/60 bg-[#05070A] px-2.5 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400">
                          {STAGES.map((stageOption) => <option key={stageOption} value={stageOption}>{stageOption}</option>)}
                        </select>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/candidates/${encodeURIComponent(candidate.candidateId)}?returnTo=${encodeURIComponent("/shortlist")}&searchId=${encodeURIComponent(candidate.sourceSearchId || "")}&searchSessionId=${encodeURIComponent(candidate.sourceSearchId || "")}&module=${encodeURIComponent(candidate.module || "")}`} className="rounded-full bg-[#05070A] px-3 py-1.5 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-500/20 hover:bg-cyan-950/30">View Profile</Link>
                        <Link href={validCompareHref(candidate.compareUrl) || compareFallback(candidate)} className="rounded-full bg-[#05070A] px-3 py-1.5 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-500/20 hover:bg-cyan-950/30">Compare</Link>
                        <Link href={`/candidates/${encodeURIComponent(candidate.candidateId)}?returnTo=${encodeURIComponent("/shortlist")}&searchId=${encodeURIComponent(candidate.sourceSearchId || "")}&searchSessionId=${encodeURIComponent(candidate.sourceSearchId || "")}&module=${encodeURIComponent(candidate.module || "")}`} className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-500/20 hover:border-cyan-400/40 hover:bg-cyan-500/15">Expand Details</Link>
                        <button type="button" onClick={() => removeCandidate(candidate.candidateId)} className="rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-100 ring-1 ring-rose-500/20 hover:bg-rose-950/30">Remove from Shortlist</button>
                      </div>
                    </article>
                  )) : <div className="rounded-2xl bg-[#101923] p-3 text-xs text-slate-500 ring-1 ring-slate-800/40">No candidates in this stage.</div>}
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
