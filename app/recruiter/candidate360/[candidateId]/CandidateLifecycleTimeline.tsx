import {
  PIPELINE_STAGE_LABELS,
  type CandidateLifecycleEvent,
} from "@/lib/candidateLifecycleTypes";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventTone(event: CandidateLifecycleEvent) {
  if (event.eventId.startsWith("lifecycle-rollback:")) {
    return {
      dot: "border-amber-300 bg-amber-400",
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-100",
      label: "Rollback",
    };
  }

  if (event.toStage === "rejected") {
    return {
      dot: "border-red-300 bg-red-400",
      badge:
        "border-red-500/30 bg-red-500/10 text-red-100",
      label: "Rejected",
    };
  }

  if (event.toStage === "hired") {
    return {
      dot: "border-emerald-300 bg-emerald-400",
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
      label: "Placement",
    };
  }

  return {
    dot: "border-cyan-300 bg-cyan-400",
    badge:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    label: "Stage update",
  };
}

function actorLabel(event: CandidateLifecycleEvent) {
  return (
    event.actorName ||
    event.actorId ||
    "System / unknown actor"
  );
}

export function CandidateLifecycleTimeline({
  history,
}: {
  history: CandidateLifecycleEvent[];
}) {
  const events = [...history].sort(
    (left, right) =>
      Date.parse(right.occurredAt) -
      Date.parse(left.occurredAt),
  );

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-[#070A0F] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
            Activity feed
          </div>

          <h3 className="mt-2 font-semibold text-white">
            Lifecycle timeline
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            Stage changes, rollback actions, actor details, notes,
            and timestamps from persisted lifecycle history.
          </p>
        </div>

        <span className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      {events.length ? (
        <ol className="relative mt-6 border-l border-slate-700 pl-6">
          {events.map((event) => {
            const tone = eventTone(event);

            return (
              <li
                className="relative pb-7 last:pb-0"
                key={event.eventId}
              >
                <span
                  className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 ${tone.dot}`}
                />

                <div className="rounded-lg border border-slate-800 bg-[#0B0F16] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${tone.badge}`}
                        >
                          {tone.label}
                        </span>

                        <span className="text-sm font-semibold text-white">
                          {(event.fromStage ? PIPELINE_STAGE_LABELS[event.fromStage] : "Start")}
                          {" â†’ "}
                          {PIPELINE_STAGE_LABELS[event.toStage]}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        Action:{" "}
                        {event.action.replace(/_/g, " ")}
                      </div>
                    </div>

                    <time
                      className="text-xs text-slate-500"
                      dateTime={event.occurredAt}
                    >
                      {formatDate(event.occurredAt)}
                    </time>
                  </div>

                  <div className="mt-3 text-sm text-slate-200">
                    {event.note}
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-slate-800 pt-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="text-slate-500">
                        Actor
                      </div>
                      <div className="mt-1 text-slate-300">
                        {actorLabel(event)}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">
                        Source
                      </div>
                      <div className="mt-1 text-slate-300">
                        {event.source.replace(/_/g, " ")}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-800 p-5 text-center text-sm text-slate-500">
          No lifecycle events have been recorded yet.
        </div>
      )}
    </section>
  );
}