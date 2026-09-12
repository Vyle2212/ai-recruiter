export const EXTERNAL_TALENT_ANALYSIS_CAPABILITY_VERSION =
  "external-talent-analysis-capability-v1";

export const EXTERNAL_TALENT_ANALYSIS_MINIMUM_EVIDENCE_ITEMS = 2;
export const EXTERNAL_TALENT_ANALYSIS_MINIMUM_EVIDENCE_CHARACTERS = 48;

export type ExternalTalentAnalysisCapability = {
  version: typeof EXTERNAL_TALENT_ANALYSIS_CAPABILITY_VERSION;
  enabled: boolean;
  reason: "ready" | "mode_disabled" | "provider_not_configured";
  message: string;
  minimumEvidenceItems: number;
  minimumEvidenceCharacters: number;
};

export function externalTalentAnalysisCapability(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ExternalTalentAnalysisCapability {
  const common = {
    version: EXTERNAL_TALENT_ANALYSIS_CAPABILITY_VERSION,
    minimumEvidenceItems: EXTERNAL_TALENT_ANALYSIS_MINIMUM_EVIDENCE_ITEMS,
    minimumEvidenceCharacters:
      EXTERNAL_TALENT_ANALYSIS_MINIMUM_EVIDENCE_CHARACTERS,
  } as const;

  if (environment.EXTERNAL_TALENT_CLAUDE_MODE !== "on_demand") {
    return {
      ...common,
      enabled: false,
      reason: "mode_disabled",
      message: "AI Match Analysis is disabled for this environment.",
    };
  }

  if (!environment.ANTHROPIC_API_KEY?.trim()) {
    return {
      ...common,
      enabled: false,
      reason: "provider_not_configured",
      message: "AI Match Analysis provider is not configured.",
    };
  }

  return {
    ...common,
    enabled: true,
    reason: "ready",
    message: "AI Match Analysis is available on demand.",
  };
}

export function hasSufficientExternalTalentEvidence(
  evidence: Array<{ excerpt: string }>,
  capability = externalTalentAnalysisCapability(),
) {
  const meaningful = evidence
    .map((item) => item.excerpt.normalize("NFKC").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const characters = meaningful.reduce((total, item) => total + item.length, 0);
  return (
    meaningful.length >= capability.minimumEvidenceItems &&
    characters >= capability.minimumEvidenceCharacters
  );
}
