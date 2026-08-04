import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  executeCandidateLifecycleTransition,
} from "@/lib/candidateLifecyclePersistence";
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

    const candidateId = String(
      body.candidateId || "",
    ).trim();

    const toStage = String(
      body.toStage || "",
    ).trim() as CandidatePipelineStage;

    if (!candidateId || !toStage) {
      return NextResponse.json(
        {
          error:
            "candidateId and toStage are required",
        },
        { status: 400 },
      );
    }

    const result =
      executeCandidateLifecycleTransition({
        candidateId,
        toStage,
        expectedStage:
          body.expectedStage,
        note:
          body.note,
        dueAt:
          body.dueAt,
        actorId:
          body.actorId,
        actorName:
          body.actorName,
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
            : "Unable to process lifecycle transition",
      },
      { status: 500 },
    );
  }
}