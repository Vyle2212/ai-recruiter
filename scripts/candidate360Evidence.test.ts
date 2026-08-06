import assert from "node:assert/strict";
import { Candidate360FieldSource, Candidate360VerificationStatus } from "../lib/candidate360Types";
import { normalizeEvidenceItems, normalizeEvidenceLabels, provenanceForField, recruiterLabel } from "../lib/candidate360Evidence";
assert.deepEqual(normalizeEvidenceLabels(["education", " Education ", "certification", "certifications", "leadership", "leadership ownership"]), ["Education", "Certifications", "Leadership ownership"]);
assert.equal(recruiterLabel("identity.currentCompany"), "Current employer");
assert.equal(recruiterLabel("employmentTimeline"), "Employment history");
assert.deepEqual(normalizeEvidenceLabels(["Salary expectations", "Confirmed salary expectation", "Confirmed expected salary", "leadership ownership", "Team size or leadership accountability"]), ["Salary expectations", "Leadership ownership"]);
const normalized = normalizeEvidenceItems([{ label: "education", sourceType: "candidate_field" }, { label: "Education", sourceType: "parsed_resume" }]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].label, "Education");
assert.equal(normalized[0].provenance?.strength, "weak");
assert.match(normalized[0].provenance?.limitations[0] || "", /not verified/i);
const confirmed = provenanceForField("Current employer", { fieldName: "currentCompany", value: "Evidence Co", source: Candidate360FieldSource.RecruiterApproved, verificationStatus: Candidate360VerificationStatus.RecruiterVerified, confidence: 100, lastConfirmedAt: "2026-01-01", lastConfirmedBy: "recruiter", evidence: "Confirmed", conflictReason: "", editableByCandidate: true });
assert.equal(confirmed.strength, "verified");
assert.equal(confirmed.recruiterConfirmed, true);
assert.equal(confirmed.confirmedAt, "2026-01-01");
console.log("candidate360Evidence tests passed");



