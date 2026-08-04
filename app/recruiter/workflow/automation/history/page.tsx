"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowAutomationApprovalHistoryDecision,
  WorkflowAutomationApprovalHistoryFile,
} from "@/lib/recruiterWorkflowAutomationApprovalHistory";

type HistoryFilter =
  | WorkflowAutomationApprovalHistoryDecision
  | "all";

function readable(
  value: string,
) {
  return value.replace(
    /_/g,
    " ",
  );
}

function decisionTone(
  decision:
    WorkflowAutomationApprovalHistoryDecision,
) {
  if (
    decision ===
    "approved"
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (
    decision ===
    "rejected"
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

function formatDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
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
      second: "2-digit",
    },
  ).format(date);
}

export default function WorkflowAutomationApprovalHistoryPage() {
  const [
    data,
    setData,
  ] =
    useState<WorkflowAutomationApprovalHistoryFile | null>(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<HistoryFilter>(
      "all",
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const loadHistory =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/recruiter/workflow/automation-approval-history",
              {
                cache:
                  "no-store",
              },
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.error ||
                "Unable to load approval history",
            );
          }

          setData(result);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load approval history",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    loadHistory();
  }, [
    loadHistory,
  ]);

  const events =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return (
          data?.events || []
        ).filter(
          (event) => {
            if (
              filter !==
                "all" &&
              event.decision !==
                filter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            return [
              event.candidateName,
              event.candidateId,
              event.proposalId,
              event.ruleId,
              event.proposedAction,
              event.reviewerName,
              event.reason,
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                query,
              );
          },
        );
      },
      [
        data,
        filter,
        search,
      ],
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070A] p-6 text-slate-300">
        Loading workflow approval history...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Approval History
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review the immutable timeline of recruiter approval, rejection, and defer decisions recorded from the workflow approval queue.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200"
              href="/recruiter/workflow/automation"
            >
              Back to automation
            </Link>

            <Link
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100"
              href="/recruiter/workflow/automation/approval"
            >
              Approval queue
            </Link>

            <button
              className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-100"
              onClick={
                loadHistory
              }
              type="button"
            >
              Refresh history
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Total events",
              data?.summary
                .total || 0,
            ],
            [
              "Approved",
              data?.summary
                .approved || 0,
            ],
            [
              "Rejected",
              data?.summary
                .rejected || 0,
            ],
            [
              "Deferred",
              data?.summary
                .deferred || 0,
            ],
            [
              "Proposals",
              data?.summary
                .proposalsAffected ||
                0,
            ],
          ].map(
            ([label, value]) => (
              <article
                className="rounded-xl border border-slate-800 bg-[#090C11] p-4"
                key={String(label)}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </div>

                <div className="mt-2 text-2xl font-semibold text-white">
                  {value}
                </div>
              </article>
            ),
          )}
        </section>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-xl border border-slate-800 bg-[#090C11] p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <input
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none focus:border-fuchsia-500"
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search candidate, reviewer, rule or reason..."
              value={search}
            />

            <select
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none"
              onChange={(
                event,
              ) =>
                setFilter(
                  event.target
                    .value as HistoryFilter,
                )
              }
              value={filter}
            >
              <option value="all">
                All decisions
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="deferred">
                Deferred
              </option>
            </select>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {events.map(
            (event) => (
              <article
                className="rounded-xl border border-slate-800 bg-[#090C11] p-5"
                key={
                  event.eventId
                }
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full border border-fuchsia-400 bg-fuchsia-500/40" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-white">
                            {event.candidateName}
                          </h2>

                          <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${decisionTone(
                              event.decision,
                            )}`}
                          >
                            {event.decision}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-slate-400">
                          {event.previousDecision
                            ? `${event.previousDecision} → ${event.decision}`
                            : `Initial decision: ${event.decision}`}
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-500">
                        {formatDate(
                          event.occurredAt,
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="uppercase tracking-[0.08em] text-slate-600">
                          Reviewer
                        </div>

                        <div className="mt-1 text-slate-300">
                          {event.reviewerName ||
                            event.reviewerId ||
                            "Not available"}
                        </div>
                      </div>

                      <div>
                        <div className="uppercase tracking-[0.08em] text-slate-600">
                          Rule
                        </div>

                        <div className="mt-1 text-slate-300">
                          {readable(
                            event.ruleId,
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="uppercase tracking-[0.08em] text-slate-600">
                          Action
                        </div>

                        <div className="mt-1 text-cyan-100">
                          {readable(
                            event.proposedAction,
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="uppercase tracking-[0.08em] text-slate-600">
                          Source
                        </div>

                        <div className="mt-1 text-slate-300">
                          {readable(
                            event.source,
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-[#05070A] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Reason
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {event.reason ||
                          "No reason supplied."}
                      </p>
                    </div>

                    <div className="mt-4 text-xs text-slate-600">
                      Proposal:{" "}
                      {event.proposalId}
                      {" · "}
                      Candidate writes: 0
                      {" · "}
                      Workflow writes: 0
                      {" · "}
                      Email sends: 0
                    </div>
                  </div>
                </div>
              </article>
            ),
          )}

          {!events.length ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              No approval history events match the current filters.
            </div>
          ) : null}
        </section>

        <div className="mt-6 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 text-xs leading-6 text-slate-400">
          Approval history only · Candidate DB writes: 0 · Workflow writes: 0 · Email sends: 0 · Automatic execution: disabled
        </div>
      </div>
    </main>
  );
}