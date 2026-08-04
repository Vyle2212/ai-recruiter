import type {
  WorkflowAutomationDecisionFile,
} from "./recruiterWorkflowAutomationDecisions";
import type {
  WorkflowExecutionAuditPreviewReport,
} from "./recruiterWorkflowExecutionAuditPreview";
import type {
  WorkflowExecutionReadinessReport,
} from "./recruiterWorkflowExecutionReadiness";
import type {
  WorkflowExecutionSimulationReport,
} from "./recruiterWorkflowExecutionSimulator";

export type WorkflowExecutionReleaseGateStatus =
  | "READY_FOR_RELEASE_PREVIEW"
  | "BLOCKED"
  | "LOCKED";

export type WorkflowExecutionReleaseGateCheckStatus =
  | "passed"
  | "failed"
  | "locked";

export type WorkflowExecutionReleaseGateCheck = {
  checkId:
    | "approved_decision"
    | "readiness_ready"
    | "proposal_not_stale"
    | "audit_preview_exists"
    | "audit_checksum_valid"
    | "dry_run_completed"
    | "dry_run_checksum_matches"
    | "execution_lock";

  title: string;

  status:
    WorkflowExecutionReleaseGateCheckStatus;

  reason: string;

  evidence:
    string | number | boolean | null;
};

export type WorkflowExecutionReleaseGateItem = {
  releaseGateId: string;

  proposalId: string;
  candidateId: string;
  candidateName: string | null;

  ruleId: string;
  proposedAction: string;

  status:
    WorkflowExecutionReleaseGateStatus;

  reason: string;

  checks:
    WorkflowExecutionReleaseGateCheck[];

  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    locked: number;
  };

  checksum: {
    algorithm: "sha256";
    auditChecksum: string | null;
    simulationChecksum: string | null;
    matches: boolean;
  };

  lock: {
    executionLockEnabled: boolean;
    lockState:
      | "enabled"
      | "disabled";
    releaseAllowed: false;
    wouldRelease: false;
  };

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;
    automaticExecution: false;
    executionEnabled: false;
    previewOnly: true;
  };

  href: string | null;
};

export type WorkflowExecutionReleaseGateReport = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    approvedDecisions: number;
    gateItems: number;

    readyForReleasePreview: number;
    blocked: number;
    locked: number;

    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;

    releasesPerformed: 0;
  };

  items:
    WorkflowExecutionReleaseGateItem[];

  unmatched: Array<{
    proposalId: string;
    candidateId: string;
    reason: string;
  }>;

  lock: {
    executionLockEnabled: boolean;
    releaseAllowed: false;
    releasesPerformed: 0;
  };

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    automaticActions: 0;

    executionEnabled: false;
    releasePreviewOnly: true;
  };

  mode: string;
};

export type WorkflowExecutionReleaseGateOptions = {
  generatedAt?: string;
  evaluatedAt?: string;
  limit?: number;

  /*
   * This only affects release-gate preview status.
   * It never enables workflow execution.
   */
  executionLockEnabled?: boolean;
};

function check(
  checkId:
    WorkflowExecutionReleaseGateCheck["checkId"],
  title: string,
  passed: boolean,
  reason: string,
  evidence:
    WorkflowExecutionReleaseGateCheck["evidence"],
): WorkflowExecutionReleaseGateCheck {
  return {
    checkId,
    title,

    status:
      passed
        ? "passed"
        : "failed",

    reason,
    evidence,
  };
}

export function buildWorkflowExecutionReleaseGateReport(
  decisions:
    WorkflowAutomationDecisionFile,
  readiness:
    WorkflowExecutionReadinessReport,
  auditPreview:
    WorkflowExecutionAuditPreviewReport,
  simulation:
    WorkflowExecutionSimulationReport,
  options:
    WorkflowExecutionReleaseGateOptions = {},
): WorkflowExecutionReleaseGateReport {
  const evaluatedAt =
    options.evaluatedAt ||
    readiness.evaluatedAt ||
    auditPreview.evaluatedAt ||
    simulation.evaluatedAt ||
    new Date().toISOString();

  const executionLockEnabled =
    options.executionLockEnabled ===
    true;

  const approvedDecisions =
    decisions.decisions.filter(
      (decision) =>
        decision.decision ===
        "approved",
    );

  const readinessMap =
    new Map(
      readiness.items.map(
        (item) => [
          item.proposalId,
          item,
        ],
      ),
    );

  const auditMap =
    new Map(
      auditPreview.previews.map(
        (item) => [
          item.proposalId,
          item,
        ],
      ),
    );

  const simulationMap =
    new Map(
      simulation.simulations.map(
        (item) => [
          item.proposalId,
          item,
        ],
      ),
    );

  const unmatched:
    WorkflowExecutionReleaseGateReport["unmatched"] = [];

  const items:
    WorkflowExecutionReleaseGateItem[] = [];

  for (
    const decision of approvedDecisions
  ) {
    const readinessItem =
      readinessMap.get(
        decision.proposalId,
      );

    const auditItem =
      auditMap.get(
        decision.proposalId,
      );

    const simulationItem =
      simulationMap.get(
        decision.proposalId,
      );

    if (
      !readinessItem &&
      !auditItem &&
      !simulationItem
    ) {
      unmatched.push({
        proposalId:
          decision.proposalId,

        candidateId:
          decision.candidateId,

        reason:
          "No readiness, audit preview, or dry-run simulation was found for the approved proposal.",
      });

      continue;
    }

    const auditChecksum =
      auditItem?.checksum.value ||
      null;

    const simulationChecksum =
      simulationItem?.checksum.value ||
      null;

    const checksumMatches =
      Boolean(
        auditChecksum &&
        simulationChecksum &&
        auditChecksum ===
          simulationChecksum,
      );

    const checks:
      WorkflowExecutionReleaseGateCheck[] = [
      check(
        "approved_decision",
        "Approved decision",
        decision.decision ===
          "approved",
        decision.decision ===
          "approved"
          ? "Recruiter approval is present."
          : "Recruiter approval is missing.",
        decision.decision,
      ),

      check(
        "readiness_ready",
        "Execution readiness",
        readinessItem?.status ===
          "READY",
        readinessItem?.status ===
          "READY"
          ? "Execution readiness is READY."
          : `Execution readiness is ${
              readinessItem?.status ||
              "not available"
            }.`,
        readinessItem?.status ||
          null,
      ),

      check(
        "proposal_not_stale",
        "Proposal freshness",
        Boolean(
          readinessItem &&
          readinessItem.status !==
            "STALE",
        ),
        readinessItem?.status ===
          "STALE"
          ? "The proposal is stale and must be reviewed again."
          : "The proposal is not marked stale.",
        readinessItem?.status ||
          null,
      ),

      check(
        "audit_preview_exists",
        "Audit preview",
        Boolean(
          auditItem,
        ),
        auditItem
          ? "Execution audit preview exists."
          : "Execution audit preview is missing.",
        auditItem?.auditPreviewId ||
          null,
      ),

      check(
        "audit_checksum_valid",
        "Audit checksum",
        Boolean(
          auditChecksum &&
          /^[a-f0-9]{64}$/.test(
            auditChecksum,
          ),
        auditChecksum
          ? "Audit preview contains a SHA-256 checksum."
          : "Audit preview checksum is missing.",
        auditChecksum,
      ),

      check(
        "dry_run_completed",
        "Dry-run simulation",
        simulationItem?.status ===
          "DRY_RUN_COMPLETED",
        simulationItem?.status ===
          "DRY_RUN_COMPLETED"
          ? "Dry-run simulation completed."
          : "Dry-run simulation has not completed.",
        simulationItem?.status ||
          null,
      ),

      check(
        "dry_run_checksum_matches",
        "Dry-run checksum",
        checksumMatches,
        checksumMatches
          ? "Dry-run checksum matches the audit preview checksum."
          : "Dry-run checksum does not match the audit preview checksum.",
        checksumMatches,
      ),
    ];

    checks.push({
      checkId:
        "execution_lock",

      title:
        "Execution lock",

      status:
        executionLockEnabled
          ? "passed"
          : "locked",

      reason:
        executionLockEnabled
          ? "Release-gate preview lock is enabled."
          : "Execution lock remains disabled; release is blocked.",

      evidence:
        executionLockEnabled,
    });

    const failed =
      checks.filter(
        (item) =>
          item.status ===
          "failed",
      ).length;

    const locked =
      checks.filter(
        (item) =>
          item.status ===
          "locked",
      ).length;

    const status:
      WorkflowExecutionReleaseGateStatus =
      failed > 0
        ? "BLOCKED"
        : locked > 0
          ? "LOCKED"
          : "READY_FOR_RELEASE_PREVIEW";

    const reason =
      status ===
      "BLOCKED"
        ? `${failed} release-gate check(s) failed.`
        : status ===
            "LOCKED"
          ? "All safety checks passed, but execution lock remains disabled."
          : "All release-gate preview checks passed.";

    items.push({
      releaseGateId:
        `workflow-execution-release-gate:${decision.proposalId}`,

      proposalId:
        decision.proposalId,

      candidateId:
        decision.candidateId,

      candidateName:
        auditItem?.candidateName ||
        simulationItem?.candidateName ||
        readinessItem?.candidateName ||
        null,

      ruleId:
        decision.ruleId,

      proposedAction:
        decision.proposedAction,

      status,
      reason,
      checks,

      summary: {
        totalChecks:
          checks.length,

        passed:
          checks.filter(
            (item) =>
              item.status ===
              "passed",
          ).length,

        failed,
        locked,
      },

      checksum: {
        algorithm:
          "sha256",

        auditChecksum,
        simulationChecksum,
        matches:
          checksumMatches,
      },

      lock: {
        executionLockEnabled,

        lockState:
          executionLockEnabled
            ? "enabled"
            : "disabled",

        releaseAllowed:
          false,

        wouldRelease:
          false,
      },

      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        auditWrites: 0,
        emailSends: 0,
        automaticExecution: false,
        executionEnabled: false,
        previewOnly: true,
      },

      href:
        auditItem?.href ||
        simulationItem?.href ||
        readinessItem?.href ||
        null,
    });
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
    items
      .sort(
        (left, right) => {
          const order:
            Record<
              WorkflowExecutionReleaseGateStatus,
              number
            > = {
            BLOCKED: 3,
            LOCKED: 2,
            READY_FOR_RELEASE_PREVIEW: 1,
          };

          return (
            order[right.status] -
            order[left.status]
          );
        },
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
        approvedDecisions.length,

      gateItems:
        visible.length,

      readyForReleasePreview:
        visible.filter(
          (item) =>
            item.status ===
            "READY_FOR_RELEASE_PREVIEW",
        ).length,

      blocked:
        visible.filter(
          (item) =>
            item.status ===
            "BLOCKED",
        ).length,

      locked:
        visible.filter(
          (item) =>
            item.status ===
            "LOCKED",
        ).length,

      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,
      releasesPerformed: 0,
    },

    items:
      visible,

    unmatched,

    lock: {
      executionLockEnabled,
      releaseAllowed: false,
      releasesPerformed: 0,
    },

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,

      executionEnabled: false,
      releasePreviewOnly: true,
    },

    mode:
      "workflow execution release-gate preview only; no workflow release; no candidate writes; no workflow writes; no audit writes; no email sends; execution remains disabled",
  };
}