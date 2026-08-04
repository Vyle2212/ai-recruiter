import type {
  RecruiterCopilotCandidatePriority,
  RecruiterCopilotContext,
} from "./recruiterCopilotContext";

export type RecruiterCopilotSuggestionType =
  | "follow_up_overdue"
  | "complete_due_today"
  | "review_high_priority"
  | "resolve_bottleneck"
  | "review_rollback_rate"
  | "investigate_inactivity"
  | "workflow_healthy";

export type RecruiterCopilotSuggestionPriority =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type RecruiterCopilotSuggestion = {
  suggestionId: string;
  type: RecruiterCopilotSuggestionType;
  priority: RecruiterCopilotSuggestionPriority;

  title: string;
  description: string;

  candidateId: string | null;
  candidateName: string | null;

  stage: string | null;
  nextAction: string | null;
  dueAt: string | null;

  actionLabel: string;
  href: string;

  reason: string;
  evidence: Array<{
    label: string;
    value: string | number | boolean | null;
  }>;

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    requiresHumanAction: true;
  };
};

export type RecruiterCopilotSuggestionFeed = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    candidateSpecific: number;
  };

  suggestions: RecruiterCopilotSuggestion[];

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    automaticActions: 0;
    readOnly: true;
  };

  mode: string;
};

export type RecruiterCopilotSuggestionOptions = {
  limit?: number;
  includeHealthy?: boolean;
};

function readable(value: string) {
  return value.replace(/_/g, " ");
}

function priorityWeight(
  priority: RecruiterCopilotSuggestionPriority,
) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function candidateSuggestionPriority(
  candidate: RecruiterCopilotCandidatePriority,
): RecruiterCopilotSuggestionPriority {
  if (candidate.dueStatus === "overdue") {
    return "critical";
  }

  if (
    candidate.dueStatus === "today" ||
    candidate.effectivePriority === "high"
  ) {
    return "high";
  }

  if (candidate.dueStatus === "soon") {
    return "medium";
  }

  return "low";
}

function candidateSuggestionType(
  candidate: RecruiterCopilotCandidatePriority,
): RecruiterCopilotSuggestionType {
  if (candidate.dueStatus === "overdue") {
    return "follow_up_overdue";
  }

  if (candidate.dueStatus === "today") {
    return "complete_due_today";
  }

  return "review_high_priority";
}

function candidateSuggestion(
  candidate: RecruiterCopilotCandidatePriority,
): RecruiterCopilotSuggestion {
  const priority =
    candidateSuggestionPriority(candidate);

  const type =
    candidateSuggestionType(candidate);

  const title =
    type === "follow_up_overdue"
      ? `Follow up ${candidate.candidateName}`
      : type === "complete_due_today"
        ? `Complete today’s action for ${candidate.candidateName}`
        : `Review ${candidate.candidateName}`;

  return {
    suggestionId:
      `copilot-suggestion:${type}:${candidate.candidateId}`,
    type,
    priority,

    title,
    description:
      `${candidate.candidateName} is currently in ` +
      `${readable(candidate.stage)}. ` +
      `${candidate.reminderLabel}. ` +
      `Recommended next action: ${readable(candidate.nextAction)}.`,

    candidateId:
      candidate.candidateId,
    candidateName:
      candidate.candidateName,

    stage:
      candidate.stage,
    nextAction:
      candidate.nextAction,
    dueAt:
      candidate.dueAt,

    actionLabel:
      "Open Candidate360",
    href:
      `/recruiter/candidate360/${encodeURIComponent(
        candidate.candidateId,
      )}`,

    reason:
      candidate.reminderLabel,

    evidence: [
      {
        label:
          "Pipeline stage",
        value:
          readable(candidate.stage),
      },
      {
        label:
          "Due status",
        value:
          candidate.dueStatus,
      },
      {
        label:
          "Effective priority",
        value:
          candidate.effectivePriority,
      },
      {
        label:
          "Next action",
        value:
          readable(candidate.nextAction),
      },
      {
        label:
          "Due at",
        value:
          candidate.dueAt,
      },
    ],

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      requiresHumanAction: true,
    },
  };
}

function workflowSuggestions(
  context: RecruiterCopilotContext,
): RecruiterCopilotSuggestion[] {
  const suggestions:
    RecruiterCopilotSuggestion[] = [];

  const bottleneck =
    context.insights.bottlenecks[0];

  if (bottleneck) {
    suggestions.push({
      suggestionId:
        `copilot-suggestion:bottleneck:${bottleneck.stage}`,
      type:
        "resolve_bottleneck",
      priority:
        bottleneck.severity === "critical"
          ? "critical"
          : "high",

      title:
        `Resolve ${readable(
          bottleneck.stage,
        )} bottleneck`,

      description:
        `${bottleneck.candidateCount} candidate` +
        `${bottleneck.candidateCount === 1 ? " is" : "s are"} ` +
        `averaging ${bottleneck.averageDays} days in this stage. ` +
        `Maximum age is ${bottleneck.maximumDays} days.`,

      candidateId: null,
      candidateName: null,
      stage:
        bottleneck.stage,
      nextAction: null,
      dueAt: null,

      actionLabel:
        "Open workflow analytics",
      href:
        "/recruiter/workflow/analytics",

      reason:
        "Stage aging exceeds the configured workflow threshold.",

      evidence: [
        {
          label:
            "Candidate count",
          value:
            bottleneck.candidateCount,
        },
        {
          label:
            "Average days",
          value:
            bottleneck.averageDays,
        },
        {
          label:
            "Maximum days",
          value:
            bottleneck.maximumDays,
        },
      ],

      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        openAiCalls: 0,
        requiresHumanAction: true,
      },
    });
  }

  if (
    context.insights.analytics
      .rollbackRatePercentage >= 15
  ) {
    const rate =
      context.insights.analytics
        .rollbackRatePercentage;

    suggestions.push({
      suggestionId:
        "copilot-suggestion:rollback-rate",
      type:
        "review_rollback_rate",
      priority:
        rate >= 30
          ? "critical"
          : "high",

      title:
        "Review lifecycle rollback rate",

      description:
        `Workflow rollback rate is ${rate}%. ` +
        `${context.summary.rollbacks} rollback event` +
        `${context.summary.rollbacks === 1 ? "" : "s"} recorded.`,

      candidateId: null,
      candidateName: null,
      stage: null,
      nextAction: null,
      dueAt: null,

      actionLabel:
        "Review lifecycle analytics",
      href:
        "/recruiter/workflow/analytics",

      reason:
        "A high rollback rate may indicate premature stage transitions or incomplete validation.",

      evidence: [
        {
          label:
            "Rollback rate",
          value:
            rate,
        },
        {
          label:
            "Rollback events",
          value:
            context.summary.rollbacks,
        },
      ],

      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        openAiCalls: 0,
        requiresHumanAction: true,
      },
    });
  }

  if (
    context.summary.activeCandidates > 0 &&
    context.insights.analytics
      .activitySummary.last7Days === 0
  ) {
    suggestions.push({
      suggestionId:
        "copilot-suggestion:workflow-inactivity",
      type:
        "investigate_inactivity",
      priority:
        "critical",

      title:
        "Investigate inactive candidate workflow",

      description:
        `${context.summary.activeCandidates} active candidate` +
        `${context.summary.activeCandidates === 1 ? " has" : "s have"} ` +
        "no lifecycle activity recorded in the last seven days.",

      candidateId: null,
      candidateName: null,
      stage: null,
      nextAction: null,
      dueAt: null,

      actionLabel:
        "Open workflow board",
      href:
        "/recruiter/workflow",

      reason:
        "Active candidates should normally have recent workflow activity.",

      evidence: [
        {
          label:
            "Active candidates",
          value:
            context.summary.activeCandidates,
        },
        {
          label:
            "Activity last 7 days",
          value:
            context.insights.analytics
              .activitySummary.last7Days,
        },
      ],

      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        openAiCalls: 0,
        requiresHumanAction: true,
      },
    });
  }

  return suggestions;
}

export function buildRecruiterCopilotSuggestions(
  context: RecruiterCopilotContext,
  options: RecruiterCopilotSuggestionOptions = {},
): RecruiterCopilotSuggestionFeed {
  const candidateSuggestions =
    context.priorityCandidates.map(
      candidateSuggestion,
    );

  const operationalSuggestions =
    workflowSuggestions(context);

  let suggestions = [
    ...candidateSuggestions,
    ...operationalSuggestions,
  ].sort((left, right) => {
    const priorityDifference =
      priorityWeight(right.priority) -
      priorityWeight(left.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const leftDue =
      left.dueAt
        ? Date.parse(left.dueAt)
        : Number.MAX_SAFE_INTEGER;

    const rightDue =
      right.dueAt
        ? Date.parse(right.dueAt)
        : Number.MAX_SAFE_INTEGER;

    return leftDue - rightDue;
  });

  if (
    suggestions.length === 0 &&
    options.includeHealthy !== false
  ) {
    suggestions = [
      {
        suggestionId:
          "copilot-suggestion:workflow-healthy",
        type:
          "workflow_healthy",
        priority:
          "low",

        title:
          "Workflow health is stable",

        description:
          "No overdue follow-ups, urgent candidate actions, major bottlenecks, or workflow inactivity were detected.",

        candidateId: null,
        candidateName: null,
        stage: null,
        nextAction: null,
        dueAt: null,

        actionLabel:
          "Open workflow analytics",
        href:
          "/recruiter/workflow/analytics",

        reason:
          "No urgent deterministic workflow conditions were detected.",

        evidence: [
          {
            label:
              "Active candidates",
            value:
              context.summary.activeCandidates,
          },
          {
            label:
              "Overdue follow-ups",
            value:
              context.summary.overdueFollowUps,
          },
          {
            label:
              "Due today",
            value:
              context.summary.dueToday,
          },
        ],

        safety: {
          candidateDbWrites: 0,
          workflowWrites: 0,
          emailSends: 0,
          openAiCalls: 0,
          requiresHumanAction: true,
        },
      },
    ];
  }

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 50,
        100,
      ),
    );

  suggestions =
    suggestions.slice(0, limit);

  return {
    generatedAt:
      context.generatedAt,
    evaluatedAt:
      context.evaluatedAt,

    summary: {
      total:
        suggestions.length,
      critical:
        suggestions.filter(
          (item) =>
            item.priority === "critical",
        ).length,
      high:
        suggestions.filter(
          (item) =>
            item.priority === "high",
        ).length,
      medium:
        suggestions.filter(
          (item) =>
            item.priority === "medium",
        ).length,
      low:
        suggestions.filter(
          (item) =>
            item.priority === "low",
        ).length,
      candidateSpecific:
        suggestions.filter(
          (item) =>
            Boolean(item.candidateId),
        ).length,
    },

    suggestions,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      automaticActions: 0,
      readOnly: true,
    },

    mode:
      "deterministic recruiter Copilot suggestions generated from read-only Copilot context; all suggestions require human action; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
  };
}