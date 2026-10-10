/** Tools and client industries cannot independently prove module expertise.
 * This narrows known over-broad upload taxonomy mappings. It does not
 * turn keyword presence into verified proficiency or modify manual edits. */
export function sourceSupportsSapModuleClaim(module: unknown, source: string) {
  const key = String(module || "")
    .replace(/^SAP\s+/i, "")
    .toUpperCase();
  if (key === "TM")
    return source
      .split(/[\n;]/)
      .some(
        (segment) =>
          /\b(?:transportation|transport) management\b/i.test(segment) ||
          (/\bSAP\s+TM\b/i.test(segment) &&
            !/\btalent management\b/i.test(segment)),
      );
  if (key === "FSCM") {
    if (
      /\b(?:FSCM|Financial Supply Chain Management|UKM000|UKM_BP)\b/i.test(
        source,
      )
    )
      return true;
    return source
      .split(/[\n;]/)
      .some(
        (segment) =>
          /\b(?:SAP|S\/?4HANA)\b/i.test(segment) &&
          (/\b(?:collections management|dispute management|biller direct|credit segments?)\b/i.test(
            segment,
          ) ||
            (/\bS\/?4HANA\b/i.test(segment) &&
              /\bcredit management\b/i.test(segment))),
      );
  }
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
