import type { ExternalTalentSearchPlan } from "./externalTalentTypes";

export const EXTERNAL_MARKET_MAPPING_VERSION =
  "external-market-mapping-v1-segmented-provider-search";

export const EXTERNAL_MARKET_MAPPING_REQUEST_SIZE = 100;

const FICO_ALIASES = [
  "SAP FICO",
  "SAP FI CO",
  "SAP S/4HANA Finance",
  "SAP Finance",
];

const MALAYSIA_MARKET_SEGMENTS = [
  "Malaysia",
  "Kuala Lumpur Malaysia",
  "Selangor Malaysia",
  "Penang Malaysia",
  "Johor Malaysia",
];

function unique(values: string[]) {
  return [
    ...new Map(
      values
        .map((value) => value.normalize("NFKC").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
}

function configuredProfileLimit(
  environment: Record<string, string | undefined>,
) {
  const parsed = Number(environment.EXTERNAL_TALENT_MARKET_MAPPING_LIMIT);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(100, Math.min(1000, Math.round(parsed)));
}

function targetAliases(plan: ExternalTalentSearchPlan) {
  const labels = unique([
    ...plan.targetConcepts.map((target) => target.label),
    ...plan.requiredSkills,
  ]);
  const fico = labels.some((value) =>
    /\b(?:sap\s+)?fi\s*\/?\s*co\b|\bfico\b/i.test(value),
  );
  return unique([...(fico ? FICO_ALIASES : []), ...labels]).slice(0, 5);
}

function marketLocations(plan: ExternalTalentSearchPlan) {
  const configured = unique(plan.requiredLocations);
  const malaysia = configured.some((value) => /malaysia/i.test(value));
  return unique([
    ...configured,
    ...(malaysia ? MALAYSIA_MARKET_SEGMENTS : []),
  ]).slice(0, 6);
}

export function buildExternalMarketMapping(input: {
  plan: ExternalTalentSearchPlan;
  environment?: Record<string, string | undefined>;
}) {
  const environment = input.environment || process.env;
  const profileLimit = configuredProfileLimit(environment);
  const segmentLimit = Math.ceil(
    profileLimit / EXTERNAL_MARKET_MAPPING_REQUEST_SIZE,
  );
  const aliases = targetAliases(input.plan);
  const locations = marketLocations(input.plan);
  const roleContext = unique(input.plan.normalizedRoles)
    .slice(0, 2)
    .join(" or ");
  const pairedSegments = Array.from(
    { length: Math.max(aliases.length, locations.length) },
    (_, index) => {
      const alias =
        aliases[index % Math.max(aliases.length, 1)] ||
        input.plan.semanticQuery;
      const location = locations[index % Math.max(locations.length, 1)] || "";
      const role =
        roleContext && index % 2 === 0 ? ` ${roleContext}` : " professionals";
      return `${alias}${role}${location ? ` in ${location}` : ""}`;
    },
  );
  const variants = unique([
    input.plan.semanticQuery,
    ...pairedSegments,
    ...aliases.map((alias) => `${alias} professionals`),
  ]).slice(0, segmentLimit);

  return {
    version: EXTERNAL_MARKET_MAPPING_VERSION,
    profileLimit,
    requestSize: EXTERNAL_MARKET_MAPPING_REQUEST_SIZE,
    queries: variants.length ? variants : [input.plan.semanticQuery],
  } as const;
}
