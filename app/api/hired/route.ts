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

    const { data, error } = await supabase
      .from("hired")
      .insert({
        candidate_id,
        job_id,
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