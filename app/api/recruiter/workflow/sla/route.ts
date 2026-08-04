import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildRecruiterCopilotContext,
} from "@/lib/recruiterCopilotContext";
import {
  buildRecruiterWorkflowSlaReport,
} from "@/lib/recruiterWorkflowSla";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readLimit(
  value: string | null,
) {
  if (!value) return 100;

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return 100;
  }

  return Math.min(parsed, 500);
}

export async function GET(
  request: NextRequest,
) {
  try {
    const saved =
      readPersistedWorkflowState();

    const states =
      saved?.states || [];

    const context =
      buildRecruiterCopilotContext(
        states,
        {
          generatedAt:
            saved?.generatedAt,
          recentActivityLimit: 25,
          priorityCandidateLimit: 100,
        },
      );

    return NextResponse.json(
      buildRecruiterWorkflowSlaReport(
        states,
        context,
        {
          generatedAt:
            saved?.generatedAt,
          candidateLimit:
            readLimit(
              request.nextUrl.searchParams.get(
                "limit",
              ),
            ),
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build workflow SLA report",
      },
      {
        status: 500,
      },
    );
  }
}