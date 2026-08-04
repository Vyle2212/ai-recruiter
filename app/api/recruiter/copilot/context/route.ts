import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildRecruiterCopilotContext,
} from "@/lib/recruiterCopilotContext";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readLimit(
  value: string | null,
  fallback: number,
) {
  if (!value) return fallback;

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

export async function GET(
  request: NextRequest,
) {
  try {
    const saved =
      readPersistedWorkflowState();

    const recentActivityLimit =
      readLimit(
        request.nextUrl.searchParams.get(
          "activityLimit",
        ),
        25,
      );

    const priorityCandidateLimit =
      readLimit(
        request.nextUrl.searchParams.get(
          "priorityLimit",
        ),
        20,
      );

    return NextResponse.json(
      buildRecruiterCopilotContext(
        saved?.states || [],
        {
          generatedAt:
            saved?.generatedAt,
          recentActivityLimit,
          priorityCandidateLimit,
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build recruiter Copilot context",
      },
      {
        status: 500,
      },
    );
  }
}