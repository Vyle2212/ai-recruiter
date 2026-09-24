import {
  classifyCandidateDuplicate,
  type CandidateIdentityRecord,
} from "./candidateDuplicateIdentity";

export type CandidateIngestionSource =
  | "admin_upload"
  | "candidate_upload"
  | "candidate_confirmed"
  | "recruiter_approved";

export type CandidateIngestionDisposition =
  | "create_new"
  | "update_existing"
  | "hold_for_identity_review";

export type CandidateIngestionMatch = {
  disposition: CandidateIngestionDisposition;
  candidateId: string | null;
  reasons: string[];
  competingCandidateIds: string[];
};

export type CandidateProfileCompletion = {
  searchable: boolean;
  missingRequiredFields: string[];
  confirmationRequired: boolean;
};

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const list = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!clean(value)) return [];
  try {
    const parsed = JSON.parse(clean(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return clean(value)
      .split(/[,;|\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

function identityRecord(
  record: Record<string, unknown>,
): CandidateIdentityRecord {
  return {
    id: clean(record.id || record.candidate_id || record.candidateId),
    email: record.email || record.normalized_email,
    phone: record.phone || record.normalized_phone,
    linkedinUrl: record.linkedin_url || record.linkedinUrl,
    externalId: record.external_id || record.externalId,
    name: record.name || record.full_name || record.displayName,
    rawText: record.raw_text || record.resume_text || record.rawText,
    documentHash: record.cv_hash || record.documentHash,
    employment: record.experience || record.employment,
    education: record.education,
    certifications: record.certifications,
    location: record.location || record.current_location || record.country,
  };
}

/**
 * Resolve one incoming CV against all plausible existing profiles.
 * A deterministic identity may update one row. Multiple deterministic matches,
 * or any probable match without a deterministic winner, are held for review.
 */
export function resolveCandidateIngestion(
  incoming: Record<string, unknown>,
  existing: Array<Record<string, unknown>>,
): CandidateIngestionMatch {
  const source = identityRecord({
    ...incoming,
    id: clean(incoming.id) || "incoming",
  });
  const decisions = existing
    .map((candidate) => ({
      candidate,
      decision: classifyCandidateDuplicate(source, identityRecord(candidate)),
    }))
    .filter((item) => item.decision.classification !== "distinct");
  const confirmed = decisions.filter(
    (item) => item.decision.classification === "confirmed",
  );
  const probable = decisions.filter(
    (item) => item.decision.classification === "probable_review",
  );

  if (confirmed.length === 1) {
    return {
      disposition: "update_existing",
      candidateId: clean(
        confirmed[0].candidate.id || confirmed[0].candidate.candidate_id,
      ),
      reasons: confirmed[0].decision.reasons,
      competingCandidateIds: probable
        .map((item) => clean(item.candidate.id || item.candidate.candidate_id))
        .filter(Boolean),
    };
  }
  if (confirmed.length > 1 || probable.length > 0) {
    return {
      disposition: "hold_for_identity_review",
      candidateId: null,
      reasons:
        confirmed.length > 1
          ? ["multiple_confirmed_identity_matches"]
          : Array.from(
              new Set(probable.flatMap((item) => item.decision.reasons)),
            ),
      competingCandidateIds: [...confirmed, ...probable]
        .map((item) => clean(item.candidate.id || item.candidate.candidate_id))
        .filter(Boolean)
        .sort(),
    };
  }
  return {
    disposition: "create_new",
    candidateId: null,
    reasons: ["no_existing_identity_match"],
    competingCandidateIds: [],
  };
}

const REQUIRED_CORE_FIELDS: Array<[string, string[]]> = [
  ["display_name", ["name", "full_name", "displayName"]],
  ["contact", ["email", "phone"]],
  ["location", ["location", "current_location", "country"]],
  ["current_title", ["current_title", "title", "headline"]],
  ["current_employer", ["current_company", "company", "employer"]],
  ["skills", ["skills", "technical_skills"]],
  ["education", ["education", "education_history", "educationHistory"]],
  ["languages", ["languages", "language_skills", "spoken_languages"]],
];

function present(candidate: Record<string, unknown>, aliases: string[]) {
  return aliases.some((alias) =>
    Array.isArray(candidate[alias])
      ? candidate[alias].length > 0
      : Boolean(clean(candidate[alias])),
  );
}

function rowText(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && typeof value === "object" && "value" in value) {
      const nested = clean((value as { value?: unknown }).value);
      if (nested) return nested;
    }
    const direct = clean(value);
    if (direct && direct !== "[object Object]") return direct;
  }
  return "";
}

function validEmployment(value: unknown) {
  return list(value).some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const employer = rowText(row, "employer", "company", "organization");
    const title = rowText(row, "title", "role", "position");
    const start = rowText(row, "start_date", "startDate", "from");
    const end = rowText(row, "end_date", "endDate", "to");
    return Boolean(
      employer &&
        title &&
        start &&
        (end || row.current === true || /^(?:current|present|now)$/i.test(end)),
    );
  });
}

function validProject(value: unknown) {
  return list(value).some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const identity = rowText(row, "project", "name", "client", "customer");
    const role = rowText(row, "role", "title", "position");
    const start = rowText(row, "start_date", "startDate", "from");
    const end = rowText(row, "end_date", "endDate", "to");
    return Boolean(
      identity &&
        role &&
        start &&
        (end || row.current === true || /^(?:current|present|now)$/i.test(end)),
    );
  });
}

export function evaluateCandidateProfileCompletion(
  candidate: Record<string, unknown>,
  options: { requireCandidateConfirmation?: boolean } = {},
): CandidateProfileCompletion {
  const missing = REQUIRED_CORE_FIELDS.filter(
    ([, aliases]) => !present(candidate, aliases),
  ).map(([name]) => name);
  if (!validEmployment(candidate.experience || candidate.employment))
    missing.push("employment_history");
  const sapProfile =
    candidate.is_sap_profile === true ||
    /\bsap\b/i.test(
      clean(candidate.raw_text || candidate.resume_text || candidate.summary),
    );
  if (
    sapProfile &&
    !validProject(
      candidate.projects ||
        candidate.project_history ||
        candidate.projectHistory,
    )
  )
    missing.push("project_history");
  if (
    sapProfile &&
    !present(candidate, ["primary_module", "sap_modules", "secondary_modules"])
  )
    missing.push("sap_module");
  const candidateConfirmed =
    candidate.candidate_confirmed === true ||
    candidate.profile_confirmation_status === "candidate_confirmed" ||
    Boolean(clean(candidate.candidate_confirmed_at));
  if (options.requireCandidateConfirmation !== false && !candidateConfirmed)
    missing.push("candidate_accuracy_confirmation");
  return {
    searchable: missing.length === 0,
    missingRequiredFields: missing,
    confirmationRequired:
      options.requireCandidateConfirmation !== false && !candidateConfirmed,
  };
}

const TRUSTED_SOURCES = new Set<CandidateIngestionSource>([
  "candidate_confirmed",
  "recruiter_approved",
]);

export function mergeCandidateProfileVersion(params: {
  existing: Record<string, unknown>;
  incoming: Record<string, unknown>;
  incomingSource: CandidateIngestionSource;
  fieldSources?: Record<string, CandidateIngestionSource>;
}) {
  const { existing, incoming, incomingSource, fieldSources = {} } = params;
  const merged: Record<string, unknown> = { ...existing };
  const preservedTrustedFields: string[] = [];
  const updatedFields: string[] = [];
  for (const [field, value] of Object.entries(incoming)) {
    if (value === undefined || value === null || clean(value) === "") continue;
    const existingSource = fieldSources[field];
    if (
      TRUSTED_SOURCES.has(existingSource) &&
      incomingSource === "admin_upload"
    ) {
      preservedTrustedFields.push(field);
      continue;
    }
    if (JSON.stringify(merged[field]) !== JSON.stringify(value))
      updatedFields.push(field);
    merged[field] = value;
  }
  return { merged, preservedTrustedFields, updatedFields };
}
