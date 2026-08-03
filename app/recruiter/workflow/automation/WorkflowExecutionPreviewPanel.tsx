"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowExecutionPreviewFeed,
  WorkflowExecutionPreviewItem,
  WorkflowExecutionPreviewStep,
} from "@/lib/recruiterWorkflowExecutionPreview";

export type WorkflowExecutionPreviewPanelProps = {
  proposalId: string;
  approved: boolean;
};

function stepTone(
  step: WorkflowExecutionPreviewStep,
) {
  if (step.status === "planned") {
    return {
      icon:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      badge:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      symbol:
        "✓",
    };
  }

  if (step.status === "blocked") {
    return {
      icon:
        "border-red-500/30 bg-red-500/10 text-red-100",
      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
      symbol:
        "!",
    };
  }

  return {
    icon:
      "border-slate-700 bg-slate-900 text-slate-400",
    badge:
      "border-slate-700 bg-slate-900 text-slate-400",
    symbol:
      "○",
  };
}

function ExecutionPreviewContent({
  preview,
}: {
  preview: WorkflowExecutionPreviewItem;
}) {
  return (
    <section className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-violet-200">
            Execution Preview
          </div>

          <h4 className="mt-2 font-semibold text-white">
            {preview.title}
          </h4>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            {preview.description}
          </p>
        </div>

        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-100">
          Not executed
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-[#070A0F] p-3">
          <div className="text-slate-500">
            Planned
          </div>

          <div className="mt-1 text-lg font-semibold text-cyan-100">
            {preview.summary.planned}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#070A0F] p-3">
          <div className="text-slate-500">
            Disabled
          </div>

          <div className="mt-1 text-lg font-semibold text-slate-300">
            {preview.summary.disabled}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#070A0F] p-3">
          <div className="text-slate-500">
            Workflow writes
          </div>

          <div className="mt-1 text-lg font-semibold text-emerald-200">
            {preview.summary.workflowWrites}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#070A0F] p-3">
          <div className="text-slate-500">
            Email sends
          </div>

          <div className="mt-1 text-lg font-semibold text-emerald-200">
            {preview.summary.emailSends}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {preview.steps.map((step) => {
          const tone =
            stepTone(step);

          return (
            <article
              className="rounded-lg border border-slate-800 bg-[#070A0F] p-4"
              key={step.stepId}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${tone.icon}`}
                >
                  {tone.symbol}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="text-sm font-semibold text-slate-100">
                      {step.title}
                    </h5>

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
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-400">
        Executable now:{" "}
        <span className="font-semibold text-emerald-200">
          no
        </span>
        {" · "}
        Candidate DB writes:{" "}
        {preview.summary.candidateDbWrites}
        {" · "}
        Workflow writes:{" "}
        {preview.summary.workflowWrites}
        {" · "}
        Email sends:{" "}
        {preview.summary.emailSends}
      </div>
    </section>
  );
}

export function WorkflowExecutionPreviewPanel({
  proposalId,
  approved,
}: WorkflowExecutionPreviewPanelProps) {
  const [data, setData] =
    useState<WorkflowExecutionPreviewFeed | null>(
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
            "/api/recruiter/workflow/execution-preview?limit=500",
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
              "Unable to load workflow execution preview",
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
            : "Unable to load workflow execution preview",
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

  const preview =
    useMemo(
      () =>
        data?.previews.find(
          (item) =>
            item.proposalId ===
            proposalId,
        ) || null,
      [
        data,
        proposalId,
      ],
    );

  const unmatched =
    useMemo(
      () =>
        data?.unmatchedApprovals.find(
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
        Loading execution preview...
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

  if (unmatched) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100">
          Execution preview unavailable
        </div>

        <p className="mt-2 text-sm text-amber-50/80">
          {unmatched.reason}
        </p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
        No matching execution preview is currently available.
      </div>
    );
  }

  return (
    <ExecutionPreviewContent
      preview={preview}
    />
  );
}