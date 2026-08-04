import type { Candidate360Profile } from "./candidate360Types";
import type { CandidateCompareResult } from "./candidateCompareTypes";
export type SubmissionFormat="client_email"|"profile_summary"|"shortlist_table_row"|"executive_brief";
export type SubmissionRoleContext={roleTitle:string;clientName?:string;roleSeniority?:string;roleLocation?:string;employmentType?:string;workMode?:string;mustHaveSkills:string[];niceToHaveSkills:string[];requiredModules:string[];requiredIndustries:string[];requiredLanguages:string[];minYearsExperience:number|null;jdNotes?:string;keywordHints:string[]};
export type SubmissionGenerationRequest=SubmissionRoleContext&{candidateId:string;compareResult?:CandidateCompareResult;format:SubmissionFormat};
export type SubmissionCandidateInput={candidateId:string;profile:Candidate360Profile};
export type SubmissionSection={id:string;title:string;content:string;items:string[]};
export type SubmissionEvidenceItem={fieldName:string;value:string;source:string;verificationStatus:string;confidence:number;usedIn:string[]};
export type SubmissionRiskItem={code:string;severity:"low"|"medium"|"high";message:string};
export type SubmissionMissingInfoItem={fieldName:string;label:string;placeholder:string;requiredForReview:boolean};
export type SubmissionClientSummary={subject:string;body:string};
export type SubmissionDraft={draftId:string;candidateId:string;generatedAt:string;mode:"deterministic_read_only";format:SubmissionFormat;candidateSnapshot:{name:string;title:string;company:string;location:string;email:string;phone:string;yearsExperience:number|null;skills:string[];modules:string[];completeness:number;needsCandidateConfirmation:boolean};roleContext:SubmissionRoleContext;sections:SubmissionSection[];strengths:string[];matchingHighlights:string[];potentialConcerns:SubmissionRiskItem[];missingInfo:SubmissionMissingInfoItem[];evidence:SubmissionEvidenceItem[];recruiterReviewChecklist:string[];trustAndVerificationSummary:{trustScore:number;parserExtracted:number;recruiterApproved:number;candidateConfirmed:number;conflicts:number;note:string};clientEmailDraft:SubmissionClientSummary;profileSummary:string;shortlistTableRow:string;executiveBrief:string;safetyWarnings:string[]};

