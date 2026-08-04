import fs from "node:fs";
import path from "node:path";

import type {
  RecruiterWorkflowAutomationAction,
  RecruiterWorkflowAutomationRuleId,
} from "./recruiterWorkflowAutomationRules";

export type WorkflowAutomationApprovalHistoryDecision =
  | "approved"
  | "rejected"
  | "deferred";

export type WorkflowAutomationApprovalHistoryEvent = {
  eventId: string;

  proposalId: string;
  candidateId: string;
  candidateName: string;

  ruleId:
    RecruiterWorkflowAutomationRuleId;

  proposedAction:
    RecruiterWorkflowAutomationAction;

  previousDecision:
    WorkflowAutomationApprovalHistoryDecision | null;

  decision:
    WorkflowAutomationApprovalHistoryDecision;

  reason: string;

  reviewerId: string | null;
  reviewerName: string | null;

  occurredAt: string;

  source:
    "approval_queue";

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    auditWrites: 1;
    emailSends: 0;
    automaticExecution: false;
    historyOnly: true;
  };
};

export type WorkflowAutomationApprovalHistoryFile = {
  version: 1;
  generatedAt: string;

  events:
    WorkflowAutomationApprovalHistoryEvent[];

  summary: {
    total: number;
    approved: number;
    rejected: number;
    deferred: number;
    proposalsAffected: number;
  };

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    automaticExecution: false;
    historyOnly: true;
  };

  mode: string;
};

export type AppendWorkflowAutomationApprovalHistoryInput = {
  proposalId: string;
  candidateId: string;
  candidateName: string;

  ruleId:
    RecruiterWorkflowAutomationRuleId;

  proposedAction:
    RecruiterWorkflowAutomationAction;

  previousDecision?:
    WorkflowAutomationApprovalHistoryDecision | null;

  decision:
    WorkflowAutomationApprovalHistoryDecision;

  reason?: string;

  reviewerId?: string | null;
  reviewerName?: string | null;

  occurredAt?: string;
};

const DECISIONS =
  new Set<WorkflowAutomationApprovalHistoryDecision>([
    "approved",
    "rejected",
    "deferred",
  ]);

function clean(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}

function normalizedDate(
  value: unknown,
  fallback =
    new Date().toISOString(),
) {
  const date =
    new Date(
      String(value ?? ""),
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? fallback
    : date.toISOString();
}

function eventId(
  input:
    AppendWorkflowAutomationApprovalHistoryInput,
  occurredAt: string,
) {
  const safeTimestamp =
    occurredAt.replace(
      /[^0-9]/g,
      "",
    );

  return [
    "workflow-approval-history",
    input.proposalId,
    input.decision,
    safeTimestamp,
  ].join(":");
}

export function workflowAutomationApprovalHistoryPath(
  baseDir =
    process.cwd(),
) {
  return path.join(
    baseDir,
    "data",
    "recruiter-workflow-automation-approval-history.json",
  );
}

function summary(
  events:
    WorkflowAutomationApprovalHistoryEvent[],
): WorkflowAutomationApprovalHistoryFile["summary"] {
  return {
    total:
      events.length,

    approved:
      events.filter(
        (event) =>
          event.decision ===
          "approved",
      ).length,

    rejected:
      events.filter(
        (event) =>
          event.decision ===
          "rejected",
      ).length,

    deferred:
      events.filter(
        (event) =>
          event.decision ===
          "deferred",
      ).length,

    proposalsAffected:
      new Set(
        events.map(
          (event) =>
            event.proposalId,
        ),
      ).size,
  };
}

function buildFile(
  events:
    WorkflowAutomationApprovalHistoryEvent[],
  generatedAt =
    new Date().toISOString(),
): WorkflowAutomationApprovalHistoryFile {
  const sorted =
    [...events].sort(
      (left, right) =>
        Date.parse(
          right.occurredAt,
        ) -
        Date.parse(
          left.occurredAt,
        ),
    );

  return {
    version: 1,
    generatedAt,
    events:
      sorted,

    summary:
      summary(sorted),

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      automaticExecution:
        false,
      historyOnly:
        true,
    },

    mode:
      "approval-history-only event log; no candidate writes; no workflow execution; no email sends",
  };
}

function normalizeEvent(
  value: unknown,
): WorkflowAutomationApprovalHistoryEvent | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const raw =
    value as Partial<WorkflowAutomationApprovalHistoryEvent>;

  const decision =
    clean(
      raw.decision,
    ) as WorkflowAutomationApprovalHistoryDecision;

  if (
    !DECISIONS.has(
      decision,
    )
  ) {
    return null;
  }

  const proposalId =
    clean(
      raw.proposalId,
    );

  const candidateId =
    clean(
      raw.candidateId,
    );

  if (
    !proposalId ||
    !candidateId
  ) {
    return null;
  }

  const previousDecision =
    raw.previousDecision &&
    DECISIONS.has(
      raw.previousDecision,
    )
      ? raw.previousDecision
      : null;

  const occurredAt =
    normalizedDate(
      raw.occurredAt,
    );

  return {
    eventId:
      clean(
        raw.eventId,
      ) ||
      [
        "workflow-approval-history",
        proposalId,
        decision,
        occurredAt.replace(
          /[^0-9]/g,
          "",
        ),
      ].join(":"),

    proposalId,
    candidateId,

    candidateName:
      clean(
        raw.candidateName,
      ) ||
      candidateId,

    ruleId:
      raw.ruleId as RecruiterWorkflowAutomationRuleId,

    proposedAction:
      raw.proposedAction as RecruiterWorkflowAutomationAction,

    previousDecision,

    decision,

    reason:
      clean(
        raw.reason,
      ),

    reviewerId:
      clean(
        raw.reviewerId,
      ) ||
      null,

    reviewerName:
      clean(
        raw.reviewerName,
      ) ||
      null,

    occurredAt,

    source:
      "approval_queue",

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 1,
      emailSends: 0,
      automaticExecution:
        false,
      historyOnly:
        true,
    },
  };
}

export function readWorkflowAutomationApprovalHistory(
  filePath =
    workflowAutomationApprovalHistoryPath(),
): WorkflowAutomationApprovalHistoryFile {
  const fullPath =
    path.resolve(
      filePath,
    );

  if (
    !fs.existsSync(
      fullPath,
    )
  ) {
    return buildFile(
      [],
    );
  }

  try {
    const parsed =
      JSON.parse(
        fs.readFileSync(
          fullPath,
          "utf8",
        ),
      );

    const events =
      Array.isArray(
        parsed?.events,
      )
        ? parsed.events
            .map(
              normalizeEvent,
            )
            .filter(
              (
                event:
                  WorkflowAutomationApprovalHistoryEvent | null,
              ): event is WorkflowAutomationApprovalHistoryEvent =>
                Boolean(event),
            )
        : [];

    return buildFile(
      events,
      normalizedDate(
        parsed?.generatedAt,
      ),
    );
  } catch {
    return buildFile(
      [],
    );
  }
}

function writeWorkflowAutomationApprovalHistory(
  events:
    WorkflowAutomationApprovalHistoryEvent[],
  filePath =
    workflowAutomationApprovalHistoryPath(),
) {
  const fullPath =
    path.resolve(
      filePath,
    );

  fs.mkdirSync(
    path.dirname(
      fullPath,
    ),
    {
      recursive:
        true,
    },
  );

  const file =
    buildFile(
      events,
    );

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

export function appendWorkflowAutomationApprovalHistory(
  input:
    AppendWorkflowAutomationApprovalHistoryInput,
  options: {
    filePath?: string;
  } = {},
) {
  if (
    !DECISIONS.has(
      input.decision,
    )
  ) {
    throw new Error(
      "Invalid approval history decision.",
    );
  }

  const proposalId =
    clean(
      input.proposalId,
    );

  const candidateId =
    clean(
      input.candidateId,
    );

  if (
    !proposalId ||
    !candidateId
  ) {
    throw new Error(
      "Proposal ID and candidate ID are required.",
    );
  }

  const occurredAt =
    normalizedDate(
      input.occurredAt,
    );

  const current =
    readWorkflowAutomationApprovalHistory(
      options.filePath,
    );

  const event:
    WorkflowAutomationApprovalHistoryEvent = {
    eventId:
      eventId(
        input,
        occurredAt,
      ),

    proposalId,
    candidateId,

    candidateName:
      clean(
        input.candidateName,
      ) ||
      candidateId,

    ruleId:
      input.ruleId,

    proposedAction:
      input.proposedAction,

    previousDecision:
      input.previousDecision &&
      DECISIONS.has(
        input.previousDecision,
      )
        ? input.previousDecision
        : null,

    decision:
      input.decision,

    reason:
      clean(
        input.reason,
      ),

    reviewerId:
      clean(
        input.reviewerId,
      ) ||
      null,

    reviewerName:
      clean(
        input.reviewerName,
      ) ||
      null,

    occurredAt,

    source:
      "approval_queue",

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      auditWrites: 1,
      emailSends: 0,
      automaticExecution:
        false,
      historyOnly:
        true,
    },
  };

  const events =
    [
      ...current.events.filter(
        (existing) =>
          existing.eventId !==
          event.eventId,
      ),
      event,
    ];

  return {
    event,

    file:
      writeWorkflowAutomationApprovalHistory(
        events,
        options.filePath,
      ),
  };
}