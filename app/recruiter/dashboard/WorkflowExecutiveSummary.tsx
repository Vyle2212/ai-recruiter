"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PIPELINE_STAGE_LABELS,
} from "@/lib/candidateLifecycleTypes";
import type {
  RecruiterWorkflowAnalytics,
} from "@/lib/recruiterWorkflowAnalytics";

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function metricTone(label: string) {
  if (
    label === "Overdue follow-ups" ||
    label === "Attention required"
  ) {
    return "text-red-200";
  }

  if (
    label === "Due today" ||
    label === "High priority"
  ) {
    return "text-amber-200";
  }

  if (
    label === "Active candidates" ||
    label === "Lifecycle events"
  ) {
    return "text-cyan-100";
  }

  return "text-white";
}

export function WorkflowExecutiveSummary() {
  const [data, setData] =
    useState<RecruiterWorkflowAnalytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/recruiter/workflow/analytics",
          {
            signal: controller.signal,
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load workflow analytics",
          );
        }

        setData(result);
      } catch (loadError) {
        if (
          loadError instanceof Error &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load workflow analytics",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, []);

  const topStages = useMemo(
    () =>
      [...(data?.stageDistribution || [])]
        .filter((item) => item.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 5),
    [data],
  );

  const bottlenecks = useMemo(
    () =>
      [...(data?.stageAge || [])]
        .filter((item) => item.candidateCount > 0)
        .sort(
          (left, right) =>
            right.averageDays - left.averageDays,
        )
        .slice(0, 5),
    [data],
  );

  const topRecruiters = useMemo(
    () => (data?.recruiterSummary || []).slice(0, 5),
    [data],
  );

  if (loading) {
    return (
      <section className={card}>
        Loading executive workflow summary...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
        {error}
      </section>
    );
  }

  if (!data) return null;

  const metrics = [
    ["Active candidates", data.activeCandidateCount],
    ["Lifecycle events", data.eventCount],
    ["Overdue follow-ups", data.reminderSummary.overdue],
    ["Due today", data.reminderSummary.today],
    ["Attention required", data.reminderSummary.requiresAttention],
    ["High priority", data.reminderSummary.highPriority],
    ["Rollbacks", data.rollbackSummary.total],
    ["Last 7 days activity", data.activitySummary.last7Days],
  ] as const;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Executive workflow overview
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Read-only lifecycle, follow-up, activity, and
            pipeline health.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-500/10"
            href="/recruiter/workflow"
          >
            Open workflow
          </Link>

          <Link
            className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-100"
            href="/recruiter/workflow/analytics"
          >
            Full analytics
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article className={card} key={label}>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </div>

            <div
              className={`mt-2 text-3xl font-semibold ${metricTone(
                label,
              )}`}
            >
              {value}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className={card}>
          <h3 className="font-semibold text-white">
            Pipeline concentration
          </h3>

          <div className="mt-4 space-y-3">
            {topStages.length ? (
              topStages.map((item) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={item.stage}
                >
                  <span className="text-sm text-slate-300">
                    {PIPELINE_STAGE_LABELS[item.stage]}
                  </span>

                  <span className="text-sm font-semibold text-cyan-100">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">
                No stage data available.
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <h3 className="font-semibold text-white">
            Aging bottlenecks
          </h3>

          <div className="mt-4 space-y-3">
            {bottlenecks.length ? (
              bottlenecks.map((item) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={item.stage}
                >
                  <span className="text-sm text-slate-300">
                    {PIPELINE_STAGE_LABELS[item.stage]}
                  </span>

                  <span className="text-sm font-semibold text-amber-100">
                    {formatNumber(item.averageDays)} days
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">
                No aging data available.
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <h3 className="font-semibold text-white">
            Recruiter activity
          </h3>

          <div className="mt-4 space-y-3">
            {topRecruiters.length ? (
              topRecruiters.map((item) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={item.actorKey}
                >
                  <div>
                    <div className="text-sm text-slate-200">
                      {item.actorLabel}
                    </div>

                    <div className="text-xs text-slate-500">
                      {item.transitionCount} transitions ·{" "}
                      {item.rollbackCount} rollbacks
                    </div>
                  </div>

                  <span className="text-sm font-semibold text-cyan-100">
                    {item.activityCount}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">
                No recruiter activity recorded.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="font-semibold text-emerald-100">
          Workflow safety
        </div>

        <p className="mt-2 text-sm text-slate-300">
          Candidate DB writes: {data.safety.candidateDbWrites}
          {" · "}
          Workflow writes: {data.safety.workflowWrites}
          {" · "}
          Reminder sends: {data.safety.reminderSends}
          {" · "}
          Read only: {data.safety.readOnly ? "yes" : "no"}
        </p>
      </section>
    </section>
  );
}