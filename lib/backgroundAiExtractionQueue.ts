import { candidateRawCvText } from "./candidateReExtractionEngine";
import { buildExtractionDecisionLayer, ExtractionDecisionOptions } from "./extractionDecisionLayer";
import { buildIdentityEvidenceBlock } from "./rawIdentityEvidenceRecovery";

export type BackgroundAiQueueOptions = ExtractionDecisionOptions & {
  onlyDecisionAction?: string;
  candidateIds?: string[];
  aiResultsPath?: string;
  noOpenAI?: boolean;
  provider?: "openai" | "mock" | "fallback";
  maxAiCalls?: number;
  dryRun?: boolean;
  noApply?: boolean;
  exportOnly?: boolean;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value || "").replace(/\s+/g, " ").trim();
}

function rawHas(pattern: RegExp, raw: string) {
  return pattern.test(raw.slice(0, 8000));
}

function estimateCost(calls: number) {
  return Number((calls * 0.01).toFixed(2));
}

export function buildBackgroundAiExtractionQueue(candidates: Record<string, any>[], options: BackgroundAiQueueOptions = {}) {
  const decisionReport = buildExtractionDecisionLayer(candidates, options);
  const candidateIdFilter = new Set((options.candidateIds || []).map(clean).filter(Boolean));
  const selected = decisionReport.items.filter((item: any) => {
    if (candidateIdFilter.size && !candidateIdFilter.has(item.candidateId)) return false;
    const action = options.onlyDecisionAction || "send_to_ai_extraction_queue";
    return item.decisionAction === action;
  });
  const maxAiCalls = Number.isFinite(options.maxAiCalls) && Number(options.maxAiCalls) > 0 ? Number(options.maxAiCalls) : selected.length;
  const queueItems = selected.map((item: any, index: number) => {
    const candidate = candidates.find((row: any) => clean(row.id || row.candidate_id) === item.candidateId) || {};
    const rawText = candidateRawCvText(candidate);
    const hasNameEvidence = rawHas(/\b(?:name|full name|resume|curriculum vitae)\b|[A-Z][a-z]+\s+[A-Z][a-z]+/, rawText);
    const hasContactEvidence = rawHas(/@|email|phone|mobile|\+\d{2}/i, rawText);
    const hasSapEvidence = rawHas(/\bSAP\b|FICO|ABAP|MM|SD|BW|EWM|BTP|Basis|S\/4HANA/i, rawText);
    const aiEligible = Boolean(rawText && rawText.length >= 80 && hasSapEvidence && index < maxAiCalls);
    return {
      candidateId: item.candidateId,
      existingName: item.existing?.name,
      existingScore: item.existingScore?.score || 0,
      simulatedScore: item.simulatedScore?.score || 0,
      missingFields: Object.fromEntries(Object.entries(item.fieldIssues || {}).filter(([, issues]) => Array.isArray(issues) && issues.length)),
      conflicts: item.decisionReasons || [],
      reasonForAiQueue: item.decisionReasons?.join(", ") || "send_to_ai_extraction_queue",
      rawTextLength: rawText.length,
      rawTextAvailable: Boolean(rawText),
      hasNameEvidence,
      hasContactEvidence,
      hasSapEvidence,
      aiEligible,
      identityEvidenceBlock: buildIdentityEvidenceBlock(rawText),
      parserExtractedFields: item.simulated,
      decisionLayerReasons: item.decisionReasons || [],
    };
  });
  const count = (predicate: (item: any) => boolean) => queueItems.filter(predicate).length;
  const summary = {
    totalCandidatesChecked: decisionReport.summary.totalChecked,
    queueCandidates: queueItems.length,
    excludedKeepExistingRecord: decisionReport.summary.keepExistingRecord,
    excludedSafeToOverwriteLater: decisionReport.summary.safeToOverwriteLater,
    excludedManualReview: decisionReport.summary.requiresManualReview,
    excludedReuploadRequired: decisionReport.summary.requiresOriginalFileReupload,
    rawTextAvailable: count((item) => item.rawTextAvailable),
    rawTextMissing: count((item) => !item.rawTextAvailable),
    aiEligible: count((item) => item.aiEligible),
    aiNotEligible: count((item) => !item.aiEligible),
    estimatedAiCalls: count((item) => item.aiEligible),
    estimatedCostUsd: estimateCost(count((item) => item.aiEligible)),
  };
  return {
    mode: "read-only background AI queue audit; no DB writes; no deletes; no apply; no OpenAI calls unless runner explicitly enables provider=openai",
    options: { ...decisionReport.options, noOpenAI: options.noOpenAI !== false, provider: options.provider || "fallback", maxAiCalls },
    summary,
    queueItems,
    decisionSummary: decisionReport.summary,
  };
}
