"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  WorkflowAutomationRuleConfig,
  WorkflowAutomationRuleConfigFile,
} from "@/lib/recruiterWorkflowAutomationRuleConfig";
import type {
  RecruiterWorkflowAutomationPriority,
} from "@/lib/recruiterWorkflowAutomationRules";

const priorities:
  RecruiterWorkflowAutomationPriority[] = [
  "critical",
  "high",
  "medium",
  "low",
];

function readable(
  value: string,
) {
  return value.replace(/_/g, " ");
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

function settingLabel(
  rule:
    WorkflowAutomationRuleConfig,
) {
  if (
    rule.ruleId ===
    "overdue_follow_up"
  ) {
    return {
      key:
        "overdueEscalationDays" as const,

      label:
        "Escalation after",

      suffix:
        "days",

      value:
        rule.settings
          .overdueEscalationDays ||
        3,

      maximum:
        365,
    };
  }

  if (
    rule.ruleId ===
    "on_hold_review"
  ) {
    return {
      key:
        "onHoldReviewDays" as const,

      label:
        "Review after",

      suffix:
        "days",

      value:
        rule.settings
          .onHoldReviewDays ||
        14,

      maximum:
        365,
    };
  }

  if (
    rule.ruleId ===
    "repeated_rollback_review"
  ) {
    return {
      key:
        "rollbackThreshold" as const,

      label:
        "Rollback threshold",

      suffix:
        "events",

      value:
        rule.settings
          .rollbackThreshold ||
        2,

      maximum:
        100,
    };
  }

  return null;
}

export default function WorkflowAutomationRulesPage() {
  const [data, setData] =
    useState<WorkflowAutomationRuleConfigFile | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [savingRuleId, setSavingRuleId] =
    useState<string | null>(
      null,
    );

  const [resetting, setResetting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const loadRules =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/recruiter/workflow/automation-rules",
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
                "Unable to load automation rules",
            );
          }

          setData(result);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load automation rules",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    loadRules();
  }, [
    loadRules,
  ]);

  const sortedRules =
    useMemo(
      () =>
        [...(data?.rules || [])].sort(
          (left, right) =>
            left.ruleId.localeCompare(
              right.ruleId,
            ),
        ),
      [
        data,
      ],
    );

  async function saveRule(
    rule:
      WorkflowAutomationRuleConfig,
  ) {
    setSavingRuleId(
      rule.ruleId,
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/recruiter/workflow/automation-rules",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ruleId:
                  rule.ruleId,

                enabled:
                  rule.enabled,

                priority:
                  rule.priority,

                settings:
                  rule.settings,

                updatedBy:
                  "Recruiter",
              }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save automation rule",
        );
      }

      setData(
        result.file,
      );

      setMessage(
        `${readable(
          rule.ruleId,
        )} saved.`,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save automation rule",
      );
    } finally {
      setSavingRuleId(
        null,
      );
    }
  }

  async function resetRules() {
    setResetting(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/recruiter/workflow/automation-rules?updatedBy=Recruiter",
          {
            method:
              "DELETE",
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to reset automation rules",
        );
      }

      setData(result);

      setMessage(
        "Automation rules reset to defaults.",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset automation rules",
      );
    } finally {
      setResetting(false);
    }
  }

  function updateRule(
    ruleId: string,
    updater: (
      rule:
        WorkflowAutomationRuleConfig,
    ) =>
      WorkflowAutomationRuleConfig,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const rules =
        current.rules.map(
          (rule) =>
            rule.ruleId ===
            ruleId
              ? updater(rule)
              : rule,
        );

      return {
        ...current,

        rules,

        summary: {
          total:
            rules.length,

          enabled:
            rules.filter(
              (rule) =>
                rule.enabled,
            ).length,

          disabled:
            rules.filter(
              (rule) =>
                !rule.enabled,
            ).length,
        },
      };
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070A] p-6 text-slate-200">
        Loading workflow automation rules...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] px-4 py-6 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
              Workflow Automation
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Rule Management
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Configure which workflow rules are enabled and adjust their priority or thresholds. These settings only control proposal generation and do not execute workflow actions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
              href="/recruiter/workflow/automation"
            >
              Back to automation
            </Link>

            <button
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
              disabled={
                resetting ||
                savingRuleId !==
                  null
              }
              onClick={
                resetRules
              }
              type="button"
            >
              {resetting
                ? "Resetting..."
                : "Reset defaults"}
            </button>
          </div>
        </div>

        {data ? (
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [
                "Total rules",
                data.summary.total,
              ],
              [
                "Enabled",
                data.summary.enabled,
              ],
              [
                "Disabled",
                data.summary.disabled,
              ],
            ].map(
              ([label, value]) => (
                <article
                  className="rounded-xl border border-slate-800 bg-[#090C11] p-4"
                  key={String(label)}
                >
                  <div className="text-xs uppercase tracking-[0.1em] text-slate-500">
                    {label}
                  </div>

                  <div className="mt-2 text-2xl font-semibold text-white">
                    {value}
                  </div>
                </article>
              ),
            )}
          </section>
        ) : null}

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

        <section className="mt-6 space-y-4">
          {sortedRules.map(
            (rule) => {
              const setting =
                settingLabel(
                  rule,
                );

              const saving =
                savingRuleId ===
                rule.ruleId;

              return (
                <article
                  className="rounded-xl border border-slate-800 bg-[#090C11] p-5"
                  key={rule.ruleId}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold capitalize text-white">
                          {readable(
                            rule.ruleId,
                          )}
                        </h2>

                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${priorityTone(
                            rule.priority,
                          )}`}
                        >
                          {rule.priority}
                        </span>

                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                            rule.enabled
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                              : "border-slate-700 bg-slate-900 text-slate-400"
                          }`}
                        >
                          {rule.enabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {rule.description}
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                      <span>
                        Enabled
                      </span>

                      <input
                        checked={
                          rule.enabled
                        }
                        className="h-4 w-4 accent-cyan-500"
                        onChange={(
                          event,
                        ) =>
                          updateRule(
                            rule.ruleId,
                            (
                              current,
                            ) => ({
                              ...current,
                              enabled:
                                event
                                  .target
                                  .checked,
                            }),
                          )
                        }
                        type="checkbox"
                      />
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-slate-400">
                      Priority

                      <select
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-200 outline-none focus:border-cyan-500"
                        onChange={(
                          event,
                        ) =>
                          updateRule(
                            rule.ruleId,
                            (
                              current,
                            ) => ({
                              ...current,

                              priority:
                                event
                                  .target
                                  .value as RecruiterWorkflowAutomationPriority,
                            }),
                          )
                        }
                        value={
                          rule.priority
                        }
                      >
                        {priorities.map(
                          (
                            priority,
                          ) => (
                            <option
                              key={
                                priority
                              }
                              value={
                                priority
                              }
                            >
                              {priority}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    {setting ? (
                      <label className="text-sm text-slate-400">
                        {setting.label}

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            className="w-full rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-200 outline-none focus:border-cyan-500"
                            max={
                              setting.maximum
                            }
                            min={1}
                            onChange={(
                              event,
                            ) =>
                              updateRule(
                                rule.ruleId,
                                (
                                  current,
                                ) => ({
                                  ...current,

                                  settings: {
                                    ...current.settings,

                                    [setting.key]:
                                      Math.max(
                                        1,
                                        Math.min(
                                          Number(
                                            event
                                              .target
                                              .value,
                                          ) ||
                                            1,
                                          setting.maximum,
                                        ),
                                      ),
                                  },
                                }),
                              )
                            }
                            type="number"
                            value={
                              setting.value
                            }
                          />

                          <span className="text-xs text-slate-500">
                            {setting.suffix}
                          </span>
                        </div>
                      </label>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-800 p-3 text-sm text-slate-500">
                        No configurable threshold for this rule.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      Updated:{" "}
                      {rule.updatedAt}
                      {" · "}
                      Updated by:{" "}
                      {rule.updatedBy ||
                        "System default"}
                    </div>

                    <button
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
                      disabled={
                        saving ||
                        resetting ||
                        savingRuleId !==
                          null
                      }
                      onClick={() =>
                        saveRule(
                          rule,
                        )
                      }
                      type="button"
                    >
                      {saving
                        ? "Saving..."
                        : "Save rule"}
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </section>

        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-6 text-slate-400">
          Configuration only · Candidate DB writes: 0 · Workflow writes: 0 · Email sends: 0 · Automatic execution: disabled
        </div>
      </div>
    </main>
  );
}