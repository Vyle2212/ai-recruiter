import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { candidateSearchLifecycleDecision } from "@/lib/candidateSearchLifecycle";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { candidate_id, job_id, score, reason } = body;

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select(
        "id,status,extraction_coverage_status,profile_confirmation_status",
      )
      .eq("id", candidate_id)
      .single();

    if (
      candidateError ||
      !candidate ||
      !candidateSearchLifecycleDecision(candidate).visible
    ) {
      return NextResponse.json(
        { error: "Candidate is not eligible for matching." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
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
          onConflict: "candidate_id,job_id",
        },
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
