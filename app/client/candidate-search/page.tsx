"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate = { id: string; name: string | null; current_title: string | null; current_company: string | null };

export default function ClientCandidateSearch() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Candidate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(q: string, after: string | null, signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q });
      if (after) params.set("after", after);
      const response = await fetch(`/api/client/candidates?${params}`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "Your account does not have active candidate search access." : "Candidate search is unavailable. Please try again.");
      const result: { candidates: Candidate[]; nextCursor: string | null } = await response.json();
      setRows(current => after ? [...current, ...result.candidates] : result.candidates);
      setCursor(result.nextCursor);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Candidate search is unavailable.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(query, null, controller.signal);
    return () => controller.abort();
  }, [query]);

  return <main className="min-h-screen bg-[#05070A] px-6 py-10 text-slate-100"><div className="mx-auto max-w-5xl">
    <Link href="/client/portal" className="text-sm text-cyan-300">← Client Portal</Link>
    <h1 className="mt-6 text-3xl font-semibold">Find assigned candidates</h1>
    <p className="mt-2 text-slate-400">Search by name, title or company among candidates your account can access.</p>
    <form className="mt-6 flex gap-3" onSubmit={event => { event.preventDefault(); const next = input.trim(); setRows([]); setCursor(null); if (next === query) void load(next, null); else setQuery(next); }}>
      <input value={input} maxLength={120} onChange={event => setInput(event.target.value)} aria-label="Candidate search"
        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3" placeholder="SAP FICO, consultant, company…" />
      <button type="submit" className="rounded-lg bg-cyan-700 px-5 py-3 font-medium">Search</button>
    </form>
    {error && <p role="alert" className="mt-5 text-amber-200">{error}</p>}
    {loading && <p className="mt-5 text-slate-400">Loading…</p>}
    <div className="mt-6 space-y-3">{rows.map(row => <article key={row.id} className="rounded-xl border border-slate-800 bg-[#0B0F16] p-5">
      <h2 className="font-semibold">{row.name || "Candidate"}</h2>
      <p className="mt-1 text-sm text-slate-400">{[row.current_title, row.current_company].filter(Boolean).join(" · ") || "Profile details unavailable"}</p>
    </article>)}</div>
    {!loading && !error && !rows.length && <p className="mt-6 text-slate-400">No assigned candidates found.</p>}
    {cursor && <button type="button" disabled={loading} onClick={() => void load(query, cursor)} className="mt-6 rounded-lg border border-cyan-500/50 px-5 py-2 text-cyan-200 disabled:opacity-50">Load more</button>}
  </div></main>;
}
