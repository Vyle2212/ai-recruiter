export function hasUsableEvidence(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(hasUsableEvidence);
  if (typeof value === "object") {
    const metadataOnlyKeys = new Set(["id", "sourceRef", "sourceType", "provenance", "evidenceState", "confidence", "extractedAt", "confirmedAt"]);
    return Object.entries(value as Record<string, unknown>)
      .some(([key, nested]) => !metadataOnlyKeys.has(key) && hasUsableEvidence(nested));
  }
  return false;
}
