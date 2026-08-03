import type {
  WorkflowAutomationDecision,
  WorkflowAutomationDecisionFile,
} from "./recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationProposal,
} from "./recruiterWorkflowAutomationRules";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";

export type WorkflowExecutionReadinessStatus =
  | "READY"
  | "BLOCKED"
  | "STALE"
  | "ALREADY_EXECUTED";

export type WorkflowExecutionReadinessCheckId =
  | "proposal_exists"
  | "decision_approved"
  | "proposal_identity_matches"
  | "candidate_state_exists"
  | "candidate_stage_matches"
  | "lifecycle_unchanged_since_approval"
  | "execution_not_recorded"
  | "candidate_writes_locked"
  | "email_delivery_locked";

export type WorkflowExecutionReadinessCheckStatus =
  | "passed"
  | "failed"
  | "warning";

export type WorkflowExecutionReadinessCheck = {
  checkId: WorkflowExecutionReadinessCheckId;
  status: WorkflowExecutionReadinessCheckStatus;
  title: string;
  description: string;
  evidence: string | number | boolean | null;
};

export type WorkflowExecutionReadinessItem = {
  readinessId: string;

  proposalId: string;
  candidateId: string;
  candidateName: string | null;

  ruleId: string;
  proposedAction: string;
  expectedStage: string | null;
  currentStage: string | null;

  decision: string;
  approvedAt: string | null;

  status: WorkflowExecutionReadinessStatus;
  reason: string;

  checks: WorkflowExecutionReadinessCheck[];

  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };

  execution: {
    enabled: false;
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    automaticExecution: false;
  };

  href: string | null;
};

export type WorkflowExecutionReadinessReport = {
  generatedAt: string;
  evaluatedAt: string;

  summary: {
    total: number;
    ready: number;
    blocked: number;
    stale: number;
    alreadyExecuted: number;
  };

  items: WorkflowExecutionReadinessItem[];

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    pushSends: 0;
    openAiCalls: 0;
    automaticActions: 0;
    executionEnabled: false;
    readinessOnly: true;
  };

  mode: string;
};

export type WorkflowExecutionReadinessOptions = {
  generatedAt?: string;
  evaluatedAt?: string;
  limit?: number;
  executedProposalIds?: string[];
};

function parseDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function passed(
  checkId: WorkflowExecutionReadinessCheckId,
  title: string,
  description: string,
  evidence: WorkflowExecutionReadinessCheck["evidence"],
): WorkflowExecutionReadinessCheck {
  return {
    checkId,
    status: "passed",
    title,
    description,
    evidence,
  };
}

function failed(
  checkId: WorkflowExecutionReadinessCheckId,
  title: string,
  description: string,
  evidence: WorkflowExecutionReadinessCheck["evidence"],
): WorkflowExecutionReadinessCheck {
  return {
    checkId,
    status: "failed",
    title,
    description,
    evidence,
  };
}

function warning(
  checkId: WorkflowExecutionReadinessCheckId,
  title: string,
  description: string,
  evidence: WorkflowExecutionReadinessCheck["evidence"],
): WorkflowExecutionReadinessCheck {
  return {
    checkId,
    status: "warning",
    title,
    description,
    evidence,
  };
}

function stateByCandidateId(
  states: PersistedWorkflowState[],
) {
  return new Map(
    states.map((state) => [
      state.candidateId,
      state,
    ]),
  );
}

function proposalById(
  preview: RecruiterWorkflowAutomationPreview,
) {
  return new Map(
    preview.proposals.map((proposal) => [
      proposal.proposalId,
      proposal,
    ]),
  );
}

function candidateLifecycleUpdatedAt(
  state: PersistedWorkflowState | undefined,
) {
  if (!state) return null;

  return (
    parseDate(
      state.lifecycle?.updatedAt,
    ) ||
    parseDate(
      state.lastUpdatedAt,
    )
  );
}

function identityMatches(
  proposal: RecruiterWorkflowAutomationProposal,
  decision: WorkflowAutomationDecision,
) {
  return (
    proposal.candidateId ===
      decision.candidateId &&
    proposal.ruleId ===
      decision.ruleId &&
    proposal.proposedAction ===
      decision.proposedAction
  );
}

function buildReadinessItem(
  decision: WorkflowAutomationDecision,
  proposal:
    | RecruiterWorkflowAutomationProposal
    | undefined,
  state:
    | PersistedWorkflowState
    | undefined,
  executedProposalIds: Set<string>,
): WorkflowExecutionReadinessItem {
  const checks:
    WorkflowExecutionReadinessCheck[] = [];

  if (proposal) {
    checks.push(
      passed(
        "proposal_exists",
        "Proposal exists",
        "The approved automation proposal is still present in the current preview.",
        proposal.proposalId,
      ),
    );
  } else {
    checks.push(
      failed(
        "proposal_exists",
        "Proposal exists",
        "The approved proposal is no longer present in the current automation preview.",
        decision.proposalId,
      ),
    );
  }

  if (
    decision.decision === "approved"
  ) {
    checks.push(
      passed(
        "decision_approved",
        "Decision approved",
        "The latest recorded recruiter decision is approved.",
        decision.decision,
      ),
    );
  } else {
    checks.push(
      failed(
        "decision_approved",
        "Decision approved",
        "The latest recorded decision is not approved.",
        decision.decision,
      ),
    );
  }

  if (
    proposal &&
    identityMatches(
      proposal,
      decision,
    )
  ) {
    checks.push(
      passed(
        "proposal_identity_matches",
        "Proposal identity matches",
        "Candidate, rule, and proposed action still match the approved decision.",
        true,
      ),
    );
  } else {
    checks.push(
      failed(
        "proposal_identity_matches",
        "Proposal identity matches",
        "The current proposal does not match the approved decision identity.",
        false,
      ),
    );
  }

  if (
    state?.lifecycle
  ) {
    checks.push(
      passed(
        "candidate_state_exists",
        "Candidate lifecycle exists",
        "A persisted lifecycle state exists for the candidate.",
        state.candidateId,
      ),
    );
  } else {
    checks.push(
      failed(
        "candidate_state_exists",
        "Candidate lifecycle exists",
        "No persisted lifecycle state exists for the candidate.",
        decision.candidateId,
      ),
    );
  }

  const currentStage =
    state?.lifecycle?.stage || null;

  const expectedStage =
    proposal?.currentStage || null;

  if (
    proposal &&
    currentStage &&
    currentStage === expectedStage
  ) {
    checks.push(
      passed(
        "candidate_stage_matches",
        "Candidate stage matches",
        "The candidate remains in the stage used to create the approved proposal.",
        currentStage,
      ),
    );
  } else {
    checks.push(
      failed(
        "candidate_stage_matches",
        "Candidate stage matches",
        "The candidate stage has changed or cannot be verified.",
        currentStage,
      ),
    );
  }

  const approvedAt =
    parseDate(
      decision.updatedAt,
    );

  const lifecycleUpdatedAt =
    candidateLifecycleUpdatedAt(
      state,
    );

  if (
    approvedAt &&
    lifecycleUpdatedAt &&
    lifecycleUpdatedAt.getTime() >
      approvedAt.getTime()
  ) {
    checks.push(
      failed(
        "lifecycle_unchanged_since_approval",
        "Lifecycle unchanged since approval",
        "Candidate lifecycle changed after the automation decision was approved.",
        lifecycleUpdatedAt.toISOString(),
      ),
    );
  } else if (
    approvedAt &&
    lifecycleUpdatedAt
  ) {
    checks.push(
      passed(
        "lifecycle_unchanged_since_approval",
        "Lifecycle unchanged since approval",
        "No newer lifecycle update was found after approval.",
        lifecycleUpdatedAt.toISOString(),
      ),
    );
  } else {
    checks.push(
      warning(
        "lifecycle_unchanged_since_approval",
        "Lifecycle unchanged since approval",
        "Lifecycle and approval timestamps could not both be verified.",
        null,
      ),
    );
  }

  const alreadyExecuted =
    executedProposalIds.has(
      decision.proposalId,
    );

  if (alreadyExecuted) {
    checks.push(
      failed(
        "execution_not_recorded",
        "Execution not previously recorded",
        "An execution record already exists for this proposal.",
        true,
      ),
    );
  } else {
    checks.push(
      passed(
        "execution_not_recorded",
        "Execution not previously recorded",
        "No execution record exists for this proposal.",
        false,
      ),
    );
  }

  checks.push(
    passed(
      "candidate_writes_locked",
      "Candidate writes remain locked",
      "Candidate database writes remain disabled by the readiness gate.",
      0,
    ),
  );

  checks.push(
    passed(
      "email_delivery_locked",
      "Email delivery remains locked",
      "Email delivery remains disabled by the readiness gate.",
      0,
    ),
  );

  const failedChecks =
    checks.filter(
      (check) =>
        check.status === "failed",
    );

  let status:
    WorkflowExecutionReadinessStatus;

  let reason: string;

  if (alreadyExecuted) {
    status = "ALREADY_EXECUTED";
    reason =
      "This proposal already has an execution record.";
  } else if (
    !proposal ||
    !identityMatches(
      proposal,
      decision,
    )
  ) {
    status = "STALE";
    reason =
      "The approved decision no longer matches the current automation proposal.";
  } else if (
    lifecycleUpdatedAt &&
    approvedAt &&
    lifecycleUpdatedAt.getTime() >
      approvedAt.getTime()
  ) {
    status = "STALE";
    reason =
      "Candidate lifecycle changed after approval.";
  } else if (
    failedChecks.length > 0
  ) {
    status = "BLOCKED";
    reason =
      failedChecks[0].description;
  } else {
    status = "READY";
    reason =
      "All readiness checks passed, but execution remains disabled.";
  }

  return {
    readinessId:
      `workflow-execution-readiness:${decision.proposalId}`,

    proposalId:
      decision.proposalId,

    candidateId:
      decision.candidateId,

    candidateName:
      proposal?.candidateName ||
      state?.lifecycle?.candidateName ||
      null,

    ruleId:
      decision.ruleId,

    proposedAction:
      decision.proposedAction,

    expectedStage,
    currentStage,

    decision:
      decision.decision,

    approvedAt:
      approvedAt?.toISOString() ||
      null,

    status,
    reason,

    checks,

    summary: {
      totalChecks:
        checks.length,

      passed:
        checks.filter(
          (check) =>
            check.status === "passed",
        ).length,

      failed:
        failedChecks.length,

      warnings:
        checks.filter(
          (check) =>
            check.status === "warning",
        ).length,
    },

    execution: {
      enabled: false,
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      automaticExecution: false,
    },

    href:
      proposal?.href ||
      (
        decision.candidateId
          ? `/recruiter/candidate360/${encodeURIComponent(
              decision.candidateId,
            )}`
          : null
      ),
  };
}

function readinessWeight(
  status: WorkflowExecutionReadinessStatus,
) {
  if (status === "BLOCKED") {
    return 4;
  }

  if (status === "STALE") {
    return 3;
  }

  if (
    status === "ALREADY_EXECUTED"
  ) {
    return 2;
  }

  return 1;
}

export function buildWorkflowExecutionReadinessReport(
  states: PersistedWorkflowState[],
  automationPreview: RecruiterWorkflowAutomationPreview,
  decisionFile: WorkflowAutomationDecisionFile,
  options: WorkflowExecutionReadinessOptions = {},
): WorkflowExecutionReadinessReport {
  const proposals =
    proposalById(
      automationPreview,
    );

  const statesByCandidate =
    stateByCandidateId(
      states,
    );

  const executedProposalIds =
    new Set(
      options.executedProposalIds || [],
    );

  const approvedDecisions =
    decisionFile.decisions.filter(
      (decision) =>
        decision.decision === "approved",
    );

  const limit =
    Math.max(
      0,
      Math.min(
        options.limit ?? 200,
        500,
      ),
    );

  const items =
    approvedDecisions
      .map((decision) =>
        buildReadinessItem(
          decision,
          proposals.get(
            decision.proposalId,
          ),
          statesByCandidate.get(
            decision.candidateId,
          ),
          executedProposalIds,
        ),
      )
      .sort(
        (left, right) => {
          const statusDifference =
            readinessWeight(
              right.status,
            ) -
            readinessWeight(
              left.status,
            );

          if (
            statusDifference !== 0
          ) {
            return statusDifference;
          }

          return (
            Date.parse(
              right.approvedAt || "",
            ) -
            Date.parse(
              left.approvedAt || "",
            )
          );
        },
      )
      .slice(0, limit);

  return {
    generatedAt:
      options.generatedAt ||
      new Date().toISOString(),

    evaluatedAt:
      options.evaluatedAt ||
      new Date().toISOString(),

    summary: {
      total:
        items.length,

      ready:
        items.filter(
          (item) =>
            item.status === "READY",
        ).length,

      blocked:
        items.filter(
          (item) =>
            item.status === "BLOCKED",
        ).length,

      stale:
        items.filter(
          (item) =>
            item.status === "STALE",
        ).length,

      alreadyExecuted:
        items.filter(
          (item) =>
            item.status ===
            "ALREADY_EXECUTED",
        ).length,
    },

    items,

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      pushSends: 0,
      openAiCalls: 0,
      automaticActions: 0,
      executionEnabled: false,
      readinessOnly: true,
    },

    mode:
      "readiness-only workflow execution gate for approved automation decisions; no stage transitions; no candidate DB writes; no workflow writes; no email sends; no automatic execution",
  };
}