export type CandidateDuplicateMatchStatus = "confirmed_duplicate" | "likely_duplicate" | "possible_duplicate" | "new_candidate";
export type CandidateDuplicateRecommendedAction = "auto_update_existing_profile" | "admin_review_required" | "create_new_candidate";

type AnyRecord = Record<string, any>;

export type CandidateDuplicateIdentityResult = {
  matchStatus: CandidateDuplicateMatchStatus;
  confidence: number;
  matchedCandidateId: string;
  matchReasons: string[];
  recommendedAction: CandidateDuplicateRecommendedAction;
};

export type CandidateDuplicateAdminLog = CandidateDuplicateIdentityResult & {
  uploadedCandidateId: string;
  uploadedUserId: string;
  matchedExistingCandidateId: string;
  updatedFields: string[];
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  updateTimestamp: string;
  adminReviewStatus: "auto_update_dry_run" | "pending_admin_review" | "new_candidate_dry_run";
};

const EMPTY_RESULT: CandidateDuplicateIdentityResult = {
  matchStatus: "new_candidate",
  confidence: 0,
  matchedCandidateId: "",
  matchReasons: [],
  recommendedAction: "create_new_candidate",
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compact(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function emailOf(candidate: AnyRecord) {
  const email = clean(candidate.email || candidate.normalized_email || candidate.candidateEmail || candidate.contact_email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function phoneOf(candidate: AnyRecord) {
  const digits = clean(candidate.phone || candidate.normalized_phone || candidate.mobile || candidate.contact_phone || candidate.phone_number).replace(/\D/g, "");
  if (digits.length < 8) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function linkedinOf(candidate: AnyRecord) {
  const value = clean(candidate.linkedin || candidate.linkedin_url || candidate.linkedIn || candidate.linkedInUrl || candidate.profile_url).toLowerCase();
  if (!value || !value.includes("linkedin")) return "";
  return value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function nameOf(candidate: AnyRecord) {
  return compact(candidate.normalized_name || candidate.name || candidate.displayName || candidate.display_name || candidate.full_name || candidate.candidate_name);
}

function locationOf(candidate: AnyRecord) {
  return compact(candidate.country || candidate.current_country || candidate.location_country || candidate.location || candidate.current_location || candidate.display_location);
}

function companyOf(candidate: AnyRecord) {
  return compact(candidate.current_company || candidate.currentCompany || candidate.display_company || candidate.company || candidate.employer);
}

function moduleOf(candidate: AnyRecord) {
  return compact(candidate.primary_module || candidate.primaryModule || candidate.sap_module || candidate.module || first(candidate.sap_modules) || first(candidate.secondary_modules));
}

function first(value: any) {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value.split(/[,;|\n]+/)[0];
  return "";
}

function tokenSet(value: any) {
  return new Set(clean(value).toLowerCase().split(/[^a-z0-9+#]+/).filter((token) => token.length >= 3));
}

function cvSimilarity(uploaded: AnyRecord, existing: AnyRecord) {
  const a = tokenSet([uploaded.raw_text, uploaded.resume_text, uploaded.raw_cv, uploaded.cv_text, uploaded.summary].join(" "));
  const b = tokenSet([existing.raw_text, existing.resume_text, existing.raw_cv, existing.cv_text, existing.summary].join(" "));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return Math.round((overlap / Math.max(a.size, b.size)) * 100);
}

function scorePair(uploaded: AnyRecord, existing: AnyRecord) {
  const reasons: string[] = [];
  let confidence = 0;
  const uploadedEmail = emailOf(uploaded);
  const existingEmail = emailOf(existing);
  const uploadedPhone = phoneOf(uploaded);
  const existingPhone = phoneOf(existing);
  const uploadedLinkedIn = linkedinOf(uploaded);
  const existingLinkedIn = linkedinOf(existing);
  const uploadedName = nameOf(uploaded);
  const existingName = nameOf(existing);
  const sameName = Boolean(uploadedName && existingName && uploadedName === existingName);
  let strongIdentifier = false;

  if (uploadedEmail && existingEmail && uploadedEmail === existingEmail) {
    confidence += 100;
    strongIdentifier = true;
    reasons.push("exact email match");
  }
  if (uploadedPhone && existingPhone && uploadedPhone === existingPhone) {
    confidence += 96;
    strongIdentifier = true;
    reasons.push("exact phone match");
  }
  if (uploadedLinkedIn && existingLinkedIn && uploadedLinkedIn === existingLinkedIn) {
    confidence += 98;
    strongIdentifier = true;
    reasons.push("LinkedIn URL match");
  }
  if (sameName && locationOf(uploaded) && locationOf(uploaded) === locationOf(existing)) {
    confidence += 45;
    reasons.push("normalized name + location match");
  }
  if (sameName && companyOf(uploaded) && companyOf(uploaded) === companyOf(existing)) {
    confidence += 40;
    reasons.push("normalized name + company match");
  }
  if (sameName && moduleOf(uploaded) && moduleOf(uploaded) === moduleOf(existing)) {
    confidence += 45;
    reasons.push("normalized name + SAP module match");
  }
  const similarity = cvSimilarity(uploaded, existing);
  if (similarity >= 70) {
    confidence += Math.min(30, Math.round(similarity / 3));
    reasons.push(`CV text similarity ${similarity}%`);
  }
  return { existing, confidence: Math.min(100, confidence), reasons, strongIdentifier };
}

function statusFor(confidence: number, strongIdentifier: boolean): Pick<CandidateDuplicateIdentityResult, "matchStatus" | "recommendedAction"> {
  if (confidence >= 95 && strongIdentifier) return { matchStatus: "confirmed_duplicate", recommendedAction: "auto_update_existing_profile" };
  if (confidence >= 80) return { matchStatus: "likely_duplicate", recommendedAction: "admin_review_required" };
  if (confidence >= 45) return { matchStatus: "possible_duplicate", recommendedAction: "admin_review_required" };
  return { matchStatus: "new_candidate", recommendedAction: "create_new_candidate" };
}

export function detectCandidateDuplicateIdentity(uploadedCandidate: AnyRecord, existingCandidates: AnyRecord[]): CandidateDuplicateIdentityResult {
  if (!Array.isArray(existingCandidates) || !existingCandidates.length) return { ...EMPTY_RESULT };
  const best = existingCandidates.map((candidate) => scorePair(uploadedCandidate, candidate)).sort((a, b) => b.confidence - a.confidence)[0];
  if (!best || best.confidence < 45) return { ...EMPTY_RESULT };
  const status = statusFor(best.confidence, best.strongIdentifier);
  return {
    matchStatus: status.matchStatus,
    confidence: best.confidence,
    matchedCandidateId: candidateId(best.existing),
    matchReasons: best.reasons,
    recommendedAction: status.recommendedAction,
  };
}

export function candidateFacingProfileUpdateMessage() {
  return "Your profile has been updated successfully.";
}

const MERGE_FIELDS = ["name", "email", "phone", "linkedin_url", "current_title", "current_company", "primary_module", "location", "country", "raw_text", "resume_text"];

export function buildCandidateDuplicateAdminLog(input: {
  uploadedCandidate: AnyRecord;
  matchedCandidate?: AnyRecord;
  result: CandidateDuplicateIdentityResult;
  uploadedUserId?: string;
  now?: string;
}): CandidateDuplicateAdminLog {
  const matched = input.matchedCandidate || {};
  const previousValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};
  const updatedFields: string[] = [];
  for (const field of MERGE_FIELDS) {
    const nextValue = input.uploadedCandidate[field];
    if (nextValue === undefined || nextValue === null || clean(nextValue) === "") continue;
    const previousValue = matched[field];
    if (JSON.stringify(previousValue ?? "") === JSON.stringify(nextValue)) continue;
    previousValues[field] = previousValue ?? "";
    newValues[field] = nextValue;
    updatedFields.push(field);
  }
  const adminReviewStatus = input.result.recommendedAction === "auto_update_existing_profile"
    ? "auto_update_dry_run"
    : input.result.recommendedAction === "admin_review_required"
      ? "pending_admin_review"
      : "new_candidate_dry_run";
  return {
    ...input.result,
    uploadedCandidateId: candidateId(input.uploadedCandidate),
    uploadedUserId: clean(input.uploadedUserId || input.uploadedCandidate.user_id || input.uploadedCandidate.candidate_user_id),
    matchedExistingCandidateId: input.result.matchedCandidateId,
    updatedFields,
    previousValues,
    newValues,
    updateTimestamp: input.now || new Date().toISOString(),
    adminReviewStatus,
  };
}

export function resolveCandidateProfileTimestamps(candidate: AnyRecord) {
  const profileLastUpdatedAt = clean(candidate.profileLastUpdatedAt || candidate.profile_last_updated_at || candidate.updated_at || candidate.status_updated_at || candidate.created_at);
  const latestCvUploadedAt = clean(candidate.latestCvUploadedAt || candidate.latest_cv_uploaded_at || candidate.cv_uploaded_at || candidate.cvUploadedAt || candidate.created_at || candidate.updated_at);
  const latestCandidateSelfUpdateAt = clean(candidate.latestCandidateSelfUpdateAt || candidate.latest_candidate_self_update_at || candidate.candidate_self_updated_at || candidate.self_updated_at || profileLastUpdatedAt);
  return { profileLastUpdatedAt, latestCvUploadedAt, latestCandidateSelfUpdateAt };
}

export function formatCandidateUpdateMonthYear(value: any) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function candidateProfileTimestampLabels(candidate: AnyRecord) {
  const timestamps = resolveCandidateProfileTimestamps(candidate);
  const updated = formatCandidateUpdateMonthYear(timestamps.profileLastUpdatedAt);
  const latestCv = formatCandidateUpdateMonthYear(timestamps.latestCvUploadedAt);
  return {
    ...timestamps,
    updatedLabel: updated ? `Updated ${updated}` : "",
    latestCvLabel: latestCv ? `Latest CV ${latestCv}` : "",
  };
}
