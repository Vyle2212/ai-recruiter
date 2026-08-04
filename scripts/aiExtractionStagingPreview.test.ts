import assert from "node:assert/strict";
import fs from "node:fs";
import type { AiExtractionApproval } from "../lib/aiExtractionApprovalStore";
import { buildAiExtractionStagingPreview } from "../lib/aiExtractionStagingPreview";
import type { ReviewWorkspace, WorkspaceField } from "../lib/aiExtractionReviewUi";

function field(overrides: Partial<WorkspaceField>): WorkspaceField {
  return {
    field: "currentCompany",
    label: "Current employer",
    existingValue: "",
    parserValue: "Not disclosed",
    aiValue: "Accenture",
    confidence: 96,
    evidence: "Accenture Jan 2024 - Present",
    decision: "safe_accept",
    reason: "direct_evidence_and_high_confidence",
    statusLabel: "Safe to accept",
    statusTone: "safe",
    canApprove: true,
    requiresOverride: false,
    warning: "",
    ...overrides,
  };
}

const workspace: ReviewWorkspace = {
  mode: "test",
  exportedAt: new Date().toISOString(),
  reportStatus: { reviewReportFound: true, applyPlanFound: true, aiResultsFound: false, staleCache: false, errors: [] },
  summary: { totalQueued: 2, aiResultsAvailable: 1, safeFieldSuggestions: 1, riskySuggestions: 1, rejectedSuggestions: 1, manualReviewRequired: 1, potentialSearchReadyAfterApproval: 1, reuploadRequired: 1, missingAiResult: 0 },
  applyPlan: {},
  candidates: [
    {
      candidateId: "candidate-1",
      candidateName: "Jane Fico",
      currentScore: 60,
      searchReadyBefore: false,
      searchReadyAfterManualApprovals: true,
      decisionAction: "send_to_ai_extraction_queue",
      safeCount: 1,
      riskyCount: 1,
      rejectedCount: 1,
      missingBlockers: [],
      aiStatus: "AI result available",
      recommendedAction: "Review AI suggestions",
      stillBlocked: false,
      reuploadRequired: false,
      debug: {},
      fields: [
        field({ field: "currentCompany", label: "Current employer" }),
        field({ field: "displayName", label: "Full name", existingValue: "Jane Fico", aiValue: "SAP Consultant Jane Fico", decision: "reject", reason: "dirty_or_invalid_identity", canApprove: false, requiresOverride: true }),
        field({ field: "primarySapModule", label: "Primary SAP module", existingValue: "FICO", aiValue: "BASIS", decision: "conflict", reason: "module_conflicts_with_title", canApprove: false, requiresOverride: true }),
        field({ field: "title", label: "Current title", existingValue: "", aiValue: "SAP FICO Consultant", evidence: "", decision: "missing_evidence", reason: "no_direct_evidence", canApprove: false, requiresOverride: true }),
      ],
    },
    {
      candidateId: "candidate-reupload",
      candidateName: "Needs Reupload",
      currentScore: 10,
      searchReadyBefore: false,
      searchReadyAfterManualApprovals: false,
      decisionAction: "requires_original_file_reupload",
      safeCount: 0,
      riskyCount: 0,
      rejectedCount: 0,
      missingBlockers: [],
      aiStatus: "AI Missing",
      recommendedAction: "Reupload original CV",
      stillBlocked: true,
      reuploadRequired: true,
      debug: {},
      fields: [field({ field: "currentCompany", label: "Current employer" })],
    },
  ],
};

function approval(overrides: Partial<AiExtractionApproval>): AiExtractionApproval {
  return {
    approvalId: "candidate-1:currentCompany",
    candidateId: "candidate-1",
    fieldName: "currentCompany",
    currentValue: "",
    suggestedValue: "Accenture",
    parserValue: "Not disclosed",
    aiEvidence: "Accenture Jan 2024 - Present",
    aiConfidence: 96,
    decision: "approve_suggestion",
    riskLevel: "safe",
    reviewerNote: "",
    overrideReason: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const preview = buildAiExtractionStagingPreview(workspace, [approval({})]);
assert.equal(preview.approvalsRead, 1, "staging preview loads approvals");
assert.equal(preview.validStagingItems, 1, "staging preview accepts safe approved field");
assert.equal(preview.items[0].appliedToCandidate, false, "staged records include appliedToCandidate=false");

const rejected = buildAiExtractionStagingPreview(workspace, [
  approval({ approvalId: "", candidateId: "", fieldName: "" }),
  approval({ approvalId: "candidate-1:displayName", fieldName: "displayName", currentValue: "Jane Fico", suggestedValue: "SAP Consultant Jane Fico", riskLevel: "rejected" }),
  approval({ approvalId: "candidate-1:title", fieldName: "title", suggestedValue: "SAP FICO Consultant", aiEvidence: "", riskLevel: "safe" }),
  approval({ approvalId: "candidate-1:currentCompany", suggestedValue: "Project implementation role", riskLevel: "safe" }),
  approval({ approvalId: "candidate-1:primarySapModule", fieldName: "primarySapModule", currentValue: "FICO", suggestedValue: "BASIS", riskLevel: "conflict" }),
  approval({ approvalId: "candidate-reupload:currentCompany", candidateId: "candidate-reupload", fieldName: "currentCompany" }),
]);
assert.equal(rejected.rejectedStagingItems, 6, "staging preview rejects malformed and unsafe approvals");
assert.equal(rejected.rejectedItems.some((item) => item.validationReasons.join(" ").includes("rejected field requires manual override")), true, "rejects rejected field without override");
assert.equal(rejected.rejectedItems.some((item) => item.validationReasons.join(" ").includes("missing evidence requires manual override")), true, "rejects missing evidence without override");
assert.equal(rejected.rejectedItems.some((item) => item.validationReasons.join(" ").includes("dirty employer requires manual override")), true, "rejects dirty employer without override");
assert.equal(rejected.rejectedItems.some((item) => item.validationReasons.join(" ").includes("module conflict requires manual override")), true, "rejects module conflict without override");
assert.equal(rejected.rejectedItems.some((item) => item.validationReasons.join(" ").includes("candidate requires original file reupload")), true, "rejects candidate requiring reupload");

const manual = buildAiExtractionStagingPreview(workspace, [
  approval({ approvalId: "candidate-1:displayName", fieldName: "displayName", currentValue: "Jane Fico", suggestedValue: "SAP Consultant Jane Fico", decision: "manual_override_approve", riskLevel: "rejected", overrideReason: "Recruiter checked CV" }),
]);
assert.equal(manual.warnings, 1, "manual override with reason is staged for manual review");
assert.equal(manual.items[0].applyReadiness, "staged_manual_review", "manual override requires final review");

const source = fs.readFileSync(new URL("../lib/aiExtractionStagingPreview.ts", import.meta.url), "utf8") + fs.readFileSync(new URL("../lib/aiExtractionStagingValidator.ts", import.meta.url), "utf8");
assert.equal(/supabase|\.update\(|\.delete\(|\.insert\(/i.test(source), false, "staging preview must not write to DB");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "staging preview must not call OpenAI");

console.log("AI extraction staging preview tests passed");

