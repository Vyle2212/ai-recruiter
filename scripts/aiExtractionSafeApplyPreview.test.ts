import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSafeApplyPreview } from "../lib/aiExtractionSafeApplyPreview";
import type { AiExtractionApproval } from "../lib/aiExtractionApprovalStore";
import type { ReviewWorkspace } from "../lib/aiExtractionReviewUi";

const workspace: ReviewWorkspace = {
  mode: "test workspace",
  exportedAt: new Date().toISOString(),
  reportStatus: { reviewReportFound: true, applyPlanFound: true, aiResultsFound: true, staleCache: false, errors: [] },
  summary: {
    totalQueued: 1,
    aiResultsAvailable: 1,
    safeFieldSuggestions: 1,
    riskySuggestions: 1,
    rejectedSuggestions: 1,
    manualReviewRequired: 1,
    potentialSearchReadyAfterApproval: 1,
    reuploadRequired: 0,
    missingAiResult: 0,
  },
  applyPlan: { summary: { existingValidDataPreserved: 1 } },
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
      missingBlockers: ["title"],
      aiStatus: "AI result available",
      recommendedAction: "Review AI suggestions",
      stillBlocked: true,
      reuploadRequired: false,
      debug: {},
      fields: [
        {
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
        },
        {
          field: "displayName",
          label: "Full name",
          existingValue: "Jane Fico",
          parserValue: "Jane Fico",
          aiValue: "SAP Consultant Jane Fico",
          confidence: 98,
          evidence: "SAP Consultant Jane Fico",
          decision: "reject",
          reason: "dirty_or_invalid_identity",
          statusLabel: "Rejected",
          statusTone: "rejected",
          canApprove: false,
          requiresOverride: true,
          warning: "This suggestion was rejected and needs a manual override reason.",
        },
      ],
    },
  ],
};

const approvals: AiExtractionApproval[] = [
  {
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
  },
  {
    approvalId: "candidate-1:displayName",
    candidateId: "candidate-1",
    fieldName: "displayName",
    currentValue: "Jane Fico",
    suggestedValue: "SAP Consultant Jane Fico",
    parserValue: "Jane Fico",
    aiEvidence: "SAP Consultant Jane Fico",
    aiConfidence: 98,
    decision: "manual_override_approve",
    riskLevel: "rejected",
    reviewerNote: "",
    overrideReason: "Recruiter checked original CV",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const preview = buildSafeApplyPreview(workspace, approvals);
assert.equal(preview.mode.includes("dry-run only"), true, "preview should be dry-run only");
assert.equal(preview.mode.includes("no DB writes"), true, "preview should state no DB writes");
assert.equal(preview.approvedFieldsCount, 1, "preview should include only approved safe fields");
assert.equal(preview.changes.length, 1, "preview changes should include only safe normal approval");
assert.equal(preview.changes[0].fieldName, "currentCompany", "safe approval should be included");
assert.equal(preview.changes.some((change) => change.fieldName === "displayName"), false, "rejected/manual override field should not be included as safe change");
assert.equal(preview.existingFieldsPreserved > 0, true, "existing data should be preserved for non-safe fields");
assert.equal(preview.unsafeDowngradePrevented, 1, "manual override unsafe change should be prevented from safe preview");

const applyPreviewSource = fs.readFileSync(new URL("../lib/aiExtractionSafeApplyPreview.ts", import.meta.url), "utf8");
const applyPreviewRouteSource = fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/apply-preview/route.ts", import.meta.url), "utf8");
assert.equal(/supabase|\.update\(|\.delete\(|\.insert\(/i.test(applyPreviewSource + applyPreviewRouteSource), false, "apply preview must not write to DB");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(applyPreviewSource + applyPreviewRouteSource), false, "apply preview must not call OpenAI");

console.log("AI extraction safe apply preview tests passed");

