const PRIVATE_HOST =
  /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

export function validateExternalProfileUrl(value: unknown) {
  try {
    if (typeof value !== "string") return null;
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      PRIVATE_HOST.test(url.hostname) ||
      !url.hostname.includes(".")
    )
      return null;
    url.hash = "";
    return {
      url: url.toString(),
      domain: url.hostname.toLowerCase().replace(/^www\./, ""),
    };
  } catch {
    return null;
  }
}

export function validateExternalPersonProfileUrl(
  value: unknown,
  hasGroundedPersonIdentity: boolean,
) {
  const validated = validateExternalProfileUrl(value);
  if (!validated) return null;
  const url = new URL(validated.url);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const linkedinHost = hostname === "linkedin.com";
  const linkedinOwnedHost = linkedinHost || hostname.endsWith(".linkedin.com");
  if (linkedinOwnedHost) {
    if (!linkedinHost) return null;
    if (!/^\/in\/[A-Za-z0-9_%.-]+\/?$/i.test(url.pathname)) return null;
    return validated;
  }
  return hasGroundedPersonIdentity ? validated : null;
}

export function externalProfileActionLabel(url: string) {
  return validateExternalPersonProfileUrl(url, true)?.domain === "linkedin.com"
    ? "View on LinkedIn"
    : "View source profile";
}
