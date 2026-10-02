import { NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import {
  candidateSearchLifecycleDecision,
  selectCandidateLifecycleCompatible,
} from "@/lib/candidateSearchLifecycle";
import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";

const supabase = createLazySupabaseServiceClient();

export async function GET() {
  try {
    const authorization = await requireRecruiterSearchAuthorization({
      permission: "candidate-detail:read",
      route: "/api/get-matches",
    });
    if (!authorization.allowed)
      return recruiterSearchAuthorizationDenied(authorization);
    const { data, error } = await selectCandidateLifecycleCompatible<any[]>(
      `
        id,
        score,
        reason,
        candidates (
          id,
          name,
          email,
          current_title,
          status,
          extraction_coverage_status,
          profile_confirmation_status
        ),
        jobs (
          id,
          title,
          company
        )
      `,
      (columns) =>
        supabase
          .from("matches")
          .select(columns)
          .order("score", { ascending: false }),
    );

    if (error) {
      console.log(error);

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500, headers: recruiterSearchPrivateNoStoreHeaders },
      );
    }

    const visible = (data || [])
      .filter(
        (match: any) =>
          Boolean(match.candidates) &&
          candidateSearchLifecycleDecision(match.candidates).visible,
      )
      .map((match: any) => ({
        ...match,
        candidates: (({
          status: _status,
          extraction_coverage_status: _coverage,
          profile_confirmation_status: _confirmation,
          ...candidate
        }: any) => candidate)(match.candidates),
      }));
    return NextResponse.json(visible, {
      headers: recruiterSearchPrivateNoStoreHeaders,
    });
  } catch (error: any) {
    console.log(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  }
}
