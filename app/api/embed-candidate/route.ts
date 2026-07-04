import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createEmbedding } from "@/lib/embedding";
import { upsertCandidateSearchIndex } from "@/lib/candidateSearchIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function arr(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return value.split(/[,\n;|]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function buildEmbeddingText(candidate: any) {
  return [
    candidate.name,
    candidate.title,
    candidate.current_title,
    candidate.headline,
    candidate.summary,
    candidate.primary_module,
    arr(candidate.secondary_modules).join(" "),
    arr(candidate.sap_modules).join(" "),
    arr(candidate.sap_submodules).join(" "),
    arr(candidate.skills).join(" "),
    candidate.role_type,
    candidate.consulting_level,
    candidate.company,
    candidate.current_company,
    candidate.location,
    candidate.current_location,
    candidate.raw_text,
    candidate.resume_text,
    candidate.experience,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateId } = body;

    if (!candidateId) {
      return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });
    }

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (error || !candidate) {
      return NextResponse.json({ error: error?.message || "Candidate not found" }, { status: 404 });
    }

    // Keep search index fresh before embedding.
    await upsertCandidateSearchIndex(candidate);

    const text = buildEmbeddingText(candidate);
    const embedding = await createEmbedding(text);

    // Keep old behavior: save embedding on candidates.
    await supabase
      .from("candidates")
      .update({ embedding })
      .eq("id", candidateId);

    // New behavior: also save embedding on candidate_search_index for fast vector search.
    await supabase
      .from("candidate_search_index")
      .update({ embedding, updated_at: new Date().toISOString() })
      .eq("candidate_id", candidateId);

    return NextResponse.json({
      success: true,
      candidateId,
      indexed: true,
      embedded: true,
    });
  } catch (error: any) {
    console.error("Embedding failed:", error);
    return NextResponse.json(
      { error: error?.message || "Embedding failed" },
      { status: 500 }
    );
  }
}
