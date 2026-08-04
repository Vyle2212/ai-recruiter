import assert from "node:assert/strict";
import { validateBatchReviewItem } from "../lib/aiExtractionBatchReviewValidator";

const safe = validateBatchReviewItem({ candidateId: "c1", fieldName: "currentCompany", evidence: "Worked at Acme", aiValue: "Acme" });
assert.equal(safe.ok, true, "valid incoming item accepted");
assert.equal(safe.status, "valid", "valid item status mapped");

const missingEvidence = validateBatchReviewItem({ candidateId: "c1", fieldName: "title", aiValue: "SAP Lead" });
assert.equal(missingEvidence.ok, true, "item without evidence allowed for recruiter review");
assert.equal(missingEvidence.needsManualReview, true, "item without evidence marked needs_manual_review");

const unsupported = validateBatchReviewItem({ candidateId: "c1", fieldName: "unknownField", evidence: "CV", aiValue: "Value" });
assert.equal(unsupported.blocked, true, "unsupported field blocked");

const alreadyApplied = validateBatchReviewItem(
  { candidateId: "c1", fieldName: "currentCompany", evidence: "CV", aiValue: "Acme" },
  { items: [{ candidateId: "c1", fieldName: "currentCompany", status: "applied_verified" }] },
);
assert.equal(alreadyApplied.status, "preserved_already_applied", "already applied field classified preserved/blocked, not pending");

console.log("AI extraction batch review validator tests passed");
