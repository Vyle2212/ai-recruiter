import {
  buildRecruiterWorkflowAnalytics,
  type RecruiterWorkflowAnalytics,
} from "./recruiterWorkflowAnalytics";
import type {
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type RecruiterWorkflowInsightSeverity =
  | "critical"
  | "warning"
  | "info";

export type RecruiterWorkflowRecommendationType =
  | "overdue_follow_up"
  | "due_today"
  | "pipeline_bottleneck"
  | "high_priority_review"
  | "rollback_review"
  | "activity_gap"
  | "healthy";

export type RecruiterWorkflowRecommendation = {
  recommendationId: string;
  type: RecruiterWorkflowRecommendationType;
  severity: RecruiterWorkflowInsightSeverity;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  metricValue: number;
  metadata: Record<string, string | number | boolean | null>;
};

export type RecruiterWorkflowBottleneck = {
  stage: CandidatePipelineStage;
  candidateCount: number;
  averageDays: number;
  maximumDays: number;
  severity: RecruiterWorkflowInsightSeverity;
};

export type RecruiterWorkflowInsights = {
  generatedAt: string;
  evaluatedAt: string;
  summary: {
    totalCandidates: number;
    activeCandidates: number;
    terminalCandidates: number;
    lifecycleEvents: number;
    overdueFollowUps: number;
    dueToday: number;
    dueSoon: number;
    attentionRequired: number;
    highPriority: number;
    rollbacks: number;
    activityLast7Days: number;
  };
  bottlenecks: RecruiterWorkflowBottleneck[];
  recruiterRanking: RecruiterWorkflowAnalytics["recruiterSummary"];
  recommendations: RecruiterWorkflowRecommendation[];
  analytics: {
    rollbackRatePercentage: number;
    averageEventsPerCandidate: number;
    stageDistribution: RecruiterWorkflowAnalytics["stageDistribution"];
    activitySummary: RecruiterWorkflowAnalytics["activitySummary"];
  };
  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    readOnly: true;
  };
  mode: string;
};

export type RecruiterWorkflowInsightsOptions = {
  now?: string | Date;
  generatedAt?: string;
  bottleneckAverageDays?: number;
  bottleneckMaximumDays?: number;
};

function bottleneckSeverity(
  averageDays: number,
  maximumDays: number,
  averageThreshold: number,
  maximumThreshold: number,
): RecruiterWorkflowInsightSeverity {
  if (
    averageDays >= averageThreshold * 2 ||
    maximumDays >= maximumThreshold * 2
  ) {
    return "critical";
  }

  if (
    averageDays >= averageThreshold ||
    maximumDays >= maximumThreshold
  ) {
    return "warning";
  }

  return "info";
}

function buildBottlenecks(
  analytics: RecruiterWorkflowAnalytics,
  options: RecruiterWorkflowInsightsOptions,
): RecruiterWorkflowBottleneck[] {
  const averageThreshold =
    options.bottleneckAverageDays ?? 5;

  const maximumThreshold =
    options.bottleneckMaximumDays ?? 10;

  return analytics.stageAge
    .filter((item) => item.candidateCount > 0)
    .map((item) => ({
      stage: item.stage,
      candidateCount: item.candidateCount,
      averageDays: item.averageDays,
      maximumDays: item.maximumDays,
      severity: bottleneckSeverity(
        item.averageDays,
        item.maximumDays,
        averageThreshold,
        maximumThreshold,
      ),
    }))
    .filter((item) => item.severity !== "info")
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "critical" ? -1 : 1;
      }

      return right.averageDays - left.averageDays;
    });
}

function recommendation(
  value: RecruiterWorkflowRecommendation,
) {
  return value;
}

function buildRecommendations(
  analytics: RecruiterWorkflowAnalytics,
  bottlenecks: RecruiterWorkflowBottleneck[],
): RecruiterWorkflowRecommendation[] {
  const items: RecruiterWorkflowRecommendation[] = [];

  if (analytics.reminderSummary.overdue > 0) {
    items.push(
      recommendation({
        recommendationId: "workflow-insight:overdue-follow-up",
        type: "overdue_follow_up",
        severity: "critical",
        title: "Resolve overdue candidate follow-ups",
        description:
          `${analytics.reminderSummary.overdue} candidate follow-up` +
          `${analytics.reminderSummary.overdue === 1 ? " is" : "s are"} overdue.`,
        actionLabel: "Open workflow board",
        href: "/recruiter/workflow",
        metricValue: analytics.reminderSummary.overdue,
        metadata: {
          dueStatus: "overdue",
        },
      }),
    );
  }

  if (analytics.reminderSummary.today > 0) {
    items.push(
      recommendation({
        recommendationId: "workflow-insight:due-today",
        type: "due_today",
        severity: "warning",
        title: "Complete follow-ups due today",
        description:
          `${analytics.reminderSummary.today} workflow action` +
          `${analytics.reminderSummary.today === 1 ? " is" : "s are"} due today.`,
        actionLabel: "Review due actions",
        href: "/recruiter/workflow",
        metricValue: analytics.reminderSummary.today,
        metadata: {
          dueStatus: "today",
        },
      }),
    );
  }

  if (analytics.reminderSummary.highPriority > 0) {
    items.push(
      recommendation({
        recommendationId: "workflow-insight:high-priority",
        type: "high_priority_review",
        severity: "warning",
        title: "Review high-priority candidates",
        description:
          `${analytics.reminderSummary.highPriority} candidate workflow` +
          `${analytics.reminderSummary.highPriority === 1 ? " is" : "s are"} currently high priority.`,
        actionLabel: "Open priority queue",
        href: "/recruiter/workflow",
        metricValue: analytics.reminderSummary.highPriority,
        metadata: {
          effectivePriority: "high",
        },
      }),
    );
  }

  for (const item of bottlenecks.slice(0, 3)) {
    items.push(
      recommendation({
        recommendationId:
          `workflow-insight:bottleneck:${item.stage}`,
        type: "pipeline_bottleneck",
        severity: item.severity,
        title: `Review ${item.stage.replace(/_/g, " ")} bottleneck`,
        description:
          `${item.candidateCount} candidate` +
          `${item.candidateCount === 1 ? " is" : "s are"} averaging ` +
          `${item.averageDays} days in this stage, with a maximum of ${item.maximumDays} days.`,
        actionLabel: "Open workflow analytics",
        href: "/recruiter/workflow/analytics",
        metricValue: item.averageDays,
        metadata: {
          stage: item.stage,
          candidateCount: item.candidateCount,
          maximumDays: item.maximumDays,
        },
      }),
    );
  }

  if (analytics.rollbackSummary.ratePercentage >= 15) {
    items.push(
      recommendation({
        recommendationId: "workflow-insight:rollback-rate",
        type: "rollback_review",
        severity:
          analytics.rollbackSummary.ratePercentage >= 30
            ? "critical"
            : "warning",
        title: "Review workflow rollback rate",
        description:
          `Rollback rate is ${analytics.rollbackSummary.ratePercentage}%, ` +
          `based on ${analytics.rollbackSummary.total} rollback event` +
          `${analytics.rollbackSummary.total === 1 ? "" : "s"}.`,
        actionLabel: "Review lifecycle analytics",
        href: "/recruiter/workflow/analytics",
        metricValue: analytics.rollbackSummary.ratePercentage,
        metadata: {
          rollbackCount: analytics.rollbackSummary.total,
        },
      }),
    );
  }

  if (
    analytics.activeCandidateCount > 0 &&
    analytics.activitySummary.last7Days === 0
  ) {
    items.push(
      recommendation({
        recommendationId: "workflow-insight:activity-gap",
        type: "activity_gap",
        severity: "critical",
        title: "Investigate inactive workflow",
        description:
          `${analytics.activeCandidateCount} active candidate` +
          `${analytics.activeCandidateCount === 1 ? " has" : "s have"} no lifecycle activity recorded in the last 7 days.`,
        actionLabel: "Open workflow board",
        href: "/recruiter/workflow",
        metricValue: analytics.activeCandidateCount,
        metadata: {
          last7DaysActivity: 0,
        },
      }),
    );
  }

  if (!items.length) {
    items.push(
      recommendation({
        recommendationId: "workflow-insight:healthy",
        type: "healthy",
        severity: "info",
        title: "Workflow health is stable",
        description:
          "No overdue follow-ups, major bottlenecks, rollback risks, or activity gaps were detected.",
        actionLabel: "Open workflow analytics",
        href: "/recruiter/workflow/analytics",
        metricValue: 0,
        metadata: {
          healthy: true,
        },
      }),
    );
  }

  return items;
}

export function buildRecruiterWorkflowInsights(
  states: PersistedWorkflowState[],
  options: RecruiterWorkflowInsightsOptions = {},
): RecruiterWorkflowInsights {
  const analytics =
    buildRecruiterWorkflowAnalytics(
      states,
      {
        now: options.now,
        generatedAt: options.generatedAt,
      },
    );

  const bottlenecks =
    buildBottlenecks(
      analytics,
      options,
    );

  return {
    generatedAt: analytics.generatedAt,
    evaluatedAt: analytics.evaluatedAt,
    summary: {
      totalCandidates:
        analytics.candidateCount,
      activeCandidates:
        analytics.activeCandidateCount,
      terminalCandidates:
        analytics.terminalCandidateCount,
      lifecycleEvents:
        analytics.eventCount,
      overdueFollowUps:
        analytics.reminderSummary.overdue,
      dueToday:
        analytics.reminderSummary.today,
      dueSoon:
        analytics.reminderSummary.soon,
      attentionRequired:
        analytics.reminderSummary.requiresAttention,
      highPriority:
        analytics.reminderSummary.highPriority,
      rollbacks:
        analytics.rollbackSummary.total,
      activityLast7Days:
        analytics.activitySummary.last7Days,
    },
    bottlenecks,
    recruiterRanking:
      analytics.recruiterSummary,
    recommendations:
      buildRecommendations(
        analytics,
        bottlenecks,
      ),
    analytics: {
      rollbackRatePercentage:
        analytics.rollbackSummary.ratePercentage,
      averageEventsPerCandidate:
        analytics.averageEventsPerCandidate,
      stageDistribution:
        analytics.stageDistribution,
      activitySummary:
        analytics.activitySummary,
    },
    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      readOnly: true,
    },
    mode:
      "deterministic read-only recruiter workflow insights built from persisted lifecycle analytics; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
  };
}