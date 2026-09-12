import type { CandidateSearchV2Document } from "./candidateSearchV2Types";

export type RequiredLocationAlternative = Readonly<{
  label: string;
  city?: string;
  country: string;
}>;

const CITY_COUNTRY: Array<[string, string, RegExp]> = [
  ["Kuala Lumpur", "Malaysia", /\bkuala\s+lumpur\b/i],
  ["Tokyo", "Japan", /\btokyo\b/i],
  ["Osaka", "Japan", /\bosaka\b/i],
];
const COUNTRY: Array<[string, RegExp]> = [
  ["Malaysia", /\bmalaysia\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["Japan", /\bjapan\b/i],
  ["Philippines", /\bphilippines\b/i],
  ["Vietnam", /\bvietnam\b/i],
  ["Indonesia", /\bindonesia\b/i],
  ["Thailand", /\bthailand\b/i],
  ["India", /\bindia\b/i],
  ["Australia", /\baustralia\b/i],
];
const normalize = (value: unknown) =>
  String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
const key = (value: string) => value.toLowerCase();

function queryLocationCountryAllowed(value: string, pattern: RegExp) {
  const match = value.match(pattern);
  if (!match || match.index === undefined) return false;
  const before = value.slice(Math.max(0, match.index - 40), match.index);
  const after = value.slice(match.index + match[0].length, match.index + match[0].length + 32);
  if (/^\s*(?:statutory|tax|client|project|language|speaking|experience)\b/i.test(after))
    return false;
  if (/^\s*(?:mandarin|chinese|japanese|english|malay|thai|vietnamese|korean|german|french|spanish)\b/i.test(after))
    return true;
  if (/^\s*(?:implementation|rollout|migration|integration|support|enhancement|upgrade|transformation|go-live)\b/i.test(after))
    return /\b(?:in|based\s+in|located\s+in|location\s*[:=-])\s*$/i.test(before)
      || /\bsap\s+[a-z0-9/+-]+\s*$/i.test(before);
  return /\b(?:in|based\s+in|located\s+in|location\s*[:=-])\s*$/i.test(before)
    || /\b(?:consultant|developer|architect|manager|lead|specialist)\s*$/i.test(before)
    || /^\s*(?:(?:or|,)\s*(?:malaysia|singapore|japan|philippines|vietnam|indonesia|thailand|india|australia|tokyo|osaka|kuala\s+lumpur)\s*)*$/i.test(after);
}

function parseOne(value: string, explicit: boolean): RequiredLocationAlternative[] {
  const cities = CITY_COUNTRY.filter(
    ([, , pattern]) =>
      pattern.test(value) &&
      (explicit || queryLocationCountryAllowed(value, pattern)),
  ).map(
    ([city, country]) => ({
      label: country === city ? city : `${city}, ${country}`,
      city,
      country,
    }),
  );
  const countries = COUNTRY.filter(([, pattern]) =>
    pattern.test(value) && (explicit || queryLocationCountryAllowed(value, pattern)),
  ).map(
    ([country]) => country,
  );
  const cityCountries = new Set(cities.map((item) => item.country));
  const countryAlternatives = countries
    .filter((country) => !cityCountries.has(country))
    .map((country) => ({ label: country, country }));
  return [...cities, ...countryAlternatives];
}

export function requiredLocationAlternatives(
  query: string,
  explicitLocations: string[] = [],
) {
  const alternatives = [
    ...parseOne(normalize(query), false),
    ...explicitLocations.map(normalize).filter(Boolean).flatMap((value) => parseOne(value, true)),
  ];
  const deduped = new Map<string, RequiredLocationAlternative>();
  for (const alternative of alternatives)
    deduped.set(
      `${key(alternative.city || "")}|${key(alternative.country)}`,
      alternative,
    );
  return [...deduped.values()];
}

export function requiredLocationLabels(
  query: string,
  explicitLocations: string[] = [],
) {
  return requiredLocationAlternatives(query, explicitLocations).map(
    (item) => item.label,
  );
}

export function candidateMeetsRequiredLocation(
  candidate: CandidateSearchV2Document,
  alternatives: readonly RequiredLocationAlternative[],
) {
  if (!alternatives.length) return true;
  if (candidate.locationEvidenceState !== "VERIFIED") return false;
  const currentCountry = normalize(candidate.country).toLowerCase();
  const currentLocation = normalize(candidate.location).toLowerCase();
  if (!currentCountry && !currentLocation) return false;
  return alternatives.some((required) => {
    const country = key(required.country);
    const countryMatches =
      currentCountry === country ||
      new RegExp(`(?:^|[,\\s])${country.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?:$|[,\\s])`, "i").test(
        currentLocation,
      );
    if (!countryMatches) return false;
    return required.city
      ? new RegExp(
          `\\b${key(required.city).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`,
          "i",
        ).test(currentLocation)
      : true;
  });
}

export function requiredLocationDisplay(
  alternatives: readonly RequiredLocationAlternative[],
) {
  return alternatives.map((item) => item.label).join(" or ");
}
