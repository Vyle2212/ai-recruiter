import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createMockAiExtractionProvider, fallbackAiExtractionProvider, getDefaultAiExtractionProvider } from "../lib/aiCandidateExtractionEngine";
import { filterAiExtractionCandidates, getAiExtractionSampleSize, parseAiExtractionArgs, requestedProviderMode } from "../lib/aiCandidateExtractionProvider";
import { AI_EXTRACTION_CACHE_DIR, buildAiExtractionCacheKey, createOpenAiCandidateExtractionProvider } from "../lib/openAiCandidateExtractionProvider";
import { field, type RawAiCandidateExtraction } from "../lib/cvExtractionSchema";

function candidate(id: string, raw = "Full Name: Priya Raman\nEmail: priya.raman@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP evidence") {
  return { id, name: "Candidate profile pending validation", raw_text: raw };
}

function rawExtraction(name = "Priya Raman"): RawAiCandidateExtraction {
  return {
    identity: { fullName: field(name, 96, "identity", `Full Name: ${name}`), alternateNames: [] },
    contact: { email: field("priya.raman@example.com", 95, "contact", "Email: priya.raman@example.com"), phone: field<string>(null, 0, "", ""), linkedInUrl: field<string>(null, 0, "", "") },
    location: { city: field<string>(null, 0, "", ""), country: field("Malaysia", 82, "contact", "Malaysia") },
    role: { currentTitle: field("SAP FICO Consultant", 92, "experience", "SAP FICO Consultant"), seniorityLevel: "consultant" },
    employer: { currentEmployer: field("Not disclosed", 60, "not_disclosed", ""), currentCompanyStartDate: field<string>(null, 0, "", ""), currentCompanyEndDate: field<string>(null, 0, "", ""), currentCompanyYearsExperience: field<number>(null, 0, "", ""), currentCompanyTenureText: field<string>(null, 0, "", ""), previousEmployer: field<string>(null, 0, "", ""), previousCompanyStartDate: field<string>(null, 0, "", ""), previousCompanyEndDate: field<string>(null, 0, "", ""), previousCompanyYearsExperience: field<number>(null, 0, "", ""), previousCompanyTenureText: field<string>(null, 0, "", ""), employerHistory: [] },
    clientProjects: { clientCompanies: [], projectCompanies: [], projectHistory: [], clientVsEmployerDecision: "", clientVsEmployerEvidence: "" },
    sap: { primarySapModule: field("FICO", 90, "skills", "SAP FICO Consultant"), secondarySapModules: [], sapModules: ["FICO"], sapSkills: ["S/4HANA"], functionalSkills: [], technicalSkills: [], integrationSkills: [], businessProcesses: [], projectTypes: ["Implementation"], s4hanaEvidence: "S/4HANA", eccEvidence: "", riseEvidence: "" },
    experience: { totalYearsExperience: field<number>(null, 0, "", ""), sapYearsExperience: field<number>(null, 0, "", ""), implementationCount: 1, rolloutCount: 0, supportCount: 1, amsExperience: false, employmentHistory: [], projectHistory: [] },
    compensation: { currentSalary: field<string>(null, 0, "", ""), expectedSalary: field<string>(null, 0, "", ""), salaryCurrency: "", salaryPeriod: "", noticePeriod: field<string>(null, 0, "", ""), availability: field<string>(null, 0, "", ""), compensationEvidence: "" },
    quality: { extractionConfidenceOverall: 88, fieldCompletenessScore: 80, rawTextQuality: "", evidenceSummary: {} },
  };
}

async function main() {
const oldProvider = process.env.AI_EXTRACTION_PROVIDER;
const oldKey = process.env.OPENAI_API_KEY;
const oldModel = process.env.AI_EXTRACTION_MODEL;
const oldCache = process.env.AI_EXTRACTION_CACHE_ENABLED;
try {
  delete process.env.AI_EXTRACTION_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  assert.equal(requestedProviderMode({}), "fallback", "fallback selected without provider env");
  assert.equal(getDefaultAiExtractionProvider().mode, "fallback", "default provider is fallback without key");

  process.env.AI_EXTRACTION_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-key-not-used-with-cache";
  process.env.AI_EXTRACTION_MODEL = "test-model";
  assert.equal(requestedProviderMode({}), "openai", "openai mode selected when env vars exist");
  assert.equal(getDefaultAiExtractionProvider().mode, "openai", "default provider becomes openai with env vars");

  const key = buildAiExtractionCacheKey(candidate("cache-1"), candidate("cache-1").raw_text, "test-model");
  const fallbackKey = buildAiExtractionCacheKey(candidate("cache-1"), candidate("cache-1").raw_text, "test-model", undefined, "fallback");
  assert.equal(key.includes("cache-1"), true, "cache key includes candidate id");
  assert.equal(key.includes("test-model"), true, "cache key includes model");
  assert.notEqual(key, fallbackKey, "fallback cache key is not reused for OpenAI provider");

  const cacheDir = path.join(process.cwd(), AI_EXTRACTION_CACHE_DIR);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, key);
  const openAiCached = rawExtraction("Priya Raman");
  openAiCached.providerMeta = { mode: "openai", providerUsed: "openai", model: "test-model", cacheHit: false, fallbackParserUsed: false, openAiExtractionUsed: true, openAiRequestAttempted: true, openAiRequestSucceeded: true };
  fs.writeFileSync(cacheFile, JSON.stringify(openAiCached, null, 2));
  const provider = createOpenAiCandidateExtractionProvider();
  const cached = await provider.extractCandidateFromCv(candidate("cache-1").raw_text, candidate("cache-1"));
  assert.equal(cached.identity.fullName.value, "Priya Raman", "cache hit returns cached extraction");
  assert.equal(cached.providerMeta?.cacheHit, true, "cache hit is recorded");
  assert.equal(cached.providerMeta?.providerUsed, "openai", "OpenAI cache hit records provider used");
  if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);

  const selected = filterAiExtractionCandidates([candidate("1"), candidate("2"), candidate("3")], { limit: 2 }, "openai");
  assert.equal(selected.length, 2, "sample limit is applied");
  assert.equal(getAiExtractionSampleSize({ sampleSize: 7 }), 7, "sample size option is honored");

  const mock = createMockAiExtractionProvider(rawExtraction());
  const mockRaw = await mock.extractCandidateFromCv("", {});
  assert.equal(mockRaw.providerMeta?.mode, "mock", "mock provider records mode");

  const fallbackRaw = await fallbackAiExtractionProvider.extractCandidateFromCv("", candidate("fallback"));
  assert.equal(fallbackRaw.providerMeta?.fallbackParserUsed, true, "fallback provider records fallback usage");

  const parsed = parseAiExtractionArgs(["--onlyBlockedIdentity", "--limit=30", "--candidateIds=a,b", "--noFallbackOnError"]);
  assert.equal(parsed.onlyBlockedIdentity, true, "CLI blocked identity flag parses");
  assert.equal(parsed.limit, 30, "CLI limit parses");
  assert.deepEqual(parsed.candidateIds, ["a", "b"], "CLI candidate IDs parse");
  assert.equal(parsed.noFallbackOnError, true, "CLI noFallbackOnError flag parses");
} finally {
  if (oldProvider === undefined) delete process.env.AI_EXTRACTION_PROVIDER; else process.env.AI_EXTRACTION_PROVIDER = oldProvider;
  if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  if (oldModel === undefined) delete process.env.AI_EXTRACTION_MODEL; else process.env.AI_EXTRACTION_MODEL = oldModel;
  if (oldCache === undefined) delete process.env.AI_EXTRACTION_CACHE_ENABLED; else process.env.AI_EXTRACTION_CACHE_ENABLED = oldCache;
}

const sources = [
  fs.readFileSync(new URL("../lib/openAiCandidateExtractionProvider.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("../lib/aiCandidateExtractionProvider.ts", import.meta.url), "utf8"),
].join("\n");
assert.equal(/from\([^)]*\)\.update\(/.test(sources), false, "no DB update behavior");
assert.equal(/from\([^)]*\)\.insert\(/.test(sources), false, "no DB insert behavior");
assert.equal(/from\([^)]*\)\.delete\(/.test(sources), false, "no DB delete behavior");

console.log("OpenAI candidate extraction provider tests passed");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
