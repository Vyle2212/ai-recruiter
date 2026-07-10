import assert from "node:assert/strict";
import { validateCandidateApplyItem } from "../lib/aiExtractionCandidateApplyValidator";
import type { AiExtractionStagingRecord } from "../lib/aiExtractionStagingPreview";

function item(overrides: Partial<AiExtractionStagingRecord> = {}): AiExtractionStagingRecord {
  return {
    stagingId: "s1",
    candidateId: "c1",
    candidateName: "Jane Fico",
    fieldName: "currentCompany",
    currentValue: "",
    approvedValue: "Accenture",
    parserValue: "Not disclosed",
    aiEvidence: "Accenture Jan 2024 - Present",
    aiConfidence: 96,
    approvalDecision: "approve_suggestion",
    reviewerNote: "",
    overrideReason: "",
    riskLevel: "safe",
    applyReadiness: "staged_safe",
    validationStatus: "valid",
    validationReasons: [],
    sourceApprovalId: "a1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stagedBy: "local-review",
    appliedToCandidate: false,
    ...overrides,
  };
}

const candidate = { id: "c1", current_company: "", current_title: "SAP FICO Consultant", name: "Jane Fico" };
assert.equal(validateCandidateApplyItem(item(), candidate).eligible, true, "valid staged field creates apply candidate");
assert.equal(validateCandidateApplyItem(item({ fieldName: "unknownField" }), candidate).reasons.includes("field is not in allowed mapping"), true, "unknown field mapping blocked");
assert.equal(validateCandidateApplyItem(item({ validationStatus: "warning" }), candidate).reasons.includes("staged item is not valid"), true, "invalid staged item blocked");
assert.equal(validateCandidateApplyItem(item({ riskLevel: "rejected" }), candidate).reasons.includes("rejected or conflict risk requires manual override"), true, "rejected item blocked without override");
assert.equal(validateCandidateApplyItem(item({ fieldName: "currentCompany", approvedValue: "Project implementation role" }), candidate).reasons.includes("employer looks like project/client/sentence/email/domain"), true, "dirty employer blocked");
assert.equal(validateCandidateApplyItem(item({ fieldName: "displayName", approvedValue: "SAP Consultant Jane Fico", currentValue: "Jane Fico" }), { id: "c1", name: "Jane Fico" }).reasons.includes("identity looks fake/placeholder/sentence/tool list"), true, "fake identity blocked");
assert.equal(validateCandidateApplyItem(item({ fieldName: "primarySapModule", currentValue: "FICO", approvedValue: "BASIS" }), { id: "c1", primary_module: "FICO", current_title: "SAP FICO Consultant" }).reasons.includes("module conflicts with title"), true, "module/title conflict blocked");
assert.equal(validateCandidateApplyItem(item(), undefined).reasons.includes("current DB record is missing"), true, "missing current DB record blocked");
assert.equal(validateCandidateApplyItem(item({ currentValue: "", approvedValue: "Accenture", aiConfidence: 70 }), { id: "c1", current_company: "Deloitte" }).reasons.includes("current DB value differs from staging current value"), true, "different current DB value blocked");
assert.equal(validateCandidateApplyItem(item({ approvedValue: "Deloitte" }), { id: "c1", current_company: "Deloitte" }).reasons.includes("current DB value already matches approved value"), true, "existing data not downgraded/noop is preserved");
assert.equal(validateCandidateApplyItem(item(), { id: "c1", current_company: "", extraction_decision_action: "requires_original_file_reupload" }).reasons.includes("candidate requires original file reupload"), true, "reupload candidate blocked");

console.log("AI extraction candidate apply validator tests passed");
