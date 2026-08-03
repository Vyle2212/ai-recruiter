"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  RecruiterCopilotSuggestion,
  RecruiterCopilotSuggestionFeed,
  RecruiterCopilotSuggestionPriority,
} from "@/lib/recruiterCopilotSuggestions";

export type CopilotSuggestionListProps = {
  title?: string;
  description?: string;
  limit?: number;
  compact?: boolean;
  showSummary?: boolean;
};

const containerClass =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function priorityTone(
  priority: RecruiterCopilotSuggestionPriority,
) {
  if (priority === "critical") {
    return {
      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
      border:
        "border-red-500/25",
      value:
        "text-red-200",
    };
  }

  if (priority === "high") {
    return {
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",
      border:
        "border-amber-500/25",
      value:
        "text-amber-200",
    };
  }

  if (priority === "medium") {
    return {
      badge:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      border:
        "border-cyan-500/20",
      value:
        "text-cyan-100",
    };
  }

  return {
    badge:
      "border-slate-700 bg-slate-900 text-slate-300",
    border:
      "border-slate-800",
    value:
      "text-slate-200",
  };
}

function readable(value: string | null) {
  return value
    ? value.replace(/_/g, " ")
    : "Not specified";
}

function formatDate(value: string | null) {
  if (!value) return null;

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

function SuggestionCard({
  item,
  compact,
}: {
  item: RecruiterCopilotSuggestion;
  compact: boolean;
}) {
  const tone = priorityTone(item.priority);
  const dueAt = formatDate(item.dueAt);

  return (
    <article
      className={`rounded-xl border bg-[#070A0F] ${
        tone.border
      } ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${tone.badge}`}
          >
            {item.priority}
          </span>

          <h3 className="mt-3 font-semibold text-white">
            {item.title}
          </h3>
        </div>

        {item.candidateName ? (
          <span
            className={`text-xs font-semibold ${tone.value}`}
          >
            Candidate action
          </span>
        ) : (
          <span
            className={`text-xs font-semibold ${tone.value}`}
          >
            Workflow action
          </span>
        )}
      </div>

      <p
        className={`mt-3 text-slate-400 ${
          compact
            ? "line-clamp-3 text-xs leading-5"
            : "text-sm leading-6"
        }`}
      >
        {item.description}
      </p>

      {!compact ? (
        <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
          {item.stage ? (
            <div>
              Stage:{" "}
              <span className="text-slate-300">
                {readable(item.stage)}
              </span>
            </div>
          ) : null}

          {item.nextAction ? (
            <div>
              Next action:{" "}
              <span className="text-slate-300">
                {readable(item.nextAction)}
              </span>
            </div>
          ) : null}

          {dueAt ? (
            <div>
              Due:{" "}
              <span className="text-slate-300">
                {dueAt}
              </span>
            </div>
          ) : null}

          <div>
            Human approval:{" "}
            <span className="text-emerald-200">
              required
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
          href={item.href}
        >
          {item.actionLabel}
        </Link>

        <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
          No automatic action
        </span>
      </div>
    </article>
  );
}

export function CopilotSuggestionList({
  title = "Today’s priorities",
  description =
    "Deterministic next actions generated from candidate lifecycle and workflow health.",
  limit = 6,
  compact = false,
  showSummary = true,
}: CopilotSuggestionListProps) {
  const [data, setData] =
    useState<RecruiterCopilotSuggestionFeed | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/recruiter/copilot/suggestions?limit=${encodeURIComponent(
            String(limit),
          )}`,
          {
            signal: controller.signal,
          },
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load Copilot suggestions",
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
            : "Unable to load Copilot suggestions",
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
  }, [limit]);

  const visibleSuggestions =
    useMemo(
      () =>
        data?.suggestions.slice(
          0,
          limit,
        ) || [],
      [data, limit],
    );

  return (
    <section className={containerClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">
              {title}
            </h2>

            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
              Human controlled
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            {description}
          </p>
        </div>

        <Link
          className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-500/10"
          href="/recruiter/workflow/copilot"
        >
          Open Copilot
        </Link>
      </div>

      {loading ? (
        <div className="mt-5 rounded-xl border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">
          Loading Copilot suggestions...
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {data && showSummary ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Total",
              data.summary.total,
              "text-white",
            ],
            [
              "Critical",
              data.summary.critical,
              "text-red-200",
            ],
            [
              "High",
              data.summary.high,
              "text-amber-200",
            ],
            [
              "Medium",
              data.summary.medium,
              "text-cyan-100",
            ],
            [
              "Candidate actions",
              data.summary.candidateSpecific,
              "text-violet-100",
            ],
          ].map(
            ([label, value, tone]) => (
              <article
                className="rounded-xl border border-slate-800 bg-[#070A0F] p-3"
                key={String(label)}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </div>

                <div
                  className={`mt-1 text-xl font-semibold ${tone}`}
                >
                  {value}
                </div>
              </article>
            ),
          )}
        </div>
      ) : null}

      {data ? (
        <div
          className={`mt-5 grid gap-4 ${
            compact
              ? "lg:grid-cols-2"
              : "xl:grid-cols-2"
          }`}
        >
          {visibleSuggestions.length ? (
            visibleSuggestions.map(
              (item) => (
                <SuggestionCard
                  compact={compact}
                  item={item}
                  key={
                    item.suggestionId
                  }
                />
              ),
            )
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
              No Copilot suggestions are currently available.
            </div>
          )}
        </div>
      ) : null}

      {data ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-slate-400">
          Automatic actions:{" "}
          {data.safety.automaticActions}
          {" · "}
          Candidate DB writes:{" "}
          {data.safety.candidateDbWrites}
          {" · "}
          Workflow writes:{" "}
          {data.safety.workflowWrites}
          {" · "}
          Email sends:{" "}
          {data.safety.emailSends}
          {" · "}
          OpenAI calls:{" "}
          {data.safety.openAiCalls}
        </div>
      ) : null}
    </section>
  );
}