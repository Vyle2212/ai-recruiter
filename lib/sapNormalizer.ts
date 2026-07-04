import {
  getLocalTaxonomyEngine,
  getTaxonomyEngine,
  normalizeTaxonomyText,
} from "./taxonomyEngine";

export function normalizeSAPSkill(skill: string) {
  const clean = String(skill || "").trim();
  if (!clean) return "";
  return getLocalTaxonomyEngine().normalizeSapSkill(clean);
}

export async function normalizeSAPSkillAsync(skill: string) {
  const clean = String(skill || "").trim();
  if (!clean) return "";
  return (await getTaxonomyEngine()).normalizeSapSkill(clean);
}

export function normalizeSAPSkills(skills: string[]) {
  return Array.from(new Set((skills || []).map(normalizeSAPSkill).filter(Boolean)));
}

export async function normalizeSAPSkillsAsync(skills: string[]) {
  const engine = await getTaxonomyEngine();
  return Array.from(new Set((skills || []).map((skill) => engine.normalizeSapSkill(skill)).filter(Boolean)));
}

export function getSAPSkillAliasMap() {
  return getLocalTaxonomyEngine().getSapAliasDictionary();
}

export async function getSAPSkillAliasMapAsync() {
  return (await getTaxonomyEngine()).getSapAliasDictionary();
}

export { normalizeTaxonomyText };
