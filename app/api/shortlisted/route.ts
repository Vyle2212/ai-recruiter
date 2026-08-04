import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { candidate_id, job_id } = body;

    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
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
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.log(err);

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}