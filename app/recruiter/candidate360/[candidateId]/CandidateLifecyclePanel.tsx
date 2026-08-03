import { CandidateLifecycleTimeline } from "./CandidateLifecycleTimeline";
import { CandidateLifecycleControls } from "./CandidateLifecycleControls";

import {
  PIPELINE_STAGE_LABELS,
  type CandidateLifecycleRecord,
  type CandidatePipelineStage,
} from "@/lib/candidateLifecycleTypes";

const PRIMARY_STAGES: CandidatePipelineStage[] = [
  "sourced",
  "screening",
  "submitted",
  "interview",
  "offer",
  "hired",
];

const TERMINAL_STAGES: CandidatePipelineStage[] = [
  "rejected",
  "on_hold",
];

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function stageTone(stage: CandidatePipelineStage) {
  switch (stage) {
    case "sourced":
      return "border-slate-600 bg-slate-500/10 text-slate-200";
    case "screening":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "submitted":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-100";
    case "interview":
      return "border-violet-500/40 bg-violet-500/10 text-violet-100";
    case "offer":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
    case "hired":
      return "border-green-500/40 bg-green-500/10 text-green-100";
    case "rejected":
      return "border-red-500/40 bg-red-500/10 text-red-100";
    case "on_hold":
      return "border-slate-600 bg-slate-800 text-slate-300";
  }
}

function priorityTone(
  priority: CandidateLifecycleRecord["priority"],
) {
  if (priority === "high") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }

  if (priority === "medium") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-600 bg-slate-800 text-slate-300";
}

export function CandidateLifecyclePanel({
  lifecycle,
}: {
  lifecycle: CandidateLifecycleRecord;
}) {
  const currentPrimaryIndex =
    PRIMARY_STAGES.indexOf(lifecycle.stage);

  const isTerminal =
    TERMINAL_STAGES.includes(lifecycle.stage);

  return (
    <section className="rounded-xl border border-slate-800 bg-[#0B0F16] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Candidate Lifecycle
          </div>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Recruitment Pipeline
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Unified read-only lifecycle derived from the current
            candidate and workflow state.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${stageTone(
              lifecycle.stage,
            )}`}
          >
            {PIPELINE_STAGE_LABELS[lifecycle.stage]}
          </span>

          <span
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${priorityTone(
              lifecycle.priority,
            )}`}
          >
            {formatLabel(lifecycle.priority)} priority
          </span>

          <span className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400">
            {formatLabel(lifecycle.source)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-[#05070A] p-4">
          <div className="text-xs uppercase text-slate-500">
            Owner
          </div>

          <div className="mt-2 font-semibold text-white">
            {lifecycle.ownerName || "Unassigned"}
          </div>

          {lifecycle.ownerId ? (
            <div className="mt-1 text-xs text-slate-500">
              {lifecycle.ownerId}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#05070A] p-4">
          <div className="text-xs uppercase text-slate-500">
            Next action
          </div>

          <div className="mt-2 font-semibold text-cyan-100">
            {formatLabel(lifecycle.nextAction)}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {lifecycle.nextActionNote ||
              "No additional instruction provided."}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#05070A] p-4">
          <div className="text-xs uppercase text-slate-500">
            Due date
          </div>

          <div className="mt-2 font-semibold text-white">
            {formatDate(lifecycle.nextActionDueAt)}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Next follow-up deadline
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#05070A] p-4">
          <div className="text-xs uppercase text-slate-500">
            Last activity
          </div>

          <div className="mt-2 font-semibold text-white">
            {formatDate(lifecycle.lastActivityAt)}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Updated {formatDate(lifecycle.updatedAt)}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Pipeline progress
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-6">
          {PRIMARY_STAGES.map((stage, index) => {
            const current = lifecycle.stage === stage;
            const completed =
              !isTerminal &&
              currentPrimaryIndex >= 0 &&
              index < currentPrimaryIndex;

            return (
              <div
                className="relative"
                key={stage}
              >
                <div
                  className={`rounded-lg border p-3 ${
                    current
                      ? stageTone(stage)
                      : completed
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100"
                        : "border-slate-800 bg-[#05070A] text-slate-500"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase">
                    {completed
                      ? "Completed"
                      : current
                        ? "Current"
                        : "Pending"}
                  </div>

                  <div className="mt-1 text-sm font-semibold">
                    {PIPELINE_STAGE_LABELS[stage]}
                  </div>
                </div>

                {index < PRIMARY_STAGES.length - 1 ? (
                  <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-slate-600 md:block">
                    ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {isTerminal ? (
          <div
            className={`mt-3 rounded-lg border p-4 ${stageTone(
              lifecycle.stage,
            )}`}
          >
            <div className="text-xs font-semibold uppercase">
              Current terminal status
            </div>

            <div className="mt-1 text-lg font-semibold">
              {PIPELINE_STAGE_LABELS[lifecycle.stage]}
            </div>
          </div>
        ) : null}
      </div>

      <CandidateLifecycleControls lifecycle={lifecycle} />

      <CandidateLifecycleTimeline history={lifecycle.history} />

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Activity history
          </div>

          <span className="text-xs text-slate-500">
            {lifecycle.history.length} event
            {lifecycle.history.length === 1 ? "" : "s"}
          </span>
        </div>

        {lifecycle.history.length ? (
          <div className="mt-3 space-y-3">
            {lifecycle.history.map((event) => (
              <div
                className="border-l-2 border-cyan-500/40 pl-4"
                key={event.eventId}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">
                    {event.fromStage
                      ? `${PIPELINE_STAGE_LABELS[event.fromStage]} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `
                      : ""}
                    {PIPELINE_STAGE_LABELS[event.toStage]}
                  </span>

                  <span className="text-xs text-slate-500">
                    {formatDate(event.occurredAt)}
                  </span>
                </div>

                <div className="mt-1 text-sm text-slate-400">
                  {event.note ||
                    formatLabel(event.action)}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {event.actorName ||
                    event.actorId ||
                    formatLabel(event.source)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-slate-800 bg-[#05070A] p-4 text-sm text-slate-400">
            No persisted lifecycle history is available yet.
            The current stage is inferred without database writes.
          </div>
        )}
      </div>
    </section>
  );
}