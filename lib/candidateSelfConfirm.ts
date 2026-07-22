import { Candidate360FieldSource as Source, Candidate360VerificationStatus as Status, type Candidate360Field, type Candidate360Profile } from "./candidate360Types";

export type SelfConfirmFormField = {
  fieldName: string;
  label: string;
  value: unknown;
  required: boolean;
  editable: boolean;
  source: Source;
  verificationStatus: Status;
};
export type SelfConfirmFormSection = { sectionId: string; title: string; optional?: boolean; fields: SelfConfirmFormField[] };
export type CandidateSelfConfirmForm = {
  candidateId: string;
  mode: "preview-only; no candidate DB writes";
  sections: SelfConfirmFormSection[];
  confirmation: { fieldName: "confirmAccuracy"; label: string; required: true };
};
export type CandidateSelfConfirmSubmission = Record<string, unknown> & { confirmAccuracy?: boolean };

function clean(value: unknown) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value; }
function same(a: unknown, b: unknown) { return JSON.stringify(clean(a)) === JSON.stringify(clean(b)); }
function formField(field: Candidate360Field, label: string, required = false): SelfConfirmFormField {
  return { fieldName: field.fieldName, label, value: field.value, required, editable: field.editableByCandidate, source: field.source, verificationStatus: field.verificationStatus };
}
function synthetic(fieldName: string, label: string, value: unknown, optional = true): SelfConfirmFormField {
  return { fieldName, label, value, required: !optional, editable: true, source: Source.Unknown, verificationStatus: Status.Unverified };
}

export function buildSelfConfirmForm(profile: Candidate360Profile): CandidateSelfConfirmForm {
  return {
    candidateId: profile.candidateId,
    mode: "preview-only; no candidate DB writes",
    sections: [
      { sectionId: "personal_info", title: "Personal information", fields: [formField(profile.displayName, "Full name", true)] },
      { sectionId: "contact_info", title: "Contact information", fields: [formField(profile.contactInfo.email, "Email"), formField(profile.contactInfo.phone, "Phone")] },
      { sectionId: "current_role", title: "Current role", fields: [formField(profile.currentTitle, "Current title", true), formField(profile.currentCompany, "Current company", true), formField(profile.location, "Location", true)] },
      { sectionId: "work_experience", title: "Work experience", fields: [synthetic("workExperience", "Work experience", profile.workExperience, false)] },
      { sectionId: "skills_modules", title: "Skills and SAP modules", fields: [synthetic("sapModules", "SAP modules", profile.sapModules.map((item) => item.name.value), false), synthetic("techSkills", "Technical skills", profile.techSkills.map((item) => item.name.value))] },
      { sectionId: "salary_availability", title: "Salary and availability", optional: true, fields: [synthetic("expectedSalary", "Expected salary", ""), synthetic("availability", "Availability / notice period", "")] },
    ],
    confirmation: { fieldName: "confirmAccuracy", label: "I confirm that this profile is accurate to the best of my knowledge.", required: true },
  };
}

function profileFieldMap(profile: Candidate360Profile) {
  return new Map<string, Candidate360Field>([
    [profile.displayName.fieldName, profile.displayName], [profile.currentTitle.fieldName, profile.currentTitle],
    [profile.currentCompany.fieldName, profile.currentCompany], [profile.location.fieldName, profile.location],
    [profile.contactInfo.email.fieldName, profile.contactInfo.email], [profile.contactInfo.phone.fieldName, profile.contactInfo.phone],
    [profile.yearsOfExperience.fieldName, profile.yearsOfExperience],
  ]);
}

export function previewCandidateSelfConfirmUpdate(profile: Candidate360Profile, submittedFields: CandidateSelfConfirmSubmission) {
  const form = buildSelfConfirmForm(profile);
  const known = profileFieldMap(profile);
  const changedFields: Array<{ fieldName: string; beforeValue: unknown; submittedValue: unknown; proposedSource: Source; proposedVerificationStatus: Status; conflictReason: string }> = [];
  const unchangedFields: string[] = [];
  const newCandidateConfirmedFields: string[] = [];
  const candidateEditedNeedsReviewFields: string[] = [];
  for (const section of form.sections) for (const formItem of section.fields) {
    if (!(formItem.fieldName in submittedFields)) continue;
    const submittedValue = clean(submittedFields[formItem.fieldName]);
    const current = known.get(formItem.fieldName);
    const beforeValue = current?.value ?? formItem.value;
    if (same(beforeValue, submittedValue)) {
      unchangedFields.push(formItem.fieldName);
      if (current && current.verificationStatus !== Status.CandidateConfirmed) newCandidateConfirmedFields.push(formItem.fieldName);
      continue;
    }
    const trustedConflict = current?.source === Source.RecruiterApproved || current?.verificationStatus === Status.RecruiterVerified;
    const proposedVerificationStatus = trustedConflict ? Status.CandidateEditedNeedsRecruiterReview : Status.CandidateConfirmed;
    changedFields.push({
      fieldName: formItem.fieldName, beforeValue, submittedValue,
      proposedSource: trustedConflict ? Source.CandidateEdited : Source.CandidateConfirmed,
      proposedVerificationStatus,
      conflictReason: trustedConflict ? `Candidate edit conflicts with recruiter-approved value: ${String(beforeValue ?? "")}` : "",
    });
    if (trustedConflict) candidateEditedNeedsReviewFields.push(formItem.fieldName);
    else newCandidateConfirmedFields.push(formItem.fieldName);
  }
  const missingAfter = new Set(profile.missingFields);
  for (const item of changedFields) {
    if (item.submittedValue !== null && item.submittedValue !== undefined && String(item.submittedValue).trim()) missingAfter.delete(item.fieldName);
    else missingAfter.add(item.fieldName);
  }
  const completenessBefore = profile.completeness.score;
  const completenessAfter = Math.max(0, Math.round(((profile.completeness.totalFields - missingAfter.size) / profile.completeness.totalFields) * 100));
  return {
    candidateId: profile.candidateId,
    mode: "preview-only; no candidate DB writes",
    confirmationAccepted: submittedFields.confirmAccuracy === true,
    changedFields,
    unchangedFields,
    newCandidateConfirmedFields: Array.from(new Set(newCandidateConfirmedFields)),
    candidateEditedNeedsReviewFields,
    completenessBefore,
    completenessAfter,
    recruiterReviewRequired: candidateEditedNeedsReviewFields.length > 0,
    candidateDbWritePerformed: false,
  };
}
