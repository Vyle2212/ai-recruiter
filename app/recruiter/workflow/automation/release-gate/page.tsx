"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowExecutionReleaseGateCheck,
  WorkflowExecutionReleaseGateItem,
  WorkflowExecutionReleaseGateReport,
  WorkflowExecutionReleaseGateStatus,
} from "@/lib/recruiterWorkflowExecutionReleaseGate";

type StatusFilter =
  | WorkflowExecutionReleaseGateStatus
  | "ALL";

function readable(
  value: string,
) {
  return value.replace(
    /_/g,
    " ",
  );
}

function statusTone(
  status:
    WorkflowExecutionReleaseGateStatus,
) {
  if (
    status ===
    "READY_FOR_RELEASE_PREVIEW"
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (
    status ===
    "LOCKED"
  ) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-red-500/30 bg-red-500/10 text-red-100";
}

function checkTone(
  check:
    WorkflowExecutionReleaseGateCheck,
) {
  if (
    check.status ===
    "passed"
  ) {
    return {
      symbol:
        "✓",

      icon:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",

      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    };
  }

  if (
    check.status ===
    "locked"
  ) {
    return {
      symbol:
        "○",

      icon:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",

      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",
    };
  }

  return {
    symbol:
      "×",

    icon:
      "border-red-500/30 bg-red-500/10 text-red-100",

    badge:
      "border-red-500/30 bg-red-500/10 text-red-100",
  };
}

function ReleaseGateItem({
  item,
}: {
  item:
    WorkflowExecutionReleaseGateItem;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#090C11] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">
              {item.candidateName ||
                item.candidateId}
            </h2>

            <span
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusTone(
                item.status,
              )}`}
            >
              {item.status}
            </span>
          </div>

          <div className="mt-2 text-sm text-slate-400">
            Rule:{" "}
            {readable(
              item.ruleId,
            )}
            {" · "}
            Action:{" "}
            {readable(
              item.proposedAction,
            )}
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            {item.reason}
          </p>
        </div>

        {item.href ? (
          <Link
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            href={item.href}
          >
            Candidate360
          </Link>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Passed",
            item.summary.passed,
          ],
          [
            "Failed",
            item.summary.failed,
          ],
          [
            "Locked",
            item.summary.locked,
          ],
          [
            "Total checks",
            item.summary.totalChecks,
          ],
        ].map(
          ([label, value]) => (
            <div
              className="rounded-lg border border-slate-800 bg-[#05070A] p-3"
              key={String(label)}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </div>

              <div className="mt-1 text-xl font-semibold text-white">
                {value}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="mt-5 space-y-3">
        {item.checks.map(
          (gateCheck) => {
            const tone =
              checkTone(
                gateCheck,
              );

            return (
              <div
                className="rounded-lg border border-slate-800 bg-[#05070A] p-4"
                key={
                  gateCheck.checkId
                }
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${tone.icon}`}
                  >
                    {tone.symbol}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">
                        {gateCheck.title}
                      </h3>

                      <span
                        className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${tone.badge}`}
                      >
                        {gateCheck.status}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {gateCheck.reason}
                    </p>

                    <div className="mt-3 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                      Evidence:{" "}
                      <span className="break-all text-slate-400">
                        {gateCheck.evidence ===
                        null
                          ? "not available"
                          : String(
                              gateCheck.evidence,
                            )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-black/20 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Audit checksum
          </div>

          <div className="mt-2 break-all font-mono text-xs text-slate-300">
            {item.checksum
              .auditChecksum ||
              "Not available"}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-black/20 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Simulation checksum
          </div>

          <div className="mt-2 break-all font-mono text-xs text-slate-300">
            {item.checksum
              .simulationChecksum ||
              "Not available"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-[#05070A] p-4 text-xs leading-6 text-slate-400">
        Checksum match:{" "}
        <span
          className={
            item.checksum.matches
              ? "font-semibold text-emerald-200"
              : "font-semibold text-red-200"
          }
        >
          {item.checksum.matches
            ? "yes"
            : "no"}
        </span>
        {" · "}
        Execution lock:{" "}
        <span className="font-semibold text-amber-200">
          {item.lock.lockState}
        </span>
        {" · "}
        Release allowed: no
        {" · "}
        Would release: no
      </div>
    </article>
  );
}

export default function WorkflowExecutionReleaseGatePage() {
  const [
    data,
    setData,
  ] =
    useState<WorkflowExecutionReleaseGateReport | null>(
      null,
    );

  const [
    filter,
    setFilter,
  ] =
    useState<StatusFilter>(
      "ALL",
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const loadData =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        setError("");

        try {
          const response =
            await fetch(
              "/api/recruiter/workflow/execution-release-gate?limit=500",
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
                "Unable to load execution release gate",
            );
          }

          setData(result);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load execution release gate",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    loadData();
  }, [
    loadData,
  ]);

  const items =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return (
          data?.items || []
        ).filter(
          (item) => {
            if (
              filter !==
                "ALL" &&
              item.status !==
                filter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            return [
              item.candidateName,
              item.candidateId,
              item.proposalId,
              item.ruleId,
              item.proposedAction,
              item.reason,
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
        Loading workflow execution release gate...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Execution Release Gate
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Inspect the final release-gate checks for approved workflow proposals. This page is preview-only and cannot release or execute workflows.
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

            <Link
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100"
              href="/recruiter/workflow/automation/simulator"
            >
              Dry-run simulator
            </Link>

            <button
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
              disabled={
                refreshing
              }
              onClick={() =>
                loadData(
                  true,
                )
              }
              type="button"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh gate"}
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            [
              "Approved",
              data?.summary
                .approvedDecisions ||
                0,
            ],
            [
              "Gate items",
              data?.summary
                .gateItems ||
                0,
            ],
            [
              "Ready preview",
              data?.summary
                .readyForReleasePreview ||
                0,
            ],
            [
              "Blocked",
              data?.summary
                .blocked ||
                0,
            ],
            [
              "Locked",
              data?.summary
                .locked ||
                0,
            ],
            [
              "Releases",
              data?.summary
                .releasesPerformed ||
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
            <input
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500"
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search candidate, rule, action or proposal..."
              value={search}
            />

            <select
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none"
              onChange={(
                event,
              ) =>
                setFilter(
                  event.target
                    .value as StatusFilter,
                )
              }
              value={filter}
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="BLOCKED">
                Blocked
              </option>

              <option value="LOCKED">
                Locked
              </option>

              <option value="READY_FOR_RELEASE_PREVIEW">
                Ready for release preview
              </option>
            </select>
          </div>
        </section>

        <section className="mt-5 space-y-4">
          {items.map(
            (item) => (
              <ReleaseGateItem
                item={item}
                key={
                  item.releaseGateId
                }
              />
            ),
          )}

          {!items.length ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              No release-gate items match the current filters.
            </div>
          ) : null}
        </section>

        {data?.unmatched.length ? (
          <section className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <h2 className="text-lg font-semibold text-red-100">
              Unmatched approved proposals
            </h2>

            <div className="mt-4 space-y-2">
              {data.unmatched.map(
                (item) => (
                  <div
                    className="rounded-lg border border-red-500/20 bg-[#05070A] p-3"
                    key={
                      item.proposalId
                    }
                  >
                    <div className="text-sm font-semibold text-red-100">
                      {item.proposalId}
                    </div>

                    <div className="mt-1 text-xs text-red-100/70">
                      {item.reason}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-slate-400">
          Release-gate preview only · Execution lock: disabled · Release allowed: false · Candidate DB writes: 0 · Workflow writes: 0 · Audit writes: 0 · Email sends: 0
        </div>
      </div>
    </main>
  );
}