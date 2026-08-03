import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildRecruiterCopilotContext,
} from "@/lib/recruiterCopilotContext";
import {
  buildRecruiterCopilotSuggestions,
} from "@/lib/recruiterCopilotSuggestions";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readLimit(
  value: string | null,
) {
  if (!value) return 50;

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return 50;
  }

  return Math.min(parsed, 100);
}

export async function GET(
  request: NextRequest,
) {
  try {
    const saved =
      readPersistedWorkflowState();

    const context =
      buildRecruiterCopilotContext(
        saved?.states || [],
        {
          generatedAt:
            saved?.generatedAt,
          recentActivityLimit: 25,
          priorityCandidateLimit: 100,
        },
      );

    const limit =
      readLimit(
        request.nextUrl.searchParams.get(
          "limit",
        ),
      );

    const includeHealthy =
      request.nextUrl.searchParams.get(
        "includeHealthy",
      ) !== "false";

    return NextResponse.json(
      buildRecruiterCopilotSuggestions(
        context,
        {
          limit,
          includeHealthy,
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build recruiter Copilot suggestions",
      },
      {
        status: 500,
      },
    );
  }
}