import { buildCandidate360Profile } from "./candidate360Profile";
import { buildCandidate360TrustSummary } from "./candidate360UiModel";
import type { Candidate360Profile } from "./candidate360Types";
import type { PersistedWorkflowState } from "./recruiterWorkflowPersistence";

export type CompletenessBucket = "high" | "medium" | "low";
export type SmartShortlistSort = "completeness_desc" | "recently_updated" | "name" | "company" | "needs_confirmation_first";
export type SmartShortlistCard = { candidateId: string; name: string; title: string; currentCompany: string; location: string; headline: string; completenessScore: number; completenessBucket: CompletenessBucket; trust: ReturnType<typeof buildCandidate360TrustSummary>; missingFields: string[]; workflowStatus: string; needsCandidateConfirmation: boolean; updatedAt: string; modulesAndSkills: string[]; candidate360Href: string; selfConfirmHref: string; profile: Candidate360Profile };
export type SmartShortlistFilters = { search?: string; completeness?: "all" | CompletenessBucket; verification?: "all" | "recruiter_approved" | "needs_candidate_confirmation" | "missing_company" | "missing_title" | "missing_location"; skill?: string; location?: string; includeNeedsRepair?: boolean; sort?: SmartShortlistSort };

const text = (value: unknown) => String(value ?? "").trim();
export function completenessBucket(score: number): CompletenessBucket { return score >= 80 ? "high" : score >= 50 ? "medium" : "low"; }

export function buildSmartShortlistCards(candidates: Record<string, any>[], states: PersistedWorkflowState[], context: { approvals?: any; decisions?: any; history?: any; includeNeedsRepair?: boolean } = {}) {
  const byId = new Map(candidates.map((candidate) => [text(candidate.id || candidate.candidate_id), candidate]));
  const allowed = context.includeNeedsRepair ? new Set(["ready_for_shortlist", "needs_repair"]) : new Set(["ready_for_shortlist"]);
  return states.filter((state) => allowed.has(state.currentStatus)).flatMap((state) => {
    const candidate = byId.get(state.candidateId); if (!candidate) return [];
    const profile = buildCandidate360Profile(candidate, state, context.approvals, context.decisions, context.history);
    return [{ candidateId: profile.candidateId, name: text(profile.displayName.value) || state.displayName || "Candidate profile", title: text(profile.currentTitle.value), currentCompany: text(profile.currentCompany.value), location: text(profile.location.value), headline: text(profile.headline.value), completenessScore: profile.completeness.score, completenessBucket: completenessBucket(profile.completeness.score), trust: buildCandidate360TrustSummary(profile), missingFields: profile.missingFields, workflowStatus: state.currentStatus, needsCandidateConfirmation: profile.readiness.needsCandidateConfirmation, updatedAt: state.lastUpdatedAt, modulesAndSkills: [...profile.sapModules, ...profile.techSkills].map((item) => text(item.name.value)).filter(Boolean), candidate360Href: `/recruiter/candidate360/${encodeURIComponent(profile.candidateId)}`, selfConfirmHref: `/candidate/self-confirm/${encodeURIComponent(profile.candidateId)}`, profile }];
  });
}

export function filterAndSortSmartShortlist(cards: SmartShortlistCard[], filters: SmartShortlistFilters = {}) {
  const query = text(filters.search).toLowerCase(), skill = text(filters.skill).toLowerCase(), location = text(filters.location).toLowerCase();
  const filtered = cards.filter((card) => {
    if (!filters.includeNeedsRepair && card.workflowStatus !== "ready_for_shortlist") return false;
    if (filters.completeness && filters.completeness !== "all" && card.completenessBucket !== filters.completeness) return false;
    if (query && !`${card.name} ${card.currentCompany} ${card.title}`.toLowerCase().includes(query)) return false;
    if (skill && !card.modulesAndSkills.join(" ").toLowerCase().includes(skill)) return false;
    if (location && !card.location.toLowerCase().includes(location)) return false;
    if (filters.verification === "recruiter_approved" && !card.trust.recruiterApproved) return false;
    if (filters.verification === "needs_candidate_confirmation" && !card.needsCandidateConfirmation) return false;
    if (filters.verification === "missing_company" && !card.missingFields.includes("currentCompany")) return false;
    if (filters.verification === "missing_title" && !card.missingFields.includes("currentTitle")) return false;
    if (filters.verification === "missing_location" && !card.missingFields.includes("location")) return false;
    return true;
  });
  const sort = filters.sort || "completeness_desc";
  return [...filtered].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "company" ? a.currentCompany.localeCompare(b.currentCompany) : sort === "recently_updated" ? b.updatedAt.localeCompare(a.updatedAt) : sort === "needs_confirmation_first" ? Number(b.needsCandidateConfirmation) - Number(a.needsCandidateConfirmation) || b.completenessScore - a.completenessScore : b.completenessScore - a.completenessScore || a.name.localeCompare(b.name));
}

export function summarizeSmartShortlist(cards: SmartShortlistCard[], totalCandidates: number, needsRepair: number) {
  return { totalCandidates, readyForShortlist: cards.filter((card) => card.workflowStatus === "ready_for_shortlist").length, needsRepair, cardsGenerated: cards.length, highCompleteness: cards.filter((card) => card.completenessBucket === "high").length, mediumCompleteness: cards.filter((card) => card.completenessBucket === "medium").length, lowCompleteness: cards.filter((card) => card.completenessBucket === "low").length, missingCurrentCompany: cards.filter((card) => card.missingFields.includes("currentCompany")).length, missingTitle: cards.filter((card) => card.missingFields.includes("currentTitle")).length, missingLocation: cards.filter((card) => card.missingFields.includes("location")).length, needsCandidateConfirmation: cards.filter((card) => card.needsCandidateConfirmation).length, candidate360LinkCoverage: cards.filter((card) => card.candidate360Href).length, selfConfirmPreviewLinkCoverage: cards.filter((card) => card.selfConfirmHref).length };
}

