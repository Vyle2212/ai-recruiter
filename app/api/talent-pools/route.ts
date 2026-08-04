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

function normalizePoolStatus(value: any) {
  const status = String(value || "active").toLowerCase();
  return ["active", "archived"].includes(status) ? status : "active";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = normalizePoolStatus(url.searchParams.get("status") || "active");
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 300);

    const { data, error } = await supabase
      .from("talent_pools")
      .select("*, talent_pool_candidates(count)")
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, pools: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to load talent pools. Run database/sprint2_talent_pool_shortlist.sql if the tables do not exist.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "SAP Talent Pool").trim();
    const candidateIds = asArray(body.candidateIds || body.candidate_ids);

    const { data: pool, error: poolError } = await supabase
      .from("talent_pools")
      .insert({
        name,
        description: body.description || null,
        source: body.source || "match_results",
        job_id: body.jobId || body.job_id || null,
        status: normalizePoolStatus(body.status),
        metadata: body.metadata || {},
      })
      .select("*")
      .single();

    if (poolError) throw poolError;

    if (candidateIds.length) {
      const rows = candidateIds.map((candidateId, index) => ({
        pool_id: pool.id,
        candidate_id: candidateId,
        rank: index + 1,
        status: "saved",
        metadata: body.candidateMetadata?.[candidateId] || {},
      }));

      const { error: itemError } = await supabase
        .from("talent_pool_candidates")
        .upsert(rows, { onConflict: "pool_id,candidate_id" });

      if (itemError) throw itemError;
    }

    return NextResponse.json({ success: true, pool, count: candidateIds.length });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to create talent pool. Run database/sprint2_talent_pool_shortlist.sql if the tables do not exist.",
      },
      { status: 500 }
    );
  }
}
