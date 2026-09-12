export type CandidateIdentityRecord = {
  id: string;
  email?: unknown;
  phone?: unknown;
  linkedinUrl?: unknown;
  profileUrl?: unknown;
  externalId?: unknown;
  name?: unknown;
  rawText?: unknown;
  documentHash?: unknown;
  employment?: unknown;
  education?: unknown;
  certifications?: unknown;
  location?: unknown;
};

export type DuplicateDecision = {
  classification: "confirmed" | "probable_review" | "distinct";
  reasons: string[];
  documentDuplicate: boolean;
};

const clean = (value: unknown) => String(value ?? "").normalize("NFKC").trim();
const simple = (value: unknown) => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
const list = (value: unknown) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(simple).filter(Boolean);
const overlap = (left: string[], right: string[]) => left.some((value) => right.includes(value));

export function normalizeDuplicateEmail(value: unknown) {
  const email = clean(value).toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

export function normalizeDuplicatePhone(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  const international = raw.startsWith("+") || /^00/.test(raw);
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return `${international ? "+" : "local:"}${digits}`;
}

export function normalizeDuplicateProfileUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "").toLowerCase();
    if (!host || !path) return "";
    return `${host}${path}`;
  } catch { return ""; }
}

export function normalizeDuplicateName(value: unknown) {
  const name = simple(value).replace(/^(?:mr|mrs|ms|dr)\s+/, "");
  if (!name || /^(?:name unavailable|unknown candidate|candidate profile pending validation|profile under review)$/.test(name)) return "";
  return name;
}

export function duplicateDocumentHash(value: unknown) {
  const text = clean(value).replace(/\s+/g, " ").toLowerCase();
  if (text.length < 80) return "";
  let first = 2166136261, second = 2246822519;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second ^ text.charCodeAt(text.length - index - 1), 3266489917);
  }
  return `${text.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

function profileSimilarity(left: unknown, right: unknown) {
  const tokens = (value: unknown) => new Set(simple(value).split(" ").filter((token) => token.length >= 4));
  const a = tokens(left), b = tokens(right);
  if (a.size < 20 || b.size < 20) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

export function classifyCandidateDuplicate(left: CandidateIdentityRecord, right: CandidateIdentityRecord): DuplicateDecision {
  const reasons: string[] = [];
  const emailA = normalizeDuplicateEmail(left.email), emailB = normalizeDuplicateEmail(right.email);
  const phoneA = normalizeDuplicatePhone(left.phone), phoneB = normalizeDuplicatePhone(right.phone);
  const urlA = normalizeDuplicateProfileUrl(left.linkedinUrl || left.profileUrl), urlB = normalizeDuplicateProfileUrl(right.linkedinUrl || right.profileUrl);
  const externalA = simple(left.externalId), externalB = simple(right.externalId);
  const hashA = clean(left.documentHash) || duplicateDocumentHash(left.rawText);
  const hashB = clean(right.documentHash) || duplicateDocumentHash(right.rawText);
  if (emailA && emailA === emailB) reasons.push("same_normalized_email");
  if (phoneA && phoneA === phoneB) reasons.push("same_safe_normalized_phone");
  if (urlA && urlA === urlB) reasons.push("same_canonical_profile_url");
  if (externalA && externalA === externalB) reasons.push("same_trusted_external_id");
  if (hashA && hashA === hashB) reasons.push("same_document_hash");
  if (reasons.length) return { classification: "confirmed", reasons, documentDuplicate: reasons.includes("same_document_hash") };

  const nameA = normalizeDuplicateName(left.name), nameB = normalizeDuplicateName(right.name);
  if (!nameA || nameA !== nameB) return { classification: "distinct", reasons: [], documentDuplicate: false };
  const employmentOverlap = overlap(list(left.employment), list(right.employment));
  const educationOverlap = overlap(list(left.education), list(right.education));
  const certificationOverlap = overlap(list(left.certifications), list(right.certifications));
  const sameLocation = Boolean(simple(left.location) && simple(left.location) === simple(right.location));
  const similarity = profileSimilarity(left.rawText, right.rawText);
  if (similarity >= 0.72) return { classification: "confirmed", reasons: ["same_name", "exceptional_profile_text_overlap"], documentDuplicate: false };
  const corroborators = [employmentOverlap, educationOverlap, certificationOverlap, sameLocation].filter(Boolean).length;
  if (employmentOverlap && corroborators >= 2) return { classification: "probable_review", reasons: ["same_name", "overlapping_employment", ...(educationOverlap ? ["same_education"] : []), ...(certificationOverlap ? ["same_certification"] : []), ...(sameLocation ? ["same_location"] : [])], documentDuplicate: false };
  return { classification: "distinct", reasons: ["same_name_only_or_insufficient_corroboration"], documentDuplicate: false };
}

export function resolveConfirmedCandidateIds(records: CandidateIdentityRecord[]) {
  const parent = records.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (a: number, b: number) => { const left = find(a), right = find(b); if (left !== right) parent[Math.max(left, right)] = Math.min(left, right); };
  const deterministic = new Map<string, number>();
  const names = new Map<string, number[]>();
  records.forEach((record, index) => {
    const email = normalizeDuplicateEmail(record.email), phone = normalizeDuplicatePhone(record.phone);
    const url = normalizeDuplicateProfileUrl(record.linkedinUrl || record.profileUrl);
    const external = simple(record.externalId), document = clean(record.documentHash) || duplicateDocumentHash(record.rawText);
    for (const key of [email && `email:${email}`, phone && `phone:${phone}`, url && `url:${url}`, external && `external:${external}`, document && `document:${document}`].filter(Boolean) as string[]) {
      const prior = deterministic.get(key); if (prior === undefined) deterministic.set(key, index); else union(prior, index);
    }
    const name = normalizeDuplicateName(record.name);
    if (name) names.set(name, [...(names.get(name) || []), index]);
  });
  const reviewFlags: Array<{ candidateIds: string[]; reasons: string[] }> = [];
  for (const indices of names.values()) for (let a = 0; a < indices.length; a++) for (let b = a + 1; b < indices.length; b++) {
    const left = indices[a], right = indices[b];
    if (find(left) === find(right)) continue;
    const decision = classifyCandidateDuplicate(records[left], records[right]);
    if (decision.classification === "confirmed") union(left, right);
    else if (decision.classification === "probable_review") reviewFlags.push({ candidateIds: [records[left].id, records[right].id].sort(), reasons: decision.reasons });
  }
  const groups = new Map<number, string[]>();
  records.forEach((record, index) => groups.set(find(index), [...(groups.get(find(index)) || []), record.id].sort()));
  const canonicalById = new Map<string, { canonicalId: string; sourceIds: string[] }>();
  for (const sourceIds of groups.values()) {
    const canonicalId = sourceIds[0];
    sourceIds.forEach((id) => canonicalById.set(id, { canonicalId, sourceIds }));
  }
  return { canonicalById, reviewFlags };
}

export function candidateProfileTimestampLabels(candidate: Record<string, unknown>) {
  const first = (...keys: string[]) => keys.map((key) => clean(candidate[key])).find(Boolean) || "";
  const profileLastUpdatedAt = first("profile_last_updated_at", "profileLastUpdatedAt", "updated_at", "updatedAt", "created_at", "createdAt");
  const latestCvUploadedAt = first("latest_cv_uploaded_at", "latestCvUploadedAt", "updated_at", "updatedAt");
  const latestCandidateSelfUpdateAt = first("latest_candidate_self_update_at", "latestCandidateSelfUpdateAt");
  const label = (value: string) => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not available";
  };
  return {
    profileLastUpdatedAt,
    latestCvUploadedAt,
    latestCandidateSelfUpdateAt,
    updatedLabel: profileLastUpdatedAt ? `Updated ${label(profileLastUpdatedAt)}` : "Update date not available",
    latestCvLabel: latestCvUploadedAt ? `Latest CV ${label(latestCvUploadedAt)}` : "Latest CV date not available",
  };
}
