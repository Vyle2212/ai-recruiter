export function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeModule(value: any): string {
  return String(value || "").trim().toUpperCase();
}

export function getFinalClientReady(match: any): boolean {
  const d = match?.details || match || {};
  const score = safeNumber(match?.score ?? d?.score ?? d?.clientScore);
  const quality = safeNumber(d?.profileQualityScore);
  const moduleFit = safeNumber(d?.moduleFit ?? d?.roleFit);
  const primaryAuthority = safeNumber(
    d?.primaryModuleAuthority ?? d?.moduleAuthorityGate ?? d?.moduleAuthority
  );
  const implementationAuthority = safeNumber(d?.implementationAuthority);
  const roleDepth = safeNumber(d?.roleComplexity ?? d?.financeDepth);
  const hasContact = Boolean(d?.email || d?.phone || match?.email || match?.phone);
  const primaryModule = normalizeModule(d?.primaryModule ?? match?.primaryModule);
  const requiredModule = normalizeModule(d?.requiredModule ?? match?.requiredModule);
  const years = safeNumber(d?.years ?? match?.years);
  const requiredYears = safeNumber(d?.requiredYears ?? match?.requiredYears);
  const gaps = [
    ...(Array.isArray(match?.gaps) ? match.gaps : []),
    ...(Array.isArray(d?.gaps) ? d.gaps : []),
    ...(Array.isArray(d?.riskFlags) ? d.riskFlags : []),
  ].map((x) => String(x || "").toLowerCase());

  // V37: allow explicit backend auto-pass for direct BTP profiles that pass the hard readiness gate.
  // This prevents generic moduleFit thresholds from blocking direct BTP candidates when the role is BTP.
  if (
    d?.btpReadyPoolAutoPass === true &&
    score >= 90 &&
    primaryModule === "BTP" &&
    requiredModule === "BTP" &&
    implementationAuthority >= 80 &&
    roleDepth >= 75 &&
    primaryAuthority >= 80 &&
    hasContact &&
    d?.contactMissing !== true &&
    d?.nameReviewRequired !== true
  ) {
    return true;
  }

  if (d?.clientGatePass === false || d?.passesClientGate === false || d?.finalClientReady === false) return false;
  if (d?.contactMissing === true || d?.nameReviewRequired === true) return false;
  if (gaps.some((g) =>
    g.includes("client-ready gate:") ||
    g.includes("primary module lock:") ||
    g.includes("contact details require recruiter confirmation") ||
    g.includes("contact information needs validation") ||
    g.includes("missing contact details")
  )) return false;

  const directPrimaryModuleRequired = Boolean(requiredModule);
  const directPrimaryModulePass = !directPrimaryModuleRequired || primaryModule === requiredModule;

  return Boolean(
    score >= 85 &&
      quality >= 80 &&
      moduleFit >= 78 &&
      primaryAuthority >= 75 &&
      implementationAuthority >= 75 &&
      roleDepth >= 75 &&
      hasContact &&
      directPrimaryModulePass &&
      (!requiredYears || years >= requiredYears)
  );
}

export function getMatchStatusLabel(match: any): "Client Ready" | "Recruiter Review" {
  return getFinalClientReady(match) ? "Client Ready" : "Recruiter Review";
}

export function stampFinalClientReady(match: any): any {
  const ready = getFinalClientReady(match);
  const label = ready ? "Client Ready" : "Recruiter Review";
  const d = match?.details || match || {};
  d.clientReady = ready;
  d.isClientReady = ready;
  d.client_ready = ready;
  d.finalClientReady = ready;
  d.passesClientGate = ready;
  d.clientGatePass = ready;
  d.clientSafe = ready;
  d.clientTier = ready ? (d.clientTier && d.clientTier !== "Review" ? d.clientTier : "A") : "Review";
  d.status = label;
  d.recommendation = label;
  d.displayStatus = label;
  d.badgeLabel = label;
  d.clientStatus = label;
  d.reviewStatus = label;
  // V29: one source of truth for Strong Match.
  d.strongMatch = ready;
  d.isStrongMatch = ready;
  if (match?.details) match.details = d;
  return match;
}

export function getRoleComplexityLabel(details: any): string {
  return (
    details?.complexityDisplayLabel ||
    details?.roleComplexityLabel ||
    details?.engineDepthLabel ||
    details?.financeDepthLabel ||
    details?.complexityLabel ||
    "Role Complexity"
  );
}
