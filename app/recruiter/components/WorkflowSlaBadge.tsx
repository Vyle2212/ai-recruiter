"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  RecruiterWorkflowSlaReport,
} from "@/lib/recruiterWorkflowSla";

export type WorkflowSlaBadgeProps = {
  compact?: boolean;
  showCounts?: boolean;
  className?: string;
};

export function WorkflowSlaBadge({
  compact = false,
  showCounts = true,
  className = "",
}: WorkflowSlaBadgeProps) {
  const [data, setData] =
    useState<RecruiterWorkflowSlaReport | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          "/api/recruiter/workflow/sla?limit=1",
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load workflow SLA indicator",
          );
        }

        const result =
          await response.json();

        setData(result);
      } catch (loadError) {
        if (
          loadError instanceof Error &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () =>
      controller.abort();
  }, []);

  if (loading) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500 ${className}`}
      >
        SLA…
      </span>
    );
  }

  if (error || !data) {
    return (
      <Link
        className={`inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 ${className}`}
        href="/recruiter/workflow/sla"
      >
        SLA
      </Link>
    );
  }

  const compliance =
    Math.round(
      data.summary.compliancePercentage,
    );

  const violated =
    data.summary.violated;

  const warning =
    data.summary.warning;

  const hasViolation =
    violated > 0;

  const hasWarning =
    warning > 0;

  const tone =
    hasViolation
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : hasWarning
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";

  if (compact) {
    return (
      <Link
        aria-label={`Workflow SLA ${compliance} percent, ${violated} violated`}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${tone} ${className}`}
        href="/recruiter/workflow/sla"
      >
        <span>SLA</span>

        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
          {compliance}%
        </span>

        {violated > 0 ? (
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
            {violated} violated
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      className={`inline-flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${tone} ${className}`}
      href="/recruiter/workflow/sla"
    >
      <span>SLA compliance</span>

      <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
        {compliance}%
      </span>

      {showCounts ? (
        <>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
            Violated {violated}
          </span>

          <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
            Warning {warning}
          </span>
        </>
      ) : null}
    </Link>
  );
}