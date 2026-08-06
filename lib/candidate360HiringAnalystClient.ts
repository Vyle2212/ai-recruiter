import type { HiringAnalystAnswer } from "./candidate360HiringAnalyst";
import { normalizeEvidenceItems, normalizeEvidenceLabels } from "./candidate360Evidence";

const sourceTypes = new Set(["candidate_field", "parsed_resume", "employment", "project", "job_requirement", "recruiter_note"]);
export class HiringAnalystRequestError extends Error { constructor(message: string, public readonly kind: "server" | "malformed" | "network" | "timeout") { super(message); this.name = "HiringAnalystRequestError"; } }
export type HiringAnalystRequest = { candidateId: string; jobId?: string; job?: Record<string, unknown> | null; question: string; timeoutMs?: number; fetchImpl?: typeof fetch };

export function isSubmitKey(key: string, shiftKey: boolean) { return key === "Enter" && !shiftKey; }
export function canSubmitHiringAnalyst(question: string, loading: boolean) { return Boolean(question.trim()) && !loading; }

export function parseHiringAnalystAnswer(value: unknown): HiringAnalystAnswer {
  if (!value || typeof value !== "object") throw new HiringAnalystRequestError("The analyst returned an invalid response.", "malformed");
  const record = value as Record<string, unknown>;
  if (typeof record.answer !== "string" || !record.answer.trim() || !(record.confidence === null || typeof record.confidence === "number") || !Array.isArray(record.evidence) || !Array.isArray(record.missingEvidence) || !(record.nextAction === null || typeof record.nextAction === "string")) throw new HiringAnalystRequestError("The analyst returned an invalid response.", "malformed");
  const evidence = record.evidence.map((item) => {
    if (!item || typeof item !== "object") throw new HiringAnalystRequestError("The analyst returned malformed evidence.", "malformed");
    const evidenceRecord = item as Record<string, unknown>;
    if (typeof evidenceRecord.label !== "string" || typeof evidenceRecord.sourceType !== "string" || !sourceTypes.has(evidenceRecord.sourceType)) throw new HiringAnalystRequestError("The analyst returned malformed evidence.", "malformed");
    return { label: evidenceRecord.label, ...(typeof evidenceRecord.value === "string" ? { value: evidenceRecord.value } : {}), sourceType: evidenceRecord.sourceType as HiringAnalystAnswer["evidence"][number]["sourceType"], ...(typeof evidenceRecord.sourceRef === "string" ? { sourceRef: evidenceRecord.sourceRef } : {}) };
  });
  if (!record.missingEvidence.every((item) => typeof item === "string")) throw new HiringAnalystRequestError("The analyst returned malformed missing-evidence data.", "malformed");
  return { answer: record.answer.trim(), confidence: record.confidence === null ? null : Math.max(0, Math.min(100, Math.round(record.confidence as number))), evidence: normalizeEvidenceItems(evidence), missingEvidence: normalizeEvidenceLabels(record.missingEvidence as string[]), nextAction: typeof record.nextAction === "string" ? record.nextAction.trim() || null : null };
}

export async function requestHiringAnalystAnswer(input: HiringAnalystRequest): Promise<HiringAnalystAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 20000);
  try {
    const response = await (input.fetchImpl || fetch)(`/api/candidate360/${encodeURIComponent(input.candidateId)}/analyst`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: input.candidateId, ...(input.jobId ? { jobId: input.jobId } : {}), ...(input.job ? { job: input.job } : {}), question: input.question.trim() }), signal: controller.signal });
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new HiringAnalystRequestError("The analyst returned a response that could not be read.", "malformed"); }
    if (!response.ok) { const message = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string" ? String((payload as Record<string, unknown>).error) : `The analyst request failed (${response.status}).`; throw new HiringAnalystRequestError(message, "server"); }
    return parseHiringAnalystAnswer(payload);
  } catch (error) {
    if (error instanceof HiringAnalystRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new HiringAnalystRequestError("The analyst request timed out. Please retry.", "timeout");
    throw new HiringAnalystRequestError("Unable to reach the analyst. Check the network connection and retry.", "network");
  } finally { clearTimeout(timeout); }
}
