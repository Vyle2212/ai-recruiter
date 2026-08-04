// lib/taxonomyDiscovery.ts
import { supabase } from "./supabase";
import { CORE_SAP_MODULES, SAP_ALIAS_FALLBACK } from "./sapKnowledgeGraph";

type CandidateRow = { id: string; raw_text?: string | null; resume_text?: string | null; raw_cv?: string | null; current_title?: string | null; title?: string | null; current_company?: string | null; company?: string | null; };

function normalize(value: any) { return String(value || "").replace(/\s+/g, " ").trim(); }
function cleanKey(value: any) { return normalize(value).toLowerCase(); }

const SAP_DISCOVERY_PATTERNS = [
  /\bSAP\s+[A-Z][A-Za-z0-9/+\-. ]{2,40}\b/g,
  /\b(SAP Build Apps|SAP Build Code|SAP Joule|GenAI Hub|Integration Suite|Event Mesh|API Management|Datasphere|BW\/4HANA|SAC Planning|Group Reporting)\b/gi,
  /\b(CPI|CAP|RAP|CDS|AMDP|OData|WRICEF|RICEFW|EWM|TM|IBP|MDG|GRC|BTP|CFIN|TRM|BCM|FSCM|COPA|BPC)\b/g,
];

const GENERIC_BLOCKLIST = new Set(["sap", "sap consultant", "sap senior consultant", "sap functional consultant", "sap technical consultant", "sap implementation", "sap support", "sap project", "sap system", "sap hana", "sap s4hana", "sap s/4hana"]);
const KNOWN_FIRMS = ["Accenture","Deloitte","PwC","PricewaterhouseCoopers","EY","Ernst & Young","KPMG","IBM","Capgemini","NTT Data","Infosys","Wipro","TCS","Cognizant","DXC","Fujitsu","Atos","HCL","Tech Mahindra","FPT Software","ABeam","cbs","Corporate Business Solutions"];

function extractPotentialSapTerms(text: string) {
  const found = new Set<string>();
  for (const pattern of SAP_DISCOVERY_PATTERNS) {
    const matches = text.match(pattern) || [];
    matches.forEach((m) => {
      const v = normalize(m).replace(/[.,;:)]$/g, "").replace(/^SAP\s+SAP\s+/i, "SAP ");
      const key = cleanKey(v);
      if (v.length >= 2 && v.length <= 60 && !GENERIC_BLOCKLIST.has(key)) found.add(v);
    });
  }
  return [...found].filter((term) => {
    const simple = term.replace(/^SAP\s+/i, "");
    const knownCore = CORE_SAP_MODULES.some((m) => cleanKey(m) === cleanKey(simple));
    const knownAlias = SAP_ALIAS_FALLBACK.some((a) => cleanKey(a.alias) === cleanKey(simple));
    return !knownCore && !knownAlias;
  });
}

function extractPotentialFirms(row: CandidateRow) {
  const text = [row.current_company, row.company, row.raw_text, row.resume_text].join(" ");
  const found = new Set<string>();
  for (const firm of KNOWN_FIRMS) if (new RegExp(`\\b${firm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) found.add(firm);
  const possible = text.match(/\b[A-Z][A-Za-z&. ]{2,45}\s+(Consulting|Solutions|Technologies|Technology|Software|Systems|Services)\b/g) || [];
  possible.forEach((m) => { const v = normalize(m); if (v.length >= 5 && v.length <= 70) found.add(v); });
  return [...found];
}

async function upsertReview(sourceType: "SAP_SKILL" | "CONSULTING_FIRM", value: string, suggestedParent: string | null, candidateId: string) {
  const detected_value = normalize(value);
  if (!detected_value) return;
  const { data: existing } = await supabase.from("taxonomy_review_queue").select("id,evidence_count,sample_candidate_ids").eq("source_type", sourceType).eq("detected_value", detected_value).maybeSingle();
  if (existing?.id) {
    const ids = Array.from(new Set([...(existing.sample_candidate_ids || []), candidateId])).slice(0, 10);
    await supabase.from("taxonomy_review_queue").update({ evidence_count: Number(existing.evidence_count || 0) + 1, sample_candidate_ids: ids }).eq("id", existing.id);
    return;
  }
  await supabase.from("taxonomy_review_queue").insert({ source_type: sourceType, detected_value, suggested_parent: suggestedParent, confidence: sourceType === "SAP_SKILL" ? 60 : 55, evidence_count: 1, sample_candidate_ids: [candidateId], status: "PENDING" });
}

export async function runTaxonomyDiscovery(limit = 1000) {
  const { data, error } = await supabase.from("candidates").select("id,raw_text,resume_text,raw_cv,current_title,title,current_company,company").limit(limit);
  if (error) throw error;
  const rows = (data || []) as CandidateRow[];
  let sapTerms = 0, firms = 0;
  for (const row of rows) {
    const text = [row.title, row.current_title, row.raw_text, row.resume_text, row.raw_cv].join(" ");
    for (const term of extractPotentialSapTerms(text)) { await upsertReview("SAP_SKILL", term, null, row.id); sapTerms++; }
    for (const firm of extractPotentialFirms(row)) { await upsertReview("CONSULTING_FIRM", firm, null, row.id); firms++; }
  }
  return { scannedCandidates: rows.length, sapTermsDetected: sapTerms, firmsDetected: firms };
}
