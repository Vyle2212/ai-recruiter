import assert from "node:assert/strict";
import { ExternalSourceError, decodeExternalProviderCursor, encodeExternalProviderCursor, linkedinSourceCapability, linkedinSourcingProvider, mapSearchV2ToExternalProvider, setLinkedInSourcingProviderForTests, validatedProviderProfileUrl, type ExternalCandidateSourceProvider } from "../lib/externalCandidateSourceProvider";
import { readFileSync } from "node:fs";
import { ExaPeopleSearchProvider } from "../lib/exaPeopleSearchProvider";

async function main() {
  const previousExternalEnabled = process.env.EXTERNAL_TALENT_SEARCH_ENABLED;
  const previousExternalProvider = process.env.EXTERNAL_TALENT_PROVIDER;
  const previousExaKey = process.env.EXA_API_KEY;
  const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
  process.env.EXTERNAL_TALENT_SEARCH_ENABLED = "true";
  process.env.EXTERNAL_TALENT_PROVIDER = "exa";
  process.env.EXA_API_KEY = "capability-only-test-key";
  process.env.ANTHROPIC_API_KEY = "capability-only-test-key";
  const concreteExa = new ExaPeopleSearchProvider();
  assert.equal(
    (await concreteExa.capability()).pagination,
    "none",
    "the concrete adapter must not advertise a cursor absent from Exa POST /search",
  );
  await assert.rejects(
    () =>
      concreteExa.search({
        source: "linkedin_talent_pool",
        committedSearchId: "no-live-request",
        query: "SAP FICO",
        filters: {},
        pageSize: 50,
        providerCursor: "unsupported-cursor",
      }),
    (error: unknown) =>
      error instanceof ExternalSourceError &&
      error.code === "INVALID_PROVIDER_CURSOR",
  );
  if (previousExternalEnabled === undefined)
    delete process.env.EXTERNAL_TALENT_SEARCH_ENABLED;
  else process.env.EXTERNAL_TALENT_SEARCH_ENABLED = previousExternalEnabled;
  if (previousExternalProvider === undefined)
    delete process.env.EXTERNAL_TALENT_PROVIDER;
  else process.env.EXTERNAL_TALENT_PROVIDER = previousExternalProvider;
  if (previousExaKey === undefined) delete process.env.EXA_API_KEY;
  else process.env.EXA_API_KEY = previousExaKey;
  if (previousAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
  setLinkedInSourcingProviderForTests(null);
  const unavailable = await linkedinSourceCapability();
  assert.equal(unavailable.reason, "SOURCE_NOT_CONNECTED");
  assert.equal(unavailable.connected, false);
  await assert.rejects(() => linkedinSourcingProvider().search({ source: "linkedin_talent_pool", committedSearchId: "s", query: "SAP", filters: {}, pageSize: 20 }), (error: unknown) => error instanceof ExternalSourceError && error.code === "SOURCE_NOT_CONNECTED");
  const calls: unknown[] = [];
  const provider: ExternalCandidateSourceProvider = {
    source: "linkedin_talent_pool",
    async capability() { return { source: "linkedin_talent_pool", providerId: "authorized-sandbox", providerName: "Authorized sandbox", connected: true, ready: true, status: "ready", reason: null, authentication: "valid", supportedFilters: ["query", "locations", "skills"], supportsCandidateDetails: true, supportsImport: true, pagination: "cursor", sandboxAvailable: true }; },
    async search(request) { calls.push(request); return { sourceRequestId: "provider-request-1", nextCursor: "provider-next", candidates: [{ source: "linkedin_talent_pool", externalCandidateId: "external-1", displayName: "Provider candidate", profileUrl: "https://www.linkedin.com/in/provider-returned", providerEvidence: [] }] }; },
  };
  setLinkedInSourcingProviderForTests(provider);
  const capability = await linkedinSourceCapability();
  const mapped = mapSearchV2ToExternalProvider({ query: "SAP FICO Malaysia", talentPool: "linkedin_talent_pool", filters: { locations: ["Malaysia"], sapModules: ["FICO"], languages: ["Mandarin"] } }, capability);
  assert.deepEqual(mapped.filters.locations, ["Malaysia"]);
  assert.deepEqual(mapped.filters.skills, ["FICO"]);
  assert.deepEqual(mapped.unsupportedRequiredFilters, ["languages"]);
  const response = await provider.search({ source: "linkedin_talent_pool", committedSearchId: "committed-1", query: "SAP", filters: mapped.filters, pageSize: 20 });
  assert.equal(calls.length, 1);
  assert.equal(response.candidates[0].source, "linkedin_talent_pool");
  assert.equal(validatedProviderProfileUrl(response.candidates[0]), "https://www.linkedin.com/in/provider-returned");
  assert.equal(validatedProviderProfileUrl({ ...response.candidates[0], profileUrl: "https://www.linkedin.com/company/example" }), null);
  const cursor = encodeExternalProviderCursor({ source: "linkedin_talent_pool", providerId: "authorized-sandbox", providerSearchIdentity: "provider-search", committedSearchId: "committed-1", providerCursor: "provider-next", rankingVersion: "rank-v1", evaluatedWindowIdentity: "window-1" });
  assert.equal(decodeExternalProviderCursor(cursor, { providerId: "authorized-sandbox", committedSearchId: "committed-1", rankingVersion: "rank-v1" }).providerCursor, "provider-next");
  assert.throws(() => decodeExternalProviderCursor(cursor, { providerId: "authorized-sandbox", committedSearchId: "different", rankingVersion: "rank-v1" }), (error: unknown) => error instanceof ExternalSourceError && error.code === "INVALID_PROVIDER_CURSOR");
  const routeSource = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
  assert.ok(routeSource.indexOf('if (body.talentPool === "linkedin_talent_pool")') < routeSource.indexOf("fetchCandidateSource();"), "external dispatch must happen before Internal dataset acquisition");
  const clientSource = readFileSync("app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx", "utf8");
  assert.match(clientSource, /External Talent Network.*Not configured/);
  assert.match(clientSource, /disabled=\{sourceCapabilities\?\.external_talent_network\.available===false\}/);
  setLinkedInSourcingProviderForTests(null);
  console.log("Search V2 external provider contract tests passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
