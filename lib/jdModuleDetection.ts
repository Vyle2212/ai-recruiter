import { getLocalTaxonomyEngine, getTaxonomyEngine } from "./taxonomyEngine";

export type SapModuleV2 = string;

export const SAP_MODULES_V2 = getLocalTaxonomyEngine()
  .sapSkills
  .map((skill) => skill.code) as readonly string[];

export function normalizeSapModuleV2(value: any): SapModuleV2 | null {
  const normalized = getLocalTaxonomyEngine().normalizeSapSkill(value);
  return normalized || null;
}

export function detectPrimaryModuleFromTitleV2(title: any): SapModuleV2 | null {
  const hit = getLocalTaxonomyEngine().detectPrimarySapSkill(title, title);
  return hit === "UNKNOWN" ? null : hit;
}

export function detectPrimaryModuleForJdV2(
  rawText: any,
  title: any,
  explicit?: any,
): SapModuleV2 | "UNKNOWN" {
  return getLocalTaxonomyEngine().detectPrimarySapSkill(rawText, title, explicit);
}

export function detectSecondaryModulesForJdV2(
  rawText: any,
  primaryModule: any,
  explicit?: any,
): SapModuleV2[] {
  return getLocalTaxonomyEngine().detectSecondarySapSkills(rawText, primaryModule, explicit);
}

/** DB-driven versions for server-side JD parsing. */
export async function normalizeSapModuleV2Async(value: any): Promise<SapModuleV2 | null> {
  const normalized = (await getTaxonomyEngine()).normalizeSapSkill(value);
  return normalized || null;
}

export async function detectPrimaryModuleForJdV2Async(
  rawText: any,
  title: any,
  explicit?: any,
): Promise<SapModuleV2 | "UNKNOWN"> {
  return (await getTaxonomyEngine()).detectPrimarySapSkill(rawText, title, explicit);
}

export async function detectSecondaryModulesForJdV2Async(
  rawText: any,
  primaryModule: any,
  explicit?: any,
): Promise<SapModuleV2[]> {
  return (await getTaxonomyEngine()).detectSecondarySapSkills(rawText, primaryModule, explicit);
}
