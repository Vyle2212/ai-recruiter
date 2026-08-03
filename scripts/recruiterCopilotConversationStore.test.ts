import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendRecruiterCopilotExchange,
  clearRecruiterCopilotConversations,
  deleteRecruiterCopilotConversation,
  readRecruiterCopilotConversations,
} from "../lib/recruiterCopilotConversationStore";
import type {
  RecruiterCopilotAnswer,
} from "../lib/recruiterCopilotAnswerEngine";

const directory =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "recruiter-copilot-history-",
    ),
  );

const filePath =
  path.join(
    directory,
    "history.json",
  );

const answer: RecruiterCopilotAnswer = {
  question:
    "What should I focus on today?",
  normalizedQuestion:
    "what should i focus on today",
  intent:
    "today_priorities",
  confidence:
    0.98,
  title:
    "Today’s workflow priorities",
  answer:
    "Review overdue candidates first.",
  evidence: [
    {
      evidenceId:
        "today:overdue",
      label:
        "Overdue follow-ups",
      value:
        2,
      source:
        "context_summary",
    },
  ],
  suggestedActions: [
    {
      actionId:
        "copilot:workflow",
      label:
        "Open workflow",
      href:
        "/recruiter/workflow",
      priority:
        "high",
    },
  ],
  generatedAt:
    "2026-08-03T12:00:00.000Z",
  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    openAiCalls: 0,
    deterministic: true,
    readOnly: true,
  },
  mode:
    "deterministic recruiter Copilot answer; no OpenAI calls",
};

const empty =
  readRecruiterCopilotConversations(
    filePath,
  );

assert.equal(
  empty.conversations.length,
  0,
);

const first =
  appendRecruiterCopilotExchange(
    {
      question:
        "What should I focus on today?",
      answer,
      createdAt:
        "2026-08-03T11:59:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  first.conversation.messages.length,
  2,
);

assert.equal(
  first.conversation.messages[0].role,
  "user",
);

assert.equal(
  first.conversation.messages[1].role,
  "assistant",
);

assert.equal(
  first.conversation.messages[1].intent,
  "today_priorities",
);

assert.equal(
  first.conversation.messages[1]
    .evidenceCount,
  1,
);

const conversationId =
  first.conversation.conversationId;

const second =
  appendRecruiterCopilotExchange(
    {
      conversationId,
      question:
        "Show overdue follow-ups",
      answer: {
        ...answer,
        question:
          "Show overdue follow-ups",
        normalizedQuestion:
          "show overdue follow ups",
        intent:
          "overdue_followups",
      },
      createdAt:
        "2026-08-03T12:05:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  second.conversation.messages.length,
  4,
);

const loaded =
  readRecruiterCopilotConversations(
    filePath,
  );

assert.equal(
  loaded.conversations.length,
  1,
);

assert.equal(
  loaded.conversations[0]
    .conversationId,
  conversationId,
);

assert.equal(
  loaded.safety.candidateDbWrites,
  0,
);

assert.equal(
  loaded.safety.openAiCalls,
  0,
);

const deleted =
  deleteRecruiterCopilotConversation(
    conversationId,
    {
      filePath,
    },
  );

assert.equal(
  deleted.deleted,
  true,
);

assert.equal(
  deleted.file.conversations.length,
  0,
);

appendRecruiterCopilotExchange(
  {
    question:
      "Workflow health?",
    answer,
  },
  {
    filePath,
  },
);

const cleared =
  clearRecruiterCopilotConversations({
    filePath,
  });

assert.equal(
  cleared.conversations.length,
  0,
);

fs.rmSync(
  directory,
  {
    recursive: true,
    force: true,
  },
);

console.log(
  "recruiterCopilotConversationStore.test.ts passed",
);