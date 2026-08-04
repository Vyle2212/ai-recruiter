import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildRecruiterCopilotContext,
} from "@/lib/recruiterCopilotContext";
import {
  readWorkflowAutomationDecisions,
} from "@/lib/recruiterWorkflowAutomationDecisions";
import {
  buildRecruiterWorkflowAutomationPreview,
} from "@/lib/recruiterWorkflowAutomationRules";
import {
  readWorkflowAutomationRuleConfigs,
} from "@/lib/recruiterWorkflowAutomationRuleConfig";
import {
  buildWorkflowExecutionPlanReport,
} from "@/lib/recruiterWorkflowExecutionPlan";
import {
  buildWorkflowExecutionReadinessReport,
} from "@/lib/recruiterWorkflowExecutionReadiness";
import {
  buildRecruiterWorkflowSlaReport,
} from "@/lib/recruiterWorkflowSla";
import {
  readPersistedWorkflowState,
} from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readLimit(
  value: string | null,
) {
  if (!value) {
    return 200;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return 200;
  }

  return Math.min(
    parsed,
    500,
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const saved =
      readPersistedWorkflowState();

    const states =
      saved?.states || [];

    const context =
      buildRecruiterCopilotContext(
        states,
        {
          generatedAt:
            saved?.generatedAt,

          recentActivityLimit:
            25,

          priorityCandidateLimit:
            100,
        },
      );

    const slaReport =
      buildRecruiterWorkflowSlaReport(
        states,
        context,
        {
          generatedAt:
            saved?.generatedAt,

          candidateLimit:
            500,
        },
      );

    const automationPreview =
      buildRecruiterWorkflowAutomationPreview(
        states,
        context,
        slaReport,
        {
  ruleConfigs: readWorkflowAutomationRuleConfigs(),
          generatedAt:
            saved?.generatedAt,

          limit:
            500,
        },
      );

    const decisions =
      readWorkflowAutomationDecisions();

    const readiness =
      buildWorkflowExecutionReadinessReport(
        states,
        automationPreview,
        decisions,
        {
          generatedAt:
            saved?.generatedAt,

          evaluatedAt:
            new Date().toISOString(),

          limit:
            500,

          executedProposalIds:
            [],
        },
      );

    return NextResponse.json(
      buildWorkflowExecutionPlanReport(
        readiness,
        {
          generatedAt:
            saved?.generatedAt,

          evaluatedAt:
            readiness.evaluatedAt,

          limit:
            readLimit(
              request.nextUrl.searchParams.get(
                "limit",
              ),
            ),
        },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build workflow execution plan",
      },
      {
        status: 500,
      },
    );
  }
}