import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { field, type AiExtractionProvider, type AnyRecord, type RawAiCandidateExtraction } from "./cvExtractionSchema";

export const AI_EXTRACTION_PROMPT_VERSION = "primus-ai-cv-extraction-v3.3-employment-evidence";
export const AI_EXTRACTION_CACHE_DIR = path.join("reports", "ai-extraction-cache");

export class OpenAiExtractionError extends Error {
  errorType: string;
  constructor(errorType: string, message: string) {
    super(message);
    this.name = "OpenAiExtractionError";
    this.errorType = errorType;
  }
}

function clean(value: any) { return String(value || "").replace(/\s+/g, " ").trim(); }
function candidateId(candidate: AnyRecord) { return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown"); }
export function hashRawText(rawText: string) { return crypto.createHash("sha256").update(rawText || "").digest("hex"); }
export function buildAiExtractionCacheKey(candidate: AnyRecord, rawText: string, model: string, promptVersion = AI_EXTRACTION_PROMPT_VERSION, providerMode = "openai") {
  const id = candidateId(candidate).replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "unknown";
  const provider = providerMode.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return `${id}_${provider}_${model.replace(/[^a-zA-Z0-9_.-]+/g, "_")}_${promptVersion}_${hashRawText(rawText).slice(0, 16)}.json`;
}
function cachePath(candidate: AnyRecord, rawText: string, model: string, providerMode = "openai") { return path.join(process.cwd(), AI_EXTRACTION_CACHE_DIR, buildAiExtractionCacheKey(candidate, rawText, model, AI_EXTRACTION_PROMPT_VERSION, providerMode)); }
function isCacheEnabled() { return process.env.AI_EXTRACTION_CACHE_ENABLED !== "false"; }
function forceRefresh() { return process.env.AI_EXTRACTION_FORCE_REFRESH === "true"; }
function emptyField(sourceSection = "", evidence = "") { return field<string>(null, 0, sourceSection, evidence); }

export function emptyRawAiExtraction(rawTextQuality = ""): RawAiCandidateExtraction {
  return {
    identity: { fullName: emptyField(), alternateNames: [] },
    contact: { email: emptyField(), phone: emptyField(), linkedInUrl: emptyField() },
    location: { city: emptyField(), country: emptyField() },
    role: { currentTitle: emptyField(), seniorityLevel: "" },
    employer: { currentEmployer: field("Not disclosed", 40, "not_disclosed", ""), currentCompanyStartDate: emptyField(), currentCompanyEndDate: emptyField(), currentCompanyYearsExperience: field<number>(null, 0, "", ""), currentCompanyTenureText: emptyField(), previousEmployer: emptyField(), previousCompanyStartDate: emptyField(), previousCompanyEndDate: emptyField(), previousCompanyYearsExperience: field<number>(null, 0, "", ""), previousCompanyTenureText: emptyField(), employerHistory: [] },
    clientProjects: { clientCompanies: [], projectCompanies: [], projectHistory: [], clientVsEmployerDecision: "", clientVsEmployerEvidence: "" },
    sap: { primarySapModule: emptyField(), secondarySapModules: [], sapModules: [], sapSkills: [], functionalSkills: [], technicalSkills: [], integrationSkills: [], businessProcesses: [], projectTypes: [], s4hanaEvidence: "", eccEvidence: "", riseEvidence: "" },
    experience: { totalYearsExperience: field<number>(null, 0, "", ""), sapYearsExperience: field<number>(null, 0, "", ""), implementationCount: 0, rolloutCount: 0, supportCount: 0, amsExperience: false, employmentHistory: [], projectHistory: [] },
    compensation: { currentSalary: emptyField(), expectedSalary: emptyField(), salaryCurrency: "", salaryPeriod: "", noticePeriod: emptyField(), availability: emptyField(), compensationEvidence: "" },
    quality: { extractionConfidenceOverall: 0, fieldCompletenessScore: 0, rawTextQuality, evidenceSummary: {} },
  };
}

function normalizeRawShape(value: any): RawAiCandidateExtraction {
  const base = emptyRawAiExtraction();
  return { ...base, ...value, identity: { ...base.identity, ...(value?.identity || {}) }, contact: { ...base.contact, ...(value?.contact || {}) }, location: { ...base.location, ...(value?.location || {}) }, role: { ...base.role, ...(value?.role || {}) }, employer: { ...base.employer, ...(value?.employer || {}) }, clientProjects: { ...base.clientProjects, ...(value?.clientProjects || {}) }, sap: { ...base.sap, ...(value?.sap || {}) }, experience: { ...base.experience, ...(value?.experience || {}) }, compensation: { ...base.compensation, ...(value?.compensation || {}) }, quality: { ...base.quality, ...(value?.quality || {}) }, providerMeta: value?.providerMeta };
}

export function sanitizeOpenAiError(error: unknown) {
  if (error instanceof OpenAiExtractionError) return { type: error.errorType, message: error.message };
  const raw = error instanceof Error ? error.message : String(error || "unknown_error");
  const message = raw.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 240);
  const lowered = message.toLowerCase();
  const type = lowered.includes("json") ? "invalid_json" : lowered.includes("api key") ? "missing_api_key" : "request_failed";
  return { type, message };
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
    "Each employmentHistory row must contain company, title, start, end, current, and evidence: an exact contiguous CV excerpt binding that employer, role and period. Preserve source date strings. Never invent labels or evidence; use null for missing fields.",
    "Return valid JSON only. No markdown.",
    "The JSON must match these top-level keys: identity, contact, location, role, employer, clientProjects, sap, experience, compensation, quality.",
    "Use Not disclosed for currentEmployer only when no explicit employer exists.",
    "Normalize SAP modules but keep evidence.",
    "",
    `Prompt version: ${AI_EXTRACTION_PROMPT_VERSION}`,
    `Existing candidate data: ${JSON.stringify(existingCandidateData).slice(0, 3500)}`,
    "",
    `CV text:\n${rawText}`,
  ].join("\n");
}

export function parseCompletedAiExtractionResponse(response: { choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }> }): RawAiCandidateExtraction {
  const choice = response.choices?.[0];
  if (choice?.message?.refusal) throw new OpenAiExtractionError("response_refused", "CV extraction response was refused");
  if (choice?.finish_reason !== "stop") throw new OpenAiExtractionError("incomplete_response", "CV extraction response did not finish normally");
  if (!choice.message?.content?.trim()) throw new OpenAiExtractionError("empty_response", "CV extraction returned no content");
  let value: any;
  try { value = JSON.parse(choice.message.content); }
  catch { throw new OpenAiExtractionError("invalid_json", "CV extraction returned invalid JSON"); }
  const sections = Object.keys(emptyRawAiExtraction());
  if (!value || typeof value !== "object" || Array.isArray(value) || sections.some(key => !value[key] || typeof value[key] !== "object" || Array.isArray(value[key]))) {
    throw new OpenAiExtractionError("invalid_shape", "CV extraction response is missing required sections");
  }
  return normalizeRawShape(value);
}

export function createOpenAiCandidateExtractionProvider(): AiExtractionProvider {
  const model = process.env.AI_EXTRACTION_MODEL || "gpt-4.1-mini";
  return {
    name: "openai-compatible",
    mode: "openai",
    model,
    async extractCandidateFromCv(rawText: string, existingCandidateData: AnyRecord) {
      const file = cachePath(existingCandidateData, rawText, model, "openai");
      if (isCacheEnabled() && !forceRefresh() && fs.existsSync(file)) {
        const cachedPayload = JSON.parse(fs.readFileSync(file, "utf8"));
        const cachedMeta = cachedPayload?.providerMeta || {};
        if ((cachedMeta.mode || cachedMeta.providerUsed) === "openai" && cachedMeta.model === model) {
          const cached = normalizeRawShape(cachedPayload);
          cached.providerMeta = { ...cached.providerMeta, mode: "openai", providerUsed: "openai", model, cacheHit: true, openAiExtractionUsed: true, fallbackParserUsed: false, openAiRequestAttempted: false, openAiRequestSucceeded: false };
          return cached;
        }
      }
      if (!process.env.OPENAI_API_KEY) throw new OpenAiExtractionError("missing_api_key", "OPENAI_API_KEY missing");
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({ model, response_format: { type: "json_object" }, messages: [{ role: "user", content: buildOpenAiCandidateExtractionPrompt(rawText, existingCandidateData) }], temperature: 0 });
      const parsed = parseCompletedAiExtractionResponse(response);
      parsed.providerMeta = { mode: "openai", providerUsed: "openai", model, cacheHit: false, openAiExtractionUsed: true, fallbackParserUsed: false, openAiRequestAttempted: true, openAiRequestSucceeded: true };
      if (isCacheEnabled()) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(parsed, null, 2)); }
      return parsed;
    },
  };
}
