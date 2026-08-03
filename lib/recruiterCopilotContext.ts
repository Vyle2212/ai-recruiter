import {
  evaluateCandidateLifecycleReminders,
  type CandidateLifecycleReminder,
} from "./candidateLifecycleReminderEngine";
import {
  activitiesFromPersistedStates,
  type RecruiterWorkflowActivity,
} from "./recruiterWorkflowActivity";
import {
  buildRecruiterWorkflowAnalytics,
  type RecruiterWorkflowAnalytics,
} from "./recruiterWorkflowAnalytics";
import {
  buildRecruiterWorkflowInsights,
  type RecruiterWorkflowInsights,
} from "./recruiterWorkflowInsights";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type RecruiterCopilotCandidatePriority = {
  candidateId: string;
  candidateName: string;
  stage: string;
  nextAction: string;
  dueAt: string | null;
  dueStatus: CandidateLifecycleReminder["dueStatus"];
  reminderLabel: string;
  effectivePriority: CandidateLifecycleReminder["effectivePriority"];
  requiresAttention: boolean;
};

export type RecruiterCopilotContext = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    totalCandidates: number;
    activeCandidates: number;
    attentionRequired: number;
    overdueFollowUps: number;
    dueToday: number;
    dueSoon: number;
    highPriority: number;
    lifecycleEvents: number;
    rollbacks: number;
  };

  insights: RecruiterWorkflowInsights;
  analytics: RecruiterWorkflowAnalytics;
  recentActivity: RecruiterWorkflowActivity[];
  reminders: CandidateLifecycleReminder[];
  priorityCandidates: RecruiterCopilotCandidatePriority[];

  capabilities: {
    answerWorkflowQuestions: true;
    summarizePipelineHealth: true;
    identifyBottlenecks: true;
    prioritizeFollowUps: true;
    compareRecruiterActivity: true;
    candidateDbWrites: false;
    workflowWrites: false;
    emailSends: false;
    openAiCalls: false;
  };

  mode: string;
};

export type RecruiterCopilotContextOptions = {
  now?: string | Date;
  generatedAt?: string;
  recentActivityLimit?: number;
  priorityCandidateLimit?: number;
};

function parseClock(value?: string | Date) {
  if (!value) {
    return new Date();
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Recruiter Copilot context received an invalid evaluation clock.",
    );
  }

  return date;
}

function priorityWeight(
  priority: CandidateLifecycleReminder["effectivePriority"],
) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function dueWeight(
  dueStatus: CandidateLifecycleReminder["dueStatus"],
) {
  if (dueStatus === "overdue") return 5;
  if (dueStatus === "today") return 4;
  if (dueStatus === "soon") return 3;
  if (dueStatus === "scheduled") return 2;
  return 1;
}

function buildPriorityCandidates(
  states: PersistedWorkflowState[],
  reminders: CandidateLifecycleReminder[],
  limit: number,
): RecruiterCopilotCandidatePriority[] {
  const stateByCandidateId = new Map(
    states.map((state) => [
      state.candidateId,
      state,
    ]),
  );

  return reminders
    .filter(
      (reminder) =>
        reminder.requiresAttention &&
        !reminder.terminal,
    )
    .sort((left, right) => {
      const dueDifference =
        dueWeight(right.dueStatus) -
        dueWeight(left.dueStatus);

      if (dueDifference !== 0) {
        return dueDifference;
      }

      const priorityDifference =
        priorityWeight(right.effectivePriority) -
        priorityWeight(left.effectivePriority);

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
    .slice(0, limit)
    .map((reminder) => {
      const state =
        stateByCandidateId.get(
          reminder.candidateId,
        );

      return {
        candidateId:
          reminder.candidateId,
        candidateName:
          state?.displayName ||
          reminder.candidateId,
        stage:
          reminder.stage,
        nextAction:
          reminder.nextAction,
        dueAt:
          reminder.dueAt,
        dueStatus:
          reminder.dueStatus,
        reminderLabel:
          reminder.reminderLabel,
        effectivePriority:
          reminder.effectivePriority,
        requiresAttention:
          reminder.requiresAttention,
      };
    });
}

export function buildRecruiterCopilotContext(
  states: PersistedWorkflowState[],
  options: RecruiterCopilotContextOptions = {},
): RecruiterCopilotContext {
  const now = parseClock(options.now);

  const generatedAt =
    options.generatedAt ||
    now.toISOString();

  const analytics =
    buildRecruiterWorkflowAnalytics(
      states,
      {
        now,
        generatedAt,
      },
    );

  const insights =
    buildRecruiterWorkflowInsights(
      states,
      {
        now,
        generatedAt,
      },
    );

  const lifecycles =
    states
      .map((state) => state.lifecycle)
      .filter(
        (
          lifecycle,
        ): lifecycle is NonNullable<
          PersistedWorkflowState["lifecycle"]
        > => Boolean(lifecycle),
      );

  const reminders =
    evaluateCandidateLifecycleReminders(
      lifecycles,
      {
        now,
      },
    );

  const recentActivityLimit =
    Math.max(
      0,
      options.recentActivityLimit ?? 25,
    );

  const priorityCandidateLimit =
    Math.max(
      0,
      options.priorityCandidateLimit ?? 20,
    );

  const recentActivity =
    activitiesFromPersistedStates(
      states,
    ).slice(
      0,
      recentActivityLimit,
    );

  const priorityCandidates =
    buildPriorityCandidates(
      states,
      reminders,
      priorityCandidateLimit,
    );

  return {
    generatedAt,
    evaluatedAt:
      now.toISOString(),

    summary: {
      totalCandidates:
        analytics.candidateCount,
      activeCandidates:
        analytics.activeCandidateCount,
      attentionRequired:
        analytics.reminderSummary.requiresAttention,
      overdueFollowUps:
        analytics.reminderSummary.overdue,
      dueToday:
        analytics.reminderSummary.today,
      dueSoon:
        analytics.reminderSummary.soon,
      highPriority:
        analytics.reminderSummary.highPriority,
      lifecycleEvents:
        analytics.eventCount,
      rollbacks:
        analytics.rollbackSummary.total,
    },

    insights,
    analytics,
    recentActivity,
    reminders,
    priorityCandidates,

    capabilities: {
      answerWorkflowQuestions: true,
      summarizePipelineHealth: true,
      identifyBottlenecks: true,
      prioritizeFollowUps: true,
      compareRecruiterActivity: true,
      candidateDbWrites: false,
      workflowWrites: false,
      emailSends: false,
      openAiCalls: false,
    },

    mode:
      "read-only recruiter Copilot context assembled from persisted lifecycle state, reminders, activity, analytics, and deterministic insights; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
  };
}