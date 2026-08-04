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
  WorkflowAutomationRuleConfigFile,
} from "@/lib/recruiterWorkflowAutomationRuleConfig";
import type {
  WorkflowExecutionSimulationItem,
  WorkflowExecutionSimulationReport,
  WorkflowExecutionSimulationStep,
} from "@/lib/recruiterWorkflowExecutionSimulator";

type FilterPriority =
  | RecruiterWorkflowAutomationPriority
  | "all";

type FilterRule =
  | RecruiterWorkflowAutomationRuleId
  | "all";

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

function simulationStepTone(
  step:
    WorkflowExecutionSimulationStep,
) {
  if (
    step.status ===
    "simulated"
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
    step.status ===
    "blocked"
  ) {
    return {
      symbol:
        "×",

      icon:
        "border-red-500/30 bg-red-500/10 text-red-100",

      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
    };
  }

  return {
    symbol:
      "○",

    icon:
      "border-slate-700 bg-slate-900 text-slate-400",

    badge:
      "border-slate-700 bg-slate-900 text-slate-400",
  };
}

function ProposalDetails({
  proposal,
  simulation,
}: {
  proposal:
    RecruiterWorkflowAutomationProposal;

  simulation:
    WorkflowExecutionSimulationItem | null;
}) {
  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-slate-800 bg-[#090C11] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-300">
              Selected proposal
            </div>

            <h2 className="mt-2 text-xl font-semibold text-white">
              {proposal.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {proposal.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${priorityTone(
                proposal.priority,
              )}`}
            >
              {proposal.priority}
            </span>

            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-100">
              {readable(
                proposal.ruleId,
              )}
            </span>

            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
              Preview only
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
              Candidate
            </div>

            <div className="mt-1 text-slate-200">
              {proposal.candidateName}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
              Current stage
            </div>

            <div className="mt-1 text-slate-200">
              {readable(
                proposal.currentStage,
              )}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
              Proposed action
            </div>

            <div className="mt-1 text-cyan-100">
              {readable(
                proposal.proposedAction,
              )}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
              Due at
            </div>

            <div className="mt-1 text-slate-200">
              {proposal.dueAt ||
                "Not available"}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-800 bg-black/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Match reason
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {proposal.reason}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {proposal.evidence.map(
            (item) => (
              <div
                className="rounded-lg border border-slate-800 bg-[#05070A] p-3"
                key={item.label}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {item.label}
                </div>

                <div className="mt-1 text-sm text-slate-200">
                  {item.value === null
                    ? "Not available"
                    : String(
                        item.value,
                      )}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Candidate DB writes: 0 · Workflow writes: 0 · Email sends: 0
          </div>

          <Link
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200"
            href={proposal.href}
          >
            Open Candidate360
          </Link>
        </div>
      </article>

      {simulation ? (
        <article className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-200">
                Dry-run result
              </div>

              <h3 className="mt-2 text-lg font-semibold text-white">
                {simulation.status}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                The execution sequence was simulated without persisting any candidate, workflow, audit, notification, or email changes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
                Dry run
              </span>

              <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
                Execution disabled
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Simulated",
                simulation.summary
                  .simulated,
              ],
              [
                "Skipped",
                simulation.summary
                  .skipped,
              ],
              [
                "Blocked",
                simulation.summary
                  .blocked,
              ],
              [
                "Total steps",
                simulation.summary
                  .totalSteps,
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
            {simulation.steps.map(
              (step) => {
                const tone =
                  simulationStepTone(
                    step,
                  );

                return (
                  <div
                    className="rounded-lg border border-slate-800 bg-[#05070A] p-4"
                    key={
                      step.simulationStepId
                    }
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${tone.icon}`}
                      >
                        {step.sequence}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">
                              {tone.symbol}
                            </span>

                            <h4 className="text-sm font-semibold text-slate-100">
                              {step.title}
                            </h4>
                          </div>

                          <span
                            className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${tone.badge}`}
                          >
                            {step.status}
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          {step.simulatedResult}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                          <span>
                            Dependency:{" "}
                            {readable(
                              step.dependencyStatus,
                            )}
                          </span>

                          <span>
                            Would execute: no
                          </span>

                          <span>
                            Writes: 0
                          </span>

                          <span>
                            Emails: 0
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>

          <div className="mt-5 break-all rounded-lg border border-slate-800 bg-black/20 p-3 font-mono text-xs text-slate-500">
            SHA-256:{" "}
            {simulation.checksum.value}
          </div>
        </article>
      ) : (
        <article className="rounded-xl border border-dashed border-slate-800 p-5">
          <div className="text-sm font-semibold text-slate-300">
            No simulation available
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This proposal may not yet have an approved decision, READY readiness result, execution plan, or eligible audit preview.
          </p>
        </article>
      )}
    </section>
  );
}

export default function WorkflowAutomationSimulatorPage() {
  const [
    preview,
    setPreview,
  ] =
    useState<RecruiterWorkflowAutomationPreview | null>(
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
    ruleConfig,
    setRuleConfig,
  ] =
    useState<WorkflowAutomationRuleConfigFile | null>(
      null,
    );

  const [
    selectedProposalId,
    setSelectedProposalId,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    priority,
    setPriority,
  ] =
    useState<FilterPriority>(
      "all",
    );

  const [
    rule,
    setRule,
  ] =
    useState<FilterRule>(
      "all",
    );

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
          const [
            previewResponse,
            simulationResponse,
            ruleResponse,
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
                "/api/recruiter/workflow/execution-simulator?limit=500",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/recruiter/workflow/automation-rules",
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const [
            previewResult,
            simulationResult,
            ruleResult,
          ] =
            await Promise.all([
              previewResponse.json(),
              simulationResponse.json(),
              ruleResponse.json(),
            ]);

          if (
            !previewResponse.ok
          ) {
            throw new Error(
              previewResult.error ||
                "Unable to load automation preview",
            );
          }

          if (
            !simulationResponse.ok
          ) {
            throw new Error(
              simulationResult.error ||
                "Unable to load execution simulation",
            );
          }

          if (
            !ruleResponse.ok
          ) {
            throw new Error(
              ruleResult.error ||
                "Unable to load rule configuration",
            );
          }

          setPreview(
            previewResult,
          );

          setSimulation(
            simulationResult,
          );

          setRuleConfig(
            ruleResult,
          );

          setSelectedProposalId(
            (
              current,
            ) => {
              if (
                current &&
                previewResult.proposals.some(
                  (
                    item:
                      RecruiterWorkflowAutomationProposal,
                  ) =>
                    item.proposalId ===
                    current,
                )
              ) {
                return current;
              }

              return (
                previewResult
                  .proposals[0]
                  ?.proposalId ||
                ""
              );
            },
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load workflow simulator",
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

  const filteredProposals =
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
              if (
                priority !==
                  "all" &&
                proposal.priority !==
                  priority
              ) {
                return false;
              }

              if (
                rule !==
                  "all" &&
                proposal.ruleId !==
                  rule
              ) {
                return false;
              }

              if (!query) {
                return true;
              }

              const searchable =
                [
                  proposal.candidateName,
                  proposal.candidateId,
                  proposal.title,
                  proposal.ruleId,
                  proposal.proposedAction,
                ]
                  .join(" ")
                  .toLowerCase();

              return searchable.includes(
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
        priority,
        rule,
        search,
      ],
    );

  const selectedProposal =
    useMemo(
      () =>
        preview?.proposals.find(
          (item) =>
            item.proposalId ===
            selectedProposalId,
        ) ||
        filteredProposals[0] ||
        null,
      [
        preview,
        selectedProposalId,
        filteredProposals,
      ],
    );

  const selectedSimulation =
    useMemo(
      () => {
        if (
          !selectedProposal
        ) {
          return null;
        }

        return (
          simulation?.simulations.find(
            (item) =>
              item.proposalId ===
              selectedProposal.proposalId,
          ) || null
        );
      },
      [
        simulation,
        selectedProposal,
      ],
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070A] p-6 text-slate-300">
        Loading workflow automation simulator...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Dry-run Simulator
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review rule matches, proposal evidence, execution eligibility, and deterministic dry-run results without changing candidate or workflow data.
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
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              href="/recruiter/workflow/automation/rules"
            >
              Manage rules
            </Link>

            <button
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
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
                : "Refresh dry run"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            [
              "Proposals",
              preview?.summary
                .total || 0,
            ],
            [
              "Critical",
              preview?.summary
                .critical || 0,
            ],
            [
              "Enabled rules",
              ruleConfig?.summary
                .enabled || 0,
            ],
            [
              "Disabled rules",
              ruleConfig?.summary
                .disabled || 0,
            ],
            [
              "Simulations",
              simulation?.summary
                .simulationsCreated ||
                0,
            ],
            [
              "DB writes",
              simulation?.summary
                .candidateDbWrites ||
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

        <section className="mt-6 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-800 bg-[#090C11] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              Proposal explorer
            </div>

            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Search candidate, rule, action..."
                value={search}
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none"
                  onChange={(
                    event,
                  ) =>
                    setPriority(
                      event.target
                        .value as FilterPriority,
                    )
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

                <select
                  className="rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-200 outline-none"
                  onChange={(
                    event,
                  ) =>
                    setRule(
                      event.target
                        .value as FilterRule,
                    )
                  }
                  value={rule}
                >
                  <option value="all">
                    All rules
                  </option>

                  {ruleConfig?.rules.map(
                    (item) => (
                      <option
                        key={
                          item.ruleId
                        }
                        value={
                          item.ruleId
                        }
                      >
                        {readable(
                          item.ruleId,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Showing{" "}
              {filteredProposals.length}{" "}
              proposal(s)
            </div>

            <div className="mt-3 max-h-[720px] space-y-2 overflow-y-auto pr-1">
              {filteredProposals.map(
                (proposal) => {
                  const selected =
                    proposal.proposalId ===
                    selectedProposal
                      ?.proposalId;

                  const hasSimulation =
                    simulation?.simulations.some(
                      (item) =>
                        item.proposalId ===
                        proposal.proposalId,
                    );

                  return (
                    <button
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-cyan-500/40 bg-cyan-500/10"
                          : "border-slate-800 bg-[#05070A] hover:border-slate-600"
                      }`}
                      key={
                        proposal.proposalId
                      }
                      onClick={() =>
                        setSelectedProposalId(
                          proposal.proposalId,
                        )
                      }
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">
                            {proposal.candidateName}
                          </div>

                          <div className="mt-1 truncate text-xs text-slate-500">
                            {readable(
                              proposal.ruleId,
                            )}
                          </div>
                        </div>

                        <span
                          className={`rounded border px-2 py-1 text-[9px] font-semibold uppercase ${priorityTone(
                            proposal.priority,
                          )}`}
                        >
                          {proposal.priority}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] uppercase text-slate-400">
                          {readable(
                            proposal.currentStage,
                          )}
                        </span>

                        <span
                          className={`rounded border px-2 py-1 text-[9px] uppercase ${
                            hasSimulation
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                              : "border-slate-700 bg-slate-900 text-slate-500"
                          }`}
                        >
                          {hasSimulation
                            ? "Simulated"
                            : "No dry run"}
                        </span>
                      </div>
                    </button>
                  );
                },
              )}

              {!filteredProposals.length ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No proposals match the current filters.
                </div>
              ) : null}
            </div>
          </aside>

          <div>
            {selectedProposal ? (
              <ProposalDetails
                proposal={
                  selectedProposal
                }
                simulation={
                  selectedSimulation
                }
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                Select a proposal to inspect its rule match and dry-run result.
              </div>
            )}
          </div>
        </section>

        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-6 text-slate-400">
          Dry-run only · Candidate DB writes: 0 · Workflow writes: 0 · Audit writes: 0 · Email sends: 0 · Execution enabled: false
        </div>
      </div>
    </main>
  );
}