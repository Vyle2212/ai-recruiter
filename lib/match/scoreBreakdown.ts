export type ScoreBreakdownKey =
  | "primaryModule"
  | "experience"
  | "implementation"
  | "s4hana"
  | "consulting"
  | "certification"
  | "keywords"
  | "bonus"
  | "penalty";

export type ScoreBreakdownItem = {
  key: ScoreBreakdownKey;
  label: string;
  value: number;
  detail: string;
  tone: "positive" | "neutral" | "negative";
};

export type ScoreBreakdownInput = {
  baseScore: number;
  years: number;
  implementation: number;
  rollout: number;
  s4: number;
  ams: number;
  quality: number;
  consultingLevel?: string;
  consultingCompanies?: string[];
  certifications?: string[];
  keywordTerms?: string[];
  matchedTokens?: string[];
  moduleMatchType?: string;
};

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function list(values: any[] | undefined, fallback: string) {
  const clean = (values || []).map((value) => String(value || "").trim()).filter(Boolean);
  return clean.length ? clean.slice(0, 4).join(", ") : fallback;
}

export function buildScoreBreakdown(input: ScoreBreakdownInput): ScoreBreakdownItem[] {
  const years = n(input.years);
  const implementation = n(input.implementation);
  const rollout = n(input.rollout);
  const s4 = n(input.s4);
  const ams = n(input.ams);
  const quality = n(input.quality);
  const experienceBoost = (years >= 8 ? 1 : 0) + (years >= 15 ? 1 : 0);
  const implementationBoost = implementation > 0 ? 1 : 0;
  const s4Boost = s4 > 0 ? 1 : 0;
  const deliveryBonus = rollout > 0 ? 1 : 0;
  const qualityPenalty = quality < 70 ? -6 : quality < 80 ? -3 : 0;
  const evidencePenalty = implementation <= 0 && rollout <= 0 && s4 <= 0 && ams <= 0 ? -5 : 0;
  const penalty = qualityPenalty + evidencePenalty;

  return [
    {
      key: "primaryModule",
      label: "Primary Module",
      value: Math.min(96, Math.max(55, Math.round(n(input.baseScore)))),
      detail: input.moduleMatchType || "Module evidence matched the search intent.",
      tone: "positive",
    },
    {
      key: "experience",
      label: "Experience",
      value: experienceBoost,
      detail: years ? `${years} years SAP experience.` : "Experience not confirmed.",
      tone: experienceBoost > 0 ? "positive" : "neutral",
    },
    {
      key: "implementation",
      label: "Implementation",
      value: implementationBoost,
      detail: implementation ? `${implementation} implementation project${implementation === 1 ? "" : "s"}.` : "No implementation count in the indexed profile.",
      tone: implementationBoost > 0 ? "positive" : "neutral",
    },
    {
      key: "s4hana",
      label: "S/4HANA",
      value: s4Boost,
      detail: s4 ? `${s4} S/4HANA project${s4 === 1 ? "" : "s"}.` : "No S/4HANA count in the indexed profile.",
      tone: s4Boost > 0 ? "positive" : "neutral",
    },
    {
      key: "consulting",
      label: "Consulting",
      value: input.consultingLevel || (input.consultingCompanies || []).length ? 1 : 0,
      detail: input.consultingLevel || list(input.consultingCompanies, "Consulting background not confirmed."),
      tone: input.consultingLevel || (input.consultingCompanies || []).length ? "positive" : "neutral",
    },
    {
      key: "certification",
      label: "Certification",
      value: (input.certifications || []).length ? 1 : 0,
      detail: list(input.certifications, "Certification evidence not confirmed."),
      tone: (input.certifications || []).length ? "positive" : "neutral",
    },
    {
      key: "keywords",
      label: "Keywords",
      value: (input.keywordTerms || []).length || (input.matchedTokens || []).length ? 1 : 0,
      detail: list([...(input.keywordTerms || []), ...(input.matchedTokens || [])], "No extra keyword terms required."),
      tone: (input.keywordTerms || []).length || (input.matchedTokens || []).length ? "positive" : "neutral",
    },
    {
      key: "bonus",
      label: "Bonus",
      value: deliveryBonus,
      detail: rollout ? `${rollout} rollout project${rollout === 1 ? "" : "s"}.` : "No rollout bonus applied.",
      tone: deliveryBonus > 0 ? "positive" : "neutral",
    },
    {
      key: "penalty",
      label: "Penalty",
      value: penalty,
      detail: penalty < 0 ? [qualityPenalty < 0 ? "Quality calibration" : "", evidencePenalty < 0 ? "Delivery evidence gap" : ""].filter(Boolean).join("; ") : "No penalty applied.",
      tone: penalty < 0 ? "negative" : "neutral",
    },
  ];
}