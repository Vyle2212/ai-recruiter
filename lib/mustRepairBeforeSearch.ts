import { auditSearchableProfileQuality, classifySearchableProfileQuality, type SearchableProfileQualityResult } from "./searchableProfileQualityGate";

type AnyRecord = Record<string, any>;

export type MustRepairPriority = "critical_identity" | "invalid_title" | "invalid_company" | "status_issue" | "low_quality" | "other";
export type MustRepairNextStep = "repair_title_company" | "send_to_validation_queue" | "review_status" | "manual_review_required";

export type MustRepairBeforeSearchItem = {
  candidateId: string;
  displayName: string;
  title: string;
  company: string;
  modules: string[];
  location: string;
  score: number;
  riskFlags: string[];
  missingFields: string[];
  reasons: string[];
  recommendedAction: SearchableProfileQualityResult["recommendedAction"];
  profileHref: string;
  repairPriority: MustRepairPriority;
  suggestedNextStep: MustRepairNextStep;
};

export type MustRepairBeforeSearchQuery = {
  page?: number;
  pageSize?: number;
  priority?: MustRepairPriority | "all";
  q?: string;
};

const PRIORITY_ORDER: MustRepairPriority[] = ["critical_identity", "invalid_title", "invalid_company", "status_issue", "low_quality", "other"];
const NEXT_STEP_ORDER: MustRepairNextStep[] = ["repair_title_company", "send_to_validation_queue", "review_status", "manual_review_required"];

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function clampNumber(value: any, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function parseMustRepairBeforeSearchQuery(searchParams: URLSearchParams): Required<MustRepairBeforeSearchQuery> {
  return {
    page: clampNumber(searchParams.get("page"), 1, 1, 100000),
    pageSize: clampNumber(searchParams.get("pageSize"), 25, 1, 100),
    priority: (clean(searchParams.get("priority") || "all") as MustRepairPriority | "all") || "all",
    q: clean(searchParams.get("q") || ""),
  };
}

export function isMustRepairBeforeSearch(result: SearchableProfileQualityResult) {
  return result.reviewCategory === "must_repair_before_search" || result.recommendedAction === "remove_from_search_until_repaired";
}

export function repairPriority(result: SearchableProfileQualityResult): MustRepairPriority {
  const flags = result.riskFlags;
  if (flags.includes("critical_identity_issue")) return "critical_identity";
  if (flags.includes("invalid_title") || flags.includes("long_summary_title")) return "invalid_title";
  if (flags.includes("invalid company fragment") || flags.includes("unsafe company value")) return "invalid_company";
  if (flags.some((flag) => /^status_/i.test(flag))) return "status_issue";
  if (flags.includes("low_profile_quality_score")) return "low_quality";
  return "other";
}

export function suggestedNextStep(priority: MustRepairPriority): MustRepairNextStep {
  if (priority === "invalid_title" || priority === "invalid_company") return "repair_title_company";
  if (priority === "critical_identity") return "send_to_validation_queue";
  if (priority === "status_issue") return "review_status";
  return "manual_review_required";
}

export function profileHref(candidateIdValue: string) {
  return `/candidates/${encodeURIComponent(candidateIdValue)}?returnTo=${encodeURIComponent("/must-repair-before-search")}`;
}

export function toMustRepairBeforeSearchItem(candidate: AnyRecord, result = classifySearchableProfileQuality(candidate)): MustRepairBeforeSearchItem {
  const priority = repairPriority(result);
  return {
    candidateId: result.candidateId,
    displayName: result.searchableFields.name,
    title: result.searchableFields.title,
    company: result.searchableFields.company,
    modules: result.searchableFields.modules,
    location: result.searchableFields.location,
    score: result.score,
    riskFlags: result.riskFlags,
    missingFields: result.missingFields,
    reasons: result.reasons,
    recommendedAction: result.recommendedAction,
    profileHref: profileHref(result.candidateId),
    repairPriority: priority,
    suggestedNextStep: suggestedNextStep(priority),
  };
}

function matchesQuery(item: MustRepairBeforeSearchItem, query: string) {
  if (!query) return true;
  const haystack = [item.candidateId, item.displayName, item.title, item.company, item.location, item.modules.join(" "), item.riskFlags.join(" "), item.reasons.join(" "), item.repairPriority, item.suggestedNextStep].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function countBy<T extends string>(items: MustRepairBeforeSearchItem[], values: readonly T[], pick: (item: MustRepairBeforeSearchItem) => T) {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = items.filter((item) => pick(item) === value).length;
    return acc;
  }, {} as Record<T, number>);
}

export function buildMustRepairBeforeSearchReview(candidates: AnyRecord[], query: MustRepairBeforeSearchQuery = {}) {
  const report = auditSearchableProfileQuality(candidates);
  const byId = new Map(candidates.map((candidate) => [candidateId(candidate), candidate]));
  const allItems = report.results
    .filter(isMustRepairBeforeSearch)
    .map((result) => toMustRepairBeforeSearchItem(byId.get(result.candidateId) || {}, result));
  const priority = query.priority || "all";
  const q = clean(query.q || "");
  let filtered = allItems;
  if (priority !== "all") filtered = filtered.filter((item) => item.repairPriority === priority);
  if (q) filtered = filtered.filter((item) => matchesQuery(item, q));
  const page = clampNumber(query.page, 1, 1, 100000);
  const pageSize = clampNumber(query.pageSize, 25, 1, 100);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);
  return {
    items,
    totalMatched: filtered.length,
    returnedCount: items.length,
    currentPage: page,
    pageSize,
    totalPages,
    summary: {
      totalMustRepair: allItems.length,
      byPriority: countBy(allItems, PRIORITY_ORDER, (item) => item.repairPriority),
      bySuggestedNextStep: countBy(allItems, NEXT_STEP_ORDER, (item) => item.suggestedNextStep),
    },
    mode: "read-only" as const,
  };
}