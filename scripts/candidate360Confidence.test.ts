import assert from "node:assert/strict";
import { calibrateConclusionConfidence } from "../lib/candidate360Confidence";
import { createEvidenceProvenance, normalizeEvidenceItems } from "../lib/candidate360Evidence";
const weak = normalizeEvidenceItems([{ label: "Treasury", sourceType: "candidate_field" }]);
const structured = normalizeEvidenceItems([{ label: "Treasury project", sourceType: "project" }]);
const verified = normalizeEvidenceItems([{ label: "Treasury ownership", sourceType: "recruiter_confirmation", provenance: createEvidenceProvenance({ claim: "Treasury ownership", sourceType: "recruiter_confirmation", recruiterConfirmed: true }) }]);
const weakScore = calibrateConclusionConfidence({ evidence: weak, completeness: 95 });
const structuredScore = calibrateConclusionConfidence({ evidence: structured, completeness: 60 });
const verifiedScore = calibrateConclusionConfidence({ evidence: verified, completeness: 60 });
assert.ok((weakScore.confidence || 0) <= 40, "keyword mention confidence is capped");
assert.ok((structuredScore.confidence || 0) > (weakScore.confidence || 0));
assert.ok((verifiedScore.confidence || 0) > (structuredScore.confidence || 0));
const gaps = calibrateConclusionConfidence({ evidence: verified, completeness: 90, missingEvidence: ["Leadership ownership", "Availability", "Salary expectations"], criticalFields: ["Leadership ownership", "Availability", "Salary expectations"] });
assert.ok((gaps.confidence || 0) <= 55, "critical gaps cap conclusion confidence");
assert.equal(gaps.completeness, 90, "completeness remains separate from decision confidence");
console.log("candidate360Confidence tests passed");

