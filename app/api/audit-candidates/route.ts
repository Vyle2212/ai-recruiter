import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function qualityBadge(score: number) {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  return "Review";
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select(
        "id,name,current_title,title,email,phone,primary_module,role_type,years,contact_missing,name_review_required,profile_quality_score,extraction_notes,created_at"
      )
      .or(
        "contact_missing.eq.true,name_review_required.eq.true,profile_quality_score.lt.70"
      )
      .order("profile_quality_score", { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((candidate: any) => {
      const issues: string[] = [];

      if (candidate.contact_missing) issues.push("Missing contact");
      if (candidate.name_review_required) issues.push("Name needs review");
      if ((candidate.profile_quality_score || 0) < 70) {
        issues.push("Low profile quality");
      }
      if (!candidate.current_title && !candidate.title) {
        issues.push("Missing title");
      }

      return {
        ...candidate,
        quality_badge: qualityBadge(candidate.profile_quality_score || 0),
        issues,
      };
    });

    const stats = {
      totalNeedsReview: rows.length,
      missingContact: rows.filter((r: any) => r.contact_missing).length,
      nameReview: rows.filter((r: any) => r.name_review_required).length,
      lowQuality: rows.filter(
        (r: any) => (r.profile_quality_score || 0) < 70
      ).length,
    };

    return NextResponse.json({
      success: true,
      stats,
      candidates: rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Audit failed" },
      { status: 500 }
    );
  }
}
