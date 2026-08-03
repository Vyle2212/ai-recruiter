"use client";

import { useMemo, useState } from "react";

import {
  getAllowedLifecycleTransitions,
} from "@/lib/candidateLifecycleTransitions";
import {
  PIPELINE_STAGE_LABELS,
  type CandidateLifecycleRecord,
  type CandidatePipelineStage,
} from "@/lib/candidateLifecycleTypes";

type TransitionResponse = {
  ok?: boolean;
  status?: number;
  executed?: boolean;
  error?: string;
  decision?: {
    allowed: boolean;
    blockers: string[];
    warnings: string[];
    next?: CandidateLifecycleRecord | null;
  };
  lifecycle?: CandidateLifecycleRecord;
  persistence?: {
    backupPath?: string | null;
    atomicWrite?: boolean;
    candidateDbWrites?: number;
  };
};

function dateTimeLocalToIso(value: string) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function messageFromResponse(
  response: TransitionResponse,
) {
  if (response.error) return response.error;

  if (response.executed) {
    return "Workflow stage updated successfully.";
  }

  if (response.decision?.allowed) {
    return "Preview approved. Review and confirm the transition.";
  }

  return (
    response.decision?.blockers?.join(" ") ||
    "The transition could not be processed."
  );
}

export function CandidateLifecycleControls({
  lifecycle,
}: {
  lifecycle: CandidateLifecycleRecord;
}) {
  const rules = useMemo(
    () =>
      getAllowedLifecycleTransitions(
        lifecycle.stage,
      ),
    [lifecycle.stage],
  );

  const [toStage, setToStage] =
    useState<CandidatePipelineStage | "">(
      rules[0]?.to || "",
    );

  const selectedRule = rules.find(
    (rule) => rule.to === toStage,
  );

  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] =
    useState(false);

  const [preview, setPreview] =
    useState<TransitionResponse | null>(
      null,
    );

  const [rollbackPreview, setRollbackPreview] =
    useState<TransitionResponse | null>(
      null,
    );

  const [message, setMessage] =
    useState("");

  async function post(
    url: string,
    body: Record<string, unknown>,
  ): Promise<TransitionResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
    });

    const result =
      (await response.json()) as
        TransitionResponse;

    if (!response.ok && !result.status) {
      result.status = response.status;
    }

    return result;
  }

  async function previewMove() {
    if (!toStage) return;

    setLoading(true);
    setMessage("");
    setPreview(null);

    try {
      const result = await post(
        "/api/recruiter/workflow/move-stage",
        {
          candidateId:
            lifecycle.candidateId,
          toStage,
          expectedStage:
            lifecycle.stage,
          note,
          dueAt:
            dateTimeLocalToIso(dueAt),
          execute: false,
        },
      );

      setPreview(result);
      setMessage(
        messageFromResponse(result),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to preview transition.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function executeMove() {
    if (
      !toStage ||
      !preview?.decision?.allowed
    ) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await post(
        "/api/recruiter/workflow/move-stage",
        {
          candidateId:
            lifecycle.candidateId,
          toStage,
          expectedStage:
            lifecycle.stage,
          note,
          dueAt:
            dateTimeLocalToIso(dueAt),
          execute: true,
        },
      );

      setMessage(
        messageFromResponse(result),
      );

      if (result.executed) {
        window.location.reload();
      } else {
        setPreview(result);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to execute transition.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function previewRollback() {
    setLoading(true);
    setMessage("");
    setRollbackPreview(null);

    try {
      const result = await post(
        "/api/recruiter/workflow/rollback-stage",
        {
          candidateId:
            lifecycle.candidateId,
          expectedStage:
            lifecycle.stage,
          note:
            note ||
            `Rollback from ${lifecycle.stage}.`,
          execute: false,
        },
      );

      setRollbackPreview(result);
      setMessage(
        messageFromResponse(result),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to preview rollback.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function executeRollback() {
    if (
      !rollbackPreview?.lifecycle
    ) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await post(
        "/api/recruiter/workflow/rollback-stage",
        {
          candidateId:
            lifecycle.candidateId,
          expectedStage:
            lifecycle.stage,
          note:
            note ||
            `Rollback from ${lifecycle.stage}.`,
          execute: true,
        },
      );

      setMessage(
        messageFromResponse(result),
      );

      if (result.executed) {
        window.location.reload();
      } else {
        setRollbackPreview(result);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to execute rollback.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-[#070A0F] p-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
          Workflow controls
        </div>

        <h3 className="mt-2 font-semibold text-white">
          Move candidate stage
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Preview first. Confirming updates only the persisted
          workflow state and never writes to the candidate database.
        </p>
      </div>

      {rules.length ? (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="text-sm text-slate-300">
              Target stage

              <select
                className="mt-2 w-full rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-100"
                value={toStage}
                onChange={(event) => {
                  setToStage(
                    event.target
                      .value as CandidatePipelineStage,
                  );
                  setPreview(null);
                }}
              >
                {rules.map((rule) => (
                  <option
                    key={rule.to}
                    value={rule.to}
                  >
                    {
                      PIPELINE_STAGE_LABELS[
                        rule.to
                      ]
                    }
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Transition note
              {selectedRule?.requiresNote
                ? " *"
                : ""}

              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-100"
                onChange={(event) => {
                  setNote(
                    event.target.value,
                  );
                  setPreview(null);
                }}
                placeholder="Add context or recruiter decision evidence"
                value={note}
              />
            </label>

            <label className="text-sm text-slate-300">
              Due date
              {selectedRule?.requiresDueDate
                ? " *"
                : ""}

              <input
                className="mt-2 w-full rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-100"
                onChange={(event) => {
                  setDueAt(
                    event.target.value,
                  );
                  setPreview(null);
                }}
                type="datetime-local"
                value={dueAt}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
              disabled={
                loading || !toStage
              }
              onClick={previewMove}
              type="button"
            >
              {loading
                ? "Processing..."
                : "Preview move"}
            </button>

            <button
              className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={
                loading ||
                !preview?.decision
                  ?.allowed
              }
              onClick={executeMove}
              type="button"
            >
              Confirm move
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-slate-800 p-4 text-sm text-slate-400">
          No forward transitions are available from this stage.
        </div>
      )}

      {preview?.decision ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-[#05070A] p-4">
          <div className="font-semibold text-white">
            Transition preview
          </div>

          <div className="mt-2 text-sm text-slate-300">
            Allowed:{" "}
            {preview.decision.allowed
              ? "yes"
              : "no"}
          </div>

          {preview.decision.next ? (
            <div className="mt-2 text-sm text-cyan-100">
              {PIPELINE_STAGE_LABELS[
                lifecycle.stage
              ]}{" "}
              →{" "}
              {PIPELINE_STAGE_LABELS[
                preview.decision.next
                  .stage
              ]}
            </div>
          ) : null}

          {preview.decision.blockers
            ?.length ? (
            <ul className="mt-3 space-y-1 text-sm text-red-100">
              {preview.decision.blockers.map(
                (blocker) => (
                  <li key={blocker}>
                    • {blocker}
                  </li>
                ),
              )}
            </ul>
          ) : null}

          {preview.decision.warnings
            ?.length ? (
            <ul className="mt-3 space-y-1 text-sm text-amber-100">
              {preview.decision.warnings.map(
                (warning) => (
                  <li key={warning}>
                    • {warning}
                  </li>
                ),
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-slate-800 pt-5">
        <h3 className="font-semibold text-white">
          Rollback stage
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          {lifecycle.previousStage
            ? `Previous stage: ${
                PIPELINE_STAGE_LABELS[
                  lifecycle.previousStage
                ]
              }`
            : "No previous stage is available."}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-40"
            disabled={
              loading ||
              !lifecycle.previousStage
            }
            onClick={previewRollback}
            type="button"
          >
            Preview rollback
          </button>

          <button
            className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-40"
            disabled={
              loading ||
              !rollbackPreview
                ?.lifecycle
            }
            onClick={executeRollback}
            type="button"
          >
            Confirm rollback
          </button>
        </div>

        {rollbackPreview?.lifecycle ? (
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
            Rollback preview:{" "}
            {
              PIPELINE_STAGE_LABELS[
                lifecycle.stage
              ]
            }{" "}
            →{" "}
            {
              PIPELINE_STAGE_LABELS[
                rollbackPreview.lifecycle
                  .stage
              ]
            }
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
          {message}
        </div>
      ) : null}
    </div>
  );
}