import type {
  RecruiterCopilotContext,
} from "./recruiterCopilotContext";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";
import type {
  RecruiterWorkflowSlaReport,
} from "./recruiterWorkflowSla";

export type RecruiterWorkflowAutomationRuleId =
  | "overdue_follow_up"
  | "interview_feedback_missing"
  | "offer_follow_up"
  | "on_hold_review"
  | "repeated_rollback_review";

export type RecruiterWorkflowAutomationAction =
  | "follow_up_candidate"
  | "follow_up_client"
  | "request_interview_feedback"
  | "review_on_hold_candidate"
  | "audit_candidate_workflow";

export type RecruiterWorkflowAutomationPriority =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type RecruiterWorkflowAutomationProposal = {
  proposalId: string;
  ruleId: RecruiterWorkflowAutomationRuleId;

  candidateId: string;
  candidateName: string;

  currentStage: string;
  proposedAction: RecruiterWorkflowAutomationAction;

  priority: RecruiterWorkflowAutomationPriority;

  title: string;
  description: string;
  reason: string;

  dueAt: string | null;

  evidence: Array<{
    label: string;
    value: string | number | boolean | null;
  }>;

  href: string;

  execution: {
    previewOnly: true;
    requiresRecruiterApproval: true;
    automaticExecution: false;
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
  };
};

export type RecruiterWorkflowAutomationPreview = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    candidatesAffected: number;
    rulesTriggered: number;
  };

  proposals: RecruiterWorkflowAutomationProposal[];

  rules: Array<{
    ruleId: RecruiterWorkflowAutomationRuleId;
    enabled: true;
    previewOnly: true;
    description: string;
  }>;

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    automaticActions: 0;
    previewOnly: true;
    requiresHumanApproval: true;
  };

  mode: string;
};

export type RecruiterWorkflowAutomationOptions = {
  generatedAt?: string;
  limit?: number;
  overdueEscalationDays?: number;
  onHoldReviewDays?: number;
  rollbackThreshold?: number;
};

const RULES: RecruiterWorkflowAutomationPreview["rules"] = [
  {
    ruleId: "overdue_follow_up",
    enabled: true,
    previewOnly: true,
    description:
      "Propose follow-up when a candidate action is overdue.",
  },
  {
    ruleId: "interview_feedback_missing",
    enabled: true,
    previewOnly: true,
    description:
      "Propose requesting feedback when a candidate remains in interview stage beyond SLA.",
  },
  {
    ruleId: "offer_follow_up",
    enabled: true,
    previewOnly: true,
    description:
      "Propose client follow-up when an offer-stage candidate exceeds SLA or has an overdue action.",
  },
  {
    ruleId: "on_hold_review",
    enabled: true,
    previewOnly: true,
    description:
      "Propose recruiter review when a candidate remains on hold beyond the configured threshold.",
  },
  {
    ruleId: "repeated_rollback_review",
    enabled: true,
    previewOnly: true,
    description:
      "Propose workflow audit when a candidate has repeated rollback events.",
  },
];

function readable(value: string) {
  return value.replace(/_/g, " ");
}

function priorityWeight(
  priority: RecruiterWorkflowAutomationPriority,
) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function rollbackCount(
  state: PersistedWorkflowState,
) {
  const lifecycle = state.lifecycle;

  if (!lifecycle) return 0;

  return lifecycle.history.filter((event) => {
    const source =
      String(event.source || "").toLowerCase();

    const action =
      String(event.action || "").toLowerCase();

    return (
      source.includes("rollback") ||
      action.includes("rollback")
    );
  }).length;
}

function proposalBase(
  state: PersistedWorkflowState,
) {
  const lifecycle = state.lifecycle;

  if (!lifecycle) {
    return null;
  }

  return {
    candidateId:
      lifecycle.candidateId,

    candidateName:
      lifecycle.candidateName,

    currentStage:
      lifecycle.stage,

    dueAt:
      lifecycle.nextActionDueAt,

    href:
      `/recruiter/candidate360/${encodeURIComponent(
        lifecycle.candidateId,
      )}`,

    execution: {
      previewOnly: true as const,
      requiresRecruiterApproval: true as const,
      automaticExecution: false as const,
      candidateDbWrites: 0 as const,
      workflowWrites: 0 as const,
      emailSends: 0 as const,
      openAiCalls: 0 as const,
    },
  };
}

function overdueProposal(
  state: PersistedWorkflowState,
  context: RecruiterCopilotContext,
  overdueEscalationDays: number,
): RecruiterWorkflowAutomationProposal | null {
  const base = proposalBase(state);
  const lifecycle = state.lifecycle;

  if (!base || !lifecycle) return null;

  const reminder =
    context.reminders.find(
      (item) =>
        item.candidateId ===
        lifecycle.candidateId,
    );

  if (
    !reminder ||
    reminder.dueStatus !== "overdue"
  ) {
    return null;
  }

  const overdueDays =
    reminder.dueAt
      ? Math.max(
          0,
          Math.floor(
            (
              Date.parse(context.evaluatedAt) -
              Date.parse(reminder.dueAt)
            ) /
              86_400_000,
          ),
        )
      : 0;

  const priority:
    RecruiterWorkflowAutomationPriority =
    overdueDays >= overdueEscalationDays
      ? "critical"
      : "high";

  return {
    proposalId:
      `automation-preview:overdue:${lifecycle.candidateId}`,

    ruleId:
      "overdue_follow_up",

    ...base,

    proposedAction:
      lifecycle.stage === "submitted" ||
      lifecycle.stage === "offer"
        ? "follow_up_client"
        : "follow_up_candidate",

    priority,

    title:
      `Follow up ${lifecycle.candidateName}`,

    description:
      `${lifecycle.candidateName} has an overdue workflow action: ${readable(
        lifecycle.nextAction,
      )}.`,

    reason:
      reminder.reminderLabel,

    evidence: [
      {
        label: "Due status",
        value: reminder.dueStatus,
      },
      {
        label: "Overdue days",
        value: overdueDays,
      },
      {
        label: "Current stage",
        value: readable(
          lifecycle.stage,
        ),
      },
      {
        label: "Next action",
        value: readable(
          lifecycle.nextAction,
        ),
      },
    ],
  };
}

function interviewFeedbackProposal(
  state: PersistedWorkflowState,
  slaReport: RecruiterWorkflowSlaReport,
): RecruiterWorkflowAutomationProposal | null {
  const base = proposalBase(state);
  const lifecycle = state.lifecycle;

  if (
    !base ||
    !lifecycle ||
    lifecycle.stage !== "interview"
  ) {
    return null;
  }

  const sla =
    slaReport.candidateRisks.find(
      (item) =>
        item.candidateId ===
        lifecycle.candidateId,
    );

  if (
    !sla ||
    !["warning", "violated"].includes(
      sla.status,
    )
  ) {
    return null;
  }

  return {
    proposalId:
      `automation-preview:interview-feedback:${lifecycle.candidateId}`,

    ruleId:
      "interview_feedback_missing",

    ...base,

    proposedAction:
      "request_interview_feedback",

    priority:
      sla.status === "violated"
        ? "high"
        : "medium",

    title:
      `Request interview feedback for ${lifecycle.candidateName}`,

    description:
      `${lifecycle.candidateName} remains in interview stage for ${sla.daysInStage} days.`,

    reason:
      "Interview-stage SLA indicates that feedback or a recruiter update may be pending.",

    evidence: [
      {
        label: "Days in stage",
        value: sla.daysInStage,
      },
      {
        label: "Interview SLA",
        value: sla.slaDays,
      },
      {
        label: "SLA status",
        value: sla.status,
      },
      {
        label: "Owner",
        value:
          lifecycle.ownerName ||
          "Unassigned",
      },
    ],
  };
}

function offerProposal(
  state: PersistedWorkflowState,
  context: RecruiterCopilotContext,
  slaReport: RecruiterWorkflowSlaReport,
): RecruiterWorkflowAutomationProposal | null {
  const base = proposalBase(state);
  const lifecycle = state.lifecycle;

  if (
    !base ||
    !lifecycle ||
    lifecycle.stage !== "offer"
  ) {
    return null;
  }

  const reminder =
    context.reminders.find(
      (item) =>
        item.candidateId ===
        lifecycle.candidateId,
    );

  const sla =
    slaReport.candidateRisks.find(
      (item) =>
        item.candidateId ===
        lifecycle.candidateId,
    );

  const requiresAttention =
    reminder?.dueStatus === "overdue" ||
    reminder?.dueStatus === "today" ||
    sla?.status === "violated" ||
    sla?.status === "warning";

  if (!requiresAttention) {
    return null;
  }

  return {
    proposalId:
      `automation-preview:offer:${lifecycle.candidateId}`,

    ruleId:
      "offer_follow_up",

    ...base,

    proposedAction:
      "follow_up_client",

    priority:
      reminder?.dueStatus === "overdue" ||
      sla?.status === "violated"
        ? "critical"
        : "high",

    title:
      `Follow up offer for ${lifecycle.candidateName}`,

    description:
      `${lifecycle.candidateName} has an offer-stage workflow requiring recruiter attention.`,

    reason:
      reminder?.reminderLabel ||
      "Offer-stage SLA requires review.",

    evidence: [
      {
        label: "Due status",
        value:
          reminder?.dueStatus ||
          "none",
      },
      {
        label: "SLA status",
        value:
          sla?.status ||
          "not evaluated",
      },
      {
        label: "Days in offer stage",
        value:
          sla?.daysInStage || 0,
      },
    ],
  };
}

function onHoldProposal(
  state: PersistedWorkflowState,
  slaReport: RecruiterWorkflowSlaReport,
  onHoldReviewDays: number,
): RecruiterWorkflowAutomationProposal | null {
  const base = proposalBase(state);
  const lifecycle = state.lifecycle;

  if (
    !base ||
    !lifecycle ||
    lifecycle.stage !== "on_hold"
  ) {
    return null;
  }

  const sla =
    slaReport.candidateRisks.find(
      (item) =>
        item.candidateId ===
        lifecycle.candidateId,
    );

  if (
    !sla ||
    sla.daysInStage <
      onHoldReviewDays
  ) {
    return null;
  }

  return {
    proposalId:
      `automation-preview:on-hold:${lifecycle.candidateId}`,

    ruleId:
      "on_hold_review",

    ...base,

    proposedAction:
      "review_on_hold_candidate",

    priority:
      sla.daysInStage >=
      onHoldReviewDays * 2
        ? "high"
        : "medium",

    title:
      `Review on-hold candidate ${lifecycle.candidateName}`,

    description:
      `${lifecycle.candidateName} has remained on hold for ${sla.daysInStage} days.`,

    reason:
      "Extended on-hold periods require recruiter review before the candidate becomes stale.",

    evidence: [
      {
        label: "Days on hold",
        value: sla.daysInStage,
      },
      {
        label: "Review threshold",
        value: onHoldReviewDays,
      },
      {
        label: "Owner",
        value:
          lifecycle.ownerName ||
          "Unassigned",
      },
    ],
  };
}

function rollbackProposal(
  state: PersistedWorkflowState,
  rollbackThreshold: number,
): RecruiterWorkflowAutomationProposal | null {
  const base = proposalBase(state);
  const lifecycle = state.lifecycle;

  if (!base || !lifecycle) {
    return null;
  }

  const count =
    rollbackCount(state);

  if (count < rollbackThreshold) {
    return null;
  }

  return {
    proposalId:
      `automation-preview:rollback:${lifecycle.candidateId}`,

    ruleId:
      "repeated_rollback_review",

    ...base,

    proposedAction:
      "audit_candidate_workflow",

    priority:
      count >= rollbackThreshold + 2
        ? "critical"
        : "high",

    title:
      `Audit workflow for ${lifecycle.candidateName}`,

    description:
      `${lifecycle.candidateName} has ${count} recorded lifecycle rollback events.`,

    reason:
      "Repeated rollback activity may indicate incorrect stage movement or missing validation.",

    evidence: [
      {
        label: "Rollback count",
        value: count,
      },
      {
        label: "Review threshold",
        value: rollbackThreshold,
      },
      {
        label: "Current stage",
        value: readable(
          lifecycle.stage,
        ),
      },
    ],
  };
}

export function buildRecruiterWorkflowAutomationPreview(
  states: PersistedWorkflowState[],
  context: RecruiterCopilotContext,
  slaReport: RecruiterWorkflowSlaReport,
  options: RecruiterWorkflowAutomationOptions = {},
): RecruiterWorkflowAutomationPreview {
  const overdueEscalationDays =
    Math.max(
      1,
      options.overdueEscalationDays ?? 3,
    );

  const onHoldReviewDays =
    Math.max(
      1,
      options.onHoldReviewDays ?? 14,
    );

  const rollbackThreshold =
    Math.max(
      1,
      options.rollbackThreshold ?? 2,
    );

  const proposals =
    states.flatMap((state) => {
      const candidateProposals = [
        overdueProposal(
          state,
          context,
          overdueEscalationDays,
        ),

        interviewFeedbackProposal(
          state,
          slaReport,
        ),

        offerProposal(
          state,
          context,
          slaReport,
        ),

        onHoldProposal(
          state,
          slaReport,
          onHoldReviewDays,
        ),

        rollbackProposal(
          state,
          rollbackThreshold,
        ),
      ];

      return candidateProposals.filter(
        (
          item,
        ): item is RecruiterWorkflowAutomationProposal =>
          Boolean(item),
      );
    });

  const deduplicated =
    Array.from(
      new Map(
        proposals.map((proposal) => [
          proposal.proposalId,
          proposal,
        ]),
      ).values(),
    ).sort((left, right) => {
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

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 100,
        500,
      ),
    );

  const visible =
    deduplicated.slice(0, limit);

  return {
    generatedAt:
      options.generatedAt ||
      context.generatedAt,

    evaluatedAt:
      context.evaluatedAt,

    summary: {
      total:
        visible.length,

      critical:
        visible.filter(
          (item) =>
            item.priority === "critical",
        ).length,

      high:
        visible.filter(
          (item) =>
            item.priority === "high",
        ).length,

      medium:
        visible.filter(
          (item) =>
            item.priority === "medium",
        ).length,

      low:
        visible.filter(
          (item) =>
            item.priority === "low",
        ).length,

      candidatesAffected:
        new Set(
          visible.map(
            (item) =>
              item.candidateId,
          ),
        ).size,

      rulesTriggered:
        new Set(
          visible.map(
            (item) =>
              item.ruleId,
          ),
        ).size,
    },

    proposals:
      visible,

    rules:
      RULES,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,
      previewOnly: true,
      requiresHumanApproval: true,
    },

    mode:
      "preview-only deterministic recruiter workflow automation proposals; no automatic execution; no candidate DB writes; no workflow writes; no email sends; no push sends; no OpenAI calls",
  };
}