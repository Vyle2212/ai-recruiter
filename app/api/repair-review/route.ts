import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCandidateRepairReview, parseRepairReviewQuery } from "@/lib/candidateRepairReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function loadEnvFile() {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const filePath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(filePath)) return;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

async function fetchCandidates() {
  loadEnvFile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Repair review failed: missing Supabase URL/key.");
  const supabase = createClient(supabaseUrl, supabaseKey);
  const candidates: AnyRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(`Repair review failed: ${error.message}`);
    candidates.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return candidates;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const candidates = await fetchCandidates();
    const review = buildCandidateRepairReview(candidates, parseRepairReviewQuery(url.searchParams));
    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Repair review failed" }, { status: 500 });
  }
}
