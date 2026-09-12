import registry from "../data/search-v2-public-identity-tokens.json";

export const SEARCH_V2_PUBLIC_IDENTITY_VERSION =
  "search-v2-public-identity-token-registry-v2-source-token-lookup";

type RegistryEntry = Readonly<{
  sourcePersonIds: readonly string[];
  token: string;
  aliases: readonly string[];
}>;

const token = (value: unknown) => {
  const suffix = String(value || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase();
  return `#${suffix || "UNKNOWN"}`;
};

const normalizedToken = (value: unknown) => {
  const suffix = String(value || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return suffix ? `#${suffix}` : "";
};

const entries = (registry.entries as RegistryEntry[]).filter(
  (entry) =>
    normalizedToken(entry.token) === entry.token &&
    entry.sourcePersonIds.length > 0,
);

export function sourcePersonIdsForPublicIdentityToken(requested: unknown) {
  const normalized = normalizedToken(requested);
  if (!normalized) return null;
  const matches = entries.filter(
    (entry) => entry.token === normalized || entry.aliases.includes(normalized),
  );
  if (matches.length !== 1) return null;
  return [...new Set(matches[0].sourcePersonIds.map(String).filter(Boolean))];
}

export function publicIdentityTokensFor(
  candidateIds: readonly unknown[],
): Readonly<{ token: string; aliases: readonly string[]; persisted: boolean }> {
  const ids = new Set(candidateIds.map(String).filter(Boolean));
  const matches = entries.filter((entry) =>
    entry.sourcePersonIds.some((sourceId) => ids.has(sourceId)),
  );
  const canonicalTokens = [...new Set(matches.map((entry) => entry.token))];
  // A registry collision is an unsafe migration. Fail closed to the immutable
  // source-derived token instead of choosing one published identity at random.
  if (canonicalTokens.length !== 1) {
    return {
      token: token([...ids].sort()[0]),
      aliases: [],
      persisted: false,
    };
  }
  return {
    token: canonicalTokens[0],
    aliases: [
      ...new Set(
        matches
          .flatMap((entry) => entry.aliases)
          .filter((alias) => alias !== canonicalTokens[0]),
      ),
    ].sort(),
    persisted: true,
  };
}

export function resolvePublicIdentityToken(
  requested: unknown,
  candidateIds: readonly unknown[],
) {
  const normalized = normalizedToken(requested);
  if (!normalized) return false;
  const identity = publicIdentityTokensFor(candidateIds);
  if (identity.persisted)
    return (
      identity.token === normalized || identity.aliases.includes(normalized)
    );
  // Unregistered public tokens are derived from immutable source-person IDs,
  // never from a mutable canonical merge ID. A nameless profile therefore
  // remains directly retrievable after normalization and deduplication.
  const sourceTokens = candidateIds
    .map(String)
    .filter((id) => id && !id.startsWith("canonical-"))
    .map(token);
  return sourceTokens.includes(normalized);
}
