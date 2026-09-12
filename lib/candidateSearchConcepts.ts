import { SAP_SEARCH_CONCEPTS } from "./sapSearchTaxonomy";
import type { SearchConceptDefinition } from "./sapSearchTaxonomy";
export type { SearchConceptDefinition } from "./sapSearchTaxonomy";
export type SearchConceptRelation = "EXACT" | "PARENT" | "CHILD" | "RELATED" | "ADJACENT" | "UNRELATED";

// Central, query-agnostic ontology shared by parsing, ranking and display.
export const SEARCH_CONCEPTS: SearchConceptDefinition[] = [
  ...SAP_SEARCH_CONCEPTS,
  { id: "REACT", label: "React", aliases: ["react", "react.js", "reactjs"], roleAliases: ["react developer", "react engineer"], parent: "FRONTEND", related: ["JAVASCRIPT"], supporting: ["React", "TypeScript", "JavaScript", "Frontend"] },
  { id: "JAVASCRIPT", label: "JavaScript", aliases: ["javascript", "typescript", "ecmascript"], parent: "FRONTEND" },
  { id: "FRONTEND", label: "Frontend", aliases: ["frontend", "front end", "web ui"], roleAliases: ["frontend developer", "front end engineer"] },
  { id: "GOLANG", label: "Golang", aliases: ["golang", "go language"], roleAliases: ["golang developer", "go developer", "golang engineer"], parent: "BACKEND", supporting: ["Golang", "Go", "Backend", "Microservices"] },
  { id: "BACKEND", label: "Backend", aliases: ["backend", "back end"], roleAliases: ["backend developer", "back end engineer"] },
  { id: "JAVA", label: "Java", aliases: ["java", "j2ee", "java ee"], roleAliases: ["java developer", "java engineer"], parent: "BACKEND", related: ["MICROSERVICES"] },
  { id: "MICROSERVICES", label: "Microservices", aliases: ["microservices", "micro services", "spring cloud"], related: ["BACKEND", "JAVA", "GOLANG"] },
  { id: "DATA_ENGINEERING", label: "Data Engineering", aliases: ["data engineering", "etl engineering"], roleAliases: ["data engineer", "etl engineer"], supporting: ["Azure", "Databricks", "ETL"] },
  { id: "AZURE_DATABRICKS", label: "Azure Databricks", aliases: ["azure databricks", "databricks", "azure data factory"], related: ["DATA_ENGINEERING"] },
  { id: "AI_ENGINEERING", label: "AI Engineering", aliases: ["ai engineering", "artificial intelligence", "machine learning", "ml engineering"], roleAliases: ["ai engineer", "machine learning engineer", "ml engineer"], supporting: ["Machine Learning", "Python", "LLM"] },
  { id: "MECHANICAL_ENGINEERING", label: "Mechanical Engineering", aliases: ["mechanical engineering"], roleAliases: ["mechanical engineer", "mechanical lead"], supporting: ["Commissioning", "Data Center"] },
  { id: "PROJECT_MANAGEMENT", label: "Project Management", aliases: ["project management", "pmo"], roleAliases: ["project manager", "program manager", "pmo lead"] },
  { id: "COUNTRY_LEAD", label: "Country Leadership", aliases: ["country leadership"], roleAliases: ["country lead", "country manager", "country director"] },
  { id: "FINANCE", label: "Finance", aliases: ["finance", "financial management"], roleAliases: ["finance manager", "finance director", "financial controller"], related: ["IFRS", "FICO", "TRM"] },
  { id: "IFRS", label: "IFRS", aliases: ["ifrs", "international financial reporting standards"], related: ["FINANCE"] },
];
export const SEARCH_LIFECYCLES = ["implementation", "rollout", "greenfield", "brownfield", "migration", "integration", "support", "enhancement", "upgrade", "transformation", "go-live", "deployment", "commissioning", "e-commerce"] as const;
const LIFECYCLE_CANONICAL: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["implementation", ["implementation", "greenfield", "brownfield", "full lifecycle", "full life cycle"]],
  ["rollout", ["rollout", "roll-out"]],
  ["migration", ["migration"]],
  ["integration", ["integration"]],
  ["Support / Enhancement", ["support", "enhancement"]],
  ["upgrade", ["upgrade"]],
  ["transformation", ["transformation"]],
  ["Go-live", ["go-live", "go live", "cutover"]],
  ["deployment", ["deployment"]],
  ["commissioning", ["commissioning"]],
  ["e-commerce", ["e-commerce"]],
];
const normalized = (value: unknown) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9+#./]+/g, " ").replace(/\s+/g, " ").trim();
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
const boundedPatterns = new Map<string, RegExp>();
const bounded = (text: string, phrase: string) => { const key = normalized(phrase); let pattern = boundedPatterns.get(key); if (!pattern) { pattern = new RegExp(`(?:^|[^a-z0-9])${escaped(key)}(?:$|[^a-z0-9])`, "i"); boundedPatterns.set(key, pattern); } return pattern.test(text); };
const conceptsById = new Map(SEARCH_CONCEPTS.map((concept) => [concept.id, concept]));
const canonicalConcepts = new Map<string, string>();
for (const concept of SEARCH_CONCEPTS) for (const alias of [concept.id, concept.label, ...concept.aliases, ...(concept.roleAliases || []), ...(concept.contextAliases || [])]) canonicalConcepts.set(normalized(alias).replace(/^sap\s+/, ""), concept.id);
const conceptTextCache = new Map<string, string[]>();
export function searchConcept(id: string) { return conceptsById.get(id); }
export function canonicalSearchConcept(value: unknown) { return canonicalConcepts.get(normalized(value).replace(/^sap\s+/, "")) || null; }
export function conceptsInText(value: unknown) {
  const source = normalized(value); if (!source) return [];
  const cached = conceptTextCache.get(source); if (cached) return [...cached];
  const safe = SEARCH_CONCEPTS.filter((concept) => [...concept.aliases, ...(concept.roleAliases || [])].some((alias) => bounded(source, alias)));
  const sapContext = /\b(?:sap|s\/4hana|s4hana|ecc|successfactors|netweaver)\b/i.test(source) || safe.some((concept) => concept.ecosystem === "SAP");
  const ids = [...new Set([...safe, ...(sapContext ? SEARCH_CONCEPTS.filter((concept) => (concept.contextAliases || []).some((alias) => bounded(source, alias))) : [])].map((concept) => concept.id))];
  if (conceptTextCache.size >= 5000) conceptTextCache.clear(); conceptTextCache.set(source, ids); return [...ids];
}
export function titleSupportsSearchConcept(title: unknown, conceptId: string) { const source = normalized(title); const concept = searchConcept(conceptId); const sapContext = conceptsInText(source).some((id) => searchConcept(id)?.ecosystem === "SAP"); const contextual = sapContext ? concept?.contextAliases || [] : []; return Boolean(concept && [...(concept.roleAliases || []), ...concept.aliases, ...contextual].some((alias) => bounded(source, alias))); }
function ancestorIds(id: string) { const ancestors: string[] = []; const seen = new Set<string>(); let current = searchConcept(id)?.parent; while (current && !seen.has(current)) { ancestors.push(current); seen.add(current); current = searchConcept(current)?.parent; } return ancestors; }
export function searchConceptRelation(requestedId: string, evidenceId: string): SearchConceptRelation { if (requestedId === evidenceId) return "EXACT"; const requested = searchConcept(requestedId); const evidence = searchConcept(evidenceId); if (!requested || !evidence) return "UNRELATED"; if (requested.incompatible?.includes(evidenceId) || evidence.incompatible?.includes(requestedId)) return "UNRELATED"; if (ancestorIds(evidenceId).includes(requestedId)) return "CHILD"; if (ancestorIds(requestedId).includes(evidenceId)) return "PARENT"; if (requested.stronglyRelated?.includes(evidenceId) || evidence.stronglyRelated?.includes(requestedId) || requested.related?.includes(evidenceId) || evidence.related?.includes(requestedId)) return "RELATED"; if (requested.weaklyRelated?.includes(evidenceId) || evidence.weaklyRelated?.includes(requestedId) || (requested.parent && requested.parent === evidence.parent)) return "ADJACENT"; return "UNRELATED"; }
// Query phrases often contain both a specialization and words belonging to its
// parent label (for example PP/DS also contains "Production Planning"). Keep
// only the most-specific requested concepts; parents remain retrieval fallback,
// not independent requirements.
export function mostSpecificSearchConcepts(ids: string[]) {
  const unique = [...new Set(ids)];
  return unique.filter((candidate) => !unique.some((other) => other !== candidate && searchConceptRelation(candidate, other) === "CHILD"));
}
export function searchConceptRelationStrength(relation: SearchConceptRelation) {
  return relation === "EXACT" ? 1 : relation === "CHILD" ? 0.62 : relation === "PARENT" ? 0.48
    : relation === "RELATED" ? 0.32 : relation === "ADJACENT" ? 0.14 : 0;
}
export function conceptSupportOrder(conceptId: string) { const concept = searchConcept(conceptId); return [concept?.label, ...(concept?.supporting || []), ...(concept?.aliases || [])].filter(Boolean) as string[]; }
export function searchConceptSupportingEvidenceCount(conceptId: string, value: unknown) { const source = normalized(value); const concept = searchConcept(conceptId); if (!source || !concept) return 0; const exactTerms = new Set([concept.label, ...concept.aliases, ...(concept.contextAliases || [])].map(normalized)); return [...new Set(concept.supporting || [])].filter((term) => !exactTerms.has(normalized(term)) && bounded(source, term)).length; }
export function searchConceptSemanticEvidence(conceptId: string, value: unknown) {
  const source = normalized(value);
  const concept = searchConcept(conceptId);
  if (!source || !concept) return { supported: false, directExact: false, exactMatches: [] as string[], strongMatches: [] as string[], partialMatches: [] as string[], clusteredPartialMatches: [] as string[] };
  const exactTerms = [...new Set([concept.label, ...concept.aliases, ...(concept.contextAliases || [])])];
  const exactMatches = exactTerms.filter((term) => bounded(source, term));
  const directWords = "led|owned|ownership|responsible\\s+for|implemented|configured|delivered|implementation\\s+consultant";
  const directExact = exactMatches.some((term) => {
    const exact = escaped(normalized(term));
    return new RegExp(`(?:\\b(?:${directWords})\\b.{0,60}(?:^|[^a-z0-9])${exact}(?:$|[^a-z0-9])|(?:^|[^a-z0-9])${exact}(?:$|[^a-z0-9]).{0,60}\\b(?:${directWords})\\b)`, "i").test(source);
  });
  const rules = concept.semanticEvidence;
  if (!rules) {
    const count = searchConceptSupportingEvidenceCount(conceptId, source);
    const partialMatches = Array.from({ length: count }, (_, index) => `support-${index + 1}`);
    return { supported: exactMatches.length > 0 || count >= 3, directExact, exactMatches, strongMatches: [] as string[], partialMatches, clusteredPartialMatches: partialMatches };
  }
  const strongMatches = [...new Set(rules.strong || [])].filter((term) => bounded(source, term));
  const partialMatches = [...new Set(rules.partial || [])].filter((term) => bounded(source, term));
  const minimumPartialMatches = rules.minimumPartialMatches ?? 3;
  let clusteredPartialMatches: string[] = [];
  for (const anchor of partialMatches) {
    const anchorIndex = source.indexOf(normalized(anchor));
    if (anchorIndex < 0) continue;
    const window = source.slice(Math.max(0, anchorIndex - 250), anchorIndex + normalized(anchor).length + 250);
    const matches = partialMatches.filter((term) => bounded(window, term));
    if (matches.length > clusteredPartialMatches.length) clusteredPartialMatches = matches;
  }
  return { supported: exactMatches.length > 0 || strongMatches.length > 0 || clusteredPartialMatches.length >= minimumPartialMatches, directExact, exactMatches, strongMatches, partialMatches, clusteredPartialMatches };
}
export function searchConceptExpansion(conceptId: string, maximum = 10) { const concept = searchConcept(conceptId); if (!concept) return []; const relatedLabels = [...(concept.stronglyRelated || []), ...(concept.parent ? [concept.parent] : [])].map((id) => searchConcept(id)?.label).filter(Boolean) as string[]; return [...new Set([...(concept.supporting || []), ...relatedLabels, ...concept.aliases])].filter((value) => normalized(value) !== normalized(concept.label)).slice(0, maximum); }
export function lifecycleTermsInText(value: unknown) { const source = normalized(value); return LIFECYCLE_CANONICAL.filter(([,aliases])=>aliases.some(alias=>bounded(source,alias))).map(([label])=>label); }
