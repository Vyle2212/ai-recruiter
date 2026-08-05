"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type SearchScore = {
  keywordScore: number;
  semanticScore: number;
  skillScore: number;
  titleScore: number;
  employerScore: number;
  locationScore: number;
  industryScore: number;
  qualityScore: number;
  confidenceScore: number;
  recencyScore: number;
  finalScore: number;
};

type SearchExplanation = {
  matchedTerms: string[];
  matchedSkills: string[];
  matchedSapModules: string[];
  matchedIndustries: string[];
  missingSkills: string[];
  reasons: string[];
  warnings: string[];
  confidenceLevel:
    | "high"
    | "medium"
    | "low";
};

type SearchResult = {
  candidateId: string;
  candidateName: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  location: string | null;
  country: string | null;
  score: SearchScore;
  explanation: SearchExplanation;
  evidence?: Array<{
    label: string;
    value: string;
    source?: string | null;
  }>;
};

type SearchResponse = {
  generatedAt: string;

  request: {
    query: string;
    mode: string;
    page: number;
    pageSize: number;
    minimumScore: number;
  };

  summary: {
    totalDocuments: number;
    totalMatched: number;
    returned: number;
    page: number;
    pageSize: number;
  };

  results: SearchResult[];

  source?: {
    type?: string;
    adaptedDocuments?: number;
  };

  safety: {
    readOnly: true;
    candidateWrites: 0;
    workflowWrites: 0;
    automaticShortlists: 0;
    emailSends: 0;
  };
};

function parseList(
  value: string,
) {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean),
    ),
  );
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const normalized =
    Math.min(
      100,
      Math.max(
        0,
        Number(value) || 0,
      ),
    );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">
          {label}
        </span>

        <span className="font-medium text-slate-200">
          {normalized.toFixed(1)}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{
            width:
              `${normalized}%`,
          }}
        />
      </div>
    </div>
  );
}

function Tag({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full border border-cyan-900 bg-cyan-950/40 px-2.5 py-1 text-xs text-cyan-200">
      {children}
    </span>
  );
}

function CandidateCard({
  result,
  rank,
}: {
  result: SearchResult;
  rank: number;
}) {
  const [
    expanded,
    setExpanded,
  ] =
    useState(false);

  const candidateHref =
    `/recruiter/candidate360/${encodeURIComponent(
      result.candidateId,
    )}`;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300">
              #{rank}
            </span>

            <span className="rounded-md border border-emerald-900 bg-emerald-950/40 px-2 py-1 text-xs font-semibold text-emerald-300">
              {result.explanation.confidenceLevel.toUpperCase()} CONFIDENCE
            </span>
          </div>

          <div className="mt-4">
            <h2 className="truncate text-xl font-semibold text-white">
              {result.candidateName ||
                "Candidate profile pending validation"}
            </h2>

            <p className="mt-1 text-sm text-slate-300">
              {result.currentTitle ||
                "Current title not available"}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {[
                result.currentEmployer,
                result.location,
                result.country,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Employer and location not verified"}
            </p>
          </div>

          {result.explanation.matchedSkills.length >
          0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.explanation.matchedSkills.map(
                (skill) => (
                  <Tag key={skill}>
                    {skill}
                  </Tag>
                ),
              )}
            </div>
          ) : null}

          {result.explanation.reasons.length >
          0 ? (
            <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
              {result.explanation.reasons.map(
                (
                  reason,
                  index,
                ) => (
                  <li
                    key={`${reason}-${index}`}
                    className="flex gap-2"
                  >
                    <span className="text-emerald-400">
                      ✓
                    </span>

                    <span>
                      {reason}
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : null}

          {result.explanation.warnings.length >
          0 ? (
            <div className="mt-4 rounded-xl border border-amber-900/80 bg-amber-950/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Review warnings
              </p>

              <ul className="mt-2 space-y-1 text-sm text-amber-100">
                {result.explanation.warnings.map(
                  (
                    warning,
                    index,
                  ) => (
                    <li
                      key={`${warning}-${index}`}
                    >
                      • {warning}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="w-full shrink-0 lg:w-72">
          <div className="rounded-xl border border-cyan-900/80 bg-cyan-950/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              Overall match
            </p>

            <p className="mt-1 text-4xl font-bold text-white">
              {result.score.finalScore.toFixed(
                1,
              )}
            </p>

            <p className="text-xs text-slate-400">
              out of 100
            </p>

            <div className="mt-4 space-y-3">
              <ScoreBar
                label="Skills"
                value={
                  result.score.skillScore
                }
              />

              <ScoreBar
                label="Keywords"
                value={
                  result.score.keywordScore
                }
              />

              <ScoreBar
                label="Title"
                value={
                  result.score.titleScore
                }
              />

              <ScoreBar
                label="Profile quality"
                value={
                  result.score.qualityScore
                }
              />

              <ScoreBar
                label="Data confidence"
                value={
                  result.score.confidenceScore
                }
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <a
              href={candidateHref}
              className="flex-1 rounded-lg border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-center text-sm font-semibold text-cyan-200 transition hover:bg-cyan-900/50"
            >
              Open Candidate 360
            </a>

            <button
              type="button"
              onClick={() =>
                setExpanded(
                  (current) =>
                    !current,
                )
              }
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              {expanded
                ? "Hide"
                : "Details"}
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Matched terms
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {result.explanation.matchedTerms
                .length > 0 ? (
                result.explanation.matchedTerms.map(
                  (term) => (
                    <Tag key={term}>
                      {term}
                    </Tag>
                  ),
                )
              ) : (
                <span className="text-sm text-slate-500">
                  No direct terms
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              SAP modules
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {result.explanation
                .matchedSapModules
                .length > 0 ? (
                result.explanation.matchedSapModules.map(
                  (moduleName) => (
                    <Tag
                      key={
                        moduleName
                      }
                    >
                      {moduleName}
                    </Tag>
                  ),
                )
              ) : (
                <span className="text-sm text-slate-500">
                  Derived from skills or title
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidence
            </p>

            <div className="mt-2 space-y-2 text-sm">
              {result.evidence &&
              result.evidence.length >
                0 ? (
                result.evidence.map(
                  (
                    evidence,
                    index,
                  ) => (
                    <div
                      key={`${evidence.label}-${index}`}
                      className="rounded-lg border border-slate-800 bg-slate-900/50 p-2"
                    >
                      <p className="font-medium text-slate-300">
                        {evidence.label}
                      </p>

                      <p className="mt-0.5 text-slate-500">
                        {evidence.value}
                      </p>
                    </div>
                  ),
                )
              ) : (
                <span className="text-slate-500">
                  No evidence attached
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function CandidateSearchV2Client() {
  const [
    query,
    setQuery,
  ] =
    useState(
      "Senior SAP FICO Malaysia",
    );

  const [
    countries,
    setCountries,
  ] =
    useState(
      "Malaysia",
    );

  const [
    skills,
    setSkills,
  ] =
    useState(
      "SAP FICO",
    );

  const [
    sapModules,
    setSapModules,
  ] =
    useState("");

  const [
    minimumScore,
    setMinimumScore,
  ] =
    useState(20);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    response,
    setResponse,
  ] =
    useState<SearchResponse | null>(
      null,
    );

  const results =
    response?.results ||
    [];

  const summaryText =
    useMemo(
      () => {
        if (!response) {
          return "Run a search to view matching candidates.";
        }

        return `${response.summary.totalMatched.toLocaleString()} matches from ${response.summary.totalDocuments.toLocaleString()} candidates`;
      },
      [
        response,
      ],
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/recruiter/search-v2",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  query,
                  mode:
                    "hybrid",

                  filters: {
                    countries:
                      parseList(
                        countries,
                      ),

                    skills:
                      parseList(
                        skills,
                      ),

                    sapModules:
                      parseList(
                        sapModules,
                      ),
                  },

                  page:
                    1,

                  pageSize:
                    20,

                  minimumScore,
                },
              ),
          },
        );

      const payload:
        | SearchResponse
        | {
            error?: string;
          } =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          "error" in payload &&
          payload.error
            ? payload.error
            : `Search failed with HTTP ${response.status}.`,
        );
      }

      setResponse(
        payload as SearchResponse,
      );
    } catch (searchError) {
      setResponse(null);

      setError(
        searchError instanceof Error
          ? searchError.message
          : "Candidate search failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-900 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-200">
                  SEARCH V2
                </span>

                <span className="rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-200">
                  READ ONLY
                </span>

                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                  CANDIDATE DB: 970
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
                Candidate Search V2
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Hybrid recruiter search with SAP module relevance,
                schema V27 support, explainable scoring, and no
                automatic candidate writes.
              </p>
            </div>

            <a
              href="/recruiter/talent-search"
              className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              Back to Talent Search
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <form
          onSubmit={
            handleSubmit
          }
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
        >
          <div className="grid gap-4 lg:grid-cols-12">
            <label className="lg:col-span-12">
              <span className="text-sm font-semibold text-slate-300">
                Search query
              </span>

              <input
                value={query}
                onChange={(
                  event,
                ) =>
                  setQuery(
                    event.target.value,
                  )
                }
                required
                placeholder="Example: Senior SAP FICO Malaysia"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
              />
            </label>

            <label className="lg:col-span-3">
              <span className="text-sm font-semibold text-slate-300">
                Countries
              </span>

              <input
                value={
                  countries
                }
                onChange={(
                  event,
                ) =>
                  setCountries(
                    event.target.value,
                  )
                }
                placeholder="Malaysia, Singapore"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>

            <label className="lg:col-span-3">
              <span className="text-sm font-semibold text-slate-300">
                Required skills
              </span>

              <input
                value={
                  skills
                }
                onChange={(
                  event,
                ) =>
                  setSkills(
                    event.target.value,
                  )
                }
                placeholder="SAP FICO, S/4HANA"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>

            <label className="lg:col-span-3">
              <span className="text-sm font-semibold text-slate-300">
                SAP modules
              </span>

              <input
                value={
                  sapModules
                }
                onChange={(
                  event,
                ) =>
                  setSapModules(
                    event.target.value,
                  )
                }
                placeholder="FI, CO"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>

            <label className="lg:col-span-2">
              <span className="text-sm font-semibold text-slate-300">
                Minimum score
              </span>

              <input
                type="number"
                min={0}
                max={100}
                value={
                  minimumScore
                }
                onChange={(
                  event,
                ) =>
                  setMinimumScore(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>

            <div className="flex items-end lg:col-span-1">
              <button
                type="submit"
                disabled={
                  loading
                }
                className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Searching..."
                  : "Search"}
              </button>
            </div>
          </div>
        </form>

        <section className="mt-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Search results
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {summaryText}
              </p>
            </div>

            {response ? (
              <div className="text-xs text-slate-500">
                Returned{" "}
                {response.summary.returned} ·
                Minimum score{" "}
                {response.request.minimumScore}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {!loading &&
          response &&
          results.length ===
            0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
              <p className="text-lg font-semibold text-slate-300">
                No matching candidates
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Try removing a country or skill filter, or lower
                the minimum score.
              </p>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {results.map(
              (
                result,
                index,
              ) => (
                <CandidateCard
                  key={
                    result.candidateId
                  }
                  result={
                    result
                  }
                  rank={
                    index +
                    1
                  }
                />
              ),
            )}
          </div>
        </section>
      </div>
    </main>
  );
}