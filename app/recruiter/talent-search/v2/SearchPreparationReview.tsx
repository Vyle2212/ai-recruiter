"use client";
import { useState } from "react";
import type { Dispatch } from "react";
import {
  canonicalHardRequirementCounts,
  type CommittedSearchRequirements,
} from "@/lib/searchV2CommittedRequirements";
import type {
  SearchPreparationAction,
  SearchPreparationState,
} from "@/lib/searchV2Preparation";
import type { SearchV2SourceReadiness } from "@/lib/searchV2SourceReadiness";
import {
  detectSearchV2UnifiedIntent,
  type SearchV2UnifiedIntent,
} from "@/lib/searchV2UnifiedIntent";

export default function SearchPreparationReview({
  state,
  dispatch,
  preview,
  onOpenFilters,
  onOpenCriteria,
  onCommit,
  onRetryReadiness,
  onCancel,
  sourceReadiness,
  searchIntent,
}: {
  state: SearchPreparationState;
  dispatch: Dispatch<SearchPreparationAction>;
  preview: CommittedSearchRequirements;
  onOpenFilters: () => void;
  onOpenCriteria: () => void;
  onCommit: () => void;
  onRetryReadiness?: () => void;
  onCancel: () => void;
  sourceReadiness: SearchV2SourceReadiness;
  searchIntent?: SearchV2UnifiedIntent;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [other, setOther] = useState("");
  const requiredFilterCount = canonicalHardRequirementCounts(preview).total;
  const question = state.questions[state.currentIndex];
  const answer = () => {
    if (!question) return;
    dispatch({
      type: "answer",
      identity: state.identity,
      questionId: question.id,
      values: selected,
      other,
    });
    setSelected([]);
    setOther("");
  };
  if (state.status === "preparing")
    return (
      <section
        className="mt-4 rounded-xl border border-cyan-900 bg-cyan-950/20 p-4"
        role="status"
      >
        <p className="font-semibold text-white">Understanding requirements</p>
        <p className="mt-1 text-sm text-slate-400">
          Preparing only the job requirements. Candidate records are not
          searched at this stage.
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: "cancel", identity: state.identity })}
          className="mt-3 text-sm text-slate-300 underline"
        >
          Cancel
        </button>
      </section>
    );
  if (state.status === "timed_out")
    return (
      <section className="mt-4 rounded-xl border border-amber-800 bg-amber-950/20 p-4">
        <p className="text-sm text-amber-200">{state.error}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "retry", identity: state.identity })
            }
            className="rounded border border-slate-700 px-3 py-2 text-sm text-white"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "manual", identity: state.identity })
            }
            className="rounded bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            Continue manually
          </button>
        </div>
      </section>
    );
  if (state.status === "questions" && question)
    return (
      <section
        className="mt-4 rounded-xl border border-violet-800/70 bg-violet-950/15 p-4"
        aria-label="Clarify search requirements"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
            Question {state.currentIndex + 1} of {state.questions.length}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400"
          >
            Cancel
          </button>
        </div>
        <h3 className="mt-2 font-semibold text-white">{question.label}</h3>
        {question.options.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={selected.includes(option)}
                onClick={() =>
                  setSelected((current) =>
                    question.type === "single"
                      ? [option]
                      : current.includes(option)
                        ? current.filter((item) => item !== option)
                        : [...current, option],
                  )
                }
                className={
                  selected.includes(option)
                    ? "rounded-full border border-cyan-400 bg-cyan-950 px-3 py-1.5 text-sm text-cyan-100"
                    : "rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                }
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
        <label className="mt-3 block">
          <span className="text-xs text-slate-400">Other</span>
          <input
            value={other}
            onChange={(event) => setOther(event.target.value)}
            placeholder="Enter another answer"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            disabled={state.currentIndex === 0}
            onClick={() => dispatch({ type: "back", identity: state.identity })}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "skip",
                  identity: state.identity,
                  questionId: question.id,
                })
              }
              className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300"
            >
              Skip
            </button>
            <button
              type="button"
              disabled={!selected.length && !other.trim()}
              onClick={answer}
              className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      </section>
    );
  if (!["review", "manual"].includes(state.status)) return null;
  const isExternal = preview.talentPool === "linkedin_talent_pool";
  const resolvedSearchIntent =
    searchIntent || detectSearchV2UnifiedIntent(preview.query);
  const directLookup = [
    "candidate_name_lookup",
    "identity_token_lookup",
  ].includes(resolvedSearchIntent.type);
  const lightweightTokenLookup =
    !isExternal && resolvedSearchIntent.type === "identity_token_lookup";
  const searchReady = sourceReadiness.ready || lightweightTokenLookup;
  const pendingLabel = isExternal
    ? sourceReadiness.message?.startsWith("Checking")
      ? "Checking External Talent Network..."
      : "External source unavailable"
    : sourceReadiness.status === "failed"
      ? "SAP Talent Hub unavailable"
      : "Preparing candidate search…";
  return (
    <section
      className="mt-4 rounded-xl border border-cyan-800/70 bg-slate-950/80 p-4"
      aria-label="Review Search"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Review before Search
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {preview.summary || preview.query}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {isExternal ? "External Talent Network" : "SAP Talent Hub"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-400"
        >
          Cancel
        </button>
      </div>
      <div
        className={`mt-4 rounded-lg border p-3 text-sm ${resolvedSearchIntent.searchable ? "border-cyan-900 bg-cyan-950/20 text-cyan-100" : "border-amber-800 bg-amber-950/20 text-amber-100"}`}
      >
        <span className="font-semibold">Search intent: </span>
        {resolvedSearchIntent.label}
        {resolvedSearchIntent.lookupValue ? (
          <span className="block text-xs text-slate-300">
            {resolvedSearchIntent.type === "identity_token_lookup"
              ? "Identity token"
              : resolvedSearchIntent.type === "company_search"
                ? "Employer or company"
                : "Candidate name"}
            : {resolvedSearchIntent.lookupValue}
          </span>
        ) : null}
        {!resolvedSearchIntent.searchable ? (
          <span className="mt-1 block text-xs">
            No searchable name, title, company, skill or requirement was
            recognized. Please revise the search.
          </span>
        ) : null}
      </div>
      {!directLookup ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-white">
              Required Filters ({requiredFilterCount})
            </h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {preview.requirements.map((item) => (
                <li
                  key={item.id}
                  className="rounded-full border border-emerald-800/70 bg-emerald-950/20 px-2.5 py-1 text-xs text-emerald-200"
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">
              Ranking Criteria ({preview.criteria.length})
            </h4>
            <ol className="mt-2 space-y-1 text-sm text-slate-300">
              {preview.criteria.map((item) => (
                <li key={item.id}>
                  {item.label} · {item.importance.replaceAll("_", " ")}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
      {Object.values(state.answers).length ? (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-white">
            Clarification answers
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {Object.values(state.answers).map((answer) => (
              <li key={answer.questionId}>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "revise",
                      identity: state.identity,
                      questionId: answer.questionId,
                    })
                  }
                  className="text-left underline-offset-2 hover:underline"
                >
                  {answer.questionId}:{" "}
                  {answer.skipped
                    ? "Skipped"
                    : [...answer.values, answer.other]
                        .filter(Boolean)
                        .join(", ")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
        >
          Edit Filters
        </button>
        <button
          type="button"
          onClick={onOpenCriteria}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
        >
          Edit Criteria
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={!searchReady || !resolvedSearchIntent.searchable}
          aria-describedby={
            !searchReady ? "search-readiness-message" : undefined
          }
          className="rounded-lg bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 outline-none hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-50"
        >
          {!resolvedSearchIntent.searchable
            ? "Revise Search"
            : searchReady
              ? "Commit Search"
              : pendingLabel}
        </button>
        {!searchReady ? (
          <div className="flex items-center gap-2">
            <span
              id="search-readiness-message"
              role={sourceReadiness.status === "failed" ? "alert" : "status"}
              className="text-xs text-slate-400"
            >
              {sourceReadiness.message}
            </span>
            {!isExternal &&
            sourceReadiness.status === "failed" &&
            onRetryReadiness ? (
              <button
                type="button"
                onClick={onRetryReadiness}
                className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-200"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
