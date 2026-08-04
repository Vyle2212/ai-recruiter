import type {
  CandidateLifecyclePriority,
  CandidateLifecycleRecord,
} from "./candidateLifecycleTypes";

export type CandidateLifecycleDueStatus =
  | "overdue"
  | "today"
  | "soon"
  | "scheduled"
  | "none";

export type CandidateLifecycleReminder = {
  candidateId: string;
  stage: CandidateLifecycleRecord["stage"];
  nextAction: CandidateLifecycleRecord["nextAction"];
  dueAt: string | null;
  dueStatus: CandidateLifecycleDueStatus;
  daysUntilDue: number | null;
  reminderLabel: string;
  effectivePriority: CandidateLifecyclePriority;
  requiresAttention: boolean;
  terminal: boolean;
  sourcePriority: CandidateLifecyclePriority;
  evaluatedAt: string;
};

export type CandidateLifecycleReminderOptions = {
  now?: string | Date;
  soonThresholdDays?: number;
};

const TERMINAL_STAGES: CandidateLifecycleRecord["stage"][] = [
  "hired",
  "rejected",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date) {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

function parseDate(value: string | Date | undefined) {
  if (!value) return new Date();

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Candidate lifecycle reminder evaluation received an invalid clock.",
    );
  }

  return date;
}

function daysBetween(
  now: Date,
  dueAt: Date,
) {
  return Math.round(
    (startOfUtcDay(dueAt) -
      startOfUtcDay(now)) /
      DAY_MS,
  );
}

function escalatePriority(
  sourcePriority: CandidateLifecyclePriority,
  dueStatus: CandidateLifecycleDueStatus,
): CandidateLifecyclePriority {
  if (dueStatus === "overdue") {
    return "high";
  }

  if (
    dueStatus === "today" &&
    sourcePriority !== "high"
  ) {
    return "high";
  }

  if (
    dueStatus === "soon" &&
    sourcePriority === "low"
  ) {
    return "medium";
  }

  return sourcePriority;
}

function reminderLabel(
  dueStatus: CandidateLifecycleDueStatus,
  daysUntilDue: number | null,
  terminal: boolean,
) {
  if (terminal) {
    return "Completed";
  }

  if (
    dueStatus === "none" ||
    daysUntilDue === null
  ) {
    return "No due date";
  }

  if (dueStatus === "overdue") {
    const overdueDays =
      Math.abs(daysUntilDue);

    return `Overdue by ${overdueDays} day${
      overdueDays === 1 ? "" : "s"
    }`;
  }

  if (dueStatus === "today") {
    return "Due today";
  }

  if (daysUntilDue === 1) {
    return "Due tomorrow";
  }

  if (dueStatus === "soon") {
    return `Due in ${daysUntilDue} days`;
  }

  return `Scheduled in ${daysUntilDue} days`;
}

export function evaluateCandidateLifecycleReminder(
  lifecycle: CandidateLifecycleRecord,
  options: CandidateLifecycleReminderOptions = {},
): CandidateLifecycleReminder {
  const now = parseDate(options.now);
  const evaluatedAt = now.toISOString();

  const terminal =
    TERMINAL_STAGES.includes(
      lifecycle.stage,
    );

  if (terminal) {
    return {
      candidateId:
        lifecycle.candidateId,
      stage:
        lifecycle.stage,
      nextAction:
        lifecycle.nextAction,
      dueAt:
        lifecycle.nextActionDueAt,
      dueStatus:
        "none",
      daysUntilDue:
        null,
      reminderLabel:
        "Completed",
      effectivePriority:
        lifecycle.priority,
      requiresAttention:
        false,
      terminal:
        true,
      sourcePriority:
        lifecycle.priority,
      evaluatedAt,
    };
  }

  if (!lifecycle.nextActionDueAt) {
    return {
      candidateId:
        lifecycle.candidateId,
      stage:
        lifecycle.stage,
      nextAction:
        lifecycle.nextAction,
      dueAt:
        null,
      dueStatus:
        "none",
      daysUntilDue:
        null,
      reminderLabel:
        "No due date",
      effectivePriority:
        lifecycle.priority,
      requiresAttention:
        false,
      terminal:
        false,
      sourcePriority:
        lifecycle.priority,
      evaluatedAt,
    };
  }

  const dueAt =
    new Date(
      lifecycle.nextActionDueAt,
    );

  if (Number.isNaN(dueAt.getTime())) {
    return {
      candidateId:
        lifecycle.candidateId,
      stage:
        lifecycle.stage,
      nextAction:
        lifecycle.nextAction,
      dueAt:
        lifecycle.nextActionDueAt,
      dueStatus:
        "none",
      daysUntilDue:
        null,
      reminderLabel:
        "Invalid due date",
      effectivePriority:
        lifecycle.priority,
      requiresAttention:
        true,
      terminal:
        false,
      sourcePriority:
        lifecycle.priority,
      evaluatedAt,
    };
  }

  const daysUntilDue =
    daysBetween(now, dueAt);

  const soonThresholdDays =
    Math.max(
      1,
      options.soonThresholdDays ?? 2,
    );

  let dueStatus:
    CandidateLifecycleDueStatus;

  if (daysUntilDue < 0) {
    dueStatus = "overdue";
  } else if (daysUntilDue === 0) {
    dueStatus = "today";
  } else if (
    daysUntilDue <= soonThresholdDays
  ) {
    dueStatus = "soon";
  } else {
    dueStatus = "scheduled";
  }

  const effectivePriority =
    escalatePriority(
      lifecycle.priority,
      dueStatus,
    );

  return {
    candidateId:
      lifecycle.candidateId,
    stage:
      lifecycle.stage,
    nextAction:
      lifecycle.nextAction,
    dueAt:
      lifecycle.nextActionDueAt,
    dueStatus,
    daysUntilDue,
    reminderLabel:
      reminderLabel(
        dueStatus,
        daysUntilDue,
        false,
      ),
    effectivePriority,
    requiresAttention:
      dueStatus === "overdue" ||
      dueStatus === "today" ||
      dueStatus === "soon",
    terminal:
      false,
    sourcePriority:
      lifecycle.priority,
    evaluatedAt,
  };
}

export function evaluateCandidateLifecycleReminders(
  lifecycles: CandidateLifecycleRecord[],
  options: CandidateLifecycleReminderOptions = {},
) {
  return lifecycles.map((lifecycle) =>
    evaluateCandidateLifecycleReminder(
      lifecycle,
      options,
    ),
  );
}