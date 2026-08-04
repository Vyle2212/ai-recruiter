export type CandidateRow = Record<string, any>;

export type SearchIndexRow = Record<string, any>;

function n(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: any): string {
  return String(value ?? "").trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase())
    .replace(/\bSap\b/g, "SAP")
    .replace(/\bAbap\b/g, "ABAP")
    .replace(/\bFico\b/g, "FICO")
    .replace(/\bSd\b/g, "SD")
    .replace(/\bMm\b/g, "MM");
}

export function cleanModule(value: any): string | null {
  const v = text(value)
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/[\s/-]+/g, "_");

  if (!v || v === "UNKNOWN" || v === "NULL" || v === "N/A") return null;

  const map: Record<string, string> = {
    FI_CO: "FICO",
    FICO: "FICO",
    FI: "FICO",
    CO: "FICO",
    SD: "SD",
    MM: "MM",
    ABAP: "ABAP",
    BASIS: "BASIS",
    BTP: "BTP",
    SUCCESSFACTORS: "SUCCESSFACTORS",
    SUCCESS_FACTORS: "SUCCESSFACTORS",
    HCM: "SUCCESSFACTORS",
    HXM: "SUCCESSFACTORS",
    BW: "BW",
    BW4HANA: "BW4HANA",
    BW_4HANA: "BW4HANA",
    EWM: "EWM",
    TM: "TM",
    PP: "PP",
    PM: "PM",
    QM: "QM",
    PS: "PS",
    SECURITY: "SECURITY",
    GRC: "SECURITY",
    MDG: "MDG",
    DATASPHERE: "DATASPHERE",
    SAC: "SAC",
    HANA: "HANA",
    IS_U: "IS_U",
    ISU: "IS_U",
  };

  return map[v] || v;
}


const INVALID_SEARCH_MODULES = new Set(["", "UNKNOWN", "NULL", "N/A", "ALL", "ANY", "SAP", "GENERAL_SAP", "SAP_GENERAL"]);

function normalizeIndexModule(value: any): string | null {
  const raw = text(value)
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/CO\s*[-/]?\s*PA/g, "COPA")
    .replace(/BW\s*\/\s*4\s*HANA/g, "BW4HANA")
    .replace(/PI\s*\/\s*PO/g, "PI_PO")
    .replace(/RE\s*[-/]?\s*FX/g, "RE_FX")
    .replace(/IS\s*[-/]?\s*U/g, "IS_U")
    .replace(/FS\s*[-/]?\s*CD/g, "FS_CD")
    .replace(/[.]/g, "")
    .replace(/[\s/-]+/g, "_")
    .trim();

  const module = cleanModule(raw);
  if (!module || INVALID_SEARCH_MODULES.has(module)) return null;
  return module;
}

function isModuleAllowedForPrimary(primary: any, module: any): boolean {
  const p = normalizeIndexModule(primary);
  const m = normalizeIndexModule(module);
  if (!p || !m) return false;
  if (m === p) return true;

  const allowedByPrimary: Record<string, Set<string>> = {
    BTP: new Set(["CPI", "FIORI", "UI5", "CAP", "RAP", "BAS", "BUILD", "KYMA", "HANA", "ABAP", "INTEGRATION_SUITE"]),
    SUCCESSFACTORS: new Set(["EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "COMPENSATION", "HCM"]),
    FICO: new Set(["FI", "CO", "GL", "AP", "AR", "AA", "COPA", "CFIN", "FSCM", "TRM", "BCM", "GR", "BPC", "RAR", "RE_FX", "PSM", "FM"]),
    BW: new Set(["BI", "BW4HANA", "SAC", "DATASPHERE", "BPC", "BOBJ", "HANA"]),
    BASIS: new Set(["SECURITY", "GRC", "HANA", "SOLMAN", "NETWEAVER"]),
    ABAP: new Set(["FIORI", "UI5", "CDS", "AMDP", "ODATA", "BAPI", "BADI", "IDOC", "FORMS"]),
    MM: new Set(["WM", "EWM", "ARIBA", "P2P", "SRM", "VIM"]),
    SD: new Set(["OTC", "O2C", "LE", "TM", "CRM", "C4C"]),
    PP: new Set(["QM", "PM", "PPDS", "APO"]),
    PM: new Set(["EAM", "CS", "PS"]),
    PS: new Set(["PM", "CO", "CPM"]),
    EWM: new Set(["WM", "TM", "YARD"]),
    TM: new Set(["EWM", "LE"]),
  };

  return Boolean(allowedByPrimary[p]?.has(m));
}

function filterModulesForPrimary(primary: string, values: any[]): string[] {
  return unique(
    values
      .map(normalizeIndexModule)
      .filter((module): module is string => Boolean(module))
      .filter((module) => isModuleAllowedForPrimary(primary, module))
  );
}


function arr(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(String).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((x) => x.trim()).filter(Boolean);
      }
    } catch {
      return value.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

function unique(values: any[]): string[] {
  return Array.from(new Set(values.map((x) => text(x)).filter(Boolean)));
}

function hasContact(c: CandidateRow): boolean {
  return Boolean(text(c.email) || text(c.phone));
}

function maskEmail(email: any): string | null {
  const e = text(email);
  if (!e.includes("@")) return null;
  const [name, domain] = e.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: any): string | null {
  const p = text(phone);
  const digits = p.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return `${p.slice(0, 3)} ***** ${digits.slice(-3)}`;
}

const GARBAGE_NAME_PATTERNS = [
  "current location",
  "professional objective",
  "position level",
  "capital market",
  "internally and externally",
  "review required",
  "personal particular",
  "personal particulars",
  "key competencies",
  "for enhancements",
  "authorization matrix",
  "robot framework",
  "hobbies",
  "procedures",
  "test scripts",
  "need for resources",
  "and need for resources",
  "career objective",
  "professional summary",
  "technical skills",
  "responsibilities",
  "candidate information",
  "full name",
  "software testing",
  "curriculum vitae",
  "resume",
  "profile summary",
];

function isGarbageName(value: any): boolean {
  const v = text(value);
  if (!v) return true;

  const lower = v.toLowerCase();

  if (lower.includes("@")) return true;
  if (v.length < 3 || v.length > 80) return true;
  if (/^\d+$/.test(v)) return true;
  if (GARBAGE_NAME_PATTERNS.some((p) => lower.includes(p))) return true;

  const wordCount = v.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6) return true;

  return false;
}

function extractNameFromRawText(raw: any): string | null {
  const rawText = text(raw);
  if (!rawText) return null;

  const lines = rawText
    .split(/\r?\n| {2,}/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);

  for (const line of lines) {
    const cleaned = line
      .replace(/^full\s*name\s*[:\-]\s*/i, "")
      .replace(/^name\s*[:\-]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      cleaned.length >= 5 &&
      cleaned.length <= 60 &&
      /^[A-Z][A-Z\s.'’@-]+$/i.test(cleaned) &&
      !isGarbageName(cleaned) &&
      !/\b(SAP|ABAP|FICO|SD|MM|BASIS|DELOITTE|CONSULTANT|MANAGER|LEAD|TESTING|FRAMEWORK)\b/i.test(cleaned)
    ) {
      return titleCase(cleaned);
    }
  }

  return null;
}

function cleanDisplayName(c: CandidateRow): string {
  const candidates = [c.name, c.candidate_name, c.full_name, c.display_name]
    .map(text)
    .filter(Boolean);

  for (const item of candidates) {
    if (!isGarbageName(item)) return item;
  }

  const extracted = extractNameFromRawText(
    c.raw_text || c.resume_text || c.raw_cv || c.experience || c.summary
  );

  if (extracted && !isGarbageName(extracted)) return extracted;

  const email = text(c.email);
  if (email.includes("@")) {
    const fromEmail = email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());

    if (!isGarbageName(fromEmail)) return fromEmail;
  }

  return "Profile Under Review";
}

function cleanDisplayTitle(c: CandidateRow): string | null {
  const title = text(c.current_title || c.title || c.headline);
  if (!title) return null;

  const badExact = new Set([
    "current location",
    "professional objective",
    "position level",
    "capital market",
    "internally and externally.",
    "review required",
    "personal particular",
    "personal particulars",
  ]);

  if (badExact.has(title.toLowerCase())) return null;
  return title.length > 180 ? title.slice(0, 180) : title;
}

function countryOf(c: CandidateRow): string | null {
  return text(c.country || c.current_location || c.location) || null;
}

function yearsOf(c: CandidateRow): number {
  const y = n(c.years ?? c.years_experience ?? c.years_of_experience);
  if (y > 0) return y;
  const months = n(c.calculated_experience_months);
  return months > 0 ? Math.round((months / 12) * 10) / 10 : 0;
}

function projectCounts(c: CandidateRow) {
  return {
    implementation: n(c.implementation_project_count ?? c.implementation_projects),
    rollout: n(c.rollout_project_count ?? c.rollout_projects),
    ams: n(
      c.ams_support_project_count ??
        c.ams_project_count ??
        c.ams_projects ??
        c.support_projects
    ),
    s4: n(
      c.s4hana_project_count ??
        c.s4hana_projects ??
        c.s4_implementation_count ??
        c.s4_implementation_projects
    ),
    s4ams: n(c.s4_ams_projects ?? c.s4_support_count),
    greenfield: n(c.greenfield_projects ?? c.s4_greenfield_count),
    brownfield: n(c.brownfield_projects ?? c.s4_conversion_count),
  };
}

function qualityScore(c: CandidateRow, primaryModule: string | null): number {
  const p = projectCounts(c);
  const years = yearsOf(c);
  const displayName = cleanDisplayName(c);
  const displayTitle = cleanDisplayTitle(c);
  const consultingFirmCount = arr(c.consulting_firm_evidence).length;

  let score = 42;

  if (primaryModule) score += 15;
  if (displayName !== "Profile Under Review") score += 12;
  if (displayTitle) score += 8;
  if (hasContact(c)) score += 10;

  if (years >= 3) score += 4;
  if (years >= 7) score += 4;
  if (years >= 12) score += 3;
  if (years >= 18) score += 2;

  if (p.implementation > 0) score += 4;
  if (p.implementation >= 3) score += 3;
  if (p.s4 > 0) score += 3;
  if (p.s4 >= 3) score += 2;
  if (p.rollout > 0) score += 2;
  if (p.ams > 0) score += 2;
  if (consultingFirmCount > 0) score += 3;

  if (!hasContact(c)) score -= 14;
  if (displayName === "Profile Under Review") score -= 18;
  if (!displayTitle) score -= 8;
  if (years <= 0) score -= 6;
  if (!p.implementation && !p.rollout && !p.ams && !p.s4) score -= 6;

  return Math.max(35, Math.min(94, Math.round(score)));
}

function buildProjectTypes(p: ReturnType<typeof projectCounts>): string[] {
  return [
    p.implementation > 0 ? "IMPLEMENTATION" : null,
    p.rollout > 0 ? "ROLLOUT" : null,
    p.ams > 0 ? "AMS" : null,
    p.s4 > 0 ? "S4" : null,
    p.greenfield > 0 ? "GREENFIELD" : null,
    p.brownfield > 0 ? "BROWNFIELD" : null,
  ].filter(Boolean) as string[];
}

export function buildSearchIndexRow(c: CandidateRow): SearchIndexRow | null {
  // Production rule: search index must not invent a primary module.
  // Parser/saveCandidate owns primary_module; index builder only trusts it.
  const primaryModule = normalizeIndexModule(c.primary_module);
  if (!primaryModule) return null;

  const secondaryModules = filterModulesForPrimary(primaryModule, arr(c.secondary_modules));
  const sapModules = filterModulesForPrimary(primaryModule, arr(c.sap_modules));
  const skills = filterModulesForPrimary(primaryModule, arr(c.skills));
  const submodules = filterModulesForPrimary(primaryModule, arr(c.sap_submodules));

  const p = projectCounts(c);
  const displayName = cleanDisplayName(c);
  const displayTitle = cleanDisplayTitle(c);
  const displayCompany = text(c.current_company || c.company) || null;
  const displayLocation = text(c.current_location || c.location || c.country) || null;

  const allModules = filterModulesForPrimary(primaryModule, [
    primaryModule,
    ...secondaryModules,
    ...sapModules,
    ...skills,
    ...submodules,
  ]);

  return {
    candidate_id: c.id,
    primary_module: primaryModule,
    all_modules: allModules,
    all_submodules: submodules,
    country: countryOf(c),
    city: c.city ?? null,
    years: yearsOf(c),
    role_type: c.role_type ?? null,
    consulting_level: c.consulting_level ?? null,
    company_type: c.company_type ?? null,
    consulting_firms: arr(c.consulting_firm_evidence),
    project_types: buildProjectTypes(p),
    greenfield_count: p.greenfield,
    brownfield_count: p.brownfield,
    rollout_count: p.rollout,
    s4_count: p.s4,
    s4_ams_count: p.s4ams,
    ams_count: p.ams,
    quality_score: qualityScore(c, primaryModule),
    contactable: hasContact(c),
    search_text: [
      displayName,
      c.email,
      c.phone,
      displayTitle,
      displayCompany,
      displayLocation,
      primaryModule,
      ...allModules,
      ...submodules,
      c.role_type,
      c.consulting_level,
    ]
      .map(text)
      .filter(Boolean)
      .join(" ")
      .slice(0, 8000),
    updated_at: new Date().toISOString(),
    source_updated_at:
      c.updated_at || c.latest_cv_uploaded_at || c.created_at || new Date().toISOString(),
    display_name: displayName,
    display_title: displayTitle,
    display_company: displayCompany,
    display_location: displayLocation,
    email_masked: maskEmail(c.email),
    phone_masked: maskPhone(c.phone),
  };
}