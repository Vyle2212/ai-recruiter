import type {
  WorkflowExecutionReadinessItem,
  WorkflowExecutionReadinessReport,
} from "./recruiterWorkflowExecutionReadiness";

export type WorkflowExecutionPlanStepId =
  | "revalidate_readiness"
  | "lock_execution_scope"
  | "prepare_activity"
  | "prepare_timeline"
  | "prepare_notification"
  | "prepare_audit"
  | "stage_transition"
  | "candidate_update"
  | "email_delivery";

export type WorkflowExecutionPlanStepStatus =
  | "planned"
  | "disabled"
  | "blocked";

export type WorkflowExecutionPlanStep = {
  stepId: WorkflowExecutionPlanStepId;
  sequence: number;

  title: string;
  description: string;

  status: WorkflowExecutionPlanStepStatus;

  dependsOn: WorkflowExecutionPlanStepId[];

  executionEnabled: false;
  wouldExecute: false;

  candidateDbWrites: 0;
  workflowWrites: 0;
  emailSends: 0;

  reason: string;
};

export type WorkflowExecutionPlanItem = {
  executionPlanId: string;

  proposalId: string;
  candidateId: string;
  candidateName: string | null;

  ruleId: string;
  proposedAction: string;

  expectedStage: string | null;
  currentStage: string | null;

  readinessStatus: "READY";

  approvedAt: string | null;

  title: string;
  description: string;

  steps: WorkflowExecutionPlanStep[];

  summary: {
    totalSteps: number;
    planned: number;
    disabled: number;
    blocked: number;

    executionEnabled: false;

    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
  };

  href: string | null;
};

export type WorkflowExecutionPlanReport = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    readinessItems: number;
    readyItems: number;
    plansCreated: number;
    skippedItems: number;
    executionEnabled: 0;
  };

  plans: WorkflowExecutionPlanItem[];

  skipped: Array<{
    proposalId: string;
    candidateId: string;
    readinessStatus: string;
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

export type WorkflowExecutionPlanOptions = {
  generatedAt?: string;
  evaluatedAt?: string;
  limit?: number;
};

function plannedStep(
  stepId: WorkflowExecutionPlanStepId,
  sequence: number,
  title: string,
  description: string,
  dependsOn: WorkflowExecutionPlanStepId[],
  reason: string,
): WorkflowExecutionPlanStep {
  return {
    stepId,
    sequence,
    title,
    description,
    status: "planned",
    dependsOn,

    executionEnabled: false,
    wouldExecute: false,

    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,

    reason,
  };
}

function disabledStep(
  stepId: WorkflowExecutionPlanStepId,
  sequence: number,
  title: string,
  description: string,
  dependsOn: WorkflowExecutionPlanStepId[],
  reason: string,
): WorkflowExecutionPlanStep {
  return {
    stepId,
    sequence,
    title,
    description,
    status: "disabled",
    dependsOn,

    executionEnabled: false,
    wouldExecute: false,

    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,

    reason,
  };
}

function readable(
  value: string,
) {
  return value.replace(/_/g, " ");
}

function buildPlanSteps(
  item: WorkflowExecutionReadinessItem,
): WorkflowExecutionPlanStep[] {
  return [
    plannedStep(
      "revalidate_readiness",
      1,
      "Revalidate execution readiness",
      "Run the readiness checks again immediately before any future execution.",
      [],
      "Readiness must still be READY before execution can ever be enabled.",
    ),

    plannedStep(
      "lock_execution_scope",
      2,
      "Lock proposal execution scope",
      `Lock the proposal identity, candidate, rule, action, and expected stage for ${item.proposalId}.`,
      [
        "revalidate_readiness",
      ],
      "Scope locking is represented only in this preview plan.",
    ),

    plannedStep(
      "prepare_activity",
      3,
      "Prepare workflow activity",
      `Prepare an activity record for ${readable(
        item.proposedAction,
      )}.`,
      [
        "lock_execution_scope",
      ],
      "Activity persistence remains disabled.",
    ),

    plannedStep(
      "prepare_timeline",
      4,
      "Prepare lifecycle timeline event",
      "Prepare a timeline event that records the approved automation action.",
      [
        "lock_execution_scope",
      ],
      "Timeline persistence remains disabled.",
    ),

    plannedStep(
      "prepare_notification",
      5,
      "Prepare recruiter notification",
      "Prepare an internal recruiter notification describing the approved plan.",
      [
        "lock_execution_scope",
      ],
      "Notification persistence remains disabled.",
    ),

    plannedStep(
      "prepare_audit",
      6,
      "Prepare execution audit record",
      "Prepare an immutable audit payload containing proposal, approval, readiness, and planned steps.",
      [
        "prepare_activity",
        "prepare_timeline",
        "prepare_notification",
      ],
      "Audit persistence remains disabled.",
    ),

    disabledStep(
      "stage_transition",
      7,
      "Lifecycle stage transition",
      "Apply a candidate lifecycle stage transition when required by the approved action.",
      [
        "prepare_audit",
      ],
      "Stage transitions are disabled in Execution Plan v1.",
    ),

    disabledStep(
      "candidate_update",
      8,
      "Candidate record update",
      "Update candidate workflow or profile fields related to the approved action.",
      [
        "prepare_audit",
      ],
      "Candidate database writes are disabled.",
    ),

    disabledStep(
      "email_delivery",
      9,
      "Email delivery",
      "Send candidate or client follow-up communication.",
      [
        "prepare_audit",
      ],
      "Email delivery is disabled.",
    ),
  ];
}

function buildExecutionPlan(
  item: WorkflowExecutionReadinessItem,
): WorkflowExecutionPlanItem {
  const steps =
    buildPlanSteps(item);

  return {
    executionPlanId:
      `workflow-execution-plan:${item.proposalId}`,

    proposalId:
      item.proposalId,

    candidateId:
      item.candidateId,

    candidateName:
      item.candidateName,

    ruleId:
      item.ruleId,

    proposedAction:
      item.proposedAction,

    expectedStage:
      item.expectedStage,

    currentStage:
      item.currentStage,

    readinessStatus:
      "READY",

    approvedAt:
      item.approvedAt,

    title:
      item.candidateName
        ? `Execution plan for ${item.candidateName}`
        : "Workflow execution plan",

    description:
      `Preview-only execution sequence for ${readable(
        item.proposedAction,
      )}. No step will be executed.`,

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

      executionEnabled:
        false,

      candidateDbWrites:
        0,

      workflowWrites:
        0,

      emailSends:
        0,
    },

    href:
      item.href,
  };
}

export function buildWorkflowExecutionPlanReport(
  readiness:
    WorkflowExecutionReadinessReport,
  options:
    WorkflowExecutionPlanOptions = {},
): WorkflowExecutionPlanReport {
  const readyItems =
    readiness.items.filter(
      (item) =>
        item.status === "READY",
    );

  const skipped =
    readiness.items
      .filter(
        (item) =>
          item.status !== "READY",
      )
      .map((item) => ({
        proposalId:
          item.proposalId,

        candidateId:
          item.candidateId,

        readinessStatus:
          item.status,

        reason:
          item.reason,
      }));

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 200,
        500,
      ),
    );

  const plans =
    readyItems
      .map(
        buildExecutionPlan,
      )
      .slice(
        0,
        limit,
      );

  return {
    generatedAt:
      options.generatedAt ||
      new Date().toISOString(),

    evaluatedAt:
      options.evaluatedAt ||
      readiness.evaluatedAt,

    summary: {
      readinessItems:
        readiness.items.length,

      readyItems:
        readyItems.length,

      plansCreated:
        plans.length,

      skippedItems:
        skipped.length,

      executionEnabled:
        0,
    },

    plans,

    skipped,

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
      "preview-only workflow execution plan generated from READY readiness results; no lifecycle transitions; no candidate DB writes; no workflow writes; no email sends; no automatic execution",
  };
}