import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildMustRepairBeforeSearchReview, parseMustRepairBeforeSearchQuery } from "@/lib/mustRepairBeforeSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

const MUST_REPAIR_FIELDS = `
  id,
  candidate_id,
  name,
  display_name,
  full_name,
  candidate_name,
  raw_exact_display_name,
  raw_candidate_name,
  source_name,
  email,
  phone,
  email_masked,
  phone_masked,
  location,
  current_location,
  country,
  current_country,
  location_country,
  current_title,
  title,
  headline,
  raw_current_title,
  raw_title,
  current_company,
  display_company,
  currentCompany,
  current_employer,
  company,
  employer,
  raw_current_company,
  raw_company,
  primary_module,
  primaryModule,
  module,
  sap_module,
  sap_modules,
  secondary_modules,
  selected_modules,
  skills,
  status,
  import_status,
  record_status,
  validation_status,
  profile_quality_score,
  parser_quality_score,
  quality_score,
  name_review_required,
  raw_text,
  resume_text,
  summary,
  search_text,
  created_at
`;

async function fetchCandidates() {
  const candidates: AnyRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("candidates")
      .select(MUST_REPAIR_FIELDS)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    candidates.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return candidates;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const candidates = await fetchCandidates();
    const review = buildMustRepairBeforeSearchReview(candidates, parseMustRepairBeforeSearchQuery(url.searchParams));
    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Must Repair Before Search failed" }, { status: 500 });
  }
}