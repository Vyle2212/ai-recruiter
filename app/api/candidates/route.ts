import { NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";

export async function GET() {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "search:read",
    route: "/api/candidates",
  });
  if (!authorization.allowed) return recruiterSearchAuthorizationDenied(authorization);
  const supabase = createLazySupabaseServiceClient();

  const { data, error } = await supabase
    .from("candidates")
    // The list endpoint has no valid need for raw CV, contact, or notes fields.
    .select("id,name,current_title,current_company,location,primary_module,years,profile_quality_score,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: recruiterSearchPrivateNoStoreHeaders }
    );
  }

  return NextResponse.json(data || [], { headers: recruiterSearchPrivateNoStoreHeaders });
}
