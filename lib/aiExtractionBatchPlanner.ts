import fs from "node:fs";
import path from "node:path";
import { buildApplyHistory, type ApplyHistoryReport } from "./aiExtractionApplyHistory";
import { buildBatchSummary } from "./aiExtractionBatchSummary";
import { parseTargetFields, validateBatchGuardrails, type BatchProviderMode, type BatchTargetField } from "./aiExtractionBatchGuardrails";
import { selectBatchCandidates, type BatchCandidateSelection } from "./aiExtractionBatchSelector";

export type AiExtractionBatchPlanOptions = {
  batchSize?: number;
  targetFields?: string[];
  provider?: BatchProviderMode;
  maxAiCalls?: number;
  confirmOpenAi?: boolean;
  includeMustRepair?: boolean;
  validationQueueOnly?: boolean;
  highConfidenceOnly?: boolean;
  reviewPath?: string;
  stagingPath?: string;
  aiResultsPath?: string;
  applyHistoryPath?: string;
};

export type AiExtractionBatchPlan = {
  generatedAt: string;
  mode: string;
  providerMode: BatchProviderMode;
  targetFields: BatchTargetField[];
  selectedCandidates: BatchCandidateSelection[];
  excludedCandidates: BatchCandidateSelection[];
  summary: ReturnType<typeof buildBatchSummary>;
  guardrails: ReturnType<typeof validateBatchGuardrails>;
  files: Record<string, { path: string; found: boolean }>;
};

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null };
  return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) };
}

export function buildAiExtractionBatchPlan(candidates: Record<string, any>[], options: AiExtractionBatchPlanOptions = {}, applyHistory?: ApplyHistoryReport | null): AiExtractionBatchPlan {
  const targetFieldNames = options.targetFields?.length ? options.targetFields : parseTargetFields();
  const guardrails = validateBatchGuardrails({ batchSize: options.batchSize, targetFields: targetFieldNames, provider: options.provider || "mock", maxAiCalls: options.maxAiCalls, confirmOpenAi: options.confirmOpenAi });
  const reviewPath = options.reviewPath || path.join("reports", "ai-extraction-review.json");
  const stagingPath = options.stagingPath || path.join("reports", "ai-extraction-staging.json");
  const aiResultsPath = options.aiResultsPath || path.join("reports", "background-ai-extraction-results.json");
  const applyHistoryPath = options.applyHistoryPath || path.join("reports", "candidate-apply-history.json");
  const review = readJson(reviewPath);
  const staging = readJson(stagingPath);
  const aiResults = readJson(aiResultsPath);
  const history = applyHistory || buildApplyHistory(candidates, { stagingPath });
  const selection = guardrails.ok ? selectBatchCandidates(candidates, { targetFields: guardrails.targetFields, batchSize: guardrails.batchSize, includeMustRepair: options.includeMustRepair, validationQueueOnly: options.validationQueueOnly, highConfidenceOnly: options.highConfidenceOnly, applyHistory: history, reviewReport: review.data, stagingReport: staging.data, aiResults: aiResults.data }) : { selected: [], excluded: [], candidatesNeedingAiReview: 0 };
  const estimatedAiCalls = selection.selected.length;
  return {
    generatedAt: new Date().toISOString(),
    mode: "batch planning only; no candidate DB writes; no apply; no rollback; no delete; no OpenAI calls by default",
    providerMode: guardrails.provider,
    targetFields: guardrails.targetFields,
    selectedCandidates: selection.selected,
    excludedCandidates: selection.excluded,
    summary: buildBatchSummary({ totalCandidates: candidates.length, candidatesNeedingAiReview: selection.candidatesNeedingAiReview, eligibleCandidates: selection.selected.length, excludedCandidates: selection.excluded.length, selectedBatchSize: guardrails.batchSize, fieldsTargeted: guardrails.targetFields, estimatedAiCalls, providerMode: guardrails.provider, safetyStatus: guardrails.safetyStatus, warnings: guardrails.warnings, errors: guardrails.errors }),
    guardrails,
    files: { review: { path: reviewPath, found: review.found }, staging: { path: stagingPath, found: staging.found }, aiResults: { path: aiResultsPath, found: aiResults.found }, applyHistory: { path: applyHistoryPath, found: fs.existsSync(path.resolve(applyHistoryPath)) } },
  };
}

export function writeAiExtractionBatchPlan(plan: AiExtractionBatchPlan, outputPath = path.join("reports", "ai-extraction-batch-plan.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(plan, null, 2)}\n`);
  return fullPath;
}

export function loadAiExtractionBatchPlan(planPath = path.join("reports", "ai-extraction-batch-plan.json")): AiExtractionBatchPlan | null {
  const fullPath = path.resolve(planPath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}