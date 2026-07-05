import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCandidateDuplicateAdminLog,
  candidateFacingProfileUpdateMessage,
  candidateProfileTimestampLabels,
  detectCandidateDuplicateIdentity,
  formatCandidateUpdateMonthYear,
} from "../lib/candidateDuplicateIdentity";

const existing = [
  {
    id: "existing-1",
    name: "Aina Rahman",
    email: "aina@example.com",
    phone: "+60 12 345 6789",
    linkedin_url: "https://www.linkedin.com/in/aina-rahman/",
    current_company: "Accenture Malaysia",
    primary_module: "FICO",
    location: "Malaysia",
    current_title: "SAP FICO Consultant",
    raw_text: "Aina Rahman SAP FICO consultant Accenture Malaysia implementation rollout support",
  },
];

const sameEmail = detectCandidateDuplicateIdentity({ name: "Aina Rahman", email: "aina@example.com" }, existing);
assert.equal(sameEmail.matchStatus, "confirmed_duplicate", "same email should confirm duplicate");
assert.equal(sameEmail.recommendedAction, "auto_update_existing_profile", "same email can auto-update in dry-run decisioning");

const samePhone = detectCandidateDuplicateIdentity({ name: "Different Name", phone: "012-345-6789" }, existing);
assert.equal(samePhone.matchStatus, "confirmed_duplicate", "same normalized phone should confirm duplicate");
assert.equal(samePhone.recommendedAction, "auto_update_existing_profile", "same phone can auto-update in dry-run decisioning");

const sameLinkedIn = detectCandidateDuplicateIdentity({ linkedin_url: "linkedin.com/in/aina-rahman" }, existing);
assert.equal(sameLinkedIn.matchStatus, "confirmed_duplicate", "same LinkedIn URL should confirm duplicate");
assert.equal(sameLinkedIn.recommendedAction, "auto_update_existing_profile", "same LinkedIn can auto-update in dry-run decisioning");

const sameNameOnly = detectCandidateDuplicateIdentity({ name: "Aina Rahman" }, existing);
assert.notEqual(sameNameOnly.recommendedAction, "auto_update_existing_profile", "same name only must not auto update");
assert.equal(sameNameOnly.matchStatus, "new_candidate", "same name alone should not cross duplicate threshold");

const sameNameModule = detectCandidateDuplicateIdentity({ name: "Aina Rahman", primary_module: "FICO" }, existing);
assert.equal(sameNameModule.matchStatus, "possible_duplicate", "same name + module should be an internal possible duplicate");
assert.equal(sameNameModule.recommendedAction, "admin_review_required", "same name + module only requires admin review");

const candidateMessage = candidateFacingProfileUpdateMessage();
assert.equal(candidateMessage, "Your profile has been updated successfully.", "candidate-facing response should be generic success");
assert.equal(/duplicate|matched|merge/i.test(candidateMessage), false, "candidate-facing response must never say duplicate");

const log = buildCandidateDuplicateAdminLog({
  uploadedCandidate: { id: "upload-1", user_id: "user-1", email: "aina@example.com", current_company: "Deloitte", primary_module: "FICO" },
  matchedCandidate: existing[0],
  result: sameEmail,
  now: "2026-07-05T10:00:00.000Z",
});
assert.equal(log.matchedExistingCandidateId, "existing-1", "admin log should include matched existing candidate");
assert.equal(log.uploadedCandidateId, "upload-1", "admin log should include uploaded candidate/user context");
assert.equal(log.confidence, sameEmail.confidence, "admin log should include duplicate confidence");
assert.equal(log.matchReasons.includes("exact email match"), true, "admin log should include match reasons");
assert.equal(log.updatedFields.includes("current_company"), true, "admin log should include updated fields");
assert.equal(log.previousValues.current_company, "Accenture Malaysia", "admin log should include previous values");
assert.equal(log.newValues.current_company, "Deloitte", "admin log should include new values");
assert.equal(log.updateTimestamp, "2026-07-05T10:00:00.000Z", "admin log includes duplicate update time");
assert.equal(log.adminReviewStatus, "auto_update_dry_run", "admin log should remain dry-run in v1");

assert.equal(formatCandidateUpdateMonthYear("2026-07-05T10:00:00.000Z"), "Jul 2026", "update month/year formatting works");
const labels = candidateProfileTimestampLabels({ updated_at: "2026-07-05T10:00:00.000Z", latest_cv_uploaded_at: "2026-06-02T00:00:00.000Z" });
assert.equal(labels.updatedLabel, "Updated Jul 2026", "profile update label should use month/year");
assert.equal(labels.latestCvLabel, "Latest CV Jun 2026", "latest CV label should use month/year");

const libSource = fs.readFileSync(new URL("../lib/candidateDuplicateIdentity.ts", import.meta.url), "utf8");
assert.equal(/\.update\(|\.insert\(|\.delete\(/.test(libSource), false, "duplicate identity engine v1 must not contain DB writes");

console.log("Candidate duplicate identity tests passed");
