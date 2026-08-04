import type {
  CandidateLifecycleEvent,
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type RecruiterWorkflowTimelineEventType =
  | "candidate_created"
  | "stage_transition"
  | "rollback"
  | "recruiter_action"
  | "system_event";

export type RecruiterWorkflowTimelineItem = {
  timelineId: string;
  candidateId: string;
  candidateName: string;

  eventType: RecruiterWorkflowTimelineEventType;

  title: string;
  description: string;

  fromStage: CandidatePipelineStage | null;
  toStage: CandidatePipelineStage | null;

  action: string | null;
  note: string | null;

  actorId: string | null;
  actorName: string | null;
  source: string;

  occurredAt: string;

  href: string;

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    readOnly: true;
  };
};

export type RecruiterWorkflowTimelineFeed = {
  generatedAt: string;

  summary: {
    totalEvents: number;
    candidateCreated: number;
    stageTransitions: number;
    rollbacks: number;
    recruiterActions: number;
    candidatesRepresented: number;
  };

  events: RecruiterWorkflowTimelineItem[];

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

export type RecruiterWorkflowTimelineOptions = {
  limit?: number;
  candidateId?: string;
  eventType?: RecruiterWorkflowTimelineEventType;
  from?: string | Date;
  to?: string | Date;
  generatedAt?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function readable(value: string | null) {
  return value
    ? value.replace(/_/g, " ")
    : "";
}

function eventTypeFromLifecycleEvent(
  event: CandidateLifecycleEvent,
): RecruiterWorkflowTimelineEventType {
  const source =
    clean(event.source).toLowerCase();

  const action =
    clean(event.action).toLowerCase();

  if (
    source.includes("rollback") ||
    action.includes("rollback")
  ) {
    return "rollback";
  }

  if (
    event.fromStage &&
    event.toStage &&
    event.fromStage !== event.toStage
  ) {
    return "stage_transition";
  }

  if (
    source.includes("recruiter") ||
    Boolean(event.actorId) ||
    Boolean(event.actorName)
  ) {
    return "recruiter_action";
  }

  return "system_event";
}

function titleFromLifecycleEvent(
  event: CandidateLifecycleEvent,
  eventType: RecruiterWorkflowTimelineEventType,
) {
  if (eventType === "rollback") {
    return event.fromStage && event.toStage
      ? `Stage rolled back from ${readable(
          event.fromStage,
        )} to ${readable(event.toStage)}`
      : "Lifecycle stage rolled back";
  }

  if (
    eventType === "stage_transition" &&
    event.fromStage &&
    event.toStage
  ) {
    return `Moved from ${readable(
      event.fromStage,
    )} to ${readable(event.toStage)}`;
  }

  if (event.action) {
    return readable(event.action);
  }

  return "Workflow activity recorded";
}

function descriptionFromLifecycleEvent(
  event: CandidateLifecycleEvent,
) {
  if (clean(event.note)) {
    return clean(event.note);
  }

  if (
    event.fromStage &&
    event.toStage &&
    event.fromStage !== event.toStage
  ) {
    return `Candidate lifecycle changed from ${readable(
      event.fromStage,
    )} to ${readable(event.toStage)}.`;
  }

  if (event.action) {
    return `Workflow action: ${readable(
      event.action,
    )}.`;
  }

  return "Workflow activity was recorded for this candidate.";
}

function createdEventFromState(
  state: PersistedWorkflowState,
): RecruiterWorkflowTimelineItem | null {
  const lifecycle =
    state.lifecycle;

  if (!lifecycle) {
    return null;
  }

  const occurredAt =
    parseDate(lifecycle.createdAt) ||
    parseDate(state.lastUpdatedAt);

  if (!occurredAt) {
    return null;
  }

  return {
    timelineId:
      `workflow-timeline:${lifecycle.candidateId}:created`,

    candidateId:
      lifecycle.candidateId,

    candidateName:
      lifecycle.candidateName,

    eventType:
      "candidate_created",

    title:
      "Candidate lifecycle created",

    description:
      `Candidate entered the workflow at ${readable(
        lifecycle.stage,
      )}.`,

    fromStage: null,
    toStage:
      lifecycle.stage,

    action:
      "create_candidate_lifecycle",

    note: null,

    actorId:
      lifecycle.ownerId || null,

    actorName:
      lifecycle.ownerName || null,

    source:
      lifecycle.source || "system",

    occurredAt:
      occurredAt.toISOString(),

    href:
      `/recruiter/candidate360/${encodeURIComponent(
        lifecycle.candidateId,
      )}`,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      readOnly: true,
    },
  };
}

function timelineItemFromLifecycleEvent(
  state: PersistedWorkflowState,
  event: CandidateLifecycleEvent,
): RecruiterWorkflowTimelineItem | null {
  const lifecycle =
    state.lifecycle;

  if (!lifecycle) {
    return null;
  }

  const occurredAt =
    parseDate(event.occurredAt);

  if (!occurredAt) {
    return null;
  }

  const eventType =
    eventTypeFromLifecycleEvent(event);

  return {
    timelineId:
      event.eventId ||
      `workflow-timeline:${lifecycle.candidateId}:${occurredAt.toISOString()}`,

    candidateId:
      lifecycle.candidateId,

    candidateName:
      lifecycle.candidateName,

    eventType,

    title:
      titleFromLifecycleEvent(
        event,
        eventType,
      ),

    description:
      descriptionFromLifecycleEvent(
        event,
      ),

    fromStage:
      event.fromStage || null,

    toStage:
      event.toStage || null,

    action:
      event.action || null,

    note:
      event.note || null,

    actorId:
      event.actorId || null,

    actorName:
      event.actorName || null,

    source:
      event.source || "system",

    occurredAt:
      occurredAt.toISOString(),

    href:
      `/recruiter/candidate360/${encodeURIComponent(
        lifecycle.candidateId,
      )}`,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      readOnly: true,
    },
  };
}

function parseBoundary(
  value?: string | Date,
) {
  if (!value) return null;

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function buildRecruiterWorkflowTimeline(
  states: PersistedWorkflowState[],
  options: RecruiterWorkflowTimelineOptions = {},
): RecruiterWorkflowTimelineFeed {
  const from =
    parseBoundary(options.from);

  const to =
    parseBoundary(options.to);

  const candidateId =
    clean(options.candidateId);

  const allEvents =
    states.flatMap((state) => {
      const lifecycle =
        state.lifecycle;

      if (!lifecycle) {
        return [];
      }

      const created =
        createdEventFromState(state);

      const history =
        lifecycle.history
          .map((event) =>
            timelineItemFromLifecycleEvent(
              state,
              event,
            ),
          )
          .filter(
            (
              event,
            ): event is RecruiterWorkflowTimelineItem =>
              Boolean(event),
          );

      return [
        ...(created ? [created] : []),
        ...history,
      ];
    });

  const filtered =
    allEvents
      .filter((event) => {
        if (
          candidateId &&
          event.candidateId !== candidateId
        ) {
          return false;
        }

        if (
          options.eventType &&
          event.eventType !== options.eventType
        ) {
          return false;
        }

        const occurredAt =
          Date.parse(event.occurredAt);

        if (
          from &&
          occurredAt < from.getTime()
        ) {
          return false;
        }

        if (
          to &&
          occurredAt > to.getTime()
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (left, right) =>
          Date.parse(right.occurredAt) -
          Date.parse(left.occurredAt),
      );

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 200,
        1000,
      ),
    );

  const events =
    filtered.slice(0, limit);

  return {
    generatedAt:
      options.generatedAt ||
      new Date().toISOString(),

    summary: {
      totalEvents:
        events.length,

      candidateCreated:
        events.filter(
          (event) =>
            event.eventType ===
            "candidate_created",
        ).length,

      stageTransitions:
        events.filter(
          (event) =>
            event.eventType ===
            "stage_transition",
        ).length,

      rollbacks:
        events.filter(
          (event) =>
            event.eventType ===
            "rollback",
        ).length,

      recruiterActions:
        events.filter(
          (event) =>
            event.eventType ===
            "recruiter_action",
        ).length,

      candidatesRepresented:
        new Set(
          events.map(
            (event) =>
              event.candidateId,
          ),
        ).size,
    },

    events,

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
      "deterministic read-only recruiter workflow timeline generated from persisted lifecycle history; no candidate DB writes; no workflow writes; no email sends; no push sends; no OpenAI calls",
  };
}