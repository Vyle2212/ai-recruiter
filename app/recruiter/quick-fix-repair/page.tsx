"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Suggestion = { suggestionId: string; candidateId: string; candidateName: string; fieldName: string; currentValue: string; suggestedValue: string; confidence: number; confidenceBand: string; evidenceSource: string; evidenceSnippet: string; repairCategory: string; priority: string; validationStatus: string; approvalReadiness: string; validationReasons: string[]; safetyNote: string };
type Audit = { summary: Record<string, number>; suggestions: Suggestion[]; readyForApprovalPreview: number; existingApprovalsPreserved: number; mode: string };
type BridgeResult = { mode: string; summary: Record<string, number>; approvalFilePath: string; outputPath: string; blocked: unknown[]; preserved: unknown[]; approvals: unknown[] };

const filters = ["all", "currentCompany", "title", "primarySapModule", "location", "safe_suggestion", "needs_manual_review", "blocked", "has_evidence", "missing_evidence", "high", "medium", "low"];
const labels: Record<string, string> = { all: "All", currentCompany: "Missing company", title: "Missing title", primarySapModule: "Missing module", location: "Missing location", safe_suggestion: "Safe suggestion", needs_manual_review: "Needs manual review", blocked: "Blocked", has_evidence: "Has evidence", missing_evidence: "Missing evidence", high: "Confidence high", medium: "Confidence medium", low: "Confidence low" };

function tone(status: string) {
  if (status === "safe_suggestion") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (status === "blocked") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (status === "already_approved" || status === "already_verified") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

export default function QuickFixRepairPage() {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [bridge, setBridge] = useState<BridgeResult | null>(null);
  const [bridgeMessage, setBridgeMessage] = useState("");

  useEffect(() => {
    fetch("/api/recruiter/quick-fix-repair/summary")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load quick fix repair");
        setAudit(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load quick fix repair"));
  }, []);

  const suggestions = useMemo(() => {
    const rows = audit?.suggestions || [];
    const needle = query.toLowerCase().trim();
    return rows.filter((item) => {
      const matchesFilter = filter === "all" || item.fieldName === filter || item.validationStatus === filter || item.confidenceBand === filter || (filter === "has_evidence" && Boolean(item.evidenceSnippet)) || (filter === "missing_evidence" && !item.evidenceSnippet);
      const blob = [item.candidateName, item.candidateId, item.fieldName, item.suggestedValue, item.evidenceSnippet].join(" ").toLowerCase();
      return matchesFilter && (!needle || blob.includes(needle));
    });
  }, [audit, filter, query]);

  async function previewApprovalWrite() {
    setBridgeMessage("");
    const res = await fetch("/api/recruiter/quick-fix-repair/approvals-write-preview");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to preview approval write");
    setBridge(json);
    setBridgeMessage("Preview generated. Approvals file was not changed.");
  }

  async function writeApprovalsFile() {
    setBridgeMessage("");
    const res = await fetch("/api/recruiter/quick-fix-repair/approvals-write", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ writeReviewFile: true, writeApprovalsFile: true }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to write approvals file");
    setBridge(json);
    setBridgeMessage("Review items and approvals were written to local report files only. Candidate records were not updated.");
  }

  const summary = audit?.summary || {};
  const cards = [
    ["Quick fix candidates", summary.quickFixCandidates],
    ["Selected batch", summary.selectedBatch],
    ["Suggestions generated", summary.suggestionsGenerated],
    ["Safe suggestions", summary.safeSuggestions],
    ["Needs manual review", summary.needsManualReview],
    ["Blocked suggestions", summary.blockedSuggestions],
    ["Missing company fixes", summary.missingCompanyFixes],
    ["Missing title fixes", summary.missingTitleFixes],
    ["Missing module fixes", summary.missingModuleFixes],
    ["Missing location fixes", summary.missingLocationFixes],
    ["Ready for approval preview", summary.readyForApprovalPreview],
    ["Existing approvals preserved", summary.existingApprovalsPreserved],
  ];

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#070A0F] px-6 py-5">
        <div className="mx-auto max-w-[1400px]">
          <Link href="/recruiter/repair-queue" className="text-sm text-cyan-100">Back to repair queue</Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Quick Fix Repair</h1>
          <p className="mt-1 text-sm text-slate-400">QUICK FIX REPAIR IS REVIEW-FIRST. This page does not update candidate records.</p>
        </div>
      </div>
      <section className="mx-auto max-w-[1400px] space-y-5 px-6 py-6">
        {error ? <div className="border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        <div className="border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">Suggestions are generated from deterministic existing candidate data and report files only. Approval preview does not write approvals, staging, or candidate records.</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {cards.map(([label, value]) => <div key={label} className="border border-slate-800 bg-[#0B0F16] p-4"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{Number(value || 0)}</div></div>)}
        </div>
        <div className="flex flex-wrap gap-2 border border-slate-800 bg-[#0B0F16] p-4">
          {filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md border px-3 py-2 text-sm ${filter === item ? "border-cyan-400 bg-cyan-400/10 text-cyan-100" : "border-slate-700 text-slate-300"}`}>{labels[item]}</button>)}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate, field, company, approved value" className="ml-auto min-w-[280px] rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-white outline-none" />
        </div>
        <div className="border border-emerald-500/20 bg-[#0B0F16] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-lg font-semibold text-white">Approval Bridge</h2><p className="mt-1 text-sm text-slate-400">This writes review items and approval decisions only when explicitly confirmed. It does not stage or update candidate records.</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={() => previewApprovalWrite().catch((err) => setBridgeMessage(err instanceof Error ? err.message : "Preview failed"))} className="rounded-md border border-cyan-500/40 px-3 py-2 text-sm font-semibold text-cyan-100">Preview approval write</button><button onClick={() => writeApprovalsFile().catch((err) => setBridgeMessage(err instanceof Error ? err.message : "Write failed"))} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">Promote review + write approvals</button></div>
          </div>
          {bridgeMessage ? <div className="mt-3 border border-slate-700 bg-[#05070A] p-3 text-sm text-cyan-100">{bridgeMessage}</div> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{[["Suggestions loaded", bridge?.summary?.suggestionsLoaded], ["Ready for approval", bridge?.summary?.approvalDecisionsReady], ["Existing approvals preserved", bridge?.summary?.existingApprovalsPreserved], ["Blocked suggestions", bridge?.summary?.suggestionsBlocked], ["Would write approvals", bridge?.summary?.wouldWriteApprovals], ["Approval file status", bridge ? "Ready" : "Preview needed"], ["Next step", "staging preview"]].map(([label, value]) => <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-sm font-semibold text-white">{String(value ?? 0)}</div></div>)}</div>
          <div className="mt-4 border border-slate-800 bg-[#05070A] p-3 font-mono text-xs text-slate-300">npm run stage:ai-approved-changes -- --approvalsPath=reports/ai-extraction-approvals.json --applyPlanPath=reports/ai-extraction-apply-plan.json --dryRun --noApply</div>
        </div>
        <div className="overflow-hidden border border-slate-800 bg-[#0B0F16]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-sm">
              <thead className="bg-[#05070A] text-left text-xs uppercase text-slate-500"><tr>{["Candidate", "Candidate ID", "Field", "Current value", "Suggested value", "Confidence", "Evidence source", "Evidence snippet", "Repair category", "Priority", "Validation", "Approval readiness", "Safety note"].map((head) => <th key={head} className="border-b border-slate-800 px-3 py-3">{head}</th>)}</tr></thead>
              <tbody>{suggestions.map((item) => <tr key={item.suggestionId} className="border-b border-slate-800 align-top text-slate-300"><td className="px-3 py-3 font-semibold text-white">{item.candidateName}</td><td className="px-3 py-3 font-mono text-xs text-slate-400">{item.candidateId}</td><td className="px-3 py-3">{item.fieldName}</td><td className="px-3 py-3">{item.currentValue || "Not available"}</td><td className="px-3 py-3 font-semibold text-cyan-100">{item.suggestedValue || "Not available"}</td><td className="px-3 py-3">{item.confidence}% <span className="text-slate-500">{item.confidenceBand}</span></td><td className="px-3 py-3">{item.evidenceSource || "Not available"}</td><td className="max-w-[260px] px-3 py-3 text-slate-400">{item.evidenceSnippet || "Missing evidence"}</td><td className="px-3 py-3">{item.repairCategory}</td><td className="px-3 py-3">{item.priority}</td><td className="px-3 py-3"><span className={`inline-flex rounded border px-2 py-1 text-xs ${tone(item.validationStatus)}`}>{item.validationStatus.replace(/_/g, " ")}</span>{item.validationReasons?.length ? <div className="mt-1 text-xs text-amber-100">{item.validationReasons.join("; ")}</div> : null}</td><td className="px-3 py-3">{item.approvalReadiness.replace(/_/g, " ")}</td><td className="px-3 py-3 text-xs text-slate-500">{item.safetyNote}</td></tr>)}</tbody>
            </table>
          </div>
          {!suggestions.length ? <div className="p-6 text-sm text-slate-400">No quick fix suggestions found. Run the quick fix repair planning and suggestion commands.</div> : null}
        </div>
      </section>
    </main>
  );
}

