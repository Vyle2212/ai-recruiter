export type SearchIntent = {
  rawQuery: string;
  normalizedQuery: string;
  primaryModule?: string;
  country?: string;
  minYears?: number;
  seniority?: string;
  keywords: string[];
  signals: string[];
  roleType?: string;
};

const MODULE_ALIASES: Record<string, string> = {
  FICO: "FICO",
  FI: "FI",
  CO: "CO",
  MM: "MM",
  SD: "SD",
  ABAP: "ABAP",
  BASIS: "BASIS",
  BTP: "BTP",
  EWM: "EWM",
  TM: "TM",
  BW: "BW",
  SAC: "SAC",
  MDG: "MDG",
  VIM: "VIM",
  PP: "PP",
  PM: "PM",
  QM: "QM",
  PS: "PS",
  HCM: "HCM",
  SUCCESSFACTORS: "SUCCESSFACTORS",
};

const COUNTRY_ALIASES: Record<string, string> = {
  MALAYSIA: "Malaysia",
  MY: "Malaysia",
  PHILIPPINES: "Philippines",
  PH: "Philippines",
  SINGAPORE: "Singapore",
  SG: "Singapore",
  INDONESIA: "Indonesia",
  ID: "Indonesia",
  VIETNAM: "Vietnam",
  VN: "Vietnam",
  THAILAND: "Thailand",
  TH: "Thailand",
};

const SIGNAL_ALIASES: Record<string, string[]> = {
  "S/4HANA": ["S4HANA", "S4 HANA", "S/4HANA", "S/4 HANA"],
  ECC: ["ECC", "SAP ECC"],
  Greenfield: ["GREENFIELD", "GREEN FIELD"],
  Brownfield: ["BROWNFIELD", "BROWN FIELD", "SYSTEM CONVERSION"],
  Migration: ["MIGRATION", "CONVERSION", "DATA MIGRATION"],
  Rollout: ["ROLLOUT", "ROLL OUT", "ROLL-OUT"],
  Implementation: ["IMPLEMENTATION", "END TO END", "FULL CYCLE", "FULL LIFECYCLE"],
  AMS: ["AMS", "SUPPORT", "INCIDENT", "TICKET"],
  Fiori: ["FIORI", "UI5"],
  Integration: ["INTEGRATION", "INTERFACE", "IDOC", "RFC", "API", "ODATA", "CPI", "PI/PO"],
  WRICEF: ["WRICEF", "RICEFW", "RICEF"],
};

function normalizeQuery(query: string) {
  return String(query || "")
    .replace(/[^a-zA-Z0-9/+.#\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function upperTokens(text: string) {
  return text.toUpperCase().split(/\s+/).filter(Boolean);
}

export function parseSearchIntent(query: string): SearchIntent {
  const normalizedQuery = normalizeQuery(query);
  const upper = normalizedQuery.toUpperCase();
  const tokens = upperTokens(normalizedQuery);

  const primaryModule = tokens.map((token) => MODULE_ALIASES[token]).find(Boolean);
  const country = tokens.map((token) => COUNTRY_ALIASES[token]).find(Boolean);

  const yearMatch = upper.match(/(\d{1,2})\s*\+?\s*(YEARS|YRS|YEAR|YR)/);
  const minYears = yearMatch ? Number(yearMatch[1]) : undefined;

  const seniority = /PRINCIPAL|DIRECTOR/i.test(upper)
    ? "Principal / Director"
    : /MANAGER|SOLUTION ARCHITECT/i.test(upper)
    ? "Manager / Solution Architect"
    : /LEAD/i.test(upper)
    ? "Lead Consultant"
    : /SENIOR|SR\b/i.test(upper)
    ? "Senior Consultant"
    : undefined;

  const roleType = /FUNCTIONAL/i.test(upper)
    ? "Functional"
    : /TECHNICAL|ABAP|BASIS/i.test(upper)
    ? "Technical"
    : undefined;

  const signals = Object.entries(SIGNAL_ALIASES)
    .filter(([_, aliases]) => aliases.some((alias) => upper.includes(alias)))
    .map(([label]) => label);

  const stop = new Set([
    "SAP",
    "CONSULTANT",
    "CONSULTANTS",
    "CANDIDATE",
    "CANDIDATES",
    "PROFILE",
    "PROFILES",
    "YEAR",
    "YEARS",
    "YRS",
    "YR",
    ...(primaryModule ? [primaryModule] : []),
    ...(country ? Object.keys(COUNTRY_ALIASES).filter((key) => COUNTRY_ALIASES[key] === country) : []),
  ]);

  const keywords = tokens
    .filter((token) => !stop.has(token))
    .filter((token) => !/^\d+$/.test(token))
    .slice(0, 12);

  return {
    rawQuery: query,
    normalizedQuery,
    primaryModule,
    country,
    minYears,
    seniority,
    keywords,
    signals,
    roleType,
  };
}
