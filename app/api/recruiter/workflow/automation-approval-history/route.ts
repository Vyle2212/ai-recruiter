import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  appendWorkflowAutomationApprovalHistory,
  readWorkflowAutomationApprovalHistory,
} from "@/lib/recruiterWorkflowAutomationApprovalHistory";
import type {
  RecruiterWorkflowAutomationAction,
  RecruiterWorkflowAutomationRuleId,
} from "@/lib/recruiterWorkflowAutomationRules";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const file =
      readWorkflowAutomationApprovalHistory();

    const proposalId =
      request.nextUrl.searchParams.get(
        "proposalId",
      );

    if (!proposalId) {
      return NextResponse.json(
        file,
      );
    }

    const events =
      file.events.filter(
        (event) =>
          event.proposalId ===
          proposalId,
      );

    return NextResponse.json({
      ...file,

      events,

      summary: {
        total:
          events.length,

        approved:
          events.filter(
            (event) =>
              event.decision ===
              "approved",
          ).length,

        rejected:
          events.filter(
            (event) =>
              event.decision ===
              "rejected",
          ).length,

        deferred:
          events.filter(
            (event) =>
              event.decision ===
              "deferred",
          ).length,

        proposalsAffected:
          events.length
            ? 1
            : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load approval history",
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

    const result =
      appendWorkflowAutomationApprovalHistory({
        proposalId:
          String(
            body?.proposalId ||
              "",
          ),

        candidateId:
          String(
            body?.candidateId ||
              "",
          ),

        candidateName:
          String(
            body?.candidateName ||
              "",
          ),

        ruleId:
          String(
            body?.ruleId ||
              "",
          ) as RecruiterWorkflowAutomationRuleId,

        proposedAction:
          String(
            body?.proposedAction ||
              "",
          ) as RecruiterWorkflowAutomationAction,

        previousDecision:
          body?.previousDecision ||
          null,

        decision:
          body?.decision,

        reason:
          String(
            body?.reason ||
              "",
          ),

        reviewerId:
          typeof body?.reviewerId ===
          "string"
            ? body.reviewerId
            : null,

        reviewerName:
          typeof body?.reviewerName ===
          "string"
            ? body.reviewerName
            : null,
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to append approval history",
      },
      {
        status: 400,
      },
    );
  }
}