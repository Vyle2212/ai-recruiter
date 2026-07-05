import { auditCandidateDataRepair, type CandidateDataRepairAction, type CandidateDataRepairSuggestion } from "./candidateDataRepair";

type AnyRecord = Record<string, any>;

export type RepairReviewActionFilter = CandidateDataRepairAction | "all";
export type RepairReviewSearchableFilter = "true" | "false" | "all";

export type RepairReviewItem = {
  candidateId: string;
  current: CandidateDataRepairSuggestion["current"];
  suggested: CandidateDataRepairSuggestion["suggested"];
  confidence: CandidateDataRepairSuggestion["confidence"];
  evidence: CandidateDataRepairSuggestion["evidence"];
  fields: CandidateDataRepairSuggestion["fields"];
  overallConfidence: number;
  action: CandidateDataRepairAction;
  searchableAfterRepair: boolean;
  profileHref: string;
  reviewLabel: string;
};

export type RepairReviewQuery = {
  page?: number;
  pageSize?: number;
  action?: RepairReviewActionFilter;
  searchableAfterRepair?: RepairReviewSearchableFilter;
  q?: string;
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clampInt(value: any, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export function parseRepairReviewQuery(searchParams: URLSearchParams): Required<RepairReviewQuery> {
  const action = clean(searchParams.get("action") || "all") as RepairReviewActionFilter;
  const searchable = clean(searchParams.get("searchableAfterRepair") || "all").toLowerCase() as RepairReviewSearchableFilter;
  return {
    page: clampInt(searchParams.get("page"), 1, 1, 100000),
    pageSize: clampInt(searchParams.get("pageSize") || searchParams.get("limit"), 25, 1, 100),
    action: ["safe_to_apply_later", "needs_recruiter_review", "insufficient_evidence", "all"].includes(action) ? action : "all",
    searchableAfterRepair: ["true", "false", "all"].includes(searchable) ? searchable : "all",
    q: clean(searchParams.get("q") || ""),
  };
}

export function repairReviewLabel(action: CandidateDataRepairAction, searchableAfterRepair: boolean) {
  if (action === "safe_to_apply_later") return "Safe suggestion - review before apply";
  if (action === "needs_recruiter_review" && searchableAfterRepair) return "Recruiter review - could become searchable";
  if (action === "needs_recruiter_review") return "Recruiter review required";
  return "Insufficient evidence";
}

export function repairReviewItem(suggestion: CandidateDataRepairSuggestion): RepairReviewItem {
  return {
    candidateId: suggestion.candidateId,
    current: suggestion.current,
    suggested: suggestion.suggested,
    confidence: suggestion.confidence,
    evidence: suggestion.evidence,
    fields: suggestion.fields,
    overallConfidence: suggestion.overallConfidence,
    action: suggestion.action,
    searchableAfterRepair: suggestion.suggestedSearchableAfterRepair,
    profileHref: `/candidates/${encodeURIComponent(suggestion.candidateId)}?returnTo=${encodeURIComponent("/repair-review")}`,
    reviewLabel: repairReviewLabel(suggestion.action, suggestion.suggestedSearchableAfterRepair),
  };
}

function itemSearchText(item: RepairReviewItem) {
  return [
    item.candidateId,
    item.current.displayName,
    item.current.title,
    item.current.company,
    item.current.module,
    item.suggested.displayName,
    item.suggested.title,
    item.suggested.company,
    item.suggested.module,
    item.reviewLabel,
  ].join(" ").toLowerCase();
}

export function buildCandidateRepairReview(candidates: AnyRecord[], query: RepairReviewQuery = {}) {
  const page = clampInt(query.page, 1, 1, 100000);
  const pageSize = clampInt(query.pageSize, 25, 1, 100);
  const action = query.action || "all";
  const searchableAfterRepair = query.searchableAfterRepair || "all";
  const q = clean(query.q || "").toLowerCase();
  const audit = auditCandidateDataRepair(candidates);
  let items = audit.suggestions.map(repairReviewItem);

  if (action !== "all") items = items.filter((item) => item.action === action);
  if (searchableAfterRepair !== "all") items = items.filter((item) => String(item.searchableAfterRepair) === searchableAfterRepair);
  if (q) items = items.filter((item) => itemSearchText(item).includes(q));

  const totalMatched = items.length;
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);
  return {
    items: paginatedItems,
    totalMatched,
    returnedCount: paginatedItems.length,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil(totalMatched / pageSize),
    summary: {
      totalValidationQueue: audit.totalValidationQueueCandidates,
      safeToApplyLater: audit.safeToApplyLater,
      needsRecruiterReview: audit.needsRecruiterReview,
      insufficientEvidence: audit.insufficientEvidence,
      suggestedSearchableAfterRepair: audit.suggestedSearchableAfterRepair,
    },
    filters: { action, searchableAfterRepair, q },
    mode: "read-only" as const,
  };
}
