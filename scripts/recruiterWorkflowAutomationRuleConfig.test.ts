import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readWorkflowAutomationRuleConfigs,
  resetWorkflowAutomationRuleConfigs,
  saveWorkflowAutomationRuleConfig,
} from "../lib/recruiterWorkflowAutomationRuleConfig";

const directory =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "workflow-rule-config-",
    ),
  );

const filePath =
  path.join(
    directory,
    "rules.json",
  );

const initial =
  readWorkflowAutomationRuleConfigs(
    filePath,
  );

assert.equal(
  initial.summary.total,
  5,
);

assert.equal(
  initial.summary.enabled,
  5,
);

assert.equal(
  initial.safety.candidateDbWrites,
  0,
);

assert.equal(
  initial.safety.workflowWrites,
  0,
);

assert.equal(
  initial.safety.automaticExecution,
  false,
);

const saved =
  saveWorkflowAutomationRuleConfig(
    {
      ruleId:
        "overdue_follow_up",

      enabled:
        false,

      priority:
        "critical",

      settings: {
        overdueEscalationDays:
          5,
      },

      updatedBy:
        "Vy",

      updatedAt:
        "2026-08-04T05:00:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  saved.rule.enabled,
  false,
);

assert.equal(
  saved.rule.priority,
  "critical",
);

assert.equal(
  saved.rule.settings
    .overdueEscalationDays,
  5,
);

assert.equal(
  saved.rule.updatedBy,
  "Vy",
);

assert.equal(
  saved.file.summary.disabled,
  1,
);

const reread =
  readWorkflowAutomationRuleConfigs(
    filePath,
  );

const overdueRule =
  reread.rules.find(
    (rule) =>
      rule.ruleId ===
      "overdue_follow_up",
  );

assert.ok(
  overdueRule,
);

assert.equal(
  overdueRule.enabled,
  false,
);

assert.equal(
  overdueRule.settings
    .overdueEscalationDays,
  5,
);

const reset =
  resetWorkflowAutomationRuleConfigs({
    filePath,
    updatedBy:
      "Vy",
  });

assert.equal(
  reset.summary.enabled,
  5,
);

assert.equal(
  reset.summary.disabled,
  0,
);

assert.equal(
  reset.rules.find(
    (rule) =>
      rule.ruleId ===
      "overdue_follow_up",
  )?.settings
    .overdueEscalationDays,
  3,
);

assert.equal(
  reset.rules.find(
    (rule) =>
      rule.ruleId ===
      "on_hold_review",
  )?.settings
    .onHoldReviewDays,
  14,
);

assert.equal(
  reset.rules.find(
    (rule) =>
      rule.ruleId ===
      "repeated_rollback_review",
  )?.settings
    .rollbackThreshold,
  2,
);

const routePath =
  "app/api/recruiter/workflow/automation-rules/route.ts";

assert.ok(
  fs.existsSync(
    routePath,
  ),
);

const route =
  fs.readFileSync(
    routePath,
    "utf8",
  );

assert.match(
  route,
  /export async function GET/,
);

assert.match(
  route,
  /export async function POST/,
);

assert.match(
  route,
  /export async function DELETE/,
);

assert.doesNotMatch(
  route,
  /move-stage|rollback-stage/,
);

fs.rmSync(
  directory,
  {
    recursive: true,
    force: true,
  },
);

console.log(
  "recruiterWorkflowAutomationRuleConfig.test.ts passed",
);