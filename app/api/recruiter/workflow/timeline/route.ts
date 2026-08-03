import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildRecruiterWorkflowTimeline,
  type RecruiterWorkflowTimelineEventType,
} from "@/lib/recruiterWorkflowTimeline";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES =
  new Set<RecruiterWorkflowTimelineEventType>([
    "candidate_created",
    "stage_transition",
    "rollback",
    "recruiter_action",
    "system_event",
  ]);

function readLimit(
  value: string | null,
) {
  if (!value) return 200;

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return 200;
  }

  return Math.min(
    parsed,
    1000,
  );
}

function readEventType(
  value: string | null,
) {
  return value &&
    EVENT_TYPES.has(
      value as RecruiterWorkflowTimelineEventType,
    )
    ? value as RecruiterWorkflowTimelineEventType
    : undefined;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const saved =
      readPersistedWorkflowState();

    const params =
      request.nextUrl.searchParams;

    return NextResponse.json(
      buildRecruiterWorkflowTimeline(
        saved?.states || [],
        {
          generatedAt:
            saved?.generatedAt,

          limit:
            readLimit(
              params.get("limit"),
            ),

          candidateId:
            params.get("candidateId") ||
            undefined,

          eventType:
            readEventType(
              params.get("eventType"),
            ),

          from:
            params.get("from") ||
            undefined,

          to:
            params.get("to") ||
            undefined,
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build recruiter workflow timeline",
      },
      {
        status: 500,
      },
    );
  }
}