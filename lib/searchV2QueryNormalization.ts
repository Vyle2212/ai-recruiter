export const SEARCH_V2_QUERY_NORMALIZATION_VERSION =
  "search-v2-query-normalization-v2-stable-edge-cleanup";

export type SearchV2StructuredQueryField =
  "candidate" | "name" | "title" | "company" | "location" | "skill";

export type SearchV2QueryNormalization = Readonly<{
  version: typeof SEARCH_V2_QUERY_NORMALIZATION_VERSION;
  rawQuery: string;
  normalizedQuery: string;
  canonicalKey: string;
  structuredField: SearchV2StructuredQueryField | null;
}>;

const INVISIBLE_OR_CONTROL =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u2060\uFEFF]/g;
const OUTER_SYMBOLS = /[\p{Extended_Pictographic}\p{So}\p{Sk}\uFE0F\u200D]/u;
const OUTER_DECORATION = /[*_~|]/u;
const STRUCTURED_FIELD =
  /^(candidate|name|title|company|location|skill)\s*:\s*(\S[\s\S]*)$/iu;
const SEARCH_FOR = /^search\s+for\s+(\S[\s\S]*)$/iu;

const wrapperPairs: ReadonlyArray<readonly [string, string]> = [
  ["\u201c", "\u201d"],
  ["\u2018", "\u2019"],
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
];

function compactWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function stripOuterSymbols(value: string) {
  const characters = Array.from(value);
  const harmless = (character: string) =>
    !character.trim() ||
    OUTER_SYMBOLS.test(character) ||
    OUTER_DECORATION.test(character);
  while (characters.length && harmless(characters[0])) characters.shift();
  while (characters.length && harmless(characters[characters.length - 1]))
    characters.pop();
  return compactWhitespace(characters.join(""));
}

function unwrapBalanced(value: string) {
  let result = compactWhitespace(value);
  for (let depth = 0; depth < 4; depth += 1) {
    const pair = wrapperPairs.find(
      ([left, right]) =>
        result.length >= 2 && result.startsWith(left) && result.endsWith(right),
    );
    if (!pair) break;
    result = compactWhitespace(result.slice(pair[0].length, -pair[1].length));
  }
  return result;
}

function normalizeQueryEdges(value: string) {
  let result = compactWhitespace(value);

  // Edge decorations can be nested (for example `(\"Name:.\")`) and control
  // characters can turn a punctuation run into `: .`. Iterate the complete
  // edge operation to a fixed point instead of removing one punctuation class
  // at a time and leaving an earlier character behind.
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const previous = result;
    result = unwrapBalanced(result);
    result = stripOuterSymbols(result);
    result = compactWhitespace(
      result.replace(/^[,:;!?]+/u, "").replace(/[\s,:;.!?]+$/u, ""),
    );
    result = unwrapBalanced(result);
    result = stripOuterSymbols(result);
    if (result === previous) break;
  }

  return result;
}

export function normalizeSearchV2Query(
  input: unknown,
): SearchV2QueryNormalization {
  const rawQuery = String(input ?? "");
  let normalizedQuery = compactWhitespace(
    rawQuery.normalize("NFKC").replace(INVISIBLE_OR_CONTROL, " "),
  );
  normalizedQuery = normalizeQueryEdges(normalizedQuery);

  let structuredField: SearchV2StructuredQueryField | null = null;
  const structured = normalizedQuery.match(STRUCTURED_FIELD);
  if (structured) {
    structuredField =
      structured[1].toLocaleLowerCase() as SearchV2StructuredQueryField;
    normalizedQuery = structured[2];
  } else {
    const naturalPrefix = normalizedQuery.match(SEARCH_FOR);
    if (naturalPrefix) normalizedQuery = naturalPrefix[1];
  }

  normalizedQuery = normalizeQueryEdges(normalizedQuery);
  if (!/[\p{L}\p{N}]/u.test(normalizedQuery)) normalizedQuery = "";

  return {
    version: SEARCH_V2_QUERY_NORMALIZATION_VERSION,
    rawQuery,
    normalizedQuery,
    canonicalKey: normalizedQuery.toLocaleLowerCase(),
    structuredField,
  };
}

export function canonicalSearchV2QueryKey(input: unknown) {
  return normalizeSearchV2Query(input).canonicalKey;
}
