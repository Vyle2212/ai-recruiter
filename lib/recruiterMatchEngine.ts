import { buildCandidateProfile } from "./candidateProfile";
import { calculateBigCorpRankingV26 } from "./clientRankingEngine";
import { validateCandidateNameV272, titleQualityCapV272, isBadCandidateTitleV272 } from "./candidateValidationEngine";
import { calculateRoleComplexity } from "./roleComplexityEngine";
import { calculateUniversalModuleFit, strictClientModuleGate } from "./sapKnowledgeGraph";
import { enrichCandidateWithSapTaxonomy } from "./sapTalentTaxonomy";
import {
  inferSapProfile,
  isWeakCandidateNameProduction,
  cleanPhoneProduction,
  fallbackNameFromEmail,
  normalizePersonNameProduction,
  normalizeCandidateFingerprint,
  textOf,
  normalizeSapModule,
  type SapPrimaryModule,
} from "./sapRecruiterRules";

type MatchResult = {
  score: number;
  label: string;
  confidence: "high" | "medium" | "low";
  strengths: string[];
  gaps: string[];
  details: Record<string, any>;
};

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanTitle(value: any) {
  return String(value || "")
    .replace(/^[-–—•\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE|JOB TITLE)\s*[:\-]\s*/i, "")
    .replace(/\s+at\s+(.+?)\s+at\s+\1\s*$/i, " - $1")
    .replace(/\b(SENIOR FI CONSULTANT)\b/i, "Senior SAP FI Consultant")
    .trim();
}

function jobRequiredModule(job: any): SapPrimaryModule {
  const explicit = normalizeSapModule(
    job?.primary_module ||
      job?.required_primary_module ||
      job?.module ||
      job?.sap_module
  );

  if (explicit !== "UNKNOWN") return explicit;

  const inferred = inferSapProfile({
    title: job?.title || job?.job_title,
    current_title: job?.job_title || job?.title,
    raw_text: textOf(job?.description, job?.requirements, job?.responsibilities, job?.raw_text, job?.raw_jd),
  });

  return inferred.primaryModule || "UNKNOWN";
}

function jobRequiredYears(job: any) {
  return n(job?.required_years || job?.years || job?.min_years, 7);
}

function hasBtpTextEvidence(candidate: any, profile: ReturnType<typeof extractCandidateSignals>) {
  const text = textOf(
    profile.title,
    profile.company,
    profile.primaryModule,
    profile.secondaryModules,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
    candidate?.rawText,
    candidate?.resumeText,
    candidate?.search_text,
    candidate?.searchText,
    candidate?.index_search_text,
    candidate?.search_text_index,
    candidate?.candidate_search_text
  ).toLowerCase();

  return [
    "btp",
    "business technology platform",
    "integration suite",
    "cloud integration",
    "sap cloud platform",
    "extension suite",
    "event mesh",
    "datasphere",
    "dwc",
    "sac",
    "analytics cloud",
    "cpi",
    "sap cpi",
    "pi/po",
    "fiori",
    "ui5",
    "cap",
    "sap cap",
    "cloud application programming",
    "rap",
    "restful abap",
  ].some((token) => text.includes(token));
}

function normalizeBtpToken(value: any) {
  return String(value || "")
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP-/i, "")
    .replace(/^SAP_/i, "")
    .replace(/&/g, "AND")
    .replace(/[\s/_-]/g, "")
    .replace(/\./g, "");
}


const BTP_UNRELATED_FUNCTIONAL_PRIMARY = [
  "FICO",
  "FI",
  "CO",
  "MM",
  "SD",
  "PP",
  "PM",
  "QM",
  "EWM",
  "TM",
  "WM",
  "PS",
  "ISU",
  "SUCCESSFACTORS",
  "HCM",
  "ARIBA",
];

const BTP_TECHNICAL_ADJACENT_PRIMARY = ["ABAP", "BASIS", "BW", "BW4HANA"];

function structuredCandidatePrimaryModule(candidate: any): SapPrimaryModule {
  return normalizeSapModule(
    candidate?.primary_module ||
      candidate?.primaryModule ||
      candidate?.module ||
      candidate?.sap_module ||
      candidate?.sapModule ||
      ""
  );
}

function structuredCandidateModules(candidate: any, profile?: ReturnType<typeof extractCandidateSignals>) {
  return [
    candidate?.primary_module,
    candidate?.primaryModule,
    candidate?.module,
    candidate?.sap_module,
    candidate?.sapModule,
    ...(Array.isArray(candidate?.secondary_modules) ? candidate.secondary_modules : []),
    ...(Array.isArray(candidate?.sap_modules) ? candidate.sap_modules : []),
    ...(Array.isArray(candidate?.sap_submodules) ? candidate.sap_submodules : []),
    ...(Array.isArray(profile?.secondaryModules) ? profile!.secondaryModules : []),
    ...Object.keys(profile?.moduleScores || {}),
  ]
    .map(normalizeBtpToken)
    .filter(Boolean);
}

function hasBtpStructuredModule(candidate: any, profile?: ReturnType<typeof extractCandidateSignals>) {
  const modules = structuredCandidateModules(candidate, profile);
  return modules.some((m) => m === "BTP" || m === "BUSINESSTECHNOLOGYPLATFORM");
}

function btpPrimaryCategory(primaryModule: any) {
  const primary = normalizeBtpToken(primaryModule);
  return {
    primary,
    unrelatedFunctional: BTP_UNRELATED_FUNCTIONAL_PRIMARY.includes(primary),
    technicalAdjacent: BTP_TECHNICAL_ADJACENT_PRIMARY.includes(primary),
  };
}

function btpRecruiterHardCap(input: {
  requiredModule: SapPrimaryModule;
  profile: ReturnType<typeof extractCandidateSignals>;
  evidence: ReturnType<typeof btpEcosystemEvidence>;
  candidate: any;
}) {
  if (input.requiredModule !== "BTP") return 100;

  const storedPrimary = structuredCandidatePrimaryModule(input.candidate);
  const effectivePrimary = normalizeSapModule(input.profile.primaryModule);
  const { unrelatedFunctional, technicalAdjacent } = btpPrimaryCategory(storedPrimary !== "UNKNOWN" ? storedPrimary : effectivePrimary);

  // Direct BTP must come from structured modules or title, not accidental raw text inference.
  const trustedDirect = storedPrimary === "BTP" || effectivePrimary === "BTP" || input.evidence.directTitle;
  if (trustedDirect) return 94;

  if (!input.evidence.any) return 50;

  if (input.evidence.strong) {
    if (unrelatedFunctional) return input.evidence.textOnlyStrong ? 74 : 78;
    if (technicalAdjacent) return input.evidence.textOnlyStrong ? 78 : 82;
    return input.evidence.textOnlyStrong ? 78 : 84;
  }

  if (input.evidence.medium) {
    if (unrelatedFunctional) return 70;
    if (technicalAdjacent) return 74;
    return 74;
  }

  return 50;
}

function btpEcosystemEvidence(candidate: any, profile: ReturnType<typeof extractCandidateSignals>) {
  const primary = normalizeBtpToken(profile.primaryModule);
  const secondary = (profile.secondaryModules || []).map(normalizeBtpToken);
  const moduleScores = Object.keys(profile.moduleScores || {}).map(normalizeBtpToken);

  const indexModules = [
    ...(Array.isArray(candidate?.index_all_modules) ? candidate.index_all_modules : []),
    ...(Array.isArray(candidate?.index_all_submodules) ? candidate.index_all_submodules : []),
  ].map(normalizeBtpToken);

  const allModules = Array.from(new Set([primary, ...secondary, ...moduleScores, ...indexModules])).filter(Boolean);

  const titleText = textOf(profile.title, candidate?.current_title, candidate?.title, candidate?.headline).toLowerCase();
  const raw = textOf(
    profile.title,
    profile.company,
    profile.primaryModule,
    profile.secondaryModules,
    profile.moduleScores,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
    candidate?.rawText,
    candidate?.resumeText,
    candidate?.search_text,
    candidate?.searchText,
    candidate?.index_search_text,
    candidate?.search_text_index,
    candidate?.candidate_search_text
  ).toLowerCase();

  const directModules = ["BTP", "BUSINESSTECHNOLOGYPLATFORM"];
  const strongModules = [
    "CPI",
    "INTEGRATIONSUITE",
    "CLOUDINTEGRATION",
    "DATASPHERE",
    "DWC",
    "SAC",
    "ANALYTICSCLOUD",
    "BUILDAPPS",
    "BUILDPROCESSAUTOMATION",
    "EVENTMESH",
  ];
  const mediumModules = ["CAP", "RAP", "FIORI", "UI5", "SAPUI5", "PIPO", "PI", "PO", "ABAP", "BW", "BASIS"];

  const directTitleTokens = ["sap btp", "business technology platform", "btp consultant", "btp architect", "btp developer"];
  const strongTitleTokens = [
    "integration suite",
    "sap integration suite",
    "cloud integration",
    "sap cpi",
    "datasphere",
    "sap analytics cloud",
    "analytics cloud",
    "event mesh",
    "build process automation",
    "build apps",
  ];
  const mediumTitleTokens = [
    "sap cap",
    "cloud application programming",
    "restful abap",
    "sap rap",
    "fiori",
    "sapui5",
    "ui5",
    "pi/po",
    "extension suite",
  ];

  const strongRawTokens = [
    "integration suite",
    "sap integration suite",
    "cloud integration",
    "sap cpi",
    " cpi",
    "datasphere",
    "dwc",
    "sap analytics cloud",
    "analytics cloud",
    "event mesh",
    "build process automation",
    "build apps",
  ];
  const mediumRawTokens = [
    " sap cap",
    "cloud application programming",
    " cap ",
    " restful abap",
    " rap ",
    "fiori",
    "sapui5",
    "ui5",
    "pi/po",
    "pi po",
    "extension suite",
  ];

  // V28.4: Direct BTP must be explicit primary/secondary/module evidence or title evidence only.
  // Do not treat generic raw/search_text mentions as direct BTP; they can be caused by keyword search.
  // Direct BTP must be trusted structured evidence. Do not let inferred primaryModule from raw/search text become direct BTP.
  const storedPrimaryForDirect = structuredCandidatePrimaryModule(candidate);
  const directModule = storedPrimaryForDirect === "BTP" || primary === "BTP";
  const directTitle = directTitleTokens.some((t) => titleText.includes(t));
  const direct = directModule || directTitle;

  const strongModule = allModules.some((m) => strongModules.includes(m));
  const strongTitle = strongTitleTokens.some((t) => titleText.includes(t));
  const strongRaw = strongRawTokens.some((t) => raw.includes(t));
  const strong = strongModule || strongTitle || strongRaw;

  const mediumModule = allModules.some((m) => mediumModules.includes(m));
  const mediumTitle = mediumTitleTokens.some((t) => titleText.includes(t));
  const mediumRaw = mediumRawTokens.some((t) => raw.includes(t));
  const medium = mediumModule || mediumTitle || mediumRaw;

  const evidenceModules = allModules.filter((m) => [...directModules, ...strongModules, ...mediumModules].includes(m));

  const textOnlyStrong = !direct && !strongModule && !strongTitle && strongRaw;
  const textOnlyMedium = !direct && !mediumModule && !mediumTitle && mediumRaw;

  return {
    direct,
    strong,
    medium,
    any: direct || strong || medium,
    evidenceModules,
    level: direct ? "direct" : strong ? "strong" : medium ? "medium" : "none",
    directModule,
    directTitle,
    strongModule,
    strongTitle,
    strongRaw,
    mediumModule,
    mediumTitle,
    mediumRaw,
    textOnlyStrong,
    textOnlyMedium,
    primary,
  };
}

function btpEcosystemScoreFloor(input: {
  evidence: ReturnType<typeof btpEcosystemEvidence>;
  implementationAuthority: number;
  displayedComplexity: number;
  consultingDNA: number;
  yearsScore: number;
  primaryModule?: string;
}) {
  // V28.4: BTP ecosystem evidence should be tiered, not inflated.
  // Direct BTP: 86-94
  // Strong platform evidence in title/modules: 74-84
  // Strong evidence only in raw/search text: 68-78
  // Medium adjacent evidence: 58-74
  // Unrelated functional primary modules with only adjacent evidence are capped lower.
  if (!input.evidence.any) return 45;

  const primary = normalizeBtpToken(input.primaryModule || input.evidence.primary || "");
  const unrelatedFunctionalPrimary = ["FICO", "FI", "CO", "MM", "SD", "PP", "PM", "QM", "EWM", "TM", "WM", "PS", "ISU", "SUCCESSFACTORS", "HCM", "ARIBA"].includes(primary);
  const technicalAdjacentPrimary = ["ABAP", "BASIS", "BW", "BW4HANA"].includes(primary);

  const deliveryBoost =
    (input.implementationAuthority >= 90 ? 3 : input.implementationAuthority >= 80 ? 2 : input.implementationAuthority >= 70 ? 1 : 0) +
    (input.displayedComplexity >= 90 ? 3 : input.displayedComplexity >= 80 ? 2 : input.displayedComplexity >= 70 ? 1 : 0) +
    (input.consultingDNA >= 90 ? 2 : input.consultingDNA >= 80 ? 1 : 0) +
    (input.yearsScore >= 100 ? 1 : 0);

  if (input.evidence.direct) return clamp(86 + deliveryBoost, 0, 94);

  if (input.evidence.strong) {
    if (input.evidence.textOnlyStrong && unrelatedFunctionalPrimary) return clamp(66 + deliveryBoost, 0, 74);
    if (input.evidence.textOnlyStrong) return clamp(68 + deliveryBoost, 0, 78);
    if (technicalAdjacentPrimary) return clamp(74 + deliveryBoost, 0, 82);
    if (unrelatedFunctionalPrimary) return clamp(70 + deliveryBoost, 0, 78);
    return clamp(74 + deliveryBoost, 0, 84);
  }

  if (input.evidence.medium) {
    if (unrelatedFunctionalPrimary) return clamp(58 + deliveryBoost, 0, 70);
    if (technicalAdjacentPrimary) return clamp(62 + deliveryBoost, 0, 74);
    return clamp(60 + deliveryBoost, 0, 74);
  }

  return 45;
}

function sapExperienceNarrative(input: {
  years: number;
  requiredModule: SapPrimaryModule;
  primaryModule: SapPrimaryModule | string;
  hasBtpEvidence: boolean;
}) {
  if (input.requiredModule === "BTP") {
    if (input.primaryModule === "BTP") {
      return `${input.years} years SAP experience with BTP / cloud transformation exposure`;
    }
    if (input.hasBtpEvidence) {
      return `${input.years} years SAP experience with BTP / cloud-platform exposure requiring recruiter validation`;
    }
  }
  return `${input.years} years SAP ${input.requiredModule !== "UNKNOWN" ? input.requiredModule : ""} experience`.replace(/\s+/g, " ").trim();
}

export function extractCandidateSignals(candidate: any) {
  const enrichedCandidate = enrichCandidateWithSapTaxonomy(candidate);
  const profile = buildCandidateProfile(enrichedCandidate);
  const sap = inferSapProfile({
    ...enrichedCandidate,
    name: profile.name,
    title: profile.title || enrichedCandidate?.current_title || enrichedCandidate?.title,
    current_title: enrichedCandidate?.current_title || enrichedCandidate?.title,
    primary_module: profile.primaryModule || enrichedCandidate?.primary_module,
    secondary_modules: profile.secondaryModules || enrichedCandidate?.secondary_modules,
    sap_modules: enrichedCandidate?.sap_modules,
    sap_submodules: enrichedCandidate?.sap_submodules,
    raw_text: enrichedCandidate?.raw_text || enrichedCandidate?.resume_text || enrichedCandidate?.raw_cv || enrichedCandidate?.rawText,
  });

  const email = candidate?.email || profile.email || null;
  const phone = cleanPhoneProduction(candidate?.phone || profile.phone) || null;
  const emailName = email ? fallbackNameFromEmail(email) : null;
  const weakName = isWeakCandidateNameProduction(profile.name);
  const name = normalizePersonNameProduction(profile.name, email);

  return {
    ...profile,
    name: isWeakCandidateNameProduction(name) ? "Review Required" : name,
    title: cleanTitle(profile.title || enrichedCandidate?.current_title || enrichedCandidate?.title),
    company: profile.company || enrichedCandidate?.current_company || enrichedCandidate?.company || "",
    email,
    phone,
    contactMissing: !email && !phone,
    primaryModule: sap.primaryModule,
    secondaryModules: sap.secondaryModules,
    roleType: sap.roleType,
    moduleAuthority: sap.moduleConfidence,
    financeDepth: sap.financeDepthScore,
    roleComplexity: sap.financeDepthScore,
    complexityLabel: "Role Complexity",
    consultingDNA: sap.consultingDNAScore,
    implementationAuthority: sap.implementationAuthorityScore,
    projectAuthority: sap.projectAuthority,
    nameReviewRequired: weakName || isWeakCandidateNameProduction(name),
    profileQualityScore: weakName ? Math.min(profile.profileQualityScore || 60, 60) : profile.profileQualityScore,
    moduleScores: sap.moduleScores,
    duplicateFingerprint: normalizeCandidateFingerprint(name, email, phone),
  };
}

function moduleFit(required: SapPrimaryModule, candidate: ReturnType<typeof extractCandidateSignals>) {
  const fit = calculateUniversalModuleFit({
    requiredModule: required,
    primaryModule: candidate.primaryModule,
    secondaryModules: candidate.secondaryModules,
    title: candidate.title,
    rawText: textOf(
      candidate.title,
      candidate.company,
      candidate.secondaryModules,
      Object.keys(candidate.moduleScores || {}),
      candidate.moduleScores
    ),
  });

  return {
    score: fit.score,
    cap: fit.cap,
    reason: fit.reason,
  };
}

function buildExplainableMatchBreakdown(input: {
  moduleFit: number;
  projectAuthority: number;
  processDepth: number;
  consultingDNA: number;
  experience: number;
  quality: number;
  availability: number;
}) {
  const weights = {
    moduleFit: 0.3,
    projectAuthority: 0.22,
    processDepth: 0.16,
    consultingDNA: 0.12,
    experience: 0.1,
    quality: 0.06,
    availability: 0.04,
  };

  const rows = [
    { key: "moduleFit", label: "SAP Module Fit", score: clamp(input.moduleFit), weight: weights.moduleFit },
    { key: "projectAuthority", label: "Implementation Fit", score: clamp(input.projectAuthority), weight: weights.projectAuthority },
    { key: "processDepth", label: "Process / Technical Depth", score: clamp(input.processDepth), weight: weights.processDepth },
    { key: "consultingDNA", label: "Consulting & Stakeholder Leadership", score: clamp(input.consultingDNA), weight: weights.consultingDNA },
    { key: "experience", label: "Experience Fit", score: clamp(input.experience), weight: weights.experience },
    { key: "quality", label: "Profile Quality", score: clamp(input.quality), weight: weights.quality },
    { key: "availability", label: "Contact / Availability", score: clamp(input.availability), weight: weights.availability },
  ];

  const weightedScore = clamp(rows.reduce((sum, row) => sum + row.score * row.weight, 0));

  return {
    version: "Match Algorithm V2",
    weightedScore,
    rows: rows.map((row) => ({
      ...row,
      weightPercent: Math.round(row.weight * 100),
      contribution: Math.round(row.score * row.weight),
    })),
  };
}

function buildMatchDrivers(input: {
  requiredModule: SapPrimaryModule;
  profile: ReturnType<typeof extractCandidateSignals>;
  implementationAuthority: number;
  consultingDNA: number;
  displayedComplexity: number;
  quality: number;
  finalScore: number;
}) {
  const drivers: string[] = [];
  const warnings: string[] = [];

  if (input.profile.primaryModule === input.requiredModule) {
    drivers.push(`Direct ${input.requiredModule} primary-module alignment.`);
  } else {
    warnings.push(`Primary module is ${input.profile.primaryModule}, not ${input.requiredModule}.`);
  }

  if (input.implementationAuthority >= 80) drivers.push(`Strong implementation authority: ${input.implementationAuthority}.`);
  else if (input.implementationAuthority < 70) warnings.push(`Implementation authority requires validation: ${input.implementationAuthority}.`);

  if (input.displayedComplexity >= 80) drivers.push(`Strong SAP process / technical depth: ${input.displayedComplexity}.`);
  if (input.consultingDNA >= 80) drivers.push(`Strong consulting delivery DNA: ${input.consultingDNA}.`);
  if (input.profile.s4hanaProjects >= 3) drivers.push(`${input.profile.s4hanaProjects} S/4HANA program(s) detected.`);
  if (input.profile.implementationProjects >= 5) drivers.push(`${input.profile.implementationProjects} end-to-end implementation program(s).`);
  if (input.quality < 75) warnings.push(`Profile quality requires recruiter enrichment: ${input.quality}.`);
  if (input.profile.contactMissing) warnings.push("Contact information needs validation before outreach.");
  if (input.finalScore >= 90) drivers.push("Top-tier ranking within the current match pool.");

  return {
    drivers: drivers.length ? drivers : ["Relevant SAP profile with recruiter validation recommended."],
    warnings: warnings.length ? warnings : ["No critical match warnings detected."],
  };
}

function scoreLabelV2(score: number, clientGatePass: boolean) {
  if (clientGatePass) return "Strong match";
  if (score >= 70) return "Recruiter review";
  if (score >= 55) return "Potential match";
  return "Weak match";
}

function scoreLabel(score: number) {
  if (score >= 85) return "Strong match";
  if (score >= 70) return "Good match";
  if (score >= 55) return "Potential match";
  return "Weak match";
}

function confidence(score: number, candidate: ReturnType<typeof extractCandidateSignals>) {
  if (score >= 75 && !candidate.nameReviewRequired && !candidate.contactMissing) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function recruiterModuleMatchTierV3(requiredModule: SapPrimaryModule, primaryModule: any, btpEvidence?: any) {
  const required = normalizeSapModule(requiredModule);
  const primary = normalizeSapModule(primaryModule);
  if (required === "UNKNOWN") return "unknown";
  if (primary === required) return "direct_primary";
  if (required === "BTP" && btpEvidence?.direct) return "direct_ecosystem";
  if (required === "BTP" && btpEvidence?.strong) return "strong_ecosystem";
  if (required === "BTP" && btpEvidence?.medium) return "adjacent_ecosystem";
  return "cross_module";
}

function calibrateRecruiterFinalScoreV3(input: {
  rawScore: number;
  requiredModule: SapPrimaryModule;
  primaryModule: any;
  years: number;
  quality: number;
  implementationAuthority: number;
  displayedComplexity: number;
  consultingDNA: number;
  implementationProjects: number;
  rolloutProjects: number;
  s4hanaProjects: number;
  contactMissing: boolean;
  nameReviewRequired: boolean;
  btpEvidence?: any;
}) {
  const tier = recruiterModuleMatchTierV3(input.requiredModule, input.primaryModule, input.btpEvidence);
  const base =
    tier === "direct_primary" ? 84 :
    tier === "direct_ecosystem" ? 80 :
    tier === "strong_ecosystem" ? 74 :
    tier === "adjacent_ecosystem" ? 64 :
    tier === "cross_module" ? 48 :
    62;

  let score = base;
  score += Math.min(5, Math.max(0, input.years >= 15 ? 5 : input.years >= 10 ? 4 : input.years >= 7 ? 3 : input.years >= 4 ? 2 : 0));
  score += Math.min(5, Math.max(0, (input.implementationAuthority - 65) / 7));
  score += Math.min(4, Math.max(0, (input.displayedComplexity - 65) / 8));
  score += Math.min(3, Math.max(0, (input.consultingDNA - 70) / 10));
  score += Math.min(4, input.implementationProjects * 0.9);
  score += Math.min(3, input.s4hanaProjects * 0.8);
  score += Math.min(2, input.rolloutProjects * 0.6);

  if (input.quality >= 88) score += 2;
  else if (input.quality < 75) score -= 5;
  if (input.contactMissing) score -= 4;
  if (input.nameReviewRequired) score -= 8;

  // Preserve existing hard caps from the detailed engine, but remove 99/100 inflation.
  score = Math.min(score, input.rawScore);

  const cap =
    tier === "direct_primary" ? 96 :
    tier === "direct_ecosystem" ? 92 :
    tier === "strong_ecosystem" ? 86 :
    tier === "adjacent_ecosystem" ? 78 :
    tier === "cross_module" ? 62 :
    82;

  return clamp(Math.min(score, cap), 35, 96);
}

export function calculateRecruiterMatch(job: any, candidate: any): MatchResult {
  const requiredModule = jobRequiredModule(job);
  const requiredYears = jobRequiredYears(job);
  const profile = extractCandidateSignals(candidate);
  const nameValidation = validateCandidateNameV272(profile.name, profile.email, candidate?.source_file || candidate?.sourceFile);
  if (nameValidation.cleanedName && nameValidation.cleanedName !== profile.name) {
    profile.name = nameValidation.cleanedName;
  }
  if (nameValidation.qualityCap !== null) {
    profile.nameReviewRequired = true;
    profile.profileQualityScore = Math.min(Number(profile.profileQualityScore || 0), nameValidation.qualityCap);
  }

  const titleCapV25 = titleQualityCapV272(profile.title);
  if (titleCapV25 !== null) {
    profile.profileQualityScore = Math.min(Number(profile.profileQualityScore || 0), titleCapV25);
    if (titleCapV25 <= 60) {
      profile.nameReviewRequired = true;
    }
  }

  if (isBadCandidateTitleV272(profile.title)) {
    profile.profileQualityScore = Math.min(Number(profile.profileQualityScore || 0), 20);
    profile.nameReviewRequired = true;
  }

  // V29: BTP module lock. If database/structured primary module says FICO/SD/ABAP/etc.,
  // do not allow raw keyword inference to silently promote it to BTP.
  const storedPrimaryModule = structuredCandidatePrimaryModule(candidate);
  if (requiredModule === "BTP" && storedPrimaryModule !== "UNKNOWN" && storedPrimaryModule !== "BTP") {
    const preBtpEvidence = btpEcosystemEvidence(candidate, profile);
    const hasTrustedDirectBtp = hasBtpStructuredModule(candidate, profile) || preBtpEvidence.directTitle;
    if (!hasTrustedDirectBtp) {
      profile.primaryModule = storedPrimaryModule;
    }
  }

  const fit = moduleFit(requiredModule, profile);
  const roleComplexity = calculateRoleComplexity(
    {
      ...candidate,
      ...profile,
      primaryModule: profile.primaryModule,
      secondaryModules: profile.secondaryModules,
      implementationProjects: profile.implementationProjects,
      rolloutProjects: profile.rolloutProjects,
      amsProjects: profile.amsProjects,
      s4hanaProjects: profile.s4hanaProjects,
      eccProjects: profile.eccProjects,
      rawText: candidate?.raw_text || candidate?.resume_text || candidate?.rawText || candidate?.resumeText,
    },
    requiredModule
  );

  const years = n(profile.years);
  const yearsScore = years >= requiredYears ? 100 : clamp((years / Math.max(requiredYears, 1)) * 100, 0, 85);

  const initialImplementationAuthority = n(profile.implementationAuthority);
  const initialFinanceDepth = n(roleComplexity.score || profile.financeDepth || 55);
  const initialConsultingDNA = n(profile.consultingDNA);
  const quality = n(profile.profileQualityScore, 70);

  const ranking = calculateBigCorpRankingV26({
    requiredModule,
    requiredYears,
    years,
    primaryModule: profile.primaryModule,
    secondaryModules: profile.secondaryModules,
    moduleAuthority: profile.moduleAuthority || fit.score,
    implementationAuthority: initialImplementationAuthority,
    financeDepth: initialFinanceDepth,
    roleComplexity: roleComplexity.score,
    complexityLabel: roleComplexity.label,
    consultingDNA: initialConsultingDNA,
    profileQualityScore: quality,
    implementationProjects: profile.implementationProjects,
    rolloutProjects: profile.rolloutProjects,
    amsProjects: profile.amsProjects,
    s4hanaProjects: profile.s4hanaProjects,
    eccProjects: profile.eccProjects,
    globalRolloutProjects: profile.rolloutProjects,
    candidateName: profile.name,
    sourceFile: candidate?.source_file || candidate?.sourceFile,
    rawText: candidate?.raw_text || candidate?.resume_text || candidate?.rawText || candidate?.resumeText,
    searchKeyword: requiredModule,
    title: profile.title,
    company: profile.company,
    contactMissing: profile.contactMissing,
    nameReviewRequired: profile.nameReviewRequired,
  });

  // V28.4: BTP ecosystem matching with recruiter-grade tiered caps.
  // Direct BTP / Integration Suite profiles can be Strong Match.
  // Adjacent evidence such as Fiori, CAP, RAP, PI/PO, ABAP, BW, BASIS should support ranking,
  // but must not inflate unrelated FICO / SD / MM / BASIS profiles to 90%+ for BTP Architect roles.
  const directPrimaryAuthorityForCap = Number(fit.score || 0);
  let finalScore = ranking.calibratedScore;
  const btpTextEvidence = requiredModule === "BTP" ? hasBtpTextEvidence(candidate, profile) : false;

  const implementationAuthority = ranking.rankingBreakdown.projectAuthority;
  const financeDepth = ranking.rankingBreakdown.financeDepth;
  const displayedComplexity = roleComplexity.score || financeDepth;
  const complexityLabel = roleComplexity.label || "Role Complexity";
  const consultingDNA = ranking.rankingBreakdown.consultingDNA;
  const btpEvidence = requiredModule === "BTP" ? btpEcosystemEvidence(candidate, profile) : { direct: false, strong: false, medium: false, any: false, evidenceModules: [], level: "none", directModule: false, directTitle: false, strongModule: false, strongTitle: false, strongRaw: false, mediumModule: false, mediumTitle: false, mediumRaw: false, textOnlyStrong: false, textOnlyMedium: false, primary: "" };

  if (profile.primaryModule !== requiredModule && requiredModule !== "UNKNOWN") {
    if (requiredModule === "BTP") {
      const btpFloor = btpEcosystemScoreFloor({
        evidence: btpEvidence,
        implementationAuthority,
        displayedComplexity,
        consultingDNA,
        yearsScore,
        primaryModule: profile.primaryModule,
      });

      if (btpEvidence.any || btpTextEvidence) {
        // V28.4 recruiter-grade caps:
        // Direct BTP: 86-94
        // Strong platform evidence in module/title: 74-84
        // Raw-text-only strong evidence: 68-78
        // Functional primary modules with only adjacent evidence should stay review/pipeline, not 90%+.
        const storedPrimaryForBtp = structuredCandidatePrimaryModule(candidate);
        const { unrelatedFunctional: unrelatedFunctionalPrimary, technicalAdjacent: technicalAdjacentPrimary } = btpPrimaryCategory(
          storedPrimaryForBtp !== "UNKNOWN" ? storedPrimaryForBtp : profile.primaryModule
        );
        const btpCap = btpEvidence.direct
          ? 94
          : btpEvidence.strong
            ? btpEvidence.textOnlyStrong && unrelatedFunctionalPrimary
              ? 74
              : btpEvidence.textOnlyStrong
                ? 78
                : technicalAdjacentPrimary
                  ? 82
                  : unrelatedFunctionalPrimary
                    ? 78
                    : 84
            : btpEvidence.medium
              ? unrelatedFunctionalPrimary
                ? 70
                : technicalAdjacentPrimary
                  ? 74
                  : 74
              : 50;
        finalScore = Math.min(Math.max(finalScore, btpFloor), btpCap);
      } else {
        finalScore = Math.min(finalScore, 50);
      }
    } else {
      finalScore = Math.min(finalScore, 60);
    }
  } else if (directPrimaryAuthorityForCap < 60) {
    finalScore = Math.min(finalScore, 82);
  } else if (directPrimaryAuthorityForCap < 70) {
    finalScore = Math.min(finalScore, 88);
  } else if (directPrimaryAuthorityForCap < 75) {
    finalScore = Math.min(finalScore, 91);
  } else if (directPrimaryAuthorityForCap < 80) {
    finalScore = Math.min(finalScore, 93);
  }

  if (requiredModule === "BTP" && profile.primaryModule === "BTP") {
    const directBtpFloor = btpEcosystemScoreFloor({
      evidence: { ...btpEvidence, direct: true, any: true, level: "direct" },
      implementationAuthority,
      displayedComplexity,
      consultingDNA,
      yearsScore,
      primaryModule: profile.primaryModule,
    });
    finalScore = Math.min(Math.max(finalScore, directBtpFloor), 94);
  }

  if (requiredModule === "BTP") {
    const hardCap = btpRecruiterHardCap({ requiredModule, profile, evidence: btpEvidence, candidate });
    finalScore = Math.min(finalScore, hardCap);
  }

  finalScore = calibrateRecruiterFinalScoreV3({
    rawScore: clamp(finalScore),
    requiredModule,
    primaryModule: profile.primaryModule,
    years,
    quality,
    implementationAuthority,
    displayedComplexity,
    consultingDNA,
    implementationProjects: n(profile.implementationProjects),
    rolloutProjects: n(profile.rolloutProjects),
    s4hanaProjects: n(profile.s4hanaProjects),
    contactMissing: profile.contactMissing,
    nameReviewRequired: profile.nameReviewRequired,
    btpEvidence,
  });

  const primaryModuleAuthority = Number(fit.score || 0);
  const displayDomainAuthority = Number(ranking.rankingBreakdown.moduleFit || profile.moduleAuthority || primaryModuleAuthority || 0);
  const moduleAuthorityGate = requiredModule === "BTP" && btpEvidence.any
    ? Math.max(primaryModuleAuthority, btpEvidence.direct ? 88 : btpEvidence.strong ? 74 : 64)
    : primaryModuleAuthority;

  const btpAdjacentClientCandidate = Boolean(
    requiredModule === "BTP" &&
      // Client-ready BTP should require direct BTP or strong platform evidence.
      // Medium evidence such as Fiori/CAP/RAP alone remains recruiter review.
      (btpEvidence.direct || btpEvidence.strong) &&
      finalScore >= (btpEvidence.direct ? 86 : 80) &&
      implementationAuthority >= 75 &&
      displayedComplexity >= 75 &&
      quality >= 78 &&
      !profile.contactMissing &&
      !profile.nameReviewRequired
  );

  const strictGate = strictClientModuleGate({
    requiredModule,
    primaryModule: profile.primaryModule,
    moduleFitScore: primaryModuleAuthority,
    contactMissing: profile.contactMissing,
    nameReviewRequired: profile.nameReviewRequired,
    allowBtpAdjacent: btpAdjacentClientCandidate,
  });

  // V28.1: Client Ready remains strict for all modules.
  // For BTP only, allow validated BTP-adjacent profiles such as CPI, Integration Suite,
  // CAP, Fiori, SAC, and Datasphere when project/depth/contact gates are strong.
  const clientGatePass = Boolean(
    strictGate.pass &&
      (requiredModule === "BTP" ? finalScore >= 80 : finalScore >= 85) &&
      implementationAuthority >= 75 &&
      displayedComplexity >= 75 &&
      ranking.rankingBreakdown.moduleFit >= (requiredModule === "BTP" ? 70 : 78) &&
      moduleAuthorityGate >= (requiredModule === "BTP" ? 74 : 75) &&
      quality >= (requiredModule === "BTP" ? 78 : 80) &&
      !profile.contactMissing &&
      !profile.nameReviewRequired &&
      (profile.primaryModule === requiredModule || btpAdjacentClientCandidate)
  );

  const experienceScore = years >= requiredYears ? 100 : clamp((years / Math.max(requiredYears, 1)) * 100, 0, 85);
  const availabilityScore = profile.contactMissing ? 45 : 90;
  const matchBreakdown = buildExplainableMatchBreakdown({
    moduleFit: ranking.rankingBreakdown.moduleFit,
    projectAuthority: implementationAuthority,
    processDepth: displayedComplexity,
    consultingDNA,
    experience: experienceScore,
    quality,
    availability: availabilityScore,
  });
  const matchNarrative = buildMatchDrivers({
    requiredModule,
    profile,
    implementationAuthority,
    consultingDNA,
    displayedComplexity,
    quality,
    finalScore,
  });

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (years >= requiredYears) strengths.push(`Experience meets requirement: ${years} years`);
  else gaps.push(`Experience below requirement: ${years}/${requiredYears} years`);

  if (profile.primaryModule === requiredModule) strengths.push(fit.reason);
  else if (requiredModule === "BTP" && (btpEvidence.any || btpTextEvidence)) {
    const evidenceLabel = btpEvidence.evidenceModules.length
      ? btpEvidence.evidenceModules.join(", ")
      : "BTP ecosystem evidence";
    strengths.push(`BTP ecosystem evidence detected (${evidenceLabel}); recruiter validation recommended.`);
  } else gaps.push(fit.reason);

  if (implementationAuthority >= 75) strengths.push(`Implementation authority: ${implementationAuthority}`);
  else gaps.push(`Implementation authority needs review: ${implementationAuthority}`);

  if (displayedComplexity >= 75) strengths.push(`${complexityLabel}: ${displayedComplexity}`);
  if (consultingDNA >= 75) strengths.push(`Consulting & Stakeholder Leadership score: ${consultingDNA}`);

  if (!clientGatePass) {
    const scoreGate = requiredModule === "BTP" ? 82 : 85;
    const implementationGate = requiredModule === "BTP" ? 70 : 75;
    const depthGate = requiredModule === "BTP" ? 70 : 75;
    const moduleFitGate = requiredModule === "BTP" ? 68 : 78;
    const authorityGate = requiredModule === "BTP" ? 72 : 75;
    const qualityGate = requiredModule === "BTP" ? 75 : 80;

    if (finalScore < scoreGate) gaps.push(`Client-ready gate: score below ${scoreGate}.`);
    if (implementationAuthority < implementationGate) gaps.push(`Client-ready gate: implementation authority below ${implementationGate}.`);
    if (displayedComplexity < depthGate) gaps.push(`Client-ready gate: ${complexityLabel} below ${depthGate}.`);
    if (ranking.rankingBreakdown.moduleFit < moduleFitGate) gaps.push(`Client-ready gate: module fit below ${moduleFitGate}.`);
    if (moduleAuthorityGate < authorityGate) gaps.push(`Client-ready gate: primary module authority below ${authorityGate}.`);
    if (quality < qualityGate) gaps.push(`Client-ready gate: profile quality below ${qualityGate}.`);
    if (profile.contactMissing) gaps.push("Client-ready gate: missing contact details.");
    if (profile.nameReviewRequired) gaps.push("Client-ready gate: name/title requires recruiter review.");
    if (profile.primaryModule !== requiredModule && !(requiredModule === "BTP" && (btpEvidence.any || btpTextEvidence))) {
      gaps.push(`Client-ready gate: primary module is ${profile.primaryModule}, not ${requiredModule}.`);
    }
  }

  for (const risk of ranking.riskFlags) {
    if (!gaps.includes(risk)) gaps.push(risk);
  }

  if (!gaps.length) gaps.push("No critical gaps.");

  return {
    score: finalScore,
    label: scoreLabelV2(finalScore, clientGatePass),
    confidence: confidence(finalScore, profile),
    strengths,
    gaps,
    details: {
      name: profile.name,
      title: profile.title,
      company: profile.company,
      email: profile.email,
      phone: profile.phone,
      years,
      location: profile.location,
      primaryModule: profile.primaryModule,
      secondaryModules: profile.secondaryModules,
      // V27.6: keep two separate concepts.
      // primaryModuleAuthority = direct evidence for the required primary module, used for client-ready gate.
      // domainAuthority = broader authority/ranking percentile, used for recruiter-grade ranking.
      moduleAuthority: primaryModuleAuthority,
      primaryModuleAuthority,
      moduleAuthorityGate,
      domainAuthority: displayDomainAuthority,
      moduleScores: profile.moduleScores,
      roleType: profile.roleType,
      consultingLevel: profile.consultingLevel,
      implementationProjects: profile.implementationProjects,
      rolloutProjects: profile.rolloutProjects,
      amsProjects: profile.amsProjects,
      s4hanaProjects: profile.s4hanaProjects,
      eccProjects: profile.eccProjects,
      implementationAuthority,
      financeDepth: displayedComplexity,
      financeDepthLabel: complexityLabel,
      engineDepthLabel: complexityLabel,
      roleComplexity: displayedComplexity,
      roleComplexityLabel: complexityLabel,
      complexityLabel,
      complexityDisplayLabel: complexityLabel,
      complexityStrengths: roleComplexity.strengths,
      consultingDNA,
      roleFit: ranking.rankingBreakdown.moduleFit,
      moduleFit: ranking.rankingBreakdown.moduleFit,
      requiredModule,
      requiredYears,
      experienceNarrative: sapExperienceNarrative({
        years,
        requiredModule,
        primaryModule: profile.primaryModule,
        hasBtpEvidence: btpTextEvidence,
      }),
      btpEvidenceLevel:
        requiredModule === "BTP"
          ? profile.primaryModule === "BTP"
            ? "Direct BTP primary"
            : btpEvidence.direct
              ? "Direct BTP ecosystem evidence"
              : btpEvidence.strong
                ? "Strong BTP ecosystem evidence"
                : btpEvidence.medium || btpTextEvidence
                  ? "BTP-adjacent ecosystem evidence"
                  : "No clear BTP evidence"
          : undefined,
      btpEcosystemEvidence: requiredModule === "BTP" ? btpEvidence : undefined,
      projectAuthority: profile.projectAuthority,
      confidence: confidence(finalScore, profile),
      profileQualityScore: ranking.rankingBreakdown.quality,
      contactMissing: profile.contactMissing,
      // V27.5: one source of truth for every UI/API label.
      // If this is false, the profile must NEVER display as Client Ready, even in Internal Mode.
      clientReady: Boolean(clientGatePass),
      isClientReady: Boolean(clientGatePass),
      client_ready: Boolean(clientGatePass),
      clientSafe: Boolean(clientGatePass),
      clientGatePass,
      finalClientReady: Boolean(clientGatePass),
      passesClientGate: Boolean(clientGatePass),
      clientTier: clientGatePass ? ranking.clientTier : "Review",
      status: clientGatePass ? "Client Ready" : "Recruiter Review",
      recommendation: clientGatePass ? "Client Ready" : "Recruiter Review",
      displayStatus: clientGatePass ? "Client Ready" : "Recruiter Review",
      badgeLabel: clientGatePass ? "Client Ready" : "Recruiter Review",
      strongMatch: Boolean(clientGatePass),
      isStrongMatch: Boolean(clientGatePass),
      clientScore: ranking.clientScore,
      percentileScore: ranking.percentileScore,
      recommendationSummary: ranking.recommendationSummary,
      recommendationBullets: ranking.recommendationBullets,
      riskFlags: ranking.riskFlags,
      rankingBreakdown: ranking.rankingBreakdown,
      matchAlgorithmVersion: "V40-recruiter-scoring-v3-unified",
      matchBreakdown,
      matchDrivers: matchNarrative.drivers,
      matchWarnings: matchNarrative.warnings,
      explainableMatch: {
        overallScore: finalScore,
        clientGatePass: Boolean(clientGatePass),
        breakdown: matchBreakdown.rows,
        drivers: matchNarrative.drivers,
        warnings: matchNarrative.warnings,
      },
      nameReviewRequired: profile.nameReviewRequired,
    },
  };
}

export const calculateRecruiterGradeMatch = calculateRecruiterMatch;
