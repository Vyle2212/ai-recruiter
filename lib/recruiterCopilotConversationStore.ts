import fs from "node:fs";
import path from "node:path";

import type {
  RecruiterCopilotAnswer,
  RecruiterCopilotIntent,
} from "./recruiterCopilotAnswerEngine";

export type RecruiterCopilotMessageRole =
  | "user"
  | "assistant";

export type RecruiterCopilotMessage = {
  messageId: string;
  role: RecruiterCopilotMessageRole;
  content: string;
  createdAt: string;
  intent: RecruiterCopilotIntent | null;
  confidence: number | null;
  evidenceCount: number;
  suggestedActionCount: number;
};

export type RecruiterCopilotConversation = {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: RecruiterCopilotMessage[];
};

export type RecruiterCopilotConversationFile = {
  version: 1;
  generatedAt: string;
  conversations: RecruiterCopilotConversation[];
  safety: {
    candidateDbWrites: 0;
    workflowWrites: 0;
    emailSends: 0;
    openAiCalls: 0;
  };
  mode: string;
};

export type AppendRecruiterCopilotExchangeInput = {
  conversationId?: string;
  question: string;
  answer: RecruiterCopilotAnswer;
  createdAt?: string;
};

const FILE_VERSION = 1;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseDate(value: unknown) {
  const date = new Date(String(value ?? ""));

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function createId(
  prefix: string,
  occurredAt: string,
) {
  return `${prefix}:${occurredAt}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function conversationTitle(question: string) {
  const normalized = clean(question);

  if (normalized.length <= 80) {
    return normalized || "Recruiter Copilot conversation";
  }

  return `${normalized.slice(0, 77)}...`;
}

export function recruiterCopilotConversationPath(
  baseDir = process.cwd(),
) {
  return path.join(
    baseDir,
    "data",
    "recruiter-copilot-history.json",
  );
}

export function emptyRecruiterCopilotConversationFile(
  generatedAt = new Date().toISOString(),
): RecruiterCopilotConversationFile {
  return {
    version: FILE_VERSION,
    generatedAt,
    conversations: [],
    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
    },
    mode:
      "local recruiter Copilot conversation history only; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
  };
}

function normalizeMessage(
  value: unknown,
): RecruiterCopilotMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw =
    value as Partial<RecruiterCopilotMessage>;

  const messageId = clean(raw.messageId);
  const role = raw.role;
  const content = clean(raw.content);
  const createdAt = parseDate(raw.createdAt);

  if (
    !messageId ||
    !content ||
    !createdAt ||
    !["user", "assistant"].includes(
      String(role),
    )
  ) {
    return null;
  }

  return {
    messageId,
    role:
      role as RecruiterCopilotMessageRole,
    content,
    createdAt,
    intent:
      typeof raw.intent === "string"
        ? raw.intent
        : null,
    confidence:
      typeof raw.confidence === "number"
        ? raw.confidence
        : null,
    evidenceCount:
      typeof raw.evidenceCount === "number"
        ? Math.max(
            0,
            Math.floor(raw.evidenceCount),
          )
        : 0,
    suggestedActionCount:
      typeof raw.suggestedActionCount ===
      "number"
        ? Math.max(
            0,
            Math.floor(
              raw.suggestedActionCount,
            ),
          )
        : 0,
  };
}

function normalizeConversation(
  value: unknown,
): RecruiterCopilotConversation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw =
    value as Partial<RecruiterCopilotConversation>;

  const conversationId =
    clean(raw.conversationId);

  const createdAt =
    parseDate(raw.createdAt);

  const updatedAt =
    parseDate(raw.updatedAt);

  if (
    !conversationId ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    conversationId,
    title:
      clean(raw.title) ||
      "Recruiter Copilot conversation",
    createdAt,
    updatedAt,
    messages: Array.isArray(raw.messages)
      ? raw.messages
          .map(normalizeMessage)
          .filter(
            (
              message,
            ): message is RecruiterCopilotMessage =>
              Boolean(message),
          )
      : [],
  };
}

export function readRecruiterCopilotConversations(
  filePath = recruiterCopilotConversationPath(),
): RecruiterCopilotConversationFile {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    return emptyRecruiterCopilotConversationFile();
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(fullPath, "utf8"),
    );

    const conversations = Array.isArray(
      parsed?.conversations,
    )
      ? parsed.conversations
          .map(normalizeConversation)
          .filter(
            (
              conversation:
                RecruiterCopilotConversation | null,
            ): conversation is RecruiterCopilotConversation =>
              Boolean(conversation),
          )
      : [];

    return {
      version: FILE_VERSION,
      generatedAt:
        parseDate(parsed?.generatedAt) ||
        new Date().toISOString(),
      conversations: conversations.sort(
        (
          left: RecruiterCopilotConversation,
          right: RecruiterCopilotConversation,
        ) =>
          Date.parse(right.updatedAt) -
          Date.parse(left.updatedAt),
      ),
      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        openAiCalls: 0,
      },
      mode:
        "local recruiter Copilot conversation history only; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
    };
  } catch {
    return emptyRecruiterCopilotConversationFile();
  }
}

export function writeRecruiterCopilotConversations(
  file: RecruiterCopilotConversationFile,
  filePath = recruiterCopilotConversationPath(),
) {
  const fullPath = path.resolve(filePath);
  const directory = path.dirname(fullPath);

  fs.mkdirSync(directory, {
    recursive: true,
  });

  const normalized: RecruiterCopilotConversationFile = {
    ...file,
    version: FILE_VERSION,
    generatedAt:
      new Date().toISOString(),
    safety: {
      candidateDbWrites: 0,
      workflowWrites: 0,
      emailSends: 0,
      openAiCalls: 0,
    },
    mode:
      "local recruiter Copilot conversation history only; no candidate DB writes; no workflow writes; no email sends; no OpenAI calls",
  };

  const temporaryPath =
    `${fullPath}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(
      normalized,
      null,
      2,
    ),
    "utf8",
  );

  fs.renameSync(
    temporaryPath,
    fullPath,
  );

  return normalized;
}

export function appendRecruiterCopilotExchange(
  input: AppendRecruiterCopilotExchangeInput,
  options: {
    filePath?: string;
    maxConversations?: number;
    maxMessagesPerConversation?: number;
  } = {},
) {
  const createdAt =
    parseDate(input.createdAt) ||
    new Date().toISOString();

  const current =
    readRecruiterCopilotConversations(
      options.filePath,
    );

  const conversationId =
    clean(input.conversationId) ||
    createId(
      "copilot-conversation",
      createdAt,
    );

  const existingIndex =
    current.conversations.findIndex(
      (conversation) =>
        conversation.conversationId ===
        conversationId,
    );

  const userMessage: RecruiterCopilotMessage = {
    messageId: createId(
      "copilot-message-user",
      createdAt,
    ),
    role: "user",
    content: clean(input.question),
    createdAt,
    intent: null,
    confidence: null,
    evidenceCount: 0,
    suggestedActionCount: 0,
  };

  const assistantMessage:
    RecruiterCopilotMessage = {
    messageId: createId(
      "copilot-message-assistant",
      input.answer.generatedAt,
    ),
    role: "assistant",
    content: input.answer.answer,
    createdAt:
      input.answer.generatedAt,
    intent:
      input.answer.intent,
    confidence:
      input.answer.confidence,
    evidenceCount:
      input.answer.evidence.length,
    suggestedActionCount:
      input.answer.suggestedActions.length,
  };

  const maxMessages =
    Math.max(
      2,
      options.maxMessagesPerConversation ??
        100,
    );

  let conversation:
    RecruiterCopilotConversation;

  if (existingIndex >= 0) {
    const existing =
      current.conversations[
        existingIndex
      ];

    conversation = {
      ...existing,
      updatedAt:
        assistantMessage.createdAt,
      messages: [
        ...existing.messages,
        userMessage,
        assistantMessage,
      ].slice(-maxMessages),
    };

    current.conversations.splice(
      existingIndex,
      1,
    );
  } else {
    conversation = {
      conversationId,
      title:
        conversationTitle(
          input.question,
        ),
      createdAt,
      updatedAt:
        assistantMessage.createdAt,
      messages: [
        userMessage,
        assistantMessage,
      ],
    };
  }

  const maxConversations =
    Math.max(
      1,
      options.maxConversations ?? 100,
    );

  current.conversations = [
    conversation,
    ...current.conversations,
  ].slice(0, maxConversations);

  const saved =
    writeRecruiterCopilotConversations(
      current,
      options.filePath,
    );

  return {
    conversation,
    file: saved,
    safety: saved.safety,
  };
}

export function deleteRecruiterCopilotConversation(
  conversationId: string,
  options: {
    filePath?: string;
  } = {},
) {
  const current =
    readRecruiterCopilotConversations(
      options.filePath,
    );

  const before =
    current.conversations.length;

  current.conversations =
    current.conversations.filter(
      (conversation) =>
        conversation.conversationId !==
        conversationId,
    );

  const saved =
    writeRecruiterCopilotConversations(
      current,
      options.filePath,
    );

  return {
    deleted:
      saved.conversations.length <
      before,
    conversationId,
    file: saved,
  };
}

export function clearRecruiterCopilotConversations(
  options: {
    filePath?: string;
  } = {},
) {
  return writeRecruiterCopilotConversations(
    emptyRecruiterCopilotConversationFile(),
    options.filePath,
  );
}