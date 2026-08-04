import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { classifyCandidateSearchVisibility, getCandidateValidationQueueIssues, type ValidationQueueIssueKey } from "@/lib/candidateSearchVisibility";
import { safeTalentSearchCompany } from "@/lib/talentSearchDisplay";
import { paginateValidationQueueItems, parseValidationQueuePagination } from "@/lib/validationQueuePagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

const GROUP_ORDER: ValidationQueueIssueKey[] = [
  "invalid-name",
  "missing-contact",
  "missing-sap-module",
  "missing-location",
  "invalid-title",
  "invalid-company",
  "low-quality",
  "invalid-years",
  "identity-review",
];

const GROUP_LABELS: Record<ValidationQueueIssueKey, string> = {
  "invalid-name": "Invalid name",
  "missing-contact": "Missing contact",
  "missing-sap-module": "Missing SAP module",
  "missing-location": "Missing location",
  "invalid-title": "Invalid title",
  "invalid-company": "Invalid company",
  "low-quality": "Low quality",
  "invalid-years": "Invalid years",
  "identity-review": "Identity review",
};


const QUEUE_CANDIDATE_FIELDS = `
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
  skills,
  current_company,
  company,
  status,
  profile_quality_score,
  name_review_required,
  title_review_required,
  created_at
`;

async function fetchValidationQueueCandidates() {
  const candidates: AnyRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("candidates")
      .select(QUEUE_CANDIDATE_FIELDS)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    candidates.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return candidates;
}
function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function list(value: any): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map(clean).filter(Boolean);
  }
  return [];
}

function rawDisplayName(candidate: AnyRecord) {
  return clean(candidate.name || candidate.display_name || candidate.full_name || candidate.candidate_name || "Candidate profile pending validation");
}

function rawTitle(candidate: AnyRecord) {
  return clean(candidate.current_title || candidate.title || candidate.headline || "Role not disclosed");
}

function rawCompany(candidate: AnyRecord) {
  const raw = clean(candidate.current_company || candidate.display_company || candidate.currentCompany || candidate.company || candidate.employer);
  return safeTalentSearchCompany(raw);
}

function primaryModule(candidate: AnyRecord) {
  return clean(candidate.primary_module || candidate.primaryModule || list(candidate.sap_modules)[0] || list(candidate.secondary_modules)[0] || "UNKNOWN");
}

function location(candidate: AnyRecord) {
  return clean(candidate.country || candidate.current_country || candidate.location_country || candidate.current_location || candidate.location || "Not disclosed");
}

function contactSummary(candidate: AnyRecord) {
  const hasEmail = Boolean(clean(candidate.email));
  const hasPhone = Boolean(clean(candidate.phone));
  if (hasEmail && hasPhone) return "Email and phone";
  if (hasEmail) return "Email only";
  if (hasPhone) return "Phone only";
  return "No contact";
}

function queueItem(candidate: AnyRecord, visibility: ReturnType<typeof classifyCandidateSearchVisibility>) {
  const issues = getCandidateValidationQueueIssues(candidate);
  const primaryIssue = issues[0]?.key || "identity-review";
  return {
    id: clean(candidate.id || candidate.candidate_id),
    displayName: rawDisplayName(candidate),
    title: rawTitle(candidate),
    company: rawCompany(candidate) || "Not disclosed",
    module: primaryModule(candidate),
    location: location(candidate),
    contact: contactSummary(candidate),
    profileQualityScore: Number(candidate.profile_quality_score || candidate.parser_quality_score || candidate.quality_score || 0) || 0,
    validationStatus: clean(candidate.validation_status || candidate.status || "Needs Review"),
    blockedFromRecruiterSearch: visibility.blocked_from_recruiter_search,
    validationQueueReason: visibility.validation_queue_reason,
    primaryIssue,
    issues,
    profileHref: `/candidates/${encodeURIComponent(clean(candidate.id || candidate.candidate_id))}?returnTo=${encodeURIComponent("/validation-queue")}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const requestedGroup = clean(url.searchParams.get("group") || "all") as ValidationQueueIssueKey | "all";
    const search = clean(url.searchParams.get("q") || "").toLowerCase();
    const { page, pageSize } = parseValidationQueuePagination(url.searchParams);

    const candidates = await fetchValidationQueueCandidates();
    const allBlocked = candidates
      .map((candidate: AnyRecord) => ({ candidate, visibility: classifyCandidateSearchVisibility(candidate) }))
      .filter((entry) => entry.visibility.blocked_from_recruiter_search)
      .map((entry) => queueItem(entry.candidate, entry.visibility));
    let blocked = allBlocked;

    if (requestedGroup !== "all") blocked = blocked.filter((item) => item.issues.some((candidateIssue) => candidateIssue.key === requestedGroup));
    if (search) {
      blocked = blocked.filter((item) => [item.displayName, item.title, item.company, item.module, item.location, item.validationQueueReason].join(" ").toLowerCase().includes(search));
    }

    const groups = GROUP_ORDER.map((key) => ({
      key,
      label: GROUP_LABELS[key],
      count: allBlocked.filter((item) => item.issues.some((candidateIssue) => candidateIssue.key === key)).length,
    }));

    const { paginatedItems, totalPages } = paginateValidationQueueItems(blocked, page, pageSize);

    return NextResponse.json({
      items: paginatedItems,
      totalBlocked: allBlocked.length,
      totalMatched: blocked.length,
      filteredCount: blocked.length,
      returnedCount: paginatedItems.length,
      currentPage: page,
      pageSize,
      totalPages,
      groups,
      activeGroup: requestedGroup,
      source: { table: "candidates", rawCandidateCount: candidates.length, sourcePath: "Supabase candidates lightweight validation queue read" },
      mode: "read-only",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validation Queue failed" }, { status: 500 });
  }
}