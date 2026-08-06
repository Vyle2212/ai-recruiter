"use client";

import { useEffect, useRef, useState } from "react";
import { canSubmitHiringAnalyst, isSubmitKey, requestHiringAnalystAnswer } from "@/lib/candidate360HiringAnalystClient";
import type { HiringAnalystAnswer } from "@/lib/candidate360HiringAnalyst";
import type { Candidate360Profile } from "@/lib/candidate360Types";

const PROMPTS = ["Has this candidate led Greenfield projects?", "Does this candidate have Treasury experience?", "Summarize implementation experience.", "What are the biggest hiring risks?", "Would this candidate fit a Senior Manager role?", "Generate interview questions.", "Find missing evidence."] as const;
type Exchange = { id: number; question: string; answer?: HiringAnalystAnswer; error?: string; loading: boolean };

export default function RecruiterAICopilot({ profile, job }: { profile: Candidate360Profile; job: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const jobId = job ? String(job.id ?? job.job_id ?? "").trim() : "";
  const loading = exchanges.some((exchange) => exchange.loading);

  useEffect(() => { setExchanges([]); setQuestion(""); inFlight.current = false; }, [profile.candidateId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [exchanges]);

  const submit = async (rawQuestion: string, retryId?: number) => {
    const text = rawQuestion.trim();
    if (!canSubmitHiringAnalyst(text, inFlight.current)) return;
    inFlight.current = true;
    const id = retryId ?? ++sequence.current;
    setExchanges((current) => retryId ? current.map((exchange) => exchange.id === id ? { ...exchange, error: undefined, loading: true } : exchange) : [...current, { id, question: text, loading: true }]);
    try {
      const answer = await requestHiringAnalystAnswer({ candidateId: profile.candidateId, ...(jobId ? { jobId, job } : {}), question: text });
      setExchanges((current) => current.map((exchange) => exchange.id === id ? { ...exchange, answer, error: undefined, loading: false } : exchange));
      setQuestion((current) => current.trim() === text ? "" : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to analyze candidate evidence.";
      setExchanges((current) => current.map((exchange) => exchange.id === id ? { ...exchange, error: message, loading: false } : exchange));
      setQuestion(text);
    } finally { inFlight.current = false; }
  };

  return <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
    {open ? <section role="dialog" aria-modal="false" aria-labelledby="recruiter-copilot-title" className="mb-16 flex h-[min(680px,calc(100vh-7rem))] w-[calc(100vw-32px)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#090D14] shadow-2xl shadow-black/60 lg:mr-2">
      <header className="flex shrink-0 items-start justify-between border-b border-slate-800 p-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-400">Evidence-only hiring analyst</div><h2 id="recruiter-copilot-title" className="mt-1 font-semibold text-white">AI Hiring Analyst</h2></div><div className="flex gap-1"><button type="button" onClick={() => setExchanges([])} disabled={!exchanges.length || loading} className="min-h-9 rounded-lg px-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Clear</button><button type="button" onClick={() => setOpen(false)} aria-label="Close AI Hiring Analyst" className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">×</button></div></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite"><p className="text-sm text-slate-400">Ask evidence-backed questions about this candidate.</p><div className="mt-3 flex flex-wrap gap-2">{PROMPTS.map((prompt) => <button key={prompt} type="button" disabled={loading} onClick={() => void submit(prompt)} className="rounded-lg border border-slate-800 px-2.5 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-700 hover:bg-cyan-950/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{prompt}</button>)}</div>
        <div className="mt-4 space-y-4">{exchanges.map((exchange) => <article key={exchange.id} className="space-y-2"><div className="ml-8 rounded-xl rounded-br-sm border border-slate-700 bg-slate-800/70 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recruiter</div><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-200">{exchange.question}</p></div><div className="mr-8 rounded-xl rounded-bl-sm border border-slate-800 bg-black/25 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">Hiring Analyst</div>{exchange.loading ? <p role="status" className="mt-2 text-sm text-slate-300">Analyzing candidate evidence…</p> : exchange.error ? <div className="mt-2"><p role="alert" className="text-sm text-rose-300">{exchange.error}</p><button type="button" onClick={() => void submit(exchange.question, exchange.id)} disabled={loading} className="mt-2 rounded-md border border-rose-700/60 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-950/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300">Retry</button></div> : exchange.answer ? <AnswerView answer={exchange.answer}/> : null}</div></article>)}</div><div ref={endRef}/>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void submit(question); }} className="shrink-0 border-t border-slate-800 bg-[#090D14] p-3"><label htmlFor="recruiter-copilot-question" className="sr-only">Ask about this candidate</label><textarea id="recruiter-copilot-question" rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (isSubmitKey(event.key, event.shiftKey)) { event.preventDefault(); void submit(question); } }} placeholder="Ask anything about this candidate…" className="max-h-28 min-h-14 w-full resize-none rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400"/><div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-slate-500">Enter to ask · Shift+Enter for new line</span><button type="submit" disabled={!canSubmitHiringAnalyst(question, loading)} className="min-h-10 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">{loading ? "Analyzing…" : "Ask"}</button></div></form>
    </section> : null}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="recruiter-copilot-title" className="ml-auto flex min-h-12 items-center gap-3 rounded-full border border-cyan-500/40 bg-[#0B111A] px-4 text-sm font-semibold text-white shadow-xl shadow-black/50 transition hover:-translate-y-0.5 hover:border-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none"><span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300 text-slate-950">AI</span>{open ? "Close Analyst" : "Ask Hiring Analyst"}</button>
  </div>;
}

function AnswerView({ answer }: { answer: HiringAnalystAnswer }) { return <div className="mt-2 space-y-3"><p className="whitespace-pre-line text-sm leading-6 text-slate-200">{answer.answer}</p><div className="inline-flex rounded border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300">Confidence: {answer.confidence === null ? "Insufficient evidence" : `${answer.confidence}%`}</div>{answer.evidence.length ? <details className="text-xs"><summary className="cursor-pointer font-medium text-cyan-300">Evidence used ({answer.evidence.length})</summary><ul className="mt-2 space-y-1.5">{answer.evidence.map((item, index) => <li key={`${item.label}-${index}`} className="text-slate-300">• {item.label}{item.value ? `: ${item.value}` : ""} <span className="ml-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400" title={item.provenance?.limitations.join(" ")}>{item.provenance?.sourceLabel || item.sourceType.replaceAll("_", " ")} · {item.provenance?.strength || "unrated"}</span></li>)}</ul></details> : null}{answer.missingEvidence.length ? <div><h3 className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Missing evidence</h3><ul className="mt-1 space-y-1">{answer.missingEvidence.map((item) => <li key={item} className="text-xs text-slate-300">• {item}</li>)}</ul></div> : null}{answer.nextAction ? <div className="border-t border-slate-800 pt-2"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recommended next action</h3><p className="mt-1 text-xs leading-5 text-slate-200">{answer.nextAction}</p></div> : null}</div>; }

