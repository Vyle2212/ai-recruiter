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
  RecruiterWorkflowAutomationRuleId,
} from "@/lib/recruiterWorkflowAutomationRules";

import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionFile,
} from "@/lib/recruiterWorkflowAutomationDecisions";

type BatchDecision =
  | "approved"
  | "rejected"
  | "deferred";

type RuleFilter =
  | RecruiterWorkflowAutomationRuleId
  | "all";

type PriorityFilter =
  | RecruiterWorkflowAutomationPriority
  | "all";

type BatchResult = {
  proposalId: string;
  candidateName: string;
  success: boolean;
  error: string | null;
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

function decisionTone(
  decision:
    WorkflowAutomationDecision["decision"] | null,
) {
  if (decision === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (decision === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (decision === "deferred") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-700 bg-slate-900 text-slate-400";
}

function batchReason(
  decision:
    BatchDecision,
) {
  if (decision === "approved") {
    return "Approved through workflow automation batch review.";
  }

  if (decision === "rejected") {
    return "Rejected through workflow automation batch review.";
  }

  return "Deferred through workflow automation batch review.";
}

export default function WorkflowAutomationBatchApprovalPage() {
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
    selected,
    setSelected,
  ] =
    useState<Set<string>>(
      new Set(),
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    ruleFilter,
    setRuleFilter,
  ] =
    useState<RuleFilter>(
      "all",
    );

  const [
    priorityFilter,
    setPriorityFilter,
  ] =
    useState<PriorityFilter>(
      "all",
    );

  const [
    includeReviewed,
    setIncludeReviewed,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

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

  const [
    results,
    setResults,
  ] =
    useState<BatchResult[]>(
      [],
    );

  const loadData =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            previewResponse,
            decisionResponse,
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
            ]);

          const [
            previewResult,
            decisionResult,
          ] =
            await Promise.all([
              previewResponse.json(),
              decisionResponse.json(),
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

          setPreview(
            previewResult,
          );

          setDecisions(
            decisionResult,
          );

          setSelected(
            new Set(),
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load batch approval page",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    loadData();
  }, [
    loadData,
  ]);

  const decisionMap =
    useMemo(
      () =>
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
        ),
      [
        decisions,
      ],
    );

  const visibleProposals =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return [
          ...(preview?.proposals ||
            []),
        ]
          .filter(
            (proposal) => {
              const currentDecision =
                decisionMap.get(
                  proposal.proposalId,
                );

              if (
                !includeReviewed &&
                currentDecision
              ) {
                return false;
              }

              if (
                ruleFilter !==
                  "all" &&
                proposal.ruleId !==
                  ruleFilter
              ) {
                return false;
              }

              if (
                priorityFilter !==
                  "all" &&
                proposal.priority !==
                  priorityFilter
              ) {
                return false;
              }

              if (!query) {
                return true;
              }

              return [
                proposal.candidateName,
                proposal.candidateId,
                proposal.title,
                proposal.ruleId,
                proposal.proposedAction,
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
            ) =>
              priorityWeight(
                right.priority,
              ) -
              priorityWeight(
                left.priority,
              ),
          );
      },
      [
        preview,
        decisionMap,
        includeReviewed,
        ruleFilter,
        priorityFilter,
        search,
      ],
    );

  const selectedProposals =
    useMemo(
      () =>
        visibleProposals.filter(
          (proposal) =>
            selected.has(
              proposal.proposalId,
            ),
        ),
      [
        visibleProposals,
        selected,
      ],
    );

  const allVisibleSelected =
    visibleProposals.length >
      0 &&
    visibleProposals.every(
      (proposal) =>
        selected.has(
          proposal.proposalId,
        ),
    );

  function toggleProposal(
    proposalId: string,
  ) {
    setSelected(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(
            proposalId,
          )
        ) {
          next.delete(
            proposalId,
          );
        } else {
          next.add(
            proposalId,
          );
        }

        return next;
      },
    );
  }

  function selectVisible() {
    setSelected(
      new Set(
        visibleProposals.map(
          (proposal) =>
            proposal.proposalId,
        ),
      ),
    );
  }

  function clearSelection() {
    setSelected(
      new Set(),
    );
  }

  async function saveSingleDecision(
    proposal:
      RecruiterWorkflowAutomationProposal,
    decision:
      BatchDecision,
  ): Promise<BatchResult> {
    const previousDecision =
      decisionMap.get(
        proposal.proposalId,
      )?.decision ||
      null;

    const reason =
      batchReason(
        decision,
      );

    try {
      const decisionResponse =
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
                  proposal.proposalId,

                candidateId:
                  proposal.candidateId,

                ruleId:
                  proposal.ruleId,

                proposedAction:
                  proposal.proposedAction,

                decision,

                reason,

                reviewerId:
                  "recruiter",

                reviewerName:
                  "Recruiter",
              }),
          },
        );

      const decisionResult =
        await decisionResponse.json();

      if (!decisionResponse.ok) {
        throw new Error(
          decisionResult.error ||
            "Unable to save recruiter decision",
        );
      }

      const historyResponse =
        await fetch(
          "/api/recruiter/workflow/automation-approval-history",
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
                  proposal.proposalId,

                candidateId:
                  proposal.candidateId,

                candidateName:
                  proposal.candidateName,

                ruleId:
                  proposal.ruleId,

                proposedAction:
                  proposal.proposedAction,

                previousDecision,

                decision,

                reason,

                reviewerId:
                  "recruiter",

                reviewerName:
                  "Recruiter",
              }),
          },
        );

      const historyResult =
        await historyResponse.json();

      if (!historyResponse.ok) {
        throw new Error(
          historyResult.error ||
            "Decision saved, but approval history could not be recorded",
        );
      }

      return {
        proposalId:
          proposal.proposalId,

        candidateName:
          proposal.candidateName,

        success:
          true,

        error:
          null,
      };
    } catch (saveError) {
      return {
        proposalId:
          proposal.proposalId,

        candidateName:
          proposal.candidateName,

        success:
          false,

        error:
          saveError instanceof Error
            ? saveError.message
            : "Unable to save batch decision",
      };
    }
  }

  async function applyBatch(
    decision:
      BatchDecision,
  ) {
    if (
      !selectedProposals.length
    ) {
      setError(
        "Select at least one proposal.",
      );

      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");
    setResults([]);

    const batchResults:
      BatchResult[] = [];

    /*
     * Process sequentially to reduce file-store
     * write collisions on Windows.
     */
    for (
      const proposal of selectedProposals
    ) {
      const result =
        await saveSingleDecision(
          proposal,
          decision,
        );

      batchResults.push(
        result,
      );
    }

    setResults(
      batchResults,
    );

    const succeeded =
      batchResults.filter(
        (result) =>
          result.success,
      ).length;

    const failed =
      batchResults.length -
      succeeded;

    setMessage(
      `${succeeded} proposal(s) updated successfully${
        failed
          ? `; ${failed} failed.`
          : "."
      }`,
    );

    if (failed) {
      setError(
        "Some proposals could not be updated. Review the batch result details below.",
      );
    }

    await loadData();

    setProcessing(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070A] p-6 text-slate-300">
        Loading workflow batch approval...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Batch Approval
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Select multiple workflow proposals and apply a recruiter approval, rejection, or defer decision while recording an approval-history event for every item.
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
              className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-100"
              href="/recruiter/workflow/automation/history"
            >
              Approval history
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Available",
              visibleProposals.length,
            ],
            [
              "Selected",
              selectedProposals.length,
            ],
            [
              "Total proposals",
              preview?.summary
                .total ||
                0,
            ],
            [
              "Reviewed",
              decisions?.summary
                .total ||
                0,
            ],
            [
              "Execution",
              "Disabled",
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <input
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target.value,
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
                setPriorityFilter(
                  event.target
                    .value as PriorityFilter,
                )
              }
              value={priorityFilter}
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

            <select
              className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none"
              onChange={(
                event,
              ) =>
                setRuleFilter(
                  event.target
                    .value as RuleFilter,
                )
              }
              value={ruleFilter}
            >
              <option value="all">
                All rules
              </option>

              {preview?.rules.map(
                (rule) => (
                  <option
                    key={
                      rule.ruleId
                    }
                    value={
                      rule.ruleId
                    }
                  >
                    {readable(
                      rule.ruleId,
                    )}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                checked={
                  includeReviewed
                }
                className="h-4 w-4 accent-indigo-500"
                onChange={(
                  event,
                ) =>
                  setIncludeReviewed(
                    event.target
                      .checked,
                  )
                }
                type="checkbox"
              />

              Include already reviewed proposals
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                disabled={
                  !visibleProposals.length ||
                  allVisibleSelected
                }
                onClick={
                  selectVisible
                }
                type="button"
              >
                Select visible
              </button>

              <button
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                disabled={
                  !selected.size
                }
                onClick={
                  clearSelection
                }
                type="button"
              >
                Clear selection
              </button>
            </div>
          </div>
        </section>

        <section className="sticky top-3 z-20 mt-5 rounded-xl border border-indigo-500/30 bg-[#090C11]/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">
                {selectedProposals.length} proposal(s) selected
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Batch decisions create approval history only. Workflow execution remains disabled.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                disabled={
                  processing ||
                  !selectedProposals.length
                }
                onClick={() =>
                  applyBatch(
                    "deferred",
                  )
                }
                type="button"
              >
                Batch defer
              </button>

              <button
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-50"
                disabled={
                  processing ||
                  !selectedProposals.length
                }
                onClick={() =>
                  applyBatch(
                    "rejected",
                  )
                }
                type="button"
              >
                Batch reject
              </button>

              <button
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                disabled={
                  processing ||
                  !selectedProposals.length
                }
                onClick={() =>
                  applyBatch(
                    "approved",
                  )
                }
                type="button"
              >
                {processing
                  ? "Processing..."
                  : "Batch approve"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {visibleProposals.map(
            (proposal) => {
              const currentDecision =
                decisionMap.get(
                  proposal.proposalId,
                );

              const checked =
                selected.has(
                  proposal.proposalId,
                );

              return (
                <article
                  className={`rounded-xl border p-4 ${
                    checked
                      ? "border-indigo-500/40 bg-indigo-500/10"
                      : "border-slate-800 bg-[#090C11]"
                  }`}
                  key={
                    proposal.proposalId
                  }
                >
                  <div className="flex items-start gap-4">
                    <input
                      checked={
                        checked
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
                      onChange={() =>
                        toggleProposal(
                          proposal.proposalId,
                        )
                      }
                      type="checkbox"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-white">
                              {proposal.candidateName}
                            </h2>

                            <span
                              className={`rounded border px-2 py-1 text-[9px] font-semibold uppercase ${priorityTone(
                                proposal.priority,
                              )}`}
                            >
                              {proposal.priority}
                            </span>

                            <span
                              className={`rounded border px-2 py-1 text-[9px] font-semibold uppercase ${decisionTone(
                                currentDecision?.decision ||
                                  null,
                              )}`}
                            >
                              {currentDecision?.decision ||
                                "not reviewed"}
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-slate-400">
                            {proposal.title}
                          </div>
                        </div>

                        <Link
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                          href={
                            proposal.href
                          }
                        >
                          Candidate360
                        </Link>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>
                          Rule:{" "}
                          {readable(
                            proposal.ruleId,
                          )}
                        </span>

                        <span>
                          Action:{" "}
                          {readable(
                            proposal.proposedAction,
                          )}
                        </span>

                        <span>
                          Stage:{" "}
                          {readable(
                            proposal.currentStage,
                          )}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {proposal.reason}
                      </p>
                    </div>
                  </div>
                </article>
              );
            },
          )}

          {!visibleProposals.length ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              No proposals match the current batch filters.
            </div>
          ) : null}
        </section>

        {results.length ? (
          <section className="mt-6 rounded-xl border border-slate-800 bg-[#090C11] p-5">
            <h2 className="text-lg font-semibold text-white">
              Batch results
            </h2>

            <div className="mt-4 space-y-2">
              {results.map(
                (result) => (
                  <div
                    className={`rounded-lg border p-3 text-sm ${
                      result.success
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "border-red-500/30 bg-red-500/10 text-red-100"
                    }`}
                    key={
                      result.proposalId
                    }
                  >
                    <div className="font-semibold">
                      {result.candidateName}
                    </div>

                    <div className="mt-1 text-xs opacity-80">
                      {result.success
                        ? "Decision and approval history saved."
                        : result.error}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-6 text-slate-400">
          Batch review only · Candidate DB writes: 0 · Workflow writes: 0 · Email sends: 0 · Automatic execution: disabled
        </div>
      </div>
    </main>
  );
}