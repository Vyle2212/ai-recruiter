import { NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { candidateSearchLifecycleDecision } from "@/lib/candidateSearchLifecycle";

const supabase = createLazySupabaseServiceClient();

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select(`
        id,
        score,
        reason,
        candidates (
          id,
          name,
          email,
          current_title,
          status
        ),
        jobs (
          id,
          title,
          company
        )
      `)
      .order("score", {
        ascending: false,
      });

    if (error) {
      console.log(error);

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      );
    }

    const visible = (data || [])
      .filter((match: any) => Boolean(match.candidates) && candidateSearchLifecycleDecision(match.candidates).visible)
      .map((match: any) => ({
        ...match,
        candidates: (({ status: _status, ...candidate }: any) => candidate)(match.candidates),
      }));
    return NextResponse.json(visible);
  } catch (error: any) {
    console.log(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
