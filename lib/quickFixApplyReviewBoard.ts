import fs from "node:fs";
import path from "node:path";
import { summarizeQuickFixApplyReview } from "./quickFixApplyReviewSummary";
import type { QuickFixApplyReviewBoard, QuickFixApplyReviewItem } from "./quickFixApplyReviewTypes";
import { recommendQuickFixApplyDecision } from "./quickFixApplyReviewValidator";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null };
  try { return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) }; } catch { return { found: true, data: null }; }
}

function sourceFor(staging: any) {
  if (/quick fix/i.test(clean(staging.reviewerNote)) || /^quick_fix/i.test(clean(staging.sourceApprovalId))) return "quick_fix_repair";
  return clean(staging.reviewerNote) ? "approval evidence" : "staging evidence";
}

function isQuickFixStagingItem(item: any) {
  return clean(item.fieldName) === "currentCompany" && (clean(item.reviewerNote).includes("Quick fix repair") || clean(item.sourceApprovalId).includes("currentCompany"));
}

function buildItem(staging: any, apply: any): QuickFixApplyReviewItem {
  const recommendation = recommendQuickFixApplyDecision({
    fieldName: clean(staging.fieldName),
    suggestedValue: clean(staging.approvedValue),
    evidence: clean(staging.aiEvidence),
    confidence: Number(staging.aiConfidence || 0),
    eligible: Boolean(apply?.eligible),
    preserved: Boolean(apply?.preserved) || /preserved_already_applied/i.test(clean(apply?.applyStatus)),
    blocked: Boolean(apply?.blocked) || clean(staging.validationStatus) === "rejected",
    conflict: Boolean(apply?.conflict),
    reasons: [...(staging.validationReasons || []), ...(apply?.reasons || [])].map(clean).filter(Boolean),
  });
  const decision = recommendation.decision;
  return {
    reviewId: clean(staging.stagingId) || `${clean(staging.candidateId)}:${clean(staging.fieldName)}`,
    stagingId: clean(staging.stagingId),
    candidateId: clean(staging.candidateId),
    candidateName: clean(staging.candidateName) || clean(staging.candidateId),
    fieldName: clean(staging.fieldName),
    dbFieldName: clean(apply?.candidateField) || clean(staging.fieldName),
    currentDbValue: clean(apply?.currentDbValue),
    suggestedValue: clean(staging.approvedValue),
    evidenceSource: sourceFor(staging),
    evidenceSnippet: clean(staging.aiEvidence),
    confidence: Number(staging.aiConfidence || 0),
    riskLevel: clean(staging.riskLevel || "safe"),
    applyStatus: clean(apply?.applyStatus || staging.applyReadiness),
    eligible: Boolean(apply?.eligible),
    preserved: Boolean(apply?.preserved) || /preserved_already_applied/i.test(clean(apply?.applyStatus)),
    blocked: Boolean(apply?.blocked) || clean(staging.validationStatus) === "rejected",
    suspicious: recommendation.suspicious,
    cleanCompanyFix: recommendation.cleanCompanyFix,
    reviewRecommendation: recommendation.decision,
    decision,
    safetyReasons: recommendation.reasons,
    safetyNote: "APPLY REVIEW ONLY. This row does not update candidate records.",
    stagingItem: staging,
    applyPreviewItem: apply || null,
  };
}

export function buildQuickFixApplyReviewBoard(options: { stagingPath?: string; applyPreviewPath?: string } = {}): QuickFixApplyReviewBoard {
  const stagingPath = options.stagingPath || path.join("reports", "ai-extraction-staging.json");
  const applyPreviewPath = options.applyPreviewPath || path.join("reports", "candidate-apply-preview.json");
  const staging = readJson(stagingPath);
  const applyPreview = readJson(applyPreviewPath);
  const applyByStaging = new Map((Array.isArray(applyPreview.data?.items) ? applyPreview.data.items : []).map((item: any) => [clean(item.stagingId), item]));
  const stagedItems = (Array.isArray(staging.data?.items) ? staging.data.items : []).filter(isQuickFixStagingItem);
  const items = stagedItems.map((item: any) => buildItem(item, applyByStaging.get(clean(item.stagingId))));
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only apply review board; no candidate DB writes; no staging writes; no apply; no rollback; no delete; no OpenAI calls",
    summary: summarizeQuickFixApplyReview(items),
    items,
    files: {
      staging: { path: stagingPath, found: staging.found },
      applyPreview: { path: applyPreviewPath, found: applyPreview.found },
    },
  };
}

export function writeQuickFixApplyReviewBoard(board: QuickFixApplyReviewBoard, outputPath = path.join("reports", "quick-fix-apply-review-board.json")) {
  return writeWorkflowJson(outputPath, board);
}
