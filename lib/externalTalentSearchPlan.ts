import { createHash } from "node:crypto";
import type { CandidateSearchV2Request } from "@/lib/candidateSearchV2Types";
import type { ExternalTalentSearchPlan } from "@/lib/externalTalentTypes";
import {
  buildCommittedSearchRequirements,
  type CommittedSearchRequirements,
} from "@/lib/searchV2CommittedRequirements";
import { ExternalSourceError } from "@/lib/externalCandidateSourceProvider";
import {
  conceptsInText,
  mostSpecificSearchConcepts,
  searchConcept,
} from "@/lib/candidateSearchConcepts";
const cache = new Map<string, ExternalTalentSearchPlan>();
const strings = (v: unknown) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
        .map((x) => x.trim())
    : [];
const stable = (values: string[]) =>
  [
    ...new Set(
      values.map((value) => value.normalize("NFKC").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
export function deterministicExternalSearchPlan(
  r: CandidateSearchV2Request,
  committed: CommittedSearchRequirements = buildCommittedSearchRequirements(r),
): ExternalTalentSearchPlan {
  const f = r.filters || {};
  const targetConcepts = mostSpecificSearchConcepts(
    conceptsInText(
      [r.query, ...(f.sapModules || []), ...(f.skills || [])].join(" "),
    ),
  ).map((conceptId) => ({
    conceptId,
    label: searchConcept(conceptId)?.label || conceptId,
  }));
  const roles = stable([
    ...(f.professionalRoles || []),
    ...(f.currentTitles || []),
    ...(f.anyTitles || []),
  ]);
  const requiredSkills = stable([...(f.sapModules || []), ...(f.skills || [])]);
  const locations = stable([...(f.locations || []), ...(f.countries || [])]);
  const seniority = stable(f.seniorities || []);
  const languages = stable(f.languages || []);
  const delivery = stable(f.deliveryExperience || []);
  const industries = stable(f.industries || []);
  const companies = stable([
    ...(f.currentEmployers || []),
    ...(f.anyEmployers || []),
  ]);
  const exclusions = stable(f.exclusions || []);
  const criteria = (r.criteria || []).map((c) => ({
    id: c.id,
    label: c.label,
    importance: c.importance,
  }));
  const retrievalTargets = targetConcepts.length
    ? targetConcepts.map((target) => target.label)
    : [r.query.normalize("NFKC").trim()];
  const segments = [
    ...retrievalTargets,
    ...roles,
    ...requiredSkills,
    ...seniority,
    ...locations,
    ...languages,
    ...delivery,
    ...industries,
    ...companies,
    f.minimumTotalYearsExperience !== undefined
      ? "at least " + f.minimumTotalYearsExperience + " years experience"
      : "",
    criteria.length ? "prefer " + criteria.map((c) => c.label).join("; ") : "",
    exclusions.length ? "exclude " + exclusions.join("; ") : "",
  ].filter(Boolean);
  return {
    version: "exa-people-plan-v1",
    requirements: committed.requirements.map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      kind: requirement.kind,
      ...(requirement.kind === "target"
        ? { conceptId: requirement.conceptId }
        : requirement.kind === "professional_role"
          ? {
              alternatives: [...requirement.alternatives],
              titleScope: requirement.titleScope,
            }
          : requirement.kind === "location"
            ? {
                alternatives: requirement.alternatives.flatMap((value) => [
                  value.label,
                  value.city || "",
                  value.country,
                ]).filter(Boolean),
              }
            : requirement.kind === "experience"
              ? {
                  minimum: requirement.minimum,
                  maximum: requirement.maximum,
                }
              : requirement.kind === "lifecycle"
                ? {
                    value: requirement.value,
                    values: [...requirement.values],
                    operator: requirement.operator,
                    conceptId: requirement.conceptId,
                    contextConceptIds: [...requirement.contextConceptIds],
                  }
                : requirement.kind === "company"
                  ? { value: requirement.value, scope: requirement.scope }
                  : requirement.kind === "seniority"
                    ? { value: requirement.value }
                    : { value: requirement.value, conceptId: requirement.conceptId }),
    })),
    targetConcepts,
    normalizedRoles: roles,
    requiredSkills,
    optionalSkills: [],
    requiredLocations: locations,
    acceptableLocationVariants: [],
    includeRelocationRemote: r.includeRelocationRemote === true,
    seniority,
    minimumYearsExperience: f.minimumTotalYearsExperience ?? null,
    maximumYearsExperience: f.maximumTotalYearsExperience ?? null,
    languages,
    industry: industries,
    targetCompanies: companies,
    excludedCompanies: exclusions,
    requiredDeliveryContext: delivery,
    rankingCriteria: criteria,
    semanticQuery: [...new Set(segments)].join(" | "),
    unsupportedRequirements: [],
    assumptions: [],
  };
}
export function validateExternalSearchPlan(
  v: unknown,
): ExternalTalentSearchPlan {
  if (!v || typeof v !== "object")
    throw new ExternalSourceError(
      "INVALID_PROVIDER_RESPONSE",
      "Claude returned an invalid external search plan.",
    );
  const x = v as Record<string, unknown>;
  const plan: ExternalTalentSearchPlan = {
    version: "exa-people-plan-v1",
    requirements: [],
    targetConcepts: Array.isArray(x.targetConcepts)
      ? x.targetConcepts
          .filter((y) => y && typeof y === "object")
          .map((y) => {
            const z = y as Record<string, unknown>;
            return {
              conceptId: String(z.conceptId || ""),
              label: String(z.label || ""),
            };
          })
          .filter((y) => y.conceptId && y.label)
      : [],
    normalizedRoles: strings(x.normalizedRoles),
    requiredSkills: strings(x.requiredSkills),
    optionalSkills: strings(x.optionalSkills),
    requiredLocations: strings(x.requiredLocations),
    acceptableLocationVariants: strings(x.acceptableLocationVariants),
    includeRelocationRemote: x.includeRelocationRemote === true,
    seniority: strings(x.seniority),
    minimumYearsExperience:
      typeof x.minimumYearsExperience === "number"
        ? x.minimumYearsExperience
        : null,
    maximumYearsExperience:
      typeof x.maximumYearsExperience === "number"
        ? x.maximumYearsExperience
        : null,
    languages: strings(x.languages),
    industry: strings(x.industry),
    targetCompanies: strings(x.targetCompanies),
    excludedCompanies: strings(x.excludedCompanies),
    requiredDeliveryContext: strings(x.requiredDeliveryContext),
    rankingCriteria: Array.isArray(x.rankingCriteria)
      ? x.rankingCriteria
          .filter((y) => y && typeof y === "object")
          .map((y, i) => {
            const z = y as Record<string, unknown>;
            const importance: "most_important" | "important" | "nice_to_have" =
              z.importance === "most_important" ||
              z.importance === "nice_to_have"
                ? z.importance
                : "important";
            return {
              id: String(z.id || `criterion-${i}`),
              label: String(z.label || ""),
              importance,
            };
          })
          .filter((y) => y.label)
      : [],
    semanticQuery: String(x.semanticQuery || ""),
    unsupportedRequirements: strings(x.unsupportedRequirements),
    assumptions: strings(x.assumptions),
  };
  if (!plan.semanticQuery)
    throw new ExternalSourceError(
      "INVALID_PROVIDER_RESPONSE",
      "Claude did not return an Exa semantic query.",
    );
  return plan;
}
function fallbackPlan(r: CandidateSearchV2Request): ExternalTalentSearchPlan {
  return {
    ...deterministicExternalSearchPlan(r),
    semanticQuery: r.query,
    unsupportedRequirements: [
      ...(r.filters?.education || []).map(() => "education verification"),
      ...(r.filters?.certifications || []).map(
        () => "certification verification",
      ),
    ],
  };
}
export async function createExternalSearchPlan(
  r: CandidateSearchV2Request,
  signal?: AbortSignal,
) {
  const key = createHash("sha256")
    .update(JSON.stringify({ q: r.query, f: r.filters, c: r.criteria }))
    .digest("hex");
  const hit = cache.get(key);
  if (hit) return { plan: hit, cacheHit: true };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const plan = fallbackPlan(r);
    cache.set(key, plan);
    return {
      plan,
      cacheHit: false,
      warning:
        "Claude unavailable; deterministic committed requirements were used.",
    };
  }
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      normalizedRoles: { type: "array", items: { type: "string" } },
      requiredSkills: { type: "array", items: { type: "string" } },
      optionalSkills: { type: "array", items: { type: "string" } },
      requiredLocations: { type: "array", items: { type: "string" } },
      acceptableLocationVariants: { type: "array", items: { type: "string" } },
      seniority: { type: "array", items: { type: "string" } },
      minimumYearsExperience: { type: ["number", "null"] },
      languages: { type: "array", items: { type: "string" } },
      industry: { type: "array", items: { type: "string" } },
      targetCompanies: { type: "array", items: { type: "string" } },
      excludedCompanies: { type: "array", items: { type: "string" } },
      requiredDeliveryContext: { type: "array", items: { type: "string" } },
      rankingCriteria: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            importance: {
              type: "string",
              enum: ["most_important", "important", "nice_to_have"],
            },
          },
          required: ["id", "label", "importance"],
        },
      },
      semanticQuery: { type: "string" },
      unsupportedRequirements: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } },
    },
    required: [
      "normalizedRoles",
      "requiredSkills",
      "optionalSkills",
      "requiredLocations",
      "acceptableLocationVariants",
      "seniority",
      "minimumYearsExperience",
      "languages",
      "industry",
      "targetCompanies",
      "excludedCompanies",
      "requiredDeliveryContext",
      "rankingCriteria",
      "semanticQuery",
      "unsupportedRequirements",
      "assumptions",
    ],
  };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 1400,
      tools: [
        {
          name: "create_external_talent_search_plan",
          description:
            "Return an evidence-safe external people search plan. Never add requirements not present in the committed input.",
          strict: true,
          input_schema: schema,
        },
      ],
      tool_choice: {
        type: "tool",
        name: "create_external_talent_search_plan",
        disable_parallel_tool_use: true,
      },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            brief: r.query,
            filters: r.filters || {},
            criteria: r.criteria || [],
          }),
        },
      ],
    }),
  });
  if (!response.ok)
    throw new ExternalSourceError(
      response.status === 401 ? "AUTHENTICATION_FAILED" : "PROVIDER_ERROR",
      "External search criteria preparation failed.",
    );
  const json = (await response.json()) as {
    content?: Array<{ type?: string; name?: string; input?: unknown }>;
  };
  const tool = json.content?.find(
    (b) =>
      b.type === "tool_use" && b.name === "create_external_talent_search_plan",
  );
  const plan = validateExternalSearchPlan(tool?.input);
  cache.set(key, plan);
  return { plan, cacheHit: false };
}
