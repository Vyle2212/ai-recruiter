import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildCandidateSearchIndexRow } from "@/lib/candidateSearchIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function safeMessage(error: any) {
  return error?.message || error?.details || error?.hint || String(error || "Unknown error");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit || 500), 1), 5000);
    const batchSize = Math.min(Math.max(Number(body.batchSize || 50), 1), 100);
    const offset = Math.max(Number(body.offset || 0), 0);

    if (body.truncate === true || body.truncate === "true") {
      const { error: truncateError } = await supabase.rpc("truncate_candidate_search_index");
      if (truncateError) {
        await supabase.from("candidate_search_index").delete().neq("candidate_id", "__never__");
      }
    }

    const { data: candidates, error } = await supabase
      .from("candidates").select("*").order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ success: false, error: safeMessage(error) }, { status: 500 });

    let indexed = 0;
    let attempted = 0;
    const failed: any[] = [];

    for (const batch of chunk(candidates || [], batchSize)) {
      const rows: any[] = [];
      for (const candidate of batch) {
        attempted += 1;
        try {
          const row = buildCandidateSearchIndexRow(candidate);
          if (row) rows.push(row);
        } catch (e: any) {
          failed.push({ stage: "build_row", candidate_id: candidate?.id || null, error: safeMessage(e) });
        }
      }

      if (!rows.length) continue;

      const { error: upsertError } = await supabase.from("candidate_search_index").upsert(rows, { onConflict: "candidate_id" });
      if (upsertError) {
        for (const row of rows) {
          const { error: rowError } = await supabase.from("candidate_search_index").upsert(row, { onConflict: "candidate_id" });
          if (rowError) failed.push({ stage: "upsert_row", candidate_id: row?.candidate_id || null, error: safeMessage(rowError) });
          else indexed += 1;
        }
      } else {
        indexed += rows.length;
      }
    }

    return NextResponse.json({ success: true, offset, limit, batchSize, fetched: candidates?.length || 0, attempted, indexed, skipped: attempted - indexed - failed.length, failed_count: failed.length, failed: failed.slice(0, 20), nextOffset: offset + (candidates?.length || 0), hasMore: (candidates?.length || 0) === limit });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: safeMessage(error) }, { status: 500 });
  }
}
