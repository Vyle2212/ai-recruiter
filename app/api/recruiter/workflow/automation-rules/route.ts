import { NextRequest, NextResponse } from "next/server";

import {
  readWorkflowAutomationRuleConfigs,
  resetWorkflowAutomationRuleConfigs,
  saveWorkflowAutomationRuleConfig,
} from "@/lib/recruiterWorkflowAutomationRuleConfig";
import type {
  RecruiterWorkflowAutomationPriority,
  RecruiterWorkflowAutomationRuleId,
} from "@/lib/recruiterWorkflowAutomationRules";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readWorkflowAutomationRuleConfigs());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read workflow automation rules",
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
    policyId: "workflow-automation-rules-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    const body = await request.json();

    const result = saveWorkflowAutomationRuleConfig({
      ruleId: String(body?.ruleId || "") as RecruiterWorkflowAutomationRuleId,

      enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,

      priority:
        typeof body?.priority === "string"
          ? (body.priority as RecruiterWorkflowAutomationPriority)
          : undefined,

      settings:
        body?.settings && typeof body.settings === "object"
          ? body.settings
          : undefined,

      updatedBy: authorization.scope.profileId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save workflow automation rule",
      },
      {
        status: 400,
      },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
    policyId: "workflow-automation-rules-write",
  });
  if (!authorization.allowed) return authorization.response;
  try {
    return NextResponse.json(
      resetWorkflowAutomationRuleConfigs({
        updatedBy: authorization.scope.profileId,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset workflow automation rules",
      },
      {
        status: 500,
      },
    );
  }
}
