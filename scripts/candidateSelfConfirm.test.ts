import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { buildSelfConfirmForm, previewCandidateSelfConfirmUpdate } from "../lib/candidateSelfConfirm";
import { Candidate360VerificationStatus as Status } from "../lib/candidate360Types";

const profile = buildCandidate360Profile(
  { id: "candidate-2", name: "Alex Tan", current_title: "SAP Lead", current_company: "Existing Co", location: "", primary_module: "MM" },
  { currentStatus: "needs_repair" },
  { approvals: [{ candidateId: "candidate-2", fieldName: "currentCompany", suggestedValue: "Recruiter Approved Co", decision: "approve_suggestion" }] },
);
const form = buildSelfConfirmForm(profile);
assert.equal(form.sections.some((item) => item.sectionId === "salary_availability"), true, "salary and availability placeholder included");
assert.equal(form.confirmation.required, true, "confirmation checkbox required");
const preview = previewCandidateSelfConfirmUpdate(profile, {
  displayName: "Alex Tan", currentCompany: "Candidate Corrected Co", location: "Singapore",
  currentTitle: "SAP Lead", confirmAccuracy: true,
});
assert.equal(preview.changedFields.some((item) => item.fieldName === "currentCompany"), true, "self-confirm preview identifies changed fields");
assert.equal(preview.candidateEditedNeedsReviewFields.includes("currentCompany"), true, "candidate edits conflicting with recruiter approval need review");
assert.equal(preview.changedFields.find((item) => item.fieldName === "currentCompany")?.proposedVerificationStatus, Status.CandidateEditedNeedsRecruiterReview);
assert.equal(preview.newCandidateConfirmedFields.includes("location"), true, "new candidate-confirmed field identified");
assert.equal(preview.completenessAfter > preview.completenessBefore, true, "preview completeness increases when missing data is filled");
assert.equal(preview.recruiterReviewRequired, true);
assert.equal(preview.candidateDbWritePerformed, false, "no candidate DB writes");

const source = fs.readFileSync(new URL("../lib/candidateSelfConfirm.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/candidate360/[candidateId]/self-confirm/preview/route.ts", import.meta.url), "utf8");
assert.equal(/supabase[\s\S]{0,200}\.(?:update|insert|upsert|delete)\(/i.test(source + route), false, "preview does not write candidate DB");
assert.equal(/from ["']openai["']|new OpenAI|\.responses\.create/.test(source + route), false, "no OpenAI calls");
assert.equal(/\b(?:unlink|rmSync|rmdir)\b/.test(source + route), false, "no delete");
console.log("Candidate self-confirm tests passed");
