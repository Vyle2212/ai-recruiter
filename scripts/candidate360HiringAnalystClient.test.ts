import assert from "node:assert/strict";
import { canSubmitHiringAnalyst, HiringAnalystRequestError, isSubmitKey, parseHiringAnalystAnswer, requestHiringAnalystAnswer } from "../lib/candidate360HiringAnalystClient";

async function main() {
const valid = { answer: "Evidence-backed answer.", confidence: 88, evidence: [{ label: "FICO", sourceType: "candidate_field", sourceRef: "internal.ref" }], missingEvidence: ["education", "Education", "certification"], nextAction: "Validate ownership." };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

assert.equal(isSubmitKey("Enter", false), true, "Enter submits");
assert.equal(isSubmitKey("Enter", true), false, "Shift+Enter creates a newline");
assert.equal(canSubmitHiringAnalyst("", false), false, "empty input is blocked");
assert.equal(canSubmitHiringAnalyst("  ", false), false, "whitespace input is blocked");
assert.equal(canSubmitHiringAnalyst("Question", true), false, "loading blocks duplicate submissions");
assert.equal(canSubmitHiringAnalyst("Question", false), true, "custom text can submit");

let capturedUrl = ""; let capturedBody: Record<string, unknown> = {};
const successful = await requestHiringAnalystAnswer({ candidateId: "candidate 1", jobId: "job-1", job: { id: "job-1", title: "SAP Lead" }, question: " Custom question? ", fetchImpl: async (url, init) => { capturedUrl = String(url); capturedBody = JSON.parse(String(init?.body)); return response(valid); } });
assert.equal(capturedUrl, "/api/candidate360/candidate%201/analyst");
assert.deepEqual(capturedBody, { candidateId: "candidate 1", jobId: "job-1", job: { id: "job-1", title: "SAP Lead" }, question: "Custom question?" });
assert.equal(successful.answer, valid.answer);
assert.equal(successful.confidence, 88);
assert.equal(successful.evidence[0].label, "FICO");
assert.deepEqual(successful.missingEvidence, ["Education", "Certifications"], "evidence aliases are deduplicated");

const insufficient = parseHiringAnalystAnswer({ answer: "Insufficient evidence found in the source profile.", confidence: null, evidence: [], missingEvidence: ["leadership", "leadership ownership"], nextAction: "Validate leadership ownership." });
assert.equal(insufficient.confidence, null);
assert.deepEqual(insufficient.missingEvidence, ["Leadership ownership"]);

await assert.rejects(() => requestHiringAnalystAnswer({ candidateId: "c1", question: "Question", fetchImpl: async () => response({ error: "Server failed" }, 500) }), (error: unknown) => error instanceof HiringAnalystRequestError && error.kind === "server" && /Server failed/.test(error.message));
await assert.rejects(() => requestHiringAnalystAnswer({ candidateId: "c1", question: "Question", fetchImpl: async () => response({ answer: "missing contract" }) }), (error: unknown) => error instanceof HiringAnalystRequestError && error.kind === "malformed");
await assert.rejects(() => requestHiringAnalystAnswer({ candidateId: "c1", question: "Question", fetchImpl: async () => { throw new TypeError("network"); } }), (error: unknown) => error instanceof HiringAnalystRequestError && error.kind === "network");
await assert.rejects(() => requestHiringAnalystAnswer({ candidateId: "c1", question: "Question", timeoutMs: 5, fetchImpl: async (_url, init) => await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))) ) }), (error: unknown) => error instanceof HiringAnalystRequestError && error.kind === "timeout");
let attempts = 0;
const retry = async () => requestHiringAnalystAnswer({ candidateId: "c1", question: "Retry question", fetchImpl: async () => { attempts += 1; if (attempts === 1) throw new TypeError("network"); return response(valid); } });
await assert.rejects(retry, HiringAnalystRequestError);
assert.equal((await retry()).answer, valid.answer);
assert.equal(attempts, 2, "retry uses the same request pipeline");
console.log("candidate360HiringAnalystClient tests passed");
}
void main();


