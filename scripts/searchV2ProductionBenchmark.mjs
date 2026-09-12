import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
const argument = process.argv.find((value) => value.startsWith("--base-url="));
const baseUrl =
  argument?.slice("--base-url=".length) || "http://127.0.0.1:3000";
const includeExternalCapability = process.argv.includes(
  "--include-external-capability",
);
const post = async (body) => {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/recruiter/search-v2`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return { ms: performance.now() - started, payload };
};
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const median = (values) => percentile(values, 0.5);
const primaryBase = {
  query:
    "Senior SAP FICO Consultant in Malaysia with Mandarin and at least 8 years of experience",
  mode: "hybrid",
  page: 1,
  pageSize: 20,
  matchQuality: "relevant",
  talentPool: "internal_profiles",
  filters: { deliveryExperience: ["Implementation"] },
};
await post({
  ...primaryBase,
  criteria: [
    {
      id: "warmup",
      label: "Production benchmark warmup",
      importance: "important",
      source: "filter",
    },
  ],
});
const warm = [];
for (let index = 0; index < 12; index++)
  warm.push(
    await post({
      ...primaryBase,
      criteria: [
        {
          id: `changed-${index}`,
          label: `Changed semantic criterion ${Date.now()} ${index}`,
          importance: "important",
          source: "filter",
        },
      ],
    }),
  );
const repeatedBody = {
  ...primaryBase,
  criteria: [
    {
      id: "repeat",
      label: "Repeated committed criterion",
      importance: "important",
      source: "filter",
    },
  ],
};
await post(repeatedBody);
const repeated = [];
for (let index = 0; index < 10; index++)
  repeated.push(await post(repeatedBody));
const pageOne = {
  query: "Consultant",
  mode: "hybrid",
  page: 1,
  pageSize: 5,
  matchQuality: "any",
  talentPool: "internal_profiles",
  filters: {},
  criteria: [],
};
const firstPage = await post(pageOne);
assert(firstPage.payload.summary.visibleTotal > 5);
const pagination = [];
for (let index = 0; index < 8; index++)
  pagination.push(await post({ ...pageOne, page: 2 }));
const zero = await post({
  query:
    "Senior SAP FICO Consultant in Antarctica with Mandarin and at least 40 years of experience",
  mode: "hybrid",
  page: 1,
  pageSize: 20,
  matchQuality: "relevant",
  talentPool: "internal_profiles",
  filters: {},
  criteria: [],
});
let linkedin = null;
if (includeExternalCapability) {
  const linkedinStarted = performance.now();
  const linkedinResponse = await fetch(`${baseUrl}/api/recruiter/search-v2`, {
    method: "GET",
    headers: { "x-search-v2-talent-pool": "linkedin_talent_pool" },
  });
  const linkedinPayload = await linkedinResponse.json();
  linkedin = {
    ms: performance.now() - linkedinStarted,
    payload: linkedinPayload,
    status: linkedinResponse.status,
  };
}
const result = {
  baseUrl,
  warm: {
    medianMs: +median(warm.map((item) => item.ms)).toFixed(1),
    p95Ms: +percentile(
      warm.map((item) => item.ms),
      0.95,
    ).toFixed(1),
    hardFilterP95Ms: +percentile(
      warm.map((item) => item.payload.source.timing.retrievalFilter),
      0.95,
    ).toFixed(1),
  },
  repeated: {
    medianMs: +median(repeated.map((item) => item.ms)).toFixed(1),
    p95Ms: +percentile(
      repeated.map((item) => item.ms),
      0.95,
    ).toFixed(1),
  },
  pagination: {
    medianMs: +median(pagination.map((item) => item.ms)).toFixed(1),
    p95Ms: +percentile(
      pagination.map((item) => item.ms),
      0.95,
    ).toFixed(1),
  },
  zero: {
    ms: +zero.ms.toFixed(1),
    requirementGroups:
      zero.payload.rejectionSummary?.requirements?.length ??
      zero.payload.eligibilityDiagnostic?.funnel?.length ??
      0,
  },
  linkedin: linkedin
    ? {
        ms: +linkedin.ms.toFixed(1),
        status: linkedin.status,
        reason: linkedin.payload.reason,
      }
    : { skipped: true },
};
console.log(JSON.stringify(result));
assert(result.warm.medianMs <= 750);
assert(result.warm.p95Ms <= 1000);
assert(result.warm.hardFilterP95Ms <= 500);
assert(result.repeated.p95Ms <= 100);
assert(result.pagination.p95Ms <= 250);
if (linkedin) {
  assert.equal(result.linkedin.status, 200);
  assert.equal(linkedin.payload.talentPool, "linkedin_talent_pool");
}
