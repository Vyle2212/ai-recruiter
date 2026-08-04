import {
  NextResponse,
} from "next/server";

import {
  buildRecruiterWorkflowAnalytics,
} from "@/lib/recruiterWorkflowAnalytics";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const saved =
      readPersistedWorkflowState();

    if (!saved) {
      return NextResponse.json(
        buildRecruiterWorkflowAnalytics(
          [],
        ),
      );
    }

    return NextResponse.json(
      buildRecruiterWorkflowAnalytics(
        saved.states,
        {
          generatedAt:
            saved.generatedAt,
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate workflow analytics",
      },
      { status: 500 },
    );
  }
}