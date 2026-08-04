import {
  NextResponse,
} from "next/server";

import {
  buildRecruiterWorkflowInsights,
} from "@/lib/recruiterWorkflowInsights";
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
        buildRecruiterWorkflowInsights(
          [],
        ),
      );
    }

    return NextResponse.json(
      buildRecruiterWorkflowInsights(
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
            : "Unable to build workflow insights",
      },
      {
        status: 500,
      },
    );
  }
}