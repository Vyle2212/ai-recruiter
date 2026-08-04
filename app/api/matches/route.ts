import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateRecruiterMatch } from "@/lib/recruiterMatchEngine";
import { getFinalClientReady } from "@/lib/matchDisplayUtils";
import { modulesForKeyword } from "@/lib/candidateSearchIndex";
import { derivePrimarySapModule, primarySapModuleCanSatisfySearch } from "@/lib/sapCanonicalModuleEngine";
import { normalizeSapModule, textOf, type SapPrimaryModule } from "@/lib/sapRecruiterRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchRow = {
  job_id: string;
  candidate_id: string;
  score: number;
  strengths: string[];
  gaps: string[];
  details: any;
};

const CANDIDATE_MATCH_FIELDS = `
  id,
  name,
  email,
  phone,
  location,
  current_location,
  current_title,
  title,
  headline,
  years,
  years_experience,
  primary_module,
  secondary_modules,
  sap_modules,
  sap_submodules,
  skills,
  role_type,
  consulting_level,
  current_company,
  company,
  expected_salary,
  status,
  profile_quality_score,
  implementation_project_count,
  rollout_project_count,
  ams_support_project_count,
  migration_project_count,
  total_project_count,
  s4hana_project_count,
  s4_implementation_count,
  s4_support_count,
  s4_greenfield_count,
  s4_conversion_count,
  module_authority_score,
  module_authority,
  implementation_authority,
  domain_authority,
  consulting_dna,
  confidence,
  name_review_required,
  title_review_required,
  years_review_required,
  raw_text,
  resume_text,
  raw_cv,
  updated_at
`;

function safeNumber(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function jobRequiredModule(job: any): SapPrimaryModule {
  return normalizeSapModule(
    job?.primary_module ||
      job?.required_primary_module ||
      job?.module ||
      job?.sap_module ||
      job?.title ||
      job?.job_title ||
      ""
  );
}

function jobRequiredYears(job: any) {
  return safeNumber(job?.required_years || job?.years || job?.min_years, 7);
}

function isBadDisplayName(name: any) {
  const n = String(name || "").trim().toUpperCase();
  return (
    !n ||
    [
      "REVIEW REQUIRED",
      "CANDIDATE NAME NOT DETECTED",
      "PERSONAL DETAIL",
      "WORK HISTORY",
      "CURRICULUM VITAE",
      "JOB TITLE",
      "NO TITLE",
    ].some((bad) => n === bad || n.includes(bad))
  );
}

function normalizeForDedupe(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(sap|consultant|senior|sr|functional|technical|certified|profile|resume|cv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(candidate: any, details: any) {
  const email = String(candidate?.email || details?.email || "").toLowerCase().trim();
  if (email && email.includes("@")) return `email:${email}`;

  const phoneDigits = String(candidate?.phone || details?.phone || "").replace(/\D/g, "");
  if (phoneDigits.length >= 7) return `phone:${phoneDigits.slice(-9)}`;

  const name = normalizeForDedupe(details?.name || candidate?.name);
  const title = normalizeForDedupe(details?.title || candidate?.current_title || candidate?.title);
  const years = Number(details?.years || candidate?.years || 0);

  if (name && !name.includes("unknown") && name.split(" ").length >= 2) {
    return `name:${name}|years:${years || "x"}|title:${title.slice(0, 30)}`;
  }

  if (title && years) return `title:${title.slice(0, 50)}|years:${years}`;
  return `id:${candidate.id}`;
}

function normalizeDisplayTitle(value: any) {
  return String(value || "")
    .replace(/^[-–—•\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^(TITLE|POSITION|DESIGNATION|CURRENT POSITION|CURRENT TITLE|ROLE|JOB TITLE)\s*[:\-]\s*/i, "")
    .trim()
    .slice(0, 90);
}

function cleanDetails(candidate: any, result: any) {
  const d = result.details || {};
  const details = {
    ...d,
    name:
      d.name && !isBadDisplayName(d.name)
        ? d.name
        : candidate?.name && !isBadDisplayName(candidate.name)
          ? candidate.name
          : "Review Required",
    title: normalizeDisplayTitle(d.title || candidate.current_title || candidate.title || candidate.headline || ""),
    email: candidate.email || d.email || null,
    phone: candidate.phone || d.phone || null,
    location: candidate.location || candidate.current_location || d.location || "",
    years: d.years || candidate.years || candidate.years_experience || 0,
    primaryModule: d.primaryModule || candidate.primary_module || candidate.primaryModule || "N/A",
    secondaryModules: d.secondaryModules || candidate.secondary_modules || candidate.sap_modules || [],
    implementationProjects: d.implementationProjects ?? candidate.implementation_project_count ?? 0,
    rolloutProjects: d.rolloutProjects ?? candidate.rollout_project_count ?? 0,
    amsProjects: d.amsProjects ?? candidate.ams_support_project_count ?? 0,
    s4hanaProjects: d.s4hanaProjects ?? candidate.s4hana_project_count ?? candidate.s4_implementation_count ?? 0,
    eccProjects: d.eccProjects ?? candidate.ecc_projects ?? 0,
    searchFit: candidate.search_fit || 0,
    score: result.score,
  };

  const finalReady = getFinalClientReady({ score: result.score, gaps: result.gaps, details });

  return {
    ...details,
    clientReady: finalReady,
    isClientReady: finalReady,
    client_ready: finalReady,
    finalClientReady: finalReady,
    passesClientGate: finalReady,
    strongMatch: finalReady,
    isStrongMatch: finalReady,
    status: finalReady ? "Client Ready" : "Recruiter Review",
    recommendation: finalReady ? "Client Ready" : "Recruiter Review",
    displayStatus: finalReady ? "Client Ready" : "Recruiter Review",
  };
}

function flattenStoredMatch(row: any) {
  const details = row?.details || {};
  const score = safeNumber(row?.score ?? details?.score ?? details?.clientScore);
  const finalClientReady = getFinalClientReady({ score, gaps: row?.gaps, details });

  return {
    ...details,
    ...row,
    ...details,
    id: details.id || row.candidate_id || row.id,
    candidate_id: row.candidate_id || details.candidate_id || details.id,
    job_id: row.job_id || details.job_id,
    score,
    matchScore: score,
    finalScore: score,
    calibratedScore: score,
    strengths: row.strengths || details.strengths || [],
    gaps: row.gaps || details.gaps || [],
    clientReady: finalClientReady,
    isClientReady: finalClientReady,
    client_ready: finalClientReady,
    // V29: Strong Match is the same as final Client Ready.
    // Never resurrect stale details.strongMatch from older scoring versions.
    strongMatch: finalClientReady,
    isStrongMatch: finalClientReady,
    finalClientReady,
    passesClientGate: finalClientReady,
    status: finalClientReady ? "Client Ready" : "Recruiter Review",
    displayStatus: finalClientReady ? "Client Ready" : "Recruiter Review",
    recommendation: finalClientReady ? "Client Ready" : "Recruiter Review",
  };
}

function explicitModulesForJob(requiredModule: SapPrimaryModule) {
  if (requiredModule === "UNKNOWN") return null;
  return Array.from(new Set(modulesForKeyword(requiredModule))).filter(Boolean);
}

async function searchIndexManual(args: {
  keyword: string;
  modules: string[] | null;
  clientMode: boolean;
  requiredYears: number;
  minQuality: number;
  limit: number;
}) {
  const { keyword, modules, clientMode, requiredYears, minQuality, limit } = args;

  let query = supabase
    .from("candidate_search_index")
    .select("candidate_id, primary_module, all_modules, all_submodules, years, contactable, quality_score, search_text, updated_at")
    .limit(Math.max(limit * 5, 100));

  if (requiredYears > 0) query = query.gte("years", requiredYears);
  if (clientMode) query = query.eq("contactable", true);
  if (minQuality > 0) query = query.gte("quality_score", minQuality);

  if (modules?.length && keyword === "BTP") query = query.in("primary_module", modules);
  else if (keyword) query = query.ilike("search_text", `%${String(keyword).replace(/[%_]/g, "")}%`);
  else if (modules?.length) query = query.in("primary_module", modules);

  const { data, error } = await query;
  if (error) throw error;

  return (data || [])
    .map((row: any) => ({
      candidate_id: row.candidate_id,
      search_fit:
        (String(row.primary_module || "").toUpperCase() === keyword.toUpperCase() ? 60 : 0) +
        (String(row.search_text || "").toLowerCase().includes(keyword.toLowerCase()) ? 35 : 0) +
        (row.contactable ? 10 : 0) +
        Math.min(Math.max(Number(row.quality_score || 0), 0), 100) / 10 +
        Math.min(Number(row.years || 0), 20) / 2,
    }))
    .sort((a: any, b: any) => Number(b.search_fit || 0) - Number(a.search_fit || 0))
    .slice(0, limit);
}

async function fetchCandidatePool(job: any, clientMode: boolean) {
  const requiredModule = jobRequiredModule(job);
  const requiredYears = jobRequiredYears(job);
  const titleText = textOf(job?.title, job?.job_title, job?.description, job?.requirements);
  const keyword = requiredModule === "UNKNOWN" ? titleText : requiredModule;
  const explicitModules = explicitModulesForJob(requiredModule);
  const limit = clientMode ? 250 : 500;
  const minQuality = clientMode ? 75 : 55;
  // V34: do not filter BTP by index years. Candidate index may have years=0 while candidate table/CV has valid years.
  const indexMinYears = requiredModule === "BTP" ? 0 : requiredYears || 0;

  let rpcName = "search_candidate_index_v2";
  let { data: indexRows, error: indexError } = await supabase.rpc(rpcName, {
    p_keyword: keyword || null,
    p_modules: explicitModules,
    p_country: null,
    p_city: null,
    p_min_years: indexMinYears,
    p_contactable_only: clientMode,
    p_min_quality: minQuality,
    p_limit: limit,
  });

  if (indexError) {
    rpcName = "search_candidate_index";
    const fallback = await supabase.rpc(rpcName, {
      p_keyword: keyword || null,
      p_modules: explicitModules,
      p_country: null,
      p_city: null,
      p_min_years: indexMinYears,
      p_contactable_only: clientMode,
      p_min_quality: minQuality,
      p_limit: limit,
    });
    indexRows = fallback.data;
    indexError = fallback.error;
  }

  if (indexError) throw indexError;

  if (!Array.isArray(indexRows) || indexRows.length === 0) {
    indexRows = await searchIndexManual({
      keyword,
      modules: explicitModules,
      clientMode,
      requiredYears: indexMinYears,
      minQuality,
      limit,
    });
    rpcName = `${rpcName}+manual_index_fallback`;
  }

  const ids = (indexRows || []).map((r: any) => r.candidate_id).filter(Boolean);

  if (!ids.length) {
    return { candidates: [], debug: { requiredModule, keyword, explicitModules, indexRows: 0, source: rpcName } };
  }

  const { data: candidates, error } = await supabase
    .from("candidates")
    .select(CANDIDATE_MATCH_FIELDS)
    .in("id", ids);

  if (error) throw error;

  const fitById = new Map((indexRows || []).map((r: any) => [r.candidate_id, Number(r.search_fit || 0)]));
  const orderById = new Map(ids.map((id: string, idx: number) => [id, idx]));

  return {
    candidates: (candidates || [])
      .filter((candidate: any) => {
        if (!explicitModules?.length || requiredModule === "UNKNOWN") return true;
        const primary = derivePrimarySapModule(candidate, {});
        return explicitModules.every((moduleKey) => primarySapModuleCanSatisfySearch(primary, moduleKey, candidate, {}));
      })
      .sort((a: any, b: any) => Number(orderById.get(a.id) ?? 999999) - Number(orderById.get(b.id) ?? 999999))
      .map((candidate: any) => ({ ...candidate, search_fit: fitById.get(candidate.id) || 0 })),
    debug: { requiredModule, keyword, explicitModules, indexRows: ids.length, source: rpcName },
  };
}

function normalizeBtpTokenLocal(value: any) {
  return String(value || "")
    .toUpperCase()
    .replace(/^SAP\s+/i, "")
    .replace(/^SAP-/i, "")
    .replace(/^SAP_/i, "")
    .replace(/&/g, "AND")
    .replace(/[\s/_-]/g, "")
    .replace(/\./g, "");
}

function classifyBtpAdjacentTierLocal(input: {
  primary: string;
  title: string;
  text: string;
  moduleAuthority: number;
  implementationAuthority: number;
  roleDepth: number;
  consultingDNA: number;
  quality: number;
  hasContact: boolean;
}) {
  const directTitle = ["sap btp", "business technology platform", "btp consultant", "btp architect", "btp developer", "btp solution architect"].some((t) => input.title.includes(t));
  const direct = input.primary === "BTP" || directTitle;

  const functionalPrimary = ["FICO", "FI", "CO", "MM", "SD", "PP", "PM", "QM", "WM", "EWM", "TM", "PS", "ISU", "ARIBA", "SUCCESSFACTORS", "HCM"].includes(input.primary);
  const technicalPrimary = ["ABAP", "BASIS", "BW", "BW4HANA", "PI", "PO", "PIPO"].includes(input.primary);

  const platformStrong = [
    "integration suite",
    "sap integration suite",
    "cloud integration",
    "sap cpi",
    " cpi",
    "datasphere",
    "dwc",
    "sap analytics cloud",
    "analytics cloud",
    "event mesh",
    "build process automation",
    "build apps",
  ].some((t) => input.text.includes(t) || input.title.includes(t));

  const platformMedium = [
    "fiori",
    "sapui5",
    "ui5",
    "sap cap",
    "cloud application programming",
    " cap ",
    " rap ",
    "restful abap",
    "pi/po",
    "pi po",
    "extension suite",
  ].some((t) => input.text.includes(t) || input.title.includes(t));

  if (direct) {
    return {
      tier: "DIRECT_BTP",
      label: "Direct BTP",
      cap: 96,
      reason: "Direct BTP primary/title evidence",
      clientReadyEligible: true,
    };
  }

  if (platformStrong && !functionalPrimary) {
    return {
      tier: technicalPrimary ? "TECHNICAL_PLATFORM_ADJACENT" : "STRONG_PLATFORM_ADJACENT",
      label: technicalPrimary ? "Technical BTP-adjacent" : "Strong BTP platform-adjacent",
      cap: technicalPrimary ? 82 : 85,
      reason: technicalPrimary ? "Technical adjacent profile with BTP platform evidence" : "Strong BTP platform ecosystem evidence",
      clientReadyEligible: false,
    };
  }

  if (platformStrong && functionalPrimary) {
    return {
      tier: "FUNCTIONAL_PLATFORM_ADJACENT",
      label: "Functional BTP-adjacent",
      cap: 72,
      reason: "Functional primary module with BTP platform keywords; recruiter validation required",
      clientReadyEligible: false,
    };
  }

  if (platformMedium && technicalPrimary) {
    return {
      tier: "TECHNICAL_WEAK_ADJACENT",
      label: "Technical weak BTP-adjacent",
      cap: 74,
      reason: "Technical adjacent profile with weak BTP/Fiori/CAP/RAP evidence",
      clientReadyEligible: false,
    };
  }

  if (platformMedium && functionalPrimary) {
    return {
      tier: "FUNCTIONAL_WEAK_ADJACENT",
      label: "Functional weak BTP-adjacent",
      cap: 70,
      reason: "Functional primary module with weak BTP/Fiori/CAP/RAP evidence",
      clientReadyEligible: false,
    };
  }

  return {
    tier: "NO_TRUSTED_BTP_EVIDENCE",
    label: "No trusted BTP evidence",
    cap: 50,
    reason: "No direct or trusted BTP ecosystem evidence",
    clientReadyEligible: false,
  };
}

function enforceBtpRouteCap(job: any, candidate: any, result: any, details: any) {
  const requiredModule = jobRequiredModule(job);
  if (requiredModule !== "BTP") return { result, details };

  const primary = normalizeBtpTokenLocal(details?.primaryModule || candidate?.primary_module || "");
  const title = String(details?.title || candidate?.current_title || candidate?.title || candidate?.headline || "").toLowerCase();
  const text = textOf(
    details?.secondaryModules,
    candidate?.secondary_modules,
    candidate?.sap_modules,
    candidate?.sap_submodules,
    candidate?.skills,
    candidate?.raw_text,
    candidate?.resume_text,
    candidate?.raw_cv
  ).toLowerCase();

  const implementationAuthority = safeNumber(details?.implementationAuthority, 0);
  const roleDepth = safeNumber(details?.roleComplexity ?? details?.financeDepth, 0);
  const consultingDNA = safeNumber(details?.consultingDNA, 0);
  const quality = safeNumber(details?.profileQualityScore, 0);
  const moduleAuthority = safeNumber(details?.primaryModuleAuthority ?? details?.moduleAuthority, 0);
  const hasContact = Boolean(details?.email || details?.phone || candidate?.email || candidate?.phone);

  const tier = classifyBtpAdjacentTierLocal({
    primary,
    title,
    text,
    moduleAuthority,
    implementationAuthority,
    roleDepth,
    consultingDNA,
    quality,
    hasContact,
  });

  const rawScore = Number(result?.score || 0);
  const score = Math.min(rawScore, tier.cap);

  // V37: Ready Pool auto-pass for direct BTP only.
  // Adjacent profiles may rank high enough for review, but cannot become client-ready without recruiter validation.
  const directAutoReady = Boolean(
    tier.clientReadyEligible &&
      score >= 90 &&
      implementationAuthority >= 80 &&
      roleDepth >= 75 &&
      moduleAuthority >= 80 &&
      quality >= 75 &&
      hasContact &&
      !details?.nameReviewRequired &&
      !details?.contactMissing
  );

  const cappedDetails = {
    ...details,
    score,
    clientReady: directAutoReady,
    isClientReady: directAutoReady,
    client_ready: directAutoReady,
    finalClientReady: directAutoReady,
    passesClientGate: directAutoReady,
    clientGatePass: directAutoReady,
    strongMatch: directAutoReady,
    isStrongMatch: directAutoReady,
    status: directAutoReady ? "Client Ready" : "Recruiter Review",
    recommendation: directAutoReady ? "Client Ready" : "Recruiter Review",
    displayStatus: directAutoReady ? "Client Ready" : "Recruiter Review",
    btpAdjacentTier: tier.tier,
    btpAdjacentLabel: tier.label,
    btpRouteCap: tier.cap,
    btpRouteCapReason: tier.reason,
    btpReadyPoolAutoPass: directAutoReady,
    aiConfidenceV2Inputs: {
      moduleAuthority,
      implementationAuthority,
      roleDepth,
      consultingDNA,
      quality,
      hasContact,
      btpAdjacentTier: tier.tier,
    },
    matchAlgorithmVersion: "V37-btp-adjacent-framework-ready-auto-pass",
  };

  return {
    result: {
      ...result,
      score,
      label: directAutoReady ? "Strong match" : score >= 70 ? "Recruiter review" : "Potential match",
    },
    details: cappedDetails,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId || body.job_id;

    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const minScore = Number(body.minScore ?? 50);
    const includeWeak = Boolean(body.includeWeak ?? false);
    const clientMode = Boolean(body.clientMode ?? false);

    const { data: job, error: jobError } = await supabase.from("jobs").select("*").eq("id", jobId).single();
    if (jobError || !job) return NextResponse.json({ error: jobError?.message || "Job not found" }, { status: 404 });

    const pool = await fetchCandidatePool(job, clientMode);

    await supabase.from("matches").delete().eq("job_id", jobId);

    const seen = new Set<string>();
    const rows: MatchRow[] = [];

    console.time(`MATCH_INDEX_FIRST_${jobId}`);

    for (const candidate of pool.candidates) {
      const rawResult = calculateRecruiterMatch(job, candidate);
      const rawDetails = cleanDetails(candidate, rawResult);
      const capped = enforceBtpRouteCap(job, candidate, rawResult, rawDetails);
      const result = capped.result;
      const details = capped.details;

      if (isBadDisplayName(details.name)) continue;
      if ((details.profileQualityScore || 0) < 55) continue;

      const displayTitle = String(details.title || "").trim();
      if (!displayTitle || displayTitle.toLowerCase() === "no title") continue;

      // V34: Client Mode should still return Under Review profiles.
      // Client-ready status is stamped in details/flattening; do not skip non-client-ready here.
      // Otherwise roles with no fully-ready candidates show Matches Found = 0 even when review pool exists.
      if (!includeWeak && result.score < minScore) continue;

      const key = dedupeKey(candidate, details);
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({ job_id: jobId, candidate_id: candidate.id, score: result.score, strengths: result.strengths || [], gaps: result.gaps || [], details });
    }

    console.timeEnd(`MATCH_INDEX_FIRST_${jobId}`);

    rows.sort((a, b) => b.score - a.score);

    if (!rows.length) {
      return NextResponse.json({ success: true, mode: clientMode ? "client" : "internal", count: 0, job, matches: [], results: [], data: [], debug: pool.debug });
    }

    const { data, error: insertError } = await supabase.from("matches").insert(rows).select("*");
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const flattenedMatches = (data?.length ? data : rows).map(flattenStoredMatch);

    return NextResponse.json({ success: true, mode: clientMode ? "Client" : "Internal", count: flattenedMatches.length, job, matches: flattenedMatches, results: flattenedMatches, data: flattenedMatches, debug: pool.debug });
  } catch (error: any) {
    console.error("Generate matches error:", error);
    return NextResponse.json({ error: error?.message || "Generate matches failed" }, { status: 500 });
  }
}
