import { candidateProfileTimestampLabels } from "./candidateDuplicateIdentity";
type AnyRecord = Record<string, any>;

export type Candidate360Section = {
  label: string;
  value: string | number;
  hint?: string;
};

export type Candidate360TimelineItem = {
  title: string;
  company: string;
  period: string;
  description: string;
  tags: string[];
};

export type Candidate360ScoreBreakdown = {
  label: string;
  raw: number;
  weight: number;
  contribution: number;
  rationale: string;
};

export type Candidate360Model = {
  identity: {
    id: string;
    name: string;
    title: string;
    displayTitle: string;
    heroLine: string;
    leadershipHeadline: string;
    location: string;
    company: string;
    years: number;
    primaryModule: string;
    secondaryModules: string[];
    roleType: string;
    consultingLevel: string;
  };
  summary: {
    executiveSummary: string;
    recruiterPositioning: string;
    bestFor: string[];
    watchouts: string[];
  };
  contact: {
    email: string;
    phone: string;
    contactable: boolean;
    locked: boolean;
  };
  scorecard: {
    matchScore: number;
    aiConfidence: number;
    moduleAuthority: number;
    implementationAuthority: number;
    technicalDepth: number;
    consultingDNA: number;
    profileQuality: number;
    clientReady: boolean;
  };
  sapJourney: {
    expertiseLevel: string;
    careerLevel: string;
    modules: string[];
    signals: string[];
    moduleEvolution: Candidate360TimelineItem[];
  };
  projectPortfolio: {
    implementation: number;
    rollout: number;
    ams: number;
    migration: number;
    s4hana: number;
    ecc: number;
    greenfield: number;
    brownfield: number;
    total: number;
    maturityScore: number;
  };
  countryCoverage: {
    primaryCountry: string;
    countries: string[];
    regionalSignal: string;
    regionalCoverage: string;
    mobility: string[];
  };
  availability: {
    openStatus: string;
    planToOpen: string;
    noticePeriod: string;
    relocation: string;
    travelReadiness: string;
  };
  governance: {
    viewerRole: string;
    contactAccess: string;
    cvOpenCount: number;
    profileComments: number;
    lastUpdated: string;
    profileLastUpdatedAt: string;
    latestCvUploadedAt: string;
    latestCandidateSelfUpdateAt: string;
    updatedLabel: string;
    latestCvLabel: string;
  };
  marketBenchmark: {
    currency: string;
    p25: number;
    p50: number;
    p75: number;
    candidateExpectation: string | number;
    talentScarcity: string;
    noticeBenchmark: string;
    marketAvailability: string;
    expectedSearchTimeline: string;
    offerOutlook: string;
    marketBasis: string;
    marketPosition: string;
    benchmarkConfidence: string;
    salarySampleSize: string;
    benchmarkUpdated: string;
  };
  explainability: {
    whySelected: string[];
    validationNotes: string[];
    riskFlags: string[];
    scoreDrivers: Candidate360Section[];
    scoreBreakdown: Candidate360ScoreBreakdown[];
    scoreFormula: string;
    totalContribution: number;
    clientReadinessGate: string[];
    rankingRationale: string[];
    riskExplanation: string[];
    rankingPosition: string;
  };
};

function n(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function text(value: any, fallback = "To confirm"): string {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function arrayify(value: any): string[] {
  if (Array.isArray(value))
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed.map((x) => String(x || "").trim()).filter(Boolean);
    } catch {}
    return value
      .split(/[,;|]/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeModule(value: any): string {
  const raw = String(value || "UNKNOWN")
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP[-_]/i, "")
    .trim();

  const aliases: Record<string, string> = {
    BW4HANA: "BW/4HANA",
    BWHANA: "BW/4HANA",
    SUCCESSFACTORS: "SuccessFactors",
    INTEGRATIONSUITE: "Integration Suite",
    DATASPHERE: "Datasphere",
    ANALYTICSCLOUD: "SAC",
    BUSINESSTECHNOLOGYPLATFORM: "BTP",
  };

  const compact = raw.replace(/[\s/_-]/g, "");
  return aliases[compact] || raw;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((x) => x.trim()).filter(Boolean)));
}



function isBadIdentityText(value: any): boolean {
  const v = String(value || "").trim();
  if (!v) return true;
  return /^(current location|professional objective|career objective|profile summary|professional summary|personal details|contact details|position level|nationality|date of birth|review required)$/i.test(v) ||
    /^career history/i.test(v) ||
    /^(sap consultant|consultant|senior consultant)$/i.test(v);
}

function cleanCandidateName(value: any, fallback = "Review Required"): string {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (isBadIdentityText(raw)) return fallback;
  if (raw.length > 55) return fallback;
  return raw;
}

function cleanCandidateTitle(value: any, primaryModule = "SAP", fallback = ""): string {
  let title = String(value || "")
    .replace(/^career history\s*/i, "")
    .replace(/^(title|position|designation|current position|current title|role|job title)\s*[:\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (title.length > 90) title = title.slice(0, 90).replace(/\s+\S*$/, "").trim();
  if (!title || isBadIdentityText(title) || /^(for enhancements|key competencies|analytical problem solving|internally and externally)/i.test(title)) {
    const m = String(primaryModule || "SAP").replace(/^SAP\s+/i, "").toUpperCase();
    return fallback || (m && m !== "UNKNOWN" && m !== "SAP" ? `SAP ${m} Consultant` : "SAP Consultant");
  }
  return title;
}

function profilePositioningLabel(years: number, impl: number, s4: number, consultingLevel: string): string {
  const level = String(consultingLevel || "").toUpperCase();
  if (years <= 2) return "Early-career consultant profile";
  if (years < 5) return "Developing consultant profile";
  if (years < 9) return "Relevant consultant profile";
  if (years < 15) return impl >= 2 || s4 >= 1 ? "Experienced specialist profile" : "Relevant senior consultant profile";
  if (years < 20) return /MANAGER|LEAD|ARCHITECT/.test(level) ? "Lead consultant profile" : "Senior specialist profile";
  return /DIRECTOR|PRINCIPAL|SENIOR_MANAGER/.test(level) ? "Practice leadership profile" : "Senior specialist / lead profile";
}

function deliveryEvidenceLabel(implementation: number, rollout: number, s4hana: number, ams: number): string {
  if (implementation >= 5 || s4hana >= 5) return "Extensive delivery evidence";
  if (implementation >= 2 || rollout >= 2 || s4hana >= 2) return "Solid delivery evidence";
  if (implementation || rollout || s4hana || ams) return "Some project evidence";
  return "Project scope to validate";
}

function moduleHeadline(primaryModule: string, years: number, careerLevel: string): string {
  const m = String(primaryModule || "SAP").replace(/^SAP\s+/i, "").toUpperCase();
  if (years >= 20 && /director|principal|manager|architect/i.test(careerLevel)) return `SAP ${m} Practice / Delivery Leadership`;
  if (years >= 15) return `SAP ${m} Lead Consulting`;
  if (years >= 9) return `SAP ${m} Senior Consulting`;
  return `SAP ${m} Consulting`;
}

function buildBestForItems(primaryModule: string, years: number, implementation: number, rollout: number, ams: number, s4hana: number, consultingLevel: string): string[] {
  const m = String(primaryModule || "SAP").replace(/^SAP\s+/i, "").toUpperCase();
  const items: string[] = [];
  if (years < 5) items.push(`Junior / Consultant SAP ${m} roles`);
  else if (years < 10) items.push(`SAP ${m} Consultant roles`);
  else if (years < 16) items.push(`Senior SAP ${m} Consultant roles`);
  else if (/MANAGER|DIRECTOR|PRINCIPAL|ARCHITECT|LEAD/.test(String(consultingLevel || "").toUpperCase())) items.push(`SAP ${m} Lead / Manager roles`);
  else items.push(`Senior SAP ${m} specialist roles`);
  if (s4hana > 0) items.push("S/4HANA programs");
  if (implementation >= 2) items.push("Implementation programs");
  else if (implementation === 1) items.push("Implementation support / delivery roles");
  if (rollout > 0) items.push("Rollout projects");
  if (ams > implementation && ams > 0) items.push("AMS / production support roles");
  return unique(items).slice(0, 4);
}

function buildWatchouts(items: string[], implementation: number, s4hana: number, contactable: boolean): string[] {
  if (items.length) return items.slice(0, 4);
  const out = ["Confirm availability and notice period"];
  if (implementation <= 1) out.push("Validate full-cycle implementation ownership");
  if (s4hana === 0) out.push("Validate S/4HANA exposure if required");
  if (!contactable) out.push("Contact information needs enrichment");
  return out.slice(0, 4);
}

function formatDisplayDate(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "Not available";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function deriveCareerLevel(
  d: AnyRecord,
  years: number,
  implementation: number,
  moduleAuthority: number,
): string {
  const explicit = text(
    d.sapCareerLevel || d.careerLevel || d.career_level,
    "",
  );
  if (explicit && !/^to validate$/i.test(explicit)) return explicit;

  const title = String(
    d.title || d.current_title || d.headline || "",
  ).toLowerCase();
  if (title.includes("director") || title.includes("principal"))
    return "Principal Consultant / Director";
  if (
    title.includes("manager") ||
    title.includes("solution architect") ||
    title.includes("architect")
  ) {
    if (years >= 18 || implementation >= 7 || moduleAuthority >= 88)
      return "Principal Consultant / Director";
    return "Manager / Solution Architect";
  }
  if (title.includes("lead")) return "Lead Consultant";
  if (title.includes("senior") || title.includes("sr"))
    return "Senior Consultant";

  if (years >= 18 && (implementation >= 5 || moduleAuthority >= 85))
    return "Principal Consultant / Director";
  if (years >= 14) return "Manager / Solution Architect";
  if (years >= 10) return "Lead Consultant";
  if (years >= 7) return "Senior Consultant";
  return "Consultant";
}

function deriveConsultingLevel(careerLevel: string, d: AnyRecord): string {
  const explicit = String(d.consultingLevel || d.consulting_level || "")
    .trim()
    .toUpperCase();
  const career = String(careerLevel || "").toLowerCase();

  if (career.includes("director") || career.includes("principal"))
    return "DIRECTOR";
  if (career.includes("manager") || career.includes("architect"))
    return "SENIOR_MANAGER";
  if (career.includes("lead")) return "MANAGER";
  if (career.includes("senior")) return "SENIOR_CONSULTANT";
  return explicit || "CONSULTANT";
}

function cleanExecutiveTitle(value: any): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[：:]+$/g, "")
    .replace(/\s+in\s+the\s+domain\s+of\s+/i, " – ")
    .trim();
}

function buildExecutivePositioning(input: {
  rawTitle: any;
  careerLevel: string;
  primaryModule: string;
  years: number;
  location: string;
}) {
  const primary = String(input.primaryModule || "SAP").toUpperCase();
  const career = String(input.careerLevel || "");
  const raw = cleanExecutiveTitle(input.rawTitle);
  const isPrincipal =
    /principal|director/i.test(career) || /director|principal/i.test(raw);
  const isManager =
    /manager|architect/i.test(career) || /manager|architect/i.test(raw);

  let displayTitle = cleanCandidateTitle(raw, primary, career || `SAP ${primary} Consultant`);

  if (isPrincipal && !raw) displayTitle = `SAP ${primary} Practice Lead`;
  else if (isManager && !raw) displayTitle = `SAP ${primary} Lead Consultant`;
  else if (/consultant/i.test(career) && !raw) displayTitle = career;

  const leadershipHeadline = moduleHeadline(primary, input.years, career);
  const yearsLabel = input.years
    ? `${input.years} Years SAP Experience`
    : "SAP Experience to Validate";
  const heroLine = `${input.location || "APAC"} • ${primary === "UNKNOWN" ? "SAP" : `SAP ${primary}`} • ${yearsLabel}`;

  return { displayTitle, leadershipHeadline, heroLine };
}

function normalizeAvailabilitySignal(value: any, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (!raw || /^to confirm$/i.test(raw) || /^not available$/i.test(raw) || /^n\/a$/i.test(raw)) {
    return fallback;
  }

  const lower = raw.toLowerCase();
  if (lower.includes("recruiter validation") || lower.includes("validation required") || lower.includes("requires validation")) {
    return "To Be Confirmed";
  }
  if (lower.includes("not yet verified") || lower.includes("not verified") || lower.includes("not available")) {
    return "Pending Validation";
  }

  return raw;
}

function enrichCountryCoverage(
  d: AnyRecord,
  primaryCountry: string,
  years: number,
): string[] {
  const explicit = unique(
    [
      primaryCountry,
      ...arrayify(d.countryCoverage),
      ...arrayify(d.country_coverage),
      ...arrayify(d.countries),
      ...arrayify(d.projectCountries),
      ...arrayify(d.project_countries),
    ].filter(Boolean),
  );

  if (explicit.length > 1) return explicit;

  const raw = JSON.stringify(d).toLowerCase();
  const detected = [
    raw.includes("singapore") ? "Singapore" : "",
    raw.includes("malaysia") || raw.includes("kuala lumpur") ? "Malaysia" : "",
    raw.includes("indonesia") || raw.includes("jakarta") ? "Indonesia" : "",
    raw.includes("thailand") || raw.includes("bangkok") ? "Thailand" : "",
    raw.includes("philippines") || raw.includes("manila") ? "Philippines" : "",
    raw.includes("vietnam") ||
    raw.includes("ho chi minh") ||
    raw.includes("hanoi")
      ? "Vietnam"
      : "",
  ].filter(Boolean);

  const merged = unique([...explicit, ...detected]);

  return merged;
}

function buildScoreBreakdown(
  d: AnyRecord,
  matchScore: number,
): Candidate360ScoreBreakdown[] {
  const moduleAuthority = n(
    d.primaryModuleAuthority ?? d.moduleAuthority ?? d.module_authority_score,
  );
  const implementationAuthority = n(
    d.implementationAuthority ?? d.implementation_authority,
  );
  const depth = n(
    d.technicalDepth ?? d.financeDepth ?? d.roleComplexity ?? d.moduleDepth,
  );
  const consultingDNA = n(d.consultingDNA ?? d.consulting_dna);
  const profileQuality = n(
    d.profileQualityScore ?? d.profile_quality_score ?? d.quality,
  );
  const s4hana = n(
    d.s4hanaProjects ?? d.s4hana_project_count ?? d.s4_implementation_count,
  );
  const s4Score = Math.min(100, s4hana * 18 + (matchScore >= 85 ? 20 : 0));

  const rows = [
    {
      label: "Module Authority",
      raw: moduleAuthority || matchScore,
      weight: 30,
      rationale: "Primary SAP module alignment and trusted module evidence.",
    },
    {
      label: "Implementation Authority",
      raw: implementationAuthority || matchScore,
      weight: 24,
      rationale:
        "End-to-end implementation, rollout, migration, and delivery ownership signal.",
    },
    {
      label: "SAP Process / Technical Depth",
      raw: depth || matchScore,
      weight: 18,
      rationale:
        "Depth of SAP process or technical capability for the target role.",
    },
    {
      label: "Consulting DNA",
      raw: consultingDNA || Math.min(85, matchScore),
      weight: 12,
      rationale:
        "Client-facing consulting, workshops, blueprint, fit-gap, and leadership signal.",
    },
    {
      label: "S/4HANA & Transformation Signal",
      raw: s4Score || Math.min(75, matchScore),
      weight: 8,
      rationale: "Relevant S/4HANA transformation and modernization exposure.",
    },
    {
      label: "Profile Quality / Readiness",
      raw: profileQuality || 75,
      weight: 8,
      rationale:
        "Completeness, contact readiness, and confidence in parsed candidate data.",
    },
  ];

  return rows.map((row) => ({
    ...row,
    raw: Math.max(0, Math.min(100, Math.round(row.raw))),
    contribution: Math.round(
      (Math.max(0, Math.min(100, row.raw)) * row.weight) / 100,
    ),
  }));
}

function buildReadinessGate(d: AnyRecord, clientReady: boolean): string[] {
  const moduleScore = n(d.primaryModuleAuthority ?? d.moduleAuthority ?? d.module_authority_score);
  const implScore = n(d.implementationAuthority ?? d.implementation_authority);
  const qualityScore = n(d.profileQualityScore ?? d.profile_quality_score ?? d.quality);
  if (clientReady) {
    return [
      "Ready for Recruiter Review",
      moduleScore >= 75 ? "Primary module appears aligned" : "Module alignment needs final confirmation",
      implScore >= 75 ? "Delivery evidence found; confirm exact ownership" : "Delivery scope should be clarified",
      qualityScore >= 75 ? "Profile data is usable for recruiter review" : "Profile data requires enrichment",
    ];
  }
  return [
    "Recruiter Review Suggested",
    moduleScore >= 75 ? "Primary module appears aligned" : "Primary module needs confirmation",
    implScore >= 75 ? "Delivery evidence found; confirm exact ownership" : "Delivery evidence needs confirmation",
    qualityScore >= 75 ? "Profile data is usable but should be reviewed" : "Profile data requires enrichment before client submission",
  ];
}

function buildRankingRationale(
  d: AnyRecord,
  primaryModule: string,
  implementation: number,
  s4hana: number,
  years: number,
  matchScore: number,
): string[] {
  const title = cleanCandidateTitle(d.current_title || d.title || d.headline, primaryModule, `SAP ${primaryModule} Consultant`);
  const company = text(d.current_company || d.company, "");
  const rollout = n(d.rolloutProjects ?? d.rollout_project_count ?? d.rollout_count);
  const ams = n(d.amsProjects ?? d.ams_support_project_count ?? d.ams_count);
  const items = [
    `${title} with primary SAP ${primaryModule} positioning${company ? ` at ${company}` : ""}.`,
    years ? `${years} years SAP experience${implementation ? ` with ${implementation} implementation(s)` : ""}${s4hana ? ` and ${s4hana} S/4HANA program(s)` : ""}.` : "SAP experience duration should be validated.",
    rollout || ams ? `Delivery footprint includes ${rollout} rollout(s) and ${ams} AMS/support engagement(s).` : "Project delivery scope should be validated during recruiter screening.",
    matchScore >= 88 ? `Good SAP ${primaryModule} search alignment.` : `SAP ${primaryModule} fit should be confirmed before client submission.`,
  ];
  return items.filter(Boolean);
}

function buildRiskExplanation(d: AnyRecord, clientReady: boolean): string[] {
  const risks = arrayify(d.riskFlags).length
    ? arrayify(d.riskFlags)
    : arrayify(d.gaps);
  const base = risks.length
    ? risks
    : [
        "Confirm notice period and availability.",
        "Validate project ownership and implementation scope.",
        "Manage counter-offer risk early for high-demand SAP talent.",
      ];
  if (clientReady) return base;
  return [
    "Recruiter validation required before client submission.",
    ...base,
  ].slice(0, 5);
}

function candidateDetails(candidate: AnyRecord, match?: AnyRecord): AnyRecord {
  // Candidate / rebuilt search-index data must win over stale match.details.
  // This fixes cases where a profile is SD in candidate_search_index but 360 page
  // still reads an old ABAP/FICO module from match details.
  const indexRow = candidate?.__index || match?.__index || match?.details?.__index || {};
  const merged = {
    ...(match?.details || {}),
    ...(match || {}),
    ...(candidate || {}),
    __index: indexRow,
  };

  const indexPrimary = indexRow?.primary_module || indexRow?.primaryModule;
  if (indexPrimary) {
    merged.primary_module = indexPrimary;
    merged.primaryModule = indexPrimary;
  }

  return merged;
}

function getPrimaryModule(d: AnyRecord): string {
  // Strict source order: rebuilt candidate_search_index first, then candidates.
  // Never derive primary module from secondary_modules / sap_modules in 360.
  return normalizeModule(
    d.__index?.primary_module ||
      d.__index?.primaryModule ||
      d.primary_module ||
      d.primaryModule ||
      d.requiredModule ||
      d.sap_module ||
      d.module,
  );
}

function getSecondaryModules(d: AnyRecord): string[] {
  return unique(
    [
      ...arrayify(d.secondaryModules),
      ...arrayify(d.secondary_modules),
      ...arrayify(d.sap_modules),
      ...arrayify(d.sapModules),
      ...arrayify(d.sap_submodules),
    ]
      .map(normalizeModule)
      .filter((m) => m && m !== "UNKNOWN"),
  );
}

function getSapSignals(d: AnyRecord): string[] {
  return unique([
    ...arrayify(d.sapSignals),
    ...arrayify(d.signals),
    n(d.s4hanaProjects ?? d.s4hana_project_count) > 0 ? "S/4HANA" : "",
    n(d.eccProjects ?? d.ecc_projects) > 0 ? "ECC" : "",
    n(d.implementationProjects ?? d.implementation_project_count) > 0
      ? "Implementation"
      : "",
    n(d.rolloutProjects ?? d.rollout_project_count) > 0 ? "Rollout" : "",
    n(d.amsProjects ?? d.ams_support_project_count) > 0 ? "AMS" : "",
    n(d.migrationProjects ?? d.migration_project_count) > 0 ? "Migration" : "",
  ]);
}

function inferCountry(location: string): string {
  const l = location.toLowerCase();
  if (l.includes("singapore")) return "Singapore";
  if (
    l.includes("malaysia") ||
    l.includes("kuala lumpur") ||
    l.includes("selangor")
  )
    return "Malaysia";
  if (l.includes("philippines") || l.includes("manila")) return "Philippines";
  if (l.includes("indonesia") || l.includes("jakarta")) return "Indonesia";
  if (l.includes("vietnam") || l.includes("ho chi minh") || l.includes("hanoi"))
    return "Vietnam";
  if (l.includes("india") || l.includes("bangalore") || l.includes("bengaluru"))
    return "India";
  return location || "SEA";
}

function inferRegionalCoverage(countries: string[]): string {
  const normalized = countries.map((x) => x.toLowerCase());
  const sea = [
    "singapore",
    "malaysia",
    "indonesia",
    "thailand",
    "philippines",
    "vietnam",
  ].some((c) => normalized.includes(c));
  const apac =
    sea ||
    normalized.some((c) =>
      [
        "india",
        "china",
        "japan",
        "australia",
        "new zealand",
        "hong kong",
        "taiwan",
      ].includes(c),
    );
  if (apac) return "APAC";
  return countries.length > 1 ? "Regional" : "Local";
}

function inferMobilitySignal(countries: string[], years: number): string[] {
  const regionalCoverage = inferRegionalCoverage(countries);
  const mobility = ["SEA", regionalCoverage === "APAC" ? "APAC" : "Regional"];
  if (countries.length >= 2 || years >= 15) mobility.push("Global Delivery");
  return unique(mobility);
}

function compactLeadershipTitle(
  d: AnyRecord,
  careerLevel: string,
  primaryModule: string,
): { title: string; company: string } {
  const rawTitle = String(d.title || d.current_title || d.headline || "");
  const textTitle = rawTitle.toLowerCase();
  const executiveTitle = careerLevel || "SAP Transformation Leadership";

  if (
    textTitle.includes("cloud") ||
    textTitle.includes("s/4") ||
    textTitle.includes("s4") ||
    textTitle.includes("transformation") ||
    primaryModule === "BTP"
  ) {
    return {
      title: executiveTitle,
      company: "Cloud & SAP Transformation Leadership",
    };
  }

  return {
    title: executiveTitle,
    company: `${primaryModule} Transformation Leadership`,
  };
}

function buildModuleEvolution(d: AnyRecord): Candidate360TimelineItem[] {
  const primary = getPrimaryModule(d);
  const secondary = getSecondaryModules(d).filter((m) => m !== primary);
  const years = n(d.years ?? d.years_experience);
  const s4 = n(d.s4hanaProjects ?? d.s4hana_project_count ?? d.s4_implementation_count ?? d.s4_count);
  const impl = n(d.implementationProjects ?? d.implementation_project_count);
  const rollout = n(d.rolloutProjects ?? d.rollout_project_count ?? d.rollout_count);
  const ams = n(d.amsProjects ?? d.ams_support_project_count ?? d.ams_count);
  const moduleAuthority = n(d.primaryModuleAuthority ?? d.moduleAuthority ?? d.module_authority_score);
  const careerLevel = deriveCareerLevel(d, years, impl, moduleAuthority);
  const title = cleanCandidateTitle(d.current_title || d.title || d.headline, primary, careerLevel);
  const company = text(d.current_company || d.company, "");
  const stage = years >= 18 ? "Senior / leadership stage" : years >= 12 ? "Lead consultant stage" : years >= 7 ? "Senior consultant stage" : "Consultant stage";

  const items: Candidate360TimelineItem[] = [
    {
      title,
      company: company || `SAP ${primary} focus`,
      period: stage,
      description: `${years ? `${years} years` : "Validated"} SAP experience with primary focus on SAP ${primary}${secondary.length ? ` and adjacent exposure to ${secondary.slice(0, 3).join(", ")}` : ""}.`,
      tags: [primary, ...secondary.slice(0, 3)],
    },
  ];

  if (impl > 0) {
    items.push({
      title: "Implementation experience",
      company: "SAP project delivery",
      period: `${impl} implementation(s)`,
      description: impl >= 3 ? "Multiple implementation engagements detected; validate ownership, phase involvement and full-cycle scope." : "Implementation exposure detected; validate whether this was full-cycle, rollout support, or module-specific delivery.",
      tags: ["Implementation", impl >= 3 ? "Multi-project" : "Validate scope"],
    });
  }

  if (s4 > 0) {
    items.push({
      title: "S/4HANA exposure",
      company: "Modern SAP landscape",
      period: `${s4} S/4HANA program(s)`,
      description: "S/4HANA exposure detected in the profile; validate version, role ownership and project phase during screening.",
      tags: ["S/4HANA", "Modernization"],
    });
  }

  if (rollout > 0 || ams > 0) {
    items.push({
      title: rollout > 0 ? "Rollout / support delivery" : "AMS / support delivery",
      company: "Post-go-live delivery",
      period: `${rollout} rollout(s) · ${ams} AMS/support`,
      description: "Post-go-live delivery signal detected, useful for roles requiring production support, hypercare, enhancement or rollout experience.",
      tags: [rollout > 0 ? "Rollout" : "AMS", "Support"],
    });
  }

  return items;
}

function scoreDrivers(d: AnyRecord): Candidate360Section[] {
  return [
    {
      label: "Module Authority",
      value: n(
        d.primaryModuleAuthority ??
          d.moduleAuthority ??
          d.module_authority_score,
      ),
      hint: "Strength of primary SAP module alignment.",
    },
    {
      label: "Implementation Authority",
      value: n(d.implementationAuthority ?? d.implementation_authority),
      hint: "Depth of implementation, rollout, migration, and delivery ownership evidence.",
    },
    {
      label: "SAP Process / Technical Depth",
      value: n(
        d.technicalDepth ?? d.financeDepth ?? d.roleComplexity ?? d.moduleDepth,
      ),
      hint: "Depth of module-specific process or technical capability.",
    },
    {
      label: "Consulting DNA",
      value: n(d.consultingDNA ?? d.consulting_dna),
      hint: "Client-facing consulting, workshops, blueprint, fit-gap, and delivery leadership signal.",
    },
    {
      label: "Profile Quality",
      value: n(d.profileQualityScore ?? d.profile_quality_score ?? d.quality),
      hint: "Completeness and reliability of parsed candidate data.",
    },
  ].filter((x) => Number(x.value) > 0);
}


function parseObject(value: any): AnyRecord {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as AnyRecord;
      }
    } catch {}
  }
  return {};
}

function firstBenchmarkValue(...values: any[]) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}


function inferCurrencyByCountry(country: string): string {
  const normalized = String(country || "").trim().toLowerCase();
  if (normalized.includes("singapore")) return "SGD";
  if (normalized.includes("malaysia")) return "MYR";
  if (normalized.includes("philippines")) return "PHP";
  if (normalized.includes("indonesia")) return "IDR";
  if (normalized.includes("thailand")) return "THB";
  if (normalized.includes("vietnam")) return "VND";
  if (normalized.includes("india")) return "INR";
  if (normalized.includes("australia")) return "AUD";
  if (normalized.includes("new zealand")) return "NZD";
  if (normalized.includes("japan")) return "JPY";
  return "SGD";
}

function cleanBenchmarkLabel(value: any, fallback: string): string {
  const raw = String(firstBenchmarkValue(value, fallback) || fallback)
    .replace(/\s*\d+\s*\/\s*100\s*$/i, "")
    .trim();
  return raw || fallback;
}

function deriveMarketBenchmark(input: {
  d: AnyRecord;
  country: string;
  primaryModule: string;
  years: number;
  careerLevel: string;
  consultingLevel: string;
  clientReady: boolean;
  matchScore: number;
}): Candidate360Model["marketBenchmark"] {
  const { d, country, primaryModule, careerLevel } = input;
  const explicit = parseObject(d.marketBenchmark || d.marketIntelligence || d.benchmark);
  const moduleKey = normalizeModule(primaryModule);
  const currency = String(
    firstBenchmarkValue(
      explicit.currency,
      d.marketCurrency,
      d.salaryCurrency,
      inferCurrencyByCountry(country),
    ),
  );

  // Phase 54: market benchmark must come from salary_market_snapshot or
  // internal talent-pool percentile data prepared by the Candidate360 page.
  // No hardcoded country director benchmark or module multiplier is used here.
  const p25 = n(firstBenchmarkValue(explicit.p25, explicit.p25MarketRange, d.marketP25, d.salaryP25), 0);
  const p50 = n(firstBenchmarkValue(explicit.p50, explicit.p50MarketMedian, explicit.median, d.marketP50, d.salaryMedian), 0);
  const p75 = n(firstBenchmarkValue(explicit.p75, explicit.p75SeniorRange, d.marketP75, d.salaryP75), 0);

  return {
    currency,
    p25,
    p50,
    p75,
    candidateExpectation: firstBenchmarkValue(
      explicit.candidateExpectation,
      explicit.expectedSalary,
      d.candidateExpectation,
      d.expectedSalary,
      "To Be Confirmed",
    ),
    talentScarcity: cleanBenchmarkLabel(
      firstBenchmarkValue(explicit.talentScarcity, explicit.scarcityLabel, explicit.marketScarcity),
      "Scarce Talent Segment",
    ),
    noticeBenchmark: String(
      firstBenchmarkValue(
        explicit.noticeBenchmark,
        explicit.noticePeriodBenchmark,
        explicit.noticeWindow,
        "Needs Confirmation",
      ),
    ),
    marketAvailability: cleanBenchmarkLabel(
      firstBenchmarkValue(explicit.marketAvailability, explicit.availabilitySignal, explicit.sourcingMix),
      "Relationship-driven talent market",
    ),
    expectedSearchTimeline: String(
      firstBenchmarkValue(
        explicit.expectedSearchTimeline,
        explicit.searchTimeline,
        explicit.timeToShortlist,
        "Needs Confirmation",
      ),
    ),
    offerOutlook: cleanBenchmarkLabel(
      firstBenchmarkValue(explicit.offerOutlook, explicit.offerAcceptanceOutlook, explicit.offerSignal),
      "Favorable Engagement Outlook",
    ),
    marketBasis: String(
      firstBenchmarkValue(
        explicit.marketBasis,
        explicit.basis,
        explicit.sourceSummary,
        `${country} • SAP ${moduleKey} • ${careerLevel}\nBenchmark Sample Pending\nLive Internal Pool`,
      ),
    ),
    marketPosition: String(
      firstBenchmarkValue(
        explicit.marketPosition,
        explicit.market_position,
        d.marketPosition,
        d.market_position,
        "Needs Confirmation",
      ),
    ),
    benchmarkConfidence: String(
      firstBenchmarkValue(
        explicit.benchmarkConfidence,
        explicit.benchmark_confidence,
        d.benchmarkConfidence,
        d.benchmark_confidence,
        "Limited Benchmark Data",
      ),
    ),
    salarySampleSize: String(
      firstBenchmarkValue(
        explicit.salarySampleSize,
        explicit.salary_sample_size,
        explicit.sampleSize,
        explicit.sample_size,
        d.salarySampleSize,
        d.salary_sample_size,
        "Benchmark Sample Pending",
      ),
    ),
    benchmarkUpdated: String(
      firstBenchmarkValue(
        explicit.benchmarkUpdated,
        explicit.benchmark_updated,
        explicit.updatedAt,
        explicit.updated_at,
        d.benchmarkUpdated,
        d.benchmark_updated,
        "Live Internal Pool\n(Updated Today)",
      ),
    ),
  };
}

export function buildCandidate360(
  candidate: AnyRecord,
  match?: AnyRecord,
  options?: { viewerRole?: string; contactUnlocked?: boolean },
): Candidate360Model {
  const d = candidateDetails(candidate, match);
  const primaryModule = getPrimaryModule(d);
  const secondaryModules = getSecondaryModules(d).filter(
    (m) => m !== primaryModule,
  );
  const years = n(d.years ?? d.years_experience);
  const location = text(d.location || d.current_location, "N/A");
  const country = inferCountry(location);
  const moduleAuthority = n(
    d.primaryModuleAuthority ?? d.moduleAuthority ?? d.module_authority_score,
  );
  const implementationAuthority = n(
    d.implementationAuthority ?? d.implementation_authority,
  );
  const technicalDepth = n(
    d.technicalDepth ?? d.financeDepth ?? d.roleComplexity ?? d.moduleDepth,
  );
  const consultingDNA = n(d.consultingDNA ?? d.consulting_dna);
  const matchScore = n(
    d.score ?? d.matchScore ?? d.finalScore ?? d.calibratedScore,
  );
  const profileQuality = n(
    d.profileQualityScore ?? d.profile_quality_score ?? d.quality,
  );
  // Use a conservative readiness gate. Do not mark every parsed profile as client-ready.
  // Client readiness should mean strong module fit + reliable profile data + enough delivery evidence.
  const explicitClientReady = Boolean(
    d.clientReady ||
    d.isClientReady ||
    d.client_ready ||
    d.finalClientReady ||
    d.passesClientGate,
  );

  const clientReady = Boolean(
    explicitClientReady &&
      (profileQuality >= 80 || n(d.quality_score) >= 80) &&
      (matchScore >= 82 || moduleAuthority >= 82) &&
      (n(d.implementationProjects ?? d.implementation_projects ?? d.implementation_project_count) > 0 ||
        n(d.rolloutProjects ?? d.rollout_projects ?? d.rollout_project_count ?? d.rollout_count) > 0 ||
        n(d.s4hanaProjects ?? d.s4hana_projects ?? d.s4_implementation_projects ?? d.s4hana_project_count ?? d.s4_implementation_count ?? d.s4_count) > 0),
  );

  const implementation = n(
    d.implementationProjects ?? d.implementation_projects ?? d.implementation_project_count,
  );
  const rollout = n(d.rolloutProjects ?? d.rollout_projects ?? d.rollout_project_count ?? d.rollout_count);
  const ams = n(d.amsProjects ?? d.ams_projects ?? d.ams_support_project_count ?? d.ams_count);
  const migration = n(d.migrationProjects ?? d.migration_projects ?? d.migration_project_count);
  const s4hana = n(
    d.s4hanaProjects ?? d.s4hana_projects ?? d.s4_implementation_projects ?? d.s4hana_project_count ?? d.s4_implementation_count ?? d.s4_count,
  );
  const ecc = n(d.eccProjects ?? d.ecc_projects);
  const greenfield = n(d.greenfieldProjects ?? d.greenfield_projects ?? d.s4_greenfield_count ?? d.greenfield_count);
  const brownfield = n(d.brownfieldProjects ?? d.brownfield_projects ?? d.s4_conversion_count ?? d.brownfield_count);
  const total = n(
    d.totalProjects ?? d.total_project_count,
    implementation + rollout + ams + migration,
  );
  const maturityScore = Math.min(
    98,
    Math.round(
      (implementationAuthority || matchScore) * 0.65 +
        Math.min(implementation * 4 + s4hana * 2 + rollout, 32),
    ),
  );
  const careerLevel = deriveCareerLevel(
    d,
    years,
    implementation,
    moduleAuthority,
  );
  const consultingLevel = deriveConsultingLevel(careerLevel, d);
  const countryCoverage = enrichCountryCoverage(d, country, years);
  const regionalCoverage = inferRegionalCoverage(countryCoverage);
  const mobility = inferMobilitySignal(countryCoverage, years);
  const regionalSignal =
    countryCoverage.length > 1
      ? `Regional Coverage: ${regionalCoverage} · Countries Served: ${countryCoverage.length}`
      : `${country} market exposure`;
  const scoreBreakdown = buildScoreBreakdown(d, matchScore);
  const totalContribution = scoreBreakdown.reduce(
    (sum, row) => sum + row.contribution,
    0,
  );

  const email = text(d.email, "");
  const phone = text(d.phone, "");
  const viewerRole = options?.viewerRole || "recruiter";
  const contactUnlocked = Boolean(options?.contactUnlocked);

  const positioning = buildExecutivePositioning({
    rawTitle: d.title || d.current_title || d.headline,
    careerLevel,
    primaryModule,
    years,
    location,
  });

  const rawTitle = cleanCandidateTitle(d.current_title || d.title || d.headline, primaryModule, "");
  const employer = text(d.current_company || d.company, "");
  const projectPhrase = [
    implementation ? `${implementation} implementation program(s)` : "",
    rollout ? `${rollout} rollout(s)` : "",
    ams ? `${ams} AMS/support program(s)` : "",
    s4hana ? `${s4hana} S/4HANA program(s)` : "",
  ].filter(Boolean).join(", ");

  const cleanName = cleanCandidateName(d.name || d.candidate_name);
  const positionLabel = profilePositioningLabel(years, implementation, s4hana, consultingLevel);
  const deliveryLabel = deliveryEvidenceLabel(implementation, rollout, s4hana, ams);
  const experienceLine = years ? `${years} years SAP experience` : "SAP experience to confirm";
  const evidenceLine = projectPhrase ? ` Evidence found: ${projectPhrase}.` : " Project delivery scope should be validated from the CV.";
  const titleLine = rawTitle || `SAP ${primaryModule} Consultant`;
  const executiveSummary =
    d.executiveSummary ||
    `${cleanName} is positioned for SAP ${primaryModule} based on the rebuilt search index. Current profile signal: ${titleLine}${employer ? ` at ${employer}` : ""}. ${experienceLine}.${evidenceLine}`;

  const marketBenchmark = deriveMarketBenchmark({
    d,
    country,
    primaryModule,
    years,
    careerLevel,
    consultingLevel,
    clientReady,
    matchScore,
  });

  const bestFor = arrayify(d.bestFor).length
    ? arrayify(d.bestFor)
    : buildBestForItems(primaryModule, years, implementation, rollout, ams, s4hana, consultingLevel);

  const watchouts = arrayify(d.validationAreas).length
    ? arrayify(d.validationAreas)
    : arrayify(d.watchouts).length
      ? arrayify(d.watchouts).map((item) => {
          const lower = String(item || "").toLowerCase();
          if (lower.includes("notice") || lower.includes("availability"))
            return "Availability Confirmation";
          if (
            lower.includes("ownership") ||
            lower.includes("implementation") ||
            lower.includes("scope")
          )
            return "Engagement Scope Validation";
          if (
            lower.includes("counter") ||
            lower.includes("travel") ||
            lower.includes("mobility")
          )
            return "Mobility & Travel Alignment";
          return String(item || "").replace(/[.•]+$/g, "");
        })
      : buildWatchouts([], implementation, s4hana, Boolean(email || phone));

  const timestampLabels = candidateProfileTimestampLabels(d);

  return {
    identity: {
      id: text(d.id || d.candidate_id, ""),
      name: cleanName,
      title: rawTitle || positioning.displayTitle,
      displayTitle: rawTitle || positioning.displayTitle,
      heroLine: positioning.heroLine,
      leadershipHeadline: positioning.leadershipHeadline,
      location,
      company: employer || positioning.leadershipHeadline,
      years,
      primaryModule,
      secondaryModules,
      roleType: text(d.roleType || d.role_type, "SAP Consultant"),
      consultingLevel,
    },
    summary: {
      executiveSummary,
      recruiterPositioning: clientReady
        ? "Client-ready profile"
        : matchScore >= 85 || profileQuality >= 85
          ? "Recruiter validation profile"
          : matchScore >= 70 || profileQuality >= 70
            ? "Pipeline profile"
            : "Data review profile",
      bestFor,
      watchouts,
    },
    contact: {
      email,
      phone,
      contactable: Boolean(email || phone),
      locked: !contactUnlocked,
    },
    scorecard: {
      matchScore,
      aiConfidence: n(
        d.aiConfidenceV2 ?? d.aiConfidence ?? d.confidence,
        matchScore,
      ),
      moduleAuthority,
      implementationAuthority,
      technicalDepth,
      consultingDNA,
      profileQuality,
      clientReady,
    },
    sapJourney: {
      expertiseLevel: text(
        d.sapExpertiseLevel,
        moduleAuthority >= 88 && years >= 10
          ? "Advanced"
          : moduleAuthority >= 75
            ? "Validated"
            : "Requires validation",
      ),
      careerLevel,
      modules: unique([primaryModule, ...secondaryModules]),
      signals: getSapSignals(d),
      moduleEvolution: buildModuleEvolution(d),
    },
    projectPortfolio: {
      implementation,
      rollout,
      ams,
      migration,
      s4hana,
      ecc,
      greenfield,
      brownfield,
      total,
      maturityScore,
    },
    countryCoverage: {
      primaryCountry: country,
      countries: countryCoverage,
      regionalSignal,
      regionalCoverage,
      mobility,
    },
    availability: {
      openStatus: normalizeAvailabilitySignal(
        d.openStatus || d.open_status,
        "To Be Confirmed",
      ),
      planToOpen: normalizeAvailabilitySignal(
        d.planToOpen || d.plan_to_open,
        "To Be Confirmed",
      ),
      noticePeriod: normalizeAvailabilitySignal(
        d.noticePeriod || d.notice_period,
        "To Be Confirmed",
      ),
      relocation: normalizeAvailabilitySignal(d.relocation, "Pending Validation"),
      travelReadiness: normalizeAvailabilitySignal(
        d.travelReadiness || d.travel_readiness,
        "To Be Confirmed",
      ),
    },
    governance: {
      viewerRole,
      contactAccess: contactUnlocked
        ? "Contact Unlocked"
        : "Contact Protected",
      cvOpenCount: n(d.cvOpenCount ?? d.cv_open_count),
      profileComments: n(d.profileComments ?? d.profile_comments),
      lastUpdated: formatDisplayDate(
        timestampLabels.profileLastUpdatedAt || d.updated_at || d.status_updated_at || d.created_at,
      ),
      profileLastUpdatedAt: timestampLabels.profileLastUpdatedAt,
      latestCvUploadedAt: timestampLabels.latestCvUploadedAt,
      latestCandidateSelfUpdateAt: timestampLabels.latestCandidateSelfUpdateAt,
      updatedLabel: timestampLabels.updatedLabel,
      latestCvLabel: timestampLabels.latestCvLabel,
    },
    marketBenchmark,
    explainability: {
      whySelected: arrayify(d.whySelected).length
        ? arrayify(d.whySelected)
        : [
            `${primaryModule} module positioning`,
            implementation ? `${implementation} implementation program(s)` : "",
            s4hana ? `${s4hana} S/4HANA program(s)` : "",
            years ? `${years} years SAP experience` : "",
          ].filter(Boolean),
      validationNotes: arrayify(d.validationNotes).length
        ? arrayify(d.validationNotes)
        : [
            clientReady
              ? "Profile appears ready for recruiter-led client review."
              : "Recruiter validation required before client submission.",
          ],
      riskFlags: arrayify(d.riskFlags).length
        ? arrayify(d.riskFlags)
        : arrayify(d.gaps),
      scoreDrivers: scoreDrivers(d),
      scoreBreakdown,
      scoreFormula:
        "Module Authority 30% + Implementation 24% + SAP Depth 18% + Consulting DNA 12% + S/4HANA 8% + Profile Quality 8%",
      totalContribution,
      clientReadinessGate: buildReadinessGate(d, clientReady),
      rankingRationale: buildRankingRationale(
        d,
        primaryModule,
        implementation,
        s4hana,
        years,
        matchScore,
      ),
      riskExplanation: buildRiskExplanation(d, clientReady),
      rankingPosition: `#${n(d.ranking ?? d.rank ?? d.shortlistRank ?? d.position, 1)}`,
    },
  };
}
