import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionFile,
} from "./recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationProposal,
} from "./recruiterWorkflowAutomationRules";

export type WorkflowExecutionPreviewStepId =
  | "validate_proposal"
  | "validate_current_state"
  | "create_activity"
  | "append_timeline"
  | "create_notification"
  | "move_stage"
  | "update_candidate"
  | "send_email";

export type WorkflowExecutionPreviewStepStatus =
  | "planned"
  | "disabled"
  | "blocked";

export type WorkflowExecutionPreviewStep = {
  stepId: WorkflowExecutionPreviewStepId;
  title: string;
  description: string;

  status: WorkflowExecutionPreviewStepStatus;

  wouldExecute: false;

  candidateDbWrites: number;
  workflowWrites: number;
  emailSends: number;

  reason: string;
};

export type WorkflowExecutionPreviewItem = {
  executionPreviewId: string;

  proposalId: string;
  candidateId: string;
  candidateName: string;

  ruleId: string;
  proposedAction: string;
  currentStage: string;

  decision: "approved";
  executionStatus: "not_executed";

  approvedAt: string;
  reviewerName: string | null;

  title: string;
  description: string;

  steps: WorkflowExecutionPreviewStep[];

  summary: {
    totalSteps: number;
    planned: number;
    disabled: number;
    blocked: number;

    executableNow: false;

    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
  };

  href: string;
};

export type WorkflowExecutionPreviewFeed = {
  generatedAt: string;

  summary: {
    approvedDecisions: number;
    matchedProposals: number;
    executionPreviews: number;
    unmatchedApprovals: number;
    executableNow: 0;
  };

  previews: WorkflowExecutionPreviewItem[];

  unmatchedApprovals: Array<{
    proposalId: string;
    candidateId: string;
    ruleId: string;
    reason: string;
  }>;

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    automaticActions: 0;
    executionEnabled: false;
    previewOnly: true;
    requiresHumanApproval: true;
  };

  mode: string;
};

export type WorkflowExecutionPreviewOptions = {
  generatedAt?: string;
  limit?: number;
};

function plannedStep(
  stepId: WorkflowExecutionPreviewStepId,
  title: string,
  description: string,
  reason: string,
): WorkflowExecutionPreviewStep {
  return {
    stepId,
    title,
    description,
    status: "planned",
    wouldExecute: false,
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    reason,
  };
}

function disabledStep(
  stepId: WorkflowExecutionPreviewStepId,
  title: string,
  description: string,
  reason: string,
): WorkflowExecutionPreviewStep {
  return {
    stepId,
    title,
    description,
    status: "disabled",
    wouldExecute: false,
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    reason,
  };
}

function proposedActionLabel(
  value: string,
) {
  return value.replace(/_/g, " ");
}

function buildSteps(
  proposal: RecruiterWorkflowAutomationProposal,
): WorkflowExecutionPreviewStep[] {
  return [
    plannedStep(
      "validate_proposal",
      "Validate approved proposal",
      "Confirm that the approved decision still references the same proposal, candidate, rule, and proposed action.",
      "Validation is represented in preview only.",
    ),

    plannedStep(
      "validate_current_state",
      "Validate current lifecycle state",
      `Confirm that the candidate remains in ${proposedActionLabel(
        proposal.currentStage,
      )} before any future execution.`,
      "Lifecycle state is not modified.",
    ),

    plannedStep(
      "create_activity",
      "Prepare workflow activity",
      `Prepare an activity entry for ${proposedActionLabel(
        proposal.proposedAction,
      )}.`,
      "Activity creation remains disabled outside preview.",
    ),

    plannedStep(
      "append_timeline",
      "Prepare timeline event",
      "Prepare a lifecycle timeline event describing the approved automation proposal.",
      "Timeline persistence remains disabled.",
    ),

    plannedStep(
      "create_notification",
      "Prepare recruiter notification",
      "Prepare an internal notification showing that the proposal was approved.",
      "Notification persistence remains disabled.",
    ),

    disabledStep(
      "move_stage",
      "Stage transition",
      "Move the candidate to a different lifecycle stage when the proposed action requires it.",
      "Stage transitions are disabled in execution preview.",
    ),

    disabledStep(
      "update_candidate",
      "Candidate record update",
      "Update candidate workflow or profile fields related to the approved action.",
      "Candidate database writes are disabled.",
    ),

    disabledStep(
      "send_email",
      "Email delivery",
      "Send a candidate or client follow-up email.",
      "Email sending is disabled.",
    ),
  ];
}

function buildPreview(
  proposal: RecruiterWorkflowAutomationProposal,
  decision: WorkflowAutomationDecision,
): WorkflowExecutionPreviewItem {
  const steps =
    buildSteps(proposal);

  return {
    executionPreviewId:
      `workflow-execution-preview:${proposal.proposalId}`,

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

    decision:
      "approved",

    executionStatus:
      "not_executed",

    approvedAt:
      decision.updatedAt,

    reviewerName:
      decision.reviewerName,

    title:
      `Execution preview for ${proposal.candidateName}`,

    description:
      `Approved proposal: ${proposedActionLabel(
        proposal.proposedAction,
      )}. This preview shows the planned sequence without executing any action.`,

    steps,

    summary: {
      totalSteps:
        steps.length,

      planned:
        steps.filter(
          (step) =>
            step.status === "planned",
        ).length,

      disabled:
        steps.filter(
          (step) =>
            step.status === "disabled",
        ).length,

      blocked:
        steps.filter(
          (step) =>
            step.status === "blocked",
        ).length,

      executableNow:
        false,

      candidateDbWrites:
        0,

      workflowWrites:
        0,

      emailSends:
        0,
    },

    href:
      `/recruiter/candidate360/${encodeURIComponent(
        proposal.candidateId,
      )}`,
  };
}

export function buildWorkflowExecutionPreview(
  automationPreview: RecruiterWorkflowAutomationPreview,
  decisionFile: WorkflowAutomationDecisionFile,
  options: WorkflowExecutionPreviewOptions = {},
): WorkflowExecutionPreviewFeed {
  const approvedDecisions =
    decisionFile.decisions.filter(
      (decision) =>
        decision.decision === "approved",
    );

  const proposalsById =
    new Map(
      automationPreview.proposals.map(
        (proposal) => [
          proposal.proposalId,
          proposal,
        ],
      ),
    );

  const previews:
    WorkflowExecutionPreviewItem[] = [];

  const unmatchedApprovals:
    WorkflowExecutionPreviewFeed["unmatchedApprovals"] = [];

  for (
    const decision of approvedDecisions
  ) {
    const proposal =
      proposalsById.get(
        decision.proposalId,
      );

    if (!proposal) {
      unmatchedApprovals.push({
        proposalId:
          decision.proposalId,

        candidateId:
          decision.candidateId,

        ruleId:
          decision.ruleId,

        reason:
          "The approved proposal is no longer present in the current automation preview.",
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
      unmatchedApprovals.push({
        proposalId:
          decision.proposalId,

        candidateId:
          decision.candidateId,

        ruleId:
          decision.ruleId,

        reason:
          "The approved decision no longer matches the current proposal identity.",
      });

      continue;
    }

    previews.push(
      buildPreview(
        proposal,
        decision,
      ),
    );
  }

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 100,
        500,
      ),
    );

  const visible =
    previews
      .sort(
        (left, right) =>
          Date.parse(
            right.approvedAt,
          ) -
          Date.parse(
            left.approvedAt,
          ),
      )
      .slice(0, limit);

  return {
    generatedAt:
      options.generatedAt ||
      new Date().toISOString(),

    summary: {
      approvedDecisions:
        approvedDecisions.length,

      matchedProposals:
        previews.length,

      executionPreviews:
        visible.length,

      unmatchedApprovals:
        unmatchedApprovals.length,

      executableNow:
        0,
    },

    previews:
      visible,

    unmatchedApprovals,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,
      executionEnabled: false,
      previewOnly: true,
      requiresHumanApproval: true,
    },

    mode:
      "preview-only workflow execution planning for approved automation decisions; no stage transitions; no candidate DB writes; no workflow writes; no email sends; no automatic execution",
  };
}