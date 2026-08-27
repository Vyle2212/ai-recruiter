import { SAP_SEARCH_CONCEPTS } from "./sapSearchTaxonomy";
import type { GuidedCriterionType, GuidedSearchHandoff, GuidedSourcingPlan } from "./guidedSourcingTypes";

const clean = (value: unknown, max = 300) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, max);
const taxonomyEntries = SAP_SEARCH_CONCEPTS.flatMap((concept) => [concept.id, concept.label, ...concept.aliases, ...(concept.roleAliases || []), ...(concept.contextAliases || [])].map((value) => [clean(value).toLowerCase(), concept] as const));

const canonicalAlias = (value: string) => clean(value).toLowerCase()
  .replace(/\s+(?:modules?|experience)$/g, "")
  .replace(/^fi[- /]?gl$/g, "sap gl")
  .replace(/^aa$/g, "sap aa")
  .replace(/\bsap\s+sales\s+and\s+distribution\b|\bsales\s+and\s+distribution\b/g, "sap sd")
  .replace(/\bsap\s+s\/?4\s*hana\b|\bs\/?4\s*hana\b|\bs4hana\b/g, "sap s/4hana")
  .replace(/\bfi\s*\/\s*co\b|\bfinance\s+and\s+controlling\b/g, "sap fico");

export function resolveGuidedSapConcept(value: string) {
  const normalized = canonicalAlias(value);
  const matches = [...new Map(taxonomyEntries.filter(([alias]) => alias === normalized).map(([, concept]) => [concept.id, concept])).values()];
  return matches.length === 1 ? { status: "approved" as const, id: matches[0].id, label: matches[0].label } : matches.length > 1 ? { status: "ambiguous" as const } : { status: "unknown" as const };
}

export function splitGuidedSapConcepts(value: string) {
  const protectedValue = canonicalAlias(value)
    .replace(/sap sd/g, "SAP_SD")
    .replace(/sap s\/4hana/g, "SAP_S4HANA")
    .replace(/sap fico/g, "SAP_FICO");
  return protectedValue.split(/\s*(?:,|;|\/|\band\b|\bincluding\b|\bwith\b)\s*/i)
    .map((part) => part.replace(/SAP_SD/g, "SAP SD").replace(/SAP_S4HANA/g, "SAP S\/4HANA").replace(/SAP_FICO/g, "SAP FICO").trim())
    .filter((part) => part && !/^(?:sap|modules?|including)$/i.test(part));
}

const values = (plan: GuidedSourcingPlan, type: GuidedCriterionType) => plan.criteria.filter((item) => item.type === type && ["confirmed", "edited"].includes(item.status)).map((item) => item.value);

export function buildConfirmedGuidedSearchHandoff(plan: GuidedSourcingPlan): GuidedSearchHandoff {
  if (plan.criteria.some((item) => item.status === "proposed" || item.status === "unresolved")) throw new Error("Every criterion must be confirmed, edited, or removed before search.");
  const included = plan.criteria.filter((item) => item.status === "confirmed" || item.status === "edited");
  const role = values(plan, "target_role");
  const sap = values(plan, "sap_concept").map((value) => {
    const resolved = resolveGuidedSapConcept(value);
    if (resolved.status !== "approved") throw new Error("SAP concept must match the approved taxonomy before search: " + value);
    return resolved.label;
  });
  const locations = values(plan, "location");
  const minimumYears=values(plan,"minimum_years"),mustHaves=values(plan,"must_have"),otcMust=mustHaves.find(value=>/\b(?:order[- ]to[- ]cash|otc|o2c)\b/i.test(value)),boundOtc=otcMust&&minimumYears.length?`${otcMust} — minimum ${minimumYears[0]} years`:null;
  const parts = [...role, ...sap, ...values(plan, "seniority"), ...(boundOtc?[]:minimumYears.map((value) => `minimum ${value} years experience`)), ...mustHaves.filter(value=>value!==otcMust), ...(boundOtc?[boundOtc]:otcMust?[otcMust]:[]), ...values(plan, "preferred_years").map((value) => `preferred ${value} years experience`), ...values(plan, "nice_to_have"), ...values(plan, "industry"), ...values(plan, "certification"), ...values(plan, "project_context"), ...locations, ...values(plan, "work_preference"), ...values(plan, "exclusion").map((value) => `excluding ${value}`)].filter(Boolean);
  const query = [...new Set(parts)].join(", ");
  return { query, filters: { countries: locations, skills: [], sapModules: sap }, provenance: { schemaVersion: plan.schemaVersion, confirmedCriterionIds: included.map((item) => item.id) }, savePreviewParams: { q: query, module: sap.join(","), country: locations.join(","), searchName: role[0] || "Guided sourcing brief" } };
}
