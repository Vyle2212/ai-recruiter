import type { RecruiterCopilotAnswer } from "./recruiterCopilotAnswerEngine";

const intents = new Set([
  "today_priorities",
  "overdue_followups",
  "pipeline_bottleneck",
  "top_recruiter",
  "candidate_priority",
  "workflow_health",
  "unknown",
]);
// Validate the fields persisted by the history store before accessing arrays.
export function isRecruiterCopilotHistoryAnswer(
  value: unknown,
): value is RecruiterCopilotAnswer {
  if (!value || typeof value !== "object") return false;
  const answer = value as Record<string, unknown>;
  return (
    typeof answer.answer === "string" &&
    answer.answer.trim().length > 0 &&
    typeof answer.generatedAt === "string" &&
    Number.isFinite(Date.parse(answer.generatedAt)) &&
    typeof answer.intent === "string" &&
    intents.has(answer.intent) &&
    typeof answer.confidence === "number" &&
    Number.isFinite(answer.confidence) &&
    answer.confidence >= 0 &&
    answer.confidence <= 1 &&
    Array.isArray(answer.evidence) &&
    Array.isArray(answer.suggestedActions)
  );
}
