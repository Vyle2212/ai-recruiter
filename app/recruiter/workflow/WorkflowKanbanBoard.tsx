import Link from "next/link";

import {
  CANDIDATE_PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type CandidateLifecycleRecord,
} from "@/lib/candidateLifecycleTypes";

export type WorkflowBoardItem = {
  actionId: string;
  candidateId: string;
  candidateName: string;
  currentStatus: string;
  recommendedNextAction: string;
  reason: string;
  priority: "high" | "medium" | "low";
  missingData: string[];
  lastUpdated: string;
  safetyNote: string;
  lifecycle?: CandidateLifecycleRecord | null;
};

function priorityTone(priority: WorkflowBoardItem["priority"]) {
  if (priority === "high") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }

  if (priority === "medium") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-600 bg-slate-500/10 text-slate-200";
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
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

export function WorkflowKanbanBoard({
  items,
}: {
  items: WorkflowBoardItem[];
}) {
  return (
    <section
      aria-label="Recruiter workflow board"
      className="rounded-xl border border-slate-800 bg-[#0B0F16] p-4"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">
            Candidate Workflow Board
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Read-only pipeline view. Open Candidate360 to review or update a candidate.
          </p>
        </div>

        <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100">
          {items.length} candidate{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[2500px] grid-cols-8 gap-3">
          {CANDIDATE_PIPELINE_STAGES.map((stage) => {
            const stageItems = items.filter(
              (item) => (item.lifecycle?.stage || "sourced") === stage,
            );

            return (
              <div
                className="min-h-[420px] rounded-xl border border-slate-800 bg-[#070A0F]"
                data-stage={stage}
                key={stage}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-800 bg-[#070A0F] px-3 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                      {PIPELINE_STAGE_LABELS[stage]}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Pipeline stage
                    </div>
                  </div>

                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300">
                    {stageItems.length}
                  </span>
                </div>

                <div className="space-y-3 p-3">
                  {stageItems.map((item) => {
                    const lifecycle = item.lifecycle;

                    return (
                      <article
                        className="rounded-lg border border-slate-700 bg-[#0B0F16] p-3 shadow-sm transition hover:border-cyan-500/40"
                        key={item.actionId}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            className="font-semibold text-white hover:text-cyan-200"
                            href={`/recruiter/candidate360/${item.candidateId}`}
                          >
                            {item.candidateName}
                          </Link>

                          <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${priorityTone(
                              item.priority,
                            )}`}
                          >
                            {item.priority}
                          </span>
                        </div>

                        <div className="mt-1 break-all text-[10px] text-slate-600">
                          {item.candidateId}
                        </div>

                        <dl className="mt-3 space-y-2 text-xs">
                          <div>
                            <dt className="text-slate-500">Owner</dt>
                            <dd className="mt-0.5 text-slate-200">
                              {lifecycle?.ownerName || "Unassigned"}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-slate-500">Next action</dt>
                            <dd className="mt-0.5 text-cyan-100">
                              {formatLabel(
                                lifecycle?.nextAction ||
                                  item.recommendedNextAction,
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-slate-500">Due date</dt>
                            <dd className="mt-0.5 text-slate-300">
                              {formatDate(lifecycle?.nextActionDueAt)}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-slate-500">Missing data</dt>
                            <dd className="mt-0.5 text-slate-300">
                              {item.missingData.length
                                ? item.missingData.slice(0, 3).join(", ")
                                : "None"}
                            </dd>

                            {item.missingData.length > 3 ? (
                              <div className="mt-1 text-[10px] text-amber-200">
                                +{item.missingData.length - 3} more
                              </div>
                            ) : null}
                          </div>
                        </dl>

                        <div className="mt-3 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
                          Legacy: {formatLabel(item.currentStatus)}
                        </div>

                        <Link
                          className="mt-3 block rounded-md border border-cyan-500/30 px-3 py-2 text-center text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                          href={`/recruiter/candidate360/${item.candidateId}`}
                        >
                          Open Candidate360
                        </Link>
                      </article>
                    );
                  })}

                  {!stageItems.length ? (
                    <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-600">
                      No candidates
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        Scroll horizontally to review all eight lifecycle stages.
      </div>
    </section>
  );
}