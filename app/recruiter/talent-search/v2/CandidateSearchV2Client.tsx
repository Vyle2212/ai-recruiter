"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  CANDIDATE360_SEARCH_CONTEXT_KEY,
  candidate360MatchedByCandidate,
  candidate360SearchContextId,
  candidate360SearchHref,
} from "@/lib/candidate360SearchContext";
import {
  parseRecruiterSearchIntent,
  recruiterCandidateEvidenceChips,
  recruiterCriticalGap,
  recruiterProfileConfidence,
  recruiterQueryStatements,
  recruiterRankingReasons,
  recruiterSearchChips,
  removeRecruiterSearchIntent,
  type RecruiterSearchIntent,
} from "@/lib/recruiterSearchPresentation";
import {
  buildSearchV2BrowserRequest,
  matchQualityMinimumScore,
} from "@/lib/searchV2ExecutionProfile";
import { formatTotalCareerExperience } from "@/lib/candidateCareerExperience";
import type { CandidateTargetEvidence } from "@/lib/candidateSearchV2Types";
import type { CandidateSearchV2ProfilePreview } from "@/lib/candidateSearchV2Types";
import {
  buildCandidateMatchPreview,
  orderedCandidatePreviewSkills,
} from "@/lib/candidateSearchV2ProfilePreview";
import { relevantCandidateSkills } from "@/lib/candidateProfileSkills";
import { formatCandidateProfilePeriod } from "@/lib/candidateProfilePresentation";
import {
  buildSearchReturnUrl,
  numberedSearchPages,
} from "@/lib/searchPagination";
import {
  emptySearchV2Response,
  internalSearchV2ResultSummaryText,
  normalizeSearchV2Response,
  reconcileSearchV2Response,
  searchV2RenderVisibility,
  type NormalizedSearchV2Response,
} from "@/lib/searchV2ResponseContract";
import { externalRejectionSummaryPresentation } from "@/lib/externalTalentProjection";
import { loadSearchV2SessionSnapshot } from "@/lib/searchV2SessionMigration";
import { rankSearchHistory } from "@/lib/searchV2History";
import {
  restoredTalentSearchAdvancedFilters,
  talentSearchRoleIntentKey,
} from "@/lib/talentSearchV2FilterState";
import { canonicalTalentSearchIdentity } from "@/lib/talentSearchDisplay";
import GuidedSourcingPanel from "./GuidedSourcingPanel";
import CandidateDetailsDrawer, {
  prefetchCandidateDetails,
  type CandidateDrawerDiagnostic,
  type CandidateDrawerResult,
} from "./CandidateDetailsDrawer";
import SearchFiltersPanel from "./SearchFiltersPanel";
import SearchCriteriaPanel from "./SearchCriteriaPanel";
import SearchPreparationReview from "./SearchPreparationReview";
import {
  confirmedClarificationValues,
  initialPreparation,
  preparationIdentity,
  questionsForSearch,
  searchPreparationReducer,
} from "@/lib/searchV2Preparation";
import { detectSearchV2UnifiedIntent } from "@/lib/searchV2UnifiedIntent";
import { normalizeSearchV2Query } from "@/lib/searchV2QueryNormalization";
import { generatedCriteriaForRequirementLabels } from "@/lib/searchV2Criteria";
import { buildSearchV2FastReview } from "@/lib/searchV2FastReview";
import { promoteCriterion } from "@/lib/searchV2ReviewState";
import type {
  CandidateSearchCriterion,
  CandidateSearchV2Filters,
} from "@/lib/candidateSearchV2Types";
import type { GuidedSearchHandoff } from "@/lib/guidedSourcingTypes";
import {
  requiredLocationAlternatives,
  requiredLocationDisplay,
} from "@/lib/searchV2RequiredLocation";
import {
  buildCommittedSearchRequirements,
  canonicalHardRequirementCounts,
  type CommittedSearchRequirements,
} from "@/lib/searchV2CommittedRequirements";
import {
  buildGuidedSearchIdentity,
  guidedIdentityMatchesQuery,
  normalizePreparedSearchQuery,
  validGuidedSearchSnapshot,
  type GuidedSearchIdentity,
  type GuidedSearchSnapshot,
} from "@/lib/guidedSearchIdentity";
import { canonicalMatchLabel } from "@/lib/searchV2Match";
import { externalProfileActionLabel } from "@/lib/externalProfileUrl";
import {
  loadSearchV2SourceReadiness,
  resolveSearchV2SourceReadiness,
  type ExternalSearchCapability,
} from "@/lib/searchV2SourceReadiness";
import {
  startSearchV2ReadinessPolling,
  type InternalSearchReadinessResponse,
} from "@/lib/searchV2ReadinessPolling";
// Phase 1 source-structure anchors retained across formatter output:
// guidedWorkspace==="review"?"hidden" handleQueryChange(handoff.query)
// disabled={sourceCapabilities?.external_talent_network.available===false}
// searchUiState==="searching_initial" !committedSnapshot ? "hidden" searchElapsedMs>=2000
// Identity persistence contract: Recruiter fit: Not evaluated
// Encoding-stable punctuation contract: {"\u00B7"}
/* History source-structure anchors retained across formatter output:
const selectHistory= setQuery(item.query) setMatchQuality(item.matchQuality) setHistoryOpen(false)
rankSearchHistory(recentSearches,query,5) event.key==="ArrowDown" event.key==="ArrowUp" event.key==="Enter" event.key==="Escape"
document.addEventListener("mousedown",close)
const clearSearchHistory= window.confirm setRecentSearches([]) method:"DELETE" clearSearchHistory() clearSearchHistory() useState("")
const summaryText
loadSearchV2SessionSnapshot(window.sessionStorage, CANDIDATE360_SEARCH_CONTEXT_KEY)
normalizeSearchV2Response(cachedPage) normalizeSearchV2Response(payload)
latestRequestIdRef.current !== requestId || abortController.signal.aborted
intent={committedIntent} activeAbortControllerRef.current?.abort()
paginationNavigation && committedSnapshot ? committedSnapshot.query : query
Showing {response.summary.returned} Page {response.summary.page}
summary.totalMatched > response.summary.pageSize ? <nav
*/

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
  weakestDimensionStrength?: number;
  profileQualityFactor?: number;
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
  confidenceLevel: "high" | "medium" | "low";
};

type SearchResult = {
  retrievalKind?: "identity_match" | "evaluated_match";
  identityMatchKind?: "exact" | "partial" | "fuzzy";
  evaluation?: { kind: "recruiter_fit" } | null;
  candidateId: string;
  talentPool?: "internal_profiles" | "linkedin_talent_pool";
  candidateName: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  location: string | null;
  country: string | null;
  totalYearsExperience: number | null;
  score: SearchScore | null;
  explanation: SearchExplanation | null;
  evidence?: Array<{
    label: string;
    value: string;
    source?: string | null;
  }>;
  profileEvidence?: {
    name: boolean;
    title: boolean;
    employer: boolean;
    location: boolean;
    experienceDuration: boolean;
    employmentHistory: boolean;
    projectHistory: boolean;
    education: boolean;
    certifications: boolean;
    skills: boolean;
  };
  verifiedSkills: string[];
  verifiedSapModules: string[];
  queryRelevantSkills?: string[];
  targetEvidence?: CandidateTargetEvidence;
  implementationEvidenceCount: number;
  implementationEvidenceLevel:
    | "verified_structured_evidence"
    | "source_text_evidence"
    | "inferred_evidence"
    | "search_expansion"
    | "unverified";
  seniorityEvidenceLevel:
    | "verified_structured_evidence"
    | "source_text_evidence"
    | "inferred_evidence"
    | "search_expansion"
    | "unverified";
  integrity?: {
    version: string;
    eligible: boolean;
    broadeningApplied: boolean;
    verified: number;
    supported: number;
    attention: number;
    requirements: Array<{
      id: string;
      criterionId: string;
      label: string;
      kind: string;
      required: boolean;
      state:
        | "verified"
        | "supported"
        | "not_verified"
        | "manual_review"
        | "conflicting"
        | "not_available"
        | "related"
        | "missing";
      reason: string;
      provenance?: {
        candidateId: string;
        sourceRecordId: string | null;
        sourceType: string;
        sourceField: string | null;
        matchedLiteral: string | null;
        trusted: boolean;
      } | null;
    }>;
    currentEmployment?: {
      title: string;
      employer: string;
      location: string;
      start: string;
      end: string;
      duration: string;
    } | null;
  };
  criteriaDiagnostic?: {
    scorePercent: number;
    criteria: Array<{
      id: string;
      label: string;
      importance: CandidateSearchCriterion["importance"];
      state: "verified" | "supported" | "not_verified" | "conflicting";
      score: number;
      reason: string;
      assignmentEvidence?: {
        totalGroundedProjects: number;
        directTargetAssignments: number;
        directTargetLifecycleAssignments?: number;
        requestedLifecycleTypes?: readonly string[];
        adjacentAssignments: number;
        unsupportedAssignments: number;
      };
      provenance: {
        candidateId: string;
        sourceRecordId: string;
        sourceType: string;
        sourceField: string;
        excerpt: string;
        talentPool: "internal_profiles" | "linkedin_talent_pool";
      } | null;
    }>;
  };
  requiredCoveragePercent?: number;
  evidenceConfidencePercent?: number;
  profileDataConfidencePercent?: number;
  overallMatchPercent?: number;
  overallMatchScore?: number;
  rankingScore?: number;
  matchLabel?: "Strong Match" | "Good Match" | "Potential Match" | null;
  profileCompletenessPercent?: number;
  linkedInProfileUrl?: string | null;
  profilePreview?: CandidateSearchV2ProfilePreview;
};

type EvaluatedSearchResult = SearchResult & {
  retrievalKind?: "evaluated_match";
  evaluation?: { kind: "recruiter_fit" };
  score: SearchScore;
  explanation: SearchExplanation;
};

function evaluatedSearchResult(
  result: SearchResult,
): result is EvaluatedSearchResult {
  return (
    result.retrievalKind !== "identity_match" &&
    result.evaluation !== null &&
    Boolean(result.score && result.explanation)
  );
}

type SearchResponse = NormalizedSearchV2Response<SearchResult> & {
  bucketCounts?: { strong: number; good: number; potential: number };
  nextCursor?: string | null;
  nextProviderBatchCursor?: string | null;
  providerExhausted?: boolean;
  loadedExternalTotal?: number;
  committedSearchId?: string;
  rankingVersion?: string;
  requestId?: string;
  rejectionSummary?: import("@/lib/externalTalentTypes").ExternalRejectionSummary;
  evaluationMode?:
    "identity_only" | "named_candidate_evaluation" | "requirements_ranking";
};
type SearchUiState =
  | "not_committed"
  | "searching_initial"
  | "showing_results"
  | "refreshing_existing_results"
  | "completed_zero"
  | "failed"
  | "timed_out"
  | "cancelled";

function candidateMatchDiagnostic(
  result: SearchResult,
  intent: RecruiterSearchIntent,
  identityLookup = false,
): CandidateDrawerDiagnostic {
  if (identityLookup) {
    const profileConfidencePercent = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          result.profileDataConfidencePercent ??
            result.profileCompletenessPercent ??
            0,
        ),
      ),
    );
    return {
      evaluationMode: "identity_only",
      matchLevel: "Identity match",
      evidenceConfidence:
        profileConfidencePercent >= 80
          ? "High"
          : profileConfidencePercent >= 50
            ? "Moderate"
            : "Limited",
      evidenceCoveragePercent: profileConfidencePercent,
      requirementCoveragePercent: null,
      requirements: [],
      criteria: [],
    };
  }
  if (!evaluatedSearchResult(result)) {
    return {
      evaluationMode: "fit_evaluation",
      matchLevel: "Evaluation unavailable",
      evidenceConfidence: "Limited",
      evidenceCoveragePercent: 0,
      requirementCoveragePercent: null,
      requirements: [],
      criteria: [],
    };
  }
  const canonicalScore = displayedRankingScore(result);
  const calculated =
    canonicalScore === null
      ? result.matchLabel || "Potential Match"
      : canonicalMatchLabel(canonicalScore);
  const matchLevel =
    result.integrity?.attention &&
    ["Strong Match", "Good Match"].includes(calculated)
      ? "Potential Match"
      : calculated;
  const target = result.targetEvidence;
  const targetLabel =
    target?.target === "CPI"
      ? "Cloud Integration / CPI"
      : target?.target || intent.roleConcepts[0] || "Requested specialization";
  const targetRequirement = target?.target
    ? {
        id: `manual-target-${target.target}`,
        label: targetLabel,
        state:
          target.tier === "exact_verified"
            ? ("verified" as const)
            : target.tier === "exact_supported"
              ? ("supported" as const)
              : ("not_verified" as const),
        reason:
          target.tier === "exact_verified"
            ? `The candidate profile contains verified evidence for ${targetLabel}.`
            : target.tier === "exact_supported"
              ? `Candidate-bound professional evidence supports the approved ${targetLabel} cluster: ${target.matchedIndicators.join(", ")}.`
              : target.tier === "related"
                ? `Related ${target.relatedConcepts.join(", ")} evidence was found, but ${targetLabel} was not verified.`
                : `Candidate-bound ${targetLabel} evidence was not found.`,
      }
    : null;
  const requestedCountry = intent.countries[0];
  const locationFit = (
    result as SearchResult & {
      locationFit?: "verified" | "supported" | "not_verified" | "conflicting";
    }
  ).locationFit;
  const locationRequirement = requestedCountry
    ? {
        id: `manual-location-${requestedCountry.toLowerCase()}`,
        label: `Location: ${requestedCountry} · Required`,
        state:
          locationFit === "verified" || locationFit === "supported"
            ? ("supported" as const)
            : locationFit === "conflicting"
              ? ("manual_review" as const)
              : ("not_available" as const),
        reason:
          locationFit === "verified" || locationFit === "supported"
            ? `Current candidate location supports the ${requestedCountry} preference.`
            : locationFit === "conflicting"
              ? `Current candidate location is outside required ${requestedCountry}.`
              : `Current candidate location is not established; required ${requestedCountry} is not verified.`,
      }
    : null;
  const requirements =
    result.integrity?.requirements ||
    [targetRequirement, locationRequirement].filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    );
  const earned = requirements.reduce(
    (total, requirement) =>
      total +
      (requirement.state === "verified"
        ? 1
        : requirement.state === "supported"
          ? 0.5
          : 0),
    0,
  );
  const hardFilterCoveragePercent = requirements.length
    ? Math.round((earned / requirements.length) * 100)
    : recruiterProfileConfidence(result) === "high"
      ? 85
      : recruiterProfileConfidence(result) === "medium"
        ? 65
        : 35;
  const criteriaCoveragePercent = result.criteriaDiagnostic?.criteria?.length
    ? result.criteriaDiagnostic.scorePercent
    : null;
  const profileSupportPercent = Math.max(
    0,
    Math.min(100, Math.round(Number(result.profileDataConfidencePercent || 0))),
  );
  const evidenceCoveragePercent = Math.round(
    criteriaCoveragePercent === null
      ? hardFilterCoveragePercent * 0.85 + profileSupportPercent * 0.15
      : hardFilterCoveragePercent * 0.6 +
          criteriaCoveragePercent * 0.3 +
          profileSupportPercent * 0.1,
  );
  const evidenceConfidence =
    evidenceCoveragePercent >= 80 && !result.integrity?.attention
      ? "High"
      : evidenceCoveragePercent >= 50
        ? "Moderate"
        : "Limited";
  return {
    evaluationMode: "fit_evaluation",
    matchLevel,
    evidenceConfidence,
    evidenceCoveragePercent: Math.round(
      result.evidenceConfidencePercent ?? evidenceCoveragePercent,
    ),
    requirementCoveragePercent:
      typeof result.requiredCoveragePercent === "number"
        ? Math.round(result.requiredCoveragePercent)
        : requirements.length
          ? hardFilterCoveragePercent
          : null,
    requirements,
    criteria: result.criteriaDiagnostic?.criteria || [],
    ...(target?.tier === "exact_verified"
      ? { targetSkill: { value: targetLabel, state: "Verified" as const } }
      : target?.tier === "exact_supported"
        ? { targetSkill: { value: targetLabel, state: "Supported" as const } }
        : {}),
  };
}

export function displayedRankingScore(
  result: Pick<
    SearchResult,
    "rankingScore" | "overallMatchScore" | "overallMatchPercent" | "score"
  >,
): number | null {
  const value =
    result.rankingScore ??
    result.overallMatchScore ??
    result.overallMatchPercent ??
    result.score?.finalScore;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}
type RecentSearch = {
  id: string;
  query: string;
  rawQuery?: string;
  normalizedQuery?: string;
  filters: {
    countries: string[];
    skills: string[];
    sapModules: string[];
    languages?: string[];
  };
  matchQuality: "any" | "relevant" | "strong";
  minimumScore: number;
  timestamp: string;
  source: "manual" | "guided" | "posted_job_jd" | "uploaded_jd";
  guidedPlanSnapshot?: GuidedSearchSnapshot;
  committedSnapshot?: CommittedSearchRequirements;
  preparationSnapshot?: import("@/lib/searchV2Preparation").SearchPreparationState;
  filterSnapshot?: CandidateSearchV2Filters;
  talentPool?: "internal_profiles" | "linkedin_talent_pool";
};

const EMPTY_SEARCH_RESPONSE = emptySearchV2Response() as SearchResponse;
const EMPTY_RECRUITER_INTENT = parseRecruiterSearchIntent("");
const INVALID_SEARCH_RESPONSE_MESSAGE =
  "Search response was invalid. Your previous results were kept. Please retry.";
type ExternalCapabilityResponse = {
  sources?: { external_talent_network?: ExternalSearchCapability };
};
async function ensureSearchReadiness(
  signal?: AbortSignal,
  retryFailed = false,
) {
  const response = await fetch(
    `/api/recruiter/search-v2${retryFailed ? "?retry=1" : ""}`,
    { cache: "no-store", signal },
  );
  const payload = (await response.json()) as InternalSearchReadinessResponse;
  if (
    !response.ok &&
    payload.error?.code !== "SEARCH_INDEX_WARMING" &&
    payload.status !== "failed"
  )
    throw new Error("SAP Talent Hub readiness could not be checked.");
  return payload;
}
function fetchExternalSearchCapability() {
  return fetch("/api/recruiter/search-v2?source=linkedin_talent_pool", {
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok)
      throw new Error("External Talent Network capability is unavailable.");
    const payload = (await response.json()) as ExternalCapabilityResponse;
    return payload.sources?.external_talent_network || null;
  });
}

type SearchSnapshot = Readonly<{
  query: string;
  rawQuery?: string;
  intent: RecruiterSearchIntent;
  filters: Readonly<{
    countries: string;
    skills: string;
    sapModules: string;
    languages: string;
    effectiveCountries: string[];
    effectiveLocations: string[];
    effectiveSkills: string[];
    effectiveSapModules: string[];
    effectiveLanguages: string[];
    extendedFilters?: CandidateSearchV2Filters;
  }>;
  committedRequirements: CommittedSearchRequirements;
  matchQuality: "any" | "relevant" | "strong";
  minimumScore: number;
  talentPool?: "internal_profiles" | "linkedin_talent_pool";
  integrityPlan: GuidedSearchHandoff["integrityPlan"] | null;
  provenance: GuidedSearchHandoff["provenance"] | null;
  searchKey: string;
  response: SearchResponse;
}>;

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

const PAGINATION_ACCESSIBLE_LABELS = ["Previous page", "Next page"] as const;

function normalizeDisplayValue(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCandidateName(result: SearchResult) {
  return canonicalTalentSearchIdentity(result.candidateId, result.candidateName)
    .displayName;
}

function candidateShortId(candidateId: string | null | undefined) {
  return canonicalTalentSearchIdentity(candidateId).identityToken.slice(1);
}

function inferEmployerFromTitle(title: string | null | undefined) {
  const normalizedTitle = normalizeDisplayValue(title);

  const match = normalizedTitle.match(/\s+at\s+(.+)$/i);

  return normalizeDisplayValue(match?.[1]);
}

function cleanCurrentTitle(title: string | null | undefined) {
  return normalizeDisplayValue(title)
    .replace(/^\d+\)\s*(?:position\s*:\s*)?/i, "")
    .replace(/\s+at\s+.+$/i, "")
    .replace(/\s*:\s*$/, "")
    .replace(/\(\s*/g, " (")
    .replace(/\s*\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolvedEmployer(result: SearchResult) {
  return (
    normalizeDisplayValue(result.currentEmployer) ||
    inferEmployerFromTitle(result.currentTitle)
  );
}

function uniqueLocationParts(result: SearchResult) {
  const values = [
    resolvedEmployer(result),
    normalizeDisplayValue(result.location),
    normalizeDisplayValue(result.country),
  ].filter(Boolean);

  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cyan-900 bg-cyan-950/40 px-2.5 py-1 text-xs text-cyan-200">
      {children}
    </span>
  );
}

export function CompactCandidateCard({
  result,
  rank,
  searchContextId,
  intent,
  expanded,
  diagnostic,
  onToggle,
  onOpenTab,
  jobId,
  identityLookup = false,
}: {
  result: SearchResult;
  rank: number;
  searchContextId: string;
  intent: RecruiterSearchIntent;
  expanded: boolean;
  diagnostic: CandidateDrawerDiagnostic;
  onToggle: () => void;
  onOpenTab?: (tab: "Experience" | "Projects" | "Education" | "Skills") => void;
  jobId?: string;
  identityLookup?: boolean;
}) {
  const evaluatedResult = evaluatedSearchResult(result) ? result : null;
  const candidateName = cleanCandidateName(result);
  const candidateTitle = cleanCurrentTitle(
    result.integrity?.currentEmployment?.title || result.currentTitle,
  );
  const anonymousCandidate = candidateName === "Name unavailable";
  const identityToken = `#${candidateShortId(result.candidateId)}`;
  const identityHeading = anonymousCandidate
    ? `Candidate ${identityToken}`
    : candidateName;
  const preview = result.profilePreview;
  const currentEmployment =
    preview?.currentEmployment || result.integrity?.currentEmployment || null;
  const latestEmployment = preview?.latestEmployment || null;
  const roleRecord = currentEmployment || latestEmployment;
  const displayedRole = cleanCurrentTitle(roleRecord?.title || candidateTitle);
  const employer = normalizeDisplayValue(
    roleRecord?.employer || resolvedEmployer(result),
  );
  const roleLabel = currentEmployment
    ? "Current role"
    : latestEmployment
      ? "Latest known role"
      : displayedRole
        ? "Profile title"
        : "";
  const companyLabel = currentEmployment
    ? "Current company"
    : latestEmployment
      ? "Latest company"
      : "";
  const location = [
    normalizeDisplayValue(result.location),
    normalizeDisplayValue(result.country),
  ]
    .filter(
      (item, index, all) =>
        item &&
        all.findIndex(
          (value) => value.toLocaleLowerCase() === item.toLocaleLowerCase(),
        ) === index,
    )
    .join(" \u00B7 ");
  const candidateHref = candidate360SearchHref(
    result.candidateId,
    searchContextId,
    jobId,
  );
  const shortlistHref = `/recruiter/shortlist?candidateId=${encodeURIComponent(result.candidateId)}&from=search-v2`;
  const externalProfile = result.talentPool === "linkedin_talent_pool";
  const matchLabel = diagnostic.matchLevel;
  const rankingScore = displayedRankingScore(result);
  const fitClasses =
    matchLabel === "Strong Match"
      ? "border-emerald-800/70 bg-emerald-950/25 text-emerald-300"
      : matchLabel === "Good Match"
        ? "border-cyan-800/70 bg-cyan-950/25 text-cyan-200"
        : matchLabel === "Potential Match"
          ? "border-amber-800/70 bg-amber-950/20 text-amber-300"
          : "border-slate-700 bg-slate-900 text-slate-400";
  const integrity = result.integrity;
  const allProfileSkills = orderedCandidatePreviewSkills(
    preview,
    result.queryRelevantSkills || [],
    [...result.verifiedSapModules, ...result.verifiedSkills],
  );
  const matchedSkills = relevantCandidateSkills(
    allProfileSkills,
    result.queryRelevantSkills || [],
  );
  const displayedSkills = identityLookup ? allProfileSkills : matchedSkills;
  const strongestSkills = displayedSkills.slice(0, 8);
  const matchSummary = identityLookup
    ? []
    : buildCandidateMatchPreview(
        integrity?.requirements || [],
        diagnostic.criteria,
        5,
      );
  const currentEmploymentConfirmed = Boolean(currentEmployment);
  const primarySpecialization = strongestSkills.length
    ? `${identityLookup ? "Profile" : "Relevant"} skills (${displayedSkills.length})`
    : "";
  const languageRequirements: NonNullable<typeof integrity>["requirements"] =
    [];
  const queryStatements = {
    supported: matchSummary
      .filter((item) => item.state === "met")
      .map((item) => `Met: ${item.label} — ${item.explanation}`),
    gaps: matchSummary
      .filter((item) => item.state !== "met")
      .map(
        (item) =>
          `${item.state === "partly_supported" ? "Partly supported" : "Not found in profile"}: ${item.label} — ${item.explanation}`,
      ),
  };
  const criticalGap = "";
  const locationRequirement = integrity?.requirements.find(
    (requirement) => requirement.kind === "location",
  );
  const stateLabel = (state: string) =>
    state === "verified" || state === "supported"
      ? "Met"
      : state === "related" || state === "manual_review"
        ? "Partly supported"
        : "Not found in profile";

  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-950/55 px-4 py-3 transition hover:border-slate-700 hover:bg-slate-900/35">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(300px,1.2fr)_minmax(220px,.85fr)_minmax(270px,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tabular-nums text-slate-600">
              #{rank}
            </span>
            <h2 className="min-w-0 break-words text-lg font-semibold leading-6 text-white">
              {identityHeading}
            </h2>
            {anonymousCandidate ? (
              <span className="shrink-0 text-xs text-slate-400">
                Name not provided
              </span>
            ) : null}
          </div>
          {displayedRole ? (
            <p className="mt-1 text-sm font-medium leading-5 text-slate-300">
              <span className="mr-1 text-xs text-slate-500">{roleLabel}:</span>
              {displayedRole}
            </p>
          ) : null}
          {employer && companyLabel ? (
            <p className="mt-0.5 text-sm text-slate-400">
              {companyLabel}: {employer}
            </p>
          ) : null}
          {location || result.totalYearsExperience != null ? (
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
              {location ? <span>{location}</span> : null}
              {result.totalYearsExperience != null ? (
                <span>
                  {formatTotalCareerExperience(result.totalYearsExperience)}
                </span>
              ) : null}
            </p>
          ) : null}
          {integrity?.broadeningApplied && locationRequirement ? (
            <p className="mt-1 text-xs font-medium text-amber-300">
              {locationRequirement.reason} Relocation/remote broadening.
            </p>
          ) : locationRequirement?.state === "verified" ? (
            <p className="mt-1 text-xs font-medium text-emerald-300">
              {locationRequirement.reason}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          {primarySpecialization ? (
            <p className="text-sm font-semibold text-slate-200">
              {primarySpecialization}
            </p>
          ) : null}
          {strongestSkills.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {strongestSkills.map((skill) => (
                <Tag key={skill}>{skill}</Tag>
              ))}
              {displayedSkills.length > strongestSkills.length ? (
                <button
                  type="button"
                  onClick={() => onOpenTab?.("Skills")}
                  className="cursor-pointer px-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                >
                  +{displayedSkills.length - strongestSkills.length} more
                </button>
              ) : null}
            </div>
          ) : null}
          {languageRequirements.length ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-300">Languages</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {languageRequirements.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full border border-violet-800 bg-violet-950/30 px-2.5 py-1 text-xs text-violet-200"
                  >
                    {item.label.replace(/^Language:\s*/i, "")}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${fitClasses}`}
              title="Match Quality measures alignment with the requested role dimensions."
            >
              {identityLookup
                ? result.identityMatchKind === "exact"
                  ? "Exact profile match"
                  : result.identityMatchKind === "fuzzy"
                    ? "Possible profile match"
                    : "Profile name match"
                : rankingScore === null
                  ? "Match unavailable"
                  : externalProfile
                    ? `${rankingScore}% Preliminary match`
                    : `${rankingScore}% ${matchLabel}`}
            </span>
            {externalProfile && !identityLookup ? (
              <span
                className="text-[11px] text-slate-500"
                title="Evidence confidence and profile completeness are independent of match alignment."
              >
                Evidence {diagnostic.evidenceConfidence.toLocaleLowerCase()} ·{" "}
                {result.profileCompletenessPercent == null
                  ? "completeness not provided"
                  : `${result.profileCompletenessPercent}% complete`}
              </span>
            ) : null}
          </div>
          <dl className="hidden" aria-label="Candidate match dimensions">
            {!identityLookup ? (
              <>
                <div>
                  <dt className="inline">Requirement coverage</dt>
                  <dd className="ml-1 inline text-slate-300">
                    {diagnostic.requirementCoveragePercent == null
                      ? "Not applicable"
                      : `${diagnostic.requirementCoveragePercent}%`}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Ranking score</dt>
                  <dd className="ml-1 inline text-slate-300">
                    {rankingScore === null
                      ? "Not available"
                      : `${rankingScore}%`}
                  </dd>
                </div>
              </>
            ) : null}
            {!identityLookup ? (
              <div>
                <dt className="inline">Search-evidence confidence</dt>
                <dd className="ml-1 inline text-slate-300">
                  {diagnostic.evidenceConfidence}
                </dd>
              </div>
            ) : null}
            {!identityLookup ? (
              <div>
                <dt className="inline">Profile completeness</dt>
                <dd className="ml-1 inline text-slate-300">
                  {result.profileCompletenessPercent == null
                    ? "Not provided"
                    : `${result.profileCompletenessPercent}%`}
                </dd>
              </div>
            ) : null}
          </dl>
          {!identityLookup && matchSummary.length ? (
            <>
              <p className="mt-2 text-xs font-semibold text-slate-300">
                Match summary
              </p>
              <ul className="mt-1.5 space-y-1">
                {queryStatements.supported.map((item) => (
                  <li
                    key={item}
                    className="line-clamp-2 text-sm leading-5 text-slate-300"
                  >
                    <span className="mr-1 text-emerald-400">{"\u2713"}</span>
                    {item}
                  </li>
                ))}
                {queryStatements.gaps.map((item) => (
                  <li
                    key={item}
                    className="line-clamp-2 text-sm leading-5 text-slate-300"
                  >
                    <span className="mr-1 text-slate-500">-</span>
                    {item}
                  </li>
                ))}
                {false &&
                  diagnostic.criteria.map((criterion) => (
                    <li
                      key={`criterion:${criterion.id}`}
                      className="text-xs text-slate-400"
                    >
                      <span
                        className={`mr-1 ${criterion.score > 0 ? "text-cyan-300" : "text-slate-500"}`}
                      >
                        {criterion.score > 0 ? "\u25C6" : "-"}
                      </span>
                      {criterion.label} — {criterion.reason}
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
          {!identityLookup && criticalGap ? (
            <p className="mt-1 line-clamp-1 text-xs text-amber-300">
              <span className="mr-1">-</span>
              {criticalGap}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 lg:justify-end">
          {result.linkedInProfileUrl ? (
            <a
              href={result.linkedInProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-sky-700 px-3 text-sm font-semibold text-sky-200"
            >
              {result.talentPool === "linkedin_talent_pool"
                ? externalProfileActionLabel(result.linkedInProfileUrl)
                : "View LinkedIn"}
              <span className="sr-only">
                {" "}
                (opens external profile in a new tab)
              </span>
            </a>
          ) : null}
          <a
            href={shortlistHref}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Shortlist
          </a>
          <button
            type="button"
            data-candidate-details-trigger={result.candidateId}
            aria-expanded={expanded}
            aria-controls="candidate-details-drawer"
            onClick={onToggle}
            onPointerEnter={() => {
              void prefetchCandidateDetails(
                result.candidateId,
                result.talentPool,
              ).catch(() => {});
            }}
            onFocus={() => {
              void prefetchCandidateDetails(
                result.candidateId,
                result.talentPool,
              ).catch(() => {});
            }}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Open profile
          </button>
        </div>
      </div>
      {preview &&
      (preview.employment.length ||
        preview.projects.length ||
        preview.education) ? (
        <div className="mt-3 grid gap-3 border-t border-slate-800 pt-3 md:grid-cols-3">
          {preview.employment.length ? (
            <section className="min-w-0" aria-label="Recent experience">
              <h3 className="text-xs font-semibold text-slate-300">
                Recent experience ({preview.employmentCount})
              </h3>
              <ol className="mt-2 space-y-1.5">
                {preview.employment.slice(0, 3).map((item) => (
                  <li key={item.id} className="text-xs text-slate-400">
                    <p className="truncate font-medium text-slate-200">
                      {item.title || "Role not provided"}
                    </p>
                    <p className="truncate">
                      {[
                        item.employer,
                        item.start
                          ? formatCandidateProfilePeriod(
                              item.start,
                              item.end,
                              item.current,
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
              {preview.employmentCount > preview.employment.length ? (
                <button
                  type="button"
                  onClick={() => onOpenTab?.("Experience")}
                  className="mt-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                >
                  View all experience
                </button>
              ) : null}
            </section>
          ) : null}
          {preview.projects.length ? (
            <section className="min-w-0" aria-label="Relevant projects">
              <h3 className="text-xs font-semibold text-slate-300">
                Relevant projects ({preview.projectCount})
              </h3>
              <ol className="mt-2 space-y-1.5">
                {preview.projects.slice(0, 2).map((item) => (
                  <li key={item.id} className="text-xs text-slate-400">
                    <p className="truncate font-medium text-slate-200">
                      {item.name || "Project name not provided in source"}
                    </p>
                    <p className="line-clamp-2">
                      {[
                        item.client ? `Client: ${item.client}` : null,
                        item.role ? `Role: ${item.role}` : null,
                        ...item.lifecycle,
                        ...item.modules,
                        item.start
                          ? formatCandidateProfilePeriod(item.start, item.end)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
              {preview.projectCount > 2 ? (
                <button
                  type="button"
                  onClick={() => onOpenTab?.("Projects")}
                  className="mt-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                >
                  View all projects
                </button>
              ) : null}
            </section>
          ) : null}
          {preview.education ? (
            <section className="min-w-0" aria-label="Education">
              <h3 className="text-xs font-semibold text-slate-300">
                Education
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                {[
                  preview.education.qualification,
                  preview.education.fieldOfStudy,
                  preview.education.institution,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
      {false && expanded && integrity ? (
        <section
          id={"candidate-quick-view-" + result.candidateId}
          aria-label={"Quick review for " + candidateName}
          className="mt-4 border-t border-slate-800 pt-4"
        >
          <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Recruiter quick review
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">
                    Current / verified location
                  </dt>
                  <dd className="text-slate-200">{location}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Career experience</dt>
                  <dd className="text-slate-200">
                    {formatTotalCareerExperience(result.totalYearsExperience)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Latest role</dt>
                  <dd className="text-slate-200">
                    {candidateTitle || "Not stated"} · {employer}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Work authorization, visa, relocation and remote
                  </dt>
                  <dd className="text-amber-200">Not available in source</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Match to active search
              </h3>
              {integrity!.requirements.length ? (
                <ul className="mt-3 divide-y divide-slate-800">
                  {integrity!.requirements.map((requirement) => (
                    <li
                      key={requirement.id}
                      className="flex gap-3 py-2 text-sm"
                    >
                      <span
                        className={
                          requirement.state === "verified" ||
                          requirement.state === "supported"
                            ? "text-emerald-300"
                            : requirement.state === "conflicting"
                              ? "text-rose-300"
                              : "text-amber-300"
                        }
                      >
                        {stateLabel(requirement.state)}
                      </span>
                      <span className="min-w-0 text-slate-200">
                        {requirement.label}
                        <span className="block text-xs text-slate-500">
                          {requirement.reason}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-400">
                  Requirement-level assessment is unavailable for this
                  historical search.
                </p>
              )}
            </div>
          </div>
          {result.evidence?.length ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-300">
                Evidence provenance
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {result.evidence?.slice(0, 8).map((item, index) => (
                  <li key={item.label + index}>
                    {item.label}: {item.value}
                    {item.source ? " · " + item.source : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={shortlistHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200"
            >
              Shortlist
            </a>
            <button
              type="button"
              className="inline-flex min-h-9 items-center rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200"
            >
              Compare
            </button>
            <a
              href={candidateHref}
              className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-950"
            >
              Open full profile
            </a>
          </div>
        </section>
      ) : null}
    </article>
  );
}

export default function CandidateSearchV2Client({
  guidedSourcingEnabled = false,
}: {
  guidedSourcingEnabled?: boolean;
}) {
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const pendingResultsScrollPageRef = useRef<number | null>(null);
  const activeSearchKeyRef = useRef("");
  const pageCacheRef = useRef(new Map<number, SearchResponse>());
  const latestRequestIdRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const pendingSearchKeyRef = useRef("");
  const searchSourceRef = useRef<RecentSearch["source"]>("manual");
  const guidedConfirmationRevisionRef = useRef(0);
  const guidedOwnedFiltersRef = useRef<{
    countries: string;
    skills: string;
    sapModules: string;
  } | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRootRef = useRef<HTMLDivElement | null>(null);
  const historyVersionRef = useRef(0);
  const [historyMessage, setHistoryMessage] = useState("");
  const [query, setQuery] = useState("");

  const [countries, setCountries] = useState("");

  const [skills, setSkills] = useState("");

  const [sapModules, setSapModules] = useState("");
  const [languages, setLanguages] = useState("");
  const [talentPool, setTalentPool] = useState<
    "internal_profiles" | "linkedin_talent_pool"
  >("internal_profiles");
  const [internalSearchReady, setInternalSearchReady] = useState(false);
  const [internalReadinessFailure, setInternalReadinessFailure] = useState<
    string | null
  >(null);
  const [readinessAttempt, setReadinessAttempt] = useState(0);
  const [externalCapability, setExternalCapability] =
    useState<ExternalSearchCapability | null>(null);
  const sourceReadinessRevisionRef = useRef(0);
  const selectedTalentPoolRef = useRef(talentPool);
  const sourceReadiness = useMemo(
    () =>
      resolveSearchV2SourceReadiness({
        talentPool,
        internalReady: internalSearchReady,
        internalFailure: internalReadinessFailure,
        external: externalCapability,
      }),
    [
      talentPool,
      internalSearchReady,
      internalReadinessFailure,
      externalCapability,
    ],
  );
  const sourceCapabilities = externalCapability
    ? { external_talent_network: externalCapability }
    : null;
  const externalTalentNetworkOptionLabel =
    externalCapability?.connected === false
      ? "External Talent Network — Not configured"
      : "External Talent Network";
  const [includeRelocationRemote, setIncludeRelocationRemote] = useState(false);

  const [matchQuality, setMatchQuality] = useState<
    "any" | "relevant" | "strong"
  >("relevant");

  const [advancedFilterIntentKey, setAdvancedFilterIntentKey] = useState("");
  const [guidedSaveHref, setGuidedSaveHref] = useState("");
  const [guidedIntegrityPlan, setGuidedIntegrityPlan] = useState<
    GuidedSearchHandoff["integrityPlan"] | null
  >(null);
  const [guidedProvenance, setGuidedProvenance] = useState<
    GuidedSearchHandoff["provenance"] | null
  >(null);
  const [guidedSearchIdentity, setGuidedSearchIdentity] =
    useState<GuidedSearchIdentity | null>(null);
  const [guidedCriteriaNotice, setGuidedCriteriaNotice] = useState("");
  const [expandedCandidateId, setExpandedCandidateId] = useState("");
  const [drawerInitialTab, setDrawerInitialTab] = useState<
    "Overview" | "Experience" | "Projects" | "Education" | "Skills"
  >("Overview");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [criteria, setCriteria] = useState<CandidateSearchCriterion[]>([]);
  const [extendedFilters, setExtendedFilters] =
    useState<CandidateSearchV2Filters>({});
  const [preparation, dispatchPreparation] = useReducer(
    searchPreparationReducer,
    initialPreparation(""),
  );
  const [reviewCommitted, setReviewCommitted] = useState(false);
  const [searchEditorOpen, setSearchEditorOpen] = useState(true);
  const [guidedWorkspace, setGuidedWorkspace] = useState<
    "idle" | "source" | "review" | "prepared"
  >("idle");
  const [loading, setLoading] = useState(false);
  const [loadingExternalBatch, setLoadingExternalBatch] = useState(false);
  const [searchUiState, setSearchUiState] =
    useState<SearchUiState>("not_committed");
  const [searchElapsedMs, setSearchElapsedMs] = useState(0);
  const lastSearchArgsRef = useRef<{
    page: number;
    pagination: boolean;
    commit: boolean;
    externalBatchCursor?: string;
  } | null>(null);

  const [stillSearching, setStillSearching] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [committedSnapshot, setCommittedSnapshot] =
    useState<SearchSnapshot | null>(null);

  const invalidateGuidedSearch = useCallback(
    (showQueryChangedNotice = false) => {
      latestRequestIdRef.current += 1;
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
      pendingSearchKeyRef.current = "";
      pageCacheRef.current.clear();
      activeSearchKeyRef.current = "";
      setLoading(false);
      setStillSearching(false);
      setExpandedCandidateId("");
      setGuidedIntegrityPlan(null);
      setGuidedProvenance(null);
      setGuidedSearchIdentity(null);
      setGuidedSaveHref("");
      searchSourceRef.current = "manual";
      const owned = guidedOwnedFiltersRef.current;
      guidedOwnedFiltersRef.current = null;
      if (owned) {
        setCountries((current) => (current === owned.countries ? "" : current));
        setSkills((current) => (current === owned.skills ? "" : current));
        setSapModules((current) =>
          current === owned.sapModules ? "" : current,
        );
        setAdvancedFilterIntentKey("");
      }
      setGuidedCriteriaNotice(
        showQueryChangedNotice
          ? "Suggested Criteria cleared because the search description changed."
          : "",
      );
    },
    [],
  );
  const handleGuidedWorkspaceState = useCallback(
    (state: "idle" | "source" | "review" | "prepared") => {
      if ((state === "source" || state === "review") && guidedSearchIdentity)
        invalidateGuidedSearch(false);
      setGuidedWorkspace(state);
    },
    [guidedSearchIdentity, invalidateGuidedSearch],
  );

  const response = committedSnapshot?.response || EMPTY_SEARCH_RESPONSE;
  const renderVisibility = searchV2RenderVisibility(
    Boolean(committedSnapshot),
    loading,
  );
  const showCompactSearchSummary = Boolean(
    committedSnapshot && renderVisibility.showResults && !searchEditorOpen,
  );

  const results = response?.results || [];
  const externalRejectionPresentation = response?.rejectionSummary
    ? externalRejectionSummaryPresentation(response.rejectionSummary)
    : null;
  const committedIntent = committedSnapshot?.intent || EMPTY_RECRUITER_INTENT;
  const parsedIntent = useMemo(
    () => parseRecruiterSearchIntent(query),
    [query],
  );
  const unifiedIntent = useMemo(
    () => detectSearchV2UnifiedIntent(query),
    [query],
  );
  const minimumScore = matchQualityMinimumScore(matchQuality);
  // Parsed natural-language intent is scored as intent. Only values entered in
  // Advanced Filters become hard eligibility filters.
  const effectiveCountries = useMemo(
    () => recruiterSearchChips(parseList(countries), 20),
    [countries],
  );
  const effectiveRequiredLocations = useMemo(
    () => requiredLocationAlternatives(query, parseList(countries)),
    [query, countries],
  );
  const effectiveLocations = useMemo(
    () => effectiveRequiredLocations.map((item) => item.label),
    [effectiveRequiredLocations],
  );
  const effectiveSkills = useMemo(
    () => recruiterSearchChips(parseList(skills), 20),
    [skills],
  );
  const effectiveSapModules = useMemo(
    () => recruiterSearchChips(parseList(sapModules), 20),
    [sapModules],
  );
  const effectiveLanguages = useMemo(
    () => recruiterSearchChips(parseList(languages), 20),
    [languages],
  );
  const understoodChips = [
    ...new Set([...parsedIntent.seniority, ...parsedIntent.skills]),
  ];
  const locationRuleChips = effectiveRequiredLocations.length
    ? [
        `Location: ${requiredLocationDisplay(effectiveRequiredLocations)} · Required`,
      ]
    : [];
  const expandedChips = recruiterSearchChips(
    [...parsedIntent.expandedConcepts, ...parsedIntent.sapModules],
    16,
  ).filter(
    (item) =>
      !understoodChips.some(
        (understood) => understood.toLowerCase() === item.toLowerCase(),
      ),
  );
  const reviewPreview = useMemo(
    () =>
      buildCommittedSearchRequirements({
        query,
        minimumScore,
        filters: {
          ...extendedFilters,
          countries: [],
          locations: effectiveLocations,
          skills: effectiveSkills,
          sapModules: effectiveSapModules,
          languages: effectiveLanguages,
        },
        criteria,
        clarificationAnswers: confirmedClarificationValues(preparation),
        talentPool,
        includeRelocationRemote,
      }),
    [
      query,
      minimumScore,
      extendedFilters,
      effectiveLocations,
      effectiveSkills,
      effectiveSapModules,
      effectiveLanguages,
      criteria,
      preparation,
      talentPool,
      includeRelocationRemote,
    ],
  );
  const activeFilterCount = canonicalHardRequirementCounts(reviewPreview).total;
  const previewForFilters = useCallback(
    (nextFilters: CandidateSearchV2Filters) =>
      buildCommittedSearchRequirements({
        query,
        minimumScore,
        filters: nextFilters,
        criteria,
        clarificationAnswers: confirmedClarificationValues(preparation),
        talentPool,
        includeRelocationRemote,
      }),
    [
      query,
      minimumScore,
      criteria,
      preparation,
      talentPool,
      includeRelocationRemote,
    ],
  );
  const integrityFilterChips =
    guidedIntegrityPlan?.requirements
      .filter((requirement) => requirement.required)
      .map((requirement) => {
        if (requirement.kind === "location")
          return (
            "Location: " +
            (requirement.country || requirement.values.join(", ")) +
            " · Required"
          );
        if (requirement.kind === "experience")
          return "Experience: " + String(requirement.minimum || "") + "+ years";
        if (requirement.kind === "language")
          return "Languages: " + requirement.values.join(", ");
        if (requirement.kind === "sap")
          return "SAP: " + requirement.values.join(", ");
        if (requirement.kind === "implementation")
          return (
            "Projects: " +
            String(requirement.minimum || "2") +
            "+ implementations"
          );
        return "";
      })
      .filter(Boolean) || [];
  const languageRuleChips = effectiveLanguages.map(
    (language) => `Language: ${language} · Required`,
  );
  const searchContextId = useMemo(
    () => candidate360SearchContextId(response),
    [response],
  );
  const diagnosticsByCandidate = useMemo(() => {
    const identityLookup = [
      "candidate_name_lookup",
      "identity_token_lookup",
    ].includes(response.searchIntent?.type || "");
    return new Map(
      results.map((result) => [
        result.candidateId,
        candidateMatchDiagnostic(result, committedIntent, identityLookup),
      ]),
    );
  }, [results, committedIntent, response.searchIntent?.type]);
  const selectedDrawerCandidate =
    results.find((result) => result.candidateId === expandedCandidateId) ||
    null;
  const showingPreviousResults = Boolean(
    committedSnapshot &&
    (searchEditorOpen ||
      normalizePreparedSearchQuery(committedSnapshot.query) !==
        normalizePreparedSearchQuery(query)),
  );
  const closeCandidateDrawer = useCallback(() => {
    const candidateId = expandedCandidateId;
    setExpandedCandidateId("");
    window.requestAnimationFrame(() => {
      const trigger = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          "[data-candidate-details-trigger]",
        ),
      ).find(
        (button) => button.dataset.candidateDetailsTrigger === candidateId,
      );
      trigger?.focus();
    });
  }, [expandedCandidateId]);

  const historySuggestions = useMemo(
    () => rankSearchHistory(recentSearches, query, 5),
    [recentSearches, query],
  );
  const loadRecentSearches = () => {
    const version = historyVersionRef.current;
    return fetch("/api/recruiter/search-v2/history", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (
          version === historyVersionRef.current &&
          Array.isArray(payload?.items)
        )
          setRecentSearches(payload.items);
      })
      .catch(() => {});
  };
  useEffect(() => {
    void loadRecentSearches();
  }, []);
  useEffect(() => {
    selectedTalentPoolRef.current = talentPool;
    const revision = ++sourceReadinessRevisionRef.current;
    if (talentPool === "linkedin_talent_pool") {
      setExternalCapability(null);
      void fetchExternalSearchCapability()
        .then((capability) => {
          if (
            revision === sourceReadinessRevisionRef.current &&
            selectedTalentPoolRef.current === "linkedin_talent_pool"
          )
            setExternalCapability(capability);
        })
        .catch(() => {
          if (
            revision === sourceReadinessRevisionRef.current &&
            selectedTalentPoolRef.current === "linkedin_talent_pool"
          )
            setExternalCapability({
              available: false,
              connected: true,
              reason: "SOURCE_UNAVAILABLE",
              status: "unavailable",
            });
        });
      return;
    }
    setInternalSearchReady(false);
    setInternalReadinessFailure(null);
    const polling = startSearchV2ReadinessPolling({
      load: (signal, retryFailed) => ensureSearchReadiness(signal, retryFailed),
      onState: (state) => {
        if (
          revision !== sourceReadinessRevisionRef.current ||
          selectedTalentPoolRef.current !== "internal_profiles"
        )
          return;
        if (state.status === "ready") {
          setInternalSearchReady(true);
          setInternalReadinessFailure(null);
        } else if (state.status === "failed") {
          setInternalSearchReady(false);
          setInternalReadinessFailure(state.message);
        } else {
          setInternalSearchReady(false);
          setInternalReadinessFailure(null);
        }
      },
    });
    return () => polling.stop();
  }, [talentPool, readinessAttempt]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!historyRootRef.current?.contains(event.target as Node))
        setHistoryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const selectHistory = (item: RecentSearch) => {
    invalidateGuidedSearch(false);
    setQuery(item.query);
    setCountries(item.filters.countries.join(", "));
    setSkills(item.filters.skills.join(", "));
    setSapModules(item.filters.sapModules.join(", "));
    setLanguages((item.filters.languages || []).join(", "));
    setMatchQuality(item.matchQuality);
    if (
      item.committedSnapshot?.query === item.query &&
      item.committedSnapshot.semanticIdentity
    ) {
      setTalentPool(item.committedSnapshot.talentPool);
      setIncludeRelocationRemote(
        item.committedSnapshot.includeRelocationRemote,
      );
      setCriteria([...item.committedSnapshot.criteria]);
      setExtendedFilters(item.filterSnapshot || {});
      if (item.preparationSnapshot)
        dispatchPreparation({
          type: "restore",
          state: item.preparationSnapshot,
        });
      else dispatchPreparation({ type: "reset", query: item.query });
      setReviewCommitted(true);
    } else {
      setTalentPool("internal_profiles");
      setIncludeRelocationRemote(false);
      setCriteria([]);
      setExtendedFilters({});
      dispatchPreparation({ type: "reset", query: item.query });
      setReviewCommitted(false);
    }
    if (validGuidedSearchSnapshot(item.guidedPlanSnapshot, item.query)) {
      const snapshot = item.guidedPlanSnapshot;
      setGuidedIntegrityPlan(snapshot.integrityPlan);
      setGuidedProvenance(snapshot.provenance);
      setGuidedSearchIdentity(snapshot.identity);
      guidedConfirmationRevisionRef.current = Math.max(
        guidedConfirmationRevisionRef.current,
        snapshot.identity.confirmationRevision,
      );
      guidedOwnedFiltersRef.current = {
        countries: item.filters.countries.join(", "),
        skills: item.filters.skills.join(", "),
        sapModules: item.filters.sapModules.join(", "),
      };
      searchSourceRef.current = item.source;
    }
    setHistoryOpen(false);
    setHistoryIndex(-1);
  };
  const clearSearchHistory = async () => {
    if (
      !window.confirm(
        "Clear all recent searches? Your current query and results will stay open.",
      )
    )
      return;
    const previous = recentSearches;
    historyVersionRef.current += 1;
    setRecentSearches([]);
    setHistoryOpen(false);
    setHistoryIndex(-1);
    setHistoryMessage("Clearing search history...");
    try {
      const response = await fetch("/api/recruiter/search-v2/history", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("clear_failed");
      setHistoryMessage("Search history cleared.");
    } catch {
      setRecentSearches(previous);
      setHistoryMessage("Search history could not be cleared. Please retry.");
    }
  };
  const removeSearchHistoryItem = async (id: string) => {
    const previous = recentSearches;
    historyVersionRef.current += 1;
    setRecentSearches((items) => items.filter((item) => item.id !== id));
    setHistoryMessage("Removing saved search...");
    try {
      const response = await fetch(
        `/api/recruiter/search-v2/history?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("remove_failed");
      setHistoryMessage("Saved search removed. Current draft is unchanged.");
    } catch {
      setRecentSearches(previous);
      setHistoryMessage("Saved search could not be removed. Please retry.");
    }
  };

  const summaryText = useMemo(() => {
    if (
      committedSnapshot?.committedRequirements.talentPool ===
      "linkedin_talent_pool"
    )
      return `${(response.loadedExternalTotal ?? response.summary.totalDocuments).toLocaleString()} external profiles loaded and evaluated`;
    if (
      ["candidate_name_lookup", "identity_token_lookup"].includes(
        response.searchIntent?.type || "",
      )
    )
      return `${response.summary.visibleTotal.toLocaleString()} candidate${response.summary.visibleTotal === 1 ? "" : "s"} found`;
    if (response.searchIntent?.type === "hybrid_candidate_evaluation")
      return `${response.summary.visibleTotal.toLocaleString()} named candidate${response.summary.visibleTotal === 1 ? "" : "s"} evaluated`;
    return internalSearchV2ResultSummaryText({
      returned: response.results.length,
      visibleTotal: response.summary.visibleTotal,
      eligibleTotal: response.summary.eligibleTotal,
    });
  }, [committedSnapshot, response]);

  useEffect(() => {
    const resumeSearchContext = new URLSearchParams(window.location.search).get(
      "resumeSearch",
    );
    if (!resumeSearchContext) {
      window.sessionStorage.removeItem(CANDIDATE360_SEARCH_CONTEXT_KEY);
      const incoming = new URLSearchParams(window.location.search);
      const incomingQuery = (incoming.get("q") || "").trim();
      if (incomingQuery) setQuery(incomingQuery);
      const incomingCountries = incoming.getAll("countries").join(", ");
      if (incomingCountries) setCountries(incomingCountries);
      const incomingSkills = incoming.getAll("skills").join(", ");
      if (incomingSkills) setSkills(incomingSkills);
      const incomingModules = incoming.getAll("sapModules").join(", ");
      if (incomingModules) setSapModules(incomingModules);
      const incomingQuality = incoming.get("matchQuality");
      if (
        incomingQuality === "any" ||
        incomingQuality === "relevant" ||
        incomingQuality === "strong"
      )
        setMatchQuality(incomingQuality);
      return;
    }
    const loadedSnapshot = loadSearchV2SessionSnapshot(
      window.sessionStorage,
      CANDIDATE360_SEARCH_CONTEXT_KEY,
    );
    if (loadedSnapshot.status !== "restored") return;
    const saved = loadedSnapshot.snapshot;
    if (saved.contextId !== resumeSearchContext) {
      window.sessionStorage.removeItem(CANDIDATE360_SEARCH_CONTEXT_KEY);
      return;
    }
    const freshUrl = new URL(window.location.href);
    freshUrl.searchParams.delete("resumeSearch");
    window.history.replaceState(
      null,
      "",
      `${freshUrl.pathname}${freshUrl.search}${freshUrl.hash}`,
    );
    const restoredResponse = loadedSnapshot.response as SearchResponse | null;

    const restoredQuery = typeof saved.query === "string" ? saved.query : query;
    const restoredFilters = restoredTalentSearchAdvancedFilters(
      saved,
      parseRecruiterSearchIntent(restoredQuery).roleConcepts,
    );
    const restoredMinimumScore =
      typeof saved.minimumScore === "number" &&
      Number.isFinite(saved.minimumScore)
        ? saved.minimumScore
        : 0;
    const restoredMatchQuality =
      restoredMinimumScore >= 55
        ? "strong"
        : restoredMinimumScore >= 20
          ? "relevant"
          : "any";
    setQuery(restoredQuery);
    setCountries(restoredFilters.countries);
    setSkills(restoredFilters.skills);
    setSapModules(restoredFilters.sapModules);
    setLanguages(restoredFilters.languages);
    setAdvancedFilterIntentKey(
      saved.advancedFilterIntentKey === undefined
        ? talentSearchRoleIntentKey(
            parseRecruiterSearchIntent(restoredQuery).roleConcepts,
          )
        : typeof saved.advancedFilterIntentKey === "string"
          ? saved.advancedFilterIntentKey
          : "",
    );
    setMatchQuality(restoredMatchQuality);

    if (restoredResponse) {
      const restoredEffective = {
        countries: recruiterSearchChips(
          parseList(restoredFilters.countries),
          20,
        ),
        skills: recruiterSearchChips(parseList(restoredFilters.skills), 20),
        sapModules: recruiterSearchChips(
          parseList(restoredFilters.sapModules),
          20,
        ),
        languages: recruiterSearchChips(
          parseList(restoredFilters.languages),
          20,
        ),
      };
      const restoredSearchKey = JSON.stringify({
        query: restoredQuery
          .normalize("NFKC")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase(),
        mode: "hybrid",
        minimumScore: restoredMinimumScore,
        filters: restoredEffective,
      });
      activeSearchKeyRef.current = restoredSearchKey;
      setSearchEditorOpen(false);
      setCommittedSnapshot({
        query: restoredQuery,
        intent: parseRecruiterSearchIntent(restoredQuery),
        filters: {
          ...restoredFilters,
          effectiveCountries: restoredEffective.countries,
          effectiveLocations: restoredEffective.countries,
          effectiveSkills: restoredEffective.skills,
          effectiveSapModules: restoredEffective.sapModules,
          effectiveLanguages: restoredEffective.languages,
        },
        committedRequirements: buildCommittedSearchRequirements(
          {
            query: restoredQuery,
            minimumScore: restoredMinimumScore,
            filters: {
              locations: restoredEffective.countries,
              skills: restoredEffective.skills,
              sapModules: restoredEffective.sapModules,
              languages: restoredEffective.languages,
            },
          },
          "history",
        ),
        matchQuality: restoredMatchQuality,
        minimumScore: restoredMinimumScore,
        integrityPlan: null,
        provenance: null,
        searchKey: restoredSearchKey,
        response: restoredResponse,
      });
    }
    requestAnimationFrame(() =>
      window.scrollTo({
        top: typeof saved.searchScrollY === "number" ? saved.searchScrollY : 0,
      }),
    );
  }, []);

  useEffect(() => {
    if (!response || !committedSnapshot) return;
    const save = () => {
      const matchedByCandidate = candidate360MatchedByCandidate(
        response.results,
        response.evaluationMode,
        (item) =>
          recruiterProfileConfidence(item as unknown as EvaluatedSearchResult),
      );
      const integrityByCandidate = Object.fromEntries(
        response.results
          .filter((item) => item.integrity)
          .map((item) => [item.candidateId, item.integrity]),
      );
      window.sessionStorage.setItem(
        CANDIDATE360_SEARCH_CONTEXT_KEY,
        JSON.stringify({
          contextId: searchContextId,
          query: committedSnapshot!.query,
          countries: committedSnapshot!.filters.countries,
          skills: committedSnapshot!.filters.skills,
          sapModules: committedSnapshot!.filters.sapModules,
          languages: committedSnapshot!.filters.languages,
          minimumScore: committedSnapshot!.minimumScore,
          response,
          advancedFilterIntentKey,
          candidateIds: results.map((item) => item.candidateId),
          matchedByCandidate,
          integrityByCandidate,
          filters: {
            countries: committedSnapshot!.filters.effectiveCountries,
            skills: committedSnapshot!.filters.effectiveSkills,
            sapModules: committedSnapshot!.filters.effectiveSapModules,
            languages: committedSnapshot!.filters.effectiveLanguages,
          },
          integrityPlan: committedSnapshot!.integrityPlan,
          provenance: committedSnapshot!.provenance
            ? {
                ...committedSnapshot!.provenance,
                planIdentity: committedSnapshot!.integrityPlan?.planIdentity,
              }
            : undefined,
          committedRequirements: committedSnapshot!.committedRequirements,
          returnUrl: `${buildSearchReturnUrl({ query: committedSnapshot!.query, countries: committedSnapshot!.filters.countries, skills: committedSnapshot!.filters.skills, sapModules: committedSnapshot!.filters.sapModules, matchQuality: committedSnapshot!.matchQuality, page: response.summary.page })}&resumeSearch=${encodeURIComponent(searchContextId)}`,
          searchScrollY: window.scrollY,
        }),
      );
    };
    save();
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [
    response,
    committedSnapshot,
    results,
    searchContextId,
    advancedFilterIntentKey,
  ]);

  useEffect(() => {
    if (
      !response ||
      pendingResultsScrollPageRef.current !== response.summary.page
    )
      return;
    pendingResultsScrollPageRef.current = null;
    requestAnimationFrame(() =>
      resultsSectionRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      }),
    );
  }, [response]);

  function handleQueryChange(nextQuery: string) {
    if (
      guidedSearchIdentity &&
      !guidedIdentityMatchesQuery(guidedSearchIdentity, nextQuery)
    )
      invalidateGuidedSearch(true);
    const semanticQueryChanged =
      normalizePreparedSearchQuery(nextQuery) !==
      normalizePreparedSearchQuery(query);
    if (semanticQueryChanged) {
      // Search requirements belong to the semantic query that created them.
      // Without a visible pin/keep contract, a new description starts a clean
      // draft. The immutable committed snapshot remains available as previous
      // results until this new draft is explicitly committed.
      setCountries("");
      setSkills("");
      setSapModules("");
      setLanguages("");
      setExtendedFilters({});
      setCriteria([]);
      setAdvancedFilterIntentKey("");
      dispatchPreparation({ type: "reset", query: nextQuery });
      setReviewCommitted(false);
    }
    setQuery(nextQuery);
  }
  function clearCurrentSearch() {
    invalidateGuidedSearch(false);
    setQuery("");
    setCountries("");
    setSkills("");
    setSapModules("");
    setLanguages("");
    setExtendedFilters({});
    setCriteria([]);
    setAdvancedFilterIntentKey("");
    dispatchPreparation({ type: "reset", query: "" });
    setReviewCommitted(false);
    setSearchEditorOpen(true);
    setFiltersOpen(false);
    setCriteriaOpen(false);
    setHistoryMessage("Current search cleared. Saved history is unchanged.");
  }
  function applyGuidedHandoff(handoff: GuidedSearchHandoff) {
    invalidateGuidedSearch(false);
    const confirmationRevision = ++guidedConfirmationRevisionRef.current;
    const identity = buildGuidedSearchIdentity(handoff, confirmationRevision);
    searchSourceRef.current = handoff.provenance.sourceType || "guided";
    setQuery(handoff.query);
    const ownedFilters = {
      countries: handoff.filters.countries.join(", "),
      skills: handoff.filters.skills.join(", "),
      sapModules: handoff.filters.sapModules.join(", "),
    };
    guidedOwnedFiltersRef.current = ownedFilters;
    setCountries(ownedFilters.countries);
    setSkills(ownedFilters.skills);
    setSapModules(ownedFilters.sapModules);
    setGuidedIntegrityPlan(handoff.integrityPlan);
    setGuidedProvenance(handoff.provenance);
    setGuidedSearchIdentity(identity);
    setAdvancedFilterIntentKey(
      talentSearchRoleIntentKey(
        parseRecruiterSearchIntent(handoff.query).roleConcepts,
      ),
    );
    setGuidedSaveHref(
      `/recruiter/saved-searches?${new URLSearchParams(handoff.savePreviewParams).toString()}`,
    );
    setError(null);
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clickReceivedAt = performance.now();
    const queryNormalization = normalizeSearchV2Query(query);
    if (!queryNormalization.rawQuery.trim()) return;
    const preparedQuery = queryNormalization.normalizedQuery;
    const fastReview = buildSearchV2FastReview({
      query: preparedQuery,
      minimumScore,
      filters: {
        ...extendedFilters,
        countries: [],
        locations: effectiveLocations,
        skills: effectiveSkills,
        sapModules: effectiveSapModules,
        languages: effectiveLanguages,
      },
      criteria,
      talentPool,
      includeRelocationRemote,
    });
    dispatchPreparation({ type: "prepare", query: preparedQuery });
    // A concise description with explicit structured intent is complete enough
    // to review. Missing preferences remain optional; they are not blocking
    // questions and are never invented as hard requirements.
    dispatchPreparation({
      type: "prepared",
      identity: fastReview.identity,
      questions: [],
    });
    const preparedIntent = detectSearchV2UnifiedIntent(preparedQuery);
    if (
      ["candidate_name_lookup", "identity_token_lookup"].includes(
        preparedIntent.type,
      )
    )
      setCriteria([]);
    else if (!criteria.length) setCriteria([...fastReview.preview.criteria]);
    if (window.localStorage.getItem("search-v2-debug-timings") === "true")
      console.debug("[search-v2-review-timing]", {
        clickToContractMs: Number(
          (performance.now() - clickReceivedAt).toFixed(2),
        ),
        normalizationMs: Number(fastReview.timing.normalizationMs.toFixed(2)),
        requirementConstructionMs: Number(
          fastReview.timing.requirementConstructionMs.toFixed(2),
        ),
        externalRequestCount: fastReview.timing.externalRequestCount,
        cacheHit: fastReview.timing.cacheHit,
      });
    setReviewCommitted(false);
  }

  async function runSearch(
    pageNumber: number,
    paginationNavigation = false,
    commitReviewedSearch = false,
    externalBatchCursor?: string,
  ) {
    const clientRequestStartedAt = performance.now();
    if (
      paginationNavigation &&
      (loading || Boolean(pendingSearchKeyRef.current))
    )
      return;
    if (!paginationNavigation && !commitReviewedSearch && !reviewCommitted)
      return;
    const requestRawQuery =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.rawQuery || committedSnapshot.query
        : query;
    const requestQuery =
      normalizeSearchV2Query(requestRawQuery).normalizedQuery;
    const requestIntent =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.intent
        : parseRecruiterSearchIntent(requestQuery);
    const requestFilters =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.filters
        : {
            countries,
            skills,
            sapModules,
            languages,
            effectiveCountries,
            effectiveLocations,
            effectiveSkills,
            effectiveSapModules,
            effectiveLanguages,
            extendedFilters,
          };
    const requestMatchQuality =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.matchQuality
        : matchQuality;
    const requestMinimumScore =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.minimumScore
        : minimumScore;
    const requestTalentPool =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.committedRequirements.talentPool
        : talentPool;
    const requestUnifiedIntent = detectSearchV2UnifiedIntent(requestQuery);
    const lightweightIdentityTokenLookup =
      requestTalentPool === "internal_profiles" &&
      requestUnifiedIntent.type === "identity_token_lookup";
    const requestSourceReadinessRevision = sourceReadinessRevisionRef.current;
    const knownRequestReadiness = resolveSearchV2SourceReadiness({
      talentPool: requestTalentPool,
      internalReady: internalSearchReady,
      external: externalCapability,
    });
    if (
      !knownRequestReadiness.ready &&
      requestTalentPool === "linkedin_talent_pool" &&
      externalCapability
    ) {
      setError(knownRequestReadiness.message);
      setSearchUiState("failed");
      return;
    }
    const requestCriteria =
      paginationNavigation && committedSnapshot
        ? [...committedSnapshot.committedRequirements.criteria]
        : [...criteria];
    const requestClarificationAnswers =
      paginationNavigation && committedSnapshot
        ? { ...committedSnapshot.committedRequirements.clarificationAnswers }
        : confirmedClarificationValues(preparation);
    const guidedPlanMatchesRequest = guidedIdentityMatchesQuery(
      guidedSearchIdentity,
      requestQuery,
    );
    const requestIntegrityPlan =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.integrityPlan
        : guidedPlanMatchesRequest
          ? guidedIntegrityPlan
          : null;
    const requestProvenance =
      paginationNavigation && committedSnapshot
        ? committedSnapshot.provenance
        : guidedPlanMatchesRequest
          ? guidedProvenance
          : null;
    const requestGuidedSnapshot =
      !paginationNavigation &&
      guidedPlanMatchesRequest &&
      guidedSearchIdentity &&
      requestIntegrityPlan &&
      requestProvenance
        ? {
            identity: guidedSearchIdentity,
            integrityPlan: requestIntegrityPlan,
            provenance: requestProvenance,
          }
        : undefined;
    const browserRequest = buildSearchV2BrowserRequest({
      query: requestQuery,
      matchQuality: requestMatchQuality,
      mode: "hybrid",
      filters: {
        ...requestFilters.extendedFilters,
        countries: [],
        locations: requestFilters.effectiveLocations,
        skills: requestFilters.effectiveSkills,
        sapModules: requestFilters.effectiveSapModules,
        languages: requestFilters.effectiveLanguages,
      },
      page: pageNumber,
      pageSize: 20,
      talentPool: requestTalentPool,
      criteria: requestCriteria,
      clarificationAnswers: requestClarificationAnswers,
    });
    const requestCommittedRequirements = buildCommittedSearchRequirements(
      {
        ...browserRequest,
        includeRelocationRemote:
          paginationNavigation && committedSnapshot
            ? committedSnapshot.committedRequirements.includeRelocationRemote
            : requestIntegrityPlan?.includeRelocationRemote === true ||
              includeRelocationRemote,
      },
      requestIntegrityPlan ? "guided" : "query",
    );
    const requestConstructionMs = performance.now() - clientRequestStartedAt;
    const semanticSearchKey = JSON.stringify({
      query: requestQuery
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
      mode: "hybrid",
      minimumScore: requestMinimumScore,
      talentPool: requestTalentPool,
      committedRequirements: requestCommittedRequirements.semanticIdentity,
      integrityPlan: requestIntegrityPlan,
    });
    const changingPage = Boolean(
      paginationNavigation &&
      committedSnapshot &&
      committedSnapshot.response.summary.page !== pageNumber,
    );
    const pendingKey = `${semanticSearchKey}:page:${pageNumber}${externalBatchCursor ? ":external-batch:" + externalBatchCursor : ""}`;
    if (pendingSearchKeyRef.current === pendingKey) return;
    const snapshotBase = {
      query: requestQuery,
      rawQuery: requestRawQuery,
      intent: requestIntent,
      filters: requestFilters,
      matchQuality: requestMatchQuality,
      minimumScore: requestMinimumScore,
      integrityPlan: requestIntegrityPlan,
      provenance: requestProvenance,
      searchKey: semanticSearchKey,
      committedRequirements: requestCommittedRequirements,
    };
    const requestId = ++latestRequestIdRef.current;
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    if (
      activeSearchKeyRef.current === semanticSearchKey &&
      !externalBatchCursor
    ) {
      const cachedPage = pageCacheRef.current.get(pageNumber);
      if (cachedPage) {
        const normalizedCachedPage = normalizeSearchV2Response(cachedPage);
        if (!normalizedCachedPage.ok) {
          pageCacheRef.current.clear();
          setError(INVALID_SEARCH_RESPONSE_MESSAGE);
        } else {
          if (changingPage) pendingResultsScrollPageRef.current = pageNumber;
          setError(null);
          setCommittedSnapshot({
            ...snapshotBase,
            response: normalizedCachedPage.response as SearchResponse,
          });
          setLoading(false);
          setSearchUiState(
            normalizedCachedPage.response.results.length
              ? "showing_results"
              : "completed_zero",
          );
          return;
        }
      }
    } else {
      activeSearchKeyRef.current = semanticSearchKey;
      pageCacheRef.current.clear();
    }

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;
    pendingSearchKeyRef.current = pendingKey;
    setLoading(true);
    setLoadingExternalBatch(Boolean(externalBatchCursor));
    lastSearchArgsRef.current = {
      page: pageNumber,
      pagination: paginationNavigation,
      commit: commitReviewedSearch,
      ...(externalBatchCursor ? { externalBatchCursor } : {}),
    };
    setSearchElapsedMs(0);
    setSearchUiState(
      committedSnapshot ? "refreshing_existing_results" : "searching_initial",
    );
    setStillSearching(false);
    const stillSearchingTimer = window.setTimeout(() => {
      if (
        latestRequestIdRef.current === requestId &&
        !abortController.signal.aborted
      )
        setStillSearching(true);
    }, 1000);
    const elapsedStartedAt = performance.now();
    const elapsedTimer = window.setInterval(() => {
      if (latestRequestIdRef.current === requestId)
        setSearchElapsedMs(performance.now() - elapsedStartedAt);
    }, 250);
    const timeoutTimer = window.setTimeout(() => {
      if (
        latestRequestIdRef.current === requestId &&
        !abortController.signal.aborted
      ) {
        abortController.abort();
        setSearchUiState("timed_out");
        setError("Candidate search could not be prepared. Please try again.");
        setLoading(false);
      }
    }, 15000);
    setError(null);
    try {
      const readinessStartedAt = performance.now();
      // Readiness is already warmed and tracked by the page-level poller. Do
      // not add a second serial GET before every internal search; only recheck
      // when the known state is not ready (or for the external provider).
      const requestReadiness = lightweightIdentityTokenLookup
        ? { ready: true, message: null }
        : knownRequestReadiness.ready
          ? knownRequestReadiness
          : await loadSearchV2SourceReadiness({
              talentPool: requestTalentPool,
              loadExternal: () =>
                fetchExternalSearchCapability().then((capability) => {
                  if (selectedTalentPoolRef.current === "linkedin_talent_pool")
                    setExternalCapability(capability);
                  return capability;
                }),
              loadInternal: () =>
                ensureSearchReadiness().then((value) => {
                  const ready =
                    value.ready &&
                    value.sources?.internal_profiles?.available !== false;
                  if (selectedTalentPoolRef.current === "internal_profiles")
                    setInternalSearchReady(ready);
                  return ready;
                }),
            });
      const readinessWaitMs = performance.now() - readinessStartedAt;
      if (
        latestRequestIdRef.current !== requestId ||
        abortController.signal.aborted ||
        selectedTalentPoolRef.current !== requestTalentPool ||
        sourceReadinessRevisionRef.current !== requestSourceReadinessRevision
      )
        return;
      if (!requestReadiness.ready)
        throw new Error(
          requestReadiness.message || "Selected talent source is unavailable.",
        );
      const networkStartedAt = performance.now();
      const correlatedRequestId = `search-${requestId}-${Date.now().toString(36)}`;
      const fetchResponse = await fetch("/api/recruiter/search-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Search-Request-Id": correlatedRequestId,
        },
        signal: abortController.signal,
        body: JSON.stringify({
          ...browserRequest,
          rawQuery: requestRawQuery,
          ...(paginationNavigation &&
          !externalBatchCursor &&
          response.nextCursor &&
          pageNumber === response.summary.page + 1
            ? { cursor: response.nextCursor }
            : {}),
          ...(externalBatchCursor ? { externalBatchCursor } : {}),
          ...(requestIntegrityPlan
            ? { integrityPlan: requestIntegrityPlan }
            : {}),
          includeRelocationRemote:
            requestCommittedRequirements.includeRelocationRemote,
        }),
      });
      const payload: unknown = await fetchResponse.json();
      const networkMs = performance.now() - networkStartedAt;
      if (!fetchResponse.ok)
        throw new Error(
          payload &&
            typeof payload === "object" &&
            "error" in payload &&
            (typeof payload.error === "string" ||
              (payload.error &&
                typeof payload.error === "object" &&
                "message" in payload.error &&
                typeof payload.error.message === "string"))
            ? typeof payload.error === "string"
              ? payload.error
              : String(payload.error.message)
            : `Search failed with HTTP ${fetchResponse.status}.`,
        );
      const reconciliation = reconcileSearchV2Response({
        payload,
        requestId,
        latestRequestId: latestRequestIdRef.current,
        aborted: abortController.signal.aborted,
        requestTalentPool,
        activeTalentPool: selectedTalentPoolRef.current,
        requestSourceRevision: requestSourceReadinessRevision,
        activeSourceRevision: sourceReadinessRevisionRef.current,
      });
      if (reconciliation.status === "stale") return;
      if (reconciliation.status === "invalid")
        throw new Error(INVALID_SEARCH_RESPONSE_MESSAGE);
      const committedResponse = reconciliation.response as SearchResponse;
      const reconciliationStartedAt = performance.now();
      if (externalBatchCursor) pageCacheRef.current.clear();
      pendingResultsScrollPageRef.current = pageNumber;
      setCommittedSnapshot({ ...snapshotBase, response: committedResponse });
      setSearchUiState(
        committedResponse.results.length ? "showing_results" : "completed_zero",
      );
      setReviewCommitted(true);
      setSearchEditorOpen(false);
      if (pageNumber === 1 && !changingPage) {
        void fetch("/api/recruiter/search-v2/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: requestQuery,
            rawQuery: requestRawQuery,
            filters: {
              countries: requestFilters.effectiveLocations,
              skills: requestFilters.effectiveSkills,
              sapModules: requestFilters.effectiveSapModules,
              languages: requestFilters.effectiveLanguages,
            },
            matchQuality: requestMatchQuality,
            minimumScore: requestMinimumScore,
            source: searchSourceRef.current,
            committedSnapshot: requestCommittedRequirements,
            preparationSnapshot: preparation,
            talentPool: requestTalentPool,
            filterSnapshot: browserRequest.filters,
            ...(requestGuidedSnapshot
              ? { guidedPlanSnapshot: requestGuidedSnapshot }
              : {}),
          }),
        })
          .then(() => loadRecentSearches())
          .catch(() => {});
      }
      pageCacheRef.current.set(pageNumber, committedResponse);
      if (changingPage) pendingResultsScrollPageRef.current = pageNumber;
      if (window.localStorage.getItem("search-v2-debug-timings") === "true")
        window.requestAnimationFrame(() =>
          console.debug("[Search V2 timing]", {
            requestId: correlatedRequestId,
            semanticIdentity: requestCommittedRequirements.semanticIdentity,
            page: pageNumber,
            requestConstructionMs: +requestConstructionMs.toFixed(1),
            readinessWaitMs: +readinessWaitMs.toFixed(1),
            networkMs: +networkMs.toFixed(1),
            reconciliationAndRenderMs: +(
              performance.now() - reconciliationStartedAt
            ).toFixed(1),
            serverTiming: fetchResponse.headers.get("Server-Timing"),
            server: (
              committedResponse.source as { timing?: unknown } | undefined
            )?.timing,
          }),
        );
    } catch (searchError) {
      if (
        abortController.signal.aborted ||
        latestRequestIdRef.current !== requestId
      )
        return;
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Candidate search failed.",
      );
      setSearchUiState("failed");
    } finally {
      window.clearTimeout(stillSearchingTimer);
      window.clearInterval(elapsedTimer);
      window.clearTimeout(timeoutTimer);
      if (latestRequestIdRef.current === requestId) {
        activeAbortControllerRef.current = null;
        pendingSearchKeyRef.current = "";
        setStillSearching(false);
        setLoading(false);
        setLoadingExternalBatch(false);
      }
    }
  }

  const cancelActiveSearch = () => {
    latestRequestIdRef.current += 1;
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    pendingSearchKeyRef.current = "";
    setLoading(false);
    setLoadingExternalBatch(false);
    setStillSearching(false);
    setSearchUiState("cancelled");
    setError("Search cancelled. Your committed requirements are preserved.");
  };
  const retryLastSearch = () => {
    const args = lastSearchArgsRef.current;
    if (args)
      void runSearch(
        args.page,
        args.pagination,
        args.commit,
        args.externalBatchCursor,
      );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Search candidates
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Find and triage relevant talent quickly.
              </p>
            </div>

            <a
              href="/recruiter/dashboard"
              className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8">
        {guidedSourcingEnabled ? (
          <GuidedSourcingPanel
            onConfirm={applyGuidedHandoff}
            onManualFallback={(brief) => {
              invalidateGuidedSearch(false);
              handleQueryChange(brief);
              setError(null);
            }}
            onWorkspaceStateChange={handleGuidedWorkspaceState}
            onSourceIdentityChange={() => invalidateGuidedSearch(false)}
          />
        ) : null}
        {guidedWorkspace === "review" ? (
          <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm text-slate-400">
            <span className="font-medium text-slate-200">
              Search editing is paused while you review the requirements.
            </span>{" "}
            Your current query and committed results remain unchanged.
          </section>
        ) : null}
        {guidedWorkspace === "prepared" ? (
          <p
            role="status"
            className="mb-5 rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200"
          >
            Search plan prepared. Review it, then click Search.
          </p>
        ) : null}
        {guidedCriteriaNotice ? (
          <p
            role="status"
            className="mb-5 rounded-xl border border-cyan-800/60 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100"
          >
            {guidedCriteriaNotice}
          </p>
        ) : null}
        {showCompactSearchSummary && committedSnapshot ? (
          <section
            className="mb-5 rounded-xl border border-slate-800 bg-slate-900/35 px-4 py-3"
            aria-label="Search criteria summary"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search criteria
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-white">
                  {committedSnapshot.query}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-300">
                  {Array.from(
                    new Set([
                      ...committedSnapshot.filters.effectiveLocations,
                      ...committedSnapshot.filters.effectiveSkills,
                      ...committedSnapshot.filters.effectiveSapModules,
                      ...committedSnapshot.filters.effectiveLanguages,
                    ]),
                  ).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-700 px-2 py-1"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSearchEditorOpen(true)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
                >
                  Edit search
                </button>
                <button
                  type="button"
                  onClick={clearCurrentSearch}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
                >
                  New search
                </button>
              </div>
            </div>
          </section>
        ) : null}
        <form
          onSubmit={handleSubmit}
          className={
            guidedWorkspace === "review" || showCompactSearchSummary
              ? "hidden"
              : "rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem_13rem_auto_auto] lg:items-end">
            <div ref={historyRootRef} className="relative min-w-0">
              <label>
                <span className="text-sm font-semibold text-slate-200">
                  Describe who you&apos;re looking for
                </span>
                <textarea
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={historyOpen}
                  aria-controls="search-history-suggestions"
                  value={query}
                  onFocus={() => {
                    setHistoryOpen(true);
                    setHistoryIndex(-1);
                  }}
                  onChange={(event) => {
                    handleQueryChange(event.target.value);
                    setHistoryOpen(true);
                    setHistoryIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setHistoryOpen(false);
                      return;
                    }
                    if (!historyOpen || !historySuggestions.length) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setHistoryIndex((current) =>
                        Math.min(historySuggestions.length - 1, current + 1),
                      );
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setHistoryIndex((current) => Math.max(0, current - 1));
                    } else if (event.key === "Enter" && historyIndex >= 0) {
                      event.preventDefault();
                      selectHistory(historySuggestions[historyIndex]);
                    }
                  }}
                  required
                  rows={2}
                  title={query}
                  placeholder="Senior SAP FICO consultant in Malaysia with implementation experience"
                  className="mt-2 min-h-14 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />
              </label>
              {historyOpen && historySuggestions.length ? (
                <div
                  id="search-history-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-xl"
                >
                  {historySuggestions.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_auto] border-b border-slate-900"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === historyIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectHistory(item)}
                        className={
                          index === historyIndex
                            ? "block min-w-0 bg-cyan-950 px-3 py-2 text-left text-sm text-cyan-100"
                            : "block min-w-0 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-900"
                        }
                      >
                        <span className="block truncate">{item.query}</span>
                        <span className="text-[11px] text-slate-500">
                          {item.source} -{" "}
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove saved search ${item.query}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void removeSearchHistoryItem(item.id)}
                        className="px-3 text-xs text-rose-300 hover:bg-slate-900"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="block w-full border-t border-slate-800 px-3 py-2 text-left text-xs text-slate-400"
                    onClick={() => void clearSearchHistory()}
                  >
                    Clear search history
                  </button>
                </div>
              ) : null}
              {recentSearches.length ? (
                <button
                  type="button"
                  onClick={() => void clearSearchHistory()}
                  className="mt-1.5 text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  Clear history
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearCurrentSearch}
                className="mt-1.5 block text-xs font-medium text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
              >
                Start new search
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {historyMessage}
              </span>
            </div>
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Match quality
              </span>
              <select
                value={matchQuality}
                onChange={(event) =>
                  setMatchQuality(
                    event.target.value as "any" | "relevant" | "strong",
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="any">Any</option>
                <option value="relevant">Relevant</option>
                <option value="strong">Strong</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Talent pool
              </span>
              <select
                value={talentPool}
                onChange={(event) => {
                  const nextTalentPool = event.target.value as
                    "internal_profiles" | "linkedin_talent_pool";
                  selectedTalentPoolRef.current = nextTalentPool;
                  sourceReadinessRevisionRef.current += 1;
                  latestRequestIdRef.current += 1;
                  activeAbortControllerRef.current?.abort();
                  activeAbortControllerRef.current = null;
                  pendingSearchKeyRef.current = "";
                  setLoading(false);
                  setLoadingExternalBatch(false);
                  setStillSearching(false);
                  if (nextTalentPool === "linkedin_talent_pool")
                    setExternalCapability(null);
                  setTalentPool(nextTalentPool);
                  setReviewCommitted(false);
                }}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="internal_profiles">SAP Talent Hub</option>
                <option
                  value="linkedin_talent_pool"
                  disabled={
                    sourceCapabilities?.external_talent_network.available ===
                    false
                  }
                >
                  {externalTalentNetworkOptionLabel}
                </option>
              </select>
              {talentPool === "linkedin_talent_pool" &&
              !sourceReadiness.ready ? (
                <span className="mt-1 block text-xs text-amber-300">
                  {sourceReadiness.message}
                </span>
              ) : null}
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeRelocationRemote}
                onChange={(event) => {
                  setIncludeRelocationRemote(event.target.checked);
                  setReviewCommitted(false);
                }}
              />
              Include relocation/remote candidates
            </label>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="search-filter-panel"
              onClick={() => setFiltersOpen((value) => !value)}
              className="min-h-12 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:border-slate-500"
            >
              Filters ({activeFilterCount})
            </button>
            <button
              type="submit"
              disabled={!query.trim()}
              className="min-h-12 rounded-xl bg-cyan-400 px-6 text-sm font-bold text-slate-950 outline-none transition hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Understand & review
            </button>
          </div>

          {guidedSaveHref ? (
            <a
              href={guidedSaveHref}
              className="mt-3 inline-block text-xs text-violet-300"
            >
              Save confirmed sourcing brief preview
            </a>
          ) : null}

          {understoodChips.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-slate-500">Understood:</span>
              {understoodChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  title={`Remove ${chip} from search`}
                  onClick={() =>
                    handleQueryChange(removeRecruiterSearchIntent(query, chip))
                  }
                  className="rounded-full border border-cyan-900/80 bg-cyan-950/25 px-2.5 py-1 text-xs text-cyan-200 hover:border-cyan-700"
                >
                  {chip}{" "}
                  <span aria-hidden="true" className="ml-1 text-cyan-500">
                    {"\u00D7"}
                  </span>
                </button>
              ))}
              {expandedChips.length ? (
                <span className="ml-2 text-[11px] text-slate-500">
                  Expanded: {expandedChips.join(" \u00B7 ")}
                </span>
              ) : null}
            </div>
          ) : null}

          {locationRuleChips.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {locationRuleChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-amber-800/70 bg-amber-950/20 px-2.5 py-1 text-xs text-amber-200"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          {languageRuleChips.length ? (
            <div
              className="mt-3 flex flex-wrap items-center gap-1.5"
              aria-label="Required languages"
            >
              {languageRuleChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-emerald-800/70 bg-emerald-950/20 px-2.5 py-1 text-xs text-emerald-200"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          {integrityFilterChips.length ? (
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              aria-label="Active required filters"
            >
              {integrityFilterChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-emerald-800/70 bg-emerald-950/20 px-2.5 py-1 text-xs text-emerald-200"
                >
                  {chip}
                </span>
              ))}
              {guidedIntegrityPlan?.includeRelocationRemote ? (
                <span className="rounded-full border border-amber-700/70 bg-amber-950/20 px-2.5 py-1 text-xs text-amber-200">
                  Other locations · Relocation/remote review
                </span>
              ) : null}
            </div>
          ) : null}
          {filtersOpen ? (
            <SearchFiltersPanel
              committed={reviewPreview}
              initial={{
                ...extendedFilters,
                locations: effectiveLocations,
                skills: effectiveSkills,
                sapModules: effectiveSapModules,
                languages: effectiveLanguages,
              }}
              previewFor={previewForFilters}
              onCancel={() => setFiltersOpen(false)}
              onApply={(next) => {
                setExtendedFilters(next);
                setCountries(
                  (next.locations || next.countries || []).join(", "),
                );
                setSkills((next.skills || []).join(", "));
                setSapModules((next.sapModules || []).join(", "));
                setLanguages((next.languages || []).join(", "));
                setAdvancedFilterIntentKey(
                  talentSearchRoleIntentKey(parsedIntent.roleConcepts),
                );
                setFiltersOpen(false);
                setReviewCommitted(false);
              }}
            />
          ) : null}
          {criteriaOpen ? (
            <SearchCriteriaPanel
              criteria={criteria}
              onApply={(next, promoteIds) => {
                let promotedCriteria = next,
                  promotedFilters = extendedFilters;
                for (const id of promoteIds) {
                  const promoted = promoteCriterion(
                    promotedCriteria,
                    id,
                    promotedFilters,
                  );
                  promotedCriteria = promoted.criteria;
                  promotedFilters = promoted.filters;
                }
                setCriteria(promotedCriteria);
                setExtendedFilters(promotedFilters);
                setSkills((promotedFilters.skills || []).join(", "));
                setSapModules((promotedFilters.sapModules || []).join(", "));
                setReviewCommitted(false);
                setCriteriaOpen(false);
              }}
              onCancel={() => setCriteriaOpen(false)}
            />
          ) : null}
          <SearchPreparationReview
            state={preparation}
            dispatch={dispatchPreparation}
            preview={reviewPreview}
            onOpenFilters={() => setFiltersOpen(true)}
            onOpenCriteria={() => setCriteriaOpen(true)}
            onCancel={() => {
              dispatchPreparation({
                type: "cancel",
                identity: preparation.identity,
              });
              setReviewCommitted(false);
            }}
            onCommit={() => void runSearch(1, false, true)}
            onRetryReadiness={() => setReadinessAttempt((value) => value + 1)}
            sourceReadiness={sourceReadiness}
            searchIntent={unifiedIntent}
          />
          {false && filtersOpen ? (
            <div
              id="search-filter-panel"
              className="mt-4 border-t border-slate-800 pt-3"
            >
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="text-xs font-semibold text-slate-400">
                    Location
                  </span>
                  <input
                    value={countries}
                    onChange={(event) => {
                      setCountries(event.target.value);
                      setAdvancedFilterIntentKey(
                        talentSearchRoleIntentKey(parsedIntent.roleConcepts),
                      );
                    }}
                    placeholder="Required countries"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                  {effectiveLocations.length ? (
                    <span className="mt-1 block text-[11px] text-emerald-300">
                      Required from query and filters:{" "}
                      {requiredLocationDisplay(effectiveRequiredLocations)}
                    </span>
                  ) : null}
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-400">
                    Skills
                  </span>
                  <input
                    value={skills}
                    onChange={(event) => {
                      setSkills(event.target.value);
                      setAdvancedFilterIntentKey(
                        talentSearchRoleIntentKey(parsedIntent.roleConcepts),
                      );
                    }}
                    placeholder="Add required skills"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-400">
                    Languages
                  </span>
                  <input
                    value={languages}
                    onChange={(event) => {
                      setLanguages(event.target.value);
                      setAdvancedFilterIntentKey(
                        talentSearchRoleIntentKey(parsedIntent.roleConcepts),
                      );
                    }}
                    placeholder="Add required languages"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                  {effectiveLanguages.length ? (
                    <span className="mt-1 block text-[11px] text-emerald-300">
                      Committed on Search: {effectiveLanguages.join(", ")}
                    </span>
                  ) : null}
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-400">
                    SAP modules
                  </span>
                  <input
                    value={sapModules}
                    onChange={(event) => {
                      setSapModules(event.target.value);
                      setAdvancedFilterIntentKey(
                        talentSearchRoleIntentKey(parsedIntent.roleConcepts),
                      );
                    }}
                    placeholder="Add modules"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </label>
              </div>
              {guidedIntegrityPlan?.requirements.some(
                (requirement) => requirement.kind === "location",
              ) ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={guidedIntegrityPlan!.includeRelocationRemote}
                    onChange={(event) =>
                      setGuidedIntegrityPlan({
                        ...guidedIntegrityPlan!,
                        includeRelocationRemote: event.target.checked,
                      })
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">
                      Include relocation/remote candidates
                    </span>
                    <span className="block text-xs text-slate-500">
                      Intentionally broadens the required location.
                      Outside-country candidates will be labelled.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
        </form>

        {searchUiState === "searching_initial" ? (
          <section
            className="mt-7 rounded-2xl border border-cyan-900/60 bg-cyan-950/15 px-6 py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Searching SAP Talent Hub…
                </h2>
                <p className="mt-2 text-sm text-cyan-100">
                  Finding candidates for your search.
                </p>
                {searchElapsedMs >= 2000 ? (
                  <p className="mt-1 text-xs text-slate-400">
                    {(searchElapsedMs / 1000).toFixed(1)} seconds elapsed. Your
                    Required Filters remain unchanged.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={cancelActiveSearch}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-300" />
            </div>
          </section>
        ) : null}
        <section
          id="search-results"
          ref={resultsSectionRef}
          className={
            guidedWorkspace === "review" || !renderVisibility.showResults
              ? "hidden"
              : "mt-7 scroll-mt-4"
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {showingPreviousResults ||
                searchUiState === "refreshing_existing_results"
                  ? `Results from previous search — ${committedSnapshot?.query}`
                  : "Search results"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {summaryText}
                {showingPreviousResults
                  ? " · Run Search to replace these results with the prepared query."
                  : ""}
              </p>
            </div>

            {response ? (
              <div className="text-xs text-slate-500">
                {loading ? (
                  <span role="status" className="mr-2 text-cyan-300">
                    {searchUiState === "refreshing_existing_results"
                      ? "Updating search; previous results remain visible..."
                      : stillSearching
                        ? "Still searching..."
                        : "Searching..."}
                  </span>
                ) : null}
                {["candidate_name_lookup", "identity_token_lookup"].includes(
                  response.searchIntent?.type || "",
                )
                  ? "Identity match"
                  : response.bucketCounts
                    ? `${response.bucketCounts.strong} Strong · ${response.bucketCounts.good} Good · ${response.bucketCounts.potential} Potential`
                    : `Batch ${response.summary.page}`}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
              <p>{error}</p>
              {searchUiState === "timed_out" ||
              searchUiState === "failed" ||
              searchUiState === "cancelled" ? (
                <button
                  type="button"
                  onClick={retryLastSearch}
                  className="mt-3 rounded-lg border border-red-700 px-3 py-2 font-semibold text-red-100"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && response && results.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
              <p className="text-lg font-semibold text-slate-300">
                {committedSnapshot?.integrityPlan ||
                committedSnapshot?.filters.effectiveLocations.length
                  ? "No candidates meet all required criteria."
                  : "No matching candidates"}
              </p>

              {externalRejectionPresentation ? (
                <>
                  <p className="mt-2 text-sm font-medium text-amber-200">
                    {externalRejectionPresentation.headline}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Actual candidate-evidence exclusions are shown below. No
                    requirements were broadened automatically.
                  </p>
                  <ol className="mx-auto mt-3 max-w-2xl space-y-2 text-left text-sm text-slate-400">
                    {externalRejectionPresentation.requirements.map((item) => (
                      <li
                        key={item.requirementId}
                        className="rounded-lg border border-slate-800 p-2"
                      >
                        {item.text}
                      </li>
                    ))}
                  </ol>
                  {externalRejectionPresentation.supportedRequirements
                    .length ? (
                    <div className="mx-auto mt-4 max-w-2xl text-left">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Supported requirements
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-slate-500">
                        {externalRejectionPresentation.supportedRequirements.map(
                          (item) => (
                            <li key={item.requirementId}>{item.text}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200"
                  >
                    Review required filters
                  </button>
                </>
              ) : committedSnapshot?.integrityPlan ||
                committedSnapshot?.filters.effectiveLocations.length ? (
                <>
                  <p className="mt-2 text-sm text-slate-500">
                    Review the hard requirements that excluded candidates. No
                    requirements were broadened automatically.
                  </p>
                  {response.eligibilityDiagnostic?.emptyPool ? (
                    <p className="mx-auto mt-3 max-w-2xl text-sm text-amber-200">
                      The selected talent pool has no authoritative candidate
                      records. No other pool was searched.
                    </p>
                  ) : (
                    <ol className="mx-auto mt-3 max-w-2xl space-y-2 text-left text-sm text-slate-400">
                      {response.eligibilityDiagnostic?.funnel.map((item) => (
                        <li
                          key={item.requirementId}
                          className="rounded-lg border border-slate-800 p-2"
                        >
                          <span className="font-medium text-slate-200">
                            {item.label}
                          </span>
                          <span className="block text-xs">
                            {item.evaluated
                              ? `${item.entering} entered; ${item.excluded} excluded; ${item.remaining} remained`
                              : item.explanation}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {!response.eligibilityDiagnostic ? (
                    <ul className="mx-auto mt-3 max-w-2xl text-left text-sm text-slate-400">
                      {committedSnapshot.filters.effectiveLocations.length ? (
                        <li>
                          - Location:{" "}
                          {committedSnapshot.filters.effectiveLocations.join(
                            " or ",
                          )}{" "}
                          · Required
                        </li>
                      ) : null}
                      {committedSnapshot.integrityPlan?.requirements
                        .filter((requirement) => requirement.required)
                        .map((requirement) => (
                          <li key={requirement.id}>- {requirement.label}</li>
                        ))}
                    </ul>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200"
                  >
                    Review required filters
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Try removing a filter or selecting a broader match quality.
                </p>
              )}
            </div>
          ) : null}

          <div
            aria-busy={loading}
            className={`mt-4 min-h-[12rem] space-y-3 transition-opacity ${loading && response ? "opacity-70" : showingPreviousResults ? "opacity-45" : "opacity-100"}`}
          >
            {results.map((result, index) => (
              <CompactCandidateCard
                key={result.candidateId}
                result={result}
                rank={
                  ((response?.summary.page || 1) - 1) *
                    (response?.summary.pageSize || 20) +
                  index +
                  1
                }
                searchContextId={searchContextId}
                intent={committedIntent}
                expanded={expandedCandidateId === result.candidateId}
                diagnostic={diagnosticsByCandidate.get(result.candidateId)!}
                onToggle={() =>
                  setExpandedCandidateId((current) => {
                    setDrawerInitialTab("Overview");
                    return current === result.candidateId
                      ? ""
                      : result.candidateId;
                  })
                }
                onOpenTab={(tab) => {
                  setDrawerInitialTab(tab);
                  setExpandedCandidateId(result.candidateId);
                }}
                jobId={committedSnapshot?.provenance?.jobId}
                identityLookup={[
                  "candidate_name_lookup",
                  "identity_token_lookup",
                ].includes(response.searchIntent?.type || "")}
              />
            ))}
          </div>
          {response &&
          response.summary.totalMatched > response.summary.pageSize ? (
            <nav
              aria-label="Search result pages"
              className="mt-5 flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-800 pt-4"
            >
              <button
                type="button"
                disabled={loading || response.summary.page <= 1}
                onClick={() => void runSearch(response.summary.page - 1, true)}
                className="min-h-9 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              {numberedSearchPages(
                response.summary.page,
                Math.ceil(
                  response.summary.totalMatched / response.summary.pageSize,
                ),
              ).map((item, index) =>
                item === "ellipsis" ? (
                  <span
                    key={"ellipsis-" + index}
                    className="px-2 text-slate-500"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    aria-current={
                      item === response.summary.page ? "page" : undefined
                    }
                    disabled={loading || item === response.summary.page}
                    onClick={() => void runSearch(item, true)}
                    className={
                      item === response.summary.page
                        ? "min-h-9 min-w-9 rounded-lg border border-cyan-300 bg-cyan-300 px-2 text-sm font-semibold text-slate-950"
                        : "min-h-9 min-w-9 rounded-lg border border-slate-700 px-2 text-sm font-medium text-slate-300 hover:border-slate-500"
                    }
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={
                  loading ||
                  response.summary.page * response.summary.pageSize >=
                    response.summary.totalMatched
                }
                onClick={() => void runSearch(response.summary.page + 1, true)}
                className="min-h-9 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Show next {response.summary.pageSize}
              </button>
            </nav>
          ) : null}
          {response &&
          committedSnapshot?.committedRequirements.talentPool ===
            "linkedin_talent_pool" &&
          response.summary.page * response.summary.pageSize >=
            response.summary.totalMatched ? (
            <div className="mt-5 border-t border-slate-800 pt-4 text-center">
              {response.nextProviderBatchCursor &&
              response.providerExhausted !== true ? (
                <button
                  type="button"
                  disabled={loading || loadingExternalBatch}
                  onClick={() =>
                    void runSearch(
                      response.summary.page,
                      true,
                      false,
                      response.nextProviderBatchCursor || undefined,
                    )
                  }
                  className="min-h-10 rounded-lg border border-cyan-700 bg-cyan-950/30 px-4 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingExternalBatch
                    ? "Loading 50 more candidates..."
                    : "Load 50 more candidates"}
                </button>
              ) : response.providerExhausted ? (
                <p className="text-sm text-slate-400">
                  All available external profiles for this search have been
                  loaded.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
        {selectedDrawerCandidate ? (
          <CandidateDetailsDrawer
            candidate={selectedDrawerCandidate as CandidateDrawerResult}
            diagnostic={diagnosticsByCandidate.get(
              selectedDrawerCandidate.candidateId,
            )!}
            visibleCandidates={results as CandidateDrawerResult[]}
            searchContextLabel={committedSnapshot?.query || query}
            fullProfileHref={candidate360SearchHref(
              selectedDrawerCandidate.candidateId,
              searchContextId,
              committedSnapshot?.provenance?.jobId,
            )}
            shortlistHref={
              "/recruiter/shortlist?candidateId=" +
              encodeURIComponent(selectedDrawerCandidate.candidateId) +
              "&from=search-v2"
            }
            onClose={closeCandidateDrawer}
            onSelect={(candidateId) => {
              setDrawerInitialTab("Overview");
              setExpandedCandidateId(candidateId);
            }}
            identityLookup={response.evaluationMode === "identity_only"}
            initialTab={drawerInitialTab}
          />
        ) : null}
      </div>
    </main>
  );
}
