export type MatchConfidence = {
  score: number;
  label: "High" | "Medium" | "Low";
  factors: string[];
};

export type ConfidenceInput = {
  searchFit: number;
  quality: number;
  contactable: boolean;
  primaryModuleMatched: boolean;
  years: number;
  implementation: number;
  s4: number;
  keywordMatched: boolean;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateConfidence(input: ConfidenceInput): MatchConfidence {
  const factors: string[] = [];
  let score = 45;

  if (input.primaryModuleMatched) {
    score += 20;
    factors.push("Primary module is aligned");
  }
  if (input.searchFit >= 90) {
    score += 10;
    factors.push("High Search Fit");
  }
  if (input.quality >= 85) {
    score += 8;
    factors.push("Strong profile quality");
  } else if (input.quality < 75) {
    score -= 8;
    factors.push("Profile quality needs review");
  }
  if (input.contactable) {
    score += 5;
    factors.push("Contact data available");
  }
  if (input.years >= 5) {
    score += 4;
    factors.push("Experience evidence present");
  }
  if (input.implementation > 0 || input.s4 > 0) {
    score += 6;
    factors.push("Delivery evidence present");
  }
  if (input.keywordMatched) {
    score += 2;
    factors.push("Keyword evidence matched");
  }

  const finalScore = clamp(score);
  return {
    score: finalScore,
    label: finalScore >= 80 ? "High" : finalScore >= 60 ? "Medium" : "Low",
    factors,
  };
}