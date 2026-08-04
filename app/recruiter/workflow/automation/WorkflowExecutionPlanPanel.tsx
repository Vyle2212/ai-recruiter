"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowExecutionPlanItem,
  WorkflowExecutionPlanReport,
  WorkflowExecutionPlanStep,
} from "@/lib/recruiterWorkflowExecutionPlan";

export type WorkflowExecutionPlanPanelProps = {
  proposalId: string;
  approved: boolean;
};

function stepTone(
  step: WorkflowExecutionPlanStep,
) {
  if (step.status === "planned") {
    return {
      symbol: "✓",
      icon:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      badge:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
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

function readable(
  value: string,
) {
  return value.replace(/_/g, " ");
}

function PlanContent({
  plan,
}: {
  plan: WorkflowExecutionPlanItem;
}) {
  return (
    <section className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-200">
            Execution Plan
          </div>

          <h4 className="mt-2 font-semibold text-white">
            {plan.title}
          </h4>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            {plan.description}
          </p>
        </div>

        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
          Readiness: READY
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Planned",
            plan.summary.planned,
            "text-cyan-100",
          ],
          [
            "Disabled",
            plan.summary.disabled,
            "text-slate-300",
          ],
          [
            "Blocked",
            plan.summary.blocked,
            "text-red-200",
          ],
          [
            "Execution enabled",
            plan.summary.executionEnabled
              ? "yes"
              : "no",
            "text-emerald-200",
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
          Expected stage
          <div className="mt-1 text-slate-300">
            {plan.expectedStage
              ? readable(
                  plan.expectedStage,
                )
              : "Not available"}
          </div>
        </div>

        <div>
          Current stage
          <div className="mt-1 text-slate-300">
            {plan.currentStage
              ? readable(
                  plan.currentStage,
                )
              : "Not available"}
          </div>
        </div>

        <div>
          Rule
          <div className="mt-1 text-slate-300">
            {readable(
              plan.ruleId,
            )}
          </div>
        </div>

        <div>
          Proposed action
          <div className="mt-1 text-cyan-100">
            {readable(
              plan.proposedAction,
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {plan.steps.map((step) => {
          const tone =
            stepTone(step);

          return (
            <article
              className="rounded-lg border border-slate-800 bg-[#070A0F] p-4"
              key={step.stepId}
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
                    {step.description}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {step.reason}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                    <span>
                      Would execute: no
                    </span>

                    <span>
                      DB writes:{" "}
                      {step.candidateDbWrites}
                    </span>

                    <span>
                      Workflow writes:{" "}
                      {step.workflowWrites}
                    </span>

                    <span>
                      Emails:{" "}
                      {step.emailSends}
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

      <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-400">
        Execution enabled:{" "}
        <span className="font-semibold text-emerald-200">
          no
        </span>
        {" · "}
        Candidate DB writes:{" "}
        {plan.summary.candidateDbWrites}
        {" · "}
        Workflow writes:{" "}
        {plan.summary.workflowWrites}
        {" · "}
        Email sends:{" "}
        {plan.summary.emailSends}
        {" · "}
        Preview only
      </div>
    </section>
  );
}

export function WorkflowExecutionPlanPanel({
  proposalId,
  approved,
}: WorkflowExecutionPlanPanelProps) {
  const [data, setData] =
    useState<WorkflowExecutionPlanReport | null>(
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
            "/api/recruiter/workflow/execution-plan?limit=500",
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
              "Unable to load workflow execution plan",
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
            : "Unable to load workflow execution plan",
        );
      } finally {
        if (!controller.signal.aborted) {
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

  const plan =
    useMemo(
      () =>
        data?.plans.find(
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
        Building execution plan...
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
          Execution plan not created
        </div>

        <p className="mt-2 text-sm text-amber-50/80">
          Readiness status:{" "}
          {skipped.readinessStatus}
          {" · "}
          {skipped.reason}
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
        No matching execution plan is currently available.
      </div>
    );
  }

  return (
    <PlanContent
      plan={plan}
    />
  );
}