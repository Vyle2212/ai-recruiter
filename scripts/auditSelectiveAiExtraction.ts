import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildSelectiveAiExtractionQueue, type SelectiveAiExtractionReport } from "../lib/selectiveAiExtractionQueue";

export const SELECTIVE_AI_EXTRACTION_QUEUE_PATH = path.join("reports", "selective-ai-extraction-queue.json");

function short(value: any) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > 130 ? `${text.slice(0, 127)}...` : text;
}

function formatItem(item: any) {
  return `- ${item.candidateId}: ${short(item.displayName)} | ${short(item.title)} | ${short(item.primarySapModule)} | status=${item.extractionStatus} | reasons=${short(item.aiRecommendationReasons)} | confidence=${item.parserConfidence}`;
}

function formatNameEvidenceItem(item: any) {
  return `${formatItem(item)} | nameQualityLevel=${short(item.nameQualityLevel)} | nameSource=${short(item.nameSource)} | nameEvidence=${short(item.nameEvidence)} | identityQuality=${short(item.identityQualityReasons)}`;
}

export function writeSelectiveAiExtractionQueueReport(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), SELECTIVE_AI_EXTRACTION_QUEUE_PATH)) {
  const report = buildSelectiveAiExtractionQueue(candidates);
  const payload = { exportedAt: new Date().toISOString(), outputPath: SELECTIVE_AI_EXTRACTION_QUEUE_PATH, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return payload;
}

export function formatSelectiveAiExtractionAudit(report: SelectiveAiExtractionReport & { outputPath?: string }) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Selective AI Extraction Queue Audit v1",
    "==================================================",
    "",
    "Mode: read-only; no OpenAI calls; no Supabase update/insert/delete",
    `Queue export: ${report.outputPath || SELECTIVE_AI_EXTRACTION_QUEUE_PATH}`,
    `Confidence threshold: ${report.threshold}`,
    `Total candidates: ${s.totalCandidates}`,
    `Parser search-ready before identity quality gate: ${s.parserSearchReadyBeforeIdentityQualityGate}`,
    `Parser search-ready after identity quality gate: ${s.parserSearchReadyAfterIdentityQualityGate}`,
    `Parser search-ready without AI: ${s.parserSearchReadyWithoutAi}`,
    `Downgraded from parser-search-ready due to identity quality: ${s.downgradedFromParserSearchReadyDueToIdentityQuality}`,
    `AI recommended candidates: ${s.aiRecommendedCandidates}`,
    `AI recommended due to identity: ${s.aiRecommendedDueToIdentity}`,
    `AI recommended due to suspicious identity quality: ${s.aiRecommendedDueToSuspiciousIdentityQuality}`,
    `AI recommended due to weak name evidence: ${s.aiRecommendedDueToWeakNameEvidence}`,
    `AI recommended due to identity metadata in name: ${s.aiRecommendedDueToIdentityMetadataInName}`,
    `AI recommended due to OCR/joined name: ${s.aiRecommendedDueToOcrJoinedName}`,
    `AI recommended due to title: ${s.aiRecommendedDueToTitle}`,
    `AI recommended due to employer: ${s.aiRecommendedDueToEmployer}`,
    `AI recommended due to module mismatch: ${s.aiRecommendedDueToModuleMismatch}`,
    `AI recommended due to low confidence: ${s.aiRecommendedDueToLowConfidence}`,
    `Manual review required: ${s.manualReviewRequired}`,
    `Reupload required: ${s.reuploadRequired}`,
    `Estimated AI calls saved: ${s.estimatedAiCallsSaved}`,
    `Estimated AI cost reduction: ${s.estimatedAiCostReductionPercent}%`,
    "",
    "Top 30 AI Queue Examples",
  ];
  if (!report.examples.aiQueue.length) lines.push("- None");
  for (const item of report.examples.aiQueue) lines.push(formatNameEvidenceItem(item));
  lines.push("", "Top 30 Identity-quality Downgraded Examples");
  if (!report.examples.identityQualityDowngraded.length) lines.push("- None");
  for (const item of report.examples.identityQualityDowngraded) lines.push(formatNameEvidenceItem(item));
  lines.push("", "Top 30 Parser-search-ready Examples With Name Source/Evidence");
  if (!report.examples.parserSearchReadyWithNameEvidence.length) lines.push("- None");
  for (const item of report.examples.parserSearchReadyWithNameEvidence) lines.push(formatNameEvidenceItem(item));
  lines.push("", "Top 30 Parser-search-ready Examples");
  if (!report.examples.parserSearchReady.length) lines.push("- None");
  for (const item of report.examples.parserSearchReady) lines.push(formatItem(item));
  lines.push("", "Top 30 Reupload-required Examples");
  if (!report.examples.reuploadRequired.length) lines.push("- None");
  for (const item of report.examples.reuploadRequired) lines.push(formatItem(item));
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), SELECTIVE_AI_EXTRACTION_QUEUE_PATH);
  const report = writeSelectiveAiExtractionQueueReport(candidates, outputPath);
  console.log(formatSelectiveAiExtractionAudit(report));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditSelectiveAiExtraction.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
