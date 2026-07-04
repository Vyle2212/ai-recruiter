export type SapCanonicalKey =
  | "FICO" | "FI" | "CO" | "COPA" | "CFIN" | "FSCM" | "TRM" | "BCM" | "GR" | "BPC" | "RAR" | "RE_FX" | "PSM" | "FM"
  | "MM" | "SD" | "LE" | "WM" | "EWM" | "TM" | "GTS" | "QM" | "CS" | "LO" | "VC" | "HU"
  | "PP" | "PPDS" | "PM" | "EAM" | "PS" | "DMC" | "ME" | "MII" | "PLM"
  | "IBP" | "APO" | "ARIBA" | "SRM" | "CLM"
  | "ABAP" | "BASIS" | "SECURITY" | "GRC" | "BTP" | "CPI" | "PI_PO" | "FIORI" | "UI5" | "MDG" | "WRICEF" | "RAP" | "CAP" | "CDS" | "AMDP"
  | "HANA" | "BW" | "BW4HANA" | "SAC" | "DATASPHERE" | "BOBJ" | "BODS" | "PAPM"
  | "HCM" | "SUCCESSFACTORS" | "EC" | "ECP" | "RCM" | "RMK" | "ONB" | "LMS" | "PMGM" | "COMP"
  | "CONCUR" | "FIELDGLASS" | "CX" | "CRM" | "COMMERCE" | "CPQ" | "BRIM" | "FSM"
  | "IS_U" | "IS_OIL" | "IS_RETAIL" | "FS_CD" | "IS_BANKING" | "FICA"
  | "UNKNOWN";

export type SapProjectIntent = "IMPLEMENTATION" | "AMS" | "ROLLOUT" | "GREENFIELD" | "BROWNFIELD" | "MIGRATION" | "UPGRADE" | "S4" | "ECC" | "CUTOVER" | "HYPERCARE";

export type SapModuleEvidence = {
  requested: string;
  canonical: string;
  family: string;
  score: number;
  level: "primary" | "family-primary" | "secondary" | "family-secondary" | "text" | "weak" | "none";
  label: string;
  matchedTokens: string[];
};

export type SapSearchIntent = {
  rawKeyword: string;
  cleanedKeyword: string;
  explicitModules: string[];
  inferredModules: string[];
  requiredModules: string[];
  projectIntents: SapProjectIntent[];
  keywordTerms: string[];
};

type ModuleDef = {
  key: SapCanonicalKey;
  family: string;
  label: string;
  aliases: string[];
  weakAliases?: string[];
  primaryWeight?: number;
};

function unique(values: any[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function normalizeText(value: any): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSapCode(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP[-_]/i, "")
    .replace(/BW\s*\/\s*4\s*HANA/g, "BW4HANA")
    .replace(/PI\s*\/\s*PO/g, "PI_PO")
    .replace(/IS[-\s]?U/g, "IS_U")
    .replace(/IS[-\s]?OIL/g, "IS_OIL")
    .replace(/IS[-\s]?RETAIL/g, "IS_RETAIL")
    .replace(/FS[-\s]?CD/g, "FS_CD")
    .replace(/RE[-\s]?FX/g, "RE_FX")
    .replace(/[.]/g, "")
    .replace(/[\s/-]+/g, "_")
    .replace(/^S4HANA$/, "S4")
    .trim();
  return upper;
}

const MODULE_DEFS: ModuleDef[] = [
  { key: "FICO", family: "FICO", label: "SAP FICO", aliases: ["sap fico", "fico", "fi/co", "fi co", "sap fi/co", "sap fi co", "finance and controlling", "finance & controlling", "s/4hana finance", "s4hana finance"], weakAliases: ["finance", "financial"] },
  { key: "FI", family: "FICO", label: "SAP FI", aliases: ["sap fi", "financial accounting", "general ledger", "asset accounting", "accounts payable", "accounts receivable", "bank accounting", "new gl"], weakAliases: ["gl", "ap", "ar", "aa"] },
  { key: "CO", family: "FICO", label: "SAP CO", aliases: ["sap co", "controlling", "cost center accounting", "profit center accounting", "internal order", "product costing"], weakAliases: ["cca", "pca"] },
  { key: "COPA", family: "FICO", label: "SAP CO-PA", aliases: ["sap co-pa", "co-pa", "co pa", "copa", "profitability analysis", "sap copa", "sap profitability analysis"] },
  { key: "CFIN", family: "FICO", label: "SAP Central Finance", aliases: ["central finance", "sap central finance", "cfin"] },
  { key: "FSCM", family: "FICO", label: "SAP FSCM", aliases: ["sap fscm", "fscm", "financial supply chain management", "credit management", "collections management", "dispute management"] },
  { key: "TRM", family: "FICO", label: "SAP TRM", aliases: ["sap trm", "trm", "treasury", "treasury and risk management", "cash management"] },
  { key: "BCM", family: "FICO", label: "SAP BCM", aliases: ["bank communication management", "sap bcm", "bcm"] },
  { key: "GR", family: "FICO", label: "SAP Group Reporting", aliases: ["group reporting", "sap group reporting", "s/4hana group reporting"] },
  { key: "BPC", family: "FICO", label: "SAP BPC", aliases: ["sap bpc", "bpc", "business planning and consolidation"] },
  { key: "RAR", family: "FICO", label: "SAP RAR", aliases: ["sap rar", "rar", "revenue accounting and reporting"] },
  { key: "RE_FX", family: "FICO", label: "SAP RE-FX", aliases: ["sap re-fx", "re-fx", "real estate flexible"] },
  { key: "PSM", family: "FICO", label: "SAP PSM", aliases: ["sap psm", "public sector management"] },
  { key: "FM", family: "FICO", label: "SAP FM", aliases: ["sap fm", "fund management", "funds management"] },

  { key: "MM", family: "MM", label: "SAP MM", aliases: ["sap mm", "mm", "materials management", "material management", "procurement", "purchasing", "inventory management", "purchase order", "goods receipt", "p2p", "procure to pay", "source to pay", "s2p", "stp"] },
  { key: "ARIBA", family: "MM", label: "SAP Ariba", aliases: ["sap ariba", "ariba", "ariba sourcing", "ariba buying", "ariba contracts", "supplier lifecycle", "slp"] },
  { key: "SRM", family: "MM", label: "SAP SRM", aliases: ["sap srm", "srm", "supplier relationship management"] },
  { key: "CLM", family: "MM", label: "SAP CLM", aliases: ["sap clm", "contract lifecycle management"] },

  { key: "SD", family: "SD", label: "SAP SD", aliases: ["sap sd", "sd consultant", "sales and distribution", "sales distribution", "order to cash", "order-to-cash", "o2c", "otc", "pricing", "billing", "delivery", "sales order"] },
  { key: "LE", family: "SD", label: "SAP LE", aliases: ["sap le", "logistics execution", "le-shipping", "shipping"] },
  { key: "GTS", family: "SD", label: "SAP GTS", aliases: ["sap gts", "global trade services", "trade compliance"] },
  { key: "CS", family: "SD", label: "SAP CS", aliases: ["sap cs", "customer service"] },
  { key: "VC", family: "SD", label: "SAP Variant Configuration", aliases: ["variant configuration", "sap vc", "vc"] },
  { key: "HU", family: "SD", label: "SAP HU", aliases: ["handling unit", "sap hu", "hu management"] },

  { key: "PP", family: "PP", label: "SAP PP", aliases: ["sap pp", "production planning", "mrp", "manufacturing", "shop floor", "discrete manufacturing", "repetitive manufacturing"] },
  { key: "PPDS", family: "PP", label: "SAP PP/DS", aliases: ["sap pp/ds", "pp/ds", "ppds", "production planning and detailed scheduling"] },
  { key: "APO", family: "PP", label: "SAP APO", aliases: ["sap apo", "apo", "advanced planning and optimization", "demand planning", "supply network planning"] },
  { key: "IBP", family: "PP", label: "SAP IBP", aliases: ["sap ibp", "ibp", "integrated business planning"] },
  { key: "DMC", family: "PP", label: "SAP DMC", aliases: ["sap dmc", "digital manufacturing cloud"] },
  { key: "ME", family: "PP", label: "SAP ME", aliases: ["sap me", "manufacturing execution"] },
  { key: "MII", family: "PP", label: "SAP MII", aliases: ["sap mii", "manufacturing integration and intelligence"] },

  { key: "PM", family: "PM", label: "SAP PM", aliases: ["sap pm", "plant maintenance", "maintenance management"] },
  { key: "EAM", family: "PM", label: "SAP EAM", aliases: ["sap eam", "enterprise asset management", "asset management"] },
  { key: "QM", family: "QM", label: "SAP QM", aliases: ["sap qm", "quality management", "quality inspection", "inspection lot"] },
  { key: "PS", family: "PS", label: "SAP PS", aliases: ["sap ps", "project system", "project systems", "project accounting"] },
  { key: "PLM", family: "PLM", label: "SAP PLM", aliases: ["sap plm", "product lifecycle management"] },

  { key: "WM", family: "EWM", label: "SAP WM", aliases: ["sap wm", "warehouse management"] },
  { key: "EWM", family: "EWM", label: "SAP EWM", aliases: ["sap ewm", "extended warehouse management", "embedded ewm", "decentralized ewm"] },
  { key: "TM", family: "TM", label: "SAP TM", aliases: ["sap tm", "transportation management", "freight", "carrier selection"] },

  { key: "ABAP", family: "ABAP", label: "SAP ABAP", aliases: ["sap abap", "abap", "abap oo", "oo abap", "abap developer"] },
  { key: "WRICEF", family: "ABAP", label: "SAP WRICEF", aliases: ["wricef", "ricefw", "ricef", "rICEF"] },
  { key: "CDS", family: "ABAP", label: "SAP CDS", aliases: ["cds view", "core data services", "sap cds"] },
  { key: "AMDP", family: "ABAP", label: "SAP AMDP", aliases: ["amdp"] },
  { key: "RAP", family: "ABAP", label: "SAP RAP", aliases: ["sap rap", "restful abap programming", "restful abap"] },
  { key: "CAP", family: "BTP", label: "SAP CAP", aliases: ["sap cap", "cloud application programming", "cap model"] },

  { key: "BASIS", family: "BASIS", label: "SAP Basis", aliases: ["sap basis", "basis", "netweaver", "sap netweaver", "solution manager", "solman", "charm", "transport management", "system administration"] },
  { key: "SECURITY", family: "SECURITY", label: "SAP Security", aliases: ["sap security", "security", "authorization", "authorisation", "pfcg", "identity access", "sap grc access control"] },
  { key: "GRC", family: "SECURITY", label: "SAP GRC", aliases: ["sap grc", "grc", "governance risk compliance", "segregation of duties", "sod", "access control"] },

  { key: "BTP", family: "BTP", label: "SAP BTP", aliases: ["sap btp", "btp", "business technology platform", "sap business technology platform", "sap cloud platform", "scp", "extension suite", "integration suite", "event mesh", "sap build", "build apps", "build process automation", "workflow management", "destination service"] },
  { key: "CPI", family: "BTP", label: "SAP CPI", aliases: ["sap cpi", "cpi", "cloud platform integration", "cloud integration", "hana cloud integration", "hci", "sap integration suite"] },
  { key: "PI_PO", family: "BTP", label: "SAP PI/PO", aliases: ["sap pi/po", "pi/po", "pi po", "sap pi", "sap po", "process integration", "process orchestration", "xi", "exchange infrastructure"] },
  { key: "FIORI", family: "BTP", label: "SAP Fiori", aliases: ["sap fiori", "fiori", "fiori launchpad", "flp", "fiori elements"] },
  { key: "UI5", family: "BTP", label: "SAP UI5", aliases: ["sap ui5", "ui5", "sapui5", "openui5"] },

  { key: "HANA", family: "HANA", label: "SAP HANA", aliases: ["sap hana", "hana database", "hana db", "native hana", "sqlscript", "calculation view", "calculation views", "hana modeling", "hana modelling"] },
  { key: "BW", family: "ANALYTICS", label: "SAP BW", aliases: ["sap bw", "business warehouse", "bw on hana", "sap bi", "business intelligence"] },
  { key: "BW4HANA", family: "ANALYTICS", label: "SAP BW/4HANA", aliases: ["sap bw/4hana", "bw/4hana", "bw4hana", "sap bw4hana"] },
  { key: "SAC", family: "ANALYTICS", label: "SAP Analytics Cloud", aliases: ["sap analytics cloud", "analytics cloud", "sap sac", "sac", "planning in sac"] },
  { key: "DATASPHERE", family: "ANALYTICS", label: "SAP Datasphere", aliases: ["sap datasphere", "datasphere", "data warehouse cloud", "sap data warehouse cloud", "dwc"] },
  { key: "BOBJ", family: "ANALYTICS", label: "SAP BusinessObjects", aliases: ["businessobjects", "business objects", "sap bo", "sap bob j", "bobj", "webi", "crystal reports"] },
  { key: "BODS", family: "ANALYTICS", label: "SAP BODS", aliases: ["sap bods", "bods", "data services"] },
  { key: "PAPM", family: "ANALYTICS", label: "SAP PaPM", aliases: ["sap papm", "papm", "profitability and performance management"] },

  { key: "SUCCESSFACTORS", family: "HXM", label: "SAP SuccessFactors", aliases: ["sap successfactors", "successfactors", "sap sf", "sap hxm", "sap hcm"] },
  { key: "EC", family: "HXM", label: "SuccessFactors Employee Central", aliases: ["employee central", "successfactors ec", "sap ec"] },
  { key: "ECP", family: "HXM", label: "SuccessFactors ECP", aliases: ["employee central payroll", "ec payroll", "ecp"] },
  { key: "RCM", family: "HXM", label: "SuccessFactors Recruiting", aliases: ["recruiting management", "successfactors recruiting", "rcm", "rmk"] },
  { key: "ONB", family: "HXM", label: "SuccessFactors Onboarding", aliases: ["successfactors onboarding", "onboarding", "onb"] },
  { key: "LMS", family: "HXM", label: "SuccessFactors Learning", aliases: ["learning management", "lms", "successfactors learning"] },
  { key: "PMGM", family: "HXM", label: "SuccessFactors PMGM", aliases: ["performance and goals", "pmgm"] },
  { key: "COMP", family: "HXM", label: "SuccessFactors Compensation", aliases: ["successfactors compensation", "compensation management"] },

  { key: "CONCUR", family: "CONCUR", label: "SAP Concur", aliases: ["sap concur", "concur", "travel and expense", "t&e"] },
  { key: "FIELDGLASS", family: "FIELDGLASS", label: "SAP Fieldglass", aliases: ["sap fieldglass", "fieldglass", "vendor management system", "vms"] },
  { key: "MDG", family: "MDG", label: "SAP MDG", aliases: ["sap mdg", "mdg", "master data governance"] },
  { key: "CRM", family: "CX", label: "SAP CRM", aliases: ["sap crm", "crm"] },
  { key: "CX", family: "CX", label: "SAP C4C", aliases: ["sap c4c", "cloud for customer"] },
  { key: "CX", family: "CX", label: "SAP CX", aliases: ["sap cx", "customer experience"] },
  { key: "COMMERCE", family: "CX", label: "SAP Commerce", aliases: ["sap commerce", "hybris", "sap hybris"] },
  { key: "CPQ", family: "CX", label: "SAP CPQ", aliases: ["sap cpq", "configure price quote"] },
  { key: "BRIM", family: "BRIM", label: "SAP BRIM", aliases: ["sap brim", "brim", "billing and revenue innovation management", "hybris billing"] },
  { key: "FSM", family: "FSM", label: "SAP FSM", aliases: ["sap fsm", "field service management"] },

  { key: "IS_U", family: "INDUSTRY", label: "SAP IS-U", aliases: ["sap is-u", "is-u", "isu", "sap isu", "sap utilities", "utilities billing", "device management", "meter reading"] },
  { key: "IS_OIL", family: "INDUSTRY", label: "SAP IS-OIL", aliases: ["sap is-oil", "is-oil", "sap oil and gas"] },
  { key: "IS_RETAIL", family: "INDUSTRY", label: "SAP IS-Retail", aliases: ["sap is-retail", "is-retail", "sap retail"] },
  { key: "FS_CD", family: "INDUSTRY", label: "SAP FS-CD", aliases: ["sap fs-cd", "fs-cd", "collections and disbursements"] },
  { key: "IS_BANKING", family: "INDUSTRY", label: "SAP Banking", aliases: ["sap banking", "is-banking"] },
  { key: "FICA", family: "INDUSTRY", label: "SAP FI-CA", aliases: ["fi-ca", "fica", "contract accounts receivable and payable"] },
];

const DIRECT_CODE_ALIASES: Record<string, string> = Object.fromEntries(
  MODULE_DEFS.flatMap((def) => [
    [normalizeSapCode(def.key), def.key],
    [normalizeSapCode(def.label), def.key],
    ...def.aliases.map((alias) => [normalizeSapCode(alias), def.key] as [string, SapCanonicalKey]),
  ]),
);

// Important display behavior:
// CO-PA / COPA is intentionally canonicalized to "COPA", not "CO".
// UI badges should display COPA as its own submodule chip under the FICO family.

export function canonicalSapKey(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = normalizeSapCode(raw);
  return DIRECT_CODE_ALIASES[normalized] || normalized;
}

export function sapFamilyOf(value: any): string {
  const key = canonicalSapKey(value);
  return MODULE_DEFS.find((def) => def.key === key)?.family || key || "";
}

export function sapDisplayLabel(value: any): string {
  const key = canonicalSapKey(value);
  return MODULE_DEFS.find((def) => def.key === key)?.label || (key ? `SAP ${key.replace(/_/g, "/")}` : "SAP");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasRegex(alias: string): RegExp {
  const clean = normalizeText(alias);
  const escaped = escapeRegex(clean).replace(/\s+/g, "\\s+");
  const compact = clean.replace(/[^a-z0-9]/g, "");
  const isShort = compact.length <= 5;
  return new RegExp(isShort ? `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)` : escaped, "i");
}

export function detectSapModulesFromText(value: any): string[] {
  const text = normalizeText(value);
  if (!text) return [];
  const found: string[] = [];
  for (const def of MODULE_DEFS) {
    const strongHit = [def.label, def.key, ...def.aliases].some((alias) => aliasRegex(alias).test(text));
    if (strongHit) found.push(def.key);
  }
  return unique(found);
}

export function expandSapFamilies(modules: any[]): string[] {
  const canonical = unique((modules || []).map(canonicalSapKey).filter((m) => m && m !== "ALL" && m !== "ANY" && m !== "UNKNOWN"));
  const families = new Set(canonical.map(sapFamilyOf).filter(Boolean));
  return unique([
    ...canonical,
    ...MODULE_DEFS.filter((def) => families.has(def.family)).map((def) => def.key),
  ]);
}

export function parseSapModulesFromKeyword(keyword: string): string[] {
  return detectSapModulesFromText(keyword);
}

const PROJECT_ALIASES: Record<SapProjectIntent, string[]> = {
  IMPLEMENTATION: ["implementation", "implemented", "implement", "end to end", "end-to-end", "e2e", "full cycle", "full-cycle", "blueprint", "fit gap", "configuration"],
  AMS: ["ams", "support", "application management", "application maintenance", "managed services", "production support", "l2 support", "l3 support"],
  ROLLOUT: ["rollout", "roll out", "roll-out"],
  GREENFIELD: ["greenfield", "green field"],
  BROWNFIELD: ["brownfield", "brown field", "conversion"],
  MIGRATION: ["migration", "migrate", "data migration"],
  UPGRADE: ["upgrade", "version upgrade"],
  S4: ["s/4", "s4hana", "s/4hana", "s4 hana", "s/4 hana"],
  ECC: ["ecc", "sap ecc", "r/3", "sap r3"],
  CUTOVER: ["cutover", "go-live", "go live"],
  HYPERCARE: ["hypercare", "post go live", "post-go-live"],
};

export function parseProjectIntents(keyword: string, explicitTypes: string[] = []): SapProjectIntent[] {
  const text = normalizeText([keyword, ...(explicitTypes || [])].join(" "));
  const found: SapProjectIntent[] = [];
  for (const [intent, aliases] of Object.entries(PROJECT_ALIASES) as [SapProjectIntent, string[]][]) {
    if (aliases.some((alias) => aliasRegex(alias).test(text))) found.push(intent);
  }
  return unique(found) as SapProjectIntent[];
}

export function removeSapIntentTerms(keyword: string, modules: string[], projects: SapProjectIntent[]): string {
  let cleaned = ` ${String(keyword || "")} `;
  const moduleKeys = expandSapFamilies(modules);
  const aliases = MODULE_DEFS.filter((def) => moduleKeys.includes(def.key)).flatMap((def) => [def.key, def.label, ...def.aliases]);
  for (const alias of aliases) cleaned = cleaned.replace(aliasRegex(alias), " ");
  for (const project of projects) for (const alias of PROJECT_ALIASES[project] || []) cleaned = cleaned.replace(aliasRegex(alias), " ");
  return cleaned.replace(/[,+|;]/g, " ").replace(/\s+/g, " ").trim();
}

function arrayFrom(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

export function buildCandidateSapText(candidate: any, indexRow?: any): string {
  return normalizeText([
    indexRow?.search_text,
    indexRow?.primary_module,
    indexRow?.all_modules,
    indexRow?.all_submodules,
    candidate?.name,
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.company,
    candidate?.current_company,
    candidate?.primary_module,
    candidate?.secondary_modules,
    candidate?.sap_modules,
    candidate?.sap_submodules,
    candidate?.skills,
    candidate?.summary,
    candidate?.experience,
    // Raw CV fields remain last and are used only as supporting text evidence.
    // Primary-module search gates are controlled by structured/index data.
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
  ].join(" "));
}

export function candidateModuleSignals(candidate: any, indexRow?: any): string[] {
  // Structured/index evidence first. The rebuilt candidate_search_index is
  // the recruiter search source of truth. Raw CV text may contain incidental
  // module names and must never be used to override primary-module gates.
  const explicit = unique([
    indexRow?.primary_module,
    ...arrayFrom(indexRow?.all_modules),
    ...arrayFrom(indexRow?.all_submodules),
    candidate?.primary_module,
    ...arrayFrom(candidate?.secondary_modules),
    ...arrayFrom(candidate?.sap_modules),
    ...arrayFrom(candidate?.sap_submodules),
  ].map(canonicalSapKey).filter((m) => m && m !== "UNKNOWN"));

  const textSignals = detectSapModulesFromText(buildCandidateSapText(candidate, indexRow));

  return unique([...explicit, ...textSignals]);
}


const STRICT_PARENT_MODULES = new Set([
  "FICO", "MM", "SD", "PP", "PM", "QM", "PS", "EWM", "TM", "ABAP", "BASIS", "SECURITY", "GRC", "BTP", "HANA", "BW", "BW4HANA", "SAC", "DATASPHERE", "SUCCESSFACTORS", "CONCUR", "FIELDGLASS", "MDG", "CRM", "CX", "BRIM", "FSM", "IS_U", "IS_OIL", "IS_RETAIL", "FS_CD", "IS_BANKING", "FICA"
]);

function isGenericFamilyModule(moduleKey: string): boolean {
  const key = canonicalSapKey(moduleKey);
  return STRICT_PARENT_MODULES.has(key);
}

function findBestTitleModule(value: any): string {
  const text = normalizeText(value);
  if (!text) return "";

  const hits = MODULE_DEFS.map((def) => {
    const aliases = unique([def.label, def.key, ...def.aliases]);
    let bestIndex = 999999;
    let bestLength = 0;
    for (const alias of aliases) {
      const clean = normalizeText(alias);
      if (!clean) continue;
      const regex = aliasRegex(alias);
      const match = regex.exec(text);
      if (match && match.index >= 0) {
        const idx = match.index;
        if (idx < bestIndex || (idx === bestIndex && clean.length > bestLength)) {
          bestIndex = idx;
          bestLength = clean.length;
        }
      }
    }
    return bestIndex < 999999 ? { key: def.key, family: def.family, index: bestIndex, length: bestLength } : null;
  }).filter(Boolean) as { key: SapCanonicalKey; family: string; index: number; length: number }[];

  if (!hits.length) return "";

  const explicitTitlePriority = [
    "SUCCESSFACTORS", "EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "COMP", "HCM",
    "ABAP", "BASIS", "SECURITY", "GRC", "BTP", "CPI", "PI_PO", "FIORI", "UI5",
    "FICO", "FI", "CO", "COPA", "CFIN", "FSCM", "TRM", "MM", "SD", "PP", "PM", "QM", "PS", "EWM", "WM", "TM", "HANA", "BW4HANA", "BW", "SAC", "DATASPHERE"
  ];

  hits.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (b.length !== a.length) return b.length - a.length;
    return explicitTitlePriority.indexOf(a.key) - explicitTitlePriority.indexOf(b.key);
  });

  const winner = hits[0]?.key || "";
  if (["FI", "CO"].includes(winner)) return "FICO";
  if (["EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "COMP", "HCM"].includes(winner)) return "SUCCESSFACTORS";
  return winner;
}

export function derivePrimarySapModule(candidate: any, indexRow?: any): string {
  // The rebuilt candidate_search_index.primary_module is the canonical primary module.
  // This prevents stale candidates.primary_module or secondary chips from making
  // ABAP/SD/MM/Basis profiles appear as FICO, and vice versa.
  const indexPrimary = canonicalSapKey(indexRow?.primary_module || "");
  if (indexPrimary && !["UNKNOWN", "ALL", "ANY"].includes(indexPrimary)) return indexPrimary;

  const explicitPrimary = canonicalSapKey(candidate?.primary_module || candidate?.primaryModule || "");
  if (explicitPrimary && !["UNKNOWN", "ALL", "ANY"].includes(explicitPrimary)) return explicitPrimary;

  const titlePrimary = findBestTitleModule([
    candidate?.current_title,
    candidate?.title,
    candidate?.headline,
    indexRow?.display_title,
  ].filter(Boolean).join(" | "));

  if (titlePrimary && titlePrimary !== "UNKNOWN") return titlePrimary;

  const moduleSignals = unique([
    ...arrayFrom(indexRow?.all_modules),
    ...arrayFrom(candidate?.sap_modules),
    ...arrayFrom(candidate?.secondary_modules),
  ].map(canonicalSapKey).filter((m) => m && !["UNKNOWN", "ALL", "ANY"].includes(m)));

  return moduleSignals[0] || "UNKNOWN";
}

export function primarySapModuleCanSatisfySearch(primaryModule: any, requestedModule: any, candidate?: any, indexRow?: any): boolean {
  const primary = canonicalSapKey(primaryModule);
  const requested = canonicalSapKey(requestedModule);
  if (!primary || !requested || ["ALL", "ANY", "UNKNOWN"].includes(primary) || ["ALL", "ANY", "UNKNOWN"].includes(requested)) return false;

  if (primary === requested) return true;

  // For broad parent module searches, only the exact primary module may pass.
  // This fixes BTP search returning 0 after index cleanup:
  //   primary=BTP + requested=BTP => PASS
  // while still blocking:
  //   primary=FICO/SD/MM/ABAP + requested=BTP => FAIL
  // and:
  //   primary=BTP + requested=FICO/SD/MM => FAIL
  if (isGenericFamilyModule(requested)) return primary === requested;

  // For true submodule searches, allow only a candidate whose primary sits in the same parent family
  // AND has exact requested submodule evidence. This supports FI/CO under FICO and Fiori/CPI under BTP
  // without letting unrelated secondary chips leak into results.
  if (strictSapFamily(primary) !== strictSapFamily(requested)) return false;

  const signals = candidateModuleSignals(candidate || {}, indexRow || {});
  const text = buildCandidateSapText(candidate || {}, indexRow || {});
  return signals.includes(requested) && exactAliasEvidence(requested, text);
}

function exactAliasEvidence(moduleKey: string, haystack: string): boolean {
  const key = canonicalSapKey(moduleKey);
  const def = MODULE_DEFS.find((d) => d.key === key);
  if (!def) return false;
  return unique([def.label, def.key, ...def.aliases]).some((alias) => aliasRegex(alias).test(haystack));
}


function strictSapFamily(moduleKey: string): string {
  const key = canonicalSapKey(moduleKey);
  if (["FICO", "FI", "CO", "COPA", "CFIN", "FSCM", "TRM", "BCM", "GR", "BPC", "RAR", "RE_FX", "PSM", "FM"].includes(key)) return "FICO";
  if (["BTP", "CPI", "PI_PO", "FIORI", "UI5", "CAP"].includes(key)) return "BTP";
  if (["ABAP", "WRICEF", "CDS", "AMDP", "RAP"].includes(key)) return "ABAP";
  if (["BASIS"].includes(key)) return "BASIS";
  if (["SECURITY", "GRC"].includes(key)) return "SECURITY";
  if (["HANA"].includes(key)) return "HANA";
  if (["BW", "BW4HANA", "SAC", "DATASPHERE", "BOBJ", "BODS", "PAPM"].includes(key)) return "ANALYTICS";
  if (["SUCCESSFACTORS", "EC", "ECP", "RCM", "RMK", "ONB", "LMS", "PMGM", "COMP", "HCM"].includes(key)) return "HXM";
  if (["MM", "ARIBA", "SRM", "CLM"].includes(key)) return "MM";
  if (["SD", "LE", "GTS", "CS", "VC", "HU"].includes(key)) return "SD";
  if (["PP", "PPDS", "APO", "IBP", "DMC", "ME", "MII"].includes(key)) return "PP";
  if (["PM", "EAM"].includes(key)) return "PM";
  if (["WM", "EWM"].includes(key)) return "EWM";
  if (["TM"].includes(key)) return "TM";
  if (["QM"].includes(key)) return "QM";
  if (["PS"].includes(key)) return "PS";
  if (["PLM"].includes(key)) return "PLM";
  if (["CONCUR"].includes(key)) return "CONCUR";
  if (["FIELDGLASS"].includes(key)) return "FIELDGLASS";
  if (["MDG"].includes(key)) return "MDG";
  if (["CRM", "CX", "COMMERCE", "CPQ"].includes(key)) return "CX";
  if (["BRIM"].includes(key)) return "BRIM";
  if (["FSM"].includes(key)) return "FSM";
  if (["IS_U", "IS_OIL", "IS_RETAIL", "FS_CD", "IS_BANKING", "FICA"].includes(key)) return "INDUSTRY";
  return key;
}

function primaryCanRepresentSapRequest(primaryModule: string, requestedModule: string, candidate?: any, indexRow?: any): boolean {
  return primarySapModuleCanSatisfySearch(primaryModule, requestedModule, candidate, indexRow);
}

export function scoreModuleEvidence(candidate: any, indexRow: any, requestedModule: string): SapModuleEvidence {
  const canonical = canonicalSapKey(requestedModule);
  const family = sapFamilyOf(canonical);
  const primary = derivePrimarySapModule(candidate, indexRow);
  const primaryFamily = sapFamilyOf(primary);
  const signals = candidateModuleSignals(candidate, indexRow);
  const signalFamilies = new Set(signals.map(sapFamilyOf));
  const text = buildCandidateSapText(candidate, indexRow);
  const requestedDef = MODULE_DEFS.find((def) => def.key === canonical);
  const familyDefs = MODULE_DEFS.filter((def) => def.family === family);
  const strongTokens = unique([...(requestedDef ? [requestedDef.label, requestedDef.key, ...requestedDef.aliases] : []), ...familyDefs.flatMap((def) => [def.label, def.key, ...def.aliases])]);
  const matchedTokens = strongTokens.filter((alias) => aliasRegex(alias).test(text)).slice(0, 6);

  if (!canonical || canonical === "UNKNOWN") return { requested: String(requestedModule || ""), canonical, family, score: 0, level: "none", label: "No module intent", matchedTokens: [] };
  if (primary === canonical) return { requested: String(requestedModule), canonical, family, score: 100, level: "primary", label: `Direct ${canonical} primary match`, matchedTokens: [canonical] };
  if (primary && primaryFamily === family && family && !isGenericFamilyModule(canonical) && exactAliasEvidence(canonical, text)) return { requested: String(requestedModule), canonical, family, score: 94, level: "family-primary", label: `${family} primary with ${canonical} evidence`, matchedTokens: [primary, canonical] };
  if (signals.includes(canonical)) return { requested: String(requestedModule), canonical, family, score: 35, level: "secondary", label: `${canonical} is secondary only; primary module is ${primary || "UNKNOWN"}`, matchedTokens: [canonical] };
  if (family && signalFamilies.has(family)) return { requested: String(requestedModule), canonical, family, score: 25, level: "family-secondary", label: `${family} evidence is secondary only; primary module is ${primary || "UNKNOWN"}`, matchedTokens: signals.filter((s) => sapFamilyOf(s) === family).slice(0, 4) };
  if (matchedTokens.length) return { requested: String(requestedModule), canonical, family, score: 68, level: "text", label: `${canonical} text evidence`, matchedTokens };

  const weakTokens = (requestedDef?.weakAliases || []).filter((alias) => aliasRegex(alias).test(text)).slice(0, 4);
  if (weakTokens.length >= 2) return { requested: String(requestedModule), canonical, family, score: 45, level: "weak", label: `${canonical} weak evidence requiring validation`, matchedTokens: weakTokens };
  return { requested: String(requestedModule), canonical, family, score: 0, level: "none", label: `No ${canonical} evidence`, matchedTokens: [] };
}

export function candidateMatchesSapModules(candidate: any, indexRow: any, requestedModules: string[]): { ok: boolean; evidences: SapModuleEvidence[] } {
  const required = unique((requestedModules || []).map(canonicalSapKey).filter((m) => m && m !== "ALL" && m !== "ANY" && m !== "UNKNOWN"));
  if (!required.length) return { ok: true, evidences: [] };

  const primary = derivePrimarySapModule(candidate, indexRow);
  const primaryMatchesRequestedFamily = required.every((module) => primaryCanRepresentSapRequest(primary, module, candidate, indexRow));
  if (!primaryMatchesRequestedFamily) {
    return {
      ok: false,
      evidences: required.map((module) => ({
        requested: module,
        canonical: module,
        family: strictSapFamily(module),
        score: 0,
        level: "none",
        label: `Primary module ${primary || "UNKNOWN"} is not the requested ${module}`,
        matchedTokens: [],
      })),
    };
  }

  const evidences = required.map((module) => scoreModuleEvidence(candidate, indexRow, module));
  const strongEnoughLevels = new Set(["primary", "family-primary"]);

  return {
    ok: evidences.every((e) => e.score >= 60 && strongEnoughLevels.has(e.level)),
    evidences,
  };
}

export function candidateMatchesProjectIntent(candidate: any, indexRow: any, projectIntents: SapProjectIntent[]): { ok: boolean; matched: string[] } {
  if (!projectIntents.length) return { ok: true, matched: [] };
  const text = buildCandidateSapText(candidate, indexRow);
  const count = (v: any) => Number(v || 0);
  const projectTypes = new Set(
    [
      ...arrayFrom(candidate?.project_types),
      ...arrayFrom(indexRow?.project_types),
    ].map((x) => normalizeSapCode(x)),
  );
  const hasType = (...types: string[]) => types.some((t) => projectTypes.has(normalizeSapCode(t)));
  const matched: string[] = [];

  for (const intent of projectIntents) {
    let ok = false;
    if (intent === "IMPLEMENTATION") ok = count(candidate?.implementation_project_count ?? candidate?.implementation_projects) > 0 || hasType("IMPLEMENTATION");
    if (intent === "AMS") ok = count(candidate?.ams_support_project_count ?? candidate?.ams_project_count ?? indexRow?.ams_count ?? indexRow?.s4_ams_count) > 0 || hasType("AMS", "S4_AMS");
    if (intent === "ROLLOUT") ok = count(candidate?.rollout_project_count ?? candidate?.rollout_projects ?? indexRow?.rollout_count) > 0 || hasType("ROLLOUT");
    if (intent === "GREENFIELD") ok = count(candidate?.s4_greenfield_count ?? candidate?.greenfield_projects ?? indexRow?.greenfield_count) > 0 || hasType("GREENFIELD");
    if (intent === "BROWNFIELD") ok = count(candidate?.s4_conversion_count ?? candidate?.brownfield_projects ?? indexRow?.brownfield_count) > 0 || hasType("BROWNFIELD");
    if (intent === "S4") ok = count(candidate?.s4hana_project_count ?? candidate?.s4_implementation_count ?? candidate?.s4_count ?? indexRow?.s4_count) > 0 || hasType("S4", "S4HANA", "S4_IMPLEMENTATION");
    if (intent === "MIGRATION") ok = count(candidate?.migration_project_count ?? candidate?.migration_count) > 0 || hasType("MIGRATION");
    if (intent === "UPGRADE") ok = hasType("UPGRADE");
    if (intent === "ECC") ok = count(candidate?.ecc_project_count ?? candidate?.eccProjects) > 0 || hasType("ECC");
    if (intent === "CUTOVER") ok = hasType("CUTOVER");
    if (intent === "HYPERCARE") ok = hasType("HYPERCARE", "AMS");
    if (!ok) ok = (PROJECT_ALIASES[intent] || []).some((alias) => aliasRegex(alias).test(text));
    if (ok) matched.push(intent);
  }
  return { ok: matched.length === projectIntents.length, matched };
}

export function buildSapSearchIntent(args: { rawKeyword?: string; explicitModules?: string[]; explicitProjectTypes?: string[] }): SapSearchIntent {
  const rawKeyword = String(args.rawKeyword || "");
  const explicitModules = unique((args.explicitModules || []).flatMap((m) => [canonicalSapKey(m), ...parseSapModulesFromKeyword(m)]).filter((m) => m && m !== "ALL" && m !== "ANY" && m !== "UNKNOWN"));
  const inferredModules = parseSapModulesFromKeyword(rawKeyword);
  const projectIntents = parseProjectIntents(rawKeyword, args.explicitProjectTypes || []);
  const requiredModules = explicitModules.length ? explicitModules : inferredModules;
  const cleanedKeyword = removeSapIntentTerms(rawKeyword, requiredModules, projectIntents);
  const keywordTerms = normalizeText(cleanedKeyword).split(/\s+/).filter((term) => term.length >= 2 && !["sap", "consultant", "module"].includes(term));
  return { rawKeyword, cleanedKeyword, explicitModules, inferredModules, requiredModules, projectIntents, keywordTerms };
}

export function scoreSapSearchCandidate(args: {
  candidate: any;
  indexRow?: any;
  intent: SapSearchIntent;
  country?: string;
  city?: string;
  minYears?: number;
}): { ok: boolean; score: number; why: string[]; tokens: string[]; moduleMatchType: string; details?: { debug: Record<string, any> } } {
  const { candidate, indexRow, intent, country, city } = args;
  const moduleResult = candidateMatchesSapModules(candidate, indexRow, intent.requiredModules);
  if (!moduleResult.ok) return { ok: false, score: 0, why: moduleResult.evidences.map((e) => e.label), tokens: [], moduleMatchType: "No module match", details: { debug: {} } };
  const projectResult = candidateMatchesProjectIntent(candidate, indexRow, intent.projectIntents);
  if (!projectResult.ok) return { ok: false, score: 0, why: [`Missing project intent: ${intent.projectIntents.join(", ")}`], tokens: [], moduleMatchType: "Missing project evidence", details: { debug: {} } };

  const text = buildCandidateSapText(candidate, indexRow);
  if (intent.keywordTerms.length && !intent.keywordTerms.every((term) => text.includes(term.toLowerCase()))) {
    return { ok: false, score: 0, why: [`Missing keyword: ${intent.keywordTerms.join(", ")}`], tokens: [], moduleMatchType: "Keyword mismatch", details: { debug: {} } };
  }

  const moduleScore = moduleResult.evidences.length ? Math.min(...moduleResult.evidences.map((e) => e.score)) : 28;
  const implementationCount = Number(candidate?.implementation_project_count ?? candidate?.implementation_projects ?? indexRow?.implementation_project_count ?? indexRow?.implementation_projects ?? 0) || 0;
  const s4Count = Number(candidate?.s4hana_project_count ?? candidate?.s4_implementation_count ?? candidate?.s4_count ?? indexRow?.s4_count ?? 0) || 0;
  const greenfieldCount = Number(candidate?.s4_greenfield_count ?? candidate?.greenfield_count ?? indexRow?.greenfield_count ?? 0) || 0;
  const brownfieldCount = Number(candidate?.s4_conversion_count ?? candidate?.brownfield_count ?? indexRow?.brownfield_count ?? 0) || 0;
  const rolloutCount = Number(candidate?.rollout_project_count ?? candidate?.rollout_projects ?? indexRow?.rollout_count ?? 0) || 0;
  const amsCount = Number(candidate?.ams_support_project_count ?? candidate?.ams_project_count ?? candidate?.ams_count ?? indexRow?.ams_count ?? indexRow?.s4_ams_count ?? 0) || 0;

  const diminishing = (count: number, cap: number, scale: number, bias = 0) => {
    const safe = Math.max(0, count);
    return Math.min(cap, Math.max(0, Math.sqrt(safe + bias) - Math.sqrt(bias)) * scale);
  };

  let projectBoost = 0;
  projectBoost += diminishing(implementationCount, 9, 2.3);
  projectBoost += diminishing(s4Count, 4, 1.2);
  projectBoost += diminishing(greenfieldCount + brownfieldCount, 3, 0.95);
  projectBoost += diminishing(rolloutCount, 3, 0.9);
  projectBoost += diminishing(amsCount, 1.5, 0.45);
  const keywordBoost = intent.keywordTerms.length ? 8 : 0;
  const years = Number(candidate?.years ?? candidate?.years_experience ?? indexRow?.years ?? 0) || 0;
  const yearsBoost = years >= 15 ? 6 : years >= 10 ? 4 : years >= 5 ? 2 : 0;
  const cityBoost = city && text.includes(String(city).toLowerCase()) ? 4 : 0;
  const countryBoost = country ? 4 : 0;
  const moduleBase = moduleScore >= 98 ? 86 : moduleScore >= 94 ? 82 : moduleScore >= 85 ? 74 : moduleScore >= 70 ? 62 : Math.max(45, moduleScore);
  const rawScore = moduleBase + projectBoost + keywordBoost + yearsBoost + cityBoost + countryBoost;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const why = unique([
    ...moduleResult.evidences.map((e) => e.label),
    ...(projectResult.matched.length ? [`Project evidence: ${projectResult.matched.join(", ")}`] : []),
    ...(country ? [`Country match: ${country}`] : []),
    ...(cityBoost ? [`City evidence: ${city}`] : []),
    ...(years ? [`${years} years SAP experience`] : []),
  ]).slice(0, 6);
  const tokens = unique([...moduleResult.evidences.flatMap((e) => e.matchedTokens), ...projectResult.matched]).slice(0, 8);
  const moduleMatchType = moduleResult.evidences.length ? moduleResult.evidences.map((e) => e.label).join(" + ") : "General SAP profile";
  return {
    ok: true,
    score,
    why,
    tokens,
    moduleMatchType,
    details: {
      debug: {
        moduleScore,
        keywordBoost,
        projectBoost,
        implementationCount,
        s4Count,
        greenfieldCount,
        brownfieldCount,
        rolloutCount,
        amsCount,
      },
    },
  };
}

export function sapRoleTypeForModules(modules: string[]): string {
  const families = new Set((modules || []).map(sapFamilyOf));
  if (families.has("FICO")) return "FICO Functional";
  if (["MM", "SD", "PP", "PM", "QM", "PS", "EWM", "TM", "HXM", "CX", "INDUSTRY"].some((f) => families.has(f))) return "SAP Functional";
  if (["ABAP", "BASIS", "BTP", "HANA", "ANALYTICS", "SECURITY", "MDG"].some((f) => families.has(f))) return "Technical";
  return "SAP Functional";
}

