const REDACTION_PLACEHOLDER =
  /(?:\[|\(|\{)?\s*(?:phone|mobile|email|e-mail|contact)\s+(?:number\s+)?redacted\s*(?:\]|\)|\})?/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_CANDIDATE = /(?<!\w)\+?(?:\d[\s().-]*){7,15}(?!\w)/g;
const YEAR_RANGE =
  /^\s*(?:19|20)\d{2}\s*(?:[-\u2013\u2014/]|to)\s*(?:19|20)\d{2}\s*$/i;
const UNSUPPORTED_PRESENTATION_GLYPHS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u2060\uFEFF\uFFFD]/g;
const SOURCE_BULLET = /[\u2022\u2023\u2043\u2219\u25AA\u25AB\u25CF\u25E6]/g;
const ENCODING_BOX = /[\u25A0\u25A1]/g;
const PRIVATE_USE_GLYPH = /[\uE000-\uF8FF]/g;
const MOJIBAKE_BULLET =
  /(?:\u00E2\u20AC\u00A2|\u00E2\u2013[\u00A0\u00A1]|\u00EF\u201A[\u00A4\u00B7]|\u00EF\u0192\u02DC)/g;
const ISOLATED_ZERO_BULLET = /^\s*0[\p{Z}\p{Cf}\p{Cc}]+(?=\p{L})/u;
const DUPLICATED_TERMINAL_FULL_STOP = /(?<!\.)\.\.$/;

function cleanEdges(value: string) {
  return value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/(?:\s*[|;,/]\s*)+$/g, "")
    .replace(/\s+(?:[-\u2013\u2014]\s*)+$/g, "")
    .replace(/^[\s,;|]+|[\s,;|]+$/g, "")
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneLike(value: string) {
  if (YEAR_RANGE.test(value)) return false;
  if ((value.match(/\b(?:19|20)\d{2}\b/g) || []).length >= 2) return false;
  const digits = value.replace(/\D/g, "");
  const groups = value.trim().replace(/^\+/, "").split(/\D+/).filter(Boolean);
  return (
    digits.length >= 9 ||
    (value.trim().startsWith("+") && digits.length >= 7) ||
    (digits.length >= 7 &&
      groups.length >= 3 &&
      !groups.every((group) => group.length === 4))
  );
}

export function cleanCandidatePresentationText(value: unknown) {
  return cleanEdges(
    String(value ?? "")
      .normalize("NFKC")
      .replace(UNSUPPORTED_PRESENTATION_GLYPHS, " ")
      .replace(PRIVATE_USE_GLYPH, " ")
      .replace(MOJIBAKE_BULLET, " ")
      .replace(REDACTION_PLACEHOLDER, " ")
      .replace(EMAIL, " ")
      .replace(PHONE_CANDIDATE, (candidate) =>
        phoneLike(candidate) ? " " : candidate,
      ),
  );
}

export function cleanCandidatePresentationEntity(value: unknown) {
  return cleanCandidatePresentationText(value)
    .replace(/(?:\s*[/,;|]\s*)+$/g, "")
    .replace(/\s+(?:[-\u2013\u2014]\s*)+$/g, "")
    .trim();
}

export function splitCandidatePresentationSegments(values: readonly unknown[]) {
  const segments = values.flatMap((input) =>
    String(input ?? "")
      .normalize("NFKC")
      .replace(SOURCE_BULLET, "\n")
      .replace(ENCODING_BOX, "\n")
      .replace(PRIVATE_USE_GLYPH, "\n")
      .replace(MOJIBAKE_BULLET, "\n")
      .replace(UNSUPPORTED_PRESENTATION_GLYPHS, "\n")
      .split(/\r?\n|(?<!\d\.)(?<=[.!?])\s+(?=(?:0\s+)?[A-Z])/),
  );

  return segments
    .map((segment) =>
      cleanCandidatePresentationText(
        segment
          .replace(/^\s*[-*]+\s+/, "")
          .replace(ISOLATED_ZERO_BULLET, "")
          .replace(DUPLICATED_TERMINAL_FULL_STOP, "."),
      ),
    )
    .filter((segment) => Boolean(segment) && segment !== "0");
}

export function cleanCandidateProjectResponsibilities(
  values: readonly unknown[],
) {
  const bullets = splitCandidatePresentationSegments(values).flatMap(
    (input) => {
      let source = input;
      const detailBoundary = source.search(
        /\b(?:Specific\s+Responsibilities|Responsibilities|Highlights)(?:\s*[:(]|\s+(?=Role\b|Report\b|Provided\b|Led\b|Handled\b|Assist\b|Responsible\b))/i,
      );
      if (detailBoundary >= 0)
        source = source
          .slice(detailBoundary)
          .replace(
            /^(?:Specific\s+Responsibilities|Responsibilities|Highlights)\s*(?:\([^)]*\))?\s*:*/i,
            "",
          )
          .trim();
      return source
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map((value) =>
          cleanCandidatePresentationText(
            value.replace(
              /^(?:Company|Employer|Position|Role|Client|Project(?:\s+Description)?|Duration)\s*[:\u2013\u2014-]\s*[^.!?]*[.!?]?\s*/i,
              "",
            ),
          )
            .replace(ISOLATED_ZERO_BULLET, "")
            .replace(DUPLICATED_TERMINAL_FULL_STOP, ".")
            .trim(),
        )
        .filter(
          (value) =>
            value.length >= 3 &&
            /\p{L}/u.test(value) &&
            !/^(?:Company|Employer|Position|Client|Project|Duration)\s*[:\u2013\u2014-]/i.test(
              value,
            ) &&
            !/\b(?:Company|Employer|Position|Client)\s*[:\u2013\u2014-]/i.test(
              value,
            ),
        );
    },
  );
  return [
    ...new Map(
      bullets.map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
}

export type CandidatePresentationResponsibilityIssue =
  | "empty"
  | "delimiter_glyph"
  | "unsupported_character"
  | "isolated_zero_marker"
  | "duplicated_terminal_full_stop";

export function candidatePresentationResponsibilityIssues(value: unknown) {
  const text = String(value ?? "");
  const issues: CandidatePresentationResponsibilityIssue[] = [];
  if (!text.trim()) issues.push("empty");
  if (
    new RegExp(SOURCE_BULLET.source).test(text) ||
    new RegExp(ENCODING_BOX.source).test(text) ||
    new RegExp(PRIVATE_USE_GLYPH.source).test(text) ||
    new RegExp(MOJIBAKE_BULLET.source).test(text)
  )
    issues.push("delimiter_glyph");
  if (new RegExp(UNSUPPORTED_PRESENTATION_GLYPHS.source).test(text))
    issues.push("unsupported_character");
  if (ISOLATED_ZERO_BULLET.test(text)) issues.push("isolated_zero_marker");
  if (DUPLICATED_TERMINAL_FULL_STOP.test(text.trim()))
    issues.push("duplicated_terminal_full_stop");
  return issues;
}

export function hasUnsupportedCandidatePresentationText(value: unknown) {
  const text = String(value ?? "");
  const phoneCandidates = text.match(PHONE_CANDIDATE) || [];
  return (
    new RegExp(REDACTION_PLACEHOLDER.source, "i").test(text) ||
    new RegExp(EMAIL.source, "i").test(text) ||
    phoneCandidates.some(phoneLike) ||
    new RegExp(UNSUPPORTED_PRESENTATION_GLYPHS.source).test(text) ||
    new RegExp(ENCODING_BOX.source).test(text) ||
    new RegExp(PRIVATE_USE_GLYPH.source).test(text) ||
    new RegExp(MOJIBAKE_BULLET.source).test(text)
  );
}
