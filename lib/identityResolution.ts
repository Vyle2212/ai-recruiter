import { buildCanonicalCandidateProfile } from "./canonicalCandidateProfile";
import { duplicateFingerprint } from "./resumeQualityGate";

type AnyRecord = Record<string, any>;

type ScoredCandidate<T> = { candidate: T; score: number; key: string };

function text(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function contactScore(candidate: AnyRecord) {
  return (text(candidate.email || candidate.candidateEmail).includes("@") ? 28 : 0) + (text(candidate.phone || candidate.mobile).replace(/\D/g, "").length >= 8 ? 18 : 0) + (text(candidate.linkedin || candidate.linkedin_url).includes("linkedin") ? 16 : 0);
}

function completeness(candidate: AnyRecord) {
  const profile = buildCanonicalCandidateProfile(candidate.raw || candidate);
  return profile.parserQualityScore + contactScore(candidate.raw || candidate) + (profile.currentCompany !== "Not disclosed" ? 12 : 0) + (profile.deliveryMetrics.implementation + profile.deliveryMetrics.s4 + profile.deliveryMetrics.rollout > 0 ? 8 : 0);
}

export function canonicalIdentityKey(candidate: AnyRecord) {
  const raw = candidate.raw || candidate;
  const profile = buildCanonicalCandidateProfile(raw);
  return profile.duplicateKey || duplicateFingerprint(raw);
}

export function dedupeByCanonicalIdentity<T extends AnyRecord>(items: T[]): T[] {
  const groups = new Map<string, ScoredCandidate<T>>();
  items.forEach((candidate) => {
    const raw = candidate.raw || candidate;
    const key = canonicalIdentityKey(candidate) || text(raw.id || raw.candidate_id || candidate.id || candidate.name);
    const score = completeness(candidate);
    const existing = groups.get(key);
    if (!existing || score > existing.score) groups.set(key, { candidate, score, key });
  });
  return Array.from(groups.values()).map((item) => item.candidate);
}

export function findDuplicateIdentityGroups<T extends AnyRecord>(items: T[]) {
  const groups = new Map<string, T[]>();
  items.forEach((candidate) => {
    const key = canonicalIdentityKey(candidate);
    if (!key) return;
    groups.set(key, [...(groups.get(key) || []), candidate]);
  });
  return Array.from(groups.entries()).filter(([, candidates]) => candidates.length > 1).map(([key, candidates]) => ({ key, candidates }));
}
