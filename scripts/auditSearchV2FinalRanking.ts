import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { candidateSearchV2ProjectionDocument, dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";
import { parseRecruiterSearchIntent, recruiterMatchTier } from "../lib/recruiterSearchPresentation";

const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Candidate database configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db.from("candidate_search_index")
      .select("candidate_id,display_name,display_title,display_company,display_location,country,city,years,primary_module,all_modules,all_submodules,project_types,greenfield_count,brownfield_count,rollout_count,ams_count,quality_score,search_text,source_updated_at,email_masked,phone_masked")
      .order("candidate_id").range(from, from + 199);
    if (error) throw error;
    rows.push(...((data || []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 200) break;
  }
  const dedupe = dedupeCandidateSearchV2Documents(rows.map(candidateSearchV2ProjectionDocument));
  const query = process.env.SEARCH_AUDIT_QUERY?.trim() || "Senior SAP FICO Malaysia implementation";
  // Mirrors the browser: natural-language concepts are scored as intent; only
  // separately entered Advanced Filters would appear in `filters`.
  const request = { query, filters: {}, page: 1, pageSize: 100, minimumScore: 50 };
  const rawMatched = searchCandidatesV2(rows.map(candidateSearchV2ProjectionDocument), request).summary.totalMatched;
  const first = searchCandidatesV2(dedupe.documents, request);
  const results = [...first.results];
  const pages = Math.ceil(first.summary.totalMatched / first.summary.pageSize);
  for (let page = 2; page <= pages; page += 1) results.push(...searchCandidatesV2(dedupe.documents, { ...request, page }).results);
  const repeated = searchCandidatesV2([...dedupe.documents].reverse(), request);
  const intent = parseRecruiterSearchIntent(query);
  const tier = (item: typeof results[number]) => recruiterMatchTier(item, intent);
  const tierOrder: Record<string, number> = { "Strong Match": 4, "Good Match": 3, "Potential Match": 2, "Broad Match": 1 };
  const requestedDomain = intent.roleConcepts[0]?.toLowerCase()
    || query.match(/\b(?:fico|abap|sd|mm|basis|btp|bw|ewm|pp)\b/i)?.[0]?.toLowerCase()
    || "";
  const allowedQuerySkills = new Set([requestedDomain, "implementation", ...(requestedDomain === "fico" ? ["fi", "co", "gl", "ap", "ar", "aa", "copa", "fscm", "trm", "cfin", "bpc", "finance", "s/4hana finance"] : [])]);
  const firstHundred = results.slice(0, 100);
  const report = {
    query,
    sourceRows: rows.length,
    rawMatchingRows: rawMatched,
    canonicalCandidatesBeforeQuery: dedupe.uniqueCanonicalCandidates,
    duplicateGroups: dedupe.duplicateGroups,
    duplicateRowsCollapsed: dedupe.duplicateRowsCollapsed,
    totalAfterEligibilityAndDedup: first.summary.totalMatched,
    pages,
    tiers: Object.fromEntries(["Strong Match", "Good Match", "Potential Match", "Broad Match"].map((name) => [name, results.filter((item) => tier(item) === name).length])),
    firstHundred: {
      inspected: firstHundred.length,
      duplicateCanonicalIds: firstHundred.length - new Set(firstHundred.map((item) => item.canonicalCandidateId)).size,
      duplicateDisplayNames: (() => {
        const names = firstHundred.map((item) => String(item.candidateName || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).filter(Boolean);
        return names.length - new Set(names).size;
      })(),
      strongSemanticViolations: firstHundred.filter((item) => tier(item) === "Strong Match" && (
        item.primaryRoleFit !== "exact"
        || !["verified_domain_implementation", "supported_domain_implementation"].includes(item.implementationFit)
        || item.seniorityFit === "mismatch"
        || ["not_verified", "conflicting"].includes(item.locationFit)
      )).length,
      irrelevantVisibleSkills: firstHundred.flatMap((item) => item.queryRelevantSkills.filter((skill) => !allowedQuerySkills.has(skill.toLowerCase()))).length,
      tierOrderViolations: firstHundred.slice(1).filter((item, index) => tierOrder[tier(item)] > tierOrder[tier(firstHundred[index])]).length,
    },
    deterministic: {
      sameTotal: first.summary.totalMatched === repeated.summary.totalMatched,
      sameFirstPageOrder: first.results.map((item) => item.canonicalCandidateId).join("|") === repeated.results.map((item) => item.canonicalCandidateId).join("|"),
    },
    roleEvidenceKinds: Object.fromEntries(["current_direct", "historical_direct", "same_domain", "exposure_only", "keyword_only", "none"].map((kind) => [
      kind,
      results.filter((item) => item.score.roleEvidenceKind === kind).length,
    ])),
    goodPotentialBoundary: (() => {
      const firstPotential = results.findIndex((item) => tier(item) === "Potential Match");
      const start = Math.max(0, firstPotential - 5);
      return results.slice(start, start + 10).map((item, index) => ({
        rank: start + index + 1, candidate: item.candidateName || "Name unavailable", title: item.currentTitle,
        tier: tier(item), score: item.score.finalScore, roleFit: item.primaryRoleFit,
        roleEvidenceKind: item.score.roleEvidenceKind, domainEvidence: item.domainEvidence?.[requestedDomain.toUpperCase()],
        seniorityFit: item.seniorityFit, locationFit: item.locationFit, implementationFit: item.implementationFit,
      }));
    })(),
    bottom20: results.slice(-20).map((item, index) => ({
      rank: Math.max(1, results.length - 19 + index), candidate: item.candidateName || "Name unavailable", title: item.currentTitle,
      tier: tier(item), score: item.score.finalScore, roleFit: item.primaryRoleFit,
      roleEvidenceKind: item.score.roleEvidenceKind, domainEvidence: item.domainEvidence?.[requestedDomain.toUpperCase()],
      seniorityFit: item.seniorityFit, locationFit: item.locationFit, implementationFit: item.implementationFit,
    })),
    top40ExplicitNonTargetLocation: results.slice(0, 40).flatMap((item, index) => item.locationFit === "conflicting" ? [{
      rank: index + 1, candidate: item.candidateName || "Name unavailable", title: item.currentTitle,
      location: item.location || item.country, coverage: item.score.highValueConstraintCoverageScore,
    }] : []),
    top40JuniorEvidence: results.slice(0, 40).flatMap((item, index) => item.seniorityFit === "mismatch" || (item.totalYearsExperience !== null && item.totalYearsExperience <= 2) ? [{
      rank: index + 1, candidate: item.candidateName || "Name unavailable", title: item.currentTitle,
      years: item.totalYearsExperience, seniorityFit: item.seniorityFit, coverage: item.score.highValueConstraintCoverageScore,
    }] : []),
    targetLocationSeniorBelowTop40: results.flatMap((item, index) =>
      index >= 40 && item.locationFit === "verified" && item.seniorityFit === "verified" ? [{
        rank: index + 1, candidate: item.candidateName || "Name unavailable", title: item.currentTitle,
        roleFit: item.primaryRoleFit, implementationFit: item.implementationFit,
        coverage: item.score.highValueConstraintCoverageScore,
      }] : []).slice(0, 20),
    top20: results.slice(0, 20).map((item) => ({
      candidate: item.candidateName || "Name unavailable",
      canonicalCandidateId: item.canonicalCandidateId,
      tier: tier(item),
      score: item.score.finalScore,
      roleFit: item.primaryRoleFit,
      seniorityFit: item.seniorityFit,
      locationFit: item.locationFit,
      implementationFit: item.implementationFit,
      coverage: item.score.highValueConstraintCoverageScore,
      specializationStrength: item.score.specializationStrength,
      supportedConstraints: `${item.score.supportedHighValueConstraints}/${item.score.requestedHighValueConstraints}`,
      reason: `${item.primaryRoleFit} role fit; ${item.implementationFit}; ${item.seniorityFit} seniority; ${item.locationFit} location`,
    })),
  };
  fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "reports", "search-v2-final-ranking-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
