import { type SapPrimaryModule, normalizeSapModule } from "./sapRecruiterRules";

type UniversalModuleFitInput = {
  requiredModule: SapPrimaryModule | string;
  primaryModule?: SapPrimaryModule | string;
  secondaryModules?: string[];
  title?: string;
  rawText?: string;
};

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function textOf(...values: any[]) {
  return values
    .filter(Boolean)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .join(" ")
    .toUpperCase();
}

function canon(value: any): SapPrimaryModule {
  return normalizeSapModule(value);
}

export const CORE_SAP_MODULES = [
  'BTP',
  'CPI',
  'PI/PO',
  'MDG',
  'GRC',
  'SECURITY',
  'FIORI',
  'UI5',
  'DATASPHERE',
  'SAC',
  'BW/4HANA',
  'BPC',
  'BOBJ',
  'BODS',
  'CFIN',
  'FSCM',
  'TRM',
  'BCM',
  'GR',
  'ARIBA',
  'IBP',
  'APO',
  'PPDS',
  'SUCCESSFACTORS',
  'EC',
  'ECP',
  'RCM',
  'ONB',
  'LMS',
  'PMGM',
  'CONCUR',
  'FIELDGLASS',
  'BRIM',
  'CX',
  'CRM',
  'FICO',
  'ABAP',
  'BASIS',
  'BW',
  'EWM',
  'TM',
  'MM',
  'SD',
  'PP',
  'PM',
  'PS',
  'QM',
  'GTS',
] as const;

export const SAP_ALIAS_FALLBACK = [
  { module: 'BTP', alias: 'BTP' },
  { module: 'BTP', alias: 'BUSINESS TECHNOLOGY PLATFORM' },
  { module: 'BTP', alias: 'EXTENSION SUITE' },
  { module: 'BTP', alias: 'INTEGRATION SUITE' },
  { module: 'CPI', alias: 'CPI' },
  { module: 'CPI', alias: 'CLOUD PLATFORM INTEGRATION' },
  { module: 'CPI', alias: 'CLOUD INTEGRATION' },
  { module: 'CPI', alias: 'IFLOW' },
  { module: 'CPI', alias: 'I-FLOW' },
  { module: 'PI/PO', alias: 'PI/PO' },
  { module: 'PI/PO', alias: 'PI PO' },
  { module: 'PI/PO', alias: 'PROCESS INTEGRATION' },
  { module: 'PI/PO', alias: 'PROCESS ORCHESTRATION' },
  { module: 'PI/PO', alias: 'XI' },
  { module: 'SAC', alias: 'SAC' },
  { module: 'SAC', alias: 'SAP ANALYTICS CLOUD' },
  { module: 'SAC', alias: 'ANALYTICS CLOUD' },
  { module: 'SAC', alias: 'SAC PLANNING' },
  { module: 'GR', alias: 'GROUP REPORTING' },
  { module: 'GR', alias: 'S/4HANA GROUP REPORTING' },
  { module: 'GR', alias: 'CONSOLIDATION' },
  { module: 'BCM', alias: 'BCM' },
  { module: 'BCM', alias: 'BANK COMMUNICATION MANAGEMENT' },
  { module: 'FSCM', alias: 'FSCM' },
  { module: 'FSCM', alias: 'CREDIT MANAGEMENT' },
  { module: 'FSCM', alias: 'COLLECTIONS' },
  { module: 'FSCM', alias: 'DISPUTE MANAGEMENT' },
  { module: 'TRM', alias: 'TRM' },
  { module: 'TRM', alias: 'TREASURY' },
  { module: 'TRM', alias: 'TREASURY AND RISK MANAGEMENT' },
  { module: 'TRM', alias: 'CASH MANAGEMENT' },
  { module: 'CFIN', alias: 'CFIN' },
  { module: 'CFIN', alias: 'CENTRAL FINANCE' },
  { module: 'CFIN', alias: 'S/4 CENTRAL FINANCE' },
  { module: 'PPDS', alias: 'PPDS' },
  { module: 'PPDS', alias: 'PP/DS' },
  { module: 'PPDS', alias: 'DETAILED SCHEDULING' },
  { module: 'MDG', alias: 'MDG' },
  { module: 'MDG', alias: 'MASTER DATA GOVERNANCE' },
  { module: 'GRC', alias: 'GRC' },
  { module: 'GRC', alias: 'GOVERNANCE RISK' },
  { module: 'GRC', alias: 'ACCESS CONTROL' },
  { module: 'GRC', alias: 'PROCESS CONTROL' },
  { module: 'GRC', alias: 'RISK MANAGEMENT' },
  { module: 'FIORI', alias: 'FIORI' },
  { module: 'FIORI', alias: 'LAUNCHPAD' },
  { module: 'FIORI', alias: 'FIORI ELEMENTS' },
  { module: 'UI5', alias: 'UI5' },
  { module: 'UI5', alias: 'SAPUI5' },
  { module: 'UI5', alias: 'SAP UI5' },
  { module: 'UI5', alias: 'OPENUI5' },
  { module: 'CONCUR', alias: 'CONCUR' },
  { module: 'CONCUR', alias: 'TRAVEL AND EXPENSE' },
  { module: 'CONCUR', alias: 'EXPENSE MANAGEMENT' },
  { module: 'FIELDGLASS', alias: 'FIELDGLASS' },
  { module: 'FIELDGLASS', alias: 'EXTERNAL WORKFORCE' },
  { module: 'FIELDGLASS', alias: 'VENDOR MANAGEMENT' },
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RELATED_GROUPS: string[][] = [
  ["FICO", "FI", "CO", "CFIN", "FSCM", "TRM", "BCM", "COPA", "BPC", "RAR", "FICA"],
  ["MM", "ARIBA", "SRM", "CLM"],
  ["SD", "CRM", "CX", "COMMERCE", "CPQ", "BRIM"],
  ["PP", "PPDS", "APO", "IBP", "DMC", "MII"],
  ["PM", "EAM", "FSM"],
  ["EWM", "WM", "LE", "TM", "GTS"],
  ["BASIS", "SECURITY", "GRC", "HANA"],
  ["BW", "BW/4HANA", "SAC", "DATASPHERE", "BOBJ", "BODS", "PAPM"],
  ["BTP", "CPI", "PI/PO", "INTEGRATION SUITE", "EXTENSION SUITE", "API MANAGEMENT", "EVENT MESH", "KYMA", "CAP", "FIORI", "UI5", "SAC", "DATASPHERE"],
  ["SUCCESSFACTORS", "EC", "ECP", "RCM", "RMK", "ONB", "LMS", "PMGM", "COMP"],
];

const TECHNICAL_NEAR_RELATED: Record<string, string[]> = {
  BTP: ["CPI", "PI/PO", "INTEGRATION SUITE", "EXTENSION SUITE", "API MANAGEMENT", "EVENT MESH", "KYMA", "CAP", "FIORI", "UI5", "SAC", "DATASPHERE", "CLOUD FOUNDRY"],
  ABAP: ["WRICEF", "CDS", "AMDP", "RAP", "FIORI", "UI5", "OData"],
};

const BTP_UNRELATED_FUNCTIONAL_PRIMARY = new Set([
  "FICO", "FI", "CO", "CFIN", "FSCM", "TRM", "MM", "SD", "PP", "PM", "QM", "EWM", "WM", "TM", "PS", "SUCCESSFACTORS", "HCM", "ARIBA"
]);

const BTP_ADJACENT_PRIMARY = new Set(["ABAP", "BASIS", "BW", "BW/4HANA", "HANA"]);


function isRelated(a: string, b: string) {
  if (!a || !b || a === "UNKNOWN" || b === "UNKNOWN") return false;
  if (a === "BTP" && b === "ABAP") return false;
  if (a === "ABAP" && b === "BTP") return false;
  return RELATED_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

function hasExplicitEvidence(required: string, text: string) {
  const patterns: Record<string, RegExp> = {
    BTP: /\b(SAP\s+BTP|BTP|BUSINESS\s+TECHNOLOGY\s+PLATFORM|INTEGRATION\s+SUITE|EXTENSION\s+SUITE|EVENT\s+MESH|API\s+MANAGEMENT|KYMA|CLOUD\s+FOUNDRY|SAP\s+CAP|CAP\s+NODE|CAP\s+JAVA|SAP\s+CPI|CLOUD\s+INTEGRATION|DATASPHERE|DWC|SAP\s+ANALYTICS\s+CLOUD|SAC|FIORI|UI5|RAP|RESTFUL\s+ABAP)\b/i,
    CPI: /\b(CPI|CLOUD\s+PLATFORM\s+INTEGRATION|CLOUD\s+INTEGRATION|IFLOW|I-FLOW)\b/i,
    "PI/PO": /\b(PI\/PO|PI\s+PO|PROCESS\s+INTEGRATION|PROCESS\s+ORCHESTRATION|XI)\b/i,
    ABAP: /\b(ABAP|WRICEF|CDS|AMDP|RAP|OData|FIORI|UI5)\b/i,
    SAC: /\b(SAC|SAP\s+ANALYTICS\s+CLOUD|ANALYTICS\s+CLOUD|SAC\s+PLANNING|PLANNING\s+MODEL)\b/i,
    DATASPHERE: /\b(DATASPHERE|DWC|DATA\s+WAREHOUSE\s+CLOUD)\b/i,
    "BW/4HANA": /\b(BW\/4HANA|BW4HANA|BW\s+4HANA)\b/i,
    MDG: /\b(MDG|MASTER\s+DATA\s+GOVERNANCE)\b/i,
    GRC: /\b(GRC|ACCESS\s+CONTROL|PROCESS\s+CONTROL|SOD)\b/i,
    ARIBA: /\b(ARIBA|SOURCE\s+TO\s+PAY|S2P|GUIDED\s+BUYING|SOURCE\s+TO\s+CONTRACT)\b/i,
    SUCCESSFACTORS: /\b(SUCCESSFACTORS|SUCCESS\s+FACTORS|HXM|EMPLOYEE\s+CENTRAL|ONBOARDING|PMGM|LMS)\b/i,
    CFIN: /\b(CFIN|CENTRAL\s+FINANCE)\b/i,
    FSCM: /\b(FSCM|CREDIT\s+MANAGEMENT|COLLECTIONS?|DISPUTE\s+MANAGEMENT)\b/i,
    TRM: /\b(TRM|TREASURY|CASH\s+MANAGEMENT|BANK\s+COMMUNICATION)\b/i,
    BCM: /\b(BCM|BANK\s+COMMUNICATION\s+MANAGEMENT)\b/i,
    COPA: /\b(COPA|CO-PA|PROFITABILITY\s+ANALYSIS)\b/i,
    BPC: /\b(BPC|BUSINESS\s+PLANNING\s+AND\s+CONSOLIDATION)\b/i,
    GR: /\b(GROUP\s+REPORTING|CONSOLIDATION)\b/i,
    EWM: /\b(EWM|EXTENDED\s+WAREHOUSE|WAREHOUSE\s+MANAGEMENT)\b/i,
  };

  const rule = patterns[required];
  if (rule) return rule.test(text);

  return new RegExp(`\\b${escapeRegExp(required).replace(/-/g, "[-\\s]?")}\\b`, "i").test(text);
}

function hasNearRelatedEvidence(required: string, text: string) {
  const terms = TECHNICAL_NEAR_RELATED[required] || [];
  return terms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text));
}

export function calculateUniversalModuleFit(input: UniversalModuleFitInput) {
  const required = canon(input.requiredModule);
  const primary = canon(input.primaryModule || "UNKNOWN");
  const secondary = (input.secondaryModules || []).map(canon).filter((m) => m !== "UNKNOWN");
  const text = textOf(input.title, input.rawText, input.secondaryModules);

  if (!required || required === "UNKNOWN") {
    return { score: 65, cap: 85, reason: "No required SAP module detected." };
  }

  const explicit = hasExplicitEvidence(required, text);
  const nearRelated = hasNearRelatedEvidence(required, text);

  // BTP is a strict platform role. Do not let FICO/MM/SD/etc. with incidental CPI/Fiori/SAC text rank as BTP.
  if (required === "BTP" && primary !== "BTP") {
    if (BTP_UNRELATED_FUNCTIONAL_PRIMARY.has(primary)) {
      return {
        score: secondary.includes("BTP") || explicit ? 55 : 35,
        cap: secondary.includes("BTP") || explicit ? 65 : 50,
        reason: `BTP evidence is secondary/text-only; primary module is ${primary}.`,
      };
    }

    if (BTP_ADJACENT_PRIMARY.has(primary)) {
      return {
        score: explicit || nearRelated || secondary.includes("BTP") ? 64 : 48,
        cap: explicit || nearRelated || secondary.includes("BTP") ? 72 : 58,
        reason: `${primary}/BTP adjacent evidence only — recruiter validation required.`,
      };
    }

    return {
      score: explicit || secondary.includes("BTP") ? 52 : 35,
      cap: explicit || secondary.includes("BTP") ? 60 : 50,
      reason: `BTP is not the candidate primary module; primary is ${primary}.`,
    };
  }

  if (primary === required) {
    const score = explicit ? 94 : 88;
    return { score, cap: 97, reason: `Direct ${required} primary-module authority.` };
  }

  if (secondary.includes(required)) {
    const score =
      required === "BTP"
        ? explicit
          ? 82
          : 72
        : explicit
          ? 72
          : 62;

    return {
      score,
      cap: required === "BTP" ? 86 : 76,
      reason: `${required} appears as secondary module, not primary.`,
    };
  }

  if (
    required === "BTP" &&
    (primary === "ABAP" || primary === "BW" || primary === "BASIS")
  ) {
    return {
      score: explicit || nearRelated ? 72 : 55,
      cap: explicit || nearRelated ? 82 : 68,
      reason: `${primary}/BTP adjacent technical evidence — recruiter validation recommended.`,
    };
  }

  if (required === "ABAP" && primary === "BTP") {
    return {
      score: explicit || nearRelated ? 55 : 38,
      cap: 60,
      reason: "BTP/ABAP adjacent technical evidence only — not direct ABAP authority.",
    };
  }

  if (explicit && isRelated(required, primary)) {
    return {
      score: required === "BTP" ? 76 : 58,
      cap: required === "BTP" ? 84 : 68,
      reason: `${required} evidence found, but primary module is ${primary}.`,
    };
  }

  if (isRelated(required, primary)) {
    return {
      score: required === "BTP" ? 62 : 42,
      cap: required === "BTP" ? 74 : 58,
      reason: `Related SAP domain only: ${primary} is not ${required}.`,
    };
  }

  return { score: 20, cap: 42, reason: `Primary module is ${primary}, not ${required}.` };
}

export function strictClientModuleGate(input: {
  requiredModule: SapPrimaryModule | string;
  primaryModule?: SapPrimaryModule | string;
  moduleFitScore?: number;
  contactMissing?: boolean;
  nameReviewRequired?: boolean;
  allowBtpAdjacent?: boolean;
}) {
  const required = canon(input.requiredModule);
  const primary = canon(input.primaryModule || "UNKNOWN");
  const score = clamp(Number(input.moduleFitScore || 0));

  const directPass = Boolean(
    required !== "UNKNOWN" &&
      primary === required &&
      score >= 78 &&
      !input.contactMissing &&
      !input.nameReviewRequired
  );

  const btpAdjacentPass = Boolean(
    required === "BTP" &&
      input.allowBtpAdjacent &&
      score >= 72 &&
      !input.contactMissing &&
      !input.nameReviewRequired
  );

  const pass = directPass || btpAdjacentPass;

  return {
    pass,
    reason: pass
      ? directPass
        ? "Direct module and contact gate passed."
        : "BTP-adjacent module and contact gate passed with recruiter validation."
      : `Client strict gate failed: required ${required}, primary ${primary}, module score ${score}.`,
  };
}