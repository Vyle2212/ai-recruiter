"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationProposal,
} from "@/lib/recruiterWorkflowAutomationRules";
import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionFile,
} from "@/lib/recruiterWorkflowAutomationDecisions";
import {
  WorkflowAutomationDecisionControls,
} from "./WorkflowAutomationDecisionControls";
import {
  WorkflowExecutionPreviewPanel,
} from "./WorkflowExecutionPreviewPanel";
import {
  WorkflowExecutionReadinessPanel,
} from "./WorkflowExecutionReadinessPanel";
import {
  WorkflowExecutionPlanPanel,
} from "./WorkflowExecutionPlanPanel";
import {
  WorkflowExecutionSimulationPanel,
} from "./WorkflowExecutionSimulationPanel";

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function readable(value: string) {
  return value.replace(/_/g, " ");
}

function priorityTone(
  priority:
    RecruiterWorkflowAutomationProposal["priority"],
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

export default function WorkflowAutomationPage() {
  const [data, setData] =
    useState<RecruiterWorkflowAutomationPreview | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [priority, setPriority] =
    useState("all");

  const [decisions, setDecisions] =
    useState<Record<string, WorkflowAutomationDecision>>({});

  const [decisionSummary, setDecisionSummary] =
    useState<WorkflowAutomationDecisionFile["summary"] | null>(
      null,
    );

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/recruiter/workflow/automation-preview?limit=500",
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
              "Unable to load automation preview",
          );
        }

        setData(result);

        const decisionResponse =
          await fetch(
            "/api/recruiter/workflow/automation-decisions",
            {
              signal:
                controller.signal,
            },
          );

        const decisionResult =
          await decisionResponse.json();

        if (!decisionResponse.ok) {
          throw new Error(
            decisionResult.error ||
              "Unable to load automation decisions",
          );
        }

        const decisionMap =
          Object.fromEntries(
            decisionResult.decisions.map(
              (
                item: WorkflowAutomationDecision,
              ) => [
                item.proposalId,
                item,
              ],
            ),
          );

        setDecisions(
          decisionMap,
        );

        setDecisionSummary(
          decisionResult.summary,
        );
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
            : "Unable to load automation preview",
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

  function handleDecisionSaved(
    decision: WorkflowAutomationDecision,
  ) {
    setDecisions((current) => ({
      ...current,
      [decision.proposalId]:
        decision,
    }));

    setDecisionSummary((current) => {
      const next =
        Object.values({
          ...decisions,
          [decision.proposalId]:
            decision,
        });

      return {
        total:
          next.length,

        approved:
          next.filter(
            (item) =>
              item.decision === "approved",
          ).length,

        rejected:
          next.filter(
            (item) =>
              item.decision === "rejected",
          ).length,

        deferred:
          next.filter(
            (item) =>
              item.decision === "deferred",
          ).length,

        executed: 0,
      };
    });
  }

  function handleDecisionCleared(
    proposalId: string,
  ) {
    setDecisions((current) => {
      const next = {
        ...current,
      };

      delete next[
        proposalId
      ];

      setDecisionSummary({
        total:
          Object.values(next).length,

        approved:
          Object.values(next).filter(
            (item) =>
              item.decision === "approved",
          ).length,

        rejected:
          Object.values(next).filter(
            (item) =>
              item.decision === "rejected",
          ).length,

        deferred:
          Object.values(next).filter(
            (item) =>
              item.decision === "deferred",
          ).length,

        executed: 0,
      });

      return next;
    });
  }
  const proposals =
    useMemo(
      () =>
        (data?.proposals || []).filter(
          (item) =>
            priority === "all" ||
            item.priority === priority,
        ),
      [data, priority],
    );

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-7">
        <div className="mx-auto max-w-[1450px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">
                  Workflow Automation Preview
                </h1>

                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                  Preview only
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Proposed recruiter actions generated from lifecycle,
                SLA, reminder, and rollback rules.
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
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              href="/recruiter/workflow/automation/rules"
            >
              Manage rules
            </Link>
            <Link
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100"
              href="/recruiter/workflow/automation/simulator"
            >
              Open simulator
            </Link>
            <Link
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100"
              href="/recruiter/workflow/automation/approval"
            >
              Approval queue
            </Link>

              <Link
                className="rounded-md border border-amber-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-100"
                href="/recruiter/workflow/sla"
              >
                SLA
              </Link>

              <Link
                className="rounded-md border border-violet-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-100"
                href="/recruiter/workflow/timeline"
              >
                Timeline
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1450px] space-y-6 px-6 py-7">
        {loading ? (
          <section className={card}>
            Loading automation proposals...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            {decisionSummary ? (
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Reviewed", decisionSummary.total, "text-white"],
                  ["Approved", decisionSummary.approved, "text-emerald-200"],
                  ["Rejected", decisionSummary.rejected, "text-red-200"],
                  ["Deferred", decisionSummary.deferred, "text-amber-200"],
                  ["Executed", decisionSummary.executed, "text-slate-400"],
                ].map(([label, value, tone]) => (
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
                ))}
              </section>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["Total", data.summary.total, "text-white"],
                ["Critical", data.summary.critical, "text-red-200"],
                ["High", data.summary.high, "text-amber-200"],
                ["Medium", data.summary.medium, "text-cyan-100"],
                [
                  "Candidates",
                  data.summary.candidatesAffected,
                  "text-violet-100",
                ],
                [
                  "Rules triggered",
                  data.summary.rulesTriggered,
                  "text-emerald-200",
                ],
              ].map(([label, value, tone]) => (
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
              ))}
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-white">
                    Proposed actions
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    No proposal is executed automatically.
                  </p>
                </div>

                <select
                  className="rounded-md border border-slate-700 bg-[#070A0F] px-3 py-2 text-sm text-slate-200"
                  onChange={(event) =>
                    setPriority(
                      event.target.value,
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
              </div>

              <div className="mt-5 space-y-4">
                {proposals.length ? (
                  proposals.map((item) => (
                    <article
                      className="rounded-xl border border-slate-800 bg-[#070A0F] p-5"
                      key={item.proposalId}
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

                          <p className="mt-1 text-sm text-cyan-100">
                            {item.candidateName}
                          </p>
                        </div>

                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">
                          Recruiter approval required
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {item.description}
                      </p>

                      <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          Rule
                          <div className="mt-1 text-slate-300">
                            {readable(item.ruleId)}
                          </div>
                        </div>

                        <div>
                          Current stage
                          <div className="mt-1 text-slate-300">
                            {readable(
                              item.currentStage,
                            )}
                          </div>
                        </div>

                        <div>
                          Proposed action
                          <div className="mt-1 text-cyan-100">
                            {readable(
                              item.proposedAction,
                            )}
                          </div>
                        </div>

                        <div>
                          Automatic execution
                          <div className="mt-1 text-emerald-200">
                            disabled
                          </div>
                        </div>
                      </div>

                      <WorkflowAutomationDecisionControls
                        decision={
                          decisions[
                            item.proposalId
                          ] || null
                        }
                        onDecisionCleared={
                          handleDecisionCleared
                        }
                        onDecisionSaved={
                          handleDecisionSaved
                        }
                        proposal={item}
                      />

                      <WorkflowExecutionPreviewPanel
                        approved={
                          decisions[
                            item.proposalId
                          ]?.decision ===
                          "approved"
                        }
                        proposalId={
                          item.proposalId
                        }
                      />

                      <WorkflowExecutionReadinessPanel
                        approved={
                          decisions[
                            item.proposalId
                          ]?.decision ===
                          "approved"
                        }
                        proposalId={
                          item.proposalId
                        }
                      />

                      <WorkflowExecutionPlanPanel
                        approved={
                          decisions[
                            item.proposalId
                          ]?.decision ===
                          "approved"
                        }
                        proposalId={
                          item.proposalId
                        }
                      />

                      <WorkflowExecutionSimulationPanel
                        approved={
                          decisions[
                            item.proposalId
                          ]?.decision ===
                          "approved"
                        }
                        proposalId={
                          item.proposalId
                        }
                      />

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <Link
                          className="text-sm font-semibold text-cyan-300"
                          href={item.href}
                        >
                          Review in Candidate360
                        </Link>

                        <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                          Preview only
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-sm text-slate-500">
                    No automation proposals match this filter.
                  </div>
                )}
              </div>
            </section>

            <section className={card}>
              <h2 className="font-semibold text-white">
                Active preview rules
              </h2>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {data.rules.map((rule) => (
                  <article
                    className="rounded-xl border border-slate-800 bg-[#070A0F] p-4"
                    key={rule.ruleId}
                  >
                    <div className="text-sm font-semibold text-slate-100">
                      {readable(rule.ruleId)}
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {rule.description}
                    </p>

                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">
                      Enabled ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Preview only
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-slate-300">
              Automatic actions:{" "}
              {data.safety.automaticActions}
              {" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· "}
              Candidate DB writes:{" "}
              {data.safety.candidateDbWrites}
              {" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· "}
              Workflow writes:{" "}
              {data.safety.workflowWrites}
              {" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· "}
              Email sends:{" "}
              {data.safety.emailSends}
              {" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· "}
              OpenAI calls:{" "}
              {data.safety.openAiCalls}
              {" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· "}
              Human approval: required
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}