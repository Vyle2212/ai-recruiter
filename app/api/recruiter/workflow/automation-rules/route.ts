import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  readWorkflowAutomationRuleConfigs,
  resetWorkflowAutomationRuleConfigs,
  saveWorkflowAutomationRuleConfig,
} from "@/lib/recruiterWorkflowAutomationRuleConfig";
import type {
  RecruiterWorkflowAutomationPriority,
  RecruiterWorkflowAutomationRuleId,
} from "@/lib/recruiterWorkflowAutomationRules";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      readWorkflowAutomationRuleConfigs(),
    );
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

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const result =
      saveWorkflowAutomationRuleConfig({
        ruleId:
          String(
            body?.ruleId ||
              "",
          ) as RecruiterWorkflowAutomationRuleId,

        enabled:
          typeof body?.enabled ===
          "boolean"
            ? body.enabled
            : undefined,

        priority:
          typeof body?.priority ===
          "string"
            ? body.priority as RecruiterWorkflowAutomationPriority
            : undefined,

        settings:
          body?.settings &&
          typeof body.settings ===
            "object"
            ? body.settings
            : undefined,

        updatedBy:
          typeof body?.updatedBy ===
          "string"
            ? body.updatedBy
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
            : "Unable to save workflow automation rule",
      },
      {
        status: 400,
      },
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const updatedBy =
      request.nextUrl.searchParams.get(
        "updatedBy",
      );

    return NextResponse.json(
      resetWorkflowAutomationRuleConfigs({
        updatedBy,
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