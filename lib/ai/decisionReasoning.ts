import type { CandidateCompareSignal, CompareDimensionKey } from "@/lib/candidateCompareEngine";

export type DecisionReasoning = {
  recommendationNarrative: string;
  decisionSummary: string[];
  candidateStrength: {
    delivery: string;
    leadership: string;
    architecture: string;
    transformation: string;
    commercial: string;
  };
  comparisonReasoning: string[];
  commercialRiskNarrative: string;
  interviewRecommendation: string[];
  clientPositioning: {
    buyingSignals: string[];
    possibleObjections: string[];
    suggestedPositioning: string;
  };
  confidenceExplanation: string;
  nextAction: string[];
  backupStrategy: string;
};

export type DecisionReasoningInput = {
  candidates: CandidateCompareSignal[];
  recommended?: CandidateCompareSignal;
  backup?: CandidateCompareSignal;
  module?: string;
  compareResult?: {
    executiveConfidence?: number;
    requirementCoverage?: number;
    commercialReadiness?: string;
  };
  decisionMatrix?: Array<{ label: string; recommended?: string; alternatives?: Array<{ candidateName: string; value: string }> }>;
  commercialValidation?: Array<{ label: string; status?: string; value?: string; action?: string }>;
  evidenceSnapshot?: {
    differentiators?: string[];
    businessImpact?: string[];
    evidence?: string[];
    risks?: Array<{ label: string; risk?: string; evidence?: string; mitigation?: string }>;
    validationNeeded?: string[];
  };
};

const DIMENSION_LABELS: Partial<Record<CompareDimensionKey, string>> = {
  implementation: "delivery ownership",
  deliveryOwnership: "programme accountability",
  technicalDepth: "technical depth",
  s4hana: "transformation relevance",
  leadership: "leadership signal",
  communication: "stakeholder confidence",
  consulting: "client-facing delivery",
  regional: "regional exposure",
  industry: "industry relevance",
  availability: "availability",
  compensation: "commercial alignment",
  risk: "delivery risk",
};

function clean(value: unknown, fallback = "Needs validation") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || /^(to confirm|unknown|not disclosed|pending validation)$/i.test(text)) return fallback;
  return text;
}

function unique(items: string[], max = items.length) {
  return Array.from(new Set(items.map((item) => clean(item, "")).filter(Boolean))).slice(0, max);
}

function sentence(value: string) {
  const text = clean(value, "Needs validation");
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function lower(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function dimensionEvidence(candidate: CandidateCompareSignal | undefined, keys: CompareDimensionKey[], fallback: string) {
  if (!candidate) return fallback;
  const evidence = keys
    .map((key) => candidate.dimensions?.[key]?.evidence)
    .filter((item) => item && !/not confirmed|unknown|validate/i.test(item));
  return sentence(evidence[0] || fallback);
}

function strongestDimension(candidate: CandidateCompareSignal | undefined, keys: CompareDimensionKey[]) {
  if (!candidate) return "evidence quality";
  const ranked = keys
    .map((key) => ({ key, value: candidate.dimensions?.[key]?.value ?? null }))
    .filter((item): item is { key: CompareDimensionKey; value: number } => typeof item.value === "number")
    .sort((a, b) => b.value - a.value);
  return DIMENSION_LABELS[ranked[0]?.key] || "evidence quality";
}

function compareDimension(recommended: CandidateCompareSignal, alternative: CandidateCompareSignal, keys: CompareDimensionKey[]) {
  const deltas = keys
    .map((key) => ({ key, delta: (recommended.dimensions?.[key]?.value ?? 0) - (alternative.dimensions?.[key]?.value ?? 0) }))
    .sort((a, b) => b.delta - a.delta);
  const strongest = deltas.find((item) => item.delta > 0);
  const weakest = deltas.find((item) => item.delta < 0);
  if (strongest) return `${DIMENSION_LABELS[strongest.key] || "validated evidence"} is more developed`;
  if (weakest) return `${DIMENSION_LABELS[weakest.key] || "validated evidence"} is less differentiated and should be validated`;
  return "the measurable evidence is close, so recruiter validation should decide the order";
}

function commercialBlockers(items: DecisionReasoningInput["commercialValidation"], validationNeeded: string[]) {
  const explicit = (items || [])
    .filter((item) => /missing|pending|confirm|required|validation/i.test(`${item.status || ""} ${item.value || ""} ${item.action || ""}`))
    .map((item) => item.label);
  return unique([...explicit, ...validationNeeded], 6);
}

function actionFor(label: string) {
  if (/salary|package|compensation/i.test(label)) return "Confirm salary and package expectations";
  if (/availability/i.test(label)) return "Confirm earliest start date";
  if (/notice/i.test(label)) return "Confirm notice period and buyout feasibility";
  if (/buyout/i.test(label)) return "Confirm buyout feasibility";
  if (/visa|work rights/i.test(label)) return "Confirm visa or work rights";
  if (/relocation|location/i.test(label)) return "Confirm location and relocation constraints";
  return `Validate ${label.toLowerCase()}`;
}

export function buildDecisionReasoning(input: DecisionReasoningInput): DecisionReasoning {
  const recommended = input.recommended || input.candidates[0];
  const backup = input.backup || input.candidates.find((candidate) => candidate.id !== recommended?.id);
  const module = clean(input.module || recommended?.module || "SAP", "SAP");
  const evidence = unique(input.evidenceSnapshot?.evidence || input.evidenceSnapshot?.differentiators || [], 5);
  const differentiators = unique(input.evidenceSnapshot?.differentiators || evidence, 4);
  const businessImpact = unique(input.evidenceSnapshot?.businessImpact || [], 4);
  const validationNeeded = unique(input.evidenceSnapshot?.validationNeeded || [], 6);
  const blockers = commercialBlockers(input.commercialValidation, validationNeeded);
  const executiveConfidence = input.compareResult?.executiveConfidence ?? recommended?.score ?? 0;
  const coverage = input.compareResult?.requirementCoverage ?? 0;
  const commercialReadiness = clean(input.compareResult?.commercialReadiness, blockers.length ? "Commercial validation required" : "Commercial position needs final recruiter confirmation");

  if (!recommended) {
    return {
      recommendationNarrative: "Needs validation before a submission decision can be formed.",
      decisionSummary: ["Select a recommended candidate before client positioning.", "Compare evidence is required before business impact can be assessed.", "Commercial validation remains open."],
      candidateStrength: { delivery: "Needs validation", leadership: "Needs validation", architecture: "Needs validation", transformation: "Needs validation", commercial: "Needs validation" },
      comparisonReasoning: ["No compared slate is available."],
      commercialRiskNarrative: "Commercial validation needs to be completed before submission.",
      interviewRecommendation: ["Validate delivery ownership", "Validate architecture accountability", "Validate stakeholder exposure", "Confirm salary", "Confirm availability"],
      clientPositioning: { buyingSignals: ["Needs validation"], possibleObjections: ["Evidence not yet confirmed"], suggestedPositioning: "Hold positioning until Compare evidence is available." },
      confidenceExplanation: "Executive confidence cannot be explained until a candidate is selected.",
      nextAction: ["Select candidate", "Review Compare evidence", "Confirm commercial blockers"],
      backupStrategy: "Backup strategy requires at least two compared candidates.",
    };
  }

  const primaryReason = differentiators[0] || dimensionEvidence(recommended, ["implementation", "deliveryOwnership"], "delivery ownership needs validation");
  const comparisonReasoning = input.candidates
    .filter((candidate) => candidate.id !== recommended.id)
    .slice(0, 4)
    .map((candidate) => `Compared with ${candidate.name}, ${recommended.name} should lead because ${compareDimension(recommended, candidate, ["implementation", "deliveryOwnership", "s4hana", "technicalDepth", "leadership", "communication", "availability", "compensation"])}.`);

  const commercialRiskNarrative = blockers.length
    ? `Commercial risk is limited to ${blockers.slice(0, 4).map((item) => item.toLowerCase()).join(", ")}. These items must be confirmed before client submission.`
    : "Commercial risk is not the current gating issue; final recruiter confirmation remains required before submission.";

  const limiter = blockers.length ? `Confidence is reduced by unresolved ${blockers.slice(0, 3).map((item) => item.toLowerCase()).join(", ")}.` : "Confidence is not materially limited by commercial blockers in the current evidence.";
  const driver = strongestDimension(recommended, ["implementation", "deliveryOwnership", "s4hana", "technicalDepth", "leadership", "communication"]);

  return {
    recommendationNarrative: `${recommended.name} is recommended as the first submission because ${lower(primaryReason)} This creates a lower-risk first interview for the SAP ${module} search. ${comparisonReasoning[0] || "No alternative candidate has been provided for calibration."} ${commercialRiskNarrative}`,
    decisionSummary: unique([
      businessImpact[0] || `${recommended.name} gives the client a clearer path to validate SAP ${module} delivery ownership before widening the slate.`,
      businessImpact[1] || `The recommendation is driven by ${driver}, not score order alone.`,
      blockers.length ? `Submission should wait until ${blockers.slice(0, 3).map((item) => item.toLowerCase()).join(", ")} are confirmed.` : "The profile can move to client review after final recruiter confirmation.",
    ], 3).map(sentence),
    candidateStrength: {
      delivery: dimensionEvidence(recommended, ["implementation", "deliveryOwnership"], "Delivery ownership needs validation."),
      leadership: dimensionEvidence(recommended, ["leadership", "communication"], "Leadership scope needs validation."),
      architecture: dimensionEvidence(recommended, ["technicalDepth"], "Architecture accountability needs validation."),
      transformation: dimensionEvidence(recommended, ["s4hana", "regional"], "Transformation relevance needs validation."),
      commercial: commercialReadiness,
    },
    comparisonReasoning: comparisonReasoning.length ? comparisonReasoning : [backup ? `Compared with ${backup.name}, ${recommended.name} remains first because the available evidence creates the more defensible submission sequence.` : "No alternative candidate has been provided for comparison."],
    commercialRiskNarrative,
    interviewRecommendation: unique([
      ...blockers.map(actionFor),
      "Validate architecture ownership",
      "Confirm programme governance accountability",
      "Clarify stakeholder and workshop exposure",
      "Test delivery ownership versus project participation",
    ], 5),
    clientPositioning: {
      buyingSignals: unique([
        ...businessImpact.slice(0, 2),
        `${coverage}% requirement coverage supports a first-review decision.`,
        `${executiveConfidence}% Executive Confidence indicates enough evidence to proceed after validation.`,
      ], 4),
      possibleObjections: unique([
        ...blockers.map((item) => `${item} is not yet confirmed`),
        ...comparisonReasoning.filter((item) => /less|validation|close/i.test(item)).slice(0, 2),
      ], 4),
      suggestedPositioning: `Position ${recommended.name} as the first SAP ${module} profile because the evidence supports ${driver}; keep commercial validation transparent rather than overselling readiness.`,
    },
    confidenceExplanation: `Executive confidence is ${executiveConfidence}% because ${driver} is supported by the Compare evidence. ${limiter}`,
    nextAction: unique([
      ...blockers.map(actionFor),
      "Prepare client submission narrative",
      "Position the recommendation around evidence, not tenure",
    ], 5),
    backupStrategy: backup
      ? `Use ${backup.name} if ${blockers.length ? "commercial validation cannot be completed in time" : "the client prioritises a different risk profile"} or if the client asks for an alternative to ${recommended.name}'s evidence profile.`
      : "Backup strategy requires a second compared candidate.",
  };
}





