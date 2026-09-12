export const COMMON_MOJIBAKE_PATTERNS = [
  "\u00ef\u00bf\u00bd",
  "\ufffd",
  "\u00c2",
  "\u00c3",
  "\u00e2\u20ac",
] as const;

export function findMojibakePatterns(value: string): string[] {
  return COMMON_MOJIBAKE_PATTERNS.filter((pattern) =>
    value.includes(pattern),
  );
}

export function assertMojibakeFree(
  value: string,
  sourceLabel = "presentation source",
): void {
  const matches = findMojibakePatterns(value);
  if (matches.length) {
    throw new Error(
      `${sourceLabel} contains mojibake: ${matches
        .map((match) => JSON.stringify(match))
        .join(", ")}`,
    );
  }
}
