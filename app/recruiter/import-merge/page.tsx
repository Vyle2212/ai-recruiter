"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ImportMergeDecision, ImportMergeProposal } from "@/lib/importMergeTypes";

const DECISIONS: ImportMergeDecision[] = ["approve_merge", "hold_for_review", "reject_merge", "keep_existing", "ask_candidate_to_confirm"];
function tone(value: string) {
  if (value === "safe" || value === "approve_merge") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (value === "high" || value === "blocked" || value === "reject_merge") return "border-red-500/30 bg-red-500/10 text-red-100";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}
export default function ImportMergePage() {
  const [proposals, setProposals] = useState<ImportMergeProposal[]>([]);
  const [decisions, setDecisions] = useState<Record<string, ImportMergeDecision>>({});
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/import-merge/proposals", { signal: controller.signal }).then(async (response) => {
      const json = await response.json(); if (!response.ok) throw new Error(json.error || "Unable to load proposals");
      setProposals(json.proposals); setDecisions(Object.fromEntries(json.proposals.map((item: ImportMergeProposal) => [item.proposalId, item.decision])));
    }).catch((reason) => { if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Unable to load proposals"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => proposals.filter((item) => filter === "all" || item.riskLevel === filter || item.conflictLevel === filter || decisions[item.proposalId] === filter), [proposals, decisions, filter]);
  async function previewPlan() {
    const response = await fetch("/api/import-merge/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisions: proposals.map((item) => ({ proposalId: item.proposalId, decision: decisions[item.proposalId], reviewerNote: "UI preview state only" })) }) });
    const json = await response.json(); if (!response.ok) setError(json.error || "Unable to preview plan"); else setPreview(json);
  }
  const summary = {
    proposals: proposals.length,
    approve: Object.values(decisions).filter((item) => item === "approve_merge").length,
    hold: Object.values(decisions).filter((item) => item === "hold_for_review").length,
    confirm: Object.values(decisions).filter((item) => item === "ask_candidate_to_confirm").length,
    keep: Object.values(decisions).filter((item) => item === "keep_existing").length,
    reject: Object.values(decisions).filter((item) => item === "reject_merge").length,
  };
  return <main className="min-h-screen bg-[#05070A] text-slate-100">
    <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-5"><div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-3"><div><Link href="/recruiter/import-staging" className="text-sm text-cyan-100">Back to import staging</Link><h1 className="mt-2 text-2xl font-semibold">Import Merge Approval Workflow</h1><p className="mt-1 text-sm text-slate-400">Recruiter decision state and plan preview only. No UI write endpoint exists.</p></div><div className="flex gap-2"><button type="button" onClick={previewPlan} className="rounded-md border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-100">Preview approved plan</button><button type="button" disabled className="cursor-not-allowed rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-400">Apply disabled</button></div></div></header>
    <section className="mx-auto max-w-[1600px] space-y-5 px-6 py-6">
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-100"><h2 className="font-semibold">Merge proposals are unavailable</h2><p className="mt-2 text-sm">{error}</p><Link href="/recruiter/dashboard" className="mt-4 inline-block text-sm underline">Back to Dashboard</Link></div> : null}{loading ? <div className="rounded-xl border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading read-only merge proposals...</div> : null}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(summary).map(([label, value]) => <div key={label} className="border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold">{value}</div></div>)}</div>
      <div className="flex flex-wrap gap-2 border border-slate-800 bg-[#0B0F16] p-4">{["all", "safe", "low", "medium", "high", "blocked", ...DECISIONS].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded border px-3 py-2 text-sm ${filter === item ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 text-slate-300"}`}>{item.replace(/_/g, " ")}</button>)}</div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-400"><span>Compact trust comparison</span><span>Scroll horizontally to review values, evidence, and preview decisions ?</span></div><div className="overflow-auto rounded-xl border border-slate-800 bg-[#0B0F16]"><table className="min-w-[1750px] w-full border-collapse text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr className="border-b border-slate-800">{["Candidate", "Field", "Existing value", "Existing trust", "Imported value", "Imported source / confidence", "Risk / conflict", "Evidence", "Decision"].map((heading, index) => <th key={heading} className={`px-3 py-3 ${index===0?"sticky left-0 z-20 bg-[#0B0F16]":""}`}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filtered.map((item) => <tr key={item.proposalId} className="align-top"><td className="sticky left-0 z-10 max-w-64 break-all bg-[#0B0F16] px-3 py-3 text-xs text-slate-400">{item.candidateId || "New candidate held"}<div>{item.importedCandidateId}</div></td><td className="px-3 py-3 font-semibold text-cyan-100">{item.fieldName}</td><td className="max-w-52 px-3 py-3 text-slate-300">{String(item.existingValue || "Empty")}</td><td className="px-3 py-3"><span className="rounded border border-slate-700 px-2 py-1 text-xs">{item.existingTrustLevel.replace(/_/g, " ")}</span></td><td className="max-w-52 px-3 py-3 text-white">{String(item.importedValue)}</td><td className="px-3 py-3 text-slate-300">{item.importedSource.replace(/_/g, " ")} - {item.importedConfidence}%</td><td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs ${tone(item.riskLevel)}`}>{item.riskLevel}</span><div className="mt-2 text-xs text-slate-500">{item.conflictLevel} conflict</div></td><td className="max-w-72 px-3 py-3 text-xs text-slate-400">{item.evidence.join("; ")}</td><td className="px-3 py-3"><select value={decisions[item.proposalId] || item.decision} onChange={(event) => setDecisions((current) => ({ ...current, [item.proposalId]: event.target.value as ImportMergeDecision }))} className="rounded border border-slate-700 bg-[#05070A] px-2 py-2 text-sm text-white">{DECISIONS.map((decision) => <option key={decision} value={decision}>{decision.replace(/_/g, " ")}</option>)}</select><div className="mt-2 text-xs text-amber-100">{item.blockedReasons.join("; ")}</div></td></tr>)}</tbody></table>{!filtered.length ? <div className="p-6 text-slate-300"><h2 className="font-semibold">No merge proposals match this view</h2><p className="mt-2 text-sm text-slate-400">Choose another risk or decision filter, or review Import Staging. No merge apply is available.</p><Link href="/recruiter/import-staging" className="mt-3 inline-block text-sm text-cyan-100">Open Import Staging</Link></div> : null}</div>
      {preview ? <div className="border border-cyan-500/20 bg-cyan-500/5 p-5"><h2 className="font-semibold text-cyan-100">Plan preview</h2><p className="mt-2 text-sm text-slate-300">{preview.fieldUpdatesPlanned} safe field updates across {preview.candidateRecordsAffected} candidate records. {preview.excludedDecisions} decisions excluded.</p><p className="mt-1 text-xs text-slate-500">Backup required: yes - Rollback ready: yes - Candidate DB write performed: no.</p></div> : null}
    </section>
  </main>;
}
