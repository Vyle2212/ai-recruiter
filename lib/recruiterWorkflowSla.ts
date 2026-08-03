import type {
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";
import type {
  RecruiterCopilotContext,
} from "./recruiterCopilotContext";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type RecruiterWorkflowSlaStatus =
  | "compliant"
  | "warning"
  | "violated"
  | "terminal";

export type RecruiterWorkflowSlaCandidate = {
  candidateId: string;
  candidateName: string;
  stage: CandidatePipelineStage;
  ownerName: string | null;

  stageStartedAt: string;
  daysInStage: number;

  slaDays: number;
  remainingDays: number;

  status: RecruiterWorkflowSlaStatus;
  violationDays: number;

  nextAction: string;
  nextActionDueAt: string | null;
  dueStatus: string;

  href: string;
};

export type RecruiterWorkflowSlaStage = {
  stage: CandidatePipelineStage;
  candidateCount: number;

  slaDays: number;

  compliant: number;
  warning: number;
  violated: number;

  compliancePercentage: number;

  averageDaysInStage: number;
  maximumDaysInStage: number;

  oldestCandidateId: string | null;
  oldestCandidateName: string | null;
};

export type RecruiterWorkflowSlaReport = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    totalCandidates: number;
    activeCandidates: number;

    compliant: number;
    warning: number;
    violated: number;
    terminal: number;

    compliancePercentage: number;

    overdueFollowUps: number;
    dueToday: number;
    dueSoon: number;

    averageDaysInStage: number;
    maximumDaysInStage: number;
  };

  stageSummary: RecruiterWorkflowSlaStage[];
  candidateRisks: RecruiterWorkflowSlaCandidate[];

  configuration: {
    stageSlaDays: Record<CandidatePipelineStage, number>;
    warningWindowDays: number;
  };

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

export type RecruiterWorkflowSlaOptions = {
  now?: string | Date;
  generatedAt?: string;
  warningWindowDays?: number;
  stageSlaDays?: Partial<
    Record<CandidatePipelineStage, number>
  >;
  candidateLimit?: number;
};

export const DEFAULT_STAGE_SLA_DAYS: Record<
  CandidatePipelineStage,
  number
> = {
  sourced: 7,
  screening: 5,
  submitted: 5,
  interview: 7,
  offer: 5,
  hired: 0,
  rejected: 0,
  on_hold: 14,
};

const TERMINAL_STAGES =
  new Set<CandidatePipelineStage>([
    "hired",
    "rejected",
  ]);

function parseClock(
  value?: string | Date,
) {
  if (!value) {
    return new Date();
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Workflow SLA received an invalid evaluation clock.",
    );
  }

  return date;
}

function parseDate(
  value: unknown,
) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function round(
  value: number,
  digits = 2,
) {
  const factor =
    10 ** digits;

  return Math.round(value * factor) /
    factor;
}

function percentage(
  numerator: number,
  denominator: number,
) {
  if (denominator <= 0) {
    return 100;
  }

  return round(
    (numerator / denominator) * 100,
  );
}

function daysBetween(
  from: Date,
  to: Date,
) {
  return Math.max(
    0,
    round(
      (to.getTime() - from.getTime()) /
        86_400_000,
    ),
  );
}

function stageStartedAt(
  state: PersistedWorkflowState,
) {
  const lifecycle =
    state.lifecycle;

  if (!lifecycle) {
    return (
      parseDate(state.lastUpdatedAt) ||
      new Date(0)
    );
  }

  const currentStage =
    lifecycle.stage;

  const matchingEvents =
    lifecycle.history
      .filter(
        (event) =>
          event.toStage === currentStage,
      )
      .map((event) =>
        parseDate(event.occurredAt),
      )
      .filter(
        (date): date is Date =>
          Boolean(date),
      )
      .sort(
        (left, right) =>
          right.getTime() -
          left.getTime(),
      );

  return (
    matchingEvents[0] ||
    parseDate(
      lifecycle.lastActivityAt,
    ) ||
    parseDate(
      lifecycle.updatedAt,
    ) ||
    parseDate(
      state.lastUpdatedAt,
    ) ||
    new Date(0)
  );
}

function dueStatusByCandidate(
  context: RecruiterCopilotContext,
) {
  return new Map(
    context.reminders.map(
      (reminder) => [
        reminder.candidateId,
        reminder.dueStatus,
      ],
    ),
  );
}

function buildCandidateSla(
  state: PersistedWorkflowState,
  now: Date,
  stageSlaDays: Record<
    CandidatePipelineStage,
    number
  >,
  warningWindowDays: number,
  dueStatusMap: Map<string, string>,
): RecruiterWorkflowSlaCandidate | null {
  const lifecycle =
    state.lifecycle;

  if (!lifecycle) {
    return null;
  }

  const stage =
    lifecycle.stage;

  const startedAt =
    stageStartedAt(state);

  const daysInStage =
    daysBetween(startedAt, now);

  const slaDays =
    stageSlaDays[stage];

  const terminal =
    TERMINAL_STAGES.has(stage);

  const remainingDays =
    terminal
      ? 0
      : round(
          slaDays - daysInStage,
        );

  const violationDays =
    terminal
      ? 0
      : Math.max(
          0,
          round(
            daysInStage - slaDays,
          ),
        );

  let status:
    RecruiterWorkflowSlaStatus;

  if (terminal) {
    status = "terminal";
  } else if (
    daysInStage > slaDays
  ) {
    status = "violated";
  } else if (
    remainingDays <=
    warningWindowDays
  ) {
    status = "warning";
  } else {
    status = "compliant";
  }

  return {
    candidateId:
      lifecycle.candidateId,

    candidateName:
      lifecycle.candidateName,

    stage,

    ownerName:
      lifecycle.ownerName || null,

    stageStartedAt:
      startedAt.toISOString(),

    daysInStage,
    slaDays,
    remainingDays,
    status,
    violationDays,

    nextAction:
      lifecycle.nextAction,

    nextActionDueAt:
      lifecycle.nextActionDueAt,

    dueStatus:
      dueStatusMap.get(
        lifecycle.candidateId,
      ) || "none",

    href:
      `/recruiter/candidate360/${encodeURIComponent(
        lifecycle.candidateId,
      )}`,
  };
}

function buildStageSummary(
  candidates:
    RecruiterWorkflowSlaCandidate[],
  stageSlaDays: Record<
    CandidatePipelineStage,
    number
  >,
): RecruiterWorkflowSlaStage[] {
  return (
    Object.keys(
      stageSlaDays,
    ) as CandidatePipelineStage[]
  ).map((stage) => {
    const stageCandidates =
      candidates.filter(
        (candidate) =>
          candidate.stage === stage,
      );

    const activeCandidates =
      stageCandidates.filter(
        (candidate) =>
          candidate.status !==
          "terminal",
      );

    const oldest =
      [...stageCandidates].sort(
        (left, right) =>
          right.daysInStage -
          left.daysInStage,
      )[0];

    const compliant =
      stageCandidates.filter(
        (candidate) =>
          candidate.status ===
          "compliant",
      ).length;

    const warning =
      stageCandidates.filter(
        (candidate) =>
          candidate.status ===
          "warning",
      ).length;

    const violated =
      stageCandidates.filter(
        (candidate) =>
          candidate.status ===
          "violated",
      ).length;

    return {
      stage,
      candidateCount:
        stageCandidates.length,

      slaDays:
        stageSlaDays[stage],

      compliant,
      warning,
      violated,

      compliancePercentage:
        percentage(
          compliant + warning,
          activeCandidates.length,
        ),

      averageDaysInStage:
        stageCandidates.length
          ? round(
              stageCandidates.reduce(
                (total, candidate) =>
                  total +
                  candidate.daysInStage,
                0,
              ) /
                stageCandidates.length,
            )
          : 0,

      maximumDaysInStage:
        oldest?.daysInStage || 0,

      oldestCandidateId:
        oldest?.candidateId || null,

      oldestCandidateName:
        oldest?.candidateName || null,
    };
  });
}

function riskWeight(
  candidate:
    RecruiterWorkflowSlaCandidate,
) {
  if (
    candidate.status === "violated"
  ) {
    return 4;
  }

  if (
    candidate.status === "warning"
  ) {
    return 3;
  }

  if (
    candidate.status === "compliant"
  ) {
    return 2;
  }

  return 1;
}

export function buildRecruiterWorkflowSlaReport(
  states: PersistedWorkflowState[],
  context: RecruiterCopilotContext,
  options: RecruiterWorkflowSlaOptions = {},
): RecruiterWorkflowSlaReport {
  const now =
    parseClock(options.now);

  const generatedAt =
    options.generatedAt ||
    context.generatedAt ||
    now.toISOString();

  const warningWindowDays =
    Math.max(
      0,
      options.warningWindowDays ?? 1,
    );

  const stageSlaDays = {
    ...DEFAULT_STAGE_SLA_DAYS,
    ...(options.stageSlaDays || {}),
  };

  const dueStatusMap =
    dueStatusByCandidate(context);

  const allCandidates =
    states
      .map((state) =>
        buildCandidateSla(
          state,
          now,
          stageSlaDays,
          warningWindowDays,
          dueStatusMap,
        ),
      )
      .filter(
        (
          candidate,
        ): candidate is RecruiterWorkflowSlaCandidate =>
          Boolean(candidate),
      );

  const activeCandidates =
    allCandidates.filter(
      (candidate) =>
        candidate.status !==
        "terminal",
    );

  const compliant =
    activeCandidates.filter(
      (candidate) =>
        candidate.status ===
        "compliant",
    ).length;

  const warning =
    activeCandidates.filter(
      (candidate) =>
        candidate.status ===
        "warning",
    ).length;

  const violated =
    activeCandidates.filter(
      (candidate) =>
        candidate.status ===
        "violated",
    ).length;

  const candidateLimit =
    Math.max(
      0,
      Math.min(
        options.candidateLimit ?? 100,
        500,
      ),
    );

  const candidateRisks =
    [...activeCandidates]
      .sort((left, right) => {
        const statusDifference =
          riskWeight(right) -
          riskWeight(left);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        if (
          right.violationDays !==
          left.violationDays
        ) {
          return (
            right.violationDays -
            left.violationDays
          );
        }

        return (
          right.daysInStage -
          left.daysInStage
        );
      })
      .slice(0, candidateLimit);

  const maximumDaysInStage =
    activeCandidates.length
      ? Math.max(
          ...activeCandidates.map(
            (candidate) =>
              candidate.daysInStage,
          ),
        )
      : 0;

  const averageDaysInStage =
    activeCandidates.length
      ? round(
          activeCandidates.reduce(
            (total, candidate) =>
              total +
              candidate.daysInStage,
            0,
          ) /
            activeCandidates.length,
        )
      : 0;

  return {
    generatedAt,
    evaluatedAt:
      now.toISOString(),

    summary: {
      totalCandidates:
        allCandidates.length,

      activeCandidates:
        activeCandidates.length,

      compliant,
      warning,
      violated,

      terminal:
        allCandidates.length -
        activeCandidates.length,

      compliancePercentage:
        percentage(
          compliant + warning,
          activeCandidates.length,
        ),

      overdueFollowUps:
        context.summary
          .overdueFollowUps,

      dueToday:
        context.summary.dueToday,

      dueSoon:
        context.summary.dueSoon,

      averageDaysInStage,
      maximumDaysInStage,
    },

    stageSummary:
      buildStageSummary(
        allCandidates,
        stageSlaDays,
      ),

    candidateRisks,

    configuration: {
      stageSlaDays,
      warningWindowDays,
    },

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
      "deterministic read-only recruiter workflow SLA report calculated from persisted lifecycle state; no candidate DB writes; no workflow writes; no email sends; no push sends; no OpenAI calls",
  };
}