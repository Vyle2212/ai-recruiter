import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { count: totalCandidates } = await supabase
    .from("candidates")
    .select("*", { count: "exact", head: true });

  const { count: totalFavorites } = await supabase
    .from("saved_candidates")
    .select("*", { count: "exact", head: true })
    .eq("is_favorite", true);

  const { count: totalShortlisted } = await supabase
    .from("saved_candidates")
    .select("*", { count: "exact", head: true })
    .eq("is_shortlisted", true);

  return NextResponse.json({
    totalCandidates: totalCandidates || 0,
    totalFavorites: totalFavorites || 0,
    totalShortlisted: totalShortlisted || 0,
  });
}