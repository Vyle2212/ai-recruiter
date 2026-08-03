import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  previewCandidateLifecycleTransition,
} from "@/lib/candidateLifecycleEngine";
import {
  hydrateCandidate360Workflow,
} from "@/lib/recruiterWorkflowStateHydration";
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

    const workflow =
      hydrateCandidate360Workflow(
        candidateId,
      );

    if (!workflow) {
      return NextResponse.json(
        {
          error:
            "Candidate workflow state not found",
        },
        { status: 404 },
      );
    }

    const decision =
      previewCandidateLifecycleTransition({
        lifecycle: workflow.lifecycle,
        toStage,
        note: body.note,
        dueAt: body.dueAt,
        actorId: body.actorId,
        actorName: body.actorName,
      });

    return NextResponse.json({
      mode:
        "lifecycle transition preview only; no workflow or candidate DB writes",
      candidateId,
      decision,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview lifecycle transition",
      },
      { status: 500 },
    );
  }
}