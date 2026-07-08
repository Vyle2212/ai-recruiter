import { auditFullCandidateExtraction } from "./fullCandidateExtractionEngine";
import { createOpenAiCandidateExtractionProvider } from "./openAiCandidateExtractionProvider";
import type { AiExtractionProvider, AnyRecord } from "./cvExtractionSchema";

export type AiExtractionRunOptions = {
  providerMode?: "mock" | "fallback" | "openai";
  sampleSize?: number;
  limit?: number;
  candidateIds?: string[];
  onlyBlockedIdentity?: boolean;
  onlyParserRecoverable?: boolean;
  noFallbackOnError?: boolean;
};

function clean(value: any) { return String(value || "").replace(/\s+/g, " ").trim(); }
export function candidateId(candidate: AnyRecord) { return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown"); }

export function parseAiExtractionArgs(argv = process.argv.slice(2)): AiExtractionRunOptions {
  const out: AiExtractionRunOptions = {};
  for (const arg of argv) {
    if (arg.startsWith("--sampleSize=")) out.sampleSize = Number(arg.split("=")[1]);
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.split("=")[1]);
    else if (arg.startsWith("--candidateIds=")) out.candidateIds = arg.split("=")[1].split(",").map(clean).filter(Boolean);
    else if (arg === "--onlyBlockedIdentity") out.onlyBlockedIdentity = true;
    else if (arg === "--onlyParserRecoverable") out.onlyParserRecoverable = true;
    else if (arg === "--noFallbackOnError") out.noFallbackOnError = true;
    else if (arg.startsWith("--provider=")) out.providerMode = arg.split("=")[1] as AiExtractionRunOptions["providerMode"];
  }
  return out;
}

export function openAiProviderEnabled(options: AiExtractionRunOptions = {}) {
  return (options.providerMode || process.env.AI_EXTRACTION_PROVIDER) === "openai" && Boolean(process.env.OPENAI_API_KEY);
}

export function requestedProviderMode(options: AiExtractionRunOptions = {}) {
  if ((options.providerMode || process.env.AI_EXTRACTION_PROVIDER) === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if ((options.providerMode || process.env.AI_EXTRACTION_PROVIDER) === "mock") return "mock";
  return "fallback";
}

export function getAiExtractionSampleSize(options: AiExtractionRunOptions = {}) {
  return Math.max(1, Number(options.limit || options.sampleSize || process.env.AI_EXTRACTION_SAMPLE_SIZE || 30));
}

export function getAiExtractionConcurrency() {
  return Math.max(1, Number(process.env.AI_EXTRACTION_MAX_CONCURRENCY || 2));
}

export function selectAiExtractionProvider(fallbackProvider: AiExtractionProvider, options: AiExtractionRunOptions = {}) {
  if (requestedProviderMode(options) === "openai") return createOpenAiCandidateExtractionProvider();
  return fallbackProvider;
}

export function filterAiExtractionCandidates(candidates: AnyRecord[], options: AiExtractionRunOptions = {}, providerMode = requestedProviderMode(options)) {
  let selected = candidates.slice();
  if (options.candidateIds?.length) {
    const ids = new Set(options.candidateIds);
    selected = selected.filter((candidate) => ids.has(candidateId(candidate)));
  }
  if (options.onlyBlockedIdentity || options.onlyParserRecoverable) {
    const report = auditFullCandidateExtraction(selected);
    const allowed = new Set(report.items.filter((item) => {
      if (options.onlyBlockedIdentity && item.reviewClassification === "blocked_identity") return true;
      if (options.onlyParserRecoverable && item.reviewClassification === "parser_recoverable") return true;
      return false;
    }).map((item) => item.candidateId));
    selected = selected.filter((candidate) => allowed.has(candidateId(candidate)));
  }
  const explicitLimit = Boolean(options.limit || options.sampleSize || options.candidateIds?.length);
  if (providerMode === "openai" && !explicitLimit) selected = selected.slice(0, getAiExtractionSampleSize(options));
  else if (options.limit || options.sampleSize) selected = selected.slice(0, getAiExtractionSampleSize(options));
  return selected;
}
