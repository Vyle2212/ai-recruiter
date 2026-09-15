import { isRecruiterCopilotHistoryAnswer } from "@/lib/recruiterCopilotHistoryInput";
import { createRecruiterRuntimeStore } from "@/lib/recruiterRuntimeStore.server";
import { NextRequest, NextResponse } from "next/server";

import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({ request });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    return NextResponse.json(await store.readRecruiterCopilotConversations());
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

export async function POST(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "copilot-history-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    const body = await request.json();

    const question =
      typeof body?.question === "string" ? body.question.trim() : "";

    const answer = body?.answer;

    if (!question || !isRecruiterCopilotHistoryAnswer(answer)) {
      return NextResponse.json(
        {
          error: "A question and a valid Copilot answer are required.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await store.appendRecruiterCopilotExchange({
      conversationId:
        typeof body?.conversationId === "string"
          ? body.conversationId
          : undefined,
      question,
      answer,
    });

    return NextResponse.json(result, {
      status: 201,
    });
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

export async function DELETE(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "copilot-history-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    const conversationId = request.nextUrl.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(await store.clearRecruiterCopilotConversations());
    }

    return NextResponse.json(
      await store.deleteRecruiterCopilotConversation(conversationId),
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
