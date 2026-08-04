import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildRecruiterWorkflowAutomationPreview,
} from "../lib/recruiterWorkflowAutomationRules";
import type {
  WorkflowAutomationRuleConfigFile,
} from "../lib/recruiterWorkflowAutomationRuleConfig";

function configFile(
  overrides: Partial<
    Record<
      string,
      {
        enabled?: boolean;
        priority?: "critical" | "high" | "medium" | "low";
        settings?: Record<string, number>;
      }
    >
  > = {},
): WorkflowAutomationRuleConfigFile {
  const updatedAt =
    "2026-08-04T04:00:00.000Z";

  const definitions = [
    {
      ruleId:
        "overdue_follow_up",
      priority:
        "high",
      description:
        "Overdue follow-up.",
      settings: {
        overdueEscalationDays:
          3,
      },
    },
    {
      ruleId:
        "interview_feedback_missing",
      priority:
        "medium",
      description:
        "Interview feedback.",
      settings: {},
    },
    {
      ruleId:
        "offer_follow_up",
      priority:
        "high",
      description:
        "Offer follow-up.",
      settings: {},
    },
    {
      ruleId:
        "on_hold_review",
      priority:
        "medium",
      description:
        "On-hold review.",
      settings: {
        onHoldReviewDays:
          14,
      },
    },
    {
      ruleId:
        "repeated_rollback_review",
      priority:
        "high",
      description:
        "Rollback review.",
      settings: {
        rollbackThreshold:
          2,
      },
    },
  ] as const;

  const rules =
    definitions.map(
      (definition) => {
        const override =
          overrides[
            definition.ruleId
          ];

        return {
          ...definition,

          enabled:
            override?.enabled ??
            true,

          priority:
            override?.priority ??
            definition.priority,

          settings: {
            ...definition.settings,
            ...(override?.settings ||
              {}),
          },

          updatedAt,
          updatedBy:
            "Test",
        };
      },
    );

  return {
    version: 1,
    generatedAt:
      updatedAt,

    rules:
      rules as WorkflowAutomationRuleConfigFile["rules"],

    summary: {
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
    },

    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      automaticExecution: false,
      configurationOnly: true,
    },

    mode:
      "configuration-only test fixture",
  };
}

function onHoldState() {
  return {
    candidateId:
      "candidate-on-hold",

    displayName:
      "Candidate On Hold",

    lastUpdatedAt:
      "2026-07-25T00:00:00.000Z",

    lifecycle: {
      lifecycleId:
        "lifecycle-on-hold",

      candidateId:
        "candidate-on-hold",

      candidateName:
        "Candidate On Hold",

      ownerId:
        "user-1",

      ownerName:
        "Vy",

      stage:
        "on_hold",

      previousStage:
        "interview",

      nextAction:
        "review_candidate",

      nextActionNote:
        "Review candidate.",

      nextActionDueAt:
        null,

      priority:
        "medium",

      source:
        "recruiter_updated",

      lastActivityAt:
        "2026-07-25T00:00:00.000Z",

      createdAt:
        "2026-07-01T00:00:00.000Z",

      updatedAt:
        "2026-07-25T00:00:00.000Z",

      history: [],
    },
  };
}

function overdueState() {
  return {
    candidateId:
      "candidate-overdue",

    displayName:
      "Candidate Overdue",

    lastUpdatedAt:
      "2026-07-25T00:00:00.000Z",

    lifecycle: {
      lifecycleId:
        "lifecycle-overdue",

      candidateId:
        "candidate-overdue",

      candidateName:
        "Candidate Overdue",

      ownerId:
        "user-1",

      ownerName:
        "Vy",

      stage:
        "screening",

      previousStage:
        "sourced",

      nextAction:
        "follow_up_candidate",

      nextActionNote:
        "Follow up.",

      nextActionDueAt:
        "2026-07-30T00:00:00.000Z",

      priority:
        "high",

      source:
        "recruiter_updated",

      lastActivityAt:
        "2026-07-25T00:00:00.000Z",

      createdAt:
        "2026-07-01T00:00:00.000Z",

      updatedAt:
        "2026-07-25T00:00:00.000Z",

      history: [],
    },
  };
}

const context = {
  generatedAt:
    "2026-08-04T00:00:00.000Z",

  evaluatedAt:
    "2026-08-04T00:00:00.000Z",

  reminders: [
    {
      candidateId:
        "candidate-overdue",

      dueStatus:
        "overdue",

      dueAt:
        "2026-07-30T00:00:00.000Z",

      reminderLabel:
        "Candidate action is overdue.",
    },
  ],
} as any;

const slaReport = {
  candidateRisks: [
    {
      candidateId:
        "candidate-on-hold",

      status:
        "warning",

      daysInStage:
        10,

      slaDays:
        5,
    },
  ],
} as any;

const disabled =
  buildRecruiterWorkflowAutomationPreview(
    [
      onHoldState() as any,
    ],
    context,
    slaReport,
    {
      ruleConfigs:
        configFile({
          on_hold_review: {
            enabled:
              false,
          },
        }),
    },
  );

assert.equal(
  disabled.proposals.some(
    (proposal) =>
      proposal.ruleId ===
      "on_hold_review",
  ),
  false,
);

assert.equal(
  disabled.rules.find(
    (rule) =>
      rule.ruleId ===
      "on_hold_review",
  )?.enabled,
  false,
);

const thresholdBlocked =
  buildRecruiterWorkflowAutomationPreview(
    [
      onHoldState() as any,
    ],
    context,
    slaReport,
    {
      ruleConfigs:
        configFile({
          on_hold_review: {
            settings: {
              onHoldReviewDays:
                20,
            },
          },
        }),
    },
  );

assert.equal(
  thresholdBlocked.proposals.some(
    (proposal) =>
      proposal.ruleId ===
      "on_hold_review",
  ),
  false,
);

const priorityConfigured =
  buildRecruiterWorkflowAutomationPreview(
    [
      onHoldState() as any,
    ],
    context,
    slaReport,
    {
      ruleConfigs:
        configFile({
          on_hold_review: {
            priority:
              "low",

            settings: {
              onHoldReviewDays:
                5,
            },
          },
        }),
    },
  );

const onHoldProposal =
  priorityConfigured.proposals.find(
    (proposal) =>
      proposal.ruleId ===
      "on_hold_review",
  );

assert.ok(
  onHoldProposal,
);

assert.equal(
  onHoldProposal.priority,
  "low",
);

assert.equal(
  onHoldProposal.evidence.find(
    (item) =>
      item.label ===
      "Review threshold",
  )?.value,
  5,
);

const overdueEscalated =
  buildRecruiterWorkflowAutomationPreview(
    [
      overdueState() as any,
    ],
    context,
    {
      candidateRisks: [],
    } as any,
    {
      ruleConfigs:
        configFile({
          overdue_follow_up: {
            priority:
              "low",

            settings: {
              overdueEscalationDays:
                3,
            },
          },
        }),
    },
  );

const overdueProposal =
  overdueEscalated.proposals.find(
    (proposal) =>
      proposal.ruleId ===
      "overdue_follow_up",
  );

assert.ok(
  overdueProposal,
);

// Five overdue days exceeds the configured
// three-day escalation threshold.
assert.equal(
  overdueProposal.priority,
  "critical",
);

const sourcePath =
  "lib/recruiterWorkflowAutomationRules.ts";

const source =
  fs.readFileSync(
    sourcePath,
    "utf8",
  );

assert.match(
  source,
  /ruleConfigs\?:/,
);

assert.match(
  source,
  /ruleEnabled\(/,
);

assert.match(
  source,
  /applyConfiguredPriority\(/,
);

assert.match(
  source,
  /overdueEscalationDays/,
);

assert.match(
  source,
  /onHoldReviewDays/,
);

assert.match(
  source,
  /rollbackThreshold/,
);

console.log(
  "recruiterWorkflowAutomationRuleIntegration.test.ts passed",
);