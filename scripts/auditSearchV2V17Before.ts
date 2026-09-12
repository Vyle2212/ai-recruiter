import { dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { candidateSearchV2ProjectionDocument, SEARCH_V2_PROJECTION_FIELDS } from "../lib/candidateSearchV2Projection";
import { rankCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { buildSearchExecutionProfile, buildSearchV2BrowserRequest, searchV2TierCounts, visibleSearchV2Results } from "../lib/searchV2ExecutionProfile";
import { SEARCH_V2_VERSION } from "../lib/searchV2Shared";
import { searchV2DatasetRevision, searchV2ExecutionProfileHash } from "../lib/searchV2Server";
const queries = ["SAP OTC Consultant Singapore", "SAP CPI Consultant Singapore", "SAP MBC Consultant Malaysia", "SAP Datasphere Consultant Malaysia"];
const normalizeForCvHash = (value: string) => String(value || "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s@.+-]/gu, " ").replace(/\s+/g, " ").trim();
const fullHash = (value: string) => createHash("sha256").update(normalizeForCvHash(value)).digest("hex");
const hash = (value: string) => fullHash(value).slice(0, 16);
const safeLocation = (value: unknown) => String(value || "").trim() || "unknown";
async function main() {
  const db = createClient(process.env.CANDIDATE_SUPABASE_URL!, process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const indexResponse = await db.from("candidate_search_index").select(SEARCH_V2_PROJECTION_FIELDS).order("candidate_id").limit(2000);
  if (indexResponse.error) throw indexResponse.error;
  const rows = (indexResponse.data || []) as any[];
  const ids = rows.map((row) => String(row.candidate_id));
  const rawById = new Map<string, any>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const response = await db.from("candidates").select("id,title,current_title,raw_text,resume_text,cv_hash,updated_at").in("id", ids.slice(offset, offset + 100));
    if (response.error) throw response.error;
    for (const row of response.data || []) rawById.set(String(row.id), row);
  }
  const sourceHashes = new Map<string, string[]>();
  const documents = rows.map((row) => {
    const source = rawById.get(String(row.candidate_id));
    const sourceField = String(source?.raw_text || "").trim() ? "raw_text" : String(source?.resume_text || "").trim() ? "resume_text" : "none";
    const sourceValue = sourceField === "raw_text" ? String(source.raw_text) : sourceField === "resume_text" ? String(source.resume_text) : "";
    const fingerprint = hash(sourceValue);
    if (sourceValue) sourceHashes.set(fingerprint, [...(sourceHashes.get(fingerprint) || []), String(row.candidate_id)]);
    return candidateSearchV2ProjectionDocument({ ...row, _trusted_candidate_evidence_values: source ? [
      ...[["current_title", source.current_title], ["title", source.title]].filter(([, value]) => String(value || "").trim()).map(([field, value]) => ({ value: String(value), sourceType: "raw_title", sourceField: "candidates." + field, sourceRecordId: String(source.id), provenance: "candidate_record_raw", trusted: true })),
      ...(sourceValue ? [{ value: sourceValue, sourceType: "raw_professional_text", sourceField: "candidates." + sourceField, sourceRecordId: String(source.id), provenance: "candidate_record_raw", trusted: true }] : []),
    ] : [] });
  });
  const datasetRevision = searchV2DatasetRevision(rows, new Map([...rawById].map(([id, row]) => [id, row.updated_at])));
  const deduped = dedupeCandidateSearchV2Documents(documents);
  const anonymousScopeHash = createHash("sha256").update("anonymous").digest("hex");
  const reports = queries.map((query) => {
    const browserRequest = buildSearchV2BrowserRequest({ query, matchQuality: "relevant", page: 1, pageSize: 20 });
    const profile = buildSearchExecutionProfile(browserRequest, { datasetRevision, authorizationScopeHash: anonymousScopeHash });
    const eligibleResults = rankCandidatesV2(deduped.documents, { ...browserRequest, minimumScore: 0 });
    const allResults = visibleSearchV2Results(eligibleResults, profile);
    const response = { results: allResults };    const tiers = ["exact_verified", "exact_supported", "related", "none"] as const;
    const tierSummary = Object.fromEntries(tiers.map((tier) => {
      const indexes = response.results.map((item, index) => item.targetEvidence.tier === tier ? index + 1 : 0).filter(Boolean);
      const locations: Record<string, number> = {};
      response.results.filter((item) => item.targetEvidence.tier === tier).forEach((item) => { const key = safeLocation(item.country || item.location); locations[key] = (locations[key] || 0) + 1; });
      return [tier, { count: indexes.length, first: indexes[0] || null, last: indexes.at(-1) || null, locations }];
    }));
    const exact = response.results.filter((item) => item.targetEvidence.tier === "exact_verified").map((item) => {
      const source = rawById.get(item.candidateId);
      const sourceField = String(source?.raw_text || "").trim() ? "raw_text" : String(source?.resume_text || "").trim() ? "resume_text" : "none";
      const sourceValue = sourceField === "raw_text" ? String(source.raw_text) : sourceField === "resume_text" ? String(source.resume_text) : "";
      const fingerprint = hash(sourceValue);
      return { candidateId: item.candidateId, target: item.targetEvidence.target, verdict: item.targetEvidence.tier, sourceType: item.targetEvidence.evidenceSourceType, reportedSourceField: item.targetEvidence.sourceField, sourceRecordId: item.targetEvidence.sourceRecordId, sourceValueProvenance: item.targetEvidence.sourceValueProvenance, actualCandidateField: sourceField, matchedLiteral: item.targetEvidence.matchedLiteral, reasonCode: item.targetEvidence.reasonCode, professionalContextType: item.targetEvidence.professionalContextType, trusted: item.targetEvidence.trusted, sourceRecordMatchesCandidate: String(source?.id || "") === item.candidateId, equalsIndexSearchText: sourceValue === String(rows.find((row) => String(row.candidate_id) === item.candidateId)?.search_text || ""), enrichedMarkers: /canonical_candidate_id:|DOMAIN_CLASS_|QUERY_|EXPANDED:/i.test(sourceValue), sharedSourceRecordCount: sourceHashes.get(fingerprint)?.length || 0, rawEqualsResume: String(source?.raw_text || "") === String(source?.resume_text || ""), cvHashMatchesSource: String(source?.cv_hash || "").toLowerCase() === fullHash(sourceValue) };
    });
    return { query, profileHash: searchV2ExecutionProfileHash(profile), matchQuality: profile.matchQuality, appliedMinimumScore: profile.minimumScore, eligibleTotal: eligibleResults.length, eligibleTiers: searchV2TierCounts(eligibleResults), visibleTotal: allResults.length, totalVisible: allResults.length, duplicateIds: response.results.length - new Set(response.results.map((item) => item.candidateId)).size, tiers: tierSummary, exact };
  });
  const audit = { searchVersion: SEARCH_V2_VERSION, datasetRevision, indexedRows: rows.length, sourceRows: rawById.size, sharedSourceFingerprints: [...sourceHashes.values()].filter((ids) => ids.length > 1).map((ids) => ({ count: ids.length, candidateIds: ids })).slice(0, 20), reports };
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/search-v2-v19-profile-parity-audit.json", JSON.stringify(audit, null, 2));
  console.log(JSON.stringify({ searchVersion: audit.searchVersion, datasetRevision: audit.datasetRevision, indexedRows: audit.indexedRows, sourceRows: audit.sourceRows, report: "reports/search-v2-v19-profile-parity-audit.json", queries: reports.map(({ query, totalVisible, duplicateIds, tiers, exact }) => ({ query, totalVisible, duplicateIds, tiers, exactCount: exact.length })) }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });