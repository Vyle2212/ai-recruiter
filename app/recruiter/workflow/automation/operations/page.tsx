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
} from "@/lib/recruiterWorkflowAutomationRules";

import type {
  WorkflowAutomationDecisionFile,
} from "@/lib/recruiterWorkflowAutomationDecisions";

import type {
  WorkflowAutomationApprovalHistoryFile,
} from "@/lib/recruiterWorkflowAutomationApprovalHistory";

import type {
  WorkflowExecutionReadinessReport,
} from "@/lib/recruiterWorkflowExecutionReadiness";

import type {
  WorkflowExecutionPlanReport,
} from "@/lib/recruiterWorkflowExecutionPlan";

import type {
  WorkflowExecutionAuditPreviewReport,
} from "@/lib/recruiterWorkflowExecutionAuditPreview";

import type {
  WorkflowExecutionSimulationReport,
} from "@/lib/recruiterWorkflowExecutionSimulator";

import type {
  WorkflowExecutionReleaseGateReport,
} from "@/lib/recruiterWorkflowExecutionReleaseGate";

type OperationsData = {
  automation:
    RecruiterWorkflowAutomationPreview;

  decisions:
    WorkflowAutomationDecisionFile;

  history:
    WorkflowAutomationApprovalHistoryFile;

  readiness:
    WorkflowExecutionReadinessReport;

  plans:
    WorkflowExecutionPlanReport;

  audit:
    WorkflowExecutionAuditPreviewReport;

  simulation:
    WorkflowExecutionSimulationReport;

  releaseGate:
    WorkflowExecutionReleaseGateReport;
};

type OperationsSection = {
  title: string;
  description: string;
  href: string;

  metrics: Array<{
    label: string;
    value: string | number;
  }>;

  tone:
    | "cyan"
    | "violet"
    | "fuchsia"
    | "blue"
    | "emerald"
    | "amber"
    | "red";
};

function sectionTone(
  tone:
    OperationsSection["tone"],
) {
  if (tone === "violet") {
    return {
      border:
        "border-violet-500/20",

      background:
        "bg-violet-500/5",

      title:
        "text-violet-200",

      button:
        "border-violet-500/30 bg-violet-500/10 text-violet-100",
    };
  }

  if (tone === "fuchsia") {
    return {
      border:
        "border-fuchsia-500/20",

      background:
        "bg-fuchsia-500/5",

      title:
        "text-fuchsia-200",

      button:
        "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100",
    };
  }

  if (tone === "blue") {
    return {
      border:
        "border-blue-500/20",

      background:
        "bg-blue-500/5",

      title:
        "text-blue-200",

      button:
        "border-blue-500/30 bg-blue-500/10 text-blue-100",
    };
  }

  if (tone === "emerald") {
    return {
      border:
        "border-emerald-500/20",

      background:
        "bg-emerald-500/5",

      title:
        "text-emerald-200",

      button:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    };
  }

  if (tone === "amber") {
    return {
      border:
        "border-amber-500/20",

      background:
        "bg-amber-500/5",

      title:
        "text-amber-200",

      button:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",
    };
  }

  if (tone === "red") {
    return {
      border:
        "border-red-500/20",

      background:
        "bg-red-500/5",

      title:
        "text-red-200",

      button:
        "border-red-500/30 bg-red-500/10 text-red-100",
    };
  }

  return {
    border:
      "border-cyan-500/20",

    background:
      "bg-cyan-500/5",

    title:
      "text-cyan-200",

    button:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  };
}

function numberValue(
  value: unknown,
) {
  return typeof value ===
    "number"
    ? value
    : 0;
}

export default function WorkflowAutomationOperationsPage() {
  const [
    data,
    setData,
  ] =
    useState<OperationsData | null>(
      null,
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

  const [
    loadedAt,
    setLoadedAt,
  ] =
    useState<string | null>(
      null,
    );

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
          const responses =
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
                "/api/recruiter/workflow/automation-approval-history",
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
                "/api/recruiter/workflow/execution-plan?limit=500",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/recruiter/workflow/execution-audit-preview?limit=500",
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
                "/api/recruiter/workflow/execution-release-gate?limit=500",
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const results =
            await Promise.all(
              responses.map(
                (response) =>
                  response.json(),
              ),
            );

          const failedIndex =
            responses.findIndex(
              (response) =>
                !response.ok,
            );

          if (
            failedIndex >= 0
          ) {
            throw new Error(
              results[
                failedIndex
              ]?.error ||
                "Unable to load workflow operations data",
            );
          }

          setData({
            automation:
              results[0],

            decisions:
              results[1],

            history:
              results[2],

            readiness:
              results[3],

            plans:
              results[4],

            audit:
              results[5],

            simulation:
              results[6],

            releaseGate:
              results[7],
          });

          setLoadedAt(
            new Date().toISOString(),
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load workflow operations dashboard",
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

  const sections =
    useMemo<
      OperationsSection[]
    >(
      () => {
        if (!data) {
          return [];
        }

        return [
          {
            title:
              "Automation proposals",

            description:
              "Current deterministic workflow recommendations generated from candidate state, SLA, and enabled automation rules.",

            href:
              "/recruiter/workflow/automation",

            tone:
              "cyan",

            metrics: [
              {
                label:
                  "Total",

                value:
                  numberValue(
                    data.automation
                      .summary.total,
                  ),
              },

              {
                label:
                  "Critical",

                value:
                  numberValue(
                    data.automation
                      .summary.critical,
                  ),
              },

              {
                label:
                  "High",

                value:
                  numberValue(
                    data.automation
                      .summary.high,
                  ),
              },
            ],
          },

          {
            title:
              "Approval queue",

            description:
              "Recruiter decisions recorded for workflow proposals before readiness and release-gate evaluation.",

            href:
              "/recruiter/workflow/automation/approval",

            tone:
              "violet",

            metrics: [
              {
                label:
                  "Reviewed",

                value:
                  numberValue(
                    data.decisions
                      .summary.total,
                  ),
              },

              {
                label:
                  "Approved",

                value:
                  numberValue(
                    data.decisions
                      .summary.approved,
                  ),
              },

              {
                label:
                  "Rejected",

                value:
                  numberValue(
                    data.decisions
                      .summary.rejected,
                  ),
              },
            ],
          },

          {
            title:
              "Approval history",

            description:
              "Immutable review timeline containing previous and current decisions, reviewer details, reasons, and timestamps.",

            href:
              "/recruiter/workflow/automation/history",

            tone:
              "fuchsia",

            metrics: [
              {
                label:
                  "Events",

                value:
                  numberValue(
                    data.history
                      .summary.total,
                  ),
              },

              {
                label:
                  "Deferred",

                value:
                  numberValue(
                    data.history
                      .summary.deferred,
                  ),
              },

              {
                label:
                  "Proposals",

                value:
                  numberValue(
                    data.history
                      .summary
                      .proposalsAffected,
                  ),
              },
            ],
          },

          {
            title:
              "Execution readiness",

            description:
              "Safety validation that checks decision state, proposal freshness, candidate state, and execution eligibility.",

            href:
              "/recruiter/workflow/automation",

            tone:
              "blue",

            metrics: [
              {
                label:
                  "Total",

                value:
                  numberValue(
                    data.readiness
                      .summary.total,
                  ),
              },

              {
                label:
                  "Ready",

                value:
                  numberValue(
                    data.readiness
                      .summary.ready,
                  ),
              },

              {
                label:
                  "Blocked",

                value:
                  numberValue(
                    data.readiness
                      .summary.blocked,
                  ),
              },
            ],
          },

          {
            title:
              "Execution plans",

            description:
              "Preview-only ordered execution steps generated for proposals that have passed the readiness gate.",

            href:
              "/recruiter/workflow/automation",

            tone:
              "emerald",

            metrics: [
              {
                label:
                  "Plans",

                value:
                  numberValue(
                    data.plans
                      .summary.plansCreated,
                  ),
              },

              {
                label:
                  "Skipped",

                value:
                  numberValue(
                    data.plans
                      .summary.skippedItems,
                  ),
              },

              {
                label:
                  "Execution enabled",

                value:
                  numberValue(
                    data.plans
                      .summary.executionEnabled,
                  ),
              },
            ],
          },

          {
            title:
              "Audit previews",

            description:
              "Checksum-protected execution evidence produced before any release or workflow mutation is permitted.",

            href:
              "/recruiter/workflow/automation",

            tone:
              "amber",

            metrics: [
              {
                label:
                  "Previews",

                value:
                  numberValue(
                    data.audit
                      .summary.auditPreviews,
                  ),
              },

              {
                label:
                  "Unmatched",

                value:
                  numberValue(
                    data.audit
                      .summary.unmatchedItems,
                  ),
              },

              {
                label:
                  "Audit writes",

                value:
                  numberValue(
                    data.audit
                      .summary.auditWrites,
                  ),
              },
            ],
          },

          {
            title:
              "Dry-run simulations",

            description:
              "Deterministic simulation of execution steps with zero candidate, workflow, audit, or email writes.",

            href:
              "/recruiter/workflow/automation/simulator",

            tone:
              "emerald",

            metrics: [
              {
                label:
                  "Simulations",

                value:
                  numberValue(
                    data.simulation
                      .summary
                      .simulationsCreated,
                  ),
              },

              {
                label:
                  "Skipped",

                value:
                  numberValue(
                    data.simulation
                      .summary.skippedPreviews,
                  ),
              },

              {
                label:
                  "DB writes",

                value:
                  numberValue(
                    data.simulation
                      .summary
                      .candidateDbWrites,
                  ),
              },
            ],
          },

          {
            title:
              "Execution release gate",

            description:
              "Final checksum, readiness, freshness, audit, simulation, and lock verification before any future release.",

            href:
              "/recruiter/workflow/automation/release-gate",

            tone:
              data.releaseGate
                .summary.blocked >
              0
                ? "red"
                : "amber",

            metrics: [
              {
                label:
                  "Gate items",

                value:
                  numberValue(
                    data.releaseGate
                      .summary.gateItems,
                  ),
              },

              {
                label:
                  "Blocked",

                value:
                  numberValue(
                    data.releaseGate
                      .summary.blocked,
                  ),
              },

              {
                label:
                  "Locked",

                value:
                  numberValue(
                    data.releaseGate
                      .summary.locked,
                  ),
              },
            ],
          },
        ];
      },
      [
        data,
      ],
    );

  const safetyMetrics =
    useMemo(
      () => {
        if (!data) {
          return [];
        }

        return [
          {
            label:
              "Candidate DB writes",

            value:
              data.releaseGate
                .summary
                .candidateDbWrites,
          },

          {
            label:
              "Workflow writes",

            value:
              data.releaseGate
                .summary
                .workflowWrites,
          },

          {
            label:
              "Audit writes",

            value:
              data.releaseGate
                .summary
                .auditWrites,
          },

          {
            label:
              "Email sends",

            value:
              data.releaseGate
                .summary
                .emailSends,
          },

          {
            label:
              "Releases",

            value:
              data.releaseGate
                .summary
                .releasesPerformed,
          },
        ];
      },
      [
        data,
      ],
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070A] p-6 text-slate-300">
        Loading workflow operations dashboard...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Operations Dashboard
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Monitor proposals, recruiter decisions, readiness, execution plans, audit evidence, dry-run simulations, and the final release gate from one read-only dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200"
              href="/recruiter/workflow"
            >
              Workflow home
            </Link>

            <Link
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              href="/recruiter/workflow/automation"
            >
              Automation
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
                : "Refresh dashboard"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-200">
                Platform safety
              </div>

              <h2 className="mt-2 text-xl font-semibold text-white">
                Execution remains disabled
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                All operations displayed below are proposal, review, audit, simulation, or release-gate previews only.
              </p>
            </div>

            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-100">
              Read only
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {safetyMetrics.map(
              (metric) => (
                <div
                  className="rounded-lg border border-slate-800 bg-[#05070A] p-3"
                  key={
                    metric.label
                  }
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {metric.label}
                  </div>

                  <div className="mt-1 text-xl font-semibold text-white">
                    {metric.value}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {sections.map(
            (section) => {
              const tone =
                sectionTone(
                  section.tone,
                );

              return (
                <article
                  className={`rounded-xl border p-5 ${tone.border} ${tone.background}`}
                  key={
                    section.title
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`text-lg font-semibold ${tone.title}`}
                      >
                        {section.title}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {section.description}
                      </p>
                    </div>

                    <Link
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tone.button}`}
                      href={
                        section.href
                      }
                    >
                      Open
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {section.metrics.map(
                      (metric) => (
                        <div
                          className="rounded-lg border border-slate-800 bg-[#05070A] p-3"
                          key={
                            metric.label
                          }
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            {metric.label}
                          </div>

                          <div className="mt-1 text-xl font-semibold text-white">
                            {metric.value}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </article>
              );
            },
          )}
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-[#090C11] p-5">
          <h2 className="text-lg font-semibold text-white">
            Operations navigation
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Manage rules",
                "/recruiter/workflow/automation/rules",
              ],

              [
                "Approval queue",
                "/recruiter/workflow/automation/approval",
              ],

              [
                "Batch review",
                "/recruiter/workflow/automation/approval/batch",
              ],

              [
                "Approval history",
                "/recruiter/workflow/automation/history",
              ],

              [
                "Dry-run simulator",
                "/recruiter/workflow/automation/simulator",
              ],

              [
                "Release gate",
                "/recruiter/workflow/automation/release-gate",
              ],

              [
                "Workflow analytics",
                "/recruiter/workflow/analytics",
              ],

              [
                "SLA dashboard",
                "/recruiter/workflow/sla",
              ],
            ].map(
              ([
                label,
                href,
              ]) => (
                <Link
                  className="rounded-lg border border-slate-800 bg-[#05070A] p-4 text-sm font-semibold text-slate-200 hover:border-slate-600"
                  href={href}
                  key={label}
                >
                  {label}
                </Link>
              ),
            )}
          </div>
        </section>

        <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs leading-6 text-slate-400">
          Operations dashboard only Ã‚Â· Candidate DB writes: 0 Ã‚Â· Workflow writes: 0 Ã‚Â· Audit writes: 0 Ã‚Â· Email sends: 0 Ã‚Â· Releases performed: 0 Ã‚Â· Execution enabled: false
          {loadedAt
            ? ` Ã‚Â· Refreshed at: ${loadedAt}`
            : ""}
        </div>
      </div>
    </main>
  );
}