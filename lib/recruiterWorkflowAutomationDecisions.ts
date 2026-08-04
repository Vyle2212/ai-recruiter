import fs from "node:fs";
import path from "node:path";

export type WorkflowAutomationDecisionStatus =
  | "approved"
  | "rejected"
  | "deferred";

export type WorkflowAutomationDecision = {
  proposalId: string;
  candidateId: string;
  ruleId: string;
  proposedAction: string;

  decision: WorkflowAutomationDecisionStatus;
  reason: string;

  reviewerId: string | null;
  reviewerName: string | null;

  decidedAt: string;
  updatedAt: string;

  executionStatus: "not_executed";

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    automaticExecution: false;
  };
};

export type WorkflowAutomationDecisionFile = {
  version: 1;
  generatedAt: string;
  decisions: WorkflowAutomationDecision[];

  summary: {
    total: number;
    approved: number;
    rejected: number;
    deferred: number;
    executed: 0;
  };

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
    automaticExecution: false;
    reviewOnly: true;
  };

  mode: string;
};

export type SaveWorkflowAutomationDecisionInput = {
  proposalId: string;
  candidateId: string;
  ruleId: string;
  proposedAction: string;

  decision: WorkflowAutomationDecisionStatus;
  reason?: string;

  reviewerId?: string | null;
  reviewerName?: string | null;

  decidedAt?: string;
};

const VALID_DECISIONS =
  new Set<WorkflowAutomationDecisionStatus>([
    "approved",
    "rejected",
    "deferred",
  ]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function validDate(
  value: unknown,
  fallback = new Date().toISOString(),
) {
  const parsed = new Date(String(value ?? ""));

  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toISOString();
}

function summary(
  decisions: WorkflowAutomationDecision[],
): WorkflowAutomationDecisionFile["summary"] {
  return {
    total: decisions.length,

    approved: decisions.filter(
      (item) =>
        item.decision === "approved",
    ).length,

    rejected: decisions.filter(
      (item) =>
        item.decision === "rejected",
    ).length,

    deferred: decisions.filter(
      (item) =>
        item.decision === "deferred",
    ).length,

    executed: 0,
  };
}

export function workflowAutomationDecisionPath(
  baseDir = process.cwd(),
) {
  return path.join(
    baseDir,
    "data",
    "recruiter-workflow-automation-decisions.json",
  );
}

export function emptyWorkflowAutomationDecisionFile(
  generatedAt = new Date().toISOString(),
): WorkflowAutomationDecisionFile {
  return {
    version: 1,
    generatedAt,
    decisions: [],

    summary: {
      total: 0,
      approved: 0,
      rejected: 0,
      deferred: 0,
      executed: 0,
    },

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      automaticExecution: false,
      reviewOnly: true,
    },

    mode:
      "review-only recruiter workflow automation decisions; decisions do not execute candidate or workflow actions",
  };
}

function normalizeDecision(
  value: unknown,
): WorkflowAutomationDecision | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw =
    value as Partial<WorkflowAutomationDecision>;

  const proposalId =
    clean(raw.proposalId);

  const candidateId =
    clean(raw.candidateId);

  const ruleId =
    clean(raw.ruleId);

  const proposedAction =
    clean(raw.proposedAction);

  const decision =
    clean(raw.decision) as WorkflowAutomationDecisionStatus;

  if (
    !proposalId ||
    !candidateId ||
    !ruleId ||
    !proposedAction ||
    !VALID_DECISIONS.has(decision)
  ) {
    return null;
  }

  const decidedAt =
    validDate(raw.decidedAt);

  return {
    proposalId,
    candidateId,
    ruleId,
    proposedAction,

    decision,

    reason:
      clean(raw.reason),

    reviewerId:
      clean(raw.reviewerId) || null,

    reviewerName:
      clean(raw.reviewerName) || null,

    decidedAt,

    updatedAt:
      validDate(
        raw.updatedAt,
        decidedAt,
      ),

    executionStatus:
      "not_executed",

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      automaticExecution: false,
    },
  };
}

export function readWorkflowAutomationDecisions(
  filePath = workflowAutomationDecisionPath(),
): WorkflowAutomationDecisionFile {
  const fullPath =
    path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    return emptyWorkflowAutomationDecisionFile();
  }

  try {
    const parsed =
      JSON.parse(
        fs.readFileSync(
          fullPath,
          "utf8",
        ),
      );

    const decisions =
      Array.isArray(parsed?.decisions)
        ? parsed.decisions
            .map(normalizeDecision)
            .filter(
              (
                item:
                  WorkflowAutomationDecision | null,
              ): item is WorkflowAutomationDecision =>
                Boolean(item),
            )
            .sort(
              (
                left: WorkflowAutomationDecision,
                right: WorkflowAutomationDecision,
              ) =>
                Date.parse(
                  right.updatedAt,
                ) -
                Date.parse(
                  left.updatedAt,
                ),
            )
        : [];

    return {
      ...emptyWorkflowAutomationDecisionFile(
        validDate(parsed?.generatedAt),
      ),

      decisions,
      summary:
        summary(decisions),
    };
  } catch {
    return emptyWorkflowAutomationDecisionFile();
  }
}

export function writeWorkflowAutomationDecisions(
  decisions: WorkflowAutomationDecision[],
  filePath = workflowAutomationDecisionPath(),
) {
  const fullPath =
    path.resolve(filePath);

  fs.mkdirSync(
    path.dirname(fullPath),
    {
      recursive: true,
    },
  );

  const file:
    WorkflowAutomationDecisionFile = {
    ...emptyWorkflowAutomationDecisionFile(),
    decisions,
    summary:
      summary(decisions),
  };

  const temporaryPath =
    `${fullPath}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(
      file,
      null,
      2,
    ),
    "utf8",
  );

  fs.renameSync(
    temporaryPath,
    fullPath,
  );

  return file;
}

export function saveWorkflowAutomationDecision(
  input: SaveWorkflowAutomationDecisionInput,
  options: {
    filePath?: string;
  } = {},
) {
  const proposalId =
    clean(input.proposalId);

  const candidateId =
    clean(input.candidateId);

  const ruleId =
    clean(input.ruleId);

  const proposedAction =
    clean(input.proposedAction);

  if (
    !proposalId ||
    !candidateId ||
    !ruleId ||
    !proposedAction
  ) {
    throw new Error(
      "Proposal ID, candidate ID, rule ID, and proposed action are required.",
    );
  }

  if (
    !VALID_DECISIONS.has(
      input.decision,
    )
  ) {
    throw new Error(
      "Decision must be approved, rejected, or deferred.",
    );
  }

  const current =
    readWorkflowAutomationDecisions(
      options.filePath,
    );

  const existing =
    current.decisions.find(
      (item) =>
        item.proposalId ===
        proposalId,
    );

  const decidedAt =
    validDate(
      input.decidedAt,
    );

  const decision:
    WorkflowAutomationDecision = {
    proposalId,
    candidateId,
    ruleId,
    proposedAction,

    decision:
      input.decision,

    reason:
      clean(input.reason),

    reviewerId:
      clean(input.reviewerId) ||
      null,

    reviewerName:
      clean(input.reviewerName) ||
      null,

    decidedAt:
      existing?.decidedAt ||
      decidedAt,

    updatedAt:
      decidedAt,

    executionStatus:
      "not_executed",

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
      automaticExecution: false,
    },
  };

  const decisions = [
    decision,
    ...current.decisions.filter(
      (item) =>
        item.proposalId !==
        proposalId,
    ),
  ];

  return {
    decision,
    file:
      writeWorkflowAutomationDecisions(
        decisions,
        options.filePath,
      ),
  };
}

export function deleteWorkflowAutomationDecision(
  proposalId: string,
  options: {
    filePath?: string;
  } = {},
) {
  const current =
    readWorkflowAutomationDecisions(
      options.filePath,
    );

  const decisions =
    current.decisions.filter(
      (item) =>
        item.proposalId !==
        proposalId,
    );

  return {
    deleted:
      decisions.length <
      current.decisions.length,

    proposalId,

    file:
      writeWorkflowAutomationDecisions(
        decisions,
        options.filePath,
      ),
  };
}