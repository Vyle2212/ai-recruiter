"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowExecutionSimulationItem,
  WorkflowExecutionSimulationReport,
  WorkflowExecutionSimulationStep,
} from "@/lib/recruiterWorkflowExecutionSimulator";

export type WorkflowExecutionSimulationPanelProps = {
  proposalId: string;
  approved: boolean;
};

function readable(
  value: string,
) {
  return value.replace(/_/g, " ");
}

function stepTone(
  step: WorkflowExecutionSimulationStep,
) {
  if (step.status === "simulated") {
    return {
      symbol: "✓",
      icon:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    };
  }

  if (step.status === "blocked") {
    return {
      symbol: "×",
      icon:
        "border-red-500/30 bg-red-500/10 text-red-100",
      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
    };
  }

  return {
    symbol: "○",
    icon:
      "border-slate-700 bg-slate-900 text-slate-400",
    badge:
      "border-slate-700 bg-slate-900 text-slate-400",
  };
}

function SimulationContent({
  simulation,
}: {
  simulation: WorkflowExecutionSimulationItem;
}) {
  return (
    <section className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-200">
            Execution Simulation
          </div>

          <h4 className="mt-2 font-semibold text-white">
            Dry-run completed for{" "}
            {simulation.candidateName ||
              simulation.candidateId}
          </h4>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            The execution plan was simulated in sequence without
            performing any workflow, candidate, audit, or email write.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
            Dry run completed
          </span>

          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
            Execution disabled
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [
            "Simulated",
            simulation.summary.simulated,
            "text-emerald-200",
          ],
          [
            "Skipped",
            simulation.summary.skipped,
            "text-slate-300",
          ],
          [
            "Blocked",
            simulation.summary.blocked,
            "text-red-200",
          ],
          [
            "Total steps",
            simulation.summary.totalSteps,
            "text-cyan-100",
          ],
          [
            "Execution",
            simulation.executionEnabled
              ? "enabled"
              : "disabled",
            "text-amber-200",
          ],
        ].map(
          ([label, value, tone]) => (
            <article
              className="rounded-lg border border-slate-800 bg-[#070A0F] p-3"
              key={String(label)}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </div>

              <div
                className={`mt-1 text-lg font-semibold ${tone}`}
              >
                {value}
              </div>
            </article>
          ),
        )}
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          Rule
          <div className="mt-1 text-slate-300">
            {readable(
              simulation.ruleId,
            )}
          </div>
        </div>

        <div>
          Proposed action
          <div className="mt-1 text-cyan-100">
            {readable(
              simulation.proposedAction,
            )}
          </div>
        </div>

        <div>
          Checksum
          <div className="mt-1 break-all font-mono text-slate-300">
            {simulation.checksum.value}
          </div>
        </div>

        <div>
          Checksum verified
          <div className="mt-1 text-emerald-200">
            {simulation.checksum.verified
              ? "yes"
              : "no"}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {simulation.steps.map((step) => {
          const tone =
            stepTone(step);

          return (
            <article
              className="rounded-lg border border-slate-800 bg-[#070A0F] p-4"
              key={
                step.simulationStepId
              }
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${tone.icon}`}
                >
                  {step.sequence}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-500">
                        {tone.symbol}
                      </span>

                      <h5 className="text-sm font-semibold text-slate-100">
                        {step.title}
                      </h5>
                    </div>

                    <span
                      className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${tone.badge}`}
                    >
                      {step.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {step.simulatedResult}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                    <span>
                      Dependency:{" "}
                      {readable(
                        step.dependencyStatus,
                      )}
                    </span>

                    <span>
                      Would execute: no
                    </span>

                    <span>
                      Duration:{" "}
                      {step.durationMs}ms
                    </span>
                  </div>

                  {step.dependsOn.length ? (
                    <div className="mt-3 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                      Depends on:{" "}
                      <span className="text-slate-400">
                        {step.dependsOn
                          .map(readable)
                          .join(", ")}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-emerald-500/20 bg-black/20 p-3 text-xs text-slate-400">
        Dry run:{" "}
        <span className="font-semibold text-emerald-200">
          yes
        </span>
        {" · "}
        Candidate DB writes:{" "}
        {simulation.summary.candidateDbWrites}
        {" · "}
        Workflow writes:{" "}
        {simulation.summary.workflowWrites}
        {" · "}
        Audit writes:{" "}
        {simulation.summary.auditWrites}
        {" · "}
        Email sends:{" "}
        {simulation.summary.emailSends}
        {" · "}
        Execution enabled: no
      </div>
    </section>
  );
}

export function WorkflowExecutionSimulationPanel({
  proposalId,
  approved,
}: WorkflowExecutionSimulationPanelProps) {
  const [data, setData] =
    useState<WorkflowExecutionSimulationReport | null>(
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
            "/api/recruiter/workflow/execution-simulator?limit=500",
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
              "Unable to load workflow execution simulation",
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
            : "Unable to load workflow execution simulation",
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

  const simulation =
    useMemo(
      () =>
        data?.simulations.find(
          (item) =>
            item.proposalId ===
            proposalId,
        ) || null,
      [
        data,
        proposalId,
      ],
    );

  const skipped =
    useMemo(
      () =>
        data?.skipped.find(
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
        Running workflow dry-run simulation...
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

  if (skipped) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100">
          Simulation skipped
        </div>

        <p className="mt-2 text-sm text-amber-50/80">
          {skipped.reason}
        </p>
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
        No matching workflow simulation is currently available.
      </div>
    );
  }

  return (
    <SimulationContent
      simulation={simulation}
    />
  );
}