import { NextRequest, NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { recruiterSearchAuthorizationDenied, recruiterSearchPrivateNoStoreHeaders, requireRecruiterSearchAuthorization } from "@/lib/recruiterSearchAuthorization";

const supabase = createLazySupabaseServiceClient();

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireRecruiterSearchAuthorization({ permission: "candidate-detail:read", route: "/api/shortlisted" });
    if (!authorization.allowed) return recruiterSearchAuthorizationDenied(authorization);
    const body = await req.json();

    const { candidate_id, job_id } = body;

    const { data: candidate } = await supabase
      .from("candidates")
      .select("id,name,email,raw_text")
      .eq("id", candidate_id)
      .single();

    const { data, error } = await supabase
      .from("shortlisted")
      .insert({
        candidate_id,
        job_id,
        name: candidate?.name || "",
        email: candidate?.email || "",
        summary: candidate?.raw_text?.slice(0, 300) || "",
      })
      .select();

    if (error) {
      console.log(error);

      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: recruiterSearchPrivateNoStoreHeaders }
      );
    }

    return NextResponse.json(data, { headers: recruiterSearchPrivateNoStoreHeaders });
  } catch (err: any) {
    console.log(err);

    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: recruiterSearchPrivateNoStoreHeaders }
    );
  }
}
