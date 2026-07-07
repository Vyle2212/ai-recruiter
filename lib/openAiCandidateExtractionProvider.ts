import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { field, type AiExtractionProvider, type AnyRecord, type RawAiCandidateExtraction } from "./cvExtractionSchema";

export const AI_EXTRACTION_PROMPT_VERSION = "primus-ai-cv-extraction-v3.1";
export const AI_EXTRACTION_CACHE_DIR = path.join("reports", "ai-extraction-cache");

function clean(value: any) { return String(value || "").replace(/\s+/g, " ").trim(); }
function candidateId(candidate: AnyRecord) { return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown"); }
export function hashRawText(rawText: string) { return crypto.createHash("sha256").update(rawText || "").digest("hex"); }
export function buildAiExtractionCacheKey(candidate: AnyRecord, rawText: string, model: string, promptVersion = AI_EXTRACTION_PROMPT_VERSION) {
  const id = candidateId(candidate).replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "unknown";
  return `${id}_${model.replace(/[^a-zA-Z0-9_.-]+/g, "_")}_${promptVersion}_${hashRawText(rawText).slice(0, 16)}.json`;
}
function cachePath(candidate: AnyRecord, rawText: string, model: string) { return path.join(process.cwd(), AI_EXTRACTION_CACHE_DIR, buildAiExtractionCacheKey(candidate, rawText, model)); }
function isCacheEnabled() { return process.env.AI_EXTRACTION_CACHE_ENABLED !== "false"; }
function forceRefresh() { return process.env.AI_EXTRACTION_FORCE_REFRESH === "true"; }
function emptyField(sourceSection = "", evidence = "") { return field<string>(null, 0, sourceSection, evidence); }

export function emptyRawAiExtraction(rawTextQuality = ""): RawAiCandidateExtraction {
  return {
    identity: { fullName: emptyField(), alternateNames: [] },
    contact: { email: emptyField(), phone: emptyField(), linkedInUrl: emptyField() },
    location: { city: emptyField(), country: emptyField() },
    role: { currentTitle: emptyField(), seniorityLevel: "" },
    employer: { currentEmployer: field("Not disclosed", 40, "not_disclosed", ""), previousEmployer: emptyField(), employerHistory: [] },
    clientProjects: { clientCompanies: [], projectCompanies: [], projectHistory: [], clientVsEmployerDecision: "", clientVsEmployerEvidence: "" },
    sap: { primarySapModule: emptyField(), secondarySapModules: [], sapModules: [], sapSkills: [], functionalSkills: [], technicalSkills: [], integrationSkills: [], businessProcesses: [], projectTypes: [], s4hanaEvidence: "", eccEvidence: "", riseEvidence: "" },
    experience: { totalYearsExperience: field<number>(null, 0, "", ""), sapYearsExperience: field<number>(null, 0, "", ""), implementationCount: 0, rolloutCount: 0, supportCount: 0, amsExperience: false, employmentHistory: [], projectHistory: [] },
    compensation: { currentSalary: emptyField(), expectedSalary: emptyField(), salaryCurrency: "", salaryPeriod: "", noticePeriod: emptyField(), availability: emptyField(), compensationEvidence: "" },
    quality: { extractionConfidenceOverall: 0, fieldCompletenessScore: 0, rawTextQuality, evidenceSummary: {} },
  };
}

function normalizeRawShape(value: any): RawAiCandidateExtraction {
  const base = emptyRawAiExtraction();
  return { ...base, ...value, identity: { ...base.identity, ...(value?.identity || {}) }, contact: { ...base.contact, ...(value?.contact || {}) }, location: { ...base.location, ...(value?.location || {}) }, role: { ...base.role, ...(value?.role || {}) }, employer: { ...base.employer, ...(value?.employer || {}) }, clientProjects: { ...base.clientProjects, ...(value?.clientProjects || {}) }, sap: { ...base.sap, ...(value?.sap || {}) }, experience: { ...base.experience, ...(value?.experience || {}) }, compensation: { ...base.compensation, ...(value?.compensation || {}) }, quality: { ...base.quality, ...(value?.quality || {}) } };
}

export function buildOpenAiCandidateExtractionPrompt(rawText: string, existingCandidateData: AnyRecord) {
  return [
    "You are extracting candidate profile information from CV text for PRIMUS AI Recruiter.",
    "Extract only facts explicitly present in the CV. Do not hallucinate.",
    "If a field is unclear, return null with confidence 0.",
    "Separate employer from client/project.",
    "Do not treat client/project as employer unless explicitly labelled employer/company/organization.",
    "Do not treat section headings, skills, tools, or SAP modules as names.",
    "Do not treat summary sentences as job titles.",
    "For every field, provide value, confidence, evidence, sourceSection, normalizedValue where useful, and rejectReason when invalid.",
    "Preserve exact evidence snippets from the CV.",
    "Return valid JSON only. No markdown.",
    "The JSON must match these top-level keys: identity, contact, location, role, employer, clientProjects, sap, experience, compensation, quality.",
    "Use Not disclosed for currentEmployer only when no explicit employer exists.",
    "Normalize SAP modules but keep evidence.",
    "",
    `Prompt version: ${AI_EXTRACTION_PROMPT_VERSION}`,
    `Existing candidate data: ${JSON.stringify(existingCandidateData).slice(0, 3500)}`,
    "",
    `CV text:\n${rawText.slice(0, 18000)}`,
  ].join("\n");
}

export function createOpenAiCandidateExtractionProvider(): AiExtractionProvider {
  const model = process.env.AI_EXTRACTION_MODEL || "gpt-4.1-mini";
  return {
    name: "openai-compatible",
    mode: "openai",
    model,
    async extractCandidateFromCv(rawText: string, existingCandidateData: AnyRecord) {
      const file = cachePath(existingCandidateData, rawText, model);
      if (isCacheEnabled() && !forceRefresh() && fs.existsSync(file)) {
        const cached = normalizeRawShape(JSON.parse(fs.readFileSync(file, "utf8")));
        cached.providerMeta = { mode: "openai", model, cacheHit: true, openAiExtractionUsed: true, fallbackParserUsed: false };
        return cached;
      }
      if (!process.env.OPENAI_API_KEY) {
        const missing = emptyRawAiExtraction("openai_api_key_missing");
        missing.providerMeta = { mode: "openai", model, cacheHit: false, openAiExtractionUsed: false, fallbackParserUsed: true, error: "OPENAI_API_KEY missing" };
        return missing;
      }
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({ model, response_format: { type: "json_object" }, messages: [{ role: "user", content: buildOpenAiCandidateExtractionPrompt(rawText, existingCandidateData) }], temperature: 0 });
      const parsed = normalizeRawShape(JSON.parse(response.choices[0]?.message?.content || "{}"));
      parsed.providerMeta = { mode: "openai", model, cacheHit: false, openAiExtractionUsed: true, fallbackParserUsed: false };
      if (isCacheEnabled()) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(parsed, null, 2)); }
      return parsed;
    },
  };
}
