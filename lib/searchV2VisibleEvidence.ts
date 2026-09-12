import { cleanCandidatePresentationText } from "./candidatePresentationText";

export function redactSearchV2VisibleEvidence(value: unknown) {
  return cleanCandidatePresentationText(value);
}

export function sanitizeSearchV2VisiblePayload<T>(value: T): T {
  if (typeof value === "string")
    return redactSearchV2VisibleEvidence(value) as T;
  if (Array.isArray(value))
    return value.map((item) => sanitizeSearchV2VisiblePayload(item)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeSearchV2VisiblePayload(item),
      ]),
    ) as T;
  return value;
}
