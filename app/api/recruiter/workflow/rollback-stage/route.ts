import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  rollbackCandidateLifecycleTransition,
} from "@/lib/candidateLifecycleRollback";
import type {
  CandidatePipelineStage,
} from "@/lib/candidateLifecycleTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const candidateId =
      String(
        body.candidateId || "",
      ).trim();

    if (!candidateId) {
      return NextResponse.json(
        {
          error:
            "candidateId is required",
        },
        { status: 400 },
      );
    }

    const result =
      rollbackCandidateLifecycleTransition({
        candidateId,
        expectedStage:
          body.expectedStage as
            | CandidatePipelineStage
            | undefined,
        actorId:
          body.actorId,
        actorName:
          body.actorName,
        note:
          body.note,
        execute:
          body.execute === true,
      });

    return NextResponse.json(
      result,
      {
        status:
          result.status,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to rollback lifecycle stage",
      },
      { status: 500 },
    );
  }
}