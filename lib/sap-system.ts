import { getTaxonomyEngine, getLocalTaxonomyEngine } from "./taxonomyEngine";
import { SAP_TALENT_SKILL_GROUPS } from "./sapTalentTaxonomy";

export async function getSAPKnowledge() {
  const engine = await getTaxonomyEngine();

  return {
    modules: engine.sapSkills,
    groupedModules: SAP_TALENT_SKILL_GROUPS,
    firms: engine.companies,
    source: "taxonomy engine",
  };
}

export function getLocalSAPKnowledge() {
  const engine = getLocalTaxonomyEngine();
  return {
    modules: engine.sapSkills,
    groupedModules: SAP_TALENT_SKILL_GROUPS,
    firms: engine.companies,
    source: "local taxonomy fallback",
  };
}
