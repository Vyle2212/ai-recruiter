import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      candidate_id,
      job_id,
      score,
      reason,
    } = body;

    const { data, error } =
      await supabase
        .from("matches")
        .upsert(
          [
            {
              candidate_id,
              job_id,
              score,
              reason,
            },
          ],
          {
            onConflict:
              "candidate_id,job_id",
          }
        )
        .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}