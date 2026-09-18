import { NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";

const supabase = createLazySupabaseServiceClient();

export async function GET() {
  try {
    const authorization = await requireRecruiterSearchAuthorization({ permission: "search:read", route: "/api/get-candidates" });
    if (!authorization.allowed) return recruiterSearchAuthorizationDenied(authorization);
    const { data, error } = await supabase
      .from("candidates")
      .select("id,name,current_title,current_company,location,primary_module,years,profile_quality_score,updated_at")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500, headers: recruiterSearchPrivateNoStoreHeaders }
      );
    }

    return NextResponse.json(data || [], { headers: recruiterSearchPrivateNoStoreHeaders });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500, headers: recruiterSearchPrivateNoStoreHeaders }
    );
  }
}
