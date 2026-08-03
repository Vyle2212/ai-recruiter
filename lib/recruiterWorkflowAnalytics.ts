import {
  CANDIDATE_PIPELINE_STAGES,
  type CandidatePipelineStage,
} from "./candidateLifecycleTypes";
import {
  evaluateCandidateLifecycleReminder,
  type CandidateLifecycleDueStatus,
} from "./candidateLifecycleReminderEngine";
import {
  activitiesFromPersistedStates,
  type RecruiterWorkflowActivity,
} from "./recruiterWorkflowActivity";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type WorkflowStageDistributionItem = {
  stage: CandidatePipelineStage;
  count: number;
  percentage: number;
};

export type WorkflowStageAgeItem = {
  stage: CandidatePipelineStage;
  candidateCount: number;
  averageDays: number;
  minimumDays: number;
  maximumDays: number;
};

export type WorkflowTransitionSummaryItem = {
  fromStage: CandidatePipelineStage | null;
  toStage: CandidatePipelineStage;
  count: number;
};

export type WorkflowRecruiterSummaryItem = {
  actorKey: string;
  actorLabel: string;
  activityCount: number;
  transitionCount: number;
  rollbackCount: number;
  latestActivityAt: string | null;
};

export type WorkflowReminderSummary = Record<
  CandidateLifecycleDueStatus,
  number
> & {
  requiresAttention: number;
  highPriority: number;
};

export type WorkflowActivityPeriodSummary = {
  today: number;
  yesterday: number;
  last7Days: number;
  last30Days: number;
};

export type RecruiterWorkflowAnalytics = {
  generatedAt: string;
  evaluatedAt: string;
  candidateCount: number;
  activeCandidateCount: number;
  terminalCandidateCount: number;
  eventCount: number;
  averageEventsPerCandidate: number;
  stageDistribution: WorkflowStageDistributionItem[];
  stageAge: WorkflowStageAgeItem[];
  reminderSummary: WorkflowReminderSummary;
  transitionSummary: WorkflowTransitionSummaryItem[];
  rollbackSummary: {
    total: number;
    last30Days: number;
    ratePercentage: number;
  };
  recruiterSummary: WorkflowRecruiterSummaryItem[];
  activitySummary: WorkflowActivityPeriodSummary;
  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    reminderSends: 0;
    readOnly: true;
  };
  mode: string;
};

export type RecruiterWorkflowAnalyticsOptions = {
  now?: string | Date;
  generatedAt?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseClock(value?: string | Date) {
  if (!value) return new Date();

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Workflow analytics received an invalid evaluation clock.",
    );
  }

  return date;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validDate(value: unknown) {
  const date = new Date(String(value || ""));

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function lifecycleOf(state: PersistedWorkflowState) {
  return state.lifecycle || null;
}

function stageAgeDays(
  state: PersistedWorkflowState,
  now: Date,
) {
  const lifecycle = lifecycleOf(state);

  if (!lifecycle) return null;

  const since =
    validDate(lifecycle.lastActivityAt) ||
    validDate(lifecycle.updatedAt) ||
    validDate(state.lastUpdatedAt);

  if (!since) return null;

  return Math.max(
    0,
    (now.getTime() - since.getTime()) /
      DAY_MS,
  );
}

function buildStageDistribution(
  states: PersistedWorkflowState[],
): WorkflowStageDistributionItem[] {
  const candidateCount = states.length;

  return CANDIDATE_PIPELINE_STAGES.map(
    (stage) => {
      const count = states.filter(
        (state) =>
          lifecycleOf(state)?.stage ===
          stage,
      ).length;

      return {
        stage,
        count,
        percentage:
          candidateCount > 0
            ? round(
                (count /
                  candidateCount) *
                  100,
              )
            : 0,
      };
    },
  );
}

function buildStageAge(
  states: PersistedWorkflowState[],
  now: Date,
): WorkflowStageAgeItem[] {
  return CANDIDATE_PIPELINE_STAGES.map(
    (stage) => {
      const values = states
        .filter(
          (state) =>
            lifecycleOf(state)?.stage ===
            stage,
        )
        .map((state) =>
          stageAgeDays(state, now),
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        );

      if (!values.length) {
        return {
          stage,
          candidateCount: 0,
          averageDays: 0,
          minimumDays: 0,
          maximumDays: 0,
        };
      }

      return {
        stage,
        candidateCount:
          values.length,
        averageDays: round(
          values.reduce(
            (sum, value) =>
              sum + value,
            0,
          ) / values.length,
        ),
        minimumDays: round(
          Math.min(...values),
        ),
        maximumDays: round(
          Math.max(...values),
        ),
      };
    },
  );
}

function buildReminderSummary(
  states: PersistedWorkflowState[],
  now: Date,
): WorkflowReminderSummary {
  const summary: WorkflowReminderSummary = {
    overdue: 0,
    today: 0,
    soon: 0,
    scheduled: 0,
    none: 0,
    requiresAttention: 0,
    highPriority: 0,
  };

  for (const state of states) {
    const lifecycle =
      lifecycleOf(state);

    if (!lifecycle) continue;

    const reminder =
      evaluateCandidateLifecycleReminder(
        lifecycle,
        { now },
      );

    summary[reminder.dueStatus] += 1;

    if (reminder.requiresAttention) {
      summary.requiresAttention += 1;
    }

    if (
      reminder.effectivePriority ===
      "high"
    ) {
      summary.highPriority += 1;
    }
  }

  return summary;
}

function buildTransitionSummary(
  activities: RecruiterWorkflowActivity[],
): WorkflowTransitionSummaryItem[] {
  const counts = new Map<
    string,
    WorkflowTransitionSummaryItem
  >();

  for (const activity of activities) {
    const key = `${
      activity.fromStage || "start"
    }->${activity.toStage}`;

    const existing = counts.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        fromStage:
          activity.fromStage,
        toStage:
          activity.toStage,
        count: 1,
      });
    }
  }

  return [...counts.values()].sort(
    (left, right) =>
      right.count - left.count,
  );
}

function actorKey(
  activity: RecruiterWorkflowActivity,
) {
  return (
    activity.actorId ||
    activity.actorName ||
    "system"
  );
}

function buildRecruiterSummary(
  activities: RecruiterWorkflowActivity[],
): WorkflowRecruiterSummaryItem[] {
  const actors = new Map<
    string,
    WorkflowRecruiterSummaryItem
  >();

  for (const activity of activities) {
    const key = actorKey(activity);
    const existing = actors.get(key);

    if (!existing) {
      actors.set(key, {
        actorKey: key,
        actorLabel:
          activity.actorLabel,
        activityCount: 1,
        transitionCount:
          activity.activityType ===
          "stage_transition"
            ? 1
            : 0,
        rollbackCount:
          activity.activityType ===
          "rollback"
            ? 1
            : 0,
        latestActivityAt:
          activity.occurredAt,
      });

      continue;
    }

    existing.activityCount += 1;

    if (
      activity.activityType ===
      "stage_transition"
    ) {
      existing.transitionCount += 1;
    }

    if (
      activity.activityType ===
      "rollback"
    ) {
      existing.rollbackCount += 1;
    }

    if (
      !existing.latestActivityAt ||
      Date.parse(
        activity.occurredAt,
      ) >
        Date.parse(
          existing.latestActivityAt,
        )
    ) {
      existing.latestActivityAt =
        activity.occurredAt;
    }
  }

  return [...actors.values()].sort(
    (left, right) =>
      right.activityCount -
      left.activityCount,
  );
}

function utcDayStart(date: Date) {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function activityAgeDays(
  occurredAt: string,
  now: Date,
) {
  const occurred =
    validDate(occurredAt);

  if (!occurred) return null;

  return Math.floor(
    (utcDayStart(now) -
      utcDayStart(occurred)) /
      DAY_MS,
  );
}

function buildActivitySummary(
  activities: RecruiterWorkflowActivity[],
  now: Date,
): WorkflowActivityPeriodSummary {
  const summary: WorkflowActivityPeriodSummary = {
    today: 0,
    yesterday: 0,
    last7Days: 0,
    last30Days: 0,
  };

  for (const activity of activities) {
    const age = activityAgeDays(
      activity.occurredAt,
      now,
    );

    if (age === null || age < 0) {
      continue;
    }

    if (age === 0) {
      summary.today += 1;
    }

    if (age === 1) {
      summary.yesterday += 1;
    }

    if (age <= 6) {
      summary.last7Days += 1;
    }

    if (age <= 29) {
      summary.last30Days += 1;
    }
  }

  return summary;
}

export function buildRecruiterWorkflowAnalytics(
  states: PersistedWorkflowState[],
  options: RecruiterWorkflowAnalyticsOptions = {},
): RecruiterWorkflowAnalytics {
  const now = parseClock(options.now);
  const generatedAt =
    options.generatedAt ||
    now.toISOString();

  const activities =
    activitiesFromPersistedStates(
      states,
    );

  const candidateCount =
    states.length;

  const terminalCandidateCount =
    states.filter((state) => {
      const stage =
        lifecycleOf(state)?.stage;

      return (
        stage === "hired" ||
        stage === "rejected"
      );
    }).length;

  const rollbackCount =
    activities.filter(
      (activity) =>
        activity.activityType ===
        "rollback",
    ).length;

  const activitySummary =
    buildActivitySummary(
      activities,
      now,
    );

  return {
    generatedAt,
    evaluatedAt:
      now.toISOString(),
    candidateCount,
    activeCandidateCount:
      candidateCount -
      terminalCandidateCount,
    terminalCandidateCount,
    eventCount:
      activities.length,
    averageEventsPerCandidate:
      candidateCount > 0
        ? round(
            activities.length /
              candidateCount,
          )
        : 0,
    stageDistribution:
      buildStageDistribution(states),
    stageAge:
      buildStageAge(
        states,
        now,
      ),
    reminderSummary:
      buildReminderSummary(
        states,
        now,
      ),
    transitionSummary:
      buildTransitionSummary(
        activities,
      ),
    rollbackSummary: {
      total: rollbackCount,
      last30Days:
        activities.filter(
          (activity) => {
            if (
              activity.activityType !==
              "rollback"
            ) {
              return false;
            }

            const age =
              activityAgeDays(
                activity.occurredAt,
                now,
              );

            return (
              age !== null &&
              age >= 0 &&
              age <= 29
            );
          },
        ).length,
      ratePercentage:
        activities.length > 0
          ? round(
              (rollbackCount /
                activities.length) *
                100,
            )
          : 0,
    },
    recruiterSummary:
      buildRecruiterSummary(
        activities,
      ),
    activitySummary,
    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      reminderSends: 0,
      readOnly: true,
    },
    mode:
      "read-only recruiter workflow analytics from persisted lifecycle state and history; no candidate DB writes; no workflow writes",
  };
}