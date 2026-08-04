import {
  createHash,
} from "node:crypto";

import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionFile,
} from "./recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationProposal,
} from "./recruiterWorkflowAutomationRules";
import type {
  WorkflowExecutionPlanItem,
  WorkflowExecutionPlanReport,
} from "./recruiterWorkflowExecutionPlan";
import type {
  WorkflowExecutionReadinessItem,
  WorkflowExecutionReadinessReport,
} from "./recruiterWorkflowExecutionReadiness";

export type WorkflowExecutionAuditPreviewItem = {
  auditPreviewId: string;

  proposalId: string;
  candidateId: string;
  candidateName: string | null;

  ruleId: string;
  proposedAction: string;

  decision: {
    status: "approved";
    reviewerId: string | null;
    reviewerName: string | null;
    reason: string;
    approvedAt: string;
    executionStatus: "not_executed";
  };

  readiness: {
    status: "READY";
    reason: string;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    evaluatedAt: string;
  };

  plan: {
    executionPlanId: string;
    totalSteps: number;
    plannedSteps: number;
    disabledSteps: number;
    executionEnabled: false;
  };

  canonicalPayload: {
    version: 1;
    proposal: {
      proposalId: string;
      candidateId: string;
      candidateName: string;
      ruleId: string;
      proposedAction: string;
      currentStage: string;
      priority: string;
    };
    decision: {
      status: "approved";
      reviewerId: string | null;
      reviewerName: string | null;
      reason: string;
      approvedAt: string;
    };
    readiness: {
      status: "READY";
      reason: string;
      expectedStage: string | null;
      currentStage: string | null;
      checkResults: Array<{
        checkId: string;
        status: string;
        evidence: string | number | boolean | null;
      }>;
    };
    plan: {
      executionPlanId: string;
      steps: Array<{
        sequence: number;
        stepId: string;
        status: string;
        dependsOn: string[];
        executionEnabled: false;
        wouldExecute: false;
      }>;
    };
  };

  checksum: {
    algorithm: "sha256";
    value: string;
  };

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;
    automaticExecution: false;
    previewOnly: true;
  };

  href: string | null;
};

export type WorkflowExecutionAuditPreviewReport = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    approvedDecisions: number;
    readyItems: number;
    executionPlans: number;
    auditPreviews: number;
    unmatchedItems: number;
    auditWrites: 0;
  };

  previews: WorkflowExecutionAuditPreviewItem[];

  unmatched: Array<{
    proposalId: string;
    candidateId: string;
    reason: string;
  }>;

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    automaticActions: 0;
    executionEnabled: false;
    previewOnly: true;
  };

  mode: string;
};

export type WorkflowExecutionAuditPreviewOptions = {
  generatedAt?: string;
  evaluatedAt?: string;
  limit?: number;
};

function stableSerialize(
  value: unknown,
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(stableSerialize)
      .join(",")}]`;
  }

  const object =
    value as Record<string, unknown>;

  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableSerialize(
          object[key],
        )}`,
    )
    .join(",")}}`;
}

function sha256(
  value: unknown,
) {
  return createHash("sha256")
    .update(
      stableSerialize(value),
      "utf8",
    )
    .digest("hex");
}

function proposalMap(
  preview: RecruiterWorkflowAutomationPreview,
) {
  return new Map(
    preview.proposals.map(
      (proposal) => [
        proposal.proposalId,
        proposal,
      ],
    ),
  );
}

function decisionMap(
  file: WorkflowAutomationDecisionFile,
) {
  return new Map(
    file.decisions
      .filter(
        (decision) =>
          decision.decision ===
          "approved",
      )
      .map(
        (decision) => [
          decision.proposalId,
          decision,
        ],
      ),
  );
}

function readinessMap(
  report: WorkflowExecutionReadinessReport,
) {
  return new Map(
    report.items
      .filter(
        (item) =>
          item.status === "READY",
      )
      .map(
        (item) => [
          item.proposalId,
          item,
        ],
      ),
  );
}

function planMap(
  report: WorkflowExecutionPlanReport,
) {
  return new Map(
    report.plans.map(
      (plan) => [
        plan.proposalId,
        plan,
      ],
    ),
  );
}

function buildCanonicalPayload(
  proposal:
    RecruiterWorkflowAutomationProposal,
  decision:
    WorkflowAutomationDecision,
  readiness:
    WorkflowExecutionReadinessItem,
  plan:
    WorkflowExecutionPlanItem,
): WorkflowExecutionAuditPreviewItem["canonicalPayload"] {
  return {
    version: 1,

    proposal: {
      proposalId:
        proposal.proposalId,

      candidateId:
        proposal.candidateId,

      candidateName:
        proposal.candidateName,

      ruleId:
        proposal.ruleId,

      proposedAction:
        proposal.proposedAction,

      currentStage:
        proposal.currentStage,

      priority:
        proposal.priority,
    },

    decision: {
      status:
        "approved",

      reviewerId:
        decision.reviewerId,

      reviewerName:
        decision.reviewerName,

      reason:
        decision.reason,

      approvedAt:
        decision.updatedAt,
    },

    readiness: {
      status:
        "READY",

      reason:
        readiness.reason,

      expectedStage:
        readiness.expectedStage,

      currentStage:
        readiness.currentStage,

      checkResults:
        readiness.checks.map(
          (check) => ({
            checkId:
              check.checkId,

            status:
              check.status,

            evidence:
              check.evidence,
          }),
        ),
    },

    plan: {
      executionPlanId:
        plan.executionPlanId,

      steps:
        plan.steps.map(
          (step) => ({
            sequence:
              step.sequence,

            stepId:
              step.stepId,

            status:
              step.status,

            dependsOn:
              [...step.dependsOn],

            executionEnabled:
              false,

            wouldExecute:
              false,
          }),
        ),
    },
  };
}

function buildAuditPreview(
  proposal:
    RecruiterWorkflowAutomationProposal,
  decision:
    WorkflowAutomationDecision,
  readiness:
    WorkflowExecutionReadinessItem,
  plan:
    WorkflowExecutionPlanItem,
  evaluatedAt: string,
): WorkflowExecutionAuditPreviewItem {
  const canonicalPayload =
    buildCanonicalPayload(
      proposal,
      decision,
      readiness,
      plan,
    );

  return {
    auditPreviewId:
      `workflow-execution-audit-preview:${proposal.proposalId}`,

    proposalId:
      proposal.proposalId,

    candidateId:
      proposal.candidateId,

    candidateName:
      proposal.candidateName,

    ruleId:
      proposal.ruleId,

    proposedAction:
      proposal.proposedAction,

    decision: {
      status:
        "approved",

      reviewerId:
        decision.reviewerId,

      reviewerName:
        decision.reviewerName,

      reason:
        decision.reason,

      approvedAt:
        decision.updatedAt,

      executionStatus:
        "not_executed",
    },

    readiness: {
      status:
        "READY",

      reason:
        readiness.reason,

      passedChecks:
        readiness.summary.passed,

      failedChecks:
        readiness.summary.failed,

      warningChecks:
        readiness.summary.warnings,

      evaluatedAt,
    },

    plan: {
      executionPlanId:
        plan.executionPlanId,

      totalSteps:
        plan.summary.totalSteps,

      plannedSteps:
        plan.summary.planned,

      disabledSteps:
        plan.summary.disabled,

      executionEnabled:
        false,
    },

    canonicalPayload,

    checksum: {
      algorithm:
        "sha256",

      value:
        sha256(
          canonicalPayload,
        ),
    },

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,
      automaticExecution: false,
      previewOnly: true,
    },

    href:
      plan.href ||
      proposal.href ||
      null,
  };
}

export function buildWorkflowExecutionAuditPreviewReport(
  automationPreview:
    RecruiterWorkflowAutomationPreview,
  decisionFile:
    WorkflowAutomationDecisionFile,
  readinessReport:
    WorkflowExecutionReadinessReport,
  planReport:
    WorkflowExecutionPlanReport,
  options:
    WorkflowExecutionAuditPreviewOptions = {},
): WorkflowExecutionAuditPreviewReport {
  const proposals =
    proposalMap(
      automationPreview,
    );

  const decisions =
    decisionMap(
      decisionFile,
    );

  const readiness =
    readinessMap(
      readinessReport,
    );

  const plans =
    planMap(
      planReport,
    );

  const evaluatedAt =
    options.evaluatedAt ||
    readinessReport.evaluatedAt ||
    new Date().toISOString();

  const unmatched:
    WorkflowExecutionAuditPreviewReport["unmatched"] = [];

  const previews:
    WorkflowExecutionAuditPreviewItem[] = [];

  for (
    const [
      proposalId,
      decision,
    ] of decisions
  ) {
    const proposal =
      proposals.get(
        proposalId,
      );

    const readyItem =
      readiness.get(
        proposalId,
      );

    const plan =
      plans.get(
        proposalId,
      );

    if (
      !proposal ||
      !readyItem ||
      !plan
    ) {
      unmatched.push({
        proposalId,

        candidateId:
          decision.candidateId,

        reason:
          !proposal
            ? "Current automation proposal not found."
            : !readyItem
              ? "Execution readiness is not READY."
              : "Execution plan not found.",
      });

      continue;
    }

    const identityMatches =
      proposal.candidateId ===
        decision.candidateId &&
      proposal.ruleId ===
        decision.ruleId &&
      proposal.proposedAction ===
        decision.proposedAction;

    if (!identityMatches) {
      unmatched.push({
        proposalId,

        candidateId:
          decision.candidateId,

        reason:
          "Proposal identity does not match the approved decision.",
      });

      continue;
    }

    previews.push(
      buildAuditPreview(
        proposal,
        decision,
        readyItem,
        plan,
        evaluatedAt,
      ),
    );
  }

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 200,
        500,
      ),
    );

  const visible =
    previews
      .sort(
        (left, right) =>
          Date.parse(
            right.decision.approvedAt,
          ) -
          Date.parse(
            left.decision.approvedAt,
          ),
      )
      .slice(
        0,
        limit,
      );

  return {
    generatedAt:
      options.generatedAt ||
      new Date().toISOString(),

    evaluatedAt,

    summary: {
      approvedDecisions:
        decisions.size,

      readyItems:
        readiness.size,

      executionPlans:
        plans.size,

      auditPreviews:
        visible.length,

      unmatchedItems:
        unmatched.length,

      auditWrites:
        0,
    },

    previews:
      visible,

    unmatched,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,
      executionEnabled: false,
      previewOnly: true,
    },

    mode:
      "preview-only workflow execution audit snapshots with deterministic SHA-256 checksums; no audit writes; no candidate DB writes; no workflow writes; no email sends; no automatic execution",
  };
}