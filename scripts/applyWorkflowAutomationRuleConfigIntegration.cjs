const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = process.cwd();

function full(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(
    full(relativePath),
    "utf8",
  );
}

function write(relativePath, content) {
  fs.writeFileSync(
    full(relativePath),
    content,
    "utf8",
  );
}

function replaceOnce(
  source,
  pattern,
  replacement,
  label,
) {
  if (!pattern.test(source)) {
    throw new Error(
      `Không tìm thấy anchor: ${label}`,
    );
  }

  return source.replace(
    pattern,
    replacement,
  );
}

function patchEngine() {
  const relativePath =
    "lib/recruiterWorkflowAutomationRules.ts";

  let source =
    read(relativePath);

  if (
    source.includes(
      "ruleConfigs?: WorkflowAutomationRuleConfigFile;",
    )
  ) {
    console.log(
      "Engine already contains ruleConfigs."
    );

    return;
  }

  const backupPath =
    `${full(relativePath)}.before-rule-config-integration.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(
      full(relativePath),
      backupPath,
    );
  }

  source = replaceOnce(
    source,
    /import type \{\s*RecruiterWorkflowSlaReport,\s*\} from "\.\/recruiterWorkflowSla";/,
`import type {
  RecruiterWorkflowSlaReport,
} from "./recruiterWorkflowSla";
import type {
  WorkflowAutomationRuleConfig,
  WorkflowAutomationRuleConfigFile,
} from "./recruiterWorkflowAutomationRuleConfig";`,
    "rule config import",
  );

  source = replaceOnce(
    source,
    /(rules:\s*Array<\{\s*ruleId:\s*RecruiterWorkflowAutomationRuleId;\s*)enabled:\s*true;/,
    `$1enabled: boolean;`,
    "rules enabled type",
  );

  source = replaceOnce(
    source,
    /(export type RecruiterWorkflowAutomationOptions = \{[\s\S]*?rollbackThreshold\?: number;)\s*\};/,
`$1

  ruleConfigs?:
    WorkflowAutomationRuleConfigFile;
};`,
    "ruleConfigs option",
  );

  source = replaceOnce(
    source,
    /(\n\];)\s*(\nfunction readable\(value: string\) \{)/,
`$1

function configuredRule(
  options:
    RecruiterWorkflowAutomationOptions,
  ruleId:
    RecruiterWorkflowAutomationRuleId,
): WorkflowAutomationRuleConfig | null {
  return (
    options.ruleConfigs?.rules.find(
      (rule) =>
        rule.ruleId === ruleId,
    ) || null
  );
}

function ruleEnabled(
  options:
    RecruiterWorkflowAutomationOptions,
  ruleId:
    RecruiterWorkflowAutomationRuleId,
) {
  return (
    configuredRule(
      options,
      ruleId,
    )?.enabled ?? true
  );
}

function applyConfiguredPriority(
  proposal:
    RecruiterWorkflowAutomationProposal,
  options:
    RecruiterWorkflowAutomationOptions,
): RecruiterWorkflowAutomationProposal {
  const configured =
    configuredRule(
      options,
      proposal.ruleId,
    )?.priority;

  if (!configured) {
    return proposal;
  }

  /*
   * Keep deterministic critical escalations.
   * Configuration overrides non-critical priority.
   */
  return {
    ...proposal,

    priority:
      proposal.priority === "critical"
        ? "critical"
        : configured,
  };
}
$2`,
    "rule helper insertion",
  );

  source = replaceOnce(
    source,
    /const overdueEscalationDays =\s*Math\.max\(\s*1,\s*options\.overdueEscalationDays \?\? 3,\s*\);\s*const onHoldReviewDays =\s*Math\.max\(\s*1,\s*options\.onHoldReviewDays \?\? 14,\s*\);\s*const rollbackThreshold =\s*Math\.max\(\s*1,\s*options\.rollbackThreshold \?\? 2,\s*\);/,
`const overdueEscalationDays =
    Math.max(
      1,

      configuredRule(
        options,
        "overdue_follow_up",
      )?.settings
        .overdueEscalationDays ??
        options.overdueEscalationDays ??
        3,
    );

  const onHoldReviewDays =
    Math.max(
      1,

      configuredRule(
        options,
        "on_hold_review",
      )?.settings
        .onHoldReviewDays ??
        options.onHoldReviewDays ??
        14,
    );

  const rollbackThreshold =
    Math.max(
      1,

      configuredRule(
        options,
        "repeated_rollback_review",
      )?.settings
        .rollbackThreshold ??
        options.rollbackThreshold ??
        2,
    );`,
    "configured thresholds",
  );

  source = replaceOnce(
    source,
    /const candidateProposals = \[\s*overdueProposal\([\s\S]*?rollbackProposal\(\s*state,\s*rollbackThreshold,\s*\),\s*\];\s*return candidateProposals\.filter\(\s*\(\s*item,\s*\): item is RecruiterWorkflowAutomationProposal =>\s*Boolean\(item\),\s*\);/,
`const candidateProposals = [
        ruleEnabled(
          options,
          "overdue_follow_up",
        )
          ? overdueProposal(
              state,
              context,
              overdueEscalationDays,
            )
          : null,

        ruleEnabled(
          options,
          "interview_feedback_missing",
        )
          ? interviewFeedbackProposal(
              state,
              slaReport,
            )
          : null,

        ruleEnabled(
          options,
          "offer_follow_up",
        )
          ? offerProposal(
              state,
              context,
              slaReport,
            )
          : null,

        ruleEnabled(
          options,
          "on_hold_review",
        )
          ? onHoldProposal(
              state,
              slaReport,
              onHoldReviewDays,
            )
          : null,

        ruleEnabled(
          options,
          "repeated_rollback_review",
        )
          ? rollbackProposal(
              state,
              rollbackThreshold,
            )
          : null,
      ];

      return candidateProposals
        .filter(
          (
            item,
          ): item is RecruiterWorkflowAutomationProposal =>
            Boolean(item),
        )
        .map(
          (proposal) =>
            applyConfiguredPriority(
              proposal,
              options,
            ),
        );`,
    "configured proposal generation",
  );

  source = replaceOnce(
    source,
    /rules:\s*RULES,\s*\n\s*safety:/,
`rules:
      RULES.map(
        (rule) => {
          const configured =
            configuredRule(
              options,
              rule.ruleId,
            );

          return {
            ...rule,

            enabled:
              configured?.enabled ??
              true,

            description:
              configured?.description ||
              rule.description,
          };
        },
      ),

    safety:`,
    "configured rule metadata",
  );

  write(
    relativePath,
    source,
  );

  console.log(
    "Patched automation proposal engine."
  );
}

function routeFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(
      directory,
      {
        withFileTypes: true,
      },
    )
    .flatMap((entry) => {
      const itemPath =
        path.join(
          directory,
          entry.name,
        );

      if (entry.isDirectory()) {
        return routeFiles(itemPath);
      }

      return entry.name === "route.ts"
        ? [itemPath]
        : [];
    });
}

function ensureConfigImport(source) {
  if (
    source.includes(
      'from "@/lib/recruiterWorkflowAutomationRuleConfig";',
    )
  ) {
    return source;
  }

  const importPattern =
    /import\s*\{\s*buildRecruiterWorkflowAutomationPreview,\s*\}\s*from\s*"@\/lib\/recruiterWorkflowAutomationRules";/;

  if (!importPattern.test(source)) {
    throw new Error(
      "Không tìm thấy automation preview import."
    );
  }

  return source.replace(
    importPattern,
    (match) =>
`${match}
import {
  readWorkflowAutomationRuleConfigs,
} from "@/lib/recruiterWorkflowAutomationRuleConfig";`,
  );
}

function patchPreviewCalls(
  source,
  filePath,
) {
  const sourceFile =
    ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

  const insertions = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text ===
        "buildRecruiterWorkflowAutomationPreview"
    ) {
      const options =
        node.arguments[3];

      if (
        options &&
        ts.isObjectLiteralExpression(options)
      ) {
        const text =
          source.slice(
            options.getStart(sourceFile),
            options.getEnd(),
          );

        if (
          !/\bruleConfigs\s*:/.test(text)
        ) {
          const position =
            options.getStart(sourceFile) +
            1;

          const lineStart =
            source.lastIndexOf(
              "\n",
              position,
            ) + 1;

          const baseIndent =
            source
              .slice(
                lineStart,
                position,
              )
              .match(/^\s*/)?.[0] ||
            "";

          insertions.push({
            position,
            text:
              `\n${baseIndent}  ruleConfigs: readWorkflowAutomationRuleConfigs(),`,
          });
        }
      }
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  return insertions
    .sort(
      (left, right) =>
        right.position -
        left.position,
    )
    .reduce(
      (current, insertion) =>
        current.slice(
          0,
          insertion.position,
        ) +
        insertion.text +
        current.slice(
          insertion.position,
        ),
      source,
    );
}

function patchRoutes() {
  const files =
    routeFiles(
      path.join(
        root,
        "app",
        "api",
      ),
    );

  let count = 0;

  for (const filePath of files) {
    let source =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    if (
      !source.includes(
        "buildRecruiterWorkflowAutomationPreview("
      )
    ) {
      continue;
    }

    const original =
      source;

    source =
      ensureConfigImport(source);

    source =
      patchPreviewCalls(
        source,
        filePath,
      );

    if (source !== original) {
      fs.writeFileSync(
        filePath,
        source,
        "utf8",
      );

      console.log(
        "Patched:",
        path.relative(
          root,
          filePath,
        ),
      );

      count += 1;
    }
  }

  console.log(
    `Patched ${count} API route(s).`
  );
}

patchEngine();
patchRoutes();

console.log(
  "Rule config integration completed."
);