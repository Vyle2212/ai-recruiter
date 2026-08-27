import { createHash } from "node:crypto";

export type GuidedSourceSegment = {
  id: string;
  sourceFingerprint: string;
  order: number;
  start: number;
  end: number;
  original: string;
  normalized: string;
  pageNumber?: number;
};
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/([\p{L}\p{N}])-\s*\r?\n\s*(?=[\p{L}\p{N}])/gu, "$1")
    .replace(/[•◦▪●‣·]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
export const guidedSourceFingerprint = (source: string) =>
  createHash("sha256").update(source).digest("hex").slice(0, 12);

export function buildGuidedSourceSegments(
  source: string,
): GuidedSourceSegment[] {
  const fingerprint = guidedSourceFingerprint(source),
    boundaries: Array<{ start: number; end: number }> = [];
  const blocks = /[^\r\n]+(?:\r?\n(?!\s*(?:[-*•◦▪●‣]|\d+[.)])\s)[^\r\n]+)*/g;
  let match: RegExpExecArray | null;
  while ((match = blocks.exec(source))) {
    const raw = match[0],
      base = match.index;
    for (let offset = 0; offset < raw.length; offset += 700) {
      let end = Math.min(raw.length, offset + 700);
      if (end < raw.length) {
        const breakAt = raw.lastIndexOf(" ", end);
        if (breakAt > offset + 250) end = breakAt;
      }
      boundaries.push({ start: base + offset, end: base + end });
      offset = end - 700;
    }
  }
  return boundaries
    .map((span, order) => {
      const original = source.slice(span.start, span.end).trim(),
        leading = source.slice(span.start, span.end).indexOf(original),
        start = span.start + Math.max(0, leading),
        end = start + original.length;
      return {
        id: `S${String(order + 1).padStart(3, "0")}-${fingerprint.slice(0, 6)}`,
        sourceFingerprint: fingerprint,
        order,
        start,
        end,
        original,
        normalized: normalize(original),
      };
    })
    .filter((segment) => segment.original.length > 0);
}

export function formatGuidedSegmentsForPrompt(segments: GuidedSourceSegment[]) {
  return segments
    .map((segment) => `[${segment.id}] ${segment.original}`)
    .join("\n");
}
export function resolveGuidedEvidenceSegments(
  ids: unknown,
  segments: GuidedSourceSegment[],
) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 4)
    return { ok: false as const, code: "missing_evidence_segments" };
  const index = new Map(segments.map((segment) => [segment.id, segment])),
    resolved: GuidedSourceSegment[] = [];
  for (const raw of ids) {
    const id = String(raw ?? "").trim(),
      segment = index.get(id);
    if (!segment)
      return { ok: false as const, code: "invalid_evidence_segment_id" };
    if (!resolved.includes(segment)) resolved.push(segment);
  }
  return { ok: true as const, segments: resolved };
}
const STOP = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "to",
  "for",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "including",
  "experience",
  "knowledge",
  "prior",
  "hands",
  "business",
  "requirements",
  "requirement",
  "consultant",
  "senior",
]);
export function guidedCriterionSupportedBySegments(
  value: string,
  segments: GuidedSourceSegment[],
) {
  const evidence = normalize(
      segments.map((segment) => segment.original).join(" "),
    ),
    tokens = [
      ...new Set(
        normalize(value)
          .split(/[^\p{L}\p{N}+#/.-]+/u)
          .filter((token) => token.length > 1 && !STOP.has(token)),
      ),
    ];
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => evidence.includes(token));
  return matched.length >= Math.min(2, tokens.length);
}
