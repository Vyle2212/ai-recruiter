"use client";

import { useMemo, useState } from "react";
import type { CandidateValidationAction, CandidateValidationState } from "@/lib/candidateValidation";

type Props = {
  candidateId: string;
  initialState: CandidateValidationState;
};

type CheckRowProps = {
  label: string;
  ok: boolean;
};

function CheckRow({ label, ok }: CheckRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-950/20 px-3 py-2">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${ok ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200" : "border-amber-500/35 bg-amber-950/20 text-amber-100"}`}>
        {ok ? "Confirmed" : "Review"}
      </span>
    </div>
  );
}

function ActionButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/45 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function CandidateValidationPanel({ candidateId, initialState }: Props) {
  const [state, setState] = useState(initialState);
  const [nameCorrection, setNameCorrection] = useState(initialState.corrections.name || "");
  const [employerCorrection, setEmployerCorrection] = useState(initialState.corrections.employer || "");
  const [sapYearsCorrection, setSapYearsCorrection] = useState(String(initialState.corrections.sapYears || ""));
  const [duplicateOf, setDuplicateOf] = useState(initialState.corrections.duplicateOf || "");
  const [reason, setReason] = useState("Recruiter validation");
  const [savingAction, setSavingAction] = useState<CandidateValidationAction | "">("");
  const [error, setError] = useState("");

  const flagRows = useMemo(() => [
    ["Duplicate suspected", state.flags.duplicateSuspected],
    ["Employer missing", state.flags.employerMissing],
    ["Invalid name", state.flags.invalidName],
    ["Low parser confidence", state.flags.lowParserConfidence],
  ] as const, [state.flags]);

  async function runAction(action: CandidateValidationAction, value?: string | number) {
    setSavingAction(action);
    setError("");
    try {
      const response = await fetch("/api/candidate-validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, action, value, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Validation update failed.");
      setState(data.state);
    } catch (err: any) {
      setError(err?.message || "Validation update failed.");
    } finally {
      setSavingAction("");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800/55 bg-[#111820] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Validation</div>
          <h2 className="mt-1 text-xl font-bold text-white">Recruiter validation workspace</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-700/60 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-slate-200">{state.status}</span>
          <span className="rounded-full border border-cyan-500/25 bg-cyan-950/20 px-3 py-1 text-xs font-semibold text-cyan-100">Score {state.score}/{state.threshold}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">Identity</h3>
          <CheckRow label="Name" ok={state.checks.identity.name} />
          <CheckRow label="Email" ok={state.checks.identity.email} />
          <CheckRow label="Phone" ok={state.checks.identity.phone} />
          <CheckRow label="LinkedIn" ok={state.checks.identity.linkedIn} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">Employment</h3>
          <CheckRow label="Current Company" ok={state.checks.employment.currentCompany} />
          <CheckRow label="Previous Companies" ok={state.checks.employment.previousCompanies} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">SAP</h3>
          <CheckRow label="Modules" ok={state.checks.sap.modules} />
          <CheckRow label="SAP Years" ok={state.checks.sap.sapYears} />
          <CheckRow label="S/4" ok={state.checks.sap.s4} />
          <CheckRow label="Industry" ok={state.checks.sap.industry} />
          <CheckRow label="Consulting Background" ok={state.checks.sap.consultingBackground} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">Flags</h3>
          {flagRows.map(([label, active]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-950/20 px-3 py-2">
              <span className="text-sm font-medium text-slate-200">{label}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${active ? "border-amber-500/35 bg-amber-950/20 text-amber-100" : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"}`}>
                {active ? "Flagged" : "Clear"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-950/20 p-4">
          <h3 className="text-sm font-bold text-white">Recruiter actions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton label="Approve Name" disabled={savingAction === "approve-name"} onClick={() => runAction("approve-name")} />
            <ActionButton label="Approve Employer" disabled={savingAction === "approve-employer"} onClick={() => runAction("approve-employer")} />
            <ActionButton label="Approve SAP Years" disabled={savingAction === "approve-sap-years"} onClick={() => runAction("approve-sap-years", sapYearsCorrection ? Number(sapYearsCorrection) : undefined)} />
            <ActionButton label="Merge Duplicate" disabled={savingAction === "merge-duplicate"} onClick={() => runAction("merge-duplicate", duplicateOf)} />
            <ActionButton label="Hide Candidate" disabled={savingAction === "hide-candidate"} onClick={() => runAction("hide-candidate")} />
            <ActionButton label="Archive Candidate" disabled={savingAction === "archive-candidate"} onClick={() => runAction("archive-candidate")} />
            <ActionButton label="Mark Ready" disabled={savingAction === "mark-ready"} onClick={() => runAction("mark-ready")} />
            <ActionButton label="Mark Needs Review" disabled={savingAction === "mark-needs-review"} onClick={() => runAction("mark-needs-review")} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-950/20 p-4">
          <h3 className="text-sm font-bold text-white">Corrections</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={nameCorrection} onChange={(event) => setNameCorrection(event.target.value)} placeholder="Correct name" className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60" />
            <ActionButton label="Correct Name" disabled={!nameCorrection || savingAction === "correct-name"} onClick={() => runAction("correct-name", nameCorrection)} />
            <input value={employerCorrection} onChange={(event) => setEmployerCorrection(event.target.value)} placeholder="Correct employer" className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60" />
            <ActionButton label="Correct Employer" disabled={!employerCorrection || savingAction === "correct-employer"} onClick={() => runAction("correct-employer", employerCorrection)} />
            <input value={sapYearsCorrection} onChange={(event) => setSapYearsCorrection(event.target.value)} placeholder="SAP years" inputMode="numeric" className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60" />
            <input value={duplicateOf} onChange={(event) => setDuplicateOf(event.target.value)} placeholder="Duplicate master id" className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60" />
          </div>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60" />
        </div>
      </div>

      {state.blockingReasons.length ? (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/10 p-3 text-sm text-amber-100">
          Export blocked: {state.blockingReasons.join("; ")}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3 text-sm text-emerald-100">
          Client export eligible.
        </div>
      )}

      {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm font-semibold text-red-100">{error}</div> : null}

      <div className="mt-5">
        <h3 className="text-sm font-bold text-white">Validation history</h3>
        <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
          {state.history.length ? state.history.slice().reverse().map((entry) => (
            <div key={`${entry.timestamp}-${entry.field}-${entry.reason}`} className="rounded-lg border border-slate-800/60 bg-slate-950/20 p-3 text-xs text-slate-300">
              <div className="font-semibold text-slate-100">{entry.action} by {entry.user}</div>
              <div className="mt-1 text-slate-400">{entry.timestamp} - {entry.field}: {String(entry.oldValue || "empty")} to {String(entry.newValue || "empty")}</div>
              <div className="mt-1 text-slate-400">Reason: {entry.reason}</div>
            </div>
          )) : <div className="rounded-lg border border-slate-800/60 bg-slate-950/20 p-3 text-sm text-slate-400">No validation changes recorded yet.</div>}
        </div>
      </div>
    </section>
  );
}
