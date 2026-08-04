"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationPriority,
  RecruiterWorkflowAutomationProposal,
} from "@/lib/recruiterWorkflowAutomationRules";
import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionFile,
} from "@/lib/recruiterWorkflowAutomationDecisions";
import type {
  WorkflowExecutionReadinessItem,
  WorkflowExecutionReadinessReport,
} from "@/lib/recruiterWorkflowExecutionReadiness";
import type {
  WorkflowExecutionSimulationItem,
  WorkflowExecutionSimulationReport,
} from "@/lib/recruiterWorkflowExecutionSimulator";

type QueueStatus =
  | "PENDING"
  | "READY"
  | "BLOCKED"
  | "REJECTED"
  | "DEFERRED";

type QueueFilter =
  | QueueStatus
  | "ALL";

type ApprovalQueueItem = {
  proposal:
    RecruiterWorkflowAutomationProposal;

  decision:
    WorkflowAutomationDecision | null;

  readiness:
    WorkflowExecutionReadinessItem | null;

  simulation:
    WorkflowExecutionSimulationItem | null;

  status:
    QueueStatus;

  statusReason:
    string;
};

function readable(
  value: string,
) {
  return value.replace(
    /_/g,
    " ",
  );
}

function priorityWeight(
  priority:
    RecruiterWorkflowAutomationPriority,
) {
  if (priority === "critical") {
    return 4;
  }

  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  return 1;
}

function priorityTone(
  priority:
    RecruiterWorkflowAutomationPriority,
) {
  if (priority === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (priority === "high") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-100";
  }

  if (priority === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function statusTone(
  status:
    QueueStatus,
) {
  if (status === "READY") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "BLOCKED") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (status === "REJECTED") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }

  if (status === "DEFERRED") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
}

function deriveStatus(
  decision:
    WorkflowAutomationDecision | null,
  readiness:
    WorkflowExecutionReadinessItem | null,
): {
  status:
    QueueStatus;

  reason:
    string;
} {
  if (!decision) {
    return {
      status:
        "PENDING",

      reason:
        "This proposal has not yet been reviewed.",
    };
  }

  if (
    decision.decision ===
    "rejected"
  ) {
    return {
      status:
        "REJECTED",

      reason:
        decision.reason ||
        "Proposal was rejected by the recruiter.",
    };
  }

  if (
    decision.decision ===
    "deferred"
  ) {
    return {
      status:
        "DEFERRED",

      reason:
        decision.reason ||
        "Proposal review was deferred.",
    };
  }

  if (
    decision.decision ===
    "approved"
  ) {
    if (
      readiness?.status ===
      "READY"
    ) {
      return {
        status:
          "READY",

        reason:
          readiness.reason,
      };
    }

    return {
      status:
        "BLOCKED",

      reason:
        readiness?.reason ||
        "The approved proposal does not currently have a READY execution result.",
    };
  }

  return {
    status:
      "PENDING",

    reason:
      "This proposal requires recruiter review.",
  };
}

function buildQueueItems(
  preview:
    RecruiterWorkflowAutomationPreview | null,
  decisions:
    WorkflowAutomationDecisionFile | null,
  readiness:
    WorkflowExecutionReadinessReport | null,
  simulation:
    WorkflowExecutionSimulationReport | null,
): ApprovalQueueItem[] {
  if (!preview) {
    return [];
  }

  const decisionMap =
    new Map(
      (
        decisions?.decisions ||
        []
      ).map(
        (decision) => [
          decision.proposalId,
          decision,
        ],
      ),
    );

  const readinessMap =
    new Map(
      (
        readiness?.items ||
        []
      ).map(
        (item) => [
          item.proposalId,
          item,
        ],
      ),
    );

  const simulationMap =
    new Map(
      (
        simulation?.simulations ||
        []
      ).map(
        (item) => [
          item.proposalId,
          item,
        ],
      ),
    );

  return preview.proposals.map(
    (proposal) => {
      const decision =
        decisionMap.get(
          proposal.proposalId,
        ) || null;

      const readinessItem =
        readinessMap.get(
          proposal.proposalId,
        ) || null;

      const simulationItem =
        simulationMap.get(
          proposal.proposalId,
        ) || null;

      const derived =
        deriveStatus(
          decision,
          readinessItem,
        );

      return {
        proposal,
        decision,
        readiness:
          readinessItem,
        simulation:
          simulationItem,

        status:
          derived.status,

        statusReason:
          derived.reason,
      };
    },
  );
}

export default function WorkflowAutomationApprovalQueuePage() {
  const [
    preview,
    setPreview,
  ] =
    useState<RecruiterWorkflowAutomationPreview | null>(
      null,
    );

  const [
    decisions,
    setDecisions,
  ] =
    useState<WorkflowAutomationDecisionFile | null>(
      null,
    );

  const [
    readiness,
    setReadiness,
  ] =
    useState<WorkflowExecutionReadinessReport | null>(
      null,
    );

  const [
    simulation,
    setSimulation,
  ] =
    useState<WorkflowExecutionSimulationReport | null>(
      null,
    );

  const [
    filter,
    setFilter,
  ] =
    useState<QueueFilter>(
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
    savingProposalId,
    setSavingProposalId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const loadQueue =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            previewResponse,
            decisionResponse,
            readinessResponse,
            simulationResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/recruiter/workflow/automation-preview?limit=500",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/recruiter/workflow/automation-decisions",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/recruiter/workflow/execution-readiness?limit=500",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/recruiter/workflow/execution-simulator?limit=500",
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const [
            previewResult,
            decisionResult,
            readinessResult,
            simulationResult,
          ] =
            await Promise.all([
              previewResponse.json(),
              decisionResponse.json(),
              readinessResponse.json(),
              simulationResponse.json(),
            ]);

          if (!previewResponse.ok) {
            throw new Error(
              previewResult.error ||
              "Unable to load automation proposals",
            );
          }

          if (!decisionResponse.ok) {
            throw new Error(
              decisionResult.error ||
              "Unable to load automation decisions",
            );
          }

          if (!readinessResponse.ok) {
            throw new Error(
              readinessResult.error ||
              "Unable to load execution readiness",
            );
          }

          if (!simulationResponse.ok) {
            throw new Error(
              simulationResult.error ||
              "Unable to load dry-run simulations",
            );
          }

          setPreview(
            previewResult,
          );

          setDecisions(
            decisionResult,
          );

          setReadiness(
            readinessResult,
          );

          setSimulation(
            simulationResult,
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load approval queue",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    loadQueue();
  }, [
    loadQueue,
  ]);

  const queueItems =
    useMemo(
      () =>
        buildQueueItems(
          preview,
          decisions,
          readiness,
          simulation,
        ),
      [
        preview,
        decisions,
        readiness,
        simulation,
      ],
    );

  const counts =
    useMemo(
      () => {
        const result:
          Record<
            QueueStatus,
            number
          > = {
          PENDING: 0,
          READY: 0,
          BLOCKED: 0,
          REJECTED: 0,
          DEFERRED: 0,
        };

        for (
          const item of queueItems
        ) {
          result[
            item.status
          ] += 1;
        }

        return result;
      },
      [
        queueItems,
      ],
    );

  const filteredItems =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return queueItems
          .filter(
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
                item.proposal
                  .candidateName,
                item.proposal
                  .candidateId,
                item.proposal
                  .ruleId,
                item.proposal
                  .proposedAction,
                item.proposal
                  .title,
              ]
                .join(" ")
                .toLowerCase()
                .includes(
                  query,
                );
            },
          )
          .sort(
            (
              left,
              right,
            ) => {
              const priorityDifference =
                priorityWeight(
                  right.proposal
                    .priority,
                ) -
                priorityWeight(
                  left.proposal
                    .priority,
                );

              if (
                priorityDifference !==
                0
              ) {
                return priorityDifference;
              }

              return left.proposal
                .candidateName
                .localeCompare(
                  right.proposal
                    .candidateName,
                );
            },
          );
      },
      [
        queueItems,
        filter,
        search,
      ],
    );

  async function saveDecision(
    item:
      ApprovalQueueItem,
    decision:
      "approved"
      | "rejected"
      | "deferred",
  ) {
    setSavingProposalId(
      item.proposal
        .proposalId,
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/recruiter/workflow/automation-decisions",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                proposalId:
                  item.proposal
                    .proposalId,

                candidateId:
                  item.proposal
                    .candidateId,

                ruleId:
                  item.proposal
                    .ruleId,

                proposedAction:
                  item.proposal
                    .proposedAction,

                decision,

                reason:
                  decision ===
                  "approved"
                    ? "Approved from the workflow automation approval queue."
                    : decision ===
                        "rejected"
                      ? "Rejected from the workflow automation approval queue."
                      : "Deferred for later recruiter review.",

                reviewerId:
                  "recruiter",

                reviewerName:
                  "Recruiter",
              }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Unable to save recruiter decision",
        );
      }

      setMessage(
        `${item.proposal.candidateName}: ${decision}.`,
      );

      await loadQueue();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save recruiter decision",
      );
    } finally {
      setSavingProposalId(
        null,
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070A] p-6 text-slate-300">
        Loading workflow approval queue...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Approval Queue
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review workflow proposals, readiness results, and dry-run evidence before approving, rejecting, or deferring an automation decision.
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
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100"
              href="/recruiter/workflow/automation/simulator"
            >
              Open simulator
            </Link>

            <button
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100"
              onClick={
                loadQueue
              }
              type="button"
            >
              Refresh queue
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            [
              "Total",
              queueItems.length,
            ],
            [
              "Pending",
              counts.PENDING,
            ],
            [
              "Ready",
              counts.READY,
            ],
            [
              "Blocked",
              counts.BLOCKED,
            ],
            [
              "Rejected",
              counts.REJECTED,
            ],
            [
              "Deferred",
              counts.DEFERRED,
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

        {message ? (
          <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-xl border border-slate-800 bg-[#090C11] p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <input
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500"
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search candidate, rule or action..."
              value={search}
            />

            <select
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none"
              onChange={(
                event,
              ) =>
                setFilter(
                  event.target
                    .value as QueueFilter,
                )
              }
              value={filter}
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="READY">
                Ready
              </option>

              <option value="BLOCKED">
                Blocked
              </option>

              <option value="REJECTED">
                Rejected
              </option>

              <option value="DEFERRED">
                Deferred
              </option>
            </select>
          </div>
        </section>

        <section className="mt-5 space-y-4">
          {filteredItems.map(
            (item) => {
              const saving =
                savingProposalId ===
                item.proposal
                  .proposalId;

              return (
                <article
                  className="rounded-xl border border-slate-800 bg-[#090C11] p-5"
                  key={
                    item.proposal
                      .proposalId
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">
                          {item.proposal.candidateName}
                        </h2>

                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${priorityTone(
                            item.proposal.priority,
                          )}`}
                        >
                          {item.proposal.priority}
                        </span>

                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${statusTone(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        {item.proposal.title}
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        Rule:{" "}
                        {readable(
                          item.proposal.ruleId,
                        )}
                        {" · "}
                        Action:{" "}
                        {readable(
                          item.proposal.proposedAction,
                        )}
                        {" · "}
                        Stage:{" "}
                        {readable(
                          item.proposal.currentStage,
                        )}
                      </div>
                    </div>

                    <Link
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                      href={
                        item.proposal.href
                      }
                    >
                      Candidate360
                    </Link>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-800 bg-[#05070A] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Queue status
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {item.statusReason}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-800 bg-[#05070A] p-3">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Decision
                      </div>

                      <div className="mt-1 text-sm text-slate-200">
                        {item.decision
                          ?.decision ||
                          "Not reviewed"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#05070A] p-3">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Readiness
                      </div>

                      <div className="mt-1 text-sm text-slate-200">
                        {item.readiness
                          ?.status ||
                          "Not available"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#05070A] p-3">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Dry run
                      </div>

                      <div className="mt-1 text-sm text-slate-200">
                        {item.simulation
                          ? "Completed"
                          : "Not available"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#05070A] p-3">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Execution
                      </div>

                      <div className="mt-1 text-sm text-emerald-200">
                        Disabled
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      Candidate writes: 0 · Workflow writes: 0 · Email sends: 0
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          saveDecision(
                            item,
                            "deferred",
                          )
                        }
                        type="button"
                      >
                        Defer
                      </button>

                      <button
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-50"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          saveDecision(
                            item,
                            "rejected",
                          )
                        }
                        type="button"
                      >
                        Reject
                      </button>

                      <button
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          saveDecision(
                            item,
                            "approved",
                          )
                        }
                        type="button"
                      >
                        {saving
                          ? "Saving..."
                          : "Approve"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}

          {!filteredItems.length ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              No approval queue items match the current filters.
            </div>
          ) : null}
        </section>

        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-6 text-slate-400">
          Review decisions only · Candidate DB writes: 0 · Workflow writes: 0 · Audit writes: 0 · Email sends: 0 · Automatic execution: disabled
        </div>
      </div>
    </main>
  );
}