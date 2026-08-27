import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { GUIDED_SOURCING_TIMEOUT_MS, guidedTimeoutFaultEnabled, proposeGuidedSourcingPlan } from "../lib/guidedSourcingProvider";

assert.equal(guidedTimeoutFaultEnabled({ AI_GUIDED_SOURCING_TEST_FAULT: "timeout", APP_ENV: "staging", VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv), true);
assert.equal(guidedTimeoutFaultEnabled({ AI_GUIDED_SOURCING_TEST_FAULT: "timeout", APP_ENV: "production" } as unknown as NodeJS.ProcessEnv), false);
assert.equal(guidedTimeoutFaultEnabled({ AI_GUIDED_SOURCING_TEST_FAULT: "timeout", APP_ENV: "staging", VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv), false);
assert.equal(guidedTimeoutFaultEnabled({ AI_GUIDED_SOURCING_TEST_FAULT: "timeout", APP_ENV: "staging", PRODUCTION_AUTH_ENABLED: "true" } as unknown as NodeJS.ProcessEnv), false);
assert.equal(guidedTimeoutFaultEnabled({ APP_ENV: "staging" } as unknown as NodeJS.ProcessEnv), false);

async function main() {
const previousKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "test-only-placeholder";
const previous = { fault: process.env.AI_GUIDED_SOURCING_TEST_FAULT, app: process.env.APP_ENV, vercel: process.env.VERCEL_ENV, productionAuth: process.env.PRODUCTION_AUTH_ENABLED };
process.env.AI_GUIDED_SOURCING_TEST_FAULT = "timeout";
process.env.APP_ENV = "staging";
process.env.VERCEL_ENV = "preview";
process.env.PRODUCTION_AUTH_ENABLED = "false";
const started = performance.now();
await assert.rejects(() => proposeGuidedSourcingPlan("SAP OTC consultant in Singapore."), (error: unknown) => (error as { code?: string }).code === "GUIDED_UPSTREAM_TIMEOUT");
const elapsed = performance.now() - started;
assert(elapsed >= GUIDED_SOURCING_TIMEOUT_MS - 250, `timeout fired too early: ${elapsed}`);
assert(elapsed < GUIDED_SOURCING_TIMEOUT_MS + 1500, `timeout fallback was too late: ${elapsed}`);
if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
for (const [key, value] of Object.entries(previous)) { const name = key === "fault" ? "AI_GUIDED_SOURCING_TEST_FAULT" : key === "app" ? "APP_ENV" : key === "vercel" ? "VERCEL_ENV" : "PRODUCTION_AUTH_ENABLED"; if (value === undefined) delete process.env[name]; else process.env[name] = value; }

const route = fs.readFileSync("app/api/recruiter/search-v2/guided-intent/route.ts", "utf8");
const ui = fs.readFileSync("app/recruiter/talent-search/v2/GuidedSourcingPanel.tsx", "utf8");
assert.match(route, /GUIDED_UPSTREAM_TIMEOUT/);
assert.match(route, /X-Guided-Intent-Reason/);
assert.match(route, /X-Guided-Intent-Fallback/);
assert.match(route, /Server-Timing/);
assert.match(ui, /value=\{pasteBrief\}/);
assert.doesNotMatch(ui, /setPasteBrief\(['"]['"]\)/);
assert.match(ui, /Use deterministic manual search/);
assert.match(ui, /binding\.requestId===latestRequest\.current/);
assert.match(ui, /binding\.sourceMode===modeRef\.current/);
console.log(`guided sourcing runtime timeout tests passed (${Math.round(elapsed)} ms)`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });