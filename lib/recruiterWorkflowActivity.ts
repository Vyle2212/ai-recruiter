import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
  CandidatePipelineStage,
  CandidateLifecycleSource,
} from "./candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type RecruiterWorkflowActivityType =
  | "stage_transition"
  | "rollback";

export type RecruiterWorkflowActivity = {
  activityId: string;
  candidateId: string;
  candidateName: string;
  activityType: RecruiterWorkflowActivityType;
  fromStage: CandidatePipelineStage | null;
  toStage: CandidatePipelineStage;
  action: CandidateLifecycleEvent["action"];
  actorId: string | null;
  actorName: string | null;
  actorLabel: string;
  note: string;
  occurredAt: string;
  source: CandidateLifecycleSource;
  metadata: {
    lifecycleEventId: string;
    rollback: boolean;
  };
};

export type RecruiterWorkflowActivityFeed = {
  generatedAt: string;
  total: number;
  activities: RecruiterWorkflowActivity[];
  mode: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function actorLabel(event: CandidateLifecycleEvent) {
  return (
    clean(event.actorName) ||
    clean(event.actorId) ||
    "System / unknown actor"
  );
}

function activityType(
  event: CandidateLifecycleEvent,
): RecruiterWorkflowActivityType {
  return event.eventId.startsWith(
    "lifecycle-rollback:",
  )
    ? "rollback"
    : "stage_transition";
}

export function normalizeLifecycleEvent(
  event: CandidateLifecycleEvent,
  candidateName?: string,
): RecruiterWorkflowActivity {
  const rollback =
    activityType(event) === "rollback";

  return {
    activityId: event.eventId,
    candidateId: event.candidateId,
    candidateName:
      clean(candidateName) ||
      event.candidateId,
    activityType:
      rollback
        ? "rollback"
        : "stage_transition",
    fromStage: event.fromStage,
    toStage: event.toStage,
    action: event.action,
    actorId: event.actorId,
    actorName: event.actorName,
    actorLabel: actorLabel(event),
    note: event.note,
    occurredAt: event.occurredAt,
    source: event.source,
    metadata: {
      lifecycleEventId:
        event.eventId,
      rollback,
    },
  };
}

export function activitiesFromLifecycle(
  lifecycle: CandidateLifecycleRecord,
) {
  return lifecycle.history.map(
    (event) =>
      normalizeLifecycleEvent(
        event,
        lifecycle.candidateName,
      ),
  );
}

export function activitiesFromPersistedStates(
  states: PersistedWorkflowState[],
) {
  const activities =
    states.flatMap((state) => {
      const lifecycle =
        state.lifecycle;

      if (!lifecycle) return [];

      return lifecycle.history.map(
        (event) =>
          normalizeLifecycleEvent(
            event,
            lifecycle.candidateName ||
              state.displayName,
          ),
      );
    });

  return activities.sort(
    (left, right) =>
      Date.parse(right.occurredAt) -
      Date.parse(left.occurredAt),
  );
}

export function buildRecruiterWorkflowActivityFeed(
  states: PersistedWorkflowState[],
  options: {
    generatedAt?: string;
    candidateId?: string;
    limit?: number;
  } = {},
): RecruiterWorkflowActivityFeed {
  const generatedAt =
    options.generatedAt ||
    new Date().toISOString();

  let activities =
    activitiesFromPersistedStates(
      states,
    );

  if (options.candidateId) {
    activities = activities.filter(
      (activity) =>
        activity.candidateId ===
        options.candidateId,
    );
  }

  const limit =
    typeof options.limit === "number"
      ? Math.max(0, options.limit)
      : null;

  if (limit !== null) {
    activities =
      activities.slice(0, limit);
  }

  return {
    generatedAt,
    total: activities.length,
    activities,
    mode:
      "read-only normalized workflow activity from lifecycle history; no candidate DB writes; no workflow writes",
  };
}