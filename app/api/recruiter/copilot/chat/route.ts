import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  answerRecruiterCopilotQuestion,
} from "@/lib/recruiterCopilotAnswerEngine";
import {
  buildRecruiterCopilotContext,
} from "@/lib/recruiterCopilotContext";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 500;

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const question =
      typeof body?.question ===
      "string"
        ? body.question.trim()
        : "";

    if (!question) {
      return NextResponse.json(
        {
          error:
            "Question is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      question.length >
      MAX_QUESTION_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            `Question must not exceed ${MAX_QUESTION_LENGTH} characters.`,
        },
        {
          status: 400,
        },
      );
    }

    const saved =
      readPersistedWorkflowState();

    const context =
      buildRecruiterCopilotContext(
        saved?.states || [],
        {
          generatedAt:
            saved?.generatedAt,
          recentActivityLimit: 25,
          priorityCandidateLimit: 20,
        },
      );

    return NextResponse.json(
      answerRecruiterCopilotQuestion(
        question,
        context,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to answer recruiter Copilot question",
      },
      {
        status: 500,
      },
    );
  }
}