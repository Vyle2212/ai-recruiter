import pdfParse from "pdf-parse";

export type ParsedJd = {
  title: string;
  location: string | null;
  responsibilities: string[];
  requirements: string[];
  modules: string[];
  sapSubmodules: string[];
  projectTypes: string[];
  years: number;
  level: string | null;
  language: string | null;
  rawText: string;

  requiresImplementation: boolean;
  requiresAmsSupport: boolean;
  requiresRollout: boolean;
  requiresMigration: boolean;
  requiresTransformation: boolean;
  requiresPresales: boolean;
  requiresApacDelivery: boolean;
  requiresWorkshop: boolean;

  requiredPrimaryModule: string | null;
  requiredSecondaryModules: string[];
  requiredModuleAuthority: number;

  primaryModule?: string | null;
  primary_module?: string | null;
  secondaryModules?: string[];
  required_primary_module?: string | null;
  required_secondary_modules?: string[];
  sap_modules?: string[];
};

const KNOWN_MODULE_ALIASES: Record<string, string[]> = {
  FICO: [
    "FICO",
    "FI/CO",
    "FI CO",
    "SAP FI",
    "SAP CO",
    "FINANCE AND CONTROLLING",
    "FINANCE & CONTROLLING",
    "FINANCIAL ACCOUNTING",
  ],
  MM: ["MM", "MATERIAL MANAGEMENT", "MATERIALS MANAGEMENT", "PROCUREMENT", "PURCHASING", "INVENTORY MANAGEMENT"],
  SD: ["SD", "SALES DISTRIBUTION", "SALES AND DISTRIBUTION", "SALES & DISTRIBUTION", "ORDER TO CASH", "OTC"],
  EWM: ["EWM", "EXTENDED WAREHOUSE", "WAREHOUSE MANAGEMENT"],
  TM: ["TM", "TRANSPORTATION MANAGEMENT", "LOGISTICS EXECUTION"],
  PP: ["PP", "PRODUCTION PLANNING", "MANUFACTURING"],
  PM: ["PM", "PLANT MAINTENANCE", "EAM", "ENTERPRISE ASSET MANAGEMENT"],
  PS: ["PS", "PROJECT SYSTEM"],
  "IS-U": ["IS-U", "ISU", "SAP ISU", "SAP IS-U", "UTILITIES"],
  ABAP: ["ABAP", "FIORI", "UI5", "CDS", "BADI", "BAPI", "IDOC"],
  BASIS: ["BASIS", "HANA ADMIN", "NETWEAVER", "SAP SECURITY"],
  BW: ["BW", "BI", "BW/4HANA", "BW4HANA", "DATASPHERE", "SAC", "SAP ANALYTICS CLOUD", "BPC"],
};

const NON_MODULE_TOKENS = new Set([
  "SAP",
  "ERP",
  "ECC",
  "S4",
  "S4HANA",
  "HANA",
  "SENIOR",
  "JUNIOR",
  "LEAD",
  "MANAGER",
  "CONSULTANT",
  "FUNCTIONAL",
  "TECHNICAL",
  "BUSINESS",
  "ANALYST",
  "ARCHITECT",
  "SPECIALIST",
  "DEVELOPER",
  "SUPPORT",
  "IMPLEMENTATION",
  "PROJECT",
  "MODULE",
  "MODULES",
  "AND",
  "THE",
  "FOR",
  "WITH",
]);

function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeModule(value: any): string | null {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return null;

  for (const [module, aliases] of Object.entries(KNOWN_MODULE_ALIASES)) {
    if (module === raw) return module;
    if (aliases.some((alias) => alias.toUpperCase() === raw)) return module;
  }

  if (raw === "FI/CO" || raw === "FI CO") return "FICO";
  if (raw === "ISU") return "IS-U";

  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (!compact || compact.length < 2 || compact.length > 10) return null;
  if (NON_MODULE_TOKENS.has(compact)) return null;

  return raw.replace(/\s+/g, "-");
}

function aliasRegex(alias: string): RegExp {
  const escaped = escapeRegex(alias)
    .replace(/\\\s\+/g, "\\s+")
    .replace(/\s+/g, "\\s+");

  return new RegExp(`\\b${escaped}\\b`, "i");
}

function moduleHit(text: string, module: string): boolean {
  const aliases = KNOWN_MODULE_ALIASES[module] || [module];
  return aliases.some((alias) => aliasRegex(alias).test(text));
}

function moduleScore(text: string, module: string): number {
  const aliases = KNOWN_MODULE_ALIASES[module] || [module];
  let score = 0;

  for (const alias of aliases) {
    const pattern = aliasRegex(alias);
    const re = new RegExp(pattern.source, "gi");
    const matches = text.match(re);
    score += matches ? matches.length : 0;
  }

  return score;
}

function extractTitle(text: string): string {
  const ls = lines(text);

  const explicitTitle = ls.find((line) =>
    /\bSAP\b/i.test(line) &&
    /\b(consultant|manager|lead|architect|specialist|analyst|developer)\b/i.test(line) &&
    line.length <= 160
  );

  if (explicitTitle) return explicitTitle;

  const titleLike = ls.find((line) =>
    /\b(SAP|Consultant|Manager|Lead|Architect|Specialist|Analyst|Developer)\b/i.test(line) &&
    line.length <= 160 &&
    !/responsibilities|required|requirements|experience|qualification|about\s+the\s+role/i.test(line)
  );

  return titleLike || ls[0] || "Untitled JD";
}

function extractLocation(text: string): string | null {
  const match = text.match(/Location\s*:\s*([^\n]+)/i);
  if (match) return match[1].trim();

  const locations = [
    "Kuala Lumpur",
    "Malaysia",
    "Singapore",
    "Philippines",
    "Indonesia",
    "Vietnam",
    "Thailand",
    "Australia",
    "India",
    "Japan",
  ];

  return locations.find((l) => text.toLowerCase().includes(l.toLowerCase())) || null;
}

function extractYears(text: string): number {
  const match =
    text.match(/at least\s+(\d{1,2})\s+years/i) ||
    text.match(/minimum\s+of\s+(\d{1,2})\s+years/i) ||
    text.match(/(\d{1,2})\+?\s+years/i);

  return match ? Number(match[1]) : 0;
}

function extractDynamicModuleTokens(text: string): string[] {
  const found: string[] = [];
  const upper = String(text || "").toUpperCase();

  for (const module of Object.keys(KNOWN_MODULE_ALIASES)) {
    if (moduleHit(upper, module)) found.push(module);
  }

  const dynamicPatterns = [
    /\bSAP\s+([A-Z][A-Z0-9/-]{1,10})\b/g,
    /\b([A-Z][A-Z0-9/-]{1,10})\s+(?:CONSULTANT|LEAD|MANAGER|ARCHITECT|SPECIALIST|ANALYST|DEVELOPER)\b/g,
    /\b(?:MODULE|MODULES)\s*[:\-]?\s*([A-Z][A-Z0-9/-]{1,10})\b/g,
  ];

  for (const pattern of dynamicPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(upper))) {
      const normalized = normalizeModule(match[1]);
      if (normalized) found.push(normalized);
    }
  }

  return unique(found);
}

function detectPrimaryModuleFromTitle(title: string): string | null {
  const titleModules = extractDynamicModuleTokens(title);
  if (titleModules.length) return titleModules[0];

  return null;
}

function splitIntoSections(text: string) {
  const ls = lines(text);
  const top = ls.slice(0, 8).join("\n");

  const requirementLines = ls
    .filter((line) =>
      /require|experience|must|knowledge|skill|module|consultant|hands-on|configuration|customizing/i.test(line)
    )
    .slice(0, 50)
    .join("\n");

  const integrationLines = ls
    .filter((line) =>
      /integration|interface|integrat(?:e|ed|ion)|cross[-\s]?module|with\s+[A-Z0-9/-]{2,10}/i.test(line)
    )
    .slice(0, 50)
    .join("\n");

  return { top, requirementLines, integrationLines };
}

function detectPrimaryModule(text: string, title: string): string | null {
  const titleModule = detectPrimaryModuleFromTitle(title);
  if (titleModule) return titleModule;

  const { top, requirementLines, integrationLines } = splitIntoSections(text);
  const candidates = unique([
    ...extractDynamicModuleTokens(top),
    ...extractDynamicModuleTokens(requirementLines),
    ...extractDynamicModuleTokens(text),
  ]);

  const scored = candidates
    .map((module) => {
      const titleScore = moduleScore(title, module) * 100;
      const topScore = moduleScore(top, module) * 35;
      const reqScore = moduleScore(requirementLines, module) * 18;
      const bodyScore = moduleScore(text, module) * 3;
      const integrationPenalty = moduleScore(integrationLines, module) * 10;

      return {
        module,
        score: titleScore + topScore + reqScore + bodyScore - integrationPenalty,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) return null;

  return best.module;
}

function extractModules(text: string, primary: string | null): string[] {
  const found = extractDynamicModuleTokens(text);

  if (/s\/4hana|s4hana|s4 hana/i.test(text)) found.push("SAP S/4HANA");
  if (primary) found.unshift(primary);

  return unique(found);
}

function extractSecondaryModules(text: string, primary: string | null): string[] {
  return extractDynamicModuleTokens(text).filter((module) => module !== primary);
}

function extractSubmodules(text: string): string[] {
  const items = [
    "GL",
    "AP",
    "AR",
    "AA",
    "Bank Accounting",
    "CO",
    "COPA",
    "PCA",
    "CCA",
    "Product Costing",
    "TRM",
    "FSCM",
    "FICA",
    "CFIN",
    "Group Reporting",
    "EDI",
    "IDOC",
    "Workflow",
    "LTMC",
    "LSMW",
  ];

  return items.filter((i) =>
    new RegExp(`\\b${escapeRegex(i)}\\b`, "i").test(text)
  );
}

export async function parseJd(buffer: Buffer): Promise<ParsedJd> {
  const pdf = await pdfParse(buffer);
  const rawText = cleanText(pdf.text || buffer.toString("utf8") || "");

  const title = extractTitle(rawText);
  const required = detectPrimaryModule(rawText, title);
  const secondaryModules = extractSecondaryModules(rawText, required);
  const modules = extractModules(rawText, required);

  return {
    title,
    location: extractLocation(rawText),
    responsibilities: lines(rawText)
      .filter((l) => /responsib|task|conduct|drive|support|design|workshop|configure|customize|implement/i.test(l))
      .slice(0, 20),
    requirements: lines(rawText)
      .filter((l) => /require|experience|must|degree|fluent|knowledge|skill|module|configuration/i.test(l))
      .slice(0, 20),
    modules,
    sap_modules: modules,
    sapSubmodules: extractSubmodules(rawText),
    projectTypes: [
      /implementation|end-to-end|project activities/i.test(rawText) ? "implementation" : "",
      /rollout|roll-out/i.test(rawText) ? "rollout" : "",
      /migration|conversion/i.test(rawText) ? "migration" : "",
      /blueprint|fit-gap|business process|transformation/i.test(rawText) ? "transformation" : "",
      /support|ams|incident|ticket/i.test(rawText) ? "ams_support" : "",
    ].filter(Boolean),
    years: extractYears(rawText),
    level: /manager/i.test(rawText) ? "Manager" : /senior/i.test(rawText) ? "Senior" : "Consultant",
    language: /english/i.test(rawText) ? "English" : null,
    rawText,

    requiresImplementation: /implementation|end-to-end|project activities|go-live|cutover|uat|sit/i.test(rawText),
    requiresAmsSupport: /support|ams|incident|ticket|production support/i.test(rawText),
    requiresRollout: /rollout|roll-out|deployment/i.test(rawText),
    requiresMigration: /migration|conversion|data migration/i.test(rawText),
    requiresTransformation: /blueprint|fit-gap|business process|transformation|functional design|process design/i.test(rawText),
    requiresPresales: /pre-sales|presales|proposal|rfp|rfq|solutioning/i.test(rawText),
    requiresApacDelivery: /apac|asia-pacific|asia pacific|regional/i.test(rawText),
    requiresWorkshop: /workshop|advise|guide clients/i.test(rawText),

    requiredPrimaryModule: required,
    required_primary_module: required,
    primaryModule: required,
    primary_module: required,
    requiredSecondaryModules: secondaryModules,
    required_secondary_modules: secondaryModules,
    secondaryModules,
    requiredModuleAuthority: required ? 100 : 0,
  };
}

export const parseJD = parseJd;
export const parseJDText = parseJd;
export const parseJobDescription = parseJd;
export default parseJd;
