"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ImportStagingBatch, ImportStagingCandidate, ImportStagingMatchStatus } from "@/lib/importStagingTypes";

const STATUSES: Array<"all" | ImportStagingMatchStatus> = ["all", "exact_match", "likely_match", "possible_match", "new_candidate", "duplicate_risk", "conflict", "rejected"];
function tone(status: string) {
  if (status === "new_candidate" || status === "exact_match") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (status === "duplicate_risk" || status === "conflict") return "border-red-500/30 bg-red-500/10 text-red-100";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}
function candidateName(item: ImportStagingCandidate) {
  const source = item.importedCandidate as Record<string, unknown>;
  return String(source.name || source.displayName || source.full_name || item.match.existingCandidateName || "Unnamed import");
}

export default function ImportStagingPage() {
  const [batch, setBatch] = useState<ImportStagingBatch | null>(null);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("all");
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/import-staging", { signal: controller.signal }).then(async (response) => {
      const json = await response.json(); if (!response.ok) throw new Error(json.error || "Unable to load import staging"); setBatch(json);
    }).catch((reason) => { if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Unable to load import staging"); });
    return () => controller.abort();
  }, []);
  const candidates = useMemo(() => (batch?.candidates || []).filter((item) => filter === "all" || item.match.status === filter), [batch, filter]);
  async function buildPreview() {
    const response = await fetch("/api/import-staging/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const json = await response.json(); if (!response.ok) setError(json.error || "Unable to build preview"); else setPreview(json);
  }
  const cards = batch ? [
    ["Imported", batch.importedCandidatesLoaded], ["Existing source", batch.existingCandidatesLoaded],
    ["Exact", batch.summary.exactMatches], ["Likely", batch.summary.likelyMatches], ["Possible", batch.summary.possibleMatches],
    ["New", batch.summary.newCandidates], ["Duplicate risks", batch.summary.duplicateRisks], ["Conflicts", batch.summary.conflicts],
    ["Ready preview", batch.summary.readyForMergePreview], ["Recruiter review", batch.summary.needsRecruiterReview],
  ] : [];
  return <main className="min-h-screen bg-[#05070A] text-slate-100">
    <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-5"><div className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-3"><div><Link href="/recruiter/workflow" className="text-sm text-cyan-100">Back to recruiter workflow</Link><h1 className="mt-2 text-2xl font-semibold">Clean Import / Reupload Staging</h1><p className="mt-1 text-sm text-slate-400">Local comparison and merge proposals only. Main candidate DB is unchanged.</p></div><div className="flex gap-2"><button type="button" onClick={buildPreview} className="rounded-md border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-100">Build merge preview</button><button type="button" disabled className="cursor-not-allowed rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-400">Merge disabled in v1</button></div></div></header>
    <section className="mx-auto max-w-[1500px] space-y-5 px-6 py-6">
      {error ? <div className="border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
      {!batch && !error ? <div className="border border-slate-800 bg-[#0B0F16] p-6">Loading import staging batch...</div> : null}
      {batch ? <>
        <div className="border border-slate-800 bg-[#0B0F16] p-4 text-sm text-slate-400">Batch <span className="font-semibold text-white">{batch.batchName}</span> � Status {batch.status.replace(/_/g, " ")} � Existing candidate IDs and all workflow/approval/apply history are preserved.</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, value]) => <div key={String(label)} className="border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold">{value}</div></div>)}</div>
        <div className="flex flex-wrap gap-2 border border-slate-800 bg-[#0B0F16] p-4">{STATUSES.map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-md border px-3 py-2 text-sm ${filter === status ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 text-slate-300"}`}>{status.replace(/_/g, " ")}</button>)}</div>
        <div className="overflow-auto border border-slate-800 bg-[#0B0F16]"><table className="min-w-[1500px] w-full border-collapse text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr className="border-b border-slate-800">{["Imported candidate", "Match", "Confidence", "Existing candidate ID", "Recommendation", "Recommended updates", "Blocked generic values", "Conflicts", "Reasons"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{candidates.map((item) => <tr key={item.stagingCandidateId} className="align-top"><td className="px-3 py-3 text-white">{candidateName(item)}<div className="text-xs text-slate-500">{item.stagingCandidateId}</div></td><td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs ${tone(item.match.status)}`}>{item.match.status.replace(/_/g, " ")}</span></td><td className="px-3 py-3">{item.match.confidence}%</td><td className="px-3 py-3 text-xs text-slate-400">{item.preservedCandidateId || "New candidate proposal"}</td><td className="px-3 py-3 text-cyan-100">{item.recommendation.replace(/_/g, " ")}</td><td className="px-3 py-3 text-emerald-100">{item.fields.filter((field) => field.recommendation === "update_existing" && !field.blocked).map((field) => field.fieldName).join(", ") || "None"}</td><td className="px-3 py-3 text-red-100">{item.blockedGenericValues.join(", ") || "None"}</td><td className="px-3 py-3 text-amber-100">{item.conflicts.map((conflict) => `${conflict.fieldName} (${conflict.conflictLevel})`).join(", ") || "None"}</td><td className="px-3 py-3 text-slate-400">{item.match.reasons.join("; ")}</td></tr>)}</tbody></table>{!candidates.length ? <div className="p-5 text-slate-400">No candidates match this filter.</div> : null}</div>
        {preview ? <div className="border border-cyan-500/20 bg-cyan-500/5 p-5"><h2 className="font-semibold text-cyan-100">Merge preview generated</h2><p className="mt-2 text-sm text-slate-300">{preview.proposals.length} proposals � {preview.summary.readyForMergePreview} ready � candidate DB write performed: no.</p><p className="mt-1 text-xs text-slate-500">No merge endpoint exists in v1.</p></div> : null}
      </> : null}
    </section>
  </main>;
}
