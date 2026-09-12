import { createHash } from "node:crypto";
import { normalizeDuplicatePhone, normalizeDuplicateProfileUrl } from "./candidateDuplicateIdentity";

type Row = Record<string, any>;
type Snapshot = Record<string, any>;
type ResolutionItem = { sourceRecordId: string; raw: Row; snapshot: Snapshot };
type Signals = {
  emails: string[]; phones: string[]; urls: string[]; externalIds: string[];
  name: string; location: string; employment: Set<string>; employmentDates: Set<string>;
  education: Set<string>; projects: Set<string>; title: string; documentFingerprint: string;
};

const clean = (value: unknown) => String(value ?? "").normalize("NFKC").trim();
const token = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const unique = <T>(values: T[]) => [...new Set(values)];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const intersect = (left: Set<string>, right: Set<string>) => [...left].some((value) => right.has(value));
const values = (raw: Row, keys: string[]) => keys.flatMap((key) => {
  const value = raw[key] ?? raw.parsed_json?.[key];
  return Array.isArray(value) ? value : value == null ? [] : [value];
}).map(clean).filter(Boolean);

function signals(item: ResolutionItem): Signals {
  const profile = item.snapshot.payload.enterpriseProfile;
  const emails = values(item.raw, ["normalized_email", "email", "email_address"]).map((value) => value.toLowerCase()).filter((value) => value.includes("@"));
  const phones = values(item.raw, ["normalized_phone", "phone", "mobile", "phone_number"]).map(normalizeDuplicatePhone).filter(Boolean);
  const urls = values(item.raw, ["linkedin_url", "linkedinUrl", "profile_url", "profileUrl"]).map(normalizeDuplicateProfileUrl).filter(Boolean);
  const externalIds = values(item.raw, ["external_person_id", "externalPersonId", "linkedin_id", "profile_id"]).map(token);
  const employment = new Set<string>((profile.employmentTimeline || []).map((entry: any) => `${token(entry.company)}|${token(entry.title)}`).filter((value: string) => value !== "|"));
  const employmentDates = new Set<string>((profile.employmentTimeline || []).map((entry: any) => `${clean(entry.start)}|${clean(entry.end)}`).filter((value: string) => value !== "|"));
  const education = new Set<string>((profile.education || []).map((entry: any) => `${token(entry.institution)}|${token(entry.qualification)}`).filter((value: string) => value !== "|"));
  const projects = new Set<string>((profile.projects || []).map((entry: any) => `${token(entry.client || entry.name)}|${token(entry.role)}|${clean(entry.start)}|${clean(entry.end)}`).filter((value: string) => value !== "|||"));
  const explicitFingerprint = values(item.raw, ["cv_hash", "document_fingerprint", "resume_hash"])[0];
  const resume = clean(item.raw.resume_text || item.raw.raw_text || item.raw.raw_cv);
  return {
    emails: unique(emails), phones: unique(phones), urls: unique(urls), externalIds: unique(externalIds),
    name: token(profile.identity?.name), location: token(profile.identity?.location || profile.identity?.country), title: token(profile.identity?.currentTitle),
    employment, employmentDates, education, projects,
    documentFingerprint: explicitFingerprint || (resume ? hash(resume.replace(/\s+/g, " ").toLowerCase()) : ""),
  };
}

class UnionFind {
  parent: number[];
  constructor(size: number) { this.parent = Array.from({ length: size }, (_, index) => index); }
  find(index: number): number { return this.parent[index] === index ? index : (this.parent[index] = this.find(this.parent[index])); }
  union(left: number, right: number) { const a = this.find(left), b = this.find(right); if (a !== b) this.parent[Math.max(a, b)] = Math.min(a, b); }
}

const classRank: Record<string, number> = { UNVERIFIED: 0, EXPOSURE: 1, SUPPORTED: 2, STRONG: 3, PRIMARY: 4 };
const verificationRank: Record<string, number> = { NOT_FOUND: 0, MENTION_ONLY: 1, SUPPORTED: 2, VERIFIED: 3 };
const unionObjects = (items: any[]) => unique(items.filter(Boolean).map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));

function aggregateCluster(items: ResolutionItem[], canonicalCandidateId: string) {
  const ordered = [...items].sort((a, b) => {
    const pa = a.snapshot.payload.enterpriseProfile, pb = b.snapshot.payload.enterpriseProfile;
    const strength = (p: any) => [p.identity?.name, p.identity?.currentTitle, p.identity?.currentCompany, p.experienceSummary?.totalCareerYears].filter(Boolean).length
      + (p.employmentTimeline?.length || 0) + (p.projects?.length || 0);
    return strength(pb) - strength(pa) || a.sourceRecordId.localeCompare(b.sourceRecordId);
  });
  const aggregate = structuredClone(ordered[0].snapshot);
  const profiles = ordered.map((item) => item.snapshot.payload.enterpriseProfile);
  const profile = aggregate.payload.enterpriseProfile;
  for (const key of ["technicalSkills", "sapModules", "employmentTimeline", "projects", "education", "certifications", "languages"]) {
    profile[key] = unionObjects(profiles.flatMap((value) => value[key] || []));
  }
  for (const key of Object.keys(profile.careerHighlights || {})) {
    if (typeof profile.careerHighlights[key] === "number") profile.careerHighlights[key] = Math.max(...profiles.map((value) => Number(value.careerHighlights?.[key] || 0)));
  }
  for (const key of Object.keys(profile.experienceSummary || {})) {
    const candidates = profiles.map((value) => value.experienceSummary?.[key]).filter((value) => typeof value === "number");
    if (candidates.length) profile.experienceSummary[key] = Math.max(...candidates);
  }
  const domains = unique(ordered.flatMap((item) => Object.keys(item.snapshot.domain_evidence || {})));
  aggregate.domain_evidence = Object.fromEntries(domains.map((domain) => [domain, ordered.map((item) => item.snapshot.domain_evidence?.[domain] || "UNVERIFIED").sort((a, b) => classRank[b] - classRank[a])[0]]));
  for (const capabilityName of unique(ordered.flatMap((item) => Object.keys(item.snapshot.capabilities || {})))) {
    aggregate.capabilities[capabilityName] = ordered.map((item) => item.snapshot.capabilities?.[capabilityName]).filter(Boolean)
      .sort((a, b) => verificationRank[b.verification] - verificationRank[a.verification] || Number(b.evidenceCount || 0) - Number(a.evidenceCount || 0))[0];
  }
  const sourceIds = ordered.map((item) => item.sourceRecordId).sort();
  aggregate.canonical_candidate_id = canonicalCandidateId;
  aggregate.linked_source_record_ids = sourceIds;
  aggregate.evidence_graph = {
    sourceRecordIds: sourceIds,
    domains: Object.fromEntries(domains.map((domain) => [domain, ordered.filter((item) => classRank[item.snapshot.domain_evidence?.[domain] || "UNVERIFIED"] > 0).map((item) => ({ sourceRecordId: item.sourceRecordId, classification: item.snapshot.domain_evidence[domain] }))])),
    capabilities: Object.fromEntries(Object.keys(aggregate.capabilities).map((name) => [name, ordered.filter((item) => item.snapshot.capabilities?.[name]?.verification !== "NOT_FOUND").map((item) => ({ sourceRecordId: item.sourceRecordId, ...item.snapshot.capabilities[name] }))])),
  };
  return aggregate;
}

export function resolveCanonicalCandidateEntities(items: ResolutionItem[]) {
  const allSignals = items.map(signals);
  const uf = new UnionFind(items.length);
  const deterministic = new Map<string, number>();
  allSignals.forEach((signal, index) => {
    for (const key of [...signal.emails.map((value) => `email:${value}`), ...signal.phones.map((value) => `phone:${value}`), ...signal.urls.map((value) => `url:${value}`), ...signal.externalIds.map((value) => `external:${value}`), ...(signal.documentFingerprint ? [`document:${signal.documentFingerprint}`] : [])]) {
      if (deterministic.has(key)) uf.union(index, deterministic.get(key)!); else deterministic.set(key, index);
    }
  });
  const byName = new Map<string, number[]>();
  allSignals.forEach((signal, index) => { if (signal.name) byName.set(signal.name, [...(byName.get(signal.name) || []), index]); });
  let highConfidenceCompositeMerges = 0;
  let probableDuplicateReviewFlags = 0;
  for (const indices of byName.values()) for (let left = 0; left < indices.length; left++) for (let right = left + 1; right < indices.length; right++) {
    const a = allSignals[indices[left]], b = allSignals[indices[right]];
    const sameLocation = Boolean(a.location && a.location === b.location);
    const sameTitle = Boolean(a.title && a.title === b.title);
    const sameDocument = Boolean(a.documentFingerprint && a.documentFingerprint === b.documentFingerprint);
    const employmentOverlap = intersect(a.employment, b.employment);
    const projectOverlap = intersect(a.projects, b.projects);
    const educationOverlap = intersect(a.education, b.education);
    const strongComposite = sameDocument || (sameLocation && (employmentOverlap || projectOverlap)) || (sameTitle && (employmentOverlap || projectOverlap || educationOverlap));
    if (strongComposite && uf.find(indices[left]) !== uf.find(indices[right])) {
      uf.union(indices[left], indices[right]);
      highConfidenceCompositeMerges += 1;
    } else if ((sameLocation && sameTitle) || employmentOverlap || projectOverlap) probableDuplicateReviewFlags += 1;
  }
  const groups = new Map<number, ResolutionItem[]>();
  items.forEach((item, index) => groups.set(uf.find(index), [...(groups.get(uf.find(index)) || []), item]));
  const assignments = new Map<string, Snapshot>();
  for (const cluster of groups.values()) {
    const clusterSignals = cluster.map((item) => allSignals[items.indexOf(item)]);
    const anchor = unique(clusterSignals.flatMap((signal) => [...signal.emails.map((value) => `email:${value}`), ...signal.phones.map((value) => `phone:${value}`), ...signal.urls.map((value) => `url:${value}`), ...signal.externalIds.map((value) => `external:${value}`)])).sort()[0]
      || `sources:${cluster.map((item) => item.sourceRecordId).sort().join("|")}`;
    const canonicalCandidateId = `canonical-${hash(anchor).slice(0, 32)}`;
    const aggregate = aggregateCluster(cluster, canonicalCandidateId);
    cluster.forEach((item) => assignments.set(item.sourceRecordId, { ...structuredClone(aggregate), source_record_id: item.sourceRecordId }));
  }
  const ambiguousIdentityClusters = [...byName.values()].filter((indices) => new Set(indices.map((index) => uf.find(index))).size > 1).length;
  const duplicateClusters = [...groups.values()].filter((cluster) => cluster.length > 1);
  return {
    assignments,
    metrics: {
      sourceRecordCount: items.length, canonicalCandidateCount: groups.size,
      duplicateClustersDetected: duplicateClusters.length, duplicateClustersMerged: duplicateClusters.length,
      profilesMerged: duplicateClusters.reduce((sum, cluster) => sum + cluster.length - 1, 0),
      ambiguousIdentityClusters, highConfidenceCompositeMerges, probableDuplicateReviewFlags,
    },
  };
}
