"use client";

import Link from "next/link";
import { WorkflowSlaBadge } from "@/app/recruiter/components/WorkflowSlaBadge";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  RecruiterWorkflowNotification,
  RecruiterWorkflowNotificationFeed,
} from "@/lib/recruiterWorkflowNotifications";

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function priorityTone(
  priority: RecruiterWorkflowNotification["priority"],
) {
  if (priority === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (priority === "high") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  if (priority === "medium") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
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

export default function WorkflowNotificationsPage() {
  const [data, setData] =
    useState<RecruiterWorkflowNotificationFeed | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [priority, setPriority] =
    useState("all");

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/recruiter/workflow/notifications?limit=100",
          {
            signal: controller.signal,
          },
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load workflow notifications",
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
            : "Unable to load workflow notifications",
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
  }, []);

  const visibleNotifications =
    useMemo(
      () =>
        (data?.notifications || []).filter(
          (item) =>
            priority === "all" ||
            item.priority === priority,
        ),
      [data, priority],
    );

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-7">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">
                  Workflow Notifications
                </h1>

                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  Read only
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Candidate follow-ups, lifecycle risks, bottlenecks,
                and recruiter workflow alerts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <WorkflowSlaBadge compact />
              <Link
                className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100"
                href="/recruiter/workflow"
              >
                Workflow
              </Link>

              <Link
                className="rounded-md border border-violet-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-100"
                href="/recruiter/workflow/copilot"
              >
                Copilot
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-7">
        {loading ? (
          <section className={card}>
            Loading workflow notifications...
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
                ["Total", data.summary.total, "text-white"],
                ["Unread", data.summary.unread, "text-cyan-100"],
                ["Critical", data.summary.critical, "text-red-200"],
                ["High", data.summary.high, "text-amber-200"],
                ["Medium", data.summary.medium, "text-cyan-100"],
                [
                  "Candidate alerts",
                  data.summary.candidateSpecific,
                  "text-violet-100",
                ],
              ].map(([label, value, tone]) => (
                <article className={card} key={String(label)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {label}
                  </div>

                  <div
                    className={`mt-2 text-3xl font-semibold ${tone}`}
                  >
                    {value}
                  </div>
                </article>
              ))}
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-white">
                    Notification feed
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    All actions require manual recruiter review.
                  </p>
                </div>

                <select
                  className="rounded-md border border-slate-700 bg-[#070A0F] px-3 py-2 text-sm text-slate-200"
                  onChange={(event) =>
                    setPriority(event.target.value)
                  }
                  value={priority}
                >
                  <option value="all">
                    All priorities
                  </option>
                  <option value="critical">
                    Critical
                  </option>
                  <option value="high">
                    High
                  </option>
                  <option value="medium">
                    Medium
                  </option>
                  <option value="low">
                    Low
                  </option>
                </select>
              </div>

              <div className="mt-5 space-y-4">
                {visibleNotifications.length ? (
                  visibleNotifications.map((item) => (
                    <article
                      className="rounded-xl border border-slate-800 bg-[#070A0F] p-5"
                      key={item.notificationId}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${priorityTone(
                              item.priority,
                            )}`}
                          >
                            {item.priority}
                          </span>

                          <h3 className="mt-3 font-semibold text-white">
                            {item.title}
                          </h3>
                        </div>

                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-200">
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {item.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                        {item.candidateName ? (
                          <span>
                            Candidate:{" "}
                            <strong className="text-slate-300">
                              {item.candidateName}
                            </strong>
                          </span>
                        ) : null}

                        {item.stage ? (
                          <span>
                            Stage:{" "}
                            <strong className="text-slate-300">
                              {item.stage.replace(/_/g, " ")}
                            </strong>
                          </span>
                        ) : null}

                        {item.dueAt ? (
                          <span>
                            Due:{" "}
                            <strong className="text-slate-300">
                              {formatDate(item.dueAt)}
                            </strong>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <Link
                          className="text-sm font-semibold text-cyan-300"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </Link>

                        <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                          No automatic action
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
                    No notifications match this filter.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-slate-300">
              Automatic actions: {data.safety.automaticActions}
              {" Â· "}
              Candidate DB writes: {data.safety.candidateDbWrites}
              {" Â· "}
              Workflow writes: {data.safety.workflowWrites}
              {" Â· "}
              Email sends: {data.safety.emailSends}
              {" Â· "}
              Push sends: {data.safety.pushSends}
              {" Â· "}
              OpenAI calls: {data.safety.openAiCalls}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}