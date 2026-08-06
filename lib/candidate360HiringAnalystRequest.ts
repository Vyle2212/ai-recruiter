export type ValidHiringAnalystRequest = { question: string; jobId: string; job: Record<string, unknown> | null };
export type HiringAnalystValidation = { ok: true; value: ValidHiringAnalystRequest } | { ok: false; error: string };
export function validateHiringAnalystRequest(candidateId: string, body: unknown, maxQuestionLength = 1000): HiringAnalystValidation {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body is required." };
  const payload = body as Record<string, unknown>;
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question) return { ok: false, error: "Question is required." };
  if (question.length > maxQuestionLength) return { ok: false, error: `Question must not exceed ${maxQuestionLength} characters.` };
  if (payload.candidateId !== undefined && String(payload.candidateId).trim() !== candidateId) return { ok: false, error: "Candidate ID does not match the request route." };
  const jobId = typeof payload.jobId === "string" ? payload.jobId.trim() : "";
  const job = payload.job && typeof payload.job === "object" && !Array.isArray(payload.job) ? payload.job as Record<string, unknown> : null;
  if (jobId && !job) return { ok: false, error: "Structured Job data is required when jobId is supplied." };
  if (jobId && job && String(job.id ?? job.job_id ?? "").trim() !== jobId) return { ok: false, error: "Job ID does not match the supplied Job data." };
  return { ok: true, value: { question, jobId, job } };
}
