"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PIPELINE_STAGE_LABELS,
  type CandidatePipelineStage,
} from "@/lib/candidateLifecycleTypes";
import type {
  RecruiterWorkflowAnalytics,
  WorkflowRecruiterSummaryItem,
  WorkflowStageDistributionItem,
  WorkflowTransitionSummaryItem,
} from "@/lib/recruiterWorkflowAnalytics";

const card =
  "rounded-xl border border-slate-800 bg-[#0B0F16] p-5";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stageLabel(stage: CandidatePipelineStage | null) {
  return stage
    ? PIPELINE_STAGE_LABELS[stage]
    : "Start";
}

function percentageWidth(value: number, maximum: number) {
  if (maximum <= 0) return "0%";

  return `${Math.max(
    3,
    Math.min(100, (value / maximum) * 100),
  )}%`;
}

function MetricCard({
  label,
  value,
  note,
  tone = "text-white",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: string;
}) {
  return (
    <article className={card}>
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>

      <div className={`mt-2 text-3xl font-semibold ${tone}`}>
        {value}
      </div>

      {note ? (
        <div className="mt-2 text-xs text-slate-500">
          {note}
        </div>
      ) : null}
    </article>
  );
}

function StageDistribution({
  items,
}: {
  items: WorkflowStageDistributionItem[];
}) {
  const maximum = Math.max(
    0,
    ...items.map((item) => item.count),
  );

  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold text-white">
          Stage distribution
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Current candidate volume by lifecycle stage.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.stage}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">
                {PIPELINE_STAGE_LABELS[item.stage]}
              </span>

              <span className="text-slate-500">
                {item.count} · {item.percentage}%
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-cyan-400"
                style={{
                  width: percentageWidth(item.count, maximum),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TransitionSummary({
  items,
}: {
  items: WorkflowTransitionSummaryItem[];
}) {
  const maximum = Math.max(
    0,
    ...items.map((item) => item.count),
  );

  return (
    <section className={card}>
      <h2 className="font-semibold text-white">
        Top lifecycle transitions
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Normalized from persisted lifecycle history.
      </p>

      <div className="mt-5 space-y-4">
        {items.length ? (
          items.slice(0, 10).map((item) => {
            const key =
              `${item.fromStage || "start"}-${item.toStage}`;

            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">
                    {stageLabel(item.fromStage)}
                    {" → "}
                    {stageLabel(item.toStage)}
                  </span>

                  <span className="font-semibold text-cyan-100">
                    {item.count}
                  </span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{
                      width: percentageWidth(
                        item.count,
                        maximum,
                      ),
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-800 p-5 text-center text-sm text-slate-500">
            No lifecycle transitions recorded yet.
          </div>
        )}
      </div>
    </section>
  );
}

function RecruiterSummary({
  items,
}: {
  items: WorkflowRecruiterSummaryItem[];
}) {
  return (
    <section className={card}>
      <h2 className="font-semibold text-white">
        Recruiter activity
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Transition and rollback activity grouped by actor.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3 font-semibold">
                Recruiter
              </th>
              <th className="px-3 py-3 font-semibold">
                Activities
              </th>
              <th className="px-3 py-3 font-semibold">
                Transitions
              </th>
              <th className="px-3 py-3 font-semibold">
                Rollbacks
              </th>
              <th className="px-3 py-3 font-semibold">
                Latest
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {items.length ? (
              items.map((item) => (
                <tr key={item.actorKey}>
                  <td className="px-3 py-3 font-medium text-slate-100">
                    {item.actorLabel}
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {item.activityCount}
                  </td>
                  <td className="px-3 py-3 text-cyan-100">
                    {item.transitionCount}
                  </td>
                  <td className="px-3 py-3 text-amber-100">
                    {item.rollbackCount}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {formatDate(item.latestActivityAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-6 text-center text-slate-500"
                  colSpan={5}
                >
                  No recruiter activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RecruiterWorkflowAnalyticsPage() {
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

  const stageAgeWithCandidates = useMemo(
    () =>
      (data?.stageAge || []).filter(
        (item) => item.candidateCount > 0,
      ),
    [data],
  );

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-7">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">
                  Workflow Analytics
                </h1>

                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  Read only
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Candidate lifecycle, reminder, transition,
                rollback, and recruiter activity analytics.
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
                className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300 hover:border-slate-500"
                href="/recruiter/dashboard"
              >
                Recruiter portal
              </Link>
            </div>
          </div>

          {data ? (
            <div className="mt-4 text-xs text-slate-500">
              Generated: {formatDate(data.generatedAt)}
              {" · "}
              Evaluated: {formatDate(data.evaluatedAt)}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-6 py-7">
        {loading ? (
          <div className={card}>
            Loading workflow analytics...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total candidates"
                value={data.candidateCount}
              />

              <MetricCard
                label="Active candidates"
                value={data.activeCandidateCount}
                tone="text-cyan-100"
              />

              <MetricCard
                label="Terminal candidates"
                value={data.terminalCandidateCount}
              />

              <MetricCard
                label="Lifecycle events"
                value={data.eventCount}
                note={`${formatNumber(
                  data.averageEventsPerCandidate,
                )} events per candidate`}
              />
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-white">
                  Follow-up health
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Reminder status and effective priority after SLA
                  escalation.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <MetricCard
                  label="Overdue"
                  value={data.reminderSummary.overdue}
                  tone="text-red-200"
                />

                <MetricCard
                  label="Due today"
                  value={data.reminderSummary.today}
                  tone="text-amber-200"
                />

                <MetricCard
                  label="Due soon"
                  value={data.reminderSummary.soon}
                  tone="text-cyan-100"
                />

                <MetricCard
                  label="Scheduled"
                  value={data.reminderSummary.scheduled}
                />

                <MetricCard
                  label="No due date"
                  value={data.reminderSummary.none}
                />

                <MetricCard
                  label="Attention required"
                  value={data.reminderSummary.requiresAttention}
                  tone="text-red-100"
                />

                <MetricCard
                  label="High priority"
                  value={data.reminderSummary.highPriority}
                  tone="text-amber-100"
                />
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <StageDistribution
                items={data.stageDistribution}
              />

              <TransitionSummary
                items={data.transitionSummary}
              />
            </div>

            <section className={card}>
              <h2 className="font-semibold text-white">
                Stage aging
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Time since the latest lifecycle activity for
                candidates currently in each stage.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stageAgeWithCandidates.length ? (
                  stageAgeWithCandidates.map((item) => (
                    <article
                      className="rounded-lg border border-slate-800 bg-[#070A0F] p-4"
                      key={item.stage}
                    >
                      <div className="text-sm font-semibold text-slate-100">
                        {PIPELINE_STAGE_LABELS[item.stage]}
                      </div>

                      <div className="mt-3 text-2xl font-semibold text-cyan-100">
                        {formatNumber(item.averageDays)} days
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        {item.candidateCount} candidate
                        {item.candidateCount === 1 ? "" : "s"}
                        {" · "}
                        Min {formatNumber(item.minimumDays)}
                        {" · "}
                        Max {formatNumber(item.maximumDays)}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    No stage-age data available.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-white">
                  Activity periods
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Today"
                  value={data.activitySummary.today}
                />

                <MetricCard
                  label="Yesterday"
                  value={data.activitySummary.yesterday}
                />

                <MetricCard
                  label="Last 7 days"
                  value={data.activitySummary.last7Days}
                />

                <MetricCard
                  label="Last 30 days"
                  value={data.activitySummary.last30Days}
                />
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
              <section className={card}>
                <h2 className="font-semibold text-white">
                  Rollback health
                </h2>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase text-slate-500">
                      Total rollbacks
                    </div>

                    <div className="mt-1 text-3xl font-semibold text-amber-100">
                      {data.rollbackSummary.total}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-slate-500">
                      Last 30 days
                    </div>

                    <div className="mt-1 text-2xl font-semibold text-slate-100">
                      {data.rollbackSummary.last30Days}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-slate-500">
                      Rollback rate
                    </div>

                    <div className="mt-1 text-2xl font-semibold text-slate-100">
                      {formatNumber(
                        data.rollbackSummary.ratePercentage,
                      )}
                      %
                    </div>
                  </div>
                </div>
              </section>

              <RecruiterSummary
                items={data.recruiterSummary}
              />
            </div>

            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h2 className="font-semibold text-emerald-100">
                Safety
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                Candidate DB writes:{" "}
                {data.safety.candidateDbWrites}
                {" · "}
                Workflow writes: {data.safety.workflowWrites}
                {" · "}
                Reminder sends: {data.safety.reminderSends}
                {" · "}
                Read only: {data.safety.readOnly ? "yes" : "no"}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {data.mode}
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}