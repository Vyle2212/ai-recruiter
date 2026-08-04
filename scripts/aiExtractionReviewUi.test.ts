import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildLocalApprovalSummary, filterFieldsForView, getApprovalDisabledReason, sortFieldsForReview } from "../lib/aiExtractionReviewClient";
import {
  approvalGuard,
  buildReviewWorkspace,
  generateApplyPreview,
  loadAiExtractionReviewReports,
  updateApprovalState,
} from "../lib/aiExtractionReviewUi";

const reviewReport = {
  exportedAt: new Date().toISOString(),
  mode: "read-only AI extraction review; no DB writes; no deletes; no apply",
  summary: {
    totalQueued: 2,
    aiExtractionAvailable: 1,
    aiExtractionMissing: 1,
    fieldsSafeToAccept: 1,
    fieldsRisky: 1,
    fieldsRejected: 1,
    candidatesRequiringManualReview: 1,
    searchReadyAfterManualApprovals: 1,
  },
  queueItems: [
    {
      candidateId: "candidate-1",
      existingName: "Jane Fico",
      reasonForAiQueue: "parser_uncertain_or_quality_gate_failed",
      conflicts: ["title_quality_rejected"],
      parserExtractedFields: { displayName: "Jane Fico", title: "Manager", currentCompany: "Not disclosed", primarySapModule: "FICO" },
    },
    {
      candidateId: "candidate-2",
      existingName: "Candidate profile pending validation",
      reasonForAiQueue: "requires_original_file_reupload",
      parserExtractedFields: {},
    },
  ],
  fieldComparisons: [
    {
      candidateId: "candidate-1",
      existingScore: { score: 60, searchReady: false, missingFields: ["title"] },
      parserScore: { score: 55, searchReady: false, missingFields: ["title"] },
      aiAvailable: true,
      fieldComparisons: [
        {
          field: "currentCompany",
          existingValue: "",
          parserValue: "Not disclosed",
          aiValue: "Accenture",
          decision: "safe_accept",
          reason: "direct_evidence_and_high_confidence",
          evidence: "Accenture Jan 2024 - Present",
          confidence: 96,
        },
        {
          field: "primarySapModule",
          existingValue: "FICO",
          parserValue: "FICO",
          aiValue: "BASIS",
          decision: "conflict",
          reason: "module_conflicts_with_title",
          evidence: "",
          confidence: 80,
        },
        {
          field: "displayName",
          existingValue: "Jane Fico",
          parserValue: "Jane Fico",
          aiValue: "SAP Consultant Jane Fico",
          decision: "reject",
          reason: "dirty_or_invalid_identity",
          evidence: "SAP Consultant Jane Fico",
          confidence: 98,
        },
      ],
      safeChanges: [{ field: "currentCompany" }],
      riskyChanges: [{ field: "primarySapModule" }],
      rejectedChanges: [{ field: "displayName" }],
      missingEvidence: [],
      manualReviewRequired: true,
      safeApplyCandidate: false,
      stillBlocked: true,
      searchReadyBefore: false,
      searchReadyAfterManualApprovals: true,
    },
    {
      candidateId: "candidate-2",
      existingScore: { score: 20, searchReady: false, missingFields: ["displayName"] },
      parserScore: { score: 20, searchReady: false, missingFields: ["displayName"] },
      aiAvailable: false,
      fieldComparisons: [],
      safeChanges: [],
      riskyChanges: [],
      rejectedChanges: [],
      missingEvidence: [],
      manualReviewRequired: true,
      safeApplyCandidate: false,
      stillBlocked: true,
      searchReadyBefore: false,
      searchReadyAfterManualApprovals: false,
    },
  ],
};

const applyPlan = {
  mode: "dry-run only; no DB writes; no apply",
  summary: { unsafeDowngradePrevented: 2, existingValidDataPreserved: 3 },
  items: [],
};

const workspace = buildReviewWorkspace(reviewReport, applyPlan, { results: [] }, { reviewReportFound: true, applyPlanFound: true, aiResultsFound: true });
assert.equal(workspace.summary.totalQueued, 2, "summary should map total queued");
assert.equal(workspace.summary.aiResultsAvailable, 1, "summary should map AI results available");
assert.equal(workspace.summary.safeFieldSuggestions, 1, "summary should map safe fields");
assert.equal(workspace.summary.riskySuggestions, 1, "summary should map risky fields");
assert.equal(workspace.summary.rejectedSuggestions, 1, "summary should map rejected fields");
assert.equal(workspace.summary.potentialSearchReadyAfterApproval, 1, "summary should map search-ready after approval");
assert.equal(workspace.summary.reuploadRequired, 1, "summary should count reupload-required candidates");

const first = workspace.candidates[0];
assert.equal(first.candidateName, "Jane Fico", "candidate list logic should use recruiter-friendly candidate name");
assert.equal(first.safeCount, 1, "candidate list should show safe field count");
assert.equal(first.riskyCount, 1, "candidate list should show risky field count");
assert.equal(first.rejectedCount, 1, "candidate list should show rejected field count");
assert.equal(first.recommendedAction, "Review AI suggestions", "manual review candidates should be labeled for review");
const sortedFields = sortFieldsForReview(first.fields);
assert.equal(sortedFields[0].field, "displayName", "default field ordering should put rejected suggestions first");
assert.equal(sortedFields[1].field, "primarySapModule", "default field ordering should put risky conflicts before safe suggestions");
assert.equal(sortedFields[2].field, "currentCompany", "default field ordering should put safe suggestions before noisy missing fields");
const suggestedFields = filterFieldsForView(first.fields, "suggested");
assert.equal(suggestedFields.every((field) => field.aiValue || ["safe_accept", "risky_needs_review", "reject", "conflict"].includes(field.decision)), true, "suggested view should hide fields with no suggestion and no evidence");
const riskFields = filterFieldsForView(first.fields, "risk");
assert.equal(riskFields.every((field) => ["risky_needs_review", "reject", "conflict"].includes(field.decision)), true, "risk view should only show risky or rejected fields");

const company = first.fields.find((field) => field.field === "currentCompany");
assert.ok(company, "field comparison should include current employer");
assert.equal(company?.label, "Current employer", "field comparison should use recruiter-friendly label");
assert.equal(company?.statusLabel, "Safe to accept", "safe status should map to UI label");
assert.equal(company?.canApprove, true, "safe evidenced field should be approvable");
assert.equal(getApprovalDisabledReason(company!), "", "safe evidenced field should not show a disabled reason");
const missingTitle = first.fields.find((field) => field.field === "title");
assert.equal(missingTitle?.canApprove, false, "missing evidence fields should not be approvable");
assert.equal(getApprovalDisabledReason(missingTitle!), "No CV evidence", "missing evidence fields should explain why approval is blocked");

const rejectedName = first.fields.find((field) => field.field === "displayName");
assert.equal(rejectedName?.statusLabel, "Rejected", "rejected status should map to UI label");
assert.equal(rejectedName?.canApprove, false, "rejected field cannot be approved by default");
assert.equal(approvalGuard(rejectedName!).requiresOverride, true, "rejected field should require override");

let approvals = updateApprovalState({}, "candidate-1", "currentCompany", "approve");
approvals = updateApprovalState(approvals, "candidate-1", "displayName", "approve", "Recruiter checked original CV");
const localSummary = buildLocalApprovalSummary(workspace, approvals);
assert.equal(localSummary.approvedFields, 1, "sticky summary should count locally approved safe fields");
assert.equal(localSummary.readyForApplyPreview, 1, "sticky summary should count candidates ready for preview");
const preview = generateApplyPreview(workspace, approvals);
assert.equal(preview.approvedFieldsCount, 1, "apply preview should include only approved safe fields");
assert.equal(preview.changes[0].field, "currentCompany", "apply preview should include safe employer change");
assert.equal(preview.changes.some((change) => change.field === "displayName"), false, "rejected field cannot enter preview even with override");
assert.equal(preview.unsafeDowngradePrevented >= 3, true, "blocked approval should increase unsafe prevented count");
assert.equal(preview.existingFieldsPreserved > 0, true, "preview should preserve existing values not safely approved");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ai-review-ui-"));
fs.mkdirSync(path.join(tmp, "reports"));
const missing = loadAiExtractionReviewReports(tmp);
assert.equal(missing.reportStatus.reviewReportFound, false, "loader should tolerate missing review report");
assert.equal(missing.candidates.length, 0, "missing report should produce empty review");

fs.writeFileSync(path.join(tmp, "reports", "ai-extraction-review.json"), JSON.stringify(reviewReport));
fs.writeFileSync(path.join(tmp, "reports", "ai-extraction-apply-plan.json"), JSON.stringify(applyPlan));
fs.writeFileSync(path.join(tmp, "reports", "background-ai-extraction-results.json"), JSON.stringify({ results: [] }));
const loaded = loadAiExtractionReviewReports(tmp);
assert.equal(loaded.reportStatus.reviewReportFound, true, "loader should read review report");
assert.equal(loaded.candidates.length, 2, "loader should project candidate list");

const pageSource = fs.readFileSync(new URL("../app/recruiter/ai-extraction-review/page.tsx", import.meta.url), "utf8");
assert.equal(pageSource.includes("/api/recruiter/ai-extraction-review"), true, "page should load read-only review API");
assert.equal(pageSource.includes("Generate apply preview"), true, "page should expose dry-run apply preview");
assert.equal(pageSource.includes("Save review decisions"), true, "page should expose approval persistence action");
assert.equal(pageSource.includes("Unsaved changes"), true, "page should show unsaved changes badge");
assert.equal(pageSource.includes("/api/recruiter/ai-extraction-review/approvals"), true, "page should load and save approval API");
assert.equal(pageSource.includes("/api/recruiter/ai-extraction-review/apply-preview"), true, "page should call safe apply preview API");
assert.equal(pageSource.includes("Suggested fields"), true, "page should expose suggested field view toggle");
assert.equal(pageSource.includes("Risky/rejected"), true, "page should expose risky/rejected field view toggle");
assert.equal(pageSource.includes("Approval blocked:"), true, "page should explain disabled approval controls");
assert.equal(pageSource.includes("Dry-run only"), true, "page should show safety mode");
assert.equal(/from ["']openai["']|OpenAI/.test(pageSource), false, "UI must not call OpenAI");
assert.equal(/supabase|\.update\(|\.delete\(|\.insert\(/i.test(pageSource), false, "UI must not write to DB");

const getRouteSource = fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/route.ts", import.meta.url), "utf8");
const previewRouteSource = fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/preview-approval/route.ts", import.meta.url), "utf8");
assert.equal(/export\s+async\s+function\s+(PUT|PATCH|DELETE)/.test(getRouteSource + previewRouteSource), false, "review API should not expose write/apply verbs");
assert.equal(/supabase|\.update\(|\.delete\(|\.insert\(/i.test(getRouteSource + previewRouteSource), false, "review APIs must not write to DB");
assert.equal(/from ["']openai["']|OpenAI/.test(getRouteSource + previewRouteSource), false, "review APIs must not call OpenAI");

console.log("AI extraction review UI tests passed");



