import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { classifyGuidedProviderError, guidedProviderConfigured, proposeGuidedSourcingPlan } from "../lib/guidedSourcingProvider";
import { validateGuidedSourcingPlan } from "../lib/guidedSourcingValidation";

assert.equal(classifyGuidedProviderError({ status: 401 }), "GUIDED_AUTH_FAILED");
assert.equal(classifyGuidedProviderError({ status: 403 }), "GUIDED_AUTH_FAILED");
assert.equal(classifyGuidedProviderError({ status: 429 }), "GUIDED_UPSTREAM_RATE_LIMITED");
assert.equal(classifyGuidedProviderError({ status: 404 }), "GUIDED_UPSTREAM_ERROR");
assert.equal(classifyGuidedProviderError({ status: 503 }), "GUIDED_UPSTREAM_ERROR");
assert.equal(classifyGuidedProviderError({ name: "AbortError" }), "GUIDED_REQUEST_ABORTED");
assert.equal(classifyGuidedProviderError({}, true), "GUIDED_UPSTREAM_TIMEOUT");

async function main() {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.equal(guidedProviderConfigured(), false);
  const started = performance.now();
  await assert.rejects(() => proposeGuidedSourcingPlan("SAP OTC consultant in Singapore."), (error: unknown) => (error as { code?: string }).code === "GUIDED_CONFIG_MISSING");
  assert(performance.now() - started < 1000, "missing configuration must fail immediately");
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  assert.equal(validateGuidedSourcingPlan({ candidateEvidence: [], rankings: [] }, "SAP OTC consultant in Singapore.").ok, false);

  const intentRoute = fs.readFileSync("app/api/recruiter/search-v2/guided-intent/route.ts", "utf8");
  const sourceRoute = fs.readFileSync("app/api/recruiter/search-v2/guided-source/route.ts", "utf8");
  const ui = fs.readFileSync("app/recruiter/talent-search/v2/GuidedSourcingPanel.tsx", "utf8");
  for (const code of ["GUIDED_CONFIG_MISSING", "GUIDED_AUTH_FAILED", "GUIDED_SOURCE_EMPTY", "GUIDED_UPSTREAM_TIMEOUT", "GUIDED_UPSTREAM_RATE_LIMITED", "GUIDED_UPSTREAM_ERROR", "GUIDED_RESPONSE_INVALID", "GUIDED_REQUEST_ABORTED", "GUIDED_INTERNAL_ERROR"]) assert.match(intentRoute, new RegExp(code));
  assert.match(sourceRoute, /GUIDED_FILE_EXTRACTION_FAILED/);
  assert.match(intentRoute, /auth;dur=/); assert.match(intentRoute, /provider;dur=/); assert.match(intentRoute, /normalization;dur=/);
  assert.match(sourceRoute, /source;dur=/);
  assert.match(ui, /Your selected job is preserved/); assert.match(ui, /Your uploaded JD is preserved/);
  assert.match(ui, /generating\.current/); assert.match(ui, /Retry generation/); assert.match(ui, /binding\.sourceId===activeSourceId/);
  console.log("guided sourcing runtime reason tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });