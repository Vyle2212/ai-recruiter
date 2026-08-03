"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowExecutionReadinessCheck,
  WorkflowExecutionReadinessItem,
  WorkflowExecutionReadinessReport,
  WorkflowExecutionReadinessStatus,
} from "@/lib/recruiterWorkflowExecutionReadiness";

export type WorkflowExecutionReadinessPanelProps = {
  proposalId: string;
  approved: boolean;
};

function statusTone(
  status: WorkflowExecutionReadinessStatus,
) {
  if (status === "READY") {
    return {
      container:
        "border-emerald-500/30 bg-emerald-500/5",
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
      title:
        "text-emerald-100",
    };
  }

  if (status === "BLOCKED") {
    return {
      container:
        "border-red-500/30 bg-red-500/5",
      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
      title:
        "text-red-100",
    };
  }

  if (status === "STALE") {
    return {
      container:
        "border-amber-500/30 bg-amber-500/5",
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",
      title:
        "text-amber-100",
    };
  }

  return {
    container:
      "border-slate-700 bg-slate-900/40",
    badge:
      "border-slate-600 bg-slate-800 text-slate-200",
    title:
      "text-slate-200",
  };
}

function checkTone(
  check: WorkflowExecutionReadinessCheck,
) {
  if (check.status === "passed") {
    return {
      symbol: "✓",
      icon:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    };
  }

  if (check.status === "failed") {
    return {
      symbol: "×",
      icon:
        "border-red-500/30 bg-red-500/10 text-red-100",
      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
    };
  }

  return {
    symbol: "!",
    icon:
      "border-amber-500/30 bg-amber-500/10 text-amber-100",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-100",
  };
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function readable(
  value: string | null,
) {
  return value
    ? value.replace(/_/g, " ")
    : "Not available";
}

function ReadinessContent({
  item,
}: {
  item: WorkflowExecutionReadinessItem;
}) {
  const tone =
    statusTone(item.status);

  return (
    <section
      className={`mt-4 rounded-xl border p-4 ${tone.container}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            Execution Readiness
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] ${tone.badge}`}
            >
              {item.status}
            </span>

            <span className="text-xs text-slate-500">
              Execution disabled
            </span>
          </div>

          <h4
            className={`mt-3 font-semibold ${tone.title}`}
          >
            {item.reason}
          </h4>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div>
            Approved:
          </div>

          <div className="mt-1 text-slate-300">
            {formatDate(
              item.approvedAt,
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Passed",
            item.summary.passed,
            "text-emerald-200",
          ],
          [
            "Failed",
            item.summary.failed,
            "text-red-200",
          ],
          [
            "Warnings",
            item.summary.warnings,
            "text-amber-200",
          ],
          [
            "Total checks",
            item.summary.totalChecks,
            "text-cyan-100",
          ],
        ].map(
          ([label, value, valueTone]) => (
            <article
              className="rounded-lg border border-slate-800 bg-[#070A0F] p-3"
              key={String(label)}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </div>

              <div
                className={`mt-1 text-lg font-semibold ${valueTone}`}
              >
                {value}
              </div>
            </article>
          ),
        )}
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          Expected stage
          <div className="mt-1 text-slate-300">
            {readable(
              item.expectedStage,
            )}
          </div>
        </div>

        <div>
          Current stage
          <div className="mt-1 text-slate-300">
            {readable(
              item.currentStage,
            )}
          </div>
        </div>

        <div>
          Rule
          <div className="mt-1 text-slate-300">
            {readable(
              item.ruleId,
            )}
          </div>
        </div>

        <div>
          Proposed action
          <div className="mt-1 text-cyan-100">
            {readable(
              item.proposedAction,
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {item.checks.map((check) => {
          const checkStyle =
            checkTone(check);

          return (
            <article
              className="rounded-lg border border-slate-800 bg-[#070A0F] p-4"
              key={check.checkId}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${checkStyle.icon}`}
                >
                  {checkStyle.symbol}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="text-sm font-semibold text-slate-100">
                      {check.title}
                    </h5>

                    <span
                      className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${checkStyle.badge}`}
                    >
                      {check.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {check.description}
                  </p>

                  <div className="mt-2 text-xs text-slate-500">
                    Evidence:{" "}
                    <span className="text-slate-300">
                      {check.evidence === null
                        ? "Not available"
                        : String(
                            check.evidence,
                          )}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-black/20 p-3 text-xs text-slate-400">
        Execution enabled:{" "}
        <span className="font-semibold text-emerald-200">
          no
        </span>
        {" · "}
        Candidate DB writes:{" "}
        {item.execution.candidateDbWrites}
        {" · "}
        Workflow writes:{" "}
        {item.execution.workflowWrites}
        {" · "}
        Email sends:{" "}
        {item.execution.emailSends}
        {" · "}
        Automatic execution:{" "}
        {item.execution.automaticExecution
          ? "yes"
          : "no"}
      </div>
    </section>
  );
}

export function WorkflowExecutionReadinessPanel({
  proposalId,
  approved,
}: WorkflowExecutionReadinessPanelProps) {
  const [data, setData] =
    useState<WorkflowExecutionReadinessReport | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!approved) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }

    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/recruiter/workflow/execution-readiness?limit=500",
            {
              signal:
                controller.signal,
            },
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load workflow execution readiness",
          );
        }

        setData(result);
      } catch (loadError) {
        if (
          loadError instanceof Error &&
          loadError.name ===
            "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load workflow execution readiness",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    load();

    return () =>
      controller.abort();
  }, [
    approved,
    proposalId,
  ]);

  const readiness =
    useMemo(
      () =>
        data?.items.find(
          (item) =>
            item.proposalId ===
            proposalId,
        ) || null,
      [
        data,
        proposalId,
      ],
    );

  if (!approved) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-800 bg-[#070A0F] p-4 text-sm text-slate-400">
        Evaluating execution readiness...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  if (!readiness) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
        No matching execution readiness result is currently available.
      </div>
    );
  }

  return (
    <ReadinessContent
      item={readiness}
    />
  );
}