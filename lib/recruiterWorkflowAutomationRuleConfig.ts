import fs from "node:fs";
import path from "node:path";

import type {
  RecruiterWorkflowAutomationPriority,
  RecruiterWorkflowAutomationRuleId,
} from "./recruiterWorkflowAutomationRules";

export type WorkflowAutomationRuleConfig = {
  ruleId: RecruiterWorkflowAutomationRuleId;
  enabled: boolean;

  priority:
    RecruiterWorkflowAutomationPriority;

  description: string;

  settings: {
    overdueEscalationDays?: number;
    onHoldReviewDays?: number;
    rollbackThreshold?: number;
  };

  updatedAt: string;
  updatedBy: string | null;
};

export type WorkflowAutomationRuleConfigFile = {
  version: 1;
  generatedAt: string;

  rules:
    WorkflowAutomationRuleConfig[];

  summary: {
    total: number;
    enabled: number;
    disabled: number;
  };

  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    automaticExecution: false;
    configurationOnly: true;
  };

  mode: string;
};

export type SaveWorkflowAutomationRuleConfigInput = {
  ruleId:
    RecruiterWorkflowAutomationRuleId;

  enabled?: boolean;

  priority?:
    RecruiterWorkflowAutomationPriority;

  settings?: {
    overdueEscalationDays?: number;
    onHoldReviewDays?: number;
    rollbackThreshold?: number;
  };

  updatedBy?: string | null;
  updatedAt?: string;
};

const RULE_IDS =
  new Set<RecruiterWorkflowAutomationRuleId>([
    "overdue_follow_up",
    "interview_feedback_missing",
    "offer_follow_up",
    "on_hold_review",
    "repeated_rollback_review",
  ]);

const PRIORITIES =
  new Set<RecruiterWorkflowAutomationPriority>([
    "critical",
    "high",
    "medium",
    "low",
  ]);

function clean(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}

function normalizeDate(
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

function positiveInteger(
  value: unknown,
  fallback: number,
  maximum = 365,
) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum,
  );
}

export function defaultWorkflowAutomationRuleConfigs(
  updatedAt =
    new Date().toISOString(),
): WorkflowAutomationRuleConfig[] {
  return [
    {
      ruleId:
        "overdue_follow_up",

      enabled:
        true,

      priority:
        "high",

      description:
        "Propose follow-up when a candidate action is overdue.",

      settings: {
        overdueEscalationDays:
          3,
      },

      updatedAt,
      updatedBy:
        null,
    },

    {
      ruleId:
        "interview_feedback_missing",

      enabled:
        true,

      priority:
        "medium",

      description:
        "Propose requesting feedback when interview-stage SLA requires attention.",

      settings: {},

      updatedAt,
      updatedBy:
        null,
    },

    {
      ruleId:
        "offer_follow_up",

      enabled:
        true,

      priority:
        "high",

      description:
        "Propose client follow-up when an offer-stage candidate requires attention.",

      settings: {},

      updatedAt,
      updatedBy:
        null,
    },

    {
      ruleId:
        "on_hold_review",

      enabled:
        true,

      priority:
        "medium",

      description:
        "Propose recruiter review when a candidate remains on hold too long.",

      settings: {
        onHoldReviewDays:
          14,
      },

      updatedAt,
      updatedBy:
        null,
    },

    {
      ruleId:
        "repeated_rollback_review",

      enabled:
        true,

      priority:
        "high",

      description:
        "Propose workflow audit when repeated rollback activity is detected.",

      settings: {
        rollbackThreshold:
          2,
      },

      updatedAt,
      updatedBy:
        null,
    },
  ];
}

export function workflowAutomationRuleConfigPath(
  baseDir =
    process.cwd(),
) {
  return path.join(
    baseDir,
    "data",
    "recruiter-workflow-automation-rules.json",
  );
}

function summary(
  rules:
    WorkflowAutomationRuleConfig[],
): WorkflowAutomationRuleConfigFile["summary"] {
  return {
    total:
      rules.length,

    enabled:
      rules.filter(
        (rule) =>
          rule.enabled,
      ).length,

    disabled:
      rules.filter(
        (rule) =>
          !rule.enabled,
      ).length,
  };
}

function buildFile(
  rules:
    WorkflowAutomationRuleConfig[],
  generatedAt =
    new Date().toISOString(),
): WorkflowAutomationRuleConfigFile {
  return {
    version: 1,
    generatedAt,
    rules,
    summary:
      summary(rules),

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      automaticExecution:
        false,
      configurationOnly:
        true,
    },

    mode:
      "configuration-only workflow automation rule registry; no candidate writes; no workflow execution; no email sends",
  };
}

function normalizeRule(
  value: unknown,
  fallback:
    WorkflowAutomationRuleConfig,
): WorkflowAutomationRuleConfig {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return fallback;
  }

  const raw =
    value as Partial<WorkflowAutomationRuleConfig>;

  const ruleId =
    clean(
      raw.ruleId,
    ) as RecruiterWorkflowAutomationRuleId;

  if (
    !RULE_IDS.has(ruleId) ||
    ruleId !==
      fallback.ruleId
  ) {
    return fallback;
  }

  const priority =
    clean(
      raw.priority,
    ) as RecruiterWorkflowAutomationPriority;

  return {
    ruleId,

    enabled:
      typeof raw.enabled ===
      "boolean"
        ? raw.enabled
        : fallback.enabled,

    priority:
      PRIORITIES.has(priority)
        ? priority
        : fallback.priority,

    description:
      clean(
        raw.description,
      ) ||
      fallback.description,

    settings: {
      overdueEscalationDays:
        ruleId ===
        "overdue_follow_up"
          ? positiveInteger(
              raw.settings
                ?.overdueEscalationDays,
              fallback.settings
                .overdueEscalationDays ||
                3,
            )
          : undefined,

      onHoldReviewDays:
        ruleId ===
        "on_hold_review"
          ? positiveInteger(
              raw.settings
                ?.onHoldReviewDays,
              fallback.settings
                .onHoldReviewDays ||
                14,
            )
          : undefined,

      rollbackThreshold:
        ruleId ===
        "repeated_rollback_review"
          ? positiveInteger(
              raw.settings
                ?.rollbackThreshold,
              fallback.settings
                .rollbackThreshold ||
                2,
              100,
            )
          : undefined,
    },

    updatedAt:
      normalizeDate(
        raw.updatedAt,
        fallback.updatedAt,
      ),

    updatedBy:
      clean(
        raw.updatedBy,
      ) ||
      null,
  };
}

export function readWorkflowAutomationRuleConfigs(
  filePath =
    workflowAutomationRuleConfigPath(),
): WorkflowAutomationRuleConfigFile {
  const defaults =
    defaultWorkflowAutomationRuleConfigs();

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
      defaults,
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

    const savedRules =
      Array.isArray(
        parsed?.rules,
      )
        ? parsed.rules
        : [];

    const byRuleId =
      new Map(
        savedRules.map(
          (rule: unknown) => {
            const candidate =
              rule as {
                ruleId?: unknown;
              };

            return [
              clean(
                candidate.ruleId,
              ),
              rule,
            ];
          },
        ),
      );

    const rules =
      defaults.map(
        (fallback) =>
          normalizeRule(
            byRuleId.get(
              fallback.ruleId,
            ),
            fallback,
          ),
      );

    return buildFile(
      rules,
      normalizeDate(
        parsed?.generatedAt,
      ),
    );
  } catch {
    return buildFile(
      defaults,
    );
  }
}

export function writeWorkflowAutomationRuleConfigs(
  rules:
    WorkflowAutomationRuleConfig[],
  filePath =
    workflowAutomationRuleConfigPath(),
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
      rules,
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

export function saveWorkflowAutomationRuleConfig(
  input:
    SaveWorkflowAutomationRuleConfigInput,
  options: {
    filePath?: string;
  } = {},
) {
  if (
    !RULE_IDS.has(
      input.ruleId,
    )
  ) {
    throw new Error(
      "Unknown workflow automation rule ID.",
    );
  }

  const current =
    readWorkflowAutomationRuleConfigs(
      options.filePath,
    );

  const existing =
    current.rules.find(
      (rule) =>
        rule.ruleId ===
        input.ruleId,
    );

  if (!existing) {
    throw new Error(
      "Workflow automation rule configuration was not found.",
    );
  }

  const updatedAt =
    normalizeDate(
      input.updatedAt,
    );

  const priority =
    input.priority &&
    PRIORITIES.has(
      input.priority,
    )
      ? input.priority
      : existing.priority;

  const updated:
    WorkflowAutomationRuleConfig = {
    ...existing,

    enabled:
      typeof input.enabled ===
      "boolean"
        ? input.enabled
        : existing.enabled,

    priority,

    settings: {
      ...existing.settings,

      overdueEscalationDays:
        input.ruleId ===
          "overdue_follow_up"
          ? positiveInteger(
              input.settings
                ?.overdueEscalationDays,
              existing.settings
                .overdueEscalationDays ||
                3,
            )
          : undefined,

      onHoldReviewDays:
        input.ruleId ===
          "on_hold_review"
          ? positiveInteger(
              input.settings
                ?.onHoldReviewDays,
              existing.settings
                .onHoldReviewDays ||
                14,
            )
          : undefined,

      rollbackThreshold:
        input.ruleId ===
          "repeated_rollback_review"
          ? positiveInteger(
              input.settings
                ?.rollbackThreshold,
              existing.settings
                .rollbackThreshold ||
                2,
              100,
            )
          : undefined,
    },

    updatedAt,

    updatedBy:
      clean(
        input.updatedBy,
      ) ||
      null,
  };

  const rules =
    current.rules.map(
      (rule) =>
        rule.ruleId ===
        updated.ruleId
          ? updated
          : rule,
    );

  return {
    rule:
      updated,

    file:
      writeWorkflowAutomationRuleConfigs(
        rules,
        options.filePath,
      ),
  };
}

export function resetWorkflowAutomationRuleConfigs(
  options: {
    filePath?: string;
    updatedBy?: string | null;
  } = {},
) {
  const updatedAt =
    new Date().toISOString();

  const updatedBy =
    clean(
      options.updatedBy,
    ) ||
    null;

  const rules =
    defaultWorkflowAutomationRuleConfigs(
      updatedAt,
    ).map(
      (rule) => ({
        ...rule,
        updatedBy,
      }),
    );

  return writeWorkflowAutomationRuleConfigs(
    rules,
    options.filePath,
  );
}