import { NextRequest, NextResponse } from "next/server";

import {
  buildRecruiterWorkflowActivityFeed,
} from "@/lib/recruiterWorkflowActivity";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInteger(
  value: string | null,
) {
  if (!value) return undefined;

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return undefined;
  }

  return parsed;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const saved =
      readPersistedWorkflowState();

    if (!saved) {
      return NextResponse.json({
        generatedAt:
          new Date().toISOString(),
        total: 0,
        activities: [],
        mode:
          "read-only normalized workflow activity; persisted workflow state not found; no candidate DB writes",
      });
    }

    const candidateId =
      request.nextUrl.searchParams.get(
        "candidateId",
      ) || undefined;

    const limit =
      positiveInteger(
        request.nextUrl.searchParams.get(
          "limit",
        ),
      );

    return NextResponse.json(
      buildRecruiterWorkflowActivityFeed(
        saved.states,
        {
          generatedAt:
            saved.generatedAt,
          candidateId,
          limit,
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load workflow activity",
      },
      { status: 500 },
    );
  }
}