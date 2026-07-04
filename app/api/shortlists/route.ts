import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function asArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

function normalizeMode(value: any) {
  const mode = String(value || "recruiter").toLowerCase();
  return ["client", "recruiter", "internal"].includes(mode) ? mode : "recruiter";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId") || url.searchParams.get("job_id");
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 300);
    const includeCandidates = ["1", "true", "yes"].includes(
      String(url.searchParams.get("includeCandidates") || url.searchParams.get("include_candidates") || "").toLowerCase(),
    );

    let query = supabase
      .from("shortlists")
      .select(
        includeCandidates
          ? "*, shortlist_candidates(candidate_id,status,stage,rank,metadata,created_at,updated_at)"
          : "*, shortlist_candidates(count)",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, shortlists: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to load shortlists. Run database/sprint2_talent_pool_shortlist.sql if the tables do not exist.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const candidateIds = asArray(body.candidateIds || body.candidate_ids);

    const { data: shortlist, error: shortlistError } = await supabase
      .from("shortlists")
      .insert({
        job_id: body.jobId || body.job_id || null,
        name: body.name || "SAP Job Shortlist",
        mode: normalizeMode(body.mode),
        stage: body.stage || "draft",
        status: body.status || "active",
        metadata: body.metadata || {},
      })
      .select("*")
      .single();

    if (shortlistError) throw shortlistError;

    if (candidateIds.length) {
      const rows = candidateIds.map((candidateId, index) => ({
        shortlist_id: shortlist.id,
        candidate_id: candidateId,
        rank: index + 1,
        stage: body.stage || "shortlisted",
        status: "active",
        metadata: body.candidateMetadata?.[candidateId] || {},
      }));

      const { error: itemError } = await supabase
        .from("shortlist_candidates")
        .upsert(rows, { onConflict: "shortlist_id,candidate_id" });

      if (itemError) throw itemError;
    }

    return NextResponse.json({ success: true, shortlist, count: candidateIds.length });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to create shortlist. Run database/sprint2_talent_pool_shortlist.sql if the tables do not exist.",
      },
      { status: 500 }
    );
  }
}
