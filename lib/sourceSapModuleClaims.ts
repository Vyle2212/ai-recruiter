/** Tools and client industries cannot independently prove module expertise.
 * This narrows three known over-broad upload taxonomy mappings. It does not
 * turn keyword presence into verified proficiency or modify manual edits. */
export function sourceSupportsSapModuleClaim(module: unknown, source: string) {
  const key = String(module || "")
    .replace(/^SAP\s+/i, "")
    .toUpperCase();
  if (key === "ABAP")
    return /\bABAP(?:er|ers)?\b|\bAdvanced Business Application Programming\b/i.test(
      source,
    );
  if (key === "PP")
    return /\bPP\b|\bProduction Planning\b|\bMaterial(?:s)? Requirements? Planning\b/i.test(
      source,
    );
  if (key === "BASIS") {
    const technicalText = source.replace(
      /\b(?:(?:on|in)\s+(?:a\s+)?)?(?:daily|weekly|monthly|regular|ongoing|part.time|full.time|contract|case.by.case)\s+basis\b/gi,
      "",
    );
    return /\bBASIS\b|\b(?:SAP|HANA)\s+(?:system|database|DB)\s+administration\b|\bNetWeaver\s+(?:administrator|administration|admin)\b/i.test(
      technicalText,
    );
  }
  return true;
}
