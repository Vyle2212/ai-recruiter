import { NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";

export async function GET() {
  const authorization = await requireRecruiterSearchAuthorization({ permission: "search:read", route: "/api/dashboard" });
  if (!authorization.allowed) return recruiterSearchAuthorizationDenied(authorization);
  const supabase = createLazySupabaseServiceClient();
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
  }, { headers: recruiterSearchPrivateNoStoreHeaders });
}
