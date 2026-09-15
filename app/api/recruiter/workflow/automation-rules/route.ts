import { createRecruiterRuntimeStore } from "@/lib/recruiterRuntimeStore.server";
import { NextRequest, NextResponse } from "next/server";

import type {
  RecruiterWorkflowAutomationPriority,
  RecruiterWorkflowAutomationRuleId,
} from "@/lib/recruiterWorkflowAutomationRules";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({ request });
  if (!authorization.allowed) return authorization.response;
  try {
    const store = createRecruiterRuntimeStore(authorization.scope);
    return NextResponse.json(await store.readWorkflowAutomationRuleConfigs());
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
    const store = createRecruiterRuntimeStore(authorization.scope);
    const body = await request.json();

    const result = await store.saveWorkflowAutomationRuleConfig({
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
    const store = createRecruiterRuntimeStore(authorization.scope);
    return NextResponse.json(
      await store.resetWorkflowAutomationRuleConfigs({
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
