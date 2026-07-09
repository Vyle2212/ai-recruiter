"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildLocalApprovalSummary, filterFieldsForView, getApprovalDisabledReason, type FieldViewMode } from "@/lib/aiExtractionReviewClient";
import type { ApprovalState, ApplyPreview, FieldApprovalAction, ReviewFilter, ReviewWorkspace, WorkspaceCandidate, WorkspaceField } from "@/lib/aiExtractionReviewUi";

type SavedApproval = {
  approvalId?: string;
  candidateId: string;
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  parserValue: string;
  aiEvidence: string;
  aiConfidence: number;
  decision: "approve_suggestion" | "reject_suggestion" | "keep_existing" | "mark_for_review" | "manual_override_approve";
  riskLevel: "safe" | "risky" | "rejected" | "conflict";
  reviewerNote: string;
  overrideReason: string;
  reason?: string;
};

const FILTERS: Array<{ key: ReviewFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "safe", label: "Safe suggestions" },
  { key: "risky", label: "Risky suggestions" },
  { key: "manual_review", label: "Manual review" },
  { key: "reupload_required", label: "Reupload required" },
  { key: "still_blocked", label: "Still blocked" },
  { key: "search_ready_after_approval", label: "Search-ready after approval" },
  { key: "missing_ai", label: "Missing AI result" },
  { key: "module_conflict", label: "Module conflict" },
  { key: "employer_issue", label: "Employer issue" },
  { key: "title_issue", label: "Title issue" },
  { key: "identity_issue", label: "Identity issue" },
];

const FIELD_VIEWS: Array<{ key: FieldViewMode; label: string }> = [
  { key: "suggested", label: "Suggested fields" },
  { key: "risk", label: "Risky/rejected" },
  { key: "all", label: "All fields" },
];

const TONE: Record<string, string> = {
  safe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  rejected: "border-red-500/30 bg-red-500/10 text-red-100",
  keep: "border-slate-500/30 bg-slate-500/10 text-slate-100",
  reupload: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100",
  missing: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
};

function empty(value: string) {
  return value || "Not available";
}

function approvalKey(candidateId: string, field: string) {
  return `${candidateId}:${field}`;
}

function localActionFromSaved(decision: SavedApproval["decision"]): FieldApprovalAction {
  if (decision === "approve_suggestion" || decision === "manual_override_approve") return "approve";
  if (decision === "reject_suggestion") return "reject";
  if (decision === "keep_existing") return "keep";
  return "manual_review";
}

function riskLevelForField(field: WorkspaceField): SavedApproval["riskLevel"] {
  if (field.decision === "reject") return "rejected";
  if (field.decision === "conflict") return "conflict";
  if (field.decision === "safe_accept") return "safe";
  return "risky";
}

function persistedDecisionFor(field: WorkspaceField, action: FieldApprovalAction, overrideReason: string): SavedApproval["decision"] {
  if (action === "approve" && field.canApprove) return "approve_suggestion";
  if (action === "approve" && overrideReason.trim()) return "manual_override_approve";
  if (action === "reject") return "reject_suggestion";
  if (action === "keep") return "keep_existing";
  return "mark_for_review";
}

function buildSavedApprovals(workspace: ReviewWorkspace, approvals: ApprovalState): SavedApproval[] {
  const fieldsByKey = new Map<string, WorkspaceField>();
  for (const candidate of workspace.candidates) {
    for (const field of candidate.fields) fieldsByKey.set(approvalKey(candidate.candidateId, field.field), field);
  }
  return Object.entries(approvals).flatMap(([key, approval]) => {
    const index = key.indexOf(":");
    const candidateId = key.slice(0, index);
    const fieldName = key.slice(index + 1);
    const field = fieldsByKey.get(key);
    if (!field || !approval?.action || approval.action === "pending") return [];
    return [{
      approvalId: key,
      candidateId,
      fieldName,
      currentValue: field.existingValue,
      suggestedValue: field.aiValue,
      parserValue: field.parserValue,
      aiEvidence: field.evidence,
      aiConfidence: field.confidence,
      decision: persistedDecisionFor(field, approval.action, approval.overrideReason || ""),
      riskLevel: riskLevelForField(field),
      reviewerNote: "",
      overrideReason: approval.overrideReason || "",
      reason: field.reason,
    }];
  });
}
function matchesFilter(candidate: WorkspaceCandidate, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "safe") return candidate.safeCount > 0;
  if (filter === "risky") return candidate.riskyCount > 0;
  if (filter === "manual_review") return candidate.riskyCount > 0 || candidate.rejectedCount > 0 || candidate.recommendedAction === "Review AI suggestions";
  if (filter === "reupload_required") return candidate.reuploadRequired;
  if (filter === "still_blocked") return candidate.stillBlocked;
  if (filter === "search_ready_after_approval") return candidate.searchReadyAfterManualApprovals;
  if (filter === "missing_ai") return candidate.aiStatus === "AI Missing";
  if (filter === "module_conflict") return candidate.fields.some((field) => /module_conflicts|conflict/i.test(field.reason));
  if (filter === "employer_issue") return candidate.fields.some((field) => /employer|Company/i.test(field.field) && /invalid|dirty|review|missing|not_disclosed/i.test(field.reason));
  if (filter === "title_issue") return candidate.fields.some((field) => field.field === "title" && /invalid|generic|missing|review/i.test(field.reason));
  if (filter === "identity_issue") return candidate.fields.some((field) => field.field === "displayName" && /identity|name|missing|invalid|dirty/i.test(field.reason));
  return true;
}

function statusTone(candidate: WorkspaceCandidate) {
  if (candidate.reuploadRequired) return TONE.reupload;
  if (candidate.aiStatus === "AI Missing") return TONE.missing;
  if (candidate.rejectedCount) return TONE.rejected;
  if (candidate.riskyCount) return TONE.review;
  if (candidate.safeCount) return TONE.safe;
  return TONE.keep;
}

export default function AiExtractionReviewPage() {
  const [workspace, setWorkspace] = useState<ReviewWorkspace | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [fieldView, setFieldView] = useState<FieldViewMode>("suggested");
  const [query, setQuery] = useState("");
  const [approvals, setApprovals] = useState<ApprovalState>({});
  const [savedApprovals, setSavedApprovals] = useState<SavedApproval[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadApprovals() {
      try {
        const res = await fetch("/api/recruiter/ai-extraction-review/approvals", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load saved approvals");
        const loaded = Array.isArray(json.approvals) ? json.approvals as SavedApproval[] : [];
        setSavedApprovals(loaded);
        setApprovals(Object.fromEntries(loaded.map((approval) => [approvalKey(approval.candidateId, approval.fieldName), { action: localActionFromSaved(approval.decision), overrideReason: approval.overrideReason }] as const)));
        setOverrideReasons(Object.fromEntries(loaded.filter((approval) => approval.overrideReason).map((approval) => [approvalKey(approval.candidateId, approval.fieldName), approval.overrideReason] as const)));
        setHasUnsavedChanges(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSaveStatus(err instanceof Error ? err.message : "Unable to load saved approvals");
      }
    }
    loadApprovals();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/recruiter/ai-extraction-review", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load review workspace");
        setWorkspace(json);
        setSelectedId(json.candidates?.[0]?.candidateId || "");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load review workspace");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const filteredCandidates = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (workspace?.candidates || []).filter((candidate) => {
      const searchText = `${candidate.candidateName} ${candidate.candidateId} ${candidate.decisionAction} ${candidate.missingBlockers.join(" ")}`.toLowerCase();
      return matchesFilter(candidate, filter) && (!text || searchText.includes(text));
    });
  }, [workspace, filter, query]);

  const selected = useMemo(() => {
    return (workspace?.candidates || []).find((candidate) => candidate.candidateId === selectedId) || filteredCandidates[0] || null;
  }, [workspace, selectedId, filteredCandidates]);

  const localSummary = useMemo(() => (workspace ? buildLocalApprovalSummary(workspace, approvals) : { approvedFields: 0, rejectedFields: 0, manualReviewFields: 0, readyForApplyPreview: 0 }), [workspace, approvals]);

  async function saveReviewDecisions() {
    if (!workspace) return;
    setSaveStatus("");
    const payload = buildSavedApprovals(workspace, approvals);
    try {
      const res = await fetch("/api/recruiter/ai-extraction-review/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json.errors || [json.error || "Unable to save approvals"]).join("; "));
      const loaded = Array.isArray(json.approvals) ? json.approvals as SavedApproval[] : [];
      setSavedApprovals(loaded);
      setHasUnsavedChanges(false);
      setSaveStatus("Review decisions saved");
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Unable to save approvals");
    }
  }

  async function buildPreview() {
    setPreviewLoading(true);
    setError("");
    try {
      const previewApprovals = workspace ? buildSavedApprovals(workspace, approvals) : savedApprovals;
      const res = await fetch("/api/recruiter/ai-extraction-review/apply-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: previewApprovals }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to build apply preview");
      setPreview(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to build apply preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  function setFieldApproval(candidateId: string, field: WorkspaceField, action: FieldApprovalAction) {
    const key = approvalKey(candidateId, field.field);
    const reason = overrideReasons[key] || "";
    if (action === "approve" && field.requiresOverride && !reason.trim()) return;
    setApprovals((current) => ({ ...current, [key]: { action, overrideReason: reason } }));
    setHasUnsavedChanges(true);
    setSaveStatus("");
  }

  const cards = [
    ["Total queued", workspace?.summary.totalQueued],
    ["AI results available", workspace?.summary.aiResultsAvailable],
    ["Safe field suggestions", workspace?.summary.safeFieldSuggestions],
    ["Risky suggestions", workspace?.summary.riskySuggestions],
    ["Rejected suggestions", workspace?.summary.rejectedSuggestions],
    ["Manual review required", workspace?.summary.manualReviewRequired],
    ["Ready after approval", workspace?.summary.potentialSearchReadyAfterApproval],
    ["Reupload required", workspace?.summary.reuploadRequired],
  ];

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#080B10]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">AI Extraction Review</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Review AI suggestions before Talent Search changes</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">Dry-run only</span>
            <Link href="/search" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Talent Search</Link>
            <Link href="/validation-queue" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Validation Queue</Link>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-6 py-6">
        {error ? <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading AI extraction review...</div> : null}
        {!loading && !workspace?.reportStatus.reviewReportFound ? (
          <div className="border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">No review report found. Generate `reports/ai-extraction-review.json` before using this workspace.</div>
        ) : null}

        {!loading && workspace ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {cards.map(([label, value]) => (
                <div key={String(label)} className="border border-slate-800 bg-[#0B0F16] p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{value ?? "-"}</div>
                </div>
              ))}
            </div>

            <StickyApprovalSummary summary={localSummary} previewLoading={previewLoading} onPreview={buildPreview} onSave={saveReviewDecisions} hasUnsavedChanges={hasUnsavedChanges} saveStatus={saveStatus} />

            <div className="mt-5 flex flex-wrap items-center gap-2 border border-slate-800 bg-[#0B0F16] p-4">
              {FILTERS.map((item) => (
                <button key={item.key} onClick={() => setFilter(item.key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${filter === item.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>
                  {item.label}
                </button>
              ))}
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate, reason, blocker" className="min-w-72 flex-1 rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
            </div>

            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="xl:sticky xl:top-24">
                <CandidateList candidates={filteredCandidates} selectedId={selected?.candidateId || ""} onSelect={setSelectedId} />
              </div>
              {selected ? (
                <CandidateDetail
                  candidate={selected}
                  approvals={approvals}
                  fieldView={fieldView}
                  setFieldView={setFieldView}
                  overrideReasons={overrideReasons}
                  setOverrideReasons={setOverrideReasons}
                  setFieldApproval={setFieldApproval}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                  setSaveStatus={setSaveStatus}
                  preview={preview}
                />
              ) : (
                <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-400">No candidates in this view.</div>
              )}
            </div>

            <details className="mt-5 border border-slate-800 bg-[#0B0F16] p-4 text-sm text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-200">Debug details</summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>Review report: {workspace.reportStatus.reviewReportFound ? "Loaded" : "Missing"}</div>
                <div>Apply plan: {workspace.reportStatus.applyPlanFound ? "Loaded" : "Missing"}</div>
                <div>AI result cache: {workspace.reportStatus.aiResultsFound ? "Loaded" : "Missing"}</div>
                <div>Cache status: {workspace.reportStatus.staleCache ? "May be stale" : "Current enough for review"}</div>
              </div>
              {workspace.reportStatus.errors.length ? <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-red-200">{workspace.reportStatus.errors.join("\n")}</pre> : null}
            </details>
          </>
        ) : null}
      </section>
    </main>
  );
}

function StickyApprovalSummary({ summary, previewLoading, onPreview, onSave, hasUnsavedChanges, saveStatus }: { summary: { approvedFields: number; rejectedFields: number; manualReviewFields: number; readyForApplyPreview: number }; previewLoading: boolean; onPreview: () => void; onSave: () => void; hasUnsavedChanges: boolean; saveStatus: string }) {
  const items = [
    ["Approved fields", summary.approvedFields],
    ["Rejected fields", summary.rejectedFields],
    ["Manual review fields", summary.manualReviewFields],
    ["Ready for apply preview", summary.readyForApplyPreview],
  ];
  return (
    <div className="sticky top-0 z-20 mt-5 border border-slate-800 bg-[#080B10]/95 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {items.map(([label, value]) => (
          <div key={String(label)} className="min-w-36 border border-slate-800 bg-[#05070A] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
            <div className="text-xl font-semibold text-white">{value}</div>
          </div>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasUnsavedChanges ? <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">Unsaved changes</span> : null}
          {saveStatus ? <span className="max-w-sm text-xs text-slate-300">{saveStatus}</span> : null}
          <button onClick={onSave} className="rounded-md border border-slate-600 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-400 hover:text-cyan-100">Save review decisions</button>
          <button onClick={onPreview} disabled={previewLoading} className="rounded-md bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
            {previewLoading ? "Building preview..." : "Generate apply preview"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateList({ candidates, selectedId, onSelect }: { candidates: WorkspaceCandidate[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-hidden border border-slate-800 bg-[#0B0F16]">
      <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">{candidates.length} candidates</div>
      <div className="max-h-[calc(100vh-190px)] divide-y divide-slate-800 overflow-auto">
        {candidates.map((candidate) => (
          <button key={candidate.candidateId} onClick={() => onSelect(candidate.candidateId)} className={`block w-full px-4 py-4 text-left hover:bg-slate-900/70 ${selectedId === candidate.candidateId ? "bg-slate-900" : "bg-[#070A0F]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{candidate.candidateName}</div>
                <div className="mt-1 text-xs text-slate-500">{candidate.currentScore} score - {candidate.searchReadyBefore ? "Search-ready now" : "Not search-ready yet"}</div>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(candidate)}`}>{candidate.aiStatus}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <span className="border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-emerald-100">{candidate.safeCount} Safe</span>
              <span className="border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-amber-100">{candidate.riskyCount} Review</span>
              <span className="border border-red-500/20 bg-red-500/5 px-2 py-1 text-red-100">{candidate.rejectedCount} Rejected</span>
            </div>
            <div className="mt-3 text-sm text-slate-300">{candidate.recommendedAction}</div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{candidate.missingBlockers.length ? candidate.missingBlockers.join(", ") : "No blocker listed"}</div>
          </button>
        ))}
        {!candidates.length ? <div className="p-5 text-sm text-slate-400">No candidates match this filter.</div> : null}
      </div>
    </div>
  );
}

function CandidateDetail({
  candidate,
  approvals,
  fieldView,
  setFieldView,
  overrideReasons,
  setOverrideReasons,
  setFieldApproval,
  setHasUnsavedChanges,
  setSaveStatus,
  preview,
}: {
  candidate: WorkspaceCandidate;
  approvals: ApprovalState;
  fieldView: FieldViewMode;
  setFieldView: (view: FieldViewMode) => void;
  overrideReasons: Record<string, string>;
  setOverrideReasons: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFieldApproval: (candidateId: string, field: WorkspaceField, action: FieldApprovalAction) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveStatus: (value: string) => void;
  preview: ApplyPreview | null;
}) {
  const fields = filterFieldsForView(candidate.fields, fieldView);
  return (
    <div className="border border-slate-800 bg-[#0B0F16]">
      <div className="sticky top-24 z-10 border-b border-slate-800 bg-[#0B0F16]/95 px-4 py-4 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{candidate.candidateName}</h2>
            <p className="mt-1 text-sm text-slate-400">{candidate.recommendedAction} - {candidate.searchReadyAfterManualApprovals ? "Ready after approval" : "Still blocked"}</p>
          </div>
          <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusTone(candidate)}`}>{candidate.recommendedAction}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FIELD_VIEWS.map((view) => (
            <button key={view.key} onClick={() => setFieldView(view.key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${fieldView === view.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-auto p-4">
        {fields.map((field) => (
          <FieldReviewCard
            key={approvalKey(candidate.candidateId, field.field)}
            candidate={candidate}
            field={field}
            approval={approvals[approvalKey(candidate.candidateId, field.field)]?.action || "pending"}
            overrideReason={overrideReasons[approvalKey(candidate.candidateId, field.field)] || ""}
            setOverrideReason={(value) => {
              setOverrideReasons((current) => ({ ...current, [approvalKey(candidate.candidateId, field.field)]: value }));
              setHasUnsavedChanges(true);
              setSaveStatus("");
            }}
            setFieldApproval={setFieldApproval}
          />
        ))}
        {!fields.length ? <div className="border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">No fields match this view.</div> : null}
        <ApplyPreviewPanel preview={preview} />
        <details className="border border-slate-800 bg-[#070A0F] p-4 text-sm text-slate-400">
          <summary className="cursor-pointer font-semibold text-slate-200">Debug details</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(candidate.debug, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

function FieldReviewCard({
  candidate,
  field,
  approval,
  overrideReason,
  setOverrideReason,
  setFieldApproval,
}: {
  candidate: WorkspaceCandidate;
  field: WorkspaceField;
  approval: FieldApprovalAction;
  overrideReason: string;
  setOverrideReason: (value: string) => void;
  setFieldApproval: (candidateId: string, field: WorkspaceField, action: FieldApprovalAction) => void;
}) {
  const disabledReason = getApprovalDisabledReason(field, overrideReason);
  const approveDisabled = !field.canApprove || (field.requiresOverride && !overrideReason.trim());
  const quiet = !field.aiValue && !field.evidence && field.decision === "missing_evidence";
  return (
    <article className={`border p-4 ${quiet ? "border-slate-800 bg-[#070A0F]/60 opacity-75" : "border-slate-700 bg-[#070A0F]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{field.label}</h3>
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${TONE[field.statusTone]}`}>{field.statusLabel}</span>
            <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">Confidence {field.confidence}</span>
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Current value</div>
              <div className="mt-1 text-sm text-slate-200">{empty(field.existingValue)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">AI Suggestion</div>
              <div className="mt-1 text-sm font-semibold text-cyan-100">{empty(field.aiValue)}</div>
            </div>
          </div>
        </div>
        <DecisionControls candidate={candidate} field={field} approval={approval} approveDisabled={approveDisabled} disabledReason={disabledReason} setFieldApproval={setFieldApproval} />
      </div>
      <div className="mt-3 text-sm text-slate-400">
        <span className="font-semibold text-slate-300">Evidence from CV:</span> {empty(field.evidence)}
      </div>
      {disabledReason ? <div className="mt-2 text-xs font-semibold text-amber-200">Approval blocked: {disabledReason}</div> : null}
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer text-slate-400">Parser result and reason</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>Parser Result: <span className="text-slate-300">{empty(field.parserValue)}</span></div>
          <div>Reason: <span className="text-slate-300">{field.reason || "No reason listed"}</span></div>
        </div>
      </details>
      {field.requiresOverride ? (
        <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Manual override reason required before local approval" className="mt-3 min-h-16 w-full rounded-md border border-amber-500/30 bg-[#05070A] p-2 text-xs text-slate-100 outline-none focus:border-amber-400" />
      ) : null}
    </article>
  );
}

function DecisionControls({ candidate, field, approval, approveDisabled, disabledReason, setFieldApproval }: { candidate: WorkspaceCandidate; field: WorkspaceField; approval: FieldApprovalAction; approveDisabled: boolean; disabledReason: string; setFieldApproval: (candidateId: string, field: WorkspaceField, action: FieldApprovalAction) => void }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:w-[310px]">
      <button title={disabledReason || "Approve suggestion"} onClick={() => setFieldApproval(candidate.candidateId, field, "approve")} disabled={approveDisabled} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "approve" ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300 hover:border-emerald-500"} disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600`}>
        Approve suggestion
      </button>
      <button onClick={() => setFieldApproval(candidate.candidateId, field, "reject")} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "reject" ? "border-red-400 bg-red-500/15 text-red-100" : "border-slate-700 text-slate-300 hover:border-red-500"}`}>Reject suggestion</button>
      <button onClick={() => setFieldApproval(candidate.candidateId, field, "keep")} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "keep" ? "border-slate-400 bg-slate-500/15 text-slate-100" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>Keep current value</button>
      <button onClick={() => setFieldApproval(candidate.candidateId, field, "manual_review")} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "manual_review" ? "border-amber-400 bg-amber-500/15 text-amber-100" : "border-slate-700 text-slate-300 hover:border-amber-500"}`}>Mark for review</button>
    </div>
  );
}

function ApplyPreviewPanel({ preview }: { preview: ApplyPreview | null }) {
  if (!preview) return <div className="border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">No dry-run preview yet.</div>;
  return (
    <section className="border border-slate-800 bg-[#070A0F]">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Apply preview</h2>
        <p className="mt-1 text-sm text-slate-400">Only locally approved safe changes are shown. Current Talent Search data stays unchanged.</p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Approved fields", preview.approvedFieldsCount],
          ["Candidates ready", preview.candidatesReadyForApply],
          ["Need review", preview.candidatesStillRequiringManualReview],
          ["Rejected fields", preview.rejectedFields],
          ["Current values kept", preview.existingFieldsPreserved],
          ["Unsafe changes prevented", preview.unsafeDowngradePrevented],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      {preview.warnings.length ? <div className="mx-4 mb-4 border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{preview.warnings.slice(0, 6).join(" ")}</div> : null}
      <div className="space-y-2 p-4 pt-0">
        {preview.changes.map((change) => (
          <div key={`${change.candidateId}-${change.field}`} className="grid gap-2 border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300 md:grid-cols-[1fr_1fr_1fr_1fr]">
            <div><span className="text-slate-500">Field:</span> {change.label}</div>
            <div><span className="text-slate-500">Before:</span> {empty(change.beforeValue)}</div>
            <div><span className="text-slate-500">After:</span> <span className="font-semibold text-cyan-100">{empty(change.afterValue)}</span></div>
            <div><span className="text-slate-500">Status:</span> {change.approvalStatus}</div>
          </div>
        ))}
        {!preview.changes.length ? <div className="border border-slate-800 p-4 text-sm text-slate-400">No approved safe changes are ready in this preview.</div> : null}
      </div>
    </section>
  );
}




