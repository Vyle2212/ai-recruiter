import { PROCESS_ALIAS_SEED } from "@/data/process-alias-seed";
import { supabase } from "./supabase";
import {
  COMPANY_TAXONOMY,
  SAP_SKILL_TAXONOMY,
  type CompanyTaxonomyItem,
  type SapSkillTaxonomyItem,
} from "./sapTalentTaxonomy";

export type TaxonomySapSkill = SapSkillTaxonomyItem & {
  id?: string | number;
  active?: boolean;
};

export type TaxonomyCompany = CompanyTaxonomyItem & {
  id?: string | number;
  category: string;
  country?: string;
  countries?: string[];
  active?: boolean;
};

type AnyRecord = Record<string, any>;

let cache: TaxonomyEngine | null = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function parseArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).map((x) => x.trim()).filter(Boolean);
    } catch {}
    return value.split(/[;,|\n]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeTaxonomyText(value: any): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/s\s*\/\s*4\s*hana/g, "s4hana")
    .replace(/s4\s*hana/g, "s4hana")
    .replace(/bw\s*\/\s*4\s*hana/g, "bw4hana")
    .replace(/fi\s*\/\s*co/g, "fico")
    .replace(/fi\s+co/g, "fico")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boundaryIncludes(haystack: string, needle: string) {
  const term = normalizeTaxonomyText(needle);
  if (!term) return false;
  if (term.length <= 2) {
    return new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(haystack);
  }
  return haystack.includes(term);
}

function normalizeSkillRecord(row: any): TaxonomySapSkill | null {
  if (typeof row === "string") {
    const code = String(row).trim();
    if (!code) return null;
    return {
      code,
      name: code,
      category: "Other",
      aliases: [],
      submodules: [],
      active: true,
    };
  }

  const code = String(row?.code || "").trim();
  const name = String(row?.name || "").trim();
  if (!code || !name) return null;
  return {
    code,
    name,
    category: String(row?.category || "Other").trim(),
    aliases: parseArray(row?.aliases),
    submodules: parseArray(row?.submodules),
    active: row?.active !== false,
  };
}

function normalizeCompanyRecord(row: any): TaxonomyCompany | null {
  if (typeof row === "string") {
    const name = String(row).trim();
    if (!name) return null;
    return {
      name,
      category: "Other",
      aliases: [],
      countries: [],
      active: true,
    };
  }

  const name = String(row?.name || "").trim();
  if (!name) return null;
  return {
    name,
    category: String(row?.category || "Other").trim(),
    aliases: parseArray(row?.aliases),
    countries: parseArray(row?.countries || row?.country),
    country: String(row?.country || "").trim() || undefined,
    active: row?.active !== false,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function buildSkillTerms(skill: TaxonomySapSkill) {
  return unique([
    skill.code,
    skill.name,
    `SAP ${skill.code}`,
    `SAP ${skill.name}`,
    ...parseArray(skill.aliases),
    ...parseArray(skill.submodules),
  ]);
}

function buildCompanyTerms(company: TaxonomyCompany) {
  return unique([company.name, ...(company.aliases || [])]);
}

export function getSapSkillDisplayLabelFromRecord(skill: Pick<TaxonomySapSkill, "code" | "name">) {
  const code = String(skill.code || "").trim();
  const cleanName = String(skill.name || "").trim().replace(/^SAP\s+/i, "");
  if (!cleanName) return code;
  return `${code} — SAP ${cleanName}`;
}

export class TaxonomyEngine {
  sapSkills: TaxonomySapSkill[];
  companies: TaxonomyCompany[];
  sapAliasToCode: Record<string, string>;
  companyAliasToName: Record<string, string>;
  processAliasToCodes: Record<string, string[]>;

  constructor(sapSkills: TaxonomySapSkill[], companies: TaxonomyCompany[]) {
    this.sapSkills = sapSkills.filter((x) => x.active !== false);
    this.companies = companies.filter((x) => x.active !== false);
    this.sapAliasToCode = {};
    this.companyAliasToName = {};
    this.processAliasToCodes = {};

    for (const skill of this.sapSkills) {
      for (const term of buildSkillTerms(skill)) {
        this.sapAliasToCode[normalizeTaxonomyText(term)] = skill.code;
      }
    }

    // Critical SAP recruiting aliases that should work even if DB seed is still light.
    Object.assign(this.sapAliasToCode, {
      fico: "FICO",
      finance: "FICO",
      "finance controlling": "FICO",
      "financial accounting controlling": "FICO",
      "order to cash": "SD",
      otc: "SD",
      o2c: "SD",
      "order 2 cash": "SD",
      "sales distribution": "SD",
      "sales and distribution": "SD",
      "procure to pay": "MM",
      p2p: "MM",
      ptp: "MM",
      procurement: "MM",
      purchasing: "MM",
      "central finance": "CFIN",
      cfin: "CFIN",
      rtr: "FICO",
      "record to report": "FICO",
      "group reporting": "GR",
      treasury: "TRM",
      "cash management": "TRM",
      "bank communication management": "TRM",
      bcm: "TRM",
      "extended warehouse management": "EWM",
      warehouse: "EWM",
      "transportation management": "TM",
      "business technology platform": "BTP",
      "analytics cloud": "SAC",
      "sap analytics cloud": "SAC",
      successfactors: "SuccessFactors",
      "success factors": "SuccessFactors",
      sf: "SuccessFactors",
      isu: "IS-U",
      "is u": "IS-U",
      wricef: "WRICEF",
      ricefw: "WRICEF",
    });

    for (const [alias, codes] of Object.entries(PROCESS_ALIAS_SEED)) {
      const normalizedAlias = normalizeTaxonomyText(alias);
      const normalizedCodes = unique(codes.map((code) => this.normalizeSapSkill(code)).filter(Boolean));
      if (normalizedAlias && normalizedCodes.length) {
        this.processAliasToCodes[normalizedAlias] = normalizedCodes;
        // Keep single-code compatibility for existing search/UI paths. Multi-code aliases
        // can be consumed through detectProcessAliasModules().
        this.sapAliasToCode[normalizedAlias] = normalizedCodes[0];
      }
    }

    for (const company of this.companies) {
      for (const term of buildCompanyTerms(company)) {
        this.companyAliasToName[normalizeTaxonomyText(term)] = company.name;
      }
    }

    Object.assign(this.companyAliasToName, {
      pricewaterhousecoopers: "PwC",
      "pwc consulting": "PwC",
      "deloitte consulting": "Deloitte",
      "ey consulting": "EY",
      "ernst young": "EY",
      "ernst and young": "EY",
      "kpmg advisory": "KPMG",
      cbs: "cbs Corporate Business Solutions",
      "corporate business solutions": "cbs Corporate Business Solutions",
      ntt: "NTT DATA",
      "ntt data business solutions": "NTT DATA",
      ibm: "IBM Consulting",
    });
  }

  detectProcessAliasModules(text: any): string[] {
    const haystack = normalizeTaxonomyText(text);
    if (!haystack) return [];
    const hits: string[] = [];
    for (const [alias, codes] of Object.entries(this.processAliasToCodes)) {
      if (boundaryIncludes(haystack, alias)) hits.push(...codes);
    }
    return unique(hits);
  }

  processAliasTerms(): string[] {
    return Object.keys(this.processAliasToCodes);
  }

  normalizeSapSkill(value: any): string {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const displayCode = raw.replace(/^SAP\s+/i, "").split(/[–—·|]/)[0].trim();
    const key = normalizeTaxonomyText(displayCode);
    return this.sapAliasToCode[key] || this.sapAliasToCode[normalizeTaxonomyText(raw)] || displayCode;
  }

  normalizeCompany(value: any): string {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return this.companyAliasToName[normalizeTaxonomyText(raw)] || raw;
  }

  sapTermsFor(codeOrAlias: string): string[] {
    const code = this.normalizeSapSkill(codeOrAlias);
    const found = this.sapSkills.find((skill) => skill.code.toLowerCase() === code.toLowerCase());
    return found ? buildSkillTerms(found) : [codeOrAlias];
  }

  companyTermsFor(nameOrAlias: string): string[] {
    const name = this.normalizeCompany(nameOrAlias);
    const found = this.companies.find((company) => company.name.toLowerCase() === name.toLowerCase());
    return found ? buildCompanyTerms(found) : [nameOrAlias];
  }

  expandCompanyTerms(values: string[]): string[] {
    return unique(values.flatMap((value) => this.companyTermsFor(value)));
  }

  getCompanyAliasTerms(): string[] {
    return unique(this.companies.flatMap(buildCompanyTerms));
  }

  getSapAliasDictionary(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const skill of this.sapSkills) out[skill.code.toUpperCase()] = buildSkillTerms(skill);
    return out;
  }

  getSapSkillSuggestions(): string[] {
    return this.sapSkills
      .slice()
      .sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code))
      .map(getSapSkillDisplayLabelFromRecord);
  }

  getCompanySuggestions(): string[] {
    return this.companies
      .slice()
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((company) => company.name);
  }

  extractSapSkills(text: any): string[] {
    const haystack = normalizeTaxonomyText(text);
    if (!haystack) return [];
    const processHits = this.detectProcessAliasModules(text);
    const scored = this.sapSkills
      .map((skill) => {
        const terms = buildSkillTerms(skill);
        const hits = terms.filter((term) => boundaryIncludes(haystack, term));
        const exactCodeHit = boundaryIncludes(haystack, skill.code);
        const score = hits.length * 10 + (exactCodeHit ? 12 : 0) + Math.min((skill.submodules || []).filter((s) => boundaryIncludes(haystack, s)).length * 3, 15);
        return { code: skill.code, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    return unique([...processHits, ...scored.map((item) => item.code)]);
  }

  detectPrimarySapSkill(text: any, title?: any, explicit?: any): string | "UNKNOWN" {
    const explicitCode = this.normalizeSapSkill(explicit);
    if (explicitCode) return explicitCode;

    const titleSkills = this.extractSapSkills(title || "");
    if (titleSkills.length) return titleSkills[0];

    const raw = String(text || "");
    const lines = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const topText = lines.slice(0, 10).join("\n");
    const requirementText = lines
      .filter((line) => /require|experience|must|knowledge|skill|module|consultant|hands-on|configuration|customi[sz]ing/i.test(line))
      .slice(0, 60)
      .join("\n");

    const scored = this.sapSkills.map((skill) => {
      const terms = buildSkillTerms(skill);
      const top = terms.filter((term) => boundaryIncludes(normalizeTaxonomyText(topText), term)).length * 35;
      const req = terms.filter((term) => boundaryIncludes(normalizeTaxonomyText(requirementText), term)).length * 20;
      const all = terms.filter((term) => boundaryIncludes(normalizeTaxonomyText(raw), term)).length * 3;
      return { code: skill.code, score: top + req + all };
    }).sort((a, b) => b.score - a.score);

    return scored[0]?.score > 0 ? scored[0].code : "UNKNOWN";
  }

  detectSecondarySapSkills(text: any, primary?: any, explicit?: any): string[] {
    const primaryCode = this.normalizeSapSkill(primary);
    const fromExplicit = parseArray(explicit).map((item) => this.normalizeSapSkill(item));
    const fromText = this.extractSapSkills(text);
    return unique([...fromExplicit, ...fromText]).filter((code) => code && code !== primaryCode).slice(0, 12);
  }
}

export function getLocalTaxonomyEngine() {
  const sapSkills = SAP_SKILL_TAXONOMY.map((item) => normalizeSkillRecord(item)).filter(Boolean) as TaxonomySapSkill[];
  const companies = COMPANY_TAXONOMY.map((item) => normalizeCompanyRecord(item)).filter(Boolean) as TaxonomyCompany[];
  return new TaxonomyEngine(sapSkills, companies);
}

export async function getTaxonomyEngine(options?: { refresh?: boolean }) {
  if (!options?.refresh && cache && Date.now() - cacheAt < CACHE_MS) return cache;

  let sapSkills: TaxonomySapSkill[] = [];
  let companies: TaxonomyCompany[] = [];

  try {
    const [{ data: moduleRows, error: moduleError }, { data: firmRows, error: firmError }] = await Promise.all([
      supabase.from("sap_modules").select("*").eq("active", true),
      supabase.from("consulting_firms").select("*").eq("active", true),
    ]);
    if (!moduleError && moduleRows?.length) sapSkills = moduleRows.map(normalizeSkillRecord).filter(Boolean) as TaxonomySapSkill[];
    if (!firmError && firmRows?.length) companies = firmRows.map(normalizeCompanyRecord).filter(Boolean) as TaxonomyCompany[];
  } catch {
    // Local fallback below keeps build/runtime safe when Supabase is unavailable.
  }

  if (!sapSkills.length) sapSkills = (SAP_SKILL_TAXONOMY.map(normalizeSkillRecord).filter(Boolean) as TaxonomySapSkill[]);
  if (!companies.length) companies = (COMPANY_TAXONOMY.map(normalizeCompanyRecord).filter(Boolean) as TaxonomyCompany[]);

  cache = new TaxonomyEngine(sapSkills, companies);
  cacheAt = Date.now();
  return cache;
}

export function extractSapSkillsFromText(text: any) {
  return getLocalTaxonomyEngine().extractSapSkills(text);
}

export async function extractSapSkillsFromTextAsync(text: any) {
  return (await getTaxonomyEngine()).extractSapSkills(text);
}

export function normalizeSapSkillWithLocalTaxonomy(value: any) {
  return getLocalTaxonomyEngine().normalizeSapSkill(value);
}
