import type {
  WorkflowExecutionAuditPreviewItem,
  WorkflowExecutionAuditPreviewReport,
} from "./recruiterWorkflowExecutionAuditPreview";

export type WorkflowExecutionSimulationStepStatus =
  | "simulated"
  | "skipped"
  | "blocked";

export type WorkflowExecutionSimulationStep = {
  simulationStepId: string;

  sequence: number;
  stepId: string;
  title: string;

  status:
    WorkflowExecutionSimulationStepStatus;

  dependsOn: string[];

  dependencyStatus:
    "satisfied" | "not_applicable" | "blocked";

  simulatedResult: string;

  wouldExecute: false;

  candidateDbWrites: 0;
  workflowWrites: 0;
  auditWrites: 0;
  emailSends: 0;

  durationMs: number;
};

export type WorkflowExecutionSimulationItem = {
  simulationId: string;

  auditPreviewId: string;
  proposalId: string;

  candidateId: string;
  candidateName: string | null;

  ruleId: string;
  proposedAction: string;

  checksum: {
    algorithm: "sha256";
    value: string;
    verified: true;
  };

  status:
    "DRY_RUN_COMPLETED";

  executionEnabled: false;
  dryRun: true;

  startedAt: string;
  completedAt: string;

  steps:
    WorkflowExecutionSimulationStep[];

  summary: {
    totalSteps: number;
    simulated: number;
    skipped: number;
    blocked: number;

    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;

    executionEnabled: false;
    dryRun: true;
  };

  href: string | null;
};

export type WorkflowExecutionSimulationReport = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    auditPreviews: number;
    simulationsCreated: number;
    dryRunsCompleted: number;
    skippedPreviews: number;

    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;
  };

  simulations:
    WorkflowExecutionSimulationItem[];

  skipped: Array<{
    proposalId: string;
    auditPreviewId: string;
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
    dryRun: true;
    previewOnly: true;
  };

  mode: string;
};

export type WorkflowExecutionSimulationOptions = {
  generatedAt?: string;
  evaluatedAt?: string;
  limit?: number;
};

function readable(
  value: string,
) {
  return value.replace(
    /_/g,
    " ",
  );
}

function simulatedResultForStep(
  stepId: string,
  status: string,
) {
  if (
    status === "disabled"
  ) {
    return `${readable(
      stepId,
    )} was skipped because execution remains disabled.`;
  }

  if (
    stepId ===
    "revalidate_readiness"
  ) {
    return "Readiness would be revalidated immediately before execution.";
  }

  if (
    stepId ===
    "lock_execution_scope"
  ) {
    return "Proposal identity and execution scope would be locked.";
  }

  if (
    stepId ===
    "prepare_activity"
  ) {
    return "Workflow activity payload would be prepared without persistence.";
  }

  if (
    stepId ===
    "prepare_timeline"
  ) {
    return "Timeline event payload would be prepared without persistence.";
  }

  if (
    stepId ===
    "prepare_notification"
  ) {
    return "Recruiter notification payload would be prepared without delivery.";
  }

  if (
    stepId ===
    "prepare_audit"
  ) {
    return "Audit payload would be prepared without writing an audit record.";
  }

  return `${readable(
    stepId,
  )} would be simulated without execution.`;
}

function simulateStep(
  audit:
    WorkflowExecutionAuditPreviewItem,
  step:
    WorkflowExecutionAuditPreviewItem[
      "canonicalPayload"
    ]["plan"]["steps"][number],
  completedStepIds:
    Set<string>,
): WorkflowExecutionSimulationStep {
  const dependencies =
    step.dependsOn || [];

  const dependenciesSatisfied =
    dependencies.every(
      (dependency) =>
        completedStepIds.has(
          dependency,
        ),
    );

  if (
    !dependenciesSatisfied
  ) {
    return {
      simulationStepId:
        `${audit.auditPreviewId}:simulation-step:${step.stepId}`,

      sequence:
        step.sequence,

      stepId:
        step.stepId,

      title:
        readable(
          step.stepId,
        ),

      status:
        "blocked",

      dependsOn:
        [...dependencies],

      dependencyStatus:
        "blocked",

      simulatedResult:
        "Simulation blocked because one or more dependencies were not satisfied.",

      wouldExecute:
        false,

      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,

      durationMs: 0,
    };
  }

  const disabled =
    step.status ===
    "disabled";

  return {
    simulationStepId:
      `${audit.auditPreviewId}:simulation-step:${step.stepId}`,

    sequence:
      step.sequence,

    stepId:
      step.stepId,

    title:
      readable(
        step.stepId,
      ),

    status:
      disabled
        ? "skipped"
        : "simulated",

    dependsOn:
      [...dependencies],

    dependencyStatus:
      dependencies.length
        ? "satisfied"
        : "not_applicable",

    simulatedResult:
      simulatedResultForStep(
        step.stepId,
        step.status,
      ),

    wouldExecute:
      false,

    candidateDbWrites: 0,
    workflowWrites: 0,
    auditWrites: 0,
    emailSends: 0,

    durationMs:
      disabled
        ? 0
        : 1,
  };
}

function simulateAuditPreview(
  audit:
    WorkflowExecutionAuditPreviewItem,
  evaluatedAt: string,
): WorkflowExecutionSimulationItem {
  const completedStepIds =
    new Set<string>();

  const steps =
    [...audit.canonicalPayload.plan.steps]
      .sort(
        (left, right) =>
          left.sequence -
          right.sequence,
      )
      .map((step) => {
        const simulated =
          simulateStep(
            audit,
            step,
            completedStepIds,
          );

        if (
          simulated.status ===
            "simulated" ||
          simulated.status ===
            "skipped"
        ) {
          completedStepIds.add(
            step.stepId,
          );
        }

        return simulated;
      });

  return {
    simulationId:
      `workflow-execution-simulation:${audit.proposalId}`,

    auditPreviewId:
      audit.auditPreviewId,

    proposalId:
      audit.proposalId,

    candidateId:
      audit.candidateId,

    candidateName:
      audit.candidateName,

    ruleId:
      audit.ruleId,

    proposedAction:
      audit.proposedAction,

    checksum: {
      algorithm:
        "sha256",

      value:
        audit.checksum.value,

      verified:
        true,
    },

    status:
      "DRY_RUN_COMPLETED",

    executionEnabled:
      false,

    dryRun:
      true,

    startedAt:
      evaluatedAt,

    completedAt:
      evaluatedAt,

    steps,

    summary: {
      totalSteps:
        steps.length,

      simulated:
        steps.filter(
          (step) =>
            step.status ===
            "simulated",
        ).length,

      skipped:
        steps.filter(
          (step) =>
            step.status ===
            "skipped",
        ).length,

      blocked:
        steps.filter(
          (step) =>
            step.status ===
            "blocked",
        ).length,

      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,

      executionEnabled:
        false,

      dryRun:
        true,
    },

    href:
      audit.href,
  };
}

export function buildWorkflowExecutionSimulationReport(
  auditReport:
    WorkflowExecutionAuditPreviewReport,
  options:
    WorkflowExecutionSimulationOptions = {},
): WorkflowExecutionSimulationReport {
  const evaluatedAt =
    options.evaluatedAt ||
    auditReport.evaluatedAt ||
    new Date().toISOString();

  const skipped:
    WorkflowExecutionSimulationReport["skipped"] = [];

  const eligible =
    auditReport.previews.filter(
      (audit) => {
        const valid =
          audit.readiness.status ===
            "READY" &&
          audit.decision.status ===
            "approved" &&
          audit.plan.executionEnabled ===
            false &&
          audit.safety.previewOnly ===
            true;

        if (!valid) {
          skipped.push({
            proposalId:
              audit.proposalId,

            auditPreviewId:
              audit.auditPreviewId,

            reason:
              "Audit preview is not eligible for dry-run simulation.",
          });
        }

        return valid;
      },
    );

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 200,
        500,
      ),
    );

  const simulations =
    eligible
      .slice(
        0,
        limit,
      )
      .map((audit) =>
        simulateAuditPreview(
          audit,
          evaluatedAt,
        ),
      );

  return {
    generatedAt:
      options.generatedAt ||
      new Date().toISOString(),

    evaluatedAt,

    summary: {
      auditPreviews:
        auditReport.previews.length,

      simulationsCreated:
        simulations.length,

      dryRunsCompleted:
        simulations.filter(
          (item) =>
            item.status ===
            "DRY_RUN_COMPLETED",
        ).length,

      skippedPreviews:
        skipped.length,

      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,
    },

    simulations,

    skipped,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,

      executionEnabled:
        false,

      dryRun:
        true,

      previewOnly:
        true,
    },

    mode:
      "deterministic workflow execution dry-run simulator; no candidate DB writes; no workflow writes; no audit writes; no email sends; no automatic execution",
  };
}