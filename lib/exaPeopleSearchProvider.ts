import { createHash } from "node:crypto";
import type {
  ExternalCandidateSourceProvider,
  ExternalProviderSearchRequest,
  ExternalProviderSearchResponse,
  ExternalSourceCapability,
  ExternalCandidate,
  ExternalEmploymentRecord,
} from "@/lib/externalCandidateSourceProvider";
import { ExternalSourceError } from "@/lib/externalCandidateSourceProvider";
import { validateExternalProfileUrl } from "@/lib/externalProfileUrl";
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
const recordText = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return [
    record.title,
    record.role,
    record.description,
    record.summary,
    record.company && typeof record.company === "object"
      ? (record.company as Record<string, unknown>).name
      : record.company,
    record.startDate,
    record.endDate,
  ]
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && Boolean(entry.trim()),
    )
    .join(" — ");
};
const cleanText = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : undefined;
const objectName = (value: unknown) => {
  if (typeof value === "string") return cleanText(value);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return cleanText(record.name || record.title || record.label);
};
function normalizeEmploymentRecord(
  value: unknown,
  index: number,
  sourceIdentity: string,
): ExternalEmploymentRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = cleanText(record.title || record.role || record.position);
  const employer = objectName(
    record.company || record.employer || record.organization,
  );
  const startDate = cleanText(record.startDate || record.start);
  const endDate = cleanText(record.endDate || record.end);
  const summary = cleanText(
    record.description || record.summary || record.responsibilities,
  );
  const location = objectName(record.location);
  if (!title && !employer && !startDate && !endDate && !summary) return null;
  const current =
    record.current === true ||
    record.isCurrent === true ||
    Boolean(endDate && /^(?:present|current|now)$/i.test(endDate));
  return {
    id: createHash("sha256")
      .update(
        [
          sourceIdentity,
          index,
          title || "",
          employer || "",
          startDate || "",
          endDate || "",
        ].join("|"),
      )
      .digest("hex")
      .slice(0, 20),
    ...(title ? { title } : {}),
    ...(employer ? { employer } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    current,
    ...(location ? { location } : {}),
    ...(summary ? { summary } : {}),
  };
}
function groundedYears(work: unknown[]) {
  const ranges = work.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>,
      start = Date.parse(String(record.startDate || "")),
      rawEnd = String(record.endDate || "").toLowerCase(),
      end = /present|current/.test(rawEnd)
        ? Date.now()
        : Date.parse(String(record.endDate || ""));
    return Number.isFinite(start) && Number.isFinite(end) && end >= start
      ? [[start, end] as const]
      : [];
  });
  if (!ranges.length) return undefined;
  const ordered = [...ranges].sort((left, right) => left[0] - right[0]);
  let totalMs = 0;
  let [currentStart, currentEnd] = ordered[0];
  for (const [start, end] of ordered.slice(1)) {
    if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
    else {
      totalMs += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  totalMs += currentEnd - currentStart;
  return Math.round((totalMs / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;
}
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
  const url = validateExternalProfileUrl(result.url);
  if (!url) return null;
  const work = Array.isArray(props.workHistory) ? props.workHistory : [];
  const providerCurrentTitle = cleanText(props.currentTitle);
  const providerCurrentEmployer = cleanText(props.currentEmployer);
  const normalizedEmployment = work
    .map((item, workIndex) =>
      normalizeEmploymentRecord(item, workIndex, `${requestId}:${url.url}`),
    )
    .filter((item): item is ExternalEmploymentRecord => Boolean(item));
  const hasExplicitCurrentEmployment = normalizedEmployment.some(
    (item) => item.current,
  );
  const employment = normalizedEmployment.map((item) => ({
    ...item,
    current:
      item.current ||
      (!hasExplicitCurrentEmployment &&
        Boolean(providerCurrentTitle) &&
        Boolean(providerCurrentEmployer) &&
        item.title?.toLocaleLowerCase() ===
          providerCurrentTitle?.toLocaleLowerCase() &&
        item.employer?.toLocaleLowerCase() ===
          providerCurrentEmployer?.toLocaleLowerCase()),
  }));
  const current = employment.find((item) => item.current) || null;
  const excerpts = Array.isArray(result.highlights)
    ? result.highlights
        .filter((x): x is string => typeof x === "string")
        .slice(0, 12)
    : [];
  const employmentText = work.map(recordText).filter(Boolean);
  const currentTitle = providerCurrentTitle
    ? providerCurrentTitle
    : typeof props.headline === "string"
      ? props.headline
      : current?.title
        ? current.title
        : typeof result.title === "string"
          ? result.title
          : undefined;
  const currentEmployer = providerCurrentEmployer
    ? providerCurrentEmployer
    : current?.employer
      ? current.employer
      : undefined;
  return {
    source: "linkedin_talent_pool",
    externalCandidateId: String(
      person?.id ||
        result.id ||
        createHash("sha256").update(url.url).digest("hex").slice(0, 20),
    ),
    displayName:
      typeof props.displayName === "string"
        ? props.displayName
        : typeof props.name === "string"
          ? props.name
          : undefined,
    headline: currentTitle,
    currentTitle,
    location: typeof props.location === "string" ? props.location : undefined,
    currentEmployer,
    skills: textValues(props.skills),
    experienceSummary:
      typeof props.summary === "string" ? props.summary : excerpts[0],
    employment,
    employmentText,
    projectText: textValues(props.projects),
    education: textValues(props.education),
    certifications: textValues(props.certifications),
    // Provider aggregates and seniority labels are not grounded duration.
    // Only merge explicit, non-overlapping employment date ranges.
    totalYearsExperience: groundedYears(work),
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
        numResults: Math.min(100, Math.max(request.pageSize, 1)),
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
