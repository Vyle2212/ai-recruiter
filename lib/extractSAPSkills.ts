import {
  extractSapSkillsFromText,
  extractSapSkillsFromTextAsync,
  normalizeSapSkillWithLocalTaxonomy,
} from "./taxonomyEngine";

/**
 * Backward-compatible sync extractor.
 * Uses local taxonomy fallback so existing parser imports do not need to become async.
 */
export function extractSAPSkills(text: string): string[] {
  return extractSapSkillsFromText(text);
}

/**
 * DB-driven extractor for API routes/server workflows.
 * Reads sap_modules aliases first, then falls back to local taxonomy.
 */
export async function extractSAPSkillsAsync(text: string): Promise<string[]> {
  return extractSapSkillsFromTextAsync(text);
}

export function normalizeExtractedSAPSkill(skill: string): string {
  return normalizeSapSkillWithLocalTaxonomy(skill);
}
