"use client";

import Link from "next/link";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useMemo, useState } from "react";

import {
  CANDIDATE_PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type CandidateLifecycleRecord,
  type CandidatePipelineStage,
} from "@/lib/candidateLifecycleTypes";
import {
  findCandidateLifecycleTransition,
} from "@/lib/candidateLifecycleTransitions";

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

type MoveStageResponse = {
  ok?: boolean;
  status?: number;
  executed?: boolean;
  error?: string;
  decision?: {
    allowed: boolean;
    blockers: string[];
    warnings: string[];
    next?: CandidateLifecycleRecord | null;
  };
  lifecycle?: CandidateLifecycleRecord;
  persistence?: {
    backupPath?: string | null;
    atomicWrite?: boolean;
    candidateDbWrites?: number;
  };
};

type PendingMove = {
  item: WorkflowBoardItem;
  fromStage: CandidatePipelineStage;
  toStage: CandidatePipelineStage;
  requiresNote: boolean;
  requiresDueDate: boolean;
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

function dateTimeLocalToIso(value: string) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export function WorkflowKanbanBoard({
  items,
}: {
  items: WorkflowBoardItem[];
}) {
  const [pendingMove, setPendingMove] =
    useState<PendingMove | null>(null);

  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [preview, setPreview] =
    useState<MoveStageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const groupedItems = useMemo(
    () =>
      Object.fromEntries(
        CANDIDATE_PIPELINE_STAGES.map((stage) => [
          stage,
          items.filter(
            (item) =>
              (item.lifecycle?.stage || "sourced") === stage,
          ),
        ]),
      ) as Record<CandidatePipelineStage, WorkflowBoardItem[]>,
    [items],
  );

  function resetDialog() {
    setPendingMove(null);
    setNote("");
    setDueAt("");
    setPreview(null);
    setMessage("");
    setLoading(false);
  }

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    const fromStage =
      source.droppableId as CandidatePipelineStage;

    const toStage =
      destination.droppableId as CandidatePipelineStage;

    if (fromStage === toStage) return;

    const item = items.find(
      (candidate) => candidate.actionId === draggableId,
    );

    if (!item) return;

    const rule = findCandidateLifecycleTransition(
      fromStage,
      toStage,
    );

    if (!rule) {
      setMessage(
        `Transition from ${PIPELINE_STAGE_LABELS[fromStage]} to ${PIPELINE_STAGE_LABELS[toStage]} is not allowed.`,
      );
      return;
    }

    setPendingMove({
      item,
      fromStage,
      toStage,
      requiresNote: rule.requiresNote,
      requiresDueDate: rule.requiresDueDate,
    });

    setNote("");
    setDueAt("");
    setPreview(null);
    setMessage("");
  }

  async function postMove(execute: boolean) {
    if (!pendingMove) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/recruiter/workflow/move-stage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: pendingMove.item.candidateId,
            toStage: pendingMove.toStage,
            expectedStage: pendingMove.fromStage,
            note,
            dueAt: dateTimeLocalToIso(dueAt),
            execute,
          }),
        },
      );

      const result =
        (await response.json()) as MoveStageResponse;

      if (execute && result.executed) {
        setMessage("Workflow stage updated successfully.");

        window.location.reload();
        return;
      }

      setPreview(result);

      if (result.error) {
        setMessage(result.error);
      } else if (result.decision?.allowed) {
        setMessage(
          "Preview approved. Review the transition and confirm.",
        );
      } else {
        setMessage(
          result.decision?.blockers?.join(" ") ||
            "The transition could not be approved.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to process workflow transition.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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
              Dragging creates a preview only. Workflow state changes
              only after explicit confirmation.
            </p>
          </div>

          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100">
            {items.length} candidate{items.length === 1 ? "" : "s"}
          </span>
        </div>

        {message && !pendingMove ? (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto pb-3">
            <div className="grid min-w-[2500px] grid-cols-8 gap-3">
              {CANDIDATE_PIPELINE_STAGES.map((stage) => {
                const stageItems = groupedItems[stage];

                return (
                  <Droppable
                    droppableId={stage}
                    key={stage}
                    type="candidate"
                  >
                    {(provided, snapshot) => (
                      <div
                        className={`min-h-[420px] rounded-xl border bg-[#070A0F] transition ${
                          snapshot.isDraggingOver
                            ? "border-cyan-400 bg-cyan-500/5"
                            : "border-slate-800"
                        }`}
                        data-stage={stage}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-800 bg-[#070A0F] px-3 py-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                              {PIPELINE_STAGE_LABELS[stage]}
                            </div>

                            <div className="mt-1 text-[11px] text-slate-500">
                              Drop to preview move
                            </div>
                          </div>

                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300">
                            {stageItems.length}
                          </span>
                        </div>

                        <div className="min-h-[340px] space-y-3 p-3">
                          {stageItems.map((item, index) => {
                            const lifecycle = item.lifecycle;

                            return (
                              <Draggable
                                draggableId={item.actionId}
                                index={index}
                                key={item.actionId}
                              >
                                {(dragProvided, dragSnapshot) => (
                                  <article
                                    className={`rounded-lg border bg-[#0B0F16] p-3 shadow-sm transition ${
                                      dragSnapshot.isDragging
                                        ? "border-cyan-400 shadow-xl"
                                        : "border-slate-700 hover:border-cyan-500/40"
                                    }`}
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div
                                        aria-label={`Drag ${item.candidateName}`}
                                        className="cursor-grab select-none text-slate-500 hover:text-cyan-200 active:cursor-grabbing"
                                        title="Drag candidate"
                                        {...dragProvided.dragHandleProps}
                                      >
                                        ⋮⋮
                                      </div>

                                      <Link
                                        className="min-w-0 flex-1 font-semibold text-white hover:text-cyan-200"
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
                                        <dt className="text-slate-500">
                                          Owner
                                        </dt>
                                        <dd className="mt-0.5 text-slate-200">
                                          {lifecycle?.ownerName ||
                                            "Unassigned"}
                                        </dd>
                                      </div>

                                      <div>
                                        <dt className="text-slate-500">
                                          Next action
                                        </dt>
                                        <dd className="mt-0.5 text-cyan-100">
                                          {formatLabel(
                                            lifecycle?.nextAction ||
                                              item.recommendedNextAction,
                                          )}
                                        </dd>
                                      </div>

                                      <div>
                                        <dt className="text-slate-500">
                                          Due date
                                        </dt>
                                        <dd className="mt-0.5 text-slate-300">
                                          {formatDate(
                                            lifecycle?.nextActionDueAt,
                                          )}
                                        </dd>
                                      </div>

                                      <div>
                                        <dt className="text-slate-500">
                                          Missing data
                                        </dt>
                                        <dd className="mt-0.5 text-slate-300">
                                          {item.missingData.length
                                            ? item.missingData
                                                .slice(0, 3)
                                                .join(", ")
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
                                      Legacy:{" "}
                                      {formatLabel(item.currentStatus)}
                                    </div>

                                    <Link
                                      className="mt-3 block rounded-md border border-cyan-500/30 px-3 py-2 text-center text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10"
                                      href={`/recruiter/candidate360/${item.candidateId}`}
                                    >
                                      Open Candidate360
                                    </Link>
                                  </article>
                                )}
                              </Draggable>
                            );
                          })}

                          {provided.placeholder}

                          {!stageItems.length &&
                          !snapshot.isDraggingOver ? (
                            <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-600">
                              No candidates
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </DragDropContext>

        <div className="mt-2 text-xs text-slate-500">
          Scroll horizontally to review all eight lifecycle stages.
        </div>
      </section>

      {pendingMove ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-700 bg-[#0B0F16] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                  Workflow transition preview
                </div>

                <h3 className="mt-2 text-lg font-semibold text-white">
                  {pendingMove.item.candidateName}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {PIPELINE_STAGE_LABELS[pendingMove.fromStage]} →{" "}
                  {PIPELINE_STAGE_LABELS[pendingMove.toStage]}
                </p>
              </div>

              <button
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:text-white"
                disabled={loading}
                onClick={resetDialog}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">
                Transition note
                {pendingMove.requiresNote ? " *" : ""}

                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-100"
                  onChange={(event) => {
                    setNote(event.target.value);
                    setPreview(null);
                  }}
                  placeholder="Add recruiter decision context"
                  value={note}
                />
              </label>

              <label className="block text-sm text-slate-300">
                Due date
                {pendingMove.requiresDueDate ? " *" : ""}

                <input
                  className="mt-2 w-full rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-slate-100"
                  onChange={(event) => {
                    setDueAt(event.target.value);
                    setPreview(null);
                  }}
                  type="datetime-local"
                  value={dueAt}
                />
              </label>
            </div>

            {preview?.decision ? (
              <div className="mt-5 rounded-lg border border-slate-700 bg-[#05070A] p-4">
                <div className="font-semibold text-white">
                  Preview result
                </div>

                <div className="mt-2 text-sm text-slate-300">
                  Allowed:{" "}
                  {preview.decision.allowed ? "yes" : "no"}
                </div>

                {preview.decision.blockers?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-red-100">
                    {preview.decision.blockers.map((blocker) => (
                      <li key={blocker}>• {blocker}</li>
                    ))}
                  </ul>
                ) : null}

                {preview.decision.warnings?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-amber-100">
                    {preview.decision.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300"
                disabled={loading}
                onClick={resetDialog}
                type="button"
              >
                Cancel
              </button>

              <button
                className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40"
                disabled={loading}
                onClick={() => postMove(false)}
                type="button"
              >
                {loading ? "Processing..." : "Preview move"}
              </button>

              <button
                className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  loading ||
                  !preview?.decision?.allowed
                }
                onClick={() => postMove(true)}
                type="button"
              >
                Confirm move
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Confirming updates persisted workflow state only.
              Candidate database writes remain disabled.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}