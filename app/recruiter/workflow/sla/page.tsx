"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PIPELINE_STAGE_LABELS,
} from "@/lib/candidateLifecycleTypes";
import type {
  RecruiterWorkflowSlaCandidate,
  RecruiterWorkflowSlaReport,
} from "@/lib/recruiterWorkflowSla";

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not scheduled";
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

function statusTone(
  status:
    RecruiterWorkflowSlaCandidate["status"],
) {
  if (status === "violated") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (status === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  if (status === "compliant") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

export default function WorkflowSlaPage() {
  const [data, setData] =
    useState<RecruiterWorkflowSlaReport | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/recruiter/workflow/sla?limit=500",
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
              "Unable to load workflow SLA report",
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
            : "Unable to load workflow SLA report",
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

  const stageSummary =
    useMemo(
      () =>
        (data?.stageSummary || [])
          .filter(
            (item) =>
              item.candidateCount > 0,
          )
          .sort(
            (left, right) => {
              if (
                right.violated !==
                left.violated
              ) {
                return (
                  right.violated -
                  left.violated
                );
              }

              return (
                right.averageDaysInStage -
                left.averageDaysInStage
              );
            },
          ),
      [data],
    );

  const candidates =
    useMemo(
      () =>
        (data?.candidateRisks || []).filter(
          (candidate) =>
            statusFilter === "all" ||
            candidate.status ===
              statusFilter,
        ),
      [data, statusFilter],
    );

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-7">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">
                  Workflow SLA
                </h1>

                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  Read only
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Lifecycle aging, SLA compliance, stage risks,
                and overdue candidate actions.
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
                className="rounded-md border border-red-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-red-100"
                href="/recruiter/workflow/notifications"
              >
                Notifications
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

      <div className="mx-auto max-w-[1500px] space-y-6 px-6 py-7">
        {loading ? (
          <section className={card}>
            Loading workflow SLA report...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {[
                [
                  "Active",
                  data.summary.activeCandidates,
                  "text-white",
                ],
                [
                  "Compliant",
                  data.summary.compliant,
                  "text-emerald-200",
                ],
                [
                  "Warning",
                  data.summary.warning,
                  "text-amber-200",
                ],
                [
                  "Violated",
                  data.summary.violated,
                  "text-red-200",
                ],
                [
                  "Compliance",
                  `${formatNumber(
                    data.summary
                      .compliancePercentage,
                  )}%`,
                  "text-cyan-100",
                ],
                [
                  "Overdue",
                  data.summary
                    .overdueFollowUps,
                  "text-red-200",
                ],
                [
                  "Due today",
                  data.summary.dueToday,
                  "text-amber-200",
                ],
                [
                  "Average age",
                  `${formatNumber(
                    data.summary
                      .averageDaysInStage,
                  )}d`,
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
              <h2 className="font-semibold text-white">
                Stage SLA ranking
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Stages ranked by violations and average lifecycle age.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">
                        Stage
                      </th>
                      <th className="px-3 py-3">
                        Candidates
                      </th>
                      <th className="px-3 py-3">
                        SLA
                      </th>
                      <th className="px-3 py-3">
                        Compliant
                      </th>
                      <th className="px-3 py-3">
                        Warning
                      </th>
                      <th className="px-3 py-3">
                        Violated
                      </th>
                      <th className="px-3 py-3">
                        Compliance
                      </th>
                      <th className="px-3 py-3">
                        Average age
                      </th>
                      <th className="px-3 py-3">
                        Oldest
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {stageSummary.map(
                      (item) => (
                        <tr key={item.stage}>
                          <td className="px-3 py-3 font-medium text-slate-100">
                            {
                              PIPELINE_STAGE_LABELS[
                                item.stage
                              ]
                            }
                          </td>

                          <td className="px-3 py-3 text-slate-300">
                            {
                              item.candidateCount
                            }
                          </td>

                          <td className="px-3 py-3 text-slate-300">
                            {item.slaDays} days
                          </td>

                          <td className="px-3 py-3 text-emerald-200">
                            {item.compliant}
                          </td>

                          <td className="px-3 py-3 text-amber-200">
                            {item.warning}
                          </td>

                          <td className="px-3 py-3 text-red-200">
                            {item.violated}
                          </td>

                          <td className="px-3 py-3 text-cyan-100">
                            {formatNumber(
                              item.compliancePercentage,
                            )}
                            %
                          </td>

                          <td className="px-3 py-3 text-slate-300">
                            {formatNumber(
                              item.averageDaysInStage,
                            )}{" "}
                            days
                          </td>

                          <td className="px-3 py-3 text-slate-400">
                            {item.oldestCandidateId ? (
                              <Link
                                className="hover:text-cyan-200"
                                href={`/recruiter/candidate360/${encodeURIComponent(
                                  item.oldestCandidateId,
                                )}`}
                              >
                                {
                                  item.oldestCandidateName
                                }
                                {" · "}
                                {formatNumber(
                                  item.maximumDaysInStage,
                                )}
                                d
                              </Link>
                            ) : (
                              "None"
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-white">
                    Candidate SLA risks
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Candidates ranked by SLA violation and lifecycle age.
                  </p>
                </div>

                <select
                  className="rounded-md border border-slate-700 bg-[#070A0F] px-3 py-2 text-sm text-slate-200"
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  value={statusFilter}
                >
                  <option value="all">
                    All statuses
                  </option>
                  <option value="violated">
                    Violated
                  </option>
                  <option value="warning">
                    Warning
                  </option>
                  <option value="compliant">
                    Compliant
                  </option>
                </select>
              </div>

              <div className="mt-5 space-y-4">
                {candidates.length ? (
                  candidates.map(
                    (candidate) => (
                      <article
                        className="rounded-xl border border-slate-800 bg-[#070A0F] p-5"
                        key={
                          candidate.candidateId
                        }
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span
                              className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusTone(
                                candidate.status,
                              )}`}
                            >
                              {
                                candidate.status
                              }
                            </span>

                            <h3 className="mt-3 font-semibold text-white">
                              {
                                candidate.candidateName
                              }
                            </h3>

                            <p className="mt-1 text-sm text-slate-400">
                              {
                                PIPELINE_STAGE_LABELS[
                                  candidate.stage
                                ]
                              }
                              {" · "}
                              Owner:{" "}
                              {candidate.ownerName ||
                                "Unassigned"}
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="text-2xl font-semibold text-cyan-100">
                              {formatNumber(
                                candidate.daysInStage,
                              )}
                              d
                            </div>

                            <div className="text-xs text-slate-500">
                              SLA{" "}
                              {candidate.slaDays}d
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            Stage started
                            <div className="mt-1 text-slate-300">
                              {formatDate(
                                candidate.stageStartedAt,
                              )}
                            </div>
                          </div>

                          <div>
                            Remaining
                            <div className="mt-1 text-slate-300">
                              {formatNumber(
                                candidate.remainingDays,
                              )}{" "}
                              days
                            </div>
                          </div>

                          <div>
                            Violation
                            <div className="mt-1 text-red-200">
                              {formatNumber(
                                candidate.violationDays,
                              )}{" "}
                              days
                            </div>
                          </div>

                          <div>
                            Follow-up
                            <div className="mt-1 text-slate-300">
                              {
                                candidate.dueStatus
                              }
                              {" · "}
                              {formatDate(
                                candidate.nextActionDueAt,
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <Link
                            className="text-sm font-semibold text-cyan-300"
                            href={candidate.href}
                          >
                            Open Candidate360
                          </Link>
                        </div>
                      </article>
                    ),
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
                    No candidates match this SLA filter.
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