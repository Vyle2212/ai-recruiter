import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildRecruiterWorkflowNotifications,
} from "../lib/recruiterWorkflowNotifications";
import type {
  RecruiterCopilotSuggestionFeed,
} from "../lib/recruiterCopilotSuggestions";

const suggestionFeed: RecruiterCopilotSuggestionFeed = {
  generatedAt: "2026-08-03T12:00:00.000Z",
  evaluatedAt: "2026-08-03T12:00:00.000Z",

  summary: {
    total: 1,
    critical: 1,
    high: 0,
    medium: 0,
    low: 0,
    candidateSpecific: 1,
  },

  suggestions: [
    {
      suggestionId:
        "copilot-suggestion:follow_up_overdue:candidate-1",
      type: "follow_up_overdue",
      priority: "critical",
      title: "Follow up Candidate One",
      description:
        "Candidate One requires an overdue follow-up.",
      candidateId: "candidate-1",
      candidateName: "Candidate One",
      stage: "submitted",
      nextAction: "follow_up_client",
      dueAt: "2026-08-01T09:00:00.000Z",
      actionLabel: "Open Candidate360",
      href: "/recruiter/candidate360/candidate-1",
      reason: "Overdue follow-up",
      evidence: [],
      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        openAiCalls: 0,
        requiresHumanAction: true,
      },
    },
  ],

  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    openAiCalls: 0,
    automaticActions: 0,
    readOnly: true,
  },

  mode:
    "deterministic recruiter Copilot suggestions",
};

const feed =
  buildRecruiterWorkflowNotifications(
    suggestionFeed,
  );

assert.equal(feed.summary.total, 1);
assert.equal(feed.summary.unread, 1);
assert.equal(feed.summary.critical, 1);
assert.equal(feed.summary.candidateSpecific, 1);

assert.equal(
  feed.notifications[0].candidateId,
  "candidate-1",
);

assert.equal(
  feed.notifications[0].status,
  "unread",
);

assert.equal(
  feed.safety.candidateDbWrites,
  0,
);

assert.equal(
  feed.safety.workflowWrites,
  0,
);

assert.equal(
  feed.safety.emailSends,
  0,
);

assert.equal(
  feed.safety.pushSends,
  0,
);

assert.equal(
  feed.safety.automaticActions,
  0,
);

assert.match(
  feed.mode,
  /read-only/i,
);

const pagePath =
  "app/recruiter/workflow/notifications/page.tsx";

const routePath =
  "app/api/recruiter/workflow/notifications/route.ts";

const workflowPath =
  "app/recruiter/workflow/page.tsx";

assert.ok(fs.existsSync(pagePath));
assert.ok(fs.existsSync(routePath));

const page =
  fs.readFileSync(pagePath, "utf8");

const workflow =
  fs.readFileSync(workflowPath, "utf8");

assert.match(
  page,
  /\/api\/recruiter\/workflow\/notifications/,
);

assert.match(
  page,
  /Workflow Notifications/,
);

assert.match(
  page,
  /import\s+\{\s*WorkflowSlaBadge\s*\}\s+from\s+["']@\/app\/recruiter\/components\/WorkflowSlaBadge["']/,
);

assert.match(
  page,
  /<WorkflowSlaBadge\s+compact\s*\/>/,
);

assert.doesNotMatch(
  page,
  /href=["']\/recruiter\/workflow\/notifications["']/,
);

console.log(
  "recruiterWorkflowNotifications.test.ts passed",
);