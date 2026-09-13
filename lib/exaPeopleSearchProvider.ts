import { createHash } from "node:crypto";
import type {
  ExternalCandidateSourceProvider,
  ExternalProviderSearchRequest,
  ExternalProviderSearchResponse,
  ExternalSourceCapability,
  ExternalCandidate,
} from "@/lib/externalCandidateSourceProvider";
import { ExternalSourceError } from "@/lib/externalCandidateSourceProvider";
import { validateExternalPersonProfileUrl } from "@/lib/externalProfileUrl";
import {
  calculateCanonicalExternalExperience,
  confirmedExternalCurrentEmployment,
  normalizeExternalEmploymentRecords,
  sortExternalEmploymentRecords,
} from "@/lib/externalTalentProfile";
export type ExaResult = {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  highlights?: unknown;
  entities?: unknown;
};
const textValues = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string"
          ? [item]
          : item && typeof item === "object"
            ? Object.values(item as Record<string, unknown>).filter(
                (entry): entry is string => typeof entry === "string",
              )
            : [],
      )
    : typeof value === "string"
      ? [value]
      : [];
const assignmentTextValues = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (!item || typeof item !== "object") return [];
        const text = Object.values(item as Record<string, unknown>)
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.normalize("NFKC").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" â€” ");
        return text ? [text] : [];
      })
    : typeof value === "string"
      ? [value]
      : [];
const clean = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim() || undefined
    : undefined;
const same = (left?: string, right?: string) =>
  Boolean(
    left &&
    right &&
    left.localeCompare(right, undefined, { sensitivity: "base" }) === 0,
  );
export function normalizeExaPersonResult(
  result: ExaResult,
  index: number,
  requestId: string,
): ExternalCandidate | null {
  const person = Array.isArray(result.entities)
    ? result.entities.find((e): e is Record<string, unknown> =>
        Boolean(
          e &&
          typeof e === "object" &&
          (e as Record<string, unknown>).type === "person",
        ),
      )
    : null;
  const props =
    person && person.properties && typeof person.properties === "object"
      ? (person.properties as Record<string, unknown>)
      : {};
  const work = Array.isArray(props.workHistory) ? props.workHistory : [];
  const structuredDisplayName =
    clean(props.displayName) || clean(props.name) || undefined;
  const titleName = clean(result.title)
    ?.replace(/\s*[|·-]\s*LinkedIn.*$/i, "")
    .trim();
  const groundedTitleName =
    titleName &&
    !/\b(?:job description|hiring guide|jobs?|company|learning|article)\b/i.test(
      titleName,
    )
      ? titleName
      : undefined;
  const url = validateExternalPersonProfileUrl(
    result.url,
    Boolean(person || structuredDisplayName || groundedTitleName),
  );
  if (!url) return null;
  const displayName = structuredDisplayName || groundedTitleName;
  const employmentRecords = sortExternalEmploymentRecords(
    normalizeExternalEmploymentRecords(work, displayName),
  );
  const currentEmployment =
    confirmedExternalCurrentEmployment(employmentRecords);
  const experienceCalculation =
    calculateCanonicalExternalExperience(employmentRecords);
  const excerpts = Array.isArray(result.highlights)
    ? result.highlights
        .filter((x): x is string => typeof x === "string")
        .slice(0, 12)
    : [];
  const explicitCurrentTitle = clean(props.currentTitle);
  const safeExplicitCurrentTitle = same(explicitCurrentTitle, displayName)
    ? undefined
    : explicitCurrentTitle;
  const currentTitle = currentEmployment?.title || safeExplicitCurrentTitle;
  const explicitCurrentEmployer = clean(props.currentEmployer);
  const safeExplicitCurrentEmployer =
    same(explicitCurrentEmployer, displayName) ||
    same(explicitCurrentEmployer, currentTitle)
      ? undefined
      : explicitCurrentEmployer;
  const currentEmployer =
    currentEmployment?.employer || safeExplicitCurrentEmployer;
  const explicitProfileTitle = clean(props.headline);
  const profileTitle = same(explicitProfileTitle, displayName)
    ? currentTitle
    : explicitProfileTitle || currentTitle;
  const employmentText = employmentRecords.map((record) =>
    [
      record.title,
      record.description,
      record.employer,
      record.start,
      record.end,
    ]
      .filter(Boolean)
      .join(" — "),
  );
  return {
    source: "linkedin_talent_pool",
    externalCandidateId: String(
      person?.id ||
        result.id ||
        createHash("sha256").update(url.url).digest("hex").slice(0, 20),
    ),
    displayName,
    profileTitle,
    headline: profileTitle,
    currentTitle,
    location: typeof props.location === "string" ? props.location : undefined,
    currentEmployer,
    skills: textValues(props.skills),
    experienceSummary:
      typeof props.summary === "string" ? props.summary : excerpts[0],
    employmentText,
    employmentRecords,
    projectText: assignmentTextValues(props.projects),
    education: textValues(props.education),
    certifications: textValues(props.certifications),
    // Provider aggregates and seniority labels are not grounded duration.
    // Only merge explicit, non-overlapping employment date ranges.
    totalYearsExperience: experienceCalculation.totalYears ?? undefined,
    experienceCalculation,
    profileProvenance: {
      displayNameField: clean(props.displayName)
        ? "properties.displayName"
        : clean(props.name)
          ? "properties.name"
          : null,
      profileTitleField: explicitProfileTitle
        ? "properties.headline"
        : currentTitle
          ? "derived.currentTitle"
          : null,
      currentTitleField: currentEmployment?.title
        ? currentEmployment.provenance.titleField
        : safeExplicitCurrentTitle
          ? "properties.currentTitle"
          : null,
      currentEmployerField: currentEmployment?.employer
        ? currentEmployment.provenance.employerField
        : safeExplicitCurrentEmployer
          ? "properties.currentEmployer"
          : null,
    },
    profileUrl: url.url,
    providerEvidence: excerpts.map((excerpt, i) => ({
      requirementId: `provider-evidence-${i}`,
      state: "supported",
      excerpt,
      sourceField: "highlights",
    })),
    providerRank: index + 1,
  };
}
export class ExaPeopleSearchProvider implements ExternalCandidateSourceProvider {
  readonly source = "linkedin_talent_pool" as const;
  async capability(): Promise<ExternalSourceCapability> {
    const enabled = process.env.EXTERNAL_TALENT_SEARCH_ENABLED === "true";
    const provider = process.env.EXTERNAL_TALENT_PROVIDER;
    if (!enabled || provider !== "exa")
      return {
        source: this.source,
        providerId: "exa",
        providerName: "Exa People Search",
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
    if (!process.env.EXA_API_KEY || !process.env.ANTHROPIC_API_KEY)
      return {
        source: this.source,
        providerId: "exa",
        providerName: "Exa People Search",
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
    return {
      source: this.source,
      providerId: "exa",
      providerName: "Exa People Search",
      connected: true,
      ready: true,
      status: "ready",
      reason: null,
      authentication: "valid",
      supportedFilters: [
        "query",
        "currentTitles",
        "anyTitles",
        "locations",
        "skills",
        "languages",
        "seniorities",
        "experience",
        "companies",
        "industries",
        "education",
        "certifications",
        "deliveryExperience",
      ],
      supportsCandidateDetails: false,
      supportsImport: false,
      pagination: "none",
      sandboxAvailable: false,
    };
  }
  async search(
    request: ExternalProviderSearchRequest,
    signal?: AbortSignal,
  ): Promise<ExternalProviderSearchResponse> {
    const key = process.env.EXA_API_KEY;
    if (!key)
      throw new ExternalSourceError(
        "SOURCE_NOT_CONNECTED",
        "External Talent Network is not configured.",
      );
    if (request.providerCursor)
      throw new ExternalSourceError(
        "INVALID_PROVIDER_CURSOR",
        "Exa People Search did not provide a continuation cursor for this search.",
      );
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        query: request.query,
        category: "people",
        type: "auto",
        numResults: Math.min(100, Math.max(request.pageSize, 50)),
        contents: { highlights: true },
      }),
    });
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after")) || undefined;
      throw new ExternalSourceError(
        response.status === 401
          ? "AUTHENTICATION_FAILED"
          : response.status === 429
            ? "RATE_LIMITED"
            : response.status === 408
              ? "PROVIDER_TIMEOUT"
              : "PROVIDER_ERROR",
        response.status === 429
          ? "External Talent Network is rate limited."
          : "External Talent Network search failed.",
        retry,
      );
    }
    const json = (await response.json()) as {
      results?: ExaResult[];
      requestId?: string;
    };
    if (!Array.isArray(json.results))
      throw new ExternalSourceError(
        "INVALID_PROVIDER_RESPONSE",
        "Exa returned an invalid people-search response.",
      );
    const sourceRequestId = String(
      json.requestId ||
        response.headers.get("x-request-id") ||
        crypto.randomUUID(),
    );
    const candidates = json.results
      .map((x, i) => normalizeExaPersonResult(x, i, sourceRequestId))
      .filter((x): x is ExternalCandidate => Boolean(x));
    return {
      candidates,
      providerResultCount: json.results.length,
      sourceRequestId,
    };
  }
}
