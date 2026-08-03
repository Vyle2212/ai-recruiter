import type {
  RecruiterCopilotContext,
  RecruiterCopilotCandidatePriority,
} from "./recruiterCopilotContext";

export type RecruiterCopilotIntent =
  | "today_priorities"
  | "overdue_followups"
  | "pipeline_bottleneck"
  | "top_recruiter"
  | "candidate_priority"
  | "workflow_health"
  | "unknown";

export type RecruiterCopilotEvidence = {
  evidenceId: string;
  label: string;
  value: string | number | boolean | null;
  source:
    | "context_summary"
    | "priority_candidates"
    | "workflow_insights"
    | "workflow_analytics"
    | "activity_feed";
};

export type RecruiterCopilotSuggestedAction = {
  actionId: string;
  label: string;
  href: string;
  priority: "high" | "medium" | "low";
  candidateId?: string;
};

export type RecruiterCopilotAnswer = {
  question: string;
  normalizedQuestion: string;
  intent: RecruiterCopilotIntent;
  confidence: number;
  title: string;
  answer: string;
  evidence: RecruiterCopilotEvidence[];
  suggestedActions: RecruiterCopilotSuggestedAction[];
  generatedAt: string;
  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    deterministic: true;
    readOnly: true;
  };
  mode: string;
};

export type RecruiterCopilotAnswerOptions = {
  generatedAt?: string;
};

type IntentMatch = {
  intent: RecruiterCopilotIntent;
  confidence: number;
};

function normalizeQuestion(question: string) {
  return question
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ");
}

function containsAny(
  value: string,
  terms: string[],
) {
  return terms.some((term) =>
    value.includes(term),
  );
}

export function detectRecruiterCopilotIntent(
  question: string,
): IntentMatch {
  const normalized =
    normalizeQuestion(question);

  if (!normalized) {
    return {
      intent: "unknown",
      confidence: 0,
    };
  }

  if (
    containsAny(normalized, [
      "what should i focus on today",
      "what needs attention today",
      "priority today",
      "today priorities",
      "today priority",
      "focus today",
      "do today",
      "cáº§n lÃ m gÃ¬ hÃ´m nay",
      "Æ°u tiÃªn hÃ´m nay",
      "hÃ´m nay cáº§n lÃ m gÃ¬",
    ])
  ) {
    return {
      intent: "today_priorities",
      confidence: 0.98,
    };
  }

  if (
    containsAny(normalized, [
      "overdue",
      "late follow up",
      "late follow-up",
      "past due",
      "quÃ¡ háº¡n",
      "follow up trá»…",
      "follow-up trá»…",
    ])
  ) {
    return {
      intent: "overdue_followups",
      confidence: 0.96,
    };
  }

  if (
    containsAny(normalized, [
      "bottleneck",
      "slowest stage",
      "stuck stage",
      "aging stage",
      "pipeline issue",
      "stage nÃ o cháº­m",
      "Ä‘iá»ƒm ngháº½n",
      "táº¯c á»Ÿ Ä‘Ã¢u",
    ])
  ) {
    return {
      intent: "pipeline_bottleneck",
      confidence: 0.95,
    };
  }

  if (
    containsAny(normalized, [
      "top recruiter",
      "most activity",
      "best recruiter",
      "recruiter ranking",
      "active recruiter",
      "recruiter nÃ o",
      "ai hoáº¡t Ä‘á»™ng nhiá»u nháº¥t",
    ])
  ) {
    return {
      intent: "top_recruiter",
      confidence: 0.94,
    };
  }

  if (
    containsAny(normalized, [
      "which candidate",
      "candidate priority",
      "priority candidate",
      "review first",
      "who should i review",
      "candidate nÃ o",
      "á»©ng viÃªn nÃ o",
      "xem ai trÆ°á»›c",
      "Æ°u tiÃªn á»©ng viÃªn",
    ])
  ) {
    return {
      intent: "candidate_priority",
      confidence: 0.93,
    };
  }

  if (
    containsAny(normalized, [
      "workflow health",
      "pipeline health",
      "how is workflow",
      "how is the pipeline",
      "overall status",
      "workflow status",
      "tÃ¬nh hÃ¬nh workflow",
      "tÃ¬nh tráº¡ng pipeline",
      "workflow tháº¿ nÃ o",
    ])
  ) {
    return {
      intent: "workflow_health",
      confidence: 0.92,
    };
  }

  return {
    intent: "unknown",
    confidence: 0.35,
  };
}

function readableAction(value: string) {
  return value.replace(/_/g, " ");
}

function readableStage(value: string) {
  return value.replace(/_/g, " ");
}

function candidateAction(
  candidate: RecruiterCopilotCandidatePriority,
): RecruiterCopilotSuggestedAction {
  return {
    actionId:
      `copilot:candidate:${candidate.candidateId}`,
    label:
      `Review ${candidate.candidateName}`,
    href:
      `/recruiter/candidate360/${encodeURIComponent(
        candidate.candidateId,
      )}`,
    priority:
      candidate.effectivePriority,
    candidateId:
      candidate.candidateId,
  };
}

function answerTodayPriorities(
  context: RecruiterCopilotContext,
) {
  const overdue =
    context.summary.overdueFollowUps;

  const dueToday =
    context.summary.dueToday;

  const highPriority =
    context.summary.highPriority;

  const candidates =
    context.priorityCandidates.slice(0, 5);

  const parts: string[] = [];

  if (overdue > 0) {
    parts.push(
      `${overdue} overdue follow-up${
        overdue === 1 ? "" : "s"
      }`,
    );
  }

  if (dueToday > 0) {
    parts.push(
      `${dueToday} action${
        dueToday === 1 ? "" : "s"
      } due today`,
    );
  }

  if (highPriority > 0) {
    parts.push(
      `${highPriority} high-priority workflow${
        highPriority === 1 ? "" : "s"
      }`,
    );
  }

  const answer =
    parts.length > 0
      ? `Focus first on ${parts.join(
          ", ",
        )}. ${
          candidates.length > 0
            ? `The first candidate to review is ${candidates[0].candidateName}: ${candidates[0].reminderLabel}, next action ${readableAction(
                candidates[0].nextAction,
              )}.`
            : ""
        }`
      : "There are no overdue or due-today workflow actions. Review scheduled follow-ups and pipeline bottlenecks next.";

  return {
    title: "Todayâ€™s workflow priorities",
    answer,
    evidence: [
      {
        evidenceId:
          "today:overdue",
        label:
          "Overdue follow-ups",
        value: overdue,
        source:
          "context_summary" as const,
      },
      {
        evidenceId:
          "today:due",
        label:
          "Due today",
        value: dueToday,
        source:
          "context_summary" as const,
      },
      {
        evidenceId:
          "today:high-priority",
        label:
          "High priority",
        value: highPriority,
        source:
          "context_summary" as const,
      },
    ],
    suggestedActions: [
      ...candidates
        .slice(0, 3)
        .map(candidateAction),
      {
        actionId:
          "copilot:open-workflow",
        label:
          "Open workflow board",
        href:
          "/recruiter/workflow",
        priority:
          overdue > 0
            ? "high"
            : "medium",
      },
    ],
  };
}

function answerOverdueFollowups(
  context: RecruiterCopilotContext,
) {
  const overdueCandidates =
    context.priorityCandidates
      .filter(
        (candidate) =>
          candidate.dueStatus ===
          "overdue",
      )
      .slice(0, 10);

  const count =
    context.summary.overdueFollowUps;

  const first =
    overdueCandidates[0];

  return {
    title:
      `${count} overdue follow-up${
        count === 1 ? "" : "s"
      }`,
    answer:
      count === 0
        ? "No overdue candidate follow-ups were detected."
        : `${count} candidate follow-up${
            count === 1 ? " is" : "s are"
          } overdue. ${
            first
              ? `Review ${first.candidateName} first: ${first.reminderLabel}, current stage ${readableStage(
                  first.stage,
                )}, next action ${readableAction(
                  first.nextAction,
                )}.`
              : ""
          }`,
    evidence: [
      {
        evidenceId:
          "overdue:count",
        label:
          "Overdue follow-ups",
        value: count,
        source:
          "context_summary" as const,
      },
      ...overdueCandidates
        .slice(0, 3)
        .map((candidate) => ({
          evidenceId:
            `overdue:${candidate.candidateId}`,
          label:
            candidate.candidateName,
          value:
            candidate.reminderLabel,
          source:
            "priority_candidates" as const,
        })),
    ],
    suggestedActions:
      overdueCandidates.length > 0
        ? overdueCandidates
            .slice(0, 5)
            .map(candidateAction)
        : [
            {
              actionId:
                "copilot:workflow",
              label:
                "Open workflow board",
              href:
                "/recruiter/workflow",
              priority:
                "low" as const,
            },
          ],
  };
}

function answerPipelineBottleneck(
  context: RecruiterCopilotContext,
) {
  const bottleneck =
    context.insights.bottlenecks[0];

  if (!bottleneck) {
    return {
      title:
        "No major pipeline bottleneck detected",
      answer:
        "No lifecycle stage currently exceeds the configured aging thresholds.",
      evidence: [
        {
          evidenceId:
            "bottleneck:none",
          label:
            "Detected bottlenecks",
          value: 0,
          source:
            "workflow_insights" as const,
        },
      ],
      suggestedActions: [
        {
          actionId:
            "copilot:analytics",
          label:
            "Open workflow analytics",
          href:
            "/recruiter/workflow/analytics",
          priority:
            "low" as const,
        },
      ],
    };
  }

  return {
    title:
      `${readableStage(
        bottleneck.stage,
      )} is the largest bottleneck`,
    answer:
      `${bottleneck.candidateCount} candidate${
        bottleneck.candidateCount === 1
          ? " is"
          : "s are"
      } in this stage. Average age is ${bottleneck.averageDays} days and the maximum is ${bottleneck.maximumDays} days.`,
    evidence: [
      {
        evidenceId:
          "bottleneck:stage",
        label:
          "Stage",
        value:
          readableStage(
            bottleneck.stage,
          ),
        source:
          "workflow_insights" as const,
      },
      {
        evidenceId:
          "bottleneck:candidates",
        label:
          "Candidates",
        value:
          bottleneck.candidateCount,
        source:
          "workflow_insights" as const,
      },
      {
        evidenceId:
          "bottleneck:average",
        label:
          "Average days",
        value:
          bottleneck.averageDays,
        source:
          "workflow_analytics" as const,
      },
      {
        evidenceId:
          "bottleneck:maximum",
        label:
          "Maximum days",
        value:
          bottleneck.maximumDays,
        source:
          "workflow_analytics" as const,
      },
    ],
    suggestedActions: [
      {
        actionId:
          "copilot:bottleneck-workflow",
        label:
          "Review workflow board",
        href:
          "/recruiter/workflow",
        priority:
          bottleneck.severity ===
          "critical"
            ? "high"
            : "medium",
      },
      {
        actionId:
          "copilot:bottleneck-analytics",
        label:
          "Open lifecycle analytics",
        href:
          "/recruiter/workflow/analytics",
        priority:
          "medium",
      },
    ],
  };
}

function answerTopRecruiter(
  context: RecruiterCopilotContext,
) {
  const recruiter =
    context.insights.recruiterRanking[0];

  if (!recruiter) {
    return {
      title:
        "No recruiter activity recorded",
      answer:
        "Lifecycle history does not currently contain recruiter actor activity.",
      evidence: [
        {
          evidenceId:
            "recruiter:none",
          label:
            "Recruiters with activity",
          value: 0,
          source:
            "activity_feed" as const,
        },
      ],
      suggestedActions: [
        {
          actionId:
            "copilot:activity",
          label:
            "Open workflow analytics",
          href:
            "/recruiter/workflow/analytics",
          priority:
            "low" as const,
        },
      ],
    };
  }

  return {
    title:
      `${recruiter.actorLabel} has the most recorded activity`,
    answer:
      `${recruiter.actorLabel} has ${recruiter.activityCount} activities, including ${recruiter.transitionCount} transitions and ${recruiter.rollbackCount} rollbacks.`,
    evidence: [
      {
        evidenceId:
          "recruiter:name",
        label:
          "Recruiter",
        value:
          recruiter.actorLabel,
        source:
          "activity_feed" as const,
      },
      {
        evidenceId:
          "recruiter:activities",
        label:
          "Activities",
        value:
          recruiter.activityCount,
        source:
          "activity_feed" as const,
      },
      {
        evidenceId:
          "recruiter:transitions",
        label:
          "Transitions",
        value:
          recruiter.transitionCount,
        source:
          "activity_feed" as const,
      },
      {
        evidenceId:
          "recruiter:rollbacks",
        label:
          "Rollbacks",
        value:
          recruiter.rollbackCount,
        source:
          "activity_feed" as const,
      },
    ],
    suggestedActions: [
      {
        actionId:
          "copilot:recruiter-analytics",
        label:
          "Review recruiter analytics",
        href:
          "/recruiter/workflow/analytics",
        priority:
          "low",
      },
    ],
  };
}

function answerCandidatePriority(
  context: RecruiterCopilotContext,
) {
  const candidates =
    context.priorityCandidates.slice(0, 5);

  if (!candidates.length) {
    return {
      title:
        "No candidate currently requires urgent attention",
      answer:
        "There are no non-terminal candidates marked overdue, due today, or due soon.",
      evidence: [
        {
          evidenceId:
            "candidate-priority:none",
          label:
            "Priority candidates",
          value: 0,
          source:
            "priority_candidates" as const,
        },
      ],
      suggestedActions: [
        {
          actionId:
            "copilot:workflow",
          label:
            "Open workflow board",
          href:
            "/recruiter/workflow",
          priority:
            "low" as const,
        },
      ],
    };
  }

  const first = candidates[0];

  return {
    title:
      `Review ${first.candidateName} first`,
    answer:
      `${first.candidateName} is ${first.reminderLabel.toLowerCase()}, is currently ${first.effectivePriority} priority, and the next action is ${readableAction(
        first.nextAction,
      )}.`,
    evidence:
      candidates.map(
        (candidate, index) => ({
          evidenceId:
            `candidate-priority:${candidate.candidateId}`,
          label:
            `${index + 1}. ${candidate.candidateName}`,
          value:
            `${candidate.reminderLabel} Â· ${readableAction(
              candidate.nextAction,
            )}`,
          source:
            "priority_candidates" as const,
        }),
      ),
    suggestedActions:
      candidates.map(candidateAction),
  };
}

function answerWorkflowHealth(
  context: RecruiterCopilotContext,
) {
  const summary =
    context.summary;

  const unhealthy =
    summary.overdueFollowUps > 0 ||
    summary.attentionRequired > 0 ||
    context.insights.bottlenecks.length > 0;

  return {
    title:
      unhealthy
        ? "Workflow requires attention"
        : "Workflow health is stable",
    answer:
      `There are ${summary.activeCandidates} active candidates, ${summary.overdueFollowUps} overdue follow-ups, ${summary.dueToday} due today, ${summary.highPriority} high-priority workflows, and ${context.insights.bottlenecks.length} detected bottleneck${
        context.insights.bottlenecks.length === 1
          ? ""
          : "s"
      }.`,
    evidence: [
      {
        evidenceId:
          "health:active",
        label:
          "Active candidates",
        value:
          summary.activeCandidates,
        source:
          "context_summary" as const,
      },
      {
        evidenceId:
          "health:overdue",
        label:
          "Overdue",
        value:
          summary.overdueFollowUps,
        source:
          "context_summary" as const,
      },
      {
        evidenceId:
          "health:attention",
        label:
          "Attention required",
        value:
          summary.attentionRequired,
        source:
          "context_summary" as const,
      },
      {
        evidenceId:
          "health:bottlenecks",
        label:
          "Bottlenecks",
        value:
          context.insights.bottlenecks.length,
        source:
          "workflow_insights" as const,
      },
    ],
    suggestedActions: [
      {
        actionId:
          "copilot:health-analytics",
        label:
          "Open workflow analytics",
        href:
          "/recruiter/workflow/analytics",
        priority:
          unhealthy
            ? "high"
            : "low",
      },
    ],
  };
}

function answerUnknown(
  context: RecruiterCopilotContext,
) {
  return {
    title:
      "I can answer workflow questions",
    answer:
      "Try asking what needs attention today, how many follow-ups are overdue, where the biggest bottleneck is, which recruiter has the most activity, or which candidate should be reviewed first.",
    evidence: [
      {
        evidenceId:
          "unknown:active",
        label:
          "Active candidates",
        value:
          context.summary.activeCandidates,
        source:
          "context_summary" as const,
      },
    ],
    suggestedActions: [
      {
        actionId:
          "copilot:unknown-workflow",
        label:
          "Open workflow board",
        href:
          "/recruiter/workflow",
        priority:
          "low" as const,
      },
      {
        actionId:
          "copilot:unknown-analytics",
        label:
          "Open workflow analytics",
        href:
          "/recruiter/workflow/analytics",
        priority:
          "low" as const,
      },
    ],
  };
}

export function answerRecruiterCopilotQuestion(
  question: string,
  context: RecruiterCopilotContext,
  options: RecruiterCopilotAnswerOptions = {},
): RecruiterCopilotAnswer {
  const normalizedQuestion =
    normalizeQuestion(question);

  const match =
    detectRecruiterCopilotIntent(
      question,
    );

  const content =
    match.intent ===
    "today_priorities"
      ? answerTodayPriorities(context)
      : match.intent ===
          "overdue_followups"
        ? answerOverdueFollowups(
            context,
          )
        : match.intent ===
            "pipeline_bottleneck"
          ? answerPipelineBottleneck(
              context,
            )
          : match.intent ===
              "top_recruiter"
            ? answerTopRecruiter(
                context,
              )
            : match.intent ===
                "candidate_priority"
              ? answerCandidatePriority(
                  context,
                )
              : match.intent ===
                  "workflow_health"
                ? answerWorkflowHealth(
                    context,
                  )
                : answerUnknown(
                    context,
                  );

  return {
    question,
    normalizedQuestion,
    intent: match.intent,
    confidence:
      match.confidence,
    title: content.title,
    answer: content.answer,
    evidence:
      content.evidence,
    suggestedActions:
      content.suggestedActions.map(
        (
          action,
        ): RecruiterCopilotSuggestedAction => ({
          ...action,
          priority:
            action.priority as
              | "low"
              | "medium"
              | "high",
        }),
      ),
    generatedAt:
      options.generatedAt ||
      context.generatedAt,
    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      deterministic: true,
      readOnly: true,
    },
    mode:
      "deterministic recruiter Copilot answer generated from read-only Copilot context; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
  };
}