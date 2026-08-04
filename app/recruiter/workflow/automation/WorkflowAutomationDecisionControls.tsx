"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionStatus,
} from "@/lib/recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationProposal,
} from "@/lib/recruiterWorkflowAutomationRules";

export type WorkflowAutomationDecisionControlsProps = {
  proposal: RecruiterWorkflowAutomationProposal;
  decision: WorkflowAutomationDecision | null;
  onDecisionSaved: (
    decision: WorkflowAutomationDecision,
  ) => void;
  onDecisionCleared: (
    proposalId: string,
  ) => void;
};

function decisionTone(
  decision: WorkflowAutomationDecisionStatus,
) {
  if (decision === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (decision === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

function label(
  decision: WorkflowAutomationDecisionStatus,
) {
  if (decision === "approved") {
    return "Approved — not executed";
  }

  if (decision === "rejected") {
    return "Rejected";
  }

  return "Deferred";
}

export function WorkflowAutomationDecisionControls({
  proposal,
  decision,
  onDecisionSaved,
  onDecisionCleared,
}: WorkflowAutomationDecisionControlsProps) {
  const [reason, setReason] =
    useState(
      decision?.reason || "",
    );

  const [saving, setSaving] =
    useState<
      WorkflowAutomationDecisionStatus | "clear" | null
    >(null);

  const [error, setError] =
    useState("");

  const currentLabel =
    useMemo(
      () =>
        decision
          ? label(decision.decision)
          : null,
      [decision],
    );

  async function saveDecision(
    status: WorkflowAutomationDecisionStatus,
  ) {
    setSaving(status);
    setError("");

    try {
      const response = await fetch(
        "/api/recruiter/workflow/automation-decisions",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            proposalId:
              proposal.proposalId,

            candidateId:
              proposal.candidateId,

            ruleId:
              proposal.ruleId,

            proposedAction:
              proposal.proposedAction,

            decision:
              status,

            reason:
              reason.trim(),

            reviewerName:
              "Recruiter",
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save automation decision",
        );
      }

      onDecisionSaved(
        result.decision,
      );

      setReason(
        result.decision.reason || "",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save automation decision",
      );
    } finally {
      setSaving(null);
    }
  }

  async function clearDecision() {
    setSaving("clear");
    setError("");

    try {
      const response = await fetch(
        `/api/recruiter/workflow/automation-decisions?proposalId=${encodeURIComponent(
          proposal.proposalId,
        )}`,
        {
          method: "DELETE",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to clear automation decision",
        );
      }

      onDecisionCleared(
        proposal.proposalId,
      );

      setReason("");
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Unable to clear automation decision",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-800 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            Recruiter review
          </div>

          {decision ? (
            <div
              className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${decisionTone(
                decision.decision,
              )}`}
            >
              {currentLabel}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-400">
              No decision recorded.
            </div>
          )}
        </div>

        {decision ? (
          <button
            className="text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            disabled={saving !== null}
            onClick={clearDecision}
            type="button"
          >
            {saving === "clear"
              ? "Clearing..."
              : "Clear decision"}
          </button>
        ) : null}
      </div>

      <textarea
        className="mt-4 min-h-24 w-full rounded-md border border-slate-700 bg-[#070A0F] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
        onChange={(event) =>
          setReason(event.target.value)
        }
        placeholder="Optional recruiter review note..."
        value={reason}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-50"
          disabled={saving !== null}
          onClick={() =>
            saveDecision("approved")
          }
          type="button"
        >
          {saving === "approved"
            ? "Saving..."
            : "Approve"}
        </button>

        <button
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 disabled:opacity-50"
          disabled={saving !== null}
          onClick={() =>
            saveDecision("rejected")
          }
          type="button"
        >
          {saving === "rejected"
            ? "Saving..."
            : "Reject"}
        </button>

        <button
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
          disabled={saving !== null}
          onClick={() =>
            saveDecision("deferred")
          }
          type="button"
        >
          {saving === "deferred"
            ? "Saving..."
            : "Defer"}
        </button>
      </div>

      {decision ? (
        <div className="mt-3 text-xs text-slate-500">
          Execution status:{" "}
          <span className="text-amber-200">
            not executed
          </span>
          {" · "}
          Updated:{" "}
          {decision.updatedAt}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-3 text-[10px] uppercase tracking-[0.1em] text-slate-600">
        Decision storage only · no workflow execution
      </div>
    </div>
  );
}