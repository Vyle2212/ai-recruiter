"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import GuidedSourcingPanel from "./GuidedSourcingPanel";
import type { GuidedSearchHandoff } from "@/lib/guidedSourcingTypes";

const CANDIDATE360_SEARCH_CONTEXT_KEY = "candidate360.searchContext.v1";

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

const INVALID_CANDIDATE_NAMES = new Set([
  "candidate profile pending validation",
  "prefer contract role only",
  "unknown candidate",
  "candidate",
  "n/a",
  "na",
]);

function normalizeDisplayValue(
  value:
    | string
    | null
    | undefined,
) {
  return String(
    value ||
    "",
  )
    .normalize("NFKC")
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function cleanCandidateName(
  result: SearchResult,
) {
  const candidateName =
    normalizeDisplayValue(
      result.candidateName,
    );

  if (
    candidateName &&
    !INVALID_CANDIDATE_NAMES.has(
      candidateName.toLowerCase(),
    )
  ) {
    return candidateName;
  }

  const identifier =
    normalizeDisplayValue(
      result.candidateId,
    )
      .replace(
        /[^a-z0-9]/gi,
        "",
      )
      .slice(
        -6,
      )
      .toUpperCase();

  return "Unnamed Candidate";
}

function candidateShortId(
  candidateId:
    | string
    | null
    | undefined,
) {
  const identifier =
    normalizeDisplayValue(
      candidateId,
    )
      .replace(
        /[^a-z0-9]/gi,
        "",
      )
      .slice(
        -6,
      )
      .toUpperCase();

  return identifier ||
    "UNKNOWN";
}

function inferEmployerFromTitle(
  title:
    | string
    | null
    | undefined,
) {
  const normalizedTitle =
    normalizeDisplayValue(
      title,
    );

  const match =
    normalizedTitle.match(
      /\s+at\s+(.+)$/i,
    );

  return normalizeDisplayValue(
    match?.[1],
  );
}

function cleanCurrentTitle(
  title:
    | string
    | null
    | undefined,
) {
  return normalizeDisplayValue(
    title,
  )
    .replace(
      /^\d+\)\s*(?:position\s*:\s*)?/i,
      "",
    )
    .replace(
      /\s+at\s+.+$/i,
      "",
    )
    .replace(
      /\s*:\s*$/,
      "",
    )
    .replace(
      /\(\s*/g,
      " (",
    )
    .replace(
      /\s*\)/g,
      ")",
    )
    .replace(
      /\s*,\s*/g,
      ", ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function resolvedEmployer(
  result: SearchResult,
) {
  return (
    normalizeDisplayValue(
      result.currentEmployer,
    ) ||
    inferEmployerFromTitle(
      result.currentTitle,
    )
  );
}

function uniqueLocationParts(
  result: SearchResult,
) {
  const values =
    [
      resolvedEmployer(
        result,
      ),
      normalizeDisplayValue(
        result.location,
      ),
      normalizeDisplayValue(
        result.country,
      ),
    ].filter(Boolean);

  const seen =
    new Set<string>();

  return values.filter(
    (value) => {
      const key =
        value.toLowerCase();

      if (
        seen.has(
          key,
        )
      ) {
        return false;
      }

      seen.add(
        key,
      );

      return true;
    },
  );
}

function derivedConfidenceLevel(
  result: SearchResult,
):
  | "high"
  | "medium"
  | "low" {
  const dataConfidence =
    Number(
      result.score.confidenceScore,
    ) || 0;

  const profileQuality =
    Number(
      result.score.qualityScore,
    ) || 0;

  const skillScore =
    Number(
      result.score.skillScore,
    ) || 0;

  const titleScore =
    Number(
      result.score.titleScore,
    ) || 0;

  if (
    dataConfidence >=
    70
  ) {
    return "high";
  }

  if (
    dataConfidence >=
    40
  ) {
    return "medium";
  }

  if (
    profileQuality >=
      85 &&
    skillScore >=
      80 &&
    titleScore >=
      50
  ) {
    return "medium";
  }

  return "low";
}

function recruiterRankScore(
  result: SearchResult,
) {
  const baseScore =
    Number(
      result.score.finalScore,
    ) || 0;

  const titleBonus =
    (
      Number(
        result.score.titleScore,
      ) || 0
    ) *
    0.025;

  const confidenceBonus =
    (
      Number(
        result.score.confidenceScore,
      ) || 0
    ) *
    0.015;

  const recencyBonus =
    (
      Number(
        result.score.recencyScore,
      ) || 0
    ) *
    0.01;

  const employerBonus =
    resolvedEmployer(
      result,
    )
      ? 1.25
      : 0;

  const validNameBonus =
    cleanCandidateName(
      result,
    ) ===
    "Unnamed Candidate"
      ? 0
      : 0.75;

  const warningPenalty =
    Math.min(
      result.explanation.warnings.length *
        0.35,
      1.5,
    );

  return Math.min(
    100,
    Math.max(
      0,
      baseScore +
        titleBonus +
        confidenceBonus +
        recencyBonus +
        employerBonus +
        validNameBonus -
        warningPenalty,
    ),
  );
}

function confidenceBadgeClasses(
  level:
    | "high"
    | "medium"
    | "low",
) {
  if (
    level ===
    "high"
  ) {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-200";
  }

  if (
    level ===
    "medium"
  ) {
    return "border-cyan-800 bg-cyan-950/40 text-cyan-200";
  }

  return "border-amber-800 bg-amber-950/30 text-amber-200";
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const safeValue =
    Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(value)
          ? value
          : 0,
      ),
    );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-400">
          {label}
        </span>

        <span className="font-semibold tabular-nums text-slate-200">
          {safeValue.toFixed(
            1,
          )}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-400 transition-[width] duration-300"
          style={{
            width:
              `${safeValue}%`,
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

  const [
    showReasons,
    setShowReasons,
  ] =
    useState(false);

  const [
    showWarnings,
    setShowWarnings,
  ] =
    useState(false);

  const candidateName =
    cleanCandidateName(
      result,
    );

  const candidateTitle =
    cleanCurrentTitle(
      result.currentTitle,
    );

  const anonymousCandidate =
    candidateName ===
    "Unnamed Candidate";

  const shortCandidateId =
    candidateShortId(
      result.candidateId,
    );

  const candidateEmployer =
    resolvedEmployer(
      result,
    );

  const locationParts =
    uniqueLocationParts(
      result,
    );

  const confidenceLevel =
    derivedConfidenceLevel(
      result,
    );

  const rankScore =
    recruiterRankScore(
      result,
    );

  const candidateHref =
    `/recruiter/candidate360-v2/${encodeURIComponent(
      result.candidateId,
    )}?from=search-v2`;

  const shortlistHref =
    `/recruiter/shortlist?candidateId=${encodeURIComponent(
      result.candidateId,
    )}?from=search-v2`;

  const compareHref =
    `/recruiter/compare?candidateId=${encodeURIComponent(
      result.candidateId,
    )}?from=search-v2`;

  const matchLabel =
    rankScore >= 80
      ? "Excellent match"
      : rankScore >= 65
        ? "Strong match"
        : rankScore >= 50
          ? "Good match"
          : "Review match";

  const warningCount =
    result.explanation
      .warnings.length;

  const reasonCount =
    result.explanation
      .reasons.length;

  const confidenceLabel =
    `${confidenceLevel.toUpperCase()} CONFIDENCE`;

  const confidenceClasses =
    confidenceLevel ===
    "high"
      ? "border-emerald-700/80 bg-emerald-950/35 text-emerald-300"
      : confidenceLevel ===
          "medium"
        ? "border-amber-700/80 bg-amber-950/25 text-amber-300"
        : "border-rose-800/80 bg-rose-950/25 text-rose-300";

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/55 px-4 py-3 shadow-sm transition hover:border-slate-700 lg:px-5">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-semibold tabular-nums text-slate-300">
              #{rank}
            </span>

            <span
              className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold tracking-wide ${confidenceClasses}`}
            >
              {confidenceLabel}
            </span>
          </div>

          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 text-base font-semibold leading-tight text-white sm:text-lg">
                {candidateName}
              </h2>

              {anonymousCandidate ? (
                <span className="inline-flex min-h-6 items-center rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-300">
                  #{shortCandidateId}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm font-medium leading-snug text-slate-200">
              {candidateTitle ||
                "Current title not available"}
            </p>

            {locationParts.length >
            0 ? (
              <p className="mt-1 text-sm leading-snug text-slate-500">
                {locationParts.join(
                  " / ",
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Location not verified
              </p>
            )}

            {!candidateEmployer ? (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-800/80 bg-amber-950/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                <span
                  aria-hidden="true"
                >
                  !
                </span>

                Employer pending verification
              </span>
            ) : null}
          </div>

          {result.explanation
            .matchedSkills.length >
          0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.explanation.matchedSkills.map(
                (skill) => (
                  <Tag key={skill}>
                    {skill}
                  </Tag>
                ),
              )}
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {reasonCount >
            0 ? (
              <button
                type="button"
                aria-expanded={
                  showReasons
                }
                onClick={() =>
                  setShowReasons(
                    (current) =>
                      !current,
                  )
                }
                className="inline-flex min-h-7 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-950/25 hover:text-cyan-200"
              >
                <span
                  aria-hidden="true"
                  className={`inline-block text-xs transition-transform ${
                    showReasons
                      ? "rotate-90"
                      : ""
                  }`}
                >
                  â–¸
                </span>

                <span>
                  Why this candidate
                  {" "}
                  ({reasonCount})
                </span>
              </button>
            ) : null}

            {warningCount >
            0 ? (
              <button
                type="button"
                aria-expanded={
                  showWarnings
                }
                onClick={() =>
                  setShowWarnings(
                    (current) =>
                      !current,
                  )
                }
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-amber-800/80 bg-amber-950/15 px-2.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-950/30"
              >
                <span
                  aria-hidden="true"
                >
                  !
                </span>

                <span>
                  {warningCount}
                  {" "}
                  review
                  {" "}
                  {warningCount ===
                  1
                    ? "warning"
                    : "warnings"}
                </span>
              </button>
            ) : null}
          </div>

          {showReasons ? (
            <ul className="mt-2 grid gap-1.5">
              {result.explanation.reasons.map(
                (
                  reason,
                  index,
                ) => (
                  <li
                    key={`${reason}-${index}`}
                    className="flex gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-300"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-semibold text-emerald-400"
                    >
                      +
                    </span>

                    <span>
                      {reason}
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : null}

          {showWarnings ? (
            <ul className="mt-2 grid gap-1.5">
              {result.explanation.warnings.map(
                (
                  warning,
                  index,
                ) => (
                  <li
                    key={`${warning}-${index}`}
                    className="flex gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-sm text-amber-100"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-semibold text-amber-400"
                    >
                      !
                    </span>

                    <span>
                      {warning}
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
            <a
              href={candidateHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-cyan-700 bg-cyan-950/30 px-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-900/40"
            >
              Open Candidate 360
            </a>

            <a
              href={shortlistHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              Shortlist
            </a>

            <a
              href={compareHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              Compare
            </a>

            <button
              type="button"
              aria-expanded={
                expanded
              }
              onClick={() =>
                setExpanded(
                  (current) =>
                    !current,
                )
              }
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              {expanded
                ? "Hide details"
                : "Details"}
            </button>
          </div>
        </div>

        <aside className="hidden min-w-0 flex-col lg:flex">
          <div className="rounded-xl border border-cyan-900/80 bg-cyan-950/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                  Recruiter rank
                </p>

                <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-white">
                  {rankScore.toFixed(
                    1,
                  )}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-200">
                  {matchLabel}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  AI score
                </p>

                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-400">
                  {result.score.finalScore.toFixed(
                    1,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
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

          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href={candidateHref}
              className="col-span-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-cyan-700 bg-cyan-950/35 px-3 text-center text-sm font-semibold text-cyan-200 transition hover:bg-cyan-900/45"
            >
              Open Candidate 360
            </a>

            <a
              href={shortlistHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              Shortlist
            </a>

            <a
              href={compareHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              Compare
            </a>

            <button
              type="button"
              aria-expanded={
                expanded
              }
              onClick={() =>
                setExpanded(
                  (current) =>
                    !current,
                )
              }
              className="col-span-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
            >
              {expanded
                ? "Hide details"
                : "Details"}
            </button>
          </div>
        </aside>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-3 border-t border-slate-800 pt-3 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Matched terms
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.explanation
                .matchedTerms.length >
              0 ? (
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

            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.explanation
                .matchedSapModules.length >
              0 ? (
                result.explanation.matchedSapModules.map(
                  (
                    moduleName,
                  ) => (
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
                  Derived from title or skills
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidence
            </p>

            <div className="mt-2 space-y-1.5">
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
                      className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-sm"
                    >
                      <p className="font-medium text-slate-300">
                        {evidence.label}
                      </p>

                      <p className="mt-0.5 break-words text-slate-500">
                        {evidence.value}
                      </p>
                    </div>
                  ),
                )
              ) : (
                <span className="text-sm text-slate-500">
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

export default function CandidateSearchV2Client({ guidedSourcingEnabled = false }: { guidedSourcingEnabled?: boolean }) {
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

  const [guidedWorkspace, setGuidedWorkspace] =
    useState<"idle" | "source" | "review" | "prepared">("idle");
  const handleGuidedWorkspaceState = useCallback(
    (state: "idle" | "source" | "review" | "prepared") => setGuidedWorkspace(state),
    [],
  );

  const results =
    useMemo(
      () =>
        [
          ...(
            response?.results ||
            []
          ),
        ].sort(
          (
            first,
            second,
          ) =>
            recruiterRankScore(
              second,
            ) -
            recruiterRankScore(
              first,
            ),
        ),
      [
        response,
      ],
    );

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

  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(CANDIDATE360_SEARCH_CONTEXT_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      if (typeof saved.query === "string") setQuery(saved.query);
      if (typeof saved.countries === "string") setCountries(saved.countries);
      if (typeof saved.skills === "string") setSkills(saved.skills);
      if (typeof saved.sapModules === "string") setSapModules(saved.sapModules);
      if (Number.isFinite(saved.minimumScore)) setMinimumScore(saved.minimumScore);
      if (saved.response?.results) setResponse(saved.response as SearchResponse);
      requestAnimationFrame(() => window.scrollTo({ top: Number(saved.searchScrollY) || 0 }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!response) return;
    const save = () => {
      const matchedByCandidate = Object.fromEntries(response.results.map((item) => [item.candidateId, item.explanation]));
      window.sessionStorage.setItem(CANDIDATE360_SEARCH_CONTEXT_KEY, JSON.stringify({
        query, countries, skills, sapModules, minimumScore, response,
        candidateIds: results.map((item) => item.candidateId), matchedByCandidate,
        filters: { countries: parseList(countries), skills: parseList(skills), sapModules: parseList(sapModules) },
        returnUrl: "/recruiter/talent-search/v2", searchScrollY: window.scrollY,
      }));
    };
    save();
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [response, query, countries, skills, sapModules, minimumScore, results]);
  function applyGuidedHandoff(handoff: GuidedSearchHandoff) {
    setQuery(handoff.query);
    setCountries(handoff.filters.countries.join(", "));
    setSkills(handoff.filters.skills.join(", "));
    setSapModules(handoff.filters.sapModules.join(", "));
    setError(null);
  }

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
        {guidedSourcingEnabled ? (
          <GuidedSourcingPanel
            onConfirm={applyGuidedHandoff}
            onManualFallback={(brief) => { setQuery(brief); setError(null); }}
            onWorkspaceStateChange={handleGuidedWorkspaceState}
          />
        ) : null}
        {guidedWorkspace === "review" ? (
          <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm text-slate-400">
            <span className="font-medium text-slate-200">Manual Search is paused while you review the guided plan.</span>{" "}
            Your current query and committed results remain unchanged.
          </section>
        ) : null}
        {guidedWorkspace === "prepared" ? (
          <p role="status" className="mb-5 rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
            Search plan prepared. Review it, then click Search.
          </p>
        ) : null}
        <form
          onSubmit={
            handleSubmit
          }
          className={guidedWorkspace === "review" ? "hidden" : "rounded-2xl border border-slate-800 bg-slate-900/40 p-5"}
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

        <section id="search-results" className={guidedWorkspace === "review" ? "hidden" : "mt-7"}>
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
                {response.summary.returned} Â·
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

          <div className="mt-4 space-y-3">
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