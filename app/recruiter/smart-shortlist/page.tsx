"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { filterAndSortSmartShortlist, type SmartShortlistCard, type SmartShortlistFilters } from "@/lib/smartShortlist";

type Board = { workflowGeneratedAt: string; source: string; summary: Record<string, number>; candidates: SmartShortlistCard[] };
const control = "rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2.5 text-sm outline-none transition focus:border-cyan-400";
const SHORTLIST_INITIAL_RENDER_LIMIT = 30;

export default function SmartShortlistPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(SHORTLIST_INITIAL_RENDER_LIMIT);
  const [filters, setFilters] = useState<SmartShortlistFilters>({ completeness: "all", verification: "all", sort: "completeness_desc", includeNeedsRepair: false });

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    async function load() {
      setLoading(true); setError(""); setBoard(null);
      try {
        const response = await fetch("/api/recruiter/smart-shortlist", { signal: controller.signal, cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Unable to load Smart Shortlist");
        setBoard(json);
      } catch (reason) {
        if (!controller.signal.aborted || timedOut) setError(timedOut ? "Smart Shortlist took too long to load." : reason instanceof Error ? reason.message : "Unable to load Smart Shortlist");
      } finally {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    }
    load();
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [reload]);

  const cards = useMemo(() => filterAndSortSmartShortlist(board?.candidates || [], filters), [board, filters]);
  const visibleCards = cards.slice(0, visibleCount);
  const set = (key: keyof SmartShortlistFilters, value: unknown) => { setVisibleCount(SHORTLIST_INITIAL_RENDER_LIMIT); setFilters(current => ({ ...current, [key]: value })); };
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 5 ? [...current, id] : current);
  const compareHref = `/recruiter/candidate-compare?candidateIds=${selected.map(encodeURIComponent).join(",")}`;
  const reportHref = `/recruiter/client-report?candidateIds=${selected.map(encodeURIComponent).join(",")}`;

  return <main className="min-h-screen bg-[#05070A] text-slate-100">
    <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-6"><div className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-4"><div><div className="flex flex-wrap gap-4 text-sm"><Link href="/recruiter/dashboard" className="text-cyan-100">Back to Dashboard</Link><Link href="/recruiter/talent-search" className="text-cyan-100">Need more candidates? Search talent pool.</Link></div><h1 className="mt-2 text-3xl font-semibold">Shortlist</h1><p className="mt-1 text-sm text-slate-400">Ready-for-shortlist profiles. Select 2-5 candidates to compare or create a report.</p></div>{board ? <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-right text-xs text-slate-400"><span className="text-emerald-100">Read-only</span><br />{board.source} &middot; {board.workflowGeneratedAt}</div> : null}</div></header>
    <section className="mx-auto max-w-[1500px] space-y-5 px-6 py-6">
      {loading ? <div className="rounded-xl border border-slate-800 bg-[#0B0F16] p-8"><div className="h-2 w-32 animate-pulse rounded bg-cyan-400/40" /><h2 className="mt-5 text-lg font-semibold">Loading Smart Shortlist...</h2><p className="mt-2 text-sm text-slate-400">Building read-only Candidate360 cards from the persisted workflow state.</p></div> : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-100"><h2 className="font-semibold">Smart Shortlist could not be loaded</h2><p className="mt-2 text-sm">{error} Retry the read-only API, or return to the Dashboard and run the Smart Shortlist audit.</p><div className="mt-4 flex gap-3"><button type="button" onClick={() => setReload(value => value + 1)} className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-950">Retry</button><Link href="/recruiter/dashboard" className="rounded-lg border border-red-300/30 px-4 py-2 text-sm">Back to Dashboard</Link></div></div> : null}
      {board ? <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{[["Ready", "readyForShortlist"], ["High completeness", "highCompleteness"], ["Low completeness", "lowCompleteness"], ["Missing company", "missingCurrentCompany"], ["Missing title", "missingTitle"], ["Missing location", "missingLocation"], ["Needs confirmation", "needsCandidateConfirmation"]].map(([label, key]) => <div key={key} className="rounded-xl border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold">{board.summary[key] || 0}</div></div>)}</div>
        <div className="grid gap-3 rounded-xl border border-slate-800 bg-[#0B0F16] p-4 md:grid-cols-2 xl:grid-cols-6"><input className={`${control} xl:col-span-2`} placeholder="Search name, company, or title" value={filters.search || ""} onChange={event => set("search", event.target.value)} /><select aria-label="Completeness" className={control} value={filters.completeness} onChange={event => set("completeness", event.target.value)}><option value="all">All completeness</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Verification" className={control} value={filters.verification} onChange={event => set("verification", event.target.value)}><option value="all">All verification</option><option value="recruiter_approved">Recruiter approved</option><option value="needs_candidate_confirmation">Needs confirmation</option><option value="missing_company">Missing company</option><option value="missing_title">Missing title</option><option value="missing_location">Missing location</option></select><input className={control} placeholder="Module or skill" value={filters.skill || ""} onChange={event => set("skill", event.target.value)} /><input className={control} placeholder="Location" value={filters.location || ""} onChange={event => set("location", event.target.value)} /><select aria-label="Sort candidates" className={control} value={filters.sort} onChange={event => set("sort", event.target.value)}><option value="completeness_desc">Completeness</option><option value="recently_updated">Recently updated</option><option value="name">Name</option><option value="company">Company</option><option value="needs_confirmation_first">Needs confirmation first</option></select><label className="flex items-center gap-2 text-sm text-amber-100"><input type="checkbox" disabled /> Include needs repair (off)</label></div>
        <div className="sticky top-[101px] z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-[#08131A]/95 p-4 shadow-xl backdrop-blur"><div><div className="font-semibold">Selected candidates</div><div className="text-sm text-slate-400">{selected.length}/5 selected. {selected.length < 2 ? "Select at least 2 candidates." : selected.length > 5 ? "Maximum 5 candidates." : "Ready to compare or create a report."}</div></div><div className="flex flex-wrap gap-2">{selected.length >= 2 ? <><Link href={compareHref} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Compare selected</Link><Link href={reportHref} className="rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-100">Create report</Link></> : <button disabled className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-500">Select at least 2 candidates</button>}</div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400"><span>Showing {visibleCards.length} of {cards.length} ready candidates</span><div className="flex gap-2"><button type="button" onClick={() => { setVisibleCount(SHORTLIST_INITIAL_RENDER_LIMIT); setFilters({ completeness: "all", verification: "all", sort: "completeness_desc", includeNeedsRepair: false }); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Reset filters</button><span className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs text-emerald-100">Ready for shortlist only</span></div></div>
        <div className="grid gap-4 lg:grid-cols-2">{visibleCards.map(card => <article key={card.candidateId} className={`rounded-xl border bg-[#0B0F16] p-5 transition ${selected.includes(card.candidateId) ? "border-cyan-400 shadow-lg shadow-cyan-950/30" : "border-slate-800 hover:border-slate-700"}`}><label className="mb-3 flex items-center gap-2 text-sm text-cyan-100"><input type="checkbox" checked={selected.includes(card.candidateId)} disabled={!selected.includes(card.candidateId) && selected.length >= 5} onChange={() => toggle(card.candidateId)} /> Select for compare</label><div className="flex justify-between gap-4"><div className="min-w-0"><h2 className="truncate text-xl font-semibold">{card.name}</h2><p className="mt-1 text-sm text-cyan-100">{card.title || "Title missing"} &middot; {card.currentCompany || "Company missing"}</p><p className="text-sm text-slate-400">{card.location || "Location missing"}</p></div><div className="shrink-0 text-right"><div className="text-3xl font-semibold">{card.completenessScore}%</div><div className="text-[10px] uppercase text-slate-500">complete</div></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-emerald-100">Ready for shortlist</span>{card.needsCandidateConfirmation ? <span className="rounded-full border border-amber-500/30 px-2.5 py-1 text-amber-100">Needs confirmation</span> : null}</div><p className="mt-3 line-clamp-2 text-sm text-slate-400">{card.headline || "No headline available"}</p><p className="mt-2 text-xs text-amber-100">{card.missingFields.length ? `Missing: ${card.missingFields.join(", ")}` : "No foundation field warnings"}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800 pt-4 text-sm"><Link href={card.candidate360Href} className="text-cyan-100">View Candidate360</Link><Link href={card.selfConfirmHref} className="text-cyan-100">Self-confirm preview</Link><Link href={`/recruiter/submission-generator?candidateId=${encodeURIComponent(card.candidateId)}`} className="text-emerald-100">Generate submission</Link><span className="text-slate-600">Merge Review unavailable here</span></div></article>)}
          {!cards.length ? <div className="rounded-xl border border-slate-800 bg-[#0B0F16] p-8 text-slate-300"><h2 className="font-semibold">No matching ready candidates. Try clearing filters.</h2><p className="mt-2 text-sm text-slate-400">Needs-repair candidates remain excluded by default.</p><button type="button" onClick={() => { setVisibleCount(SHORTLIST_INITIAL_RENDER_LIMIT); setFilters({ completeness: "all", verification: "all", sort: "completeness_desc", includeNeedsRepair: false }); }} className="mt-4 rounded-lg border border-cyan-500/40 px-4 py-2 text-sm text-cyan-100">Clear filters</button></div> : null}</div>
        {visibleCards.length < cards.length ? <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount(count => count + SHORTLIST_INITIAL_RENDER_LIMIT)} className="rounded-lg border border-cyan-500/40 bg-cyan-500/5 px-6 py-3 text-sm font-semibold text-cyan-100">Load more candidates</button></div> : null}
      </> : null}
    </section>
  </main>;
}
