export type BigCorpRankingInput = {
  requiredModule?: string;
  requiredYears?: number;
  score?: number;
  years?: number;
  primaryModule?: string;
  secondaryModules?: string[];
  moduleAuthority?: number;
  implementationAuthority?: number;
  financeDepth?: number;
  consultingDNA?: number;
  profileQualityScore?: number;
  implementationProjects?: number;
  rolloutProjects?: number;
  amsProjects?: number;
  s4hanaProjects?: number;
  eccProjects?: number;
  title?: string;
  company?: string;
  contactMissing?: boolean;
  nameReviewRequired?: boolean;
  confidence?: string;
};

export type BigCorpRankingResult = {
  calibratedScore: number;
  clientScore: number;
  percentileScore: number;
  clientTier: "A+" | "A" | "B" | "Review";
  clientReady: boolean;
  recommendationSummary: string;
  recommendationBullets: string[];
  riskFlags: string[];
  rankingBreakdown: {
    moduleFit: number;
    projectAuthority: number;
    financeDepth: number;
    consultingDNA: number;
    experience: number;
    quality: number;
  };
};

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function includesAny(value: any, words: string[]) {
  const text = String(value || "").toUpperCase();
  return words.some((w) => text.includes(w.toUpperCase()));
}

function normalizeModule(value: any) {
  return String(value || "").toUpperCase().replace(/\s+/g, "");
}

export function calculateFinanceDepthV2(input: BigCorpRankingInput) {
  const title = String(input.title || "");
  const secondary = (input.secondaryModules || []).map((m) => String(m).toUpperCase());
  const base = n(input.financeDepth);

  const has = (token: string) =>
    secondary.includes(token) ||
    title.toUpperCase().includes(token) ||
    title.toUpperCase().includes(token.replace("_", " "));

  let score = 18;

  // Basic FICO depth
  if (has("GL")) score += 8;
  if (has("AP")) score += 7;
  if (has("AR")) score += 7;
  if (has("AA")) score += 7;

  // Senior finance depth
  if (has("COPA") || has("CO-PA")) score += 10;
  if (has("FSCM")) score += 11;
  if (has("TRM") || includesAny(title, ["Treasury"])) score += 11;

  // Transformation / architect depth
  if (has("CFIN") || includesAny(title, ["Central Finance"])) score += 13;
  if (has("GROUP_REPORTING") || includesAny(title, ["Group Reporting", "Consolidation"])) score += 11;
  if (includesAny(title, ["Finance Transformation", "Template", "Global Rollout"])) score += 10;

  const uniqueFinance = ["GL", "AP", "AR", "AA", "COPA", "FSCM", "TRM", "CFIN", "GROUP_REPORTING"]
    .filter((token) => has(token)).length;

  if (uniqueFinance >= 3) score += 6;
  if (uniqueFinance >= 5) score += 6;
  if (uniqueFinance >= 7) score += 4;

  // Blend with parser finance depth, but cap keyword-only inflation.
  score = Math.round(score * 0.65 + base * 0.35);

  if (uniqueFinance <= 1) score = Math.min(score, 58);
  if (uniqueFinance <= 2) score = Math.min(score, 72);
  if (uniqueFinance >= 5) score = Math.max(score, 80);

  return clamp(score, 15, 96);
}

export function calculateProjectAuthorityV2(input: BigCorpRankingInput) {
  const impl = n(input.implementationProjects);
  const rollout = n(input.rolloutProjects);
  const ams = n(input.amsProjects);
  const s4 = n(input.s4hanaProjects);
  const ecc = n(input.eccProjects);
  const base = n(input.implementationAuthority);

  let score = 22;
  score += Math.min(impl, 8) * 5.5;
  score += Math.min(Math.max(impl - 8, 0), 8) * 1.8;
  score += Math.min(rollout, 6) * 3.2;
  score += Math.min(s4, 6) * 3.0;
  score += Math.min(ecc, 5) * 1.2;
  score += Math.min(ams, 10) * 0.6;

  if (impl === 0) score = Math.min(score, 42);
  if (impl === 1) score = Math.min(score, 58);
  if (impl === 2) score = Math.min(score, 68);
  if (impl <= 3 && ams >= 8) score = Math.min(score, 74);
  if (impl >= 5 && s4 >= 3) score += 5;
  if (impl >= 8) score += 5;
  if (impl >= 12) score += 3;

  // Use previous parser score only as supporting signal, not hard ceiling.
  score = Math.round(score * 0.78 + base * 0.22);

  return clamp(score, 15, 96);
}

export function calculateConsultingDNAV2(input: BigCorpRankingInput) {
  const title = String(input.title || "");
  const company = String(input.company || "");
  const base = n(input.consultingDNA);

  const firmSignals = [
    "PWC", "DELOITTE", "EY", "KPMG", "ACCENTURE", "IBM", "CAPGEMINI",
    "NTT", "CBS", "CORPORATE BUSINESS SOLUTIONS", "INFOSYS", "TCS",
    "WIPRO", "DXC", "ATOS", "FUJITSU", "BEARINGPOINT"
  ];

  const deliverySignals = [
    "WORKSHOP", "BLUEPRINT", "FIT-GAP", "FIT GAP", "CUTOVER", "HYPERCARE",
    "GO-LIVE", "GO LIVE", "TEMPLATE", "GLOBAL ROLLOUT", "SOLUTION DESIGN",
    "SAP ACTIVATE", "PRESALES", "RFP", "PROPOSAL"
  ];

  let score = 40;
  if (includesAny(company, firmSignals) || includesAny(title, firmSignals)) score += 18;
  if (includesAny(title, ["MANAGER", "LEAD", "ARCHITECT", "WORK STREAM"])) score += 10;
  if (includesAny(title, deliverySignals)) score += 12;

  score += Math.min(n(input.rolloutProjects), 5) * 2.2;
  score += Math.min(n(input.implementationProjects), 8) * 1.4;
  score = Math.round(score * 0.72 + base * 0.28);

  return clamp(score, 35, 96);
}

function calculateExperienceScore(input: BigCorpRankingInput) {
  const years = n(input.years);
  const required = Math.max(n(input.requiredYears, 7), 1);
  if (years >= required + 8) return 96;
  if (years >= required + 4) return 90;
  if (years >= required) return 82;
  return clamp((years / required) * 76, 25, 78);
}

function percentileBand(score: number) {
  if (score >= 92) return 96;
  if (score >= 88) return 90;
  if (score >= 82) return 82;
  if (score >= 75) return 72;
  if (score >= 65) return 60;
  return 45;
}

export function calculateBigCorpRanking(input: BigCorpRankingInput): BigCorpRankingResult {
  const required = normalizeModule(input.requiredModule || "FICO");
  const primary = normalizeModule(input.primaryModule);
  const moduleFit =
    !required || required === "UNKNOWN"
      ? 70
      : primary === required
        ? clamp(n(input.moduleAuthority), 45, 96)
        : (input.secondaryModules || []).map(normalizeModule).includes(required)
          ? 62
          : 28;

  const projectAuthority = calculateProjectAuthorityV2(input);
  const financeDepth = required === "FICO" ? calculateFinanceDepthV2(input) : clamp(n(input.financeDepth), 15, 85);
  const consultingDNA = calculateConsultingDNAV2(input);
  const experience = calculateExperienceScore(input);
  const quality = clamp(n(input.profileQualityScore, 70), 40, 96);

  let raw =
    moduleFit * 0.28 +
    projectAuthority * 0.25 +
    financeDepth * 0.18 +
    consultingDNA * 0.12 +
    experience * 0.10 +
    quality * 0.07;

  if (primary !== required && required !== "UNKNOWN") {
    const secondaryHit = (input.secondaryModules || []).map(normalizeModule).includes(required);
    raw = Math.min(raw, secondaryHit ? 58 : 42);
  }

  if (input.contactMissing) raw = Math.min(raw, 76);
  if (input.nameReviewRequired) raw = Math.min(raw, 64);
  if (projectAuthority < 60) raw = Math.min(raw, 78);
  if (required === "FICO" && financeDepth < 60) raw = Math.min(raw, 76);

  const percentileScore = percentileBand(raw);
  const calibratedScore = clamp(raw * 0.82 + percentileScore * 0.18, 35, 97);

  const clientReady =
    calibratedScore >= 82 &&
    moduleFit >= 76 &&
    projectAuthority >= 70 &&
    quality >= 78 &&
    !input.contactMissing &&
    !input.nameReviewRequired &&
    (required !== "FICO" || financeDepth >= 65);

  let clientTier: BigCorpRankingResult["clientTier"] = "Review";
  if (clientReady && calibratedScore >= 92 && projectAuthority >= 82) clientTier = "A+";
  else if (clientReady && calibratedScore >= 86) clientTier = "A";
  else if (clientReady && calibratedScore >= 82) clientTier = "B";

  const riskFlags: string[] = [];
  if (primary !== required && required !== "UNKNOWN") riskFlags.push(`Primary module is ${input.primaryModule}, not ${input.requiredModule}.`);
  if (projectAuthority < 70) riskFlags.push("Implementation evidence is not strong enough for client shortlist.");
  if (required === "FICO" && financeDepth < 65) riskFlags.push("Finance depth evidence is limited.");
  if (input.contactMissing) riskFlags.push("Missing contact details.");
  if (input.nameReviewRequired) riskFlags.push("Candidate identity requires recruiter review.");

  const bullets: string[] = [];
  if (moduleFit >= 85) bullets.push(`Strong ${input.requiredModule || input.primaryModule} domain authority.`);
  if (projectAuthority >= 85) bullets.push("Strong implementation / rollout delivery evidence.");
  else if (projectAuthority >= 70) bullets.push("Relevant implementation experience, suitable for recruiter validation.");
  if (financeDepth >= 85) bullets.push("Strong finance submodule depth across senior FICO areas.");
  if (consultingDNA >= 85) bullets.push("Strong consulting delivery DNA for client-facing projects.");
  if (experience >= 90) bullets.push("Experience exceeds role requirement.");

  const summary =
    clientTier === "A+"
      ? "Top-tier client shortlist profile with strong domain, project and delivery evidence."
      : clientTier === "A"
        ? "Strong client-ready profile; recommended for shortlist after recruiter validation."
        : clientTier === "B"
          ? "Client-ready profile, but not top-tier; use as backup or broader shortlist option."
          : "Recruiter review recommended before client submission.";

  return {
    calibratedScore,
    clientScore: calibratedScore,
    percentileScore,
    clientTier,
    clientReady,
    recommendationSummary: summary,
    recommendationBullets: bullets,
    riskFlags,
    rankingBreakdown: {
      moduleFit,
      projectAuthority,
      financeDepth,
      consultingDNA,
      experience,
      quality,
    },
  };
}


export type BigCorpRankingInputV23 = BigCorpRankingInput & {
  candidateName?: string;
  sourceFile?: string;
  greenfieldProjects?: number;
  brownfieldProjects?: number;
  migrationProjects?: number;
  globalRolloutProjects?: number;
  big4Firm?: boolean;
};

function premiumContains(value: any, words: string[]) {
  const text = String(value || "").toUpperCase();
  return words.some((word) => text.includes(word.toUpperCase()));
}

export function calculateFinanceDepthV3(input: BigCorpRankingInputV23) {
  let score = calculateFinanceDepthV2(input);
  const title = String(input.title || "");
  const secondary = (input.secondaryModules || []).map((m) => String(m).toUpperCase());

  const has = (token: string) => secondary.includes(token) || title.toUpperCase().includes(token);
  const advancedCount = ["FSCM", "TRM", "CFIN", "GROUP_REPORTING", "BPC", "SAC"].filter(has).length;
  const basicCount = ["GL", "AP", "AR", "AA"].filter(has).length;

  if (advancedCount >= 1) score += 4;
  if (advancedCount >= 2) score += 5;
  if (premiumContains(title, ["Central Finance", "Finance Transformation", "Group Reporting", "SAC Planning", "BPC"])) score += 6;
  if (basicCount >= 3 && advancedCount === 0) score = Math.min(score, 82);
  if (advancedCount === 0 && basicCount <= 2) score = Math.min(score, 72);

  return clamp(score, 15, 97);
}

export function calculateProjectAuthorityV3(input: BigCorpRankingInputV23) {
  let score = calculateProjectAuthorityV2(input);

  const greenfield = n(input.greenfieldProjects);
  const brownfield = n(input.brownfieldProjects);
  const migration = n(input.migrationProjects);
  const globalRollout = n(input.globalRolloutProjects);
  const s4 = n(input.s4hanaProjects);
  const impl = n(input.implementationProjects);

  if (greenfield > 0) score += Math.min(greenfield, 4) * 4;
  if (brownfield > 0) score += Math.min(brownfield, 4) * 3;
  if (migration > 0) score += Math.min(migration, 4) * 2;
  if (globalRollout > 0) score += Math.min(globalRollout, 5) * 4;
  if (s4 >= 3 && impl >= 4) score += 4;
  if (impl <= 2 && globalRollout === 0 && greenfield === 0 && brownfield === 0) score = Math.min(score, 68);

  return clamp(score, 15, 97);
}

export function calculateConsultingDNAV3(input: BigCorpRankingInputV23) {
  let score = calculateConsultingDNAV2(input);
  const combined = `${input.title || ""} ${input.company || ""}`;

  if (premiumContains(combined, ["Deloitte", "PwC", "EY", "KPMG", "Accenture", "IBM", "Capgemini", "NTT DATA", "cbs", "Corporate Business Solutions"])) {
    score += 7;
  }
  if (premiumContains(combined, ["SAP Activate", "Fit-Gap", "Fit Gap", "Blueprint", "Workshop", "Cutover", "Hypercare", "Template", "Global Rollout", "Solution Design"])) {
    score += 6;
  }
  if (n(input.globalRolloutProjects) > 0) score += 5;

  return clamp(score, 35, 97);
}

export function normalizeAuthorityPercentileV23(raw: number, moduleFit: number, projectAuthority: number, financeDepth: number) {
  let score = raw;

  // Break flat clusters around 92-94 by requiring more than domain evidence.
  if (score >= 94 && projectAuthority < 85) score -= 4;
  if (score >= 92 && financeDepth < 80) score -= 3;
  if (moduleFit >= 90 && projectAuthority >= 88 && financeDepth >= 86) score += 2;
  if (projectAuthority < 70) score = Math.min(score, 82);

  if (score >= 95) return 96;
  if (score >= 92) return 93;
  if (score >= 88) return 89;
  if (score >= 84) return 85;
  if (score >= 78) return 80;
  if (score >= 70) return 73;
  return clamp(score, 35, 68);
}

export function calculateBigCorpRankingV23(input: BigCorpRankingInputV23): BigCorpRankingResult {
  const v22 = calculateBigCorpRanking(input);

  const financeDepth = calculateFinanceDepthV3(input);
  const projectAuthority = calculateProjectAuthorityV3(input);
  const consultingDNA = calculateConsultingDNAV3(input);
  const moduleFit = v22.rankingBreakdown.moduleFit;
  const experience = v22.rankingBreakdown.experience;
  const quality = v22.rankingBreakdown.quality;
  const requiredV23 = normalizeModule(input.requiredModule || "FICO");
  const primaryV23 = normalizeModule(input.primaryModule || "UNKNOWN");
  const secondaryHitV23 = (input.secondaryModules || []).map(normalizeModule).includes(requiredV23);

  let raw =
    moduleFit * 0.25 +
    projectAuthority * 0.29 +
    financeDepth * 0.19 +
    consultingDNA * 0.13 +
    experience * 0.08 +
    quality * 0.06;

  if (input.contactMissing) raw = Math.min(raw, 76);
  if (input.nameReviewRequired) raw = Math.min(raw, 62);
  if (projectAuthority < 70) raw = Math.min(raw, 80);

  const calibratedScore = normalizeAuthorityPercentileV23(raw, moduleFit, projectAuthority, financeDepth);

  const required = normalizeModule(input.requiredModule || "FICO");
  const clientReady =
    calibratedScore >= 84 &&
    moduleFit >= 76 &&
    projectAuthority >= 72 &&
    quality >= 78 &&
    !input.contactMissing &&
    !input.nameReviewRequired &&
    (required !== "FICO" || financeDepth >= 68);

  let clientTier: BigCorpRankingResult["clientTier"] = "Review";
  if (clientReady && calibratedScore >= 93 && projectAuthority >= 86 && financeDepth >= 82) clientTier = "A+";
  else if (clientReady && calibratedScore >= 88) clientTier = "A";
  else if (clientReady && calibratedScore >= 84) clientTier = "B";

  const riskFlags = [...v22.riskFlags];
  if (projectAuthority < 72 && !riskFlags.some((r) => r.includes("Implementation"))) {
    riskFlags.push("Project authority below client-grade shortlist threshold.");
  }
  if (required === "FICO" && financeDepth < 68 && !riskFlags.some((r) => r.includes("Finance"))) {
    riskFlags.push("Finance depth below senior FICO client-grade threshold.");
  }

  const bullets = [...v22.recommendationBullets];
  if (projectAuthority >= 88 && !bullets.some((b) => b.includes("implementation"))) bullets.push("Elite project delivery evidence with implementation/rollout weighting.");
  if (financeDepth >= 88 && !bullets.some((b) => b.includes("finance"))) bullets.push("Advanced finance depth across transformation-level FICO areas.");
  if (consultingDNA >= 90 && !bullets.some((b) => b.includes("consulting"))) bullets.push("Premium consulting DNA with Big4/enterprise delivery signals.");

  const summary =
    clientTier === "A+"
      ? "Top 5% client shortlist profile for BigCorp SAP delivery."
      : clientTier === "A"
        ? "Strong BigCorp-ready SAP profile; recommended for client shortlist."
        : clientTier === "B"
          ? "Client-ready backup profile; useful for broader shortlist coverage."
          : "Recruiter review recommended before client submission.";

  return {
    ...v22,
    calibratedScore,
    clientScore: calibratedScore,
    percentileScore: calibratedScore,
    clientTier,
    clientReady,
    recommendationSummary: summary,
    recommendationBullets: bullets,
    riskFlags,
    rankingBreakdown: {
      moduleFit,
      projectAuthority,
      financeDepth,
      consultingDNA,
      experience,
      quality,
    },
  };
}


export type BigCorpRankingInputV24 = BigCorpRankingInputV23 & {
  greenfieldProjects?: number;
  brownfieldProjects?: number;
  migrationProjects?: number;
  upgradeProjects?: number;
  hypercareProjects?: number;
  rawText?: string;
};

function textBlobV24(input: BigCorpRankingInputV24) {
  return `${input.title || ""} ${input.company || ""} ${input.rawText || ""} ${(input.secondaryModules || []).join(" ")}`.toUpperCase();
}

function countTokenV24(text: string, pattern: RegExp, cap = 20) {
  const matches = text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"));
  return Math.min(matches ? matches.length : 0, cap);
}

export function calculateDomainAuthorityV3(input: BigCorpRankingInputV24) {
  const required = normalizeModule(input.requiredModule || input.primaryModule || "UNKNOWN");
  const primary = normalizeModule(input.primaryModule || "UNKNOWN");
  const text = textBlobV24(input);

  const submodules = (input.secondaryModules || []).map((m) => normalizeModule(m));
  const years = n(input.years);
  const impl = n(input.implementationProjects);
  const rollout = n(input.rolloutProjects);
  const s4 = n(input.s4hanaProjects);

  if (required !== "UNKNOWN" && primary !== required) {
    const secondaryHit = submodules.includes(required);
    return secondaryHit ? 58 : 28;
  }

  let score = 45;
  score += Math.min(years, 15) * 1.2;
  score += Math.min(impl, 8) * 2.2;
  score += Math.min(rollout, 6) * 1.4;
  score += Math.min(s4, 6) * 1.5;

  if (primary === "FICO") {
    const financeDepth = calculateFinanceDepthV4(input);
    score += Math.round(financeDepth * 0.16);
    const advanced = ["FSCM", "TRM", "CFIN", "GROUPREPORTING", "BPC", "SAC"].filter((m) => submodules.includes(m)).length;
    const basic = ["GL", "AP", "AR", "AA", "COPA"].filter((m) => submodules.includes(m)).length;
    score += Math.min(basic, 5) * 1.2;
    score += Math.min(advanced, 4) * 2.4;
  } else {
    score += Math.min(n(input.moduleAuthority), 94) * 0.18;
  }

  if (countTokenV24(text, /\b(S4HANA|S\/4HANA|S4\s*HANA)\b/i, 10) >= 3) score += 3;
  if (countTokenV24(text, /\b(GLOBAL\s+ROLLOUT|REGIONAL\s+ROLLOUT|TEMPLATE)\b/i, 8) >= 1) score += 3;
  if (premiumContains(text, ["SAP Activate", "Solution Design", "Fit-Gap", "Blueprint"])) score += 2;

  if (impl <= 2) score = Math.min(score, 84);
  if (years < 5) score = Math.min(score, 80);

  // Break 94 plateau deterministically using evidence.
  if (score >= 92) {
    let elite = 0;
    if (impl >= 7) elite += 2;
    if (s4 >= 5) elite += 2;
    if (rollout >= 2) elite += 1;
    if (years >= 12) elite += 1;
    if (primary === "FICO" && calculateFinanceDepthV4(input) >= 88) elite += 2;
    score = 88 + elite;
  }

  return clamp(score, 18, 97);
}

export function calculateFinanceDepthV4(input: BigCorpRankingInputV24) {
  const text = textBlobV24(input);
  const secondary = (input.secondaryModules || []).map((m) => normalizeModule(m));
  const has = (token: string) => secondary.includes(normalizeModule(token)) || text.includes(token.toUpperCase());

  let score = 20;

  // Core FICO
  if (has("GL")) score += 7;
  if (has("AP")) score += 6;
  if (has("AR")) score += 6;
  if (has("AA")) score += 6;
  if (has("COPA") || has("CO-PA")) score += 8;

  // Advanced finance
  if (has("FSCM")) score += 10;
  if (has("TRM") || text.includes("TREASURY")) score += 10;
  if (has("CFIN") || text.includes("CENTRAL FINANCE")) score += 12;
  if (has("GROUPREPORTING") || text.includes("GROUP REPORTING")) score += 10;
  if (has("BPC")) score += 8;
  if (has("SAC") || text.includes("SAC PLANNING")) score += 8;

  // Transformation evidence
  if (text.includes("FINANCE TRANSFORMATION")) score += 7;
  if (text.includes("TEMPLATE")) score += 4;
  if (text.includes("GLOBAL ROLLOUT")) score += 5;
  if (text.includes("S/4HANA") || text.includes("S4HANA") || text.includes("S4 HANA")) score += Math.min(n(input.s4hanaProjects), 5) * 1.2;

  const basic = ["GL", "AP", "AR", "AA"].filter(has).length;
  const advanced = ["FSCM", "TRM", "CFIN", "GROUPREPORTING", "BPC", "SAC"].filter(has).length;

  if (basic >= 3) score += 5;
  if (advanced >= 2) score += 7;
  if (advanced >= 3) score += 5;

  // Prevent basic GL/AP/AR profiles becoming 97.
  if (advanced === 0) score = Math.min(score, 78);
  if (advanced === 1) score = Math.min(score, 86);
  if (basic < 3 && advanced < 2) score = Math.min(score, 74);
  if (n(input.implementationProjects) <= 3 && n(input.s4hanaProjects) <= 1) score = Math.min(score, 84);

  return clamp(score, 18, 97);
}

export function calculateConsultingDNAV3Strict(input: BigCorpRankingInputV24) {
  const text = textBlobV24(input);

  let score = 42;

  if (premiumContains(text, ["DELOITTE", "PWC", "PRICEWATERHOUSECOOPERS", "EY", "KPMG"])) score += 18;
  else if (premiumContains(text, ["ACCENTURE", "IBM"])) score += 15;
  else if (premiumContains(text, ["CAPGEMINI", "NTT", "NTT DATA", "CBS", "CORPORATE BUSINESS SOLUTIONS", "INFOSYS", "TCS", "WIPRO", "DXC", "ATOS"])) score += 11;

  if (premiumContains(text, ["SAP ACTIVATE", "FIT-GAP", "FIT GAP", "BLUEPRINT", "WORKSHOP"])) score += 9;
  if (premiumContains(text, ["CUTOVER", "HYPERCARE", "GO-LIVE", "GO LIVE"])) score += 7;
  if (premiumContains(text, ["SOLUTION DESIGN", "TEMPLATE", "GLOBAL ROLLOUT", "REGIONAL ROLLOUT"])) score += 8;

  score += Math.min(n(input.implementationProjects), 8) * 1.1;
  score += Math.min(n(input.rolloutProjects) + n(input.globalRolloutProjects), 6) * 2.0;

  if (premiumContains(text, ["MANAGER", "LEAD", "ARCHITECT", "WORK STREAM"])) score += 5;

  return clamp(score, 35, 97);
}

export function calculateBigCorpRankingV24(input: BigCorpRankingInputV24): BigCorpRankingResult {
  const required = normalizeModule(input.requiredModule || "FICO");
  const primary = normalizeModule(input.primaryModule || "UNKNOWN");

  const moduleFit = calculateDomainAuthorityV3(input);
  const projectAuthority = calculateProjectAuthorityV3(input);
  const financeDepth = required === "FICO" ? calculateFinanceDepthV4(input) : calculateFinanceDepthV3(input);
  const consultingDNA = calculateConsultingDNAV3Strict(input);
  const moduleAuthorityGate = n(input.moduleAuthority || moduleFit);
  const yearsGate = n(input.requiredYears) > 0 ? n(input.years) >= n(input.requiredYears) : true;
  const experience = calculateExperienceScore(input);
  const quality = clamp(n(input.profileQualityScore, 70), 20, 97);

  // Hard primary module lock for JD matching.
  if (required !== "UNKNOWN" && primary !== required) {
    const secondaryHit = (input.secondaryModules || []).map(normalizeModule).includes(required);
    const lockedScore = required === "BTP" ? (secondaryHit ? 55 : 35) : (secondaryHit ? 58 : 40);
    return {
      calibratedScore: lockedScore,
      clientScore: lockedScore,
      percentileScore: lockedScore,
      clientTier: "Review",
      clientReady: false,
      recommendationSummary: `Recruiter review required: primary module is ${input.primaryModule}, not ${input.requiredModule}.`,
      recommendationBullets: [],
      riskFlags: [`Primary module lock: ${input.primaryModule} cannot be client-ready for ${input.requiredModule} role.`],
      rankingBreakdown: {
        moduleFit: lockedScore,
        projectAuthority,
        financeDepth,
        consultingDNA,
        experience,
        quality,
      },
    };
  }

  let raw =
    moduleFit * 0.27 +
    projectAuthority * 0.28 +
    financeDepth * 0.20 +
    consultingDNA * 0.12 +
    experience * 0.08 +
    quality * 0.05;

  if (input.contactMissing) raw = Math.min(raw, 75);
  if (input.nameReviewRequired) raw = Math.min(raw, 60);
  if (quality <= 60) raw = Math.min(raw, 78);
  if (projectAuthority < 72) raw = Math.min(raw, 82);
  if (required === "FICO" && financeDepth < 68) raw = Math.min(raw, 82);

  let calibratedScore = normalizeAuthorityPercentileV23(raw, moduleFit, projectAuthority, financeDepth);

  // More visible ranking bands for client shortlist.
  if (moduleFit >= 95 && projectAuthority >= 92 && financeDepth >= 90) calibratedScore = Math.max(calibratedScore, 95);
  else if (moduleFit >= 92 && projectAuthority >= 88 && financeDepth >= 84) calibratedScore = Math.max(calibratedScore, 92);
  else if (projectAuthority < 78 || financeDepth < 72) calibratedScore = Math.min(calibratedScore, 86);

  calibratedScore = clamp(calibratedScore, 35, 97);

  const clientReady =
    calibratedScore >= 86 &&
    moduleFit >= 78 &&
    projectAuthority >= 74 &&
    quality >= 78 &&
    !input.contactMissing &&
    !input.nameReviewRequired &&
    (required !== "FICO" || financeDepth >= 70);

  let clientTier: BigCorpRankingResult["clientTier"] = "Review";
  if (clientReady && calibratedScore >= 95) clientTier = "A+";
  else if (clientReady && calibratedScore >= 90) clientTier = "A";
  else if (clientReady && calibratedScore >= 86) clientTier = "B";

  const riskFlags: string[] = [];
  if (projectAuthority < 74) riskFlags.push("Project authority below client-grade threshold.");
  if (required === "FICO" && financeDepth < 70) riskFlags.push("Finance depth below senior FICO threshold.");
  if (consultingDNA < 65) riskFlags.push("Limited consulting delivery evidence.");
  if (quality <= 60) riskFlags.push("Profile quality requires recruiter review.");

  const bullets: string[] = [];
  if (moduleFit >= 92) bullets.push(`Strong ${input.requiredModule || input.primaryModule} domain authority.`);
  if (projectAuthority >= 88) bullets.push("Strong implementation / rollout delivery evidence.");
  if (financeDepth >= 88) bullets.push("Advanced finance depth across senior FICO topics.");
  if (consultingDNA >= 85) bullets.push("Strong consulting delivery DNA with enterprise project signals.");
  if (n(input.s4hanaProjects) >= 5) bullets.push("Strong S/4HANA project exposure.");
  if (n(input.rolloutProjects) >= 2 || n(input.globalRolloutProjects) >= 1) bullets.push("Global/regional rollout experience supports client-facing delivery.");

  const recommendationSummary =
    clientTier === "A+"
      ? "Elite BigCorp shortlist profile with strong domain, project and transformation evidence."
      : clientTier === "A"
        ? "Strong BigCorp-ready SAP profile; recommended for client shortlist."
        : clientTier === "B"
          ? "Client-ready backup profile; suitable for broader shortlist coverage."
          : "Recruiter review recommended before client submission.";

  return {
    calibratedScore,
    clientScore: calibratedScore,
    percentileScore: calibratedScore,
    clientTier,
    clientReady,
    recommendationSummary,
    recommendationBullets: bullets,
    riskFlags,
    rankingBreakdown: {
      moduleFit,
      projectAuthority,
      financeDepth,
      consultingDNA,
      experience,
      quality,
    },
  };
}


export type BigCorpRankingInputV25 = BigCorpRankingInputV24 & {
  searchKeyword?: string;
  roleComplexity?: number;
  complexityLabel?: string;
  moduleAuthority?: number;
  years?: number;
  requiredYears?: number;
};

function fractionalTieBreakerV25(input: BigCorpRankingInputV25, moduleFit: number, projectAuthority: number, financeDepth: number, consultingDNA: number) {
  const years = n(input.years);
  const impl = n(input.implementationProjects);
  const rollout = n(input.rolloutProjects) + n(input.globalRolloutProjects);
  const s4 = n(input.s4hanaProjects);
  const ams = n(input.amsProjects);
  const secondary = (input.secondaryModules || []).map((m) => normalizeModule(m));
  const text = textBlobV24(input);

  let tie = 0;

  // Delivery depth
  tie += Math.min(impl, 12) * 0.18;
  tie += Math.min(rollout, 8) * 0.20;
  tie += Math.min(s4, 10) * 0.16;
  tie += Math.min(years, 20) * 0.06;

  // Finance specialization
  if (secondary.includes("FSCM")) tie += 0.32;
  if (secondary.includes("TRM")) tie += 0.30;
  if (secondary.includes("CFIN")) tie += 0.36;
  if (secondary.includes("COPA")) tie += 0.24;
  if (secondary.includes("PS")) tie += 0.12;

  // Consulting/project signals
  if (premiumContains(text, ["PWC", "DELOITTE", "EY", "KPMG"])) tie += 0.55;
  else if (premiumContains(text, ["ACCENTURE", "IBM", "CAPGEMINI", "NTT", "CBS", "CORPORATE BUSINESS SOLUTIONS"])) tie += 0.35;

  if (premiumContains(text, ["GLOBAL ROLLOUT", "REGIONAL ROLLOUT", "TEMPLATE"])) tie += 0.32;
  if (premiumContains(text, ["SAP ACTIVATE", "FIT-GAP", "BLUEPRINT", "CUTOVER", "HYPERCARE"])) tie += 0.25;

  // AMS-heavy but implementation-light should not top client list.
  if (impl <= 4 && ams >= 10) tie -= 0.35;
  if (financeDepth < 75) tie -= 0.45;
  if (projectAuthority < 75) tie -= 0.50;
  if (consultingDNA < 70) tie -= 0.20;

  return Math.max(-1.5, Math.min(2.8, tie));
}

export function calculateSearchPriorityV25(input: BigCorpRankingInputV25) {
  const keyword = String(input.searchKeyword || input.requiredModule || "").toUpperCase();
  const primary = normalizeModule(input.primaryModule || "UNKNOWN");
  const secondary = (input.secondaryModules || []).map(normalizeModule);
  const title = String(input.title || "").toUpperCase();

  let priority = 0;

  const wantsFico = /\b(FICO|FI\/CO|FI CO|SAP FI|FINANCE|FSCM|TRM|CFIN)\b/i.test(keyword);
  if (wantsFico) {
    if (primary === "FICO") priority += 120;
    else if (secondary.includes("FICO")) priority += 50;
    else priority -= 40;
  }

  if (keyword && primary !== "UNKNOWN" && keyword.includes(primary)) priority += 80;
  if (keyword && title.includes(keyword)) priority += 20;

  priority += Math.min(n(input.implementationProjects), 12) * 1.5;
  priority += Math.min(n(input.s4hanaProjects), 10) * 1.2;
  priority += Math.min(n(input.years), 20) * 0.6;

  if (input.contactMissing) priority -= 30;
  if (input.nameReviewRequired) priority -= 60;

  return Math.round(priority);
}

export function calculateBigCorpRankingV25(input: BigCorpRankingInputV25): BigCorpRankingResult {
  const required = normalizeModule(input.requiredModule || "FICO");
  const primary = normalizeModule(input.primaryModule || "UNKNOWN");

  const base = calculateBigCorpRankingV24(input);

  const moduleFit = calculateDomainAuthorityV3(input);
  const projectAuthority = calculateProjectAuthorityV3(input);
  const financeDepth = required === "FICO" ? calculateFinanceDepthV4(input) : calculateFinanceDepthV3(input);
  const consultingDNA = calculateConsultingDNAV3Strict(input);
  const moduleAuthorityGate = n(input.moduleAuthority || moduleFit);
  const yearsGate = n(input.requiredYears) > 0 ? n(input.years) >= n(input.requiredYears) : true;
  const experience = calculateExperienceScore(input);
  const quality = clamp(n(input.profileQualityScore, 70), 20, 97);

  // Strong primary module lock: secondary FICO cannot be client-ready for FICO JD.
  if (required !== "UNKNOWN" && primary !== required) {
    const secondaryHit = (input.secondaryModules || []).map(normalizeModule).includes(required);
    const lockedScore = required === "BTP" ? (secondaryHit ? 55 : 35) : (secondaryHit ? 58 : 40);
    return {
      ...base,
      calibratedScore: lockedScore,
      clientScore: lockedScore,
      percentileScore: lockedScore,
      clientTier: "Review",
      clientReady: false,
      recommendationSummary: `Recruiter review required: primary module is ${input.primaryModule}, not ${input.requiredModule}.`,
      recommendationBullets: [],
      riskFlags: [`Primary module lock: ${input.primaryModule} cannot be client-ready for ${input.requiredModule} role.`],
      rankingBreakdown: {
        moduleFit: lockedScore,
        projectAuthority,
        financeDepth,
        consultingDNA,
        experience,
        quality,
      },
    };
  }

  let raw =
    moduleFit * 0.25 +
    projectAuthority * 0.30 +
    financeDepth * 0.20 +
    consultingDNA * 0.12 +
    experience * 0.08 +
    quality * 0.05;

  raw += fractionalTieBreakerV25(input, moduleFit, projectAuthority, financeDepth, consultingDNA);

  if (input.contactMissing) raw = Math.min(raw, 74);
  if (input.nameReviewRequired) raw = Math.min(raw, 58);
  if (quality <= 60) raw = Math.min(raw, 76);
  if (projectAuthority < 72) raw = Math.min(raw, 80);
  if (required === "FICO" && financeDepth < 70) raw = Math.min(raw, 82);

  // More discriminating client bands.
  let calibratedScore = clamp(raw, 35, 97);

  if (moduleFit >= 94 && projectAuthority >= 94 && financeDepth >= 92 && consultingDNA >= 90) calibratedScore = Math.max(calibratedScore, 96);
  else if (moduleFit >= 92 && projectAuthority >= 90 && financeDepth >= 84) calibratedScore = Math.max(calibratedScore, 93);
  else if (projectAuthority < 78 || financeDepth < 75) calibratedScore = Math.min(calibratedScore, 88);
  if (projectAuthority < 70 || financeDepth < 68) calibratedScore = Math.min(calibratedScore, 82);

  calibratedScore = clamp(calibratedScore, 35, 97);

  const clientReady =
    calibratedScore >= 86 &&
    moduleFit >= 78 &&
    projectAuthority >= 74 &&
    quality >= 78 &&
    !input.contactMissing &&
    !input.nameReviewRequired &&
    (required !== "FICO" || financeDepth >= 70);

  let clientTier: BigCorpRankingResult["clientTier"] = "Review";
  if (clientReady && calibratedScore >= 95) clientTier = "A+";
  else if (clientReady && calibratedScore >= 90) clientTier = "A";
  else if (clientReady && calibratedScore >= 86) clientTier = "B";

  const riskFlags = [...base.riskFlags];
  if (projectAuthority < 74 && !riskFlags.some((r) => r.includes("Project authority"))) riskFlags.push("Project authority below client-grade threshold.");
  if (required === "FICO" && financeDepth < 70 && !riskFlags.some((r) => r.includes("Finance depth"))) riskFlags.push("Finance depth below senior FICO threshold.");

  const recommendationBullets = [...base.recommendationBullets];
  if (calibratedScore >= 95 && !recommendationBullets.some((b) => b.includes("Top-tier"))) recommendationBullets.push("Top-tier client shortlist rank after tie-breaker calibration.");

  const recommendationSummary =
    clientTier === "A+"
      ? "Elite SaaS/BigCorp shortlist profile with differentiated domain, finance and delivery evidence."
      : clientTier === "A"
        ? "Strong SaaS/BigCorp-ready SAP profile; recommended for client shortlist."
        : clientTier === "B"
          ? "Client-ready backup profile; suitable for broader shortlist coverage."
          : "Recruiter review recommended before client submission.";

  return {
    ...base,
    calibratedScore,
    clientScore: calibratedScore,
    percentileScore: calibratedScore,
    clientTier,
    clientReady,
    recommendationSummary,
    recommendationBullets,
    riskFlags,
    rankingBreakdown: {
      moduleFit,
      projectAuthority,
      financeDepth,
      consultingDNA,
      experience,
      quality,
    },
  };
}

// =========================
// V26 MULTI-MODULE SAP SAAS ENGINE
// Generic module priority + module-specific ranking weights
// =========================

export type SapModuleWeightProfileV26 = {
  moduleAuthority: number;
  projectAuthority: number;
  financeDepth: number;
  technicalDepth: number;
  logisticsDepth: number;
  consultingDNA: number;
  experience: number;
  quality: number;
};

export const SAP_MODULE_WEIGHT_PROFILES_V26: Record<string, SapModuleWeightProfileV26> = {
  FICO: { moduleAuthority: 0.25, projectAuthority: 0.28, financeDepth: 0.20, technicalDepth: 0.00, logisticsDepth: 0.00, consultingDNA: 0.12, experience: 0.08, quality: 0.07 },
  // V27.8: MM/SD must be driven by direct module authority first.
  // This prevents generic implementation-heavy profiles from ranking 95-97
  // when recruiter-visible module authority is only 50-70.
  MM: { moduleAuthority: 0.42, projectAuthority: 0.25, financeDepth: 0.00, technicalDepth: 0.00, logisticsDepth: 0.15, consultingDNA: 0.08, experience: 0.06, quality: 0.04 },
  SD: { moduleAuthority: 0.42, projectAuthority: 0.25, financeDepth: 0.00, technicalDepth: 0.00, logisticsDepth: 0.15, consultingDNA: 0.08, experience: 0.06, quality: 0.04 },
  EWM: { moduleAuthority: 0.35, projectAuthority: 0.30, financeDepth: 0.00, technicalDepth: 0.00, logisticsDepth: 0.22, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  TM: { moduleAuthority: 0.35, projectAuthority: 0.30, financeDepth: 0.00, technicalDepth: 0.00, logisticsDepth: 0.22, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  PP: { moduleAuthority: 0.35, projectAuthority: 0.32, financeDepth: 0.00, technicalDepth: 0.00, logisticsDepth: 0.18, consultingDNA: 0.06, experience: 0.06, quality: 0.03 },
  PM: { moduleAuthority: 0.35, projectAuthority: 0.32, financeDepth: 0.00, technicalDepth: 0.00, logisticsDepth: 0.16, consultingDNA: 0.07, experience: 0.07, quality: 0.03 },
  PS: { moduleAuthority: 0.34, projectAuthority: 0.34, financeDepth: 0.06, technicalDepth: 0.00, logisticsDepth: 0.10, consultingDNA: 0.08, experience: 0.05, quality: 0.03 },
  "IS-U": { moduleAuthority: 0.36, projectAuthority: 0.30, financeDepth: 0.05, technicalDepth: 0.00, logisticsDepth: 0.12, consultingDNA: 0.07, experience: 0.07, quality: 0.03 },
  ABAP: { moduleAuthority: 0.35, projectAuthority: 0.24, financeDepth: 0.00, technicalDepth: 0.28, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  BASIS: { moduleAuthority: 0.35, projectAuthority: 0.24, financeDepth: 0.00, technicalDepth: 0.28, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  BW: { moduleAuthority: 0.35, projectAuthority: 0.22, financeDepth: 0.00, technicalDepth: 0.30, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  BTP: { moduleAuthority: 0.38, projectAuthority: 0.20, financeDepth: 0.00, technicalDepth: 0.30, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  CPI: { moduleAuthority: 0.40, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.32, logisticsDepth: 0.00, consultingDNA: 0.03, experience: 0.04, quality: 0.03 },
  "PI/PO": { moduleAuthority: 0.40, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.32, logisticsDepth: 0.00, consultingDNA: 0.03, experience: 0.04, quality: 0.03 },
  MDG: { moduleAuthority: 0.38, projectAuthority: 0.22, financeDepth: 0.00, technicalDepth: 0.28, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  GRC: { moduleAuthority: 0.40, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.30, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  SECURITY: { moduleAuthority: 0.40, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.30, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  FIORI: { moduleAuthority: 0.38, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.32, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  UI5: { moduleAuthority: 0.38, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.32, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  DATASPHERE: { moduleAuthority: 0.38, projectAuthority: 0.18, financeDepth: 0.00, technicalDepth: 0.32, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  SAC: { moduleAuthority: 0.38, projectAuthority: 0.18, financeDepth: 0.05, technicalDepth: 0.27, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  "BW/4HANA": { moduleAuthority: 0.38, projectAuthority: 0.20, financeDepth: 0.00, technicalDepth: 0.30, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  BPC: { moduleAuthority: 0.38, projectAuthority: 0.20, financeDepth: 0.12, technicalDepth: 0.20, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.02 },
  CFIN: { moduleAuthority: 0.40, projectAuthority: 0.22, financeDepth: 0.20, technicalDepth: 0.08, logisticsDepth: 0.00, consultingDNA: 0.04, experience: 0.04, quality: 0.02 },
  FSCM: { moduleAuthority: 0.40, projectAuthority: 0.20, financeDepth: 0.22, technicalDepth: 0.05, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  TRM: { moduleAuthority: 0.40, projectAuthority: 0.20, financeDepth: 0.22, technicalDepth: 0.05, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  BCM: { moduleAuthority: 0.42, projectAuthority: 0.18, financeDepth: 0.22, technicalDepth: 0.05, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  GR: { moduleAuthority: 0.40, projectAuthority: 0.20, financeDepth: 0.22, technicalDepth: 0.05, logisticsDepth: 0.00, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  ARIBA: { moduleAuthority: 0.38, projectAuthority: 0.25, financeDepth: 0.00, technicalDepth: 0.02, logisticsDepth: 0.22, consultingDNA: 0.05, experience: 0.05, quality: 0.03 },
  IBP: { moduleAuthority: 0.38, projectAuthority: 0.24, financeDepth: 0.00, technicalDepth: 0.04, logisticsDepth: 0.22, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  APO: { moduleAuthority: 0.38, projectAuthority: 0.24, financeDepth: 0.00, technicalDepth: 0.04, logisticsDepth: 0.22, consultingDNA: 0.04, experience: 0.05, quality: 0.03 },
  SUCCESSFACTORS: { moduleAuthority: 0.40, projectAuthority: 0.24, financeDepth: 0.00, technicalDepth: 0.04, logisticsDepth: 0.00, consultingDNA: 0.09, experience: 0.17, quality: 0.06 },
  EC: { moduleAuthority: 0.42, projectAuthority: 0.22, financeDepth: 0.00, technicalDepth: 0.04, logisticsDepth: 0.00, consultingDNA: 0.09, experience: 0.17, quality: 0.06 },
  CONCUR: { moduleAuthority: 0.38, projectAuthority: 0.22, financeDepth: 0.12, technicalDepth: 0.08, logisticsDepth: 0.00, consultingDNA: 0.06, experience: 0.09, quality: 0.05 },
  FIELDGLASS: { moduleAuthority: 0.38, projectAuthority: 0.22, financeDepth: 0.00, technicalDepth: 0.08, logisticsDepth: 0.12, consultingDNA: 0.06, experience: 0.09, quality: 0.05 },
  BRIM: { moduleAuthority: 0.38, projectAuthority: 0.24, financeDepth: 0.10, technicalDepth: 0.08, logisticsDepth: 0.10, consultingDNA: 0.05, experience: 0.04, quality: 0.01 },
  UNKNOWN: { moduleAuthority: 0.25, projectAuthority: 0.25, financeDepth: 0.00, technicalDepth: 0.10, logisticsDepth: 0.10, consultingDNA: 0.10, experience: 0.10, quality: 0.10 },
};

export function normalizeRequiredModuleV26(value: any) {
  const raw = String(value || "").toUpperCase();

  if (/\b(BTP|BUSINESS TECHNOLOGY PLATFORM|EXTENSION SUITE|INTEGRATION SUITE)\b/.test(raw)) return "BTP";
  if (/\b(CPI|CLOUD PLATFORM INTEGRATION|CLOUD INTEGRATION|IFLOW|I-FLOW)\b/.test(raw)) return "CPI";
  if (/\b(PI\/PO|PI PO|PROCESS INTEGRATION|PROCESS ORCHESTRATION|SAP XI)\b/.test(raw)) return "PI/PO";
  if (/\b(MDG|MASTER DATA GOVERNANCE)\b/.test(raw)) return "MDG";
  if (/\b(GRC|ACCESS CONTROL|PROCESS CONTROL|SOD|SAP SECURITY|AUTHORI[ZS]ATION)\b/.test(raw)) return "GRC";
  if (/\b(FIORI|LAUNCHPAD|FIORI ELEMENTS)\b/.test(raw)) return "FIORI";
  if (/\b(UI5|SAPUI5|SAP UI5|OPENUI5)\b/.test(raw)) return "UI5";
  if (/\b(DATASPHERE|DATA WAREHOUSE CLOUD|DWC)\b/.test(raw)) return "DATASPHERE";
  if (/\b(SAC|SAP ANALYTICS CLOUD|ANALYTICS CLOUD|SAC PLANNING)\b/.test(raw)) return "SAC";
  if (/\b(BW\/4HANA|BW4HANA|BW 4HANA)\b/.test(raw)) return "BW/4HANA";
  if (/\b(BPC|BUSINESS PLANNING AND CONSOLIDATION)\b/.test(raw)) return "BPC";
  if (/\b(CFIN|CENTRAL FINANCE)\b/.test(raw)) return "CFIN";
  if (/\b(FSCM|CREDIT MANAGEMENT|COLLECTIONS?|DISPUTE MANAGEMENT)\b/.test(raw)) return "FSCM";
  if (/\b(TRM|TREASURY|CASH MANAGEMENT)\b/.test(raw)) return "TRM";
  if (/\b(BCM|BANK COMMUNICATION MANAGEMENT)\b/.test(raw)) return "BCM";
  if (/\b(GROUP REPORTING|CONSOLIDATION)\b/.test(raw)) return "GR";
  if (/\b(ARIBA|SOURCE TO PAY|S2P|GUIDED BUYING|SOURCE TO CONTRACT)\b/.test(raw)) return "ARIBA";
  if (/\b(IBP|INTEGRATED BUSINESS PLANNING|DEMAND PLANNING|SUPPLY PLANNING)\b/.test(raw)) return "IBP";
  if (/\b(APO|ADVANCED PLANNING|PPDS|PP\/DS)\b/.test(raw)) return "APO";
  if (/\b(SUCCESSFACTORS|SUCCESS FACTORS|HXM|EMPLOYEE CENTRAL|SF EC)\b/.test(raw)) return "SUCCESSFACTORS";
  if (/\b(CONCUR|TRAVEL AND EXPENSE|EXPENSE MANAGEMENT)\b/.test(raw)) return "CONCUR";
  if (/\b(FIELDGLASS|EXTERNAL WORKFORCE|VENDOR MANAGEMENT)\b/.test(raw)) return "FIELDGLASS";
  if (/\b(BRIM|BILLING AND REVENUE INNOVATION)\b/.test(raw)) return "BRIM";
  if (/\b(FICO|FI\/CO|FI CO|SAP FI|SAP CO|FINANCE|RTR|R2R|RECORD TO REPORT)\b/.test(raw)) return "FICO";
  if (/\b(MM|MATERIAL MANAGEMENT|PROCUREMENT|PURCHASING|INVENTORY|P2P|PROCURE TO PAY)\b/.test(raw)) return "MM";
  if (/\b(SD|SALES DISTRIBUTION|ORDER TO CASH|OTC|O2C)\b/.test(raw)) return "SD";
  if (/\b(EWM|WAREHOUSE|EXTENDED WAREHOUSE)\b/.test(raw)) return "EWM";
  if (/\b(TM|TRANSPORTATION MANAGEMENT|LOGISTICS EXECUTION)\b/.test(raw)) return "TM";
  if (/\b(PP|PRODUCTION PLANNING|MANUFACTURING)\b/.test(raw)) return "PP";
  if (/\b(PM|PLANT MAINTENANCE|EAM|ENTERPRISE ASSET)\b/.test(raw)) return "PM";
  if (/\b(PS|PROJECT SYSTEM)\b/.test(raw)) return "PS";
  if (/\b(IS-U|ISU|UTILITIES)\b/.test(raw)) return "IS-U";
  if (/\b(ABAP|DEVELOPER|WRICEF|RICEF|BAPI|BADI|IDOC|CDS|AMDP)\b/.test(raw)) return "ABAP";
  if (/\b(BASIS|HANA ADMIN|NETWEAVER|SYSTEM ADMIN)\b/.test(raw)) return "BASIS";
  if (/\b(BW|BI|BOBJ|BUSINESS OBJECTS|WEBI)\b/.test(raw)) return "BW";

  return "UNKNOWN";
}

export function calculateLogisticsDepthV26(input: BigCorpRankingInputV25) {
  const text = textBlobV24(input);
  const secondary = (input.secondaryModules || []).map((m) => normalizeModule(m));
  const has = (token: string) => secondary.includes(normalizeModule(token)) || text.includes(token.toUpperCase());

  let score = 20;

  if (has("MM") || text.includes("PROCUREMENT") || text.includes("PURCHASING") || text.includes("INVENTORY")) score += 18;
  if (has("SD") || text.includes("ORDER TO CASH") || text.includes("SALES DISTRIBUTION") || text.includes("BILLING")) score += 18;
  if (has("EWM") || text.includes("WAREHOUSE") || text.includes("WM")) score += 20;
  if (has("TM") || text.includes("TRANSPORTATION")) score += 20;
  if (has("PP") || text.includes("PRODUCTION PLANNING") || text.includes("MANUFACTURING")) score += 16;
  if (has("PM") || text.includes("PLANT MAINTENANCE") || text.includes("EAM")) score += 16;
  if (has("PS") || text.includes("PROJECT SYSTEM")) score += 14;
  if (text.includes("S/4HANA") || text.includes("S4HANA") || text.includes("S4 HANA")) score += Math.min(n(input.s4hanaProjects), 5) * 2;
  if (text.includes("GLOBAL ROLLOUT") || text.includes("REGIONAL ROLLOUT")) score += 8;
  if (text.includes("TEMPLATE")) score += 5;

  // V27.8: process-depth must support, not override, direct module authority.
  // Without this blend, broad logistics keywords can inflate MM/SD scores.
  const directAuthority = n(input.moduleAuthority);
  if (directAuthority > 0) {
    score = Math.round(score * 0.65 + directAuthority * 0.35);
  }

  return clamp(score, 20, 97);
}

export function calculateTechnicalDepthV26(input: BigCorpRankingInputV25) {
  const text = textBlobV24(input);
  const secondary = (input.secondaryModules || []).map((m) => normalizeModule(m));
  const has = (token: string) => secondary.includes(normalizeModule(token)) || text.includes(token.toUpperCase());

  let score = 20;

  if (has("ABAP") || text.includes("CDS") || text.includes("BADI") || text.includes("USER EXIT") || text.includes("BAPI") || text.includes("IDOC") || text.includes("WRICEF")) score += 22;
  if (has("BASIS") || text.includes("HANA ADMIN") || text.includes("NETWEAVER") || text.includes("SECURITY")) score += 22;
  if (has("BTP") || text.includes("BUSINESS TECHNOLOGY PLATFORM") || text.includes("EXTENSION SUITE")) score += 24;
  if (has("CPI") || has("PI/PO") || text.includes("CLOUD INTEGRATION") || text.includes("IFLOW") || text.includes("PROCESS ORCHESTRATION")) score += 24;
  if (has("MDG") || text.includes("MASTER DATA GOVERNANCE")) score += 20;
  if (has("GRC") || text.includes("ACCESS CONTROL") || text.includes("SOD")) score += 20;
  if (has("BW") || has("BW/4HANA") || text.includes("BW/4HANA") || text.includes("BW4HANA")) score += 22;
  if (has("DATASPHERE") || text.includes("DATASPHERE") || text.includes("DWC")) score += 18;
  if (has("SAC") || text.includes("SAC") || text.includes("ANALYTICS CLOUD")) score += 16;
  if (has("FIORI") || has("UI5") || text.includes("FIORI") || text.includes("UI5")) score += 16;
  if (text.includes("INTEGRATION") || text.includes("INTERFACE") || text.includes("API MANAGEMENT") || text.includes("EVENT MESH")) score += 9;
  if (text.includes("S/4HANA") || text.includes("S4HANA") || text.includes("S4 HANA")) score += Math.min(n(input.s4hanaProjects), 5) * 2;

  // V27.8: technical depth must support, not override, direct module authority.
  // ABAP/BASIS profiles with strong authority stay strong; keyword-only profiles are capped.
  const directAuthority = n(input.moduleAuthority);
  if (directAuthority > 0) {
    score = Math.round(score * 0.6 + directAuthority * 0.4);
  }

  return clamp(score, 20, 97);
}

export function calculateGenericModulePriorityV26(input: BigCorpRankingInputV25) {
  const required = normalizeRequiredModuleV26(input.requiredModule || input.searchKeyword || "");
  const primary = normalizeModule(input.primaryModule || "UNKNOWN");
  const secondary = (input.secondaryModules || []).map(normalizeModule);

  let priority = 0;

  if (required !== "UNKNOWN") {
    if (primary === required) priority += 140;
    else if (secondary.includes(required)) priority += 45;
    else priority -= 60;
  }

  priority += Math.min(n(input.implementationProjects), 12) * 1.5;
  priority += Math.min(n(input.s4hanaProjects), 10) * 1.2;
  priority += Math.min(n(input.years), 20) * 0.6;

  if (input.contactMissing) priority -= 35;
  if (input.nameReviewRequired) priority -= 80;

  return Math.round(priority);
}

export function calculateBigCorpRankingV26(input: BigCorpRankingInputV25): BigCorpRankingResult {
  const required = normalizeRequiredModuleV26(input.requiredModule || "UNKNOWN");
  const primary = normalizeModule(input.primaryModule || "UNKNOWN");
  const weights = SAP_MODULE_WEIGHT_PROFILES_V26[required] || SAP_MODULE_WEIGHT_PROFILES_V26.UNKNOWN;

  const secondary = (input.secondaryModules || []).map(normalizeModule);

  // V27.8: direct recruiter-visible module authority is the source of truth.
  // Previous V26 used calculateDomainAuthorityV3(), which rebuilt authority from
  // years + implementation + S/4 signals and caused low-authority MM/SD profiles
  // to score 95-97.
  const parsedDomainAuthority = calculateDomainAuthorityV3(input);
  const directAuthorityRaw = n(input.moduleAuthority);
  const directAuthority = directAuthorityRaw > 0
    ? clamp(directAuthorityRaw, 18, 97)
    : clamp(parsedDomainAuthority, 18, 97);

  const moduleFit =
    required === "UNKNOWN"
      ? directAuthority
      : primary === required
        ? directAuthority
        : secondary.includes(required)
          ? Math.min(directAuthority, 58)
          : 28;

  const projectAuthority = calculateProjectAuthorityV3(input);
  const financeDepth = calculateFinanceDepthV4(input);
  const logisticsDepth = calculateLogisticsDepthV26(input);
  const technicalDepth = calculateTechnicalDepthV26(input);
  const externalRoleComplexity = n(input.roleComplexity);
  const consultingDNA = calculateConsultingDNAV3Strict(input);
  const moduleAuthorityGate = directAuthority;
  const yearsGate = n(input.requiredYears) > 0 ? n(input.years) >= n(input.requiredYears) : true;
  const experience = calculateExperienceScore(input);
  const quality = clamp(n(input.profileQualityScore, 70), 20, 97);

  if (required !== "UNKNOWN" && primary !== required) {
    const lockedScore = required === "BTP" ? (secondary.includes(required) ? 55 : 35) : (secondary.includes(required) ? 58 : 40);
    return {
      calibratedScore: lockedScore,
      clientScore: lockedScore,
      percentileScore: lockedScore,
      clientTier: "Review",
      clientReady: false,
      recommendationSummary: `Recruiter review required: primary module is ${input.primaryModule}, not ${required}.`,
      recommendationBullets: [],
      riskFlags: [`Primary module lock: ${input.primaryModule} cannot be client-ready for ${required} role.`],
      rankingBreakdown: {
        moduleFit: lockedScore,
        projectAuthority,
        financeDepth: required === "FICO" ? financeDepth : Math.max(logisticsDepth, technicalDepth),
        consultingDNA,
        experience,
        quality,
      },
    };
  }

  let raw =
    moduleFit * weights.moduleAuthority +
    projectAuthority * weights.projectAuthority +
    financeDepth * weights.financeDepth +
    technicalDepth * weights.technicalDepth +
    logisticsDepth * weights.logisticsDepth +
    consultingDNA * weights.consultingDNA +
    experience * weights.experience +
    quality * weights.quality;

  const specialistDepth =
    externalRoleComplexity > 0
      ? externalRoleComplexity
      : required === "FICO"
        ? financeDepth
        : ["ABAP", "BASIS", "BW"].includes(required)
          ? technicalDepth
          : logisticsDepth;

  raw += fractionalTieBreakerV25(input, moduleFit, projectAuthority, specialistDepth, consultingDNA);

  if (input.contactMissing) raw = Math.min(raw, 74);
  if (input.nameReviewRequired) raw = Math.min(raw, 58);
  if (quality <= 60) raw = Math.min(raw, 76);
  if (projectAuthority < 72) raw = Math.min(raw, 82);
  if (specialistDepth < 68) raw = Math.min(raw, 84);

  let calibratedScore = clamp(raw, 35, 97);

  if (moduleFit >= 94 && moduleAuthorityGate >= 90 && projectAuthority >= 94 && specialistDepth >= 92 && consultingDNA >= 85) calibratedScore = Math.max(calibratedScore, 96);
  else if (moduleFit >= 92 && moduleAuthorityGate >= 88 && projectAuthority >= 88 && specialistDepth >= 84) calibratedScore = Math.max(calibratedScore, 92);
  if (projectAuthority < 70 || specialistDepth < 65) calibratedScore = Math.min(calibratedScore, 82);

  // V27.8: authority caps prevent internal top-ranking inflation.
  // Recruiter Review can still see these profiles, but they should not appear as 95-97.
  if (moduleAuthorityGate < 60) calibratedScore = Math.min(calibratedScore, 82);
  else if (moduleAuthorityGate < 70) calibratedScore = Math.min(calibratedScore, 88);
  else if (moduleAuthorityGate < 75) calibratedScore = Math.min(calibratedScore, 91);
  else if (moduleAuthorityGate < 80) calibratedScore = Math.min(calibratedScore, 93);

  calibratedScore = clamp(calibratedScore, 35, 97);

  const clientReady =
    calibratedScore >= 85 &&
    moduleFit >= 78 &&
    moduleAuthorityGate >= 75 &&
    projectAuthority >= 75 &&
    specialistDepth >= 75 &&
    quality >= 80 &&
    yearsGate &&
    !input.contactMissing &&
    !input.nameReviewRequired;

  let clientTier: BigCorpRankingResult["clientTier"] = "Review";
  if (clientReady && calibratedScore >= 95) clientTier = "A+";
  else if (clientReady && calibratedScore >= 90) clientTier = "A";
  else if (clientReady && calibratedScore >= 86) clientTier = "B";

  const depthLabel =
    required === "FICO"
      ? "Finance depth"
      : ["ABAP", "BASIS", "BW"].includes(required)
        ? "Technical depth"
        : "Module process depth";

  const riskFlags: string[] = [];
  if (projectAuthority < 75) riskFlags.push("Project authority below client-ready threshold.");
  if (specialistDepth < 75) riskFlags.push(`${depthLabel} below senior ${required} client-ready threshold.`);
  if (!yearsGate) riskFlags.push("Experience below client-ready requirement.");
  if (quality < 80) riskFlags.push("Profile quality requires recruiter review.");

  const recommendationBullets: string[] = [];
  if (moduleFit >= 92) recommendationBullets.push(`Strong ${required} module authority.`);
  if (projectAuthority >= 88) recommendationBullets.push("Strong implementation / rollout delivery evidence.");
  if (specialistDepth >= 88) recommendationBullets.push(`Advanced ${required} specialist depth.`);
  if (consultingDNA >= 85) recommendationBullets.push("Strong consulting delivery DNA.");
  if (n(input.s4hanaProjects) >= 5) recommendationBullets.push("Strong S/4HANA project exposure.");

  const recommendationSummary =
    clientTier === "A+"
      ? `Elite SaaS/BigCorp shortlist profile for ${required}.`
      : clientTier === "A"
        ? `Strong SaaS/BigCorp-ready ${required} profile; recommended for client shortlist.`
        : clientTier === "B"
          ? `Client-ready backup ${required} profile; suitable for broader shortlist coverage.`
          : "Recruiter review recommended before client submission.";

  return {
    calibratedScore,
    clientScore: calibratedScore,
    percentileScore: calibratedScore,
    clientTier,
    clientReady,
    recommendationSummary,
    recommendationBullets,
    riskFlags,
    rankingBreakdown: {
      moduleFit,
      projectAuthority,
      financeDepth: specialistDepth,
      consultingDNA,
      experience,
      quality,
    },
  };
}
