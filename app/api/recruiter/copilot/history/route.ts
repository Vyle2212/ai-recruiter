import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  appendRecruiterCopilotExchange,
  clearRecruiterCopilotConversations,
  deleteRecruiterCopilotConversation,
  readRecruiterCopilotConversations,
} from "@/lib/recruiterCopilotConversationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      readRecruiterCopilotConversations(),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load recruiter Copilot history",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const question =
      typeof body?.question === "string"
        ? body.question.trim()
        : "";

    const answer = body?.answer;

    if (!question || !answer) {
      return NextResponse.json(
        {
          error:
            "Question and answer are required.",
        },
        {
          status: 400,
        },
      );
    }

    const result =
      appendRecruiterCopilotExchange({
        conversationId:
          typeof body?.conversationId ===
          "string"
            ? body.conversationId
            : undefined,
        question,
        answer,
      });

    return NextResponse.json(
      result,
      {
        status: 201,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save recruiter Copilot history",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const conversationId =
      request.nextUrl.searchParams.get(
        "conversationId",
      );

    if (!conversationId) {
      return NextResponse.json(
        clearRecruiterCopilotConversations(),
      );
    }

    return NextResponse.json(
      deleteRecruiterCopilotConversation(
        conversationId,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete recruiter Copilot history",
      },
      {
        status: 500,
      },
    );
  }
}