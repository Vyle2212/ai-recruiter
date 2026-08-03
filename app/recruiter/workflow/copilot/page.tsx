"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PIPELINE_STAGE_LABELS,
} from "@/lib/candidateLifecycleTypes";
import type {
  RecruiterWorkflowInsights,
  RecruiterWorkflowRecommendation,
} from "@/lib/recruiterWorkflowInsights";

type CopilotQuestion =
  | "attention_today"
  | "biggest_bottleneck"
  | "top_recruiter"
  | "overdue_count"
  | "review_first";

const QUESTIONS: Array<{
  id: CopilotQuestion;
  label: string;
}> = [
  {
    id: "attention_today",
    label: "What needs attention today?",
  },
  {
    id: "biggest_bottleneck",
    label: "Where is the biggest bottleneck?",
  },
  {
    id: "top_recruiter",
    label: "Which recruiter has the most activity?",
  },
  {
    id: "overdue_count",
    label: "How many overdue follow-ups are there?",
  },
  {
    id: "review_first",
    label: "What should I review first?",
  },
];

const card =
  "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";

function recommendationTone(
  severity: RecruiterWorkflowRecommendation["severity"],
) {
  if (severity === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (severity === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
}

function answerQuestion(
  question: CopilotQuestion,
  data: RecruiterWorkflowInsights,
) {
  if (question === "attention_today") {
    const total =
      data.summary.overdueFollowUps +
      data.summary.dueToday;

    if (total === 0) {
      return {
        title: "No urgent follow-ups today",
        body:
          "There are no overdue or due-today workflow actions.",
      };
    }

    return {
      title: `${total} workflow action${
        total === 1 ? "" : "s"
      } need attention`,
      body:
        `${data.summary.overdueFollowUps} overdue and ` +
        `${data.summary.dueToday} due today.`,
    };
  }

  if (question === "biggest_bottleneck") {
    const bottleneck = data.bottlenecks[0];

    if (!bottleneck) {
      return {
        title: "No major bottleneck detected",
        body:
          "No stage currently exceeds the configured aging thresholds.",
      };
    }

    return {
      title:
        `${PIPELINE_STAGE_LABELS[bottleneck.stage]} is the biggest bottleneck`,
      body:
        `${bottleneck.candidateCount} candidate${
          bottleneck.candidateCount === 1 ? "" : "s"
        } average ${bottleneck.averageDays} days, ` +
        `with a maximum of ${bottleneck.maximumDays} days.`,
    };
  }

  if (question === "top_recruiter") {
    const recruiter =
      data.recruiterRanking[0];

    if (!recruiter) {
      return {
        title: "No recruiter activity recorded",
        body:
          "Lifecycle history does not yet contain actor activity.",
      };
    }

    return {
      title:
        `${recruiter.actorLabel} has the most recorded activity`,
      body:
        `${recruiter.activityCount} activities, ` +
        `${recruiter.transitionCount} transitions, and ` +
        `${recruiter.rollbackCount} rollbacks.`,
    };
  }

  if (question === "overdue_count") {
    const count =
      data.summary.overdueFollowUps;

    return {
      title:
        `${count} overdue follow-up${count === 1 ? "" : "s"}`,
      body:
        count > 0
          ? "These should be reviewed before scheduled and due-soon actions."
          : "No overdue follow-ups were detected.",
    };
  }

  const recommendation =
    data.recommendations[0];

  if (!recommendation) {
    return {
      title: "No recommendation available",
      body:
        "The insights engine did not return a prioritized action.",
    };
  }

  return {
    title: recommendation.title,
    body: recommendation.description,
  };
}

export default function RecruiterWorkflowCopilotPage() {
  const [data, setData] =
    useState<RecruiterWorkflowInsights | null>(null);

  const [selectedQuestion, setSelectedQuestion] =
    useState<CopilotQuestion>("attention_today");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/recruiter/workflow/insights",
          {
            signal: controller.signal,
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load workflow insights",
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
            : "Unable to load workflow insights",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, []);

  const answer = useMemo(
    () =>
      data
        ? answerQuestion(selectedQuestion, data)
        : null,
    [data, selectedQuestion],
  );

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-7">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">
                  Recruiter Copilot
                </h1>

                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  Deterministic
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Answers workflow questions from persisted lifecycle
                insights. No OpenAI calls.
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
                className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-100"
                href="/recruiter/workflow/analytics"
              >
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-7">
        {loading ? (
          <section className={card}>
            Loading workflow insights...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <div className={card}>
                <h2 className="font-semibold text-white">
                  Quick questions
                </h2>

                <div className="mt-4 space-y-2">
                  {QUESTIONS.map((question) => (
                    <button
                      className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                        selectedQuestion === question.id
                          ? "border-cyan-400 bg-cyan-500/10 text-cyan-100"
                          : "border-slate-800 bg-[#070A0F] text-slate-300 hover:border-slate-600"
                      }`}
                      key={question.id}
                      onClick={() =>
                        setSelectedQuestion(question.id)
                      }
                      type="button"
                    >
                      {question.label}
                    </button>
                  ))}
                </div>
              </div>

              <section className={card}>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                  Copilot answer
                </div>

                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {answer?.title}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {answer?.body}
                </p>

                <div className="mt-5 rounded-lg border border-slate-800 bg-[#070A0F] p-4 text-xs text-slate-500">
                  Answer generated deterministically from workflow
                  insights. No language model was called.
                </div>
              </section>
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-white">
                  Recommended actions
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Prioritized by the workflow insights engine.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {data.recommendations.map((item) => (
                  <article className={card} key={item.recommendationId}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${recommendationTone(
                            item.severity,
                          )}`}
                        >
                          {item.severity}
                        </span>

                        <h3 className="mt-3 font-semibold text-white">
                          {item.title}
                        </h3>
                      </div>

                      <span className="text-2xl font-semibold text-cyan-100">
                        {item.metricValue}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-400">
                      {item.description}
                    </p>

                    <Link
                      className="mt-4 inline-block text-sm font-semibold text-cyan-300"
                      href={item.href}
                    >
                      {item.actionLabel}
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h2 className="font-semibold text-emerald-100">
                Safety
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                Candidate DB writes: {data.safety.candidateDbWrites}
                {" · "}
                Workflow writes: {data.safety.workflowWrites}
                {" · "}
                Email sends: {data.safety.emailSends}
                {" · "}
                OpenAI calls: {data.safety.openAiCalls}
                {" · "}
                Read only: {data.safety.readOnly ? "yes" : "no"}
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}