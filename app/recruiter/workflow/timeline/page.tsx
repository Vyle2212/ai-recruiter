"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  RecruiterWorkflowTimelineEventType,
  RecruiterWorkflowTimelineFeed,
  RecruiterWorkflowTimelineItem,
} from "@/lib/recruiterWorkflowTimeline";

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function formatDate(
  value: string,
) {
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
    : "Not specified";
}

function eventTone(
  eventType:
    RecruiterWorkflowTimelineEventType,
) {
  if (
    eventType === "rollback"
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (
    eventType ===
    "stage_transition"
  ) {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  }

  if (
    eventType ===
    "candidate_created"
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (
    eventType ===
    "recruiter_action"
  ) {
    return "border-violet-500/30 bg-violet-500/10 text-violet-100";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function TimelineItem({
  item,
}: {
  item:
    RecruiterWorkflowTimelineItem;
}) {
  return (
    <article className="relative pl-8">
      <div className="absolute left-[5px] top-0 h-full w-px bg-slate-800" />

      <div className="absolute left-0 top-5 h-3 w-3 rounded-full border border-cyan-400 bg-[#05070A]" />

      <div className="rounded-xl border border-slate-800 bg-[#070A0F] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${eventTone(
                item.eventType,
              )}`}
            >
              {readable(
                item.eventType,
              )}
            </span>

            <h3 className="mt-3 font-semibold text-white">
              {item.title}
            </h3>

            <p className="mt-1 text-sm text-cyan-100">
              {item.candidateName}
            </p>
          </div>

          <time className="text-xs text-slate-500">
            {formatDate(
              item.occurredAt,
            )}
          </time>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          {item.description}
        </p>

        <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            From stage
            <div className="mt-1 text-slate-300">
              {readable(
                item.fromStage,
              )}
            </div>
          </div>

          <div>
            To stage
            <div className="mt-1 text-slate-300">
              {readable(
                item.toStage,
              )}
            </div>
          </div>

          <div>
            Actor
            <div className="mt-1 text-slate-300">
              {item.actorName ||
                "System"}
            </div>
          </div>

          <div>
            Source
            <div className="mt-1 text-slate-300">
              {readable(
                item.source,
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            href={item.href}
          >
            Open Candidate360
          </Link>

          <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
            Read-only event
          </span>
        </div>
      </div>
    </article>
  );
}

export default function WorkflowTimelinePage() {
  const [data, setData] =
    useState<RecruiterWorkflowTimelineFeed | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [eventType, setEventType] =
    useState("all");

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/recruiter/workflow/timeline?limit=500",
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
              "Unable to load workflow timeline",
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
            : "Unable to load workflow timeline",
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
  }, []);

  const events =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return (
        data?.events || []
      ).filter((item) => {
        if (
          eventType !== "all" &&
          item.eventType !== eventType
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [
          item.candidateName,
          item.title,
          item.description,
          item.actorName || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(
            normalizedSearch,
          );
      });
    }, [
      data,
      eventType,
      search,
    ]);

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-7">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">
                  Workflow Timeline
                </h1>

                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  Read only
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Candidate lifecycle transitions, recruiter activity,
                rollbacks, and workflow history.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100"
                href="/recruiter/workflow"
              >
                Workflow
              </Link>

              <Link
                className="rounded-md border border-amber-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-100"
                href="/recruiter/workflow/sla"
              >
                SLA
              </Link>

              <Link
                className="rounded-md border border-violet-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-100"
                href="/recruiter/workflow/analytics"
              >
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-7">
        {loading ? (
          <section className={card}>
            Loading workflow timeline...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                [
                  "Events",
                  data.summary.totalEvents,
                  "text-white",
                ],
                [
                  "Candidates",
                  data.summary
                    .candidatesRepresented,
                  "text-cyan-100",
                ],
                [
                  "Created",
                  data.summary
                    .candidateCreated,
                  "text-emerald-200",
                ],
                [
                  "Transitions",
                  data.summary
                    .stageTransitions,
                  "text-cyan-100",
                ],
                [
                  "Rollbacks",
                  data.summary.rollbacks,
                  "text-red-200",
                ],
                [
                  "Recruiter actions",
                  data.summary
                    .recruiterActions,
                  "text-violet-100",
                ],
              ].map(
                ([label, value, tone]) => (
                  <article
                    className={card}
                    key={String(label)}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {label}
                    </div>

                    <div
                      className={`mt-2 text-2xl font-semibold ${tone}`}
                    >
                      {value}
                    </div>
                  </article>
                ),
              )}
            </section>

            <section className={card}>
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <input
                  className="rounded-md border border-slate-700 bg-[#070A0F] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search candidate, event, or recruiter..."
                  value={search}
                />

                <select
                  className="rounded-md border border-slate-700 bg-[#070A0F] px-3 py-2 text-sm text-slate-200"
                  onChange={(event) =>
                    setEventType(
                      event.target.value,
                    )
                  }
                  value={eventType}
                >
                  <option value="all">
                    All event types
                  </option>
                  <option value="candidate_created">
                    Candidate created
                  </option>
                  <option value="stage_transition">
                    Stage transition
                  </option>
                  <option value="rollback">
                    Rollback
                  </option>
                  <option value="recruiter_action">
                    Recruiter action
                  </option>
                  <option value="system_event">
                    System event
                  </option>
                </select>
              </div>
            </section>

            <section className={card}>
              <div className="space-y-5">
                {events.length ? (
                  events.map((item) => (
                    <TimelineItem
                      item={item}
                      key={
                        item.timelineId
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                    No timeline events match the current filters.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-slate-300">
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
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}