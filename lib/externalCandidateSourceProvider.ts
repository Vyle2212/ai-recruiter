import { createHash } from "node:crypto";

import type {
  CandidateSearchV2Request,
  CandidateSearchTalentPool,
} from "@/lib/candidateSearchV2Types";
import { auditLinkedInProfileUrl } from "@/lib/linkedinProfileUrl";

export type ExternalSourceFailureCode =
  | "SOURCE_NOT_CONFIGURED"
  | "SOURCE_NOT_CONNECTED"
  | "AUTHENTICATION_EXPIRED"
  | "AUTHENTICATION_FAILED"
  | "SOURCE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "NO_PROVIDER_MATCHES"
  | "UNSUPPORTED_FILTER"
  | "INVALID_PROVIDER_CURSOR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_PROFILE_URL";

export type ExternalFilterKind =
  | "query"
  | "currentTitles"
  | "anyTitles"
  | "locations"
  | "skills"
  | "languages"
  | "seniorities"
  | "experience"
  | "companies"
  | "industries"
  | "education"
  | "certifications"
  | "deliveryExperience";

export type ExternalSourceCapability = {
  source: "linkedin_talent_pool";
  providerId: string | null;
  providerName: string | null;
  connected: boolean;
  ready: boolean;
  status: "not_connected" | "ready" | "authentication_expired" | "unavailable";
  reason: ExternalSourceFailureCode | null;
  authentication: "not_configured" | "valid" | "expired" | "unknown";
  supportedFilters: ExternalFilterKind[];
  supportsCandidateDetails: boolean;
  supportsImport: boolean;
  pagination: "cursor" | "page" | "none";
  sandboxAvailable: boolean;
};

export type ExternalCandidateEvidence = {
  requirementId: string;
  state: "verified" | "supported" | "unverified" | "conflicting";
  excerpt: string;
  sourceField: string;
};

export type ExternalEmploymentRecord = {
  id: string;
  title?: string;
  employer?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  location?: string;
  summary?: string;
};

export type ExternalCandidate = {
  source: "linkedin_talent_pool";
  externalCandidateId: string;
  displayName?: string;
  headline?: string;
  currentTitle?: string;
  location?: string;
  currentEmployer?: string;
  skills?: string[];
  experienceSummary?: string;
  employment?: ExternalEmploymentRecord[];
  employmentText?: string[];
  projectText?: string[];
  education?: string[];
  certifications?: string[];
  totalYearsExperience?: number;
  profileUrl?: string;
  providerEvidence: ExternalCandidateEvidence[];
  providerRank?: number;
};

export type ExternalProviderSearchRequest = {
  source: "linkedin_talent_pool";
  committedSearchId: string;
  query: string;
  filters: Partial<Record<ExternalFilterKind, unknown>>;
  pageSize: number;
  providerCursor?: string;
};

export type ExternalProviderSearchResponse = {
  candidates: ExternalCandidate[];
  providerResultCount?: number;
  nextCursor?: string;
  sourceRequestId: string;
};

export interface ExternalCandidateSourceProvider {
  readonly source: "linkedin_talent_pool";
  capability(): Promise<ExternalSourceCapability>;
  search(
    request: ExternalProviderSearchRequest,
    signal?: AbortSignal,
  ): Promise<ExternalProviderSearchResponse>;
  getCandidateDetails?(
    externalCandidateId: string,
    signal?: AbortSignal,
  ): Promise<ExternalCandidate>;
  importCandidate?(
    externalCandidateId: string,
    metadata: { consentBasis: string; retentionPolicy: string },
    signal?: AbortSignal,
  ): Promise<{
    internalCandidateId: string;
    possibleDuplicateInternalIds: string[];
  }>;
}

export class ExternalSourceError extends Error {
  constructor(
    public readonly code: ExternalSourceFailureCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

const NOT_CONNECTED: ExternalSourceCapability = {
  source: "linkedin_talent_pool",
  providerId: null,
  providerName: null,
  connected: false,
  ready: false,
  status: "not_connected",
  reason: "SOURCE_NOT_CONNECTED",
  authentication: "not_configured",
  supportedFilters: [],
  supportsCandidateDetails: false,
  supportsImport: false,
  pagination: "none",
  sandboxAvailable: false,
};

class NotConnectedLinkedInProvider implements ExternalCandidateSourceProvider {
  readonly source = "linkedin_talent_pool" as const;
  async capability() {
    return NOT_CONNECTED;
  }
  async search(): Promise<ExternalProviderSearchResponse> {
    throw new ExternalSourceError(
      "SOURCE_NOT_CONNECTED",
      "Configure Exa People Search and Claude to search public professional profiles.",
    );
  }
}

let configuredProvider: ExternalCandidateSourceProvider =
  new NotConnectedLinkedInProvider();
export function linkedinSourcingProvider() {
  return configuredProvider;
}
export function setLinkedInSourcingProviderForTests(
  provider: ExternalCandidateSourceProvider | null,
) {
  configuredProvider = provider || new NotConnectedLinkedInProvider();
}

export async function linkedinSourceCapability() {
  return linkedinSourcingProvider().capability();
}

function requestedFilterKinds(
  request: CandidateSearchV2Request,
): Array<[ExternalFilterKind, unknown]> {
  const filters = request.filters || {};
  return [
    ["query", request.query],
    ["currentTitles", filters.currentTitles],
    ["anyTitles", filters.anyTitles],
    ["locations", [...(filters.locations || []), ...(filters.countries || [])]],
    ["skills", [...(filters.skills || []), ...(filters.sapModules || [])]],
    ["languages", filters.languages],
    ["seniorities", filters.seniorities],
    [
      "experience",
      {
        minimum: filters.minimumTotalYearsExperience,
        maximum: filters.maximumTotalYearsExperience,
      },
    ],
    [
      "companies",
      [...(filters.currentEmployers || []), ...(filters.anyEmployers || [])],
    ],
    ["industries", filters.industries],
    ["education", filters.education],
    ["certifications", filters.certifications],
    ["deliveryExperience", filters.deliveryExperience],
  ];
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object")
    return Object.values(value).some(
      (item) => item !== undefined && item !== null && item !== "",
    );
  return value !== undefined && value !== null && value !== "";
}

export function mapSearchV2ToExternalProvider(
  request: CandidateSearchV2Request,
  capability: ExternalSourceCapability,
) {
  const supported = new Set(capability.supportedFilters);
  const filters: Partial<Record<ExternalFilterKind, unknown>> = {};
  const unsupportedRequiredFilters: ExternalFilterKind[] = [];
  for (const [kind, value] of requestedFilterKinds(request)) {
    if (!hasValue(value)) continue;
    if (supported.has(kind)) filters[kind] = value;
    else if (kind !== "query") unsupportedRequiredFilters.push(kind);
  }
  return {
    filters,
    unsupportedRequiredFilters: [...new Set(unsupportedRequiredFilters)],
  };
}

type ProviderCursorEnvelope = {
  source: CandidateSearchTalentPool;
  providerId: string;
  providerSearchIdentity: string;
  committedSearchId: string;
  providerCursor: string;
  rankingVersion: string;
  evaluatedWindowIdentity: string;
};
export function encodeExternalProviderCursor(value: ProviderCursorEnvelope) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
export function decodeExternalProviderCursor(
  value: string,
  expected: Pick<
    ProviderCursorEnvelope,
    "providerId" | "committedSearchId" | "rankingVersion"
  >,
) {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as ProviderCursorEnvelope;
    if (
      parsed.source !== "linkedin_talent_pool" ||
      parsed.providerId !== expected.providerId ||
      parsed.committedSearchId !== expected.committedSearchId ||
      parsed.rankingVersion !== expected.rankingVersion ||
      !parsed.providerCursor
    )
      throw new Error();
    return parsed;
  } catch {
    throw new ExternalSourceError(
      "INVALID_PROVIDER_CURSOR",
      "This external result cursor does not belong to the current search.",
    );
  }
}

export function validatedProviderProfileUrl(candidate: ExternalCandidate) {
  return auditLinkedInProfileUrl(candidate.profileUrl).normalizedUrl;
}

export function externalSearchIdentity(
  providerId: string,
  committedSearchId: string,
  request: CandidateSearchV2Request,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        providerId,
        committedSearchId,
        query: request.query,
        filters: request.filters,
      }),
    )
    .digest("hex")
    .slice(0, 24);
}
