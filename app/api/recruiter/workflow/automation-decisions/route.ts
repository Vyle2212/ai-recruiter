import { createRecruiterRuntimeStore } from "@/lib/recruiterRuntimeStore.server";
import { NextRequest, NextResponse } from "next/server";

import { type WorkflowAutomationDecisionStatus } from "@/lib/recruiterWorkflowAutomationDecisions";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set<WorkflowAutomationDecisionStatus>([
  "approved",
  "rejected",
  "deferred",
]);

export async function GET(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({ request });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    return NextResponse.json(await store.readWorkflowAutomationDecisions());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read automation decisions",
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
    policyId: "workflow-automation-decisions-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    const body = await request.json();

    const decision = String(
      body?.decision || "",
    ) as WorkflowAutomationDecisionStatus;

    if (!VALID_DECISIONS.has(decision)) {
      return NextResponse.json(
        {
          error: "Decision must be approved, rejected, or deferred.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await store.saveWorkflowAutomationDecision({
      proposalId: String(body?.proposalId || ""),

      candidateId: String(body?.candidateId || ""),

      ruleId: String(body?.ruleId || ""),

      proposedAction: String(body?.proposedAction || ""),

      decision,

      reason: typeof body?.reason === "string" ? body.reason : "",

      reviewerId: authorization.scope.profileId,

      reviewerName: null,
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
            : "Unable to save automation decision",
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
    policyId: "workflow-automation-decisions-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    const proposalId = request.nextUrl.searchParams.get("proposalId");

    if (!proposalId) {
      return NextResponse.json(
        {
          error: "Proposal ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json(await store.deleteWorkflowAutomationDecision(proposalId));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete automation decision",
      },
      {
        status: 500,
      },
    );
  }
}
