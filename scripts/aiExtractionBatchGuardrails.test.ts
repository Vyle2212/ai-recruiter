import assert from "node:assert/strict";
import fs from "node:fs";
import { validateBatchGuardrails } from "../lib/aiExtractionBatchGuardrails";

assert.equal(validateBatchGuardrails().batchSize, 10, "batch size default 10");
assert.equal(validateBatchGuardrails({ batchSize: 51 }).ok, false, "batch size > 50 rejected");
assert.equal(validateBatchGuardrails({ batchSize: 50 }).warnings.some((warning) => /50/.test(warning)), true, "batch size 50 warning");
assert.equal(validateBatchGuardrails({ targetFields: ["badField"] }).ok, false, "unsupported target field blocked");
assert.equal(validateBatchGuardrails({ provider: "openai", maxAiCalls: 2 }).ok, false, "provider openai rejected without confirmOpenAi");
assert.equal(validateBatchGuardrails({ provider: "openai", confirmOpenAi: true }).ok, false, "provider openai rejected without maxAiCalls");
assert.equal(validateBatchGuardrails({ provider: "mock" }).ok, true, "mock provider works without OpenAI");

const source = fs.readFileSync(new URL("../lib/aiExtractionBatchGuardrails.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source), false, "guardrails have no DB writes");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "guardrails do not call OpenAI");

console.log("AI extraction batch guardrails tests passed");