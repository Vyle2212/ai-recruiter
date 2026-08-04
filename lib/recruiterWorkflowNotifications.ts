import type {
  RecruiterCopilotSuggestion,
  RecruiterCopilotSuggestionFeed,
  RecruiterCopilotSuggestionPriority,
} from "./recruiterCopilotSuggestions";

export type RecruiterWorkflowNotificationStatus =
  | "unread"
  | "read";

export type RecruiterWorkflowNotification = {
  notificationId: string;
  type: RecruiterCopilotSuggestion["type"];
  priority: RecruiterCopilotSuggestionPriority;
  status: RecruiterWorkflowNotificationStatus;

  title: string;
  description: string;
  reason: string;

  candidateId: string | null;
  candidateName: string | null;
  stage: string | null;
  dueAt: string | null;

  actionLabel: string;
  href: string;

  createdAt: string;

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    readOnly: true;
  };
};

export type RecruiterWorkflowNotificationFeed = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    total: number;
    unread: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    candidateSpecific: number;
  };

  notifications: RecruiterWorkflowNotification[];

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    automaticActions: 0;
    readOnly: true;
  };

  mode: string;
};

export type RecruiterWorkflowNotificationOptions = {
  limit?: number;
  includeHealthy?: boolean;
};

function priorityWeight(
  priority: RecruiterCopilotSuggestionPriority,
) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function notificationFromSuggestion(
  suggestion: RecruiterCopilotSuggestion,
  generatedAt: string,
): RecruiterWorkflowNotification {
  return {
    notificationId:
      `workflow-notification:${suggestion.suggestionId}`,

    type: suggestion.type,
    priority: suggestion.priority,
    status: "unread",

    title: suggestion.title,
    description: suggestion.description,
    reason: suggestion.reason,

    candidateId: suggestion.candidateId,
    candidateName: suggestion.candidateName,
    stage: suggestion.stage,
    dueAt: suggestion.dueAt,

    actionLabel: suggestion.actionLabel,
    href: suggestion.href,

    createdAt: generatedAt,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      readOnly: true,
    },
  };
}

export function buildRecruiterWorkflowNotifications(
  suggestionFeed: RecruiterCopilotSuggestionFeed,
  options: RecruiterWorkflowNotificationOptions = {},
): RecruiterWorkflowNotificationFeed {
  const limit = Math.max(
    0,
    Math.min(options.limit ?? 50, 100),
  );

  const suggestions =
    suggestionFeed.suggestions
      .filter(
        (suggestion) =>
          options.includeHealthy !== false ||
          suggestion.type !== "workflow_healthy",
      )
      .sort((left, right) => {
        const priorityDifference =
          priorityWeight(right.priority) -
          priorityWeight(left.priority);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        const leftDue = left.dueAt
          ? Date.parse(left.dueAt)
          : Number.MAX_SAFE_INTEGER;

        const rightDue = right.dueAt
          ? Date.parse(right.dueAt)
          : Number.MAX_SAFE_INTEGER;

        return leftDue - rightDue;
      })
      .slice(0, limit);

  const notifications =
    suggestions.map((suggestion) =>
      notificationFromSuggestion(
        suggestion,
        suggestionFeed.generatedAt,
      ),
    );

  return {
    generatedAt: suggestionFeed.generatedAt,
    evaluatedAt: suggestionFeed.evaluatedAt,

    summary: {
      total: notifications.length,
      unread: notifications.filter(
        (item) => item.status === "unread",
      ).length,
      critical: notifications.filter(
        (item) => item.priority === "critical",
      ).length,
      high: notifications.filter(
        (item) => item.priority === "high",
      ).length,
      medium: notifications.filter(
        (item) => item.priority === "medium",
      ).length,
      low: notifications.filter(
        (item) => item.priority === "low",
      ).length,
      candidateSpecific: notifications.filter(
        (item) => Boolean(item.candidateId),
      ).length,
    },

    notifications,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,
      readOnly: true,
    },

    mode:
      "deterministic read-only recruiter workflow notifications generated from Copilot suggestions; no candidate DB writes; no workflow writes; no email sends; no push sends; no OpenAI calls",
  };
}