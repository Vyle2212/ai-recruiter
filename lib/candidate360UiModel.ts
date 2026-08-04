import { Candidate360FieldSource as Source, Candidate360VerificationStatus as Status, type Candidate360Field, type Candidate360Profile } from "./candidate360Types";

export type Candidate360TrustSummary = {
  parserExtracted: number; recruiterApproved: number; candidateConfirmed: number;
  candidateEditedNeedsReview: number; missing: number; conflicts: number; trustScore: number;
};

export function candidate360Fields(profile: Candidate360Profile): Candidate360Field[] {
  return [profile.displayName, profile.headline, profile.currentTitle, profile.currentCompany, profile.location,
    profile.contactInfo.email, profile.contactInfo.phone, profile.yearsOfExperience,
    ...profile.sapModules.map((item) => item.name), ...profile.techSkills.map((item) => item.name),
    ...profile.workExperience.flatMap((item) => [item.title, item.company, item.startDate, item.endDate, item.description]),
    ...profile.languages.flatMap((item) => [item.language, item.proficiency])];
}

export function buildCandidate360TrustSummary(profile: Candidate360Profile): Candidate360TrustSummary {
  const fields = candidate360Fields(profile);
  const present = fields.filter((field) => field.value !== null && String(field.value ?? "").trim());
  const trusted = present.filter((field) => [Source.RecruiterApproved, Source.CandidateConfirmed].includes(field.source)).length;
  return {
    parserExtracted: fields.filter((field) => field.source === Source.ParserExtracted).length,
    recruiterApproved: fields.filter((field) => field.source === Source.RecruiterApproved).length,
    candidateConfirmed: fields.filter((field) => field.source === Source.CandidateConfirmed).length,
    candidateEditedNeedsReview: fields.filter((field) => field.verificationStatus === Status.CandidateEditedNeedsRecruiterReview).length,
    missing: profile.missingFields.length,
    conflicts: fields.filter((field) => field.verificationStatus === Status.ConflictDetected || Boolean(field.conflictReason)).length,
    trustScore: present.length ? Math.round((trusted / present.length) * 100) : 0,
  };
}

