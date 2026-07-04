export type SapModuleKey =
  | "FICO" | "FI" | "CO" | "MM" | "SD" | "PP" | "PM" | "QM" | "PS"
  | "WM" | "EWM" | "TM" | "ABAP" | "BASIS" | "BW" | "BW4HANA"
  | "BTP" | "CPI" | "PI_PO" | "SAC" | "DATASPHERE" | "HANA" | "FIORI" | "UI5"
  | "SUCCESSFACTORS" | "ARIBA" | "CONCUR" | "FIELDGLASS" | "MDG" | "GRC"
  | "SECURITY" | "VIM" | "OPENTEXT" | "PPDS" | "APO" | "SCM" | "IBP"
  | "CRM" | "C4C" | "SRM" | "BPC" | "TRM" | "FSCM" | "IS_U" | "UNKNOWN";

export type SapSkillTaxonomyItem = {
  code: string;
  name: string;
  category: string;
  aliases: string[];
  submodules?: string[];
  active?: boolean;
};

export type CompanyTaxonomyItem = {
  name: string;
  category: string;
  countries?: string[];
  aliases?: string[];
  active?: boolean;
  country?: string;
};
type TaxonomyEntry = {
  key: SapModuleKey;
  label: string;
  family: "functional" | "technical" | "platform" | "cloud" | "analytics" | "industry" | "security";
  priority: number;
  aliases: string[];
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: any) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSapToken(value: any): string {
  return String(value || "")
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP[-_]/i, "")
    .replace(/&/g, "AND")
    .replace(/\+/g, "PLUS")
    .replace(/[.]/g, "")
    .replace(/[\s/_-]/g, "")
    .trim();
}

export const SAP_MODULE_TAXONOMY: TaxonomyEntry[] = [
  { key: "BTP", label: "SAP BTP", family: "platform", priority: 100, aliases: ["SAP BTP", "BTP", "Business Technology Platform", "SAP Business Technology Platform", "SAP Cloud Platform", "SCP", "Extension Suite", "SAP Extension Suite", "Integration Suite", "SAP Integration Suite", "Event Mesh", "SAP Event Mesh", "Build Apps", "SAP Build Apps", "Build Process Automation", "SAP Build Process Automation"] },
  { key: "CPI", label: "SAP CPI", family: "cloud", priority: 96, aliases: ["SAP CPI", "CPI", "Cloud Platform Integration", "Cloud Integration", "SAP Cloud Integration", "Integration Suite", "SAP Integration Suite", "HCI", "HANA Cloud Integration"] },
  { key: "PI_PO", label: "SAP PI/PO", family: "technical", priority: 82, aliases: ["SAP PI/PO", "PI/PO", "PI PO", "SAP PI", "SAP PO", "Process Integration", "Process Orchestration", "XI", "Exchange Infrastructure"] },
  { key: "ABAP", label: "SAP ABAP", family: "technical", priority: 88, aliases: ["ABAP", "SAP ABAP", "ABAP OO", "OO ABAP", "RICEFW", "WRICEF", "CDS", "AMDP", "BADI", "BAPI", "IDOC", "ALE", "Smartforms", "Adobe Forms"] },
  { key: "BASIS", label: "SAP Basis", family: "technical", priority: 86, aliases: ["SAP Basis", "Basis", "NetWeaver", "SAP NetWeaver", "HANA DB Administration", "System Administration", "Solution Manager", "SolMan", "ChaRM", "Transport Management", "SAP Security Basis"] },
  { key: "FICO", label: "SAP FICO", family: "functional", priority: 92, aliases: ["SAP FICO", "FICO", "FI CO", "FI/CO", "Finance and Controlling", "Finance & Controlling", "Financial Accounting", "Controlling", "SAP Finance", "S/4HANA Finance", "Central Finance", "GL", "AP", "AR", "AA", "CO-PA", "COPA", "PCA", "CCA", "Product Costing"] },
  { key: "FI", label: "SAP FI", family: "functional", priority: 80, aliases: ["SAP FI", "FI", "Financial Accounting", "General Ledger", "Accounts Payable", "Accounts Receivable", "Asset Accounting", "Bank Accounting"] },
  { key: "CO", label: "SAP CO", family: "functional", priority: 80, aliases: ["SAP CO", "CO", "Controlling", "Cost Center Accounting", "Profit Center Accounting", "Internal Orders", "Product Costing", "CO PA", "COPA"] },
  { key: "MM", label: "SAP MM", family: "functional", priority: 86, aliases: ["SAP MM", "MM", "Materials Management", "Procurement", "Purchasing", "Inventory Management", "P2P", "Procure to Pay", "Source to Pay", "S2P", "STP"] },
  { key: "SD", label: "SAP SD", family: "functional", priority: 86, aliases: ["SAP SD", "SD", "Sales and Distribution", "Sales & Distribution", "Order to Cash", "O2C", "OTC", "Pricing", "Billing", "Delivery", "LE-SD"] },
  { key: "PP", label: "SAP PP", family: "functional", priority: 84, aliases: ["SAP PP", "PP", "Production Planning", "Manufacturing", "MRP", "Shop Floor", "Discrete Manufacturing", "Repetitive Manufacturing"] },
  { key: "PM", label: "SAP PM", family: "functional", priority: 82, aliases: ["SAP PM", "PM", "Plant Maintenance", "EAM", "Enterprise Asset Management", "Maintenance Management"] },
  { key: "QM", label: "SAP QM", family: "functional", priority: 82, aliases: ["SAP QM", "QM", "Quality Management", "Quality Inspection", "Inspection Lot"] },
  { key: "PS", label: "SAP PS", family: "functional", priority: 80, aliases: ["SAP PS", "PS", "Project System", "Project Systems", "Project Accounting"] },
  { key: "WM", label: "SAP WM", family: "functional", priority: 78, aliases: ["SAP WM", "WM", "Warehouse Management", "Warehouse"] },
  { key: "EWM", label: "SAP EWM", family: "functional", priority: 86, aliases: ["SAP EWM", "EWM", "Extended Warehouse Management", "Embedded EWM", "Decentralized EWM"] },
  { key: "TM", label: "SAP TM", family: "functional", priority: 84, aliases: ["SAP TM", "TM", "Transportation Management", "Transport Management"] },
  { key: "SUCCESSFACTORS", label: "SAP SuccessFactors", family: "cloud", priority: 84, aliases: ["SuccessFactors", "SAP SuccessFactors", "SF", "SAP SF", "Employee Central", "EC", "EC Payroll", "Recruiting Management", "RCM", "Onboarding", "Performance & Goals", "Compensation", "Learning Management", "LMS", "SAP HCM", "SAP HXM"] },
  { key: "ARIBA", label: "SAP Ariba", family: "cloud", priority: 82, aliases: ["SAP Ariba", "Ariba", "Ariba Buying", "Ariba Sourcing", "Ariba Contracts", "Supplier Lifecycle", "SLP"] },
  { key: "CONCUR", label: "SAP Concur", family: "cloud", priority: 76, aliases: ["SAP Concur", "Concur", "Travel and Expense", "T&E"] },
  { key: "FIELDGLASS", label: "SAP Fieldglass", family: "cloud", priority: 76, aliases: ["SAP Fieldglass", "Fieldglass", "Vendor Management System", "VMS"] },
  { key: "BW4HANA", label: "SAP BW/4HANA", family: "analytics", priority: 86, aliases: ["BW/4HANA", "BW4HANA", "SAP BW4HANA", "SAP BW/4HANA"] },
  { key: "BW", label: "SAP BW", family: "analytics", priority: 82, aliases: ["SAP BW", "BW", "Business Warehouse", "BI", "SAP BI", "BW on HANA"] },
  { key: "SAC", label: "SAP SAC", family: "analytics", priority: 84, aliases: ["SAP SAC", "SAC", "SAP Analytics Cloud", "Analytics Cloud", "Planning in SAC"] },
  { key: "DATASPHERE", label: "SAP Datasphere", family: "analytics", priority: 84, aliases: ["SAP Datasphere", "Datasphere", "SAP Data Warehouse Cloud", "Data Warehouse Cloud", "DWC"] },
  { key: "HANA", label: "SAP HANA", family: "technical", priority: 78, aliases: ["SAP HANA", "HANA", "HANA DB", "HANA Database", "SQLScript", "Calculation View"] },
  { key: "FIORI", label: "SAP Fiori", family: "technical", priority: 78, aliases: ["SAP Fiori", "Fiori", "Fiori Launchpad", "FLP", "Fiori Elements"] },
  { key: "UI5", label: "SAP UI5", family: "technical", priority: 76, aliases: ["SAP UI5", "SAPUI5", "UI5", "OpenUI5"] },
  { key: "MDG", label: "SAP MDG", family: "functional", priority: 82, aliases: ["SAP MDG", "MDG", "Master Data Governance", "Master Data Management"] },
  { key: "GRC", label: "SAP GRC", family: "security", priority: 80, aliases: ["SAP GRC", "GRC", "Governance Risk Compliance", "Access Control", "Process Control", "Risk Management", "SoD", "Segregation of Duties"] },
  { key: "SECURITY", label: "SAP Security", family: "security", priority: 78, aliases: ["SAP Security", "Security", "Authorization", "Authorizations", "PFCG", "Roles and Authorizations", "SAP IAM", "Identity Access Management"] },
  { key: "VIM", label: "SAP VIM", family: "functional", priority: 74, aliases: ["SAP VIM", "VIM", "Vendor Invoice Management", "OpenText VIM", "Invoice Management"] },
  { key: "OPENTEXT", label: "OpenText", family: "technical", priority: 70, aliases: ["OpenText", "SAP OpenText", "ArchiveLink", "xECM", "Extended ECM"] },
  { key: "PPDS", label: "SAP PP/DS", family: "functional", priority: 80, aliases: ["SAP PPDS", "PPDS", "PP/DS", "Production Planning and Detailed Scheduling", "Detailed Scheduling"] },
  { key: "APO", label: "SAP APO", family: "functional", priority: 76, aliases: ["SAP APO", "APO", "Advanced Planning and Optimization", "DP", "SNP", "GATP"] },
  { key: "SCM", label: "SAP SCM", family: "functional", priority: 74, aliases: ["SAP SCM", "SCM", "Supply Chain Management", "Supply Chain"] },
  { key: "IBP", label: "SAP IBP", family: "cloud", priority: 82, aliases: ["SAP IBP", "IBP", "Integrated Business Planning", "Demand Planning", "Supply Planning"] },
  { key: "CRM", label: "SAP CRM", family: "functional", priority: 72, aliases: ["SAP CRM", "CRM", "Customer Relationship Management"] },
  { key: "C4C", label: "SAP C4C", family: "cloud", priority: 72, aliases: ["SAP C4C", "C4C", "Cloud for Customer", "Sales Cloud", "Service Cloud"] },
  { key: "SRM", label: "SAP SRM", family: "functional", priority: 70, aliases: ["SAP SRM", "SRM", "Supplier Relationship Management"] },
  { key: "BPC", label: "SAP BPC", family: "analytics", priority: 76, aliases: ["SAP BPC", "BPC", "Business Planning and Consolidation", "Planning and Consolidation"] },
  { key: "TRM", label: "SAP TRM", family: "functional", priority: 74, aliases: ["SAP TRM", "TRM", "Treasury and Risk Management", "Treasury"] },
  { key: "FSCM", label: "SAP FSCM", family: "functional", priority: 74, aliases: ["SAP FSCM", "FSCM", "Financial Supply Chain Management", "Credit Management", "Collections Management", "Dispute Management"] },
  { key: "IS_U", label: "SAP IS-U", family: "industry", priority: 76, aliases: ["SAP IS-U", "IS-U", "ISU", "Utilities", "SAP Utilities", "Device Management", "Billing for Utilities"] },
];

export const SAP_MODULE_KEYS = SAP_MODULE_TAXONOMY.map((x) => x.key).filter((x) => x !== "UNKNOWN");

const ALIAS_TO_KEY = new Map<string, SapModuleKey>();
for (const entry of SAP_MODULE_TAXONOMY) {
  ALIAS_TO_KEY.set(normalizeSapToken(entry.key), entry.key);
  ALIAS_TO_KEY.set(normalizeSapToken(entry.label), entry.key);
  for (const alias of entry.aliases) ALIAS_TO_KEY.set(normalizeSapToken(alias), entry.key);
}

function aliasRegex(alias: string) {
  const cleaned = normalizeText(alias);
  if (!cleaned) return null;
  if (/^[A-Za-z0-9]{2,6}$/.test(cleaned)) {
    return new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(cleaned)}([^A-Za-z0-9]|$)`, "i");
  }
  return new RegExp(escapeRegex(cleaned).replace(/\s+/g, "\\s+"), "i");
}

export function canonicalSapModule(value: any): SapModuleKey {
  const token = normalizeSapToken(value);
  return ALIAS_TO_KEY.get(token) || "UNKNOWN";
}

export function getSapModuleLabel(value: any): string {
  const key = canonicalSapModule(value);
  return SAP_MODULE_TAXONOMY.find((x) => x.key === key)?.label || String(value || "UNKNOWN");
}

export function candidateTextForTaxonomy(candidate: any): string {
  const parts = [
    candidate?.title,
    candidate?.current_title,
    candidate?.headline,
    candidate?.summary,
    candidate?.skills,
    candidate?.sap_modules,
    candidate?.sap_submodules,
    candidate?.secondary_modules,
    candidate?.project_types,
    candidate?.experience,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv,
    candidate?.rawText,
    candidate?.resumeText,
    candidate?.search_text,
    candidate?.candidate_search_text,
  ];
  return parts.map((p) => Array.isArray(p) ? p.join(" ") : typeof p === "object" && p ? JSON.stringify(p) : String(p || "")).join(" ");
}

export function inferSapModulesFromText(input: any): { primaryModule: SapModuleKey; modules: SapModuleKey[]; moduleScores: Record<string, number> } {
  const text = normalizeText(typeof input === "string" ? input : candidateTextForTaxonomy(input));
  const titleText = normalizeText(typeof input === "string" ? "" : `${input?.title || ""} ${input?.current_title || ""} ${input?.headline || ""}`);
  const scores = new Map<SapModuleKey, number>();

  const add = (key: SapModuleKey, points: number) => {
    if (key === "UNKNOWN") return;
    scores.set(key, (scores.get(key) || 0) + points);
  };

  if (typeof input === "object" && input) {
    for (const field of [input.primary_module, input.primaryModule, input.module, input.sap_module]) add(canonicalSapModule(field), 80);
    for (const arr of [input.sap_modules, input.secondary_modules, input.sap_submodules]) {
      if (Array.isArray(arr)) for (const m of arr) add(canonicalSapModule(m), 45);
    }
  }

  for (const entry of SAP_MODULE_TAXONOMY) {
    if (entry.key === "UNKNOWN") continue;
    for (const alias of entry.aliases) {
      const rx = aliasRegex(alias);
      if (!rx) continue;
      if (rx.test(titleText)) add(entry.key, entry.priority + 35);
      if (rx.test(text)) add(entry.key, entry.priority);
    }
  }

  // Avoid FI/CO split winning over FICO when FICO evidence exists.
  const ficoScore = scores.get("FICO") || 0;
  if (ficoScore > 0) {
    scores.set("FI", Math.max(0, (scores.get("FI") || 0) - 35));
    scores.set("CO", Math.max(0, (scores.get("CO") || 0) - 35));
  }

  // BTP umbrella should win when platform ecosystem evidence is clearly dominant.
  const btpAdj = ["CPI", "SAC", "DATASPHERE", "FIORI", "UI5", "PI_PO", "HANA"].reduce((s, k) => s + (scores.get(k as SapModuleKey) || 0), 0);
  if ((scores.get("BTP") || 0) > 0 && btpAdj > 80) scores.set("BTP", (scores.get("BTP") || 0) + Math.min(120, Math.round(btpAdj * 0.25)));

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const modules = ranked.filter(([, score]) => score >= 40).map(([key]) => key);
  const primaryModule = modules[0] || "UNKNOWN";
  const moduleScores: Record<string, number> = {};
  for (const [key, score] of ranked) moduleScores[key] = Math.min(100, Math.round(score / 2));
  return { primaryModule, modules, moduleScores };
}

export function normalizeSapModulesArray(value: any): SapModuleKey[] {
  const arr = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;/|]+/) : [];
  return Array.from(new Set(arr.map(canonicalSapModule).filter((x) => x !== "UNKNOWN")));
}

export function enrichCandidateWithSapTaxonomy(candidate: any): any {
  const inferred = inferSapModulesFromText(candidate || {});
  const existingModules = normalizeSapModulesArray(candidate?.sap_modules);
  const mergedModules = Array.from(new Set([...(inferred.modules || []), ...existingModules]));
  const existingPrimary = canonicalSapModule(candidate?.primary_module || candidate?.primaryModule || candidate?.module || candidate?.sap_module);
  const primaryModule = existingPrimary !== "UNKNOWN" ? existingPrimary : inferred.primaryModule;

  return {
    ...(candidate || {}),
    primary_module: primaryModule !== "UNKNOWN" ? primaryModule : candidate?.primary_module,
    primaryModule: primaryModule !== "UNKNOWN" ? primaryModule : candidate?.primaryModule,
    sap_modules: mergedModules.length ? mergedModules : candidate?.sap_modules,
    secondary_modules: mergedModules.filter((m) => m !== primaryModule),
    module_authorities: {
      ...(candidate?.module_authorities || {}),
      ...(inferred.moduleScores || {}),
    },
    moduleScores: {
      ...(candidate?.moduleScores || {}),
      ...(inferred.moduleScores || {}),
    },
  };
}

// -----------------------------------------------------------------------------
// Compatibility exports for app/search/page.tsx
// These keep the legacy search page working while using the newer master SAP
// taxonomy above. Keep all suggestion arrays as clean string[] values only.
// -----------------------------------------------------------------------------

export const SAP_SKILL_TAXONOMY: string[] = SAP_MODULE_TAXONOMY
  .map((entry) => entry.key)
  .filter((key) => key !== "UNKNOWN");

export const SAP_TALENT_SKILL_GROUPS: { group: string; skills: string[] }[] = [
  {
    group: "SAP Core Functional",
    skills: ["FICO", "FI", "CO", "MM", "SD", "PP", "PM", "QM", "PS", "WM"],
  },
  {
    group: "SAP Supply Chain & Logistics",
    skills: ["EWM", "TM", "SCM", "IBP", "APO", "PPDS", "SRM"],
  },
  {
    group: "SAP Technical & Platform",
    skills: ["ABAP", "BASIS", "BTP", "CPI", "PI_PO", "HANA", "FIORI", "UI5", "SECURITY"],
  },
  {
    group: "SAP Data & Analytics",
    skills: ["BW", "BW4HANA", "SAC", "DATASPHERE", "BPC"],
  },
  {
    group: "SAP Cloud Applications",
    skills: ["SUCCESSFACTORS", "ARIBA", "CONCUR", "FIELDGLASS", "C4C"],
  },
  {
    group: "SAP Governance, Finance Extensions & Industry",
    skills: ["MDG", "GRC", "VIM", "OPENTEXT", "TRM", "FSCM", "CRM", "IS_U"],
  },
];

export function getSapSkillDisplayLabel(skill: any): string {
  const key = canonicalSapModule(skill);
  const label = SAP_MODULE_TAXONOMY.find((entry) => entry.key === key)?.label;
  if (label) return label;
  return String(skill || "").trim();
}

export const COMPANY_TAXONOMY: string[] = [
  "SAP",
  "Accenture",
  "Deloitte",
  "PwC",
  "EY",
  "KPMG",
  "IBM",
  "Capgemini",
  "NTT DATA",
  "Tata Consultancy Services",
  "TCS",
  "Infosys",
  "Wipro",
  "Cognizant",
  "DXC Technology",
  "Fujitsu",
  "Hitachi",
  "Bosch",
  "cbs Corporate Business Solutions",
  "cbs",
  "ABeam Consulting",
  "TDI APJ",
  "FPT",
  "FPT Software",
  "NashTech",
  "Deloitte Consulting",
  "PwC Consulting",
  "EY Consulting",
  "KPMG Consulting",
  "HCLTech",
  "Tech Mahindra",
  "Atos",
  "Sopra Steria",
  "EPAM",
  "Tietoevry",
  "BearingPoint",
  "msg global",
  "NTT DATA Business Solutions",
  "itelligence",
  "IBM Consulting",
  "Avanade",
  "SNP Group",
  "SoftwareOne",
  "Delaware Consulting",
  "All for One Group",
  "Seidor",
  "MHP",
  "Westernacher",
  "YASH Technologies",
  "Birlasoft",
  "LTIMindtree",
  "LTI",
  "Mindtree",
  "UST",
  "Hexaware",
  "Persistent Systems",
  "Zalaris",
  "HR Path",
  "Rizing",
  "Plaut",
  "Nagarro",
  "oXya",
  "Syntax",
  "T-Systems",
  "Kyndryl",
  "FIS",
  "DXC",
  "CGI",
  "FPT Asia",
  "NEC",
  "NTT",
  "ABeam",
  "TDI",
  "Primus Partners",
].filter((company): company is string => typeof company === "string" && company.trim().length > 0);

export const COMPANY_TAXONOMY_SUGGESTIONS: string[] = Array.from(new Set(COMPANY_TAXONOMY));
