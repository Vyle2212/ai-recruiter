import assert from "node:assert/strict";
import fs from "node:fs";
import {buildCandidate360Profile} from "../lib/candidate360Profile";
import {buildCandidateSelfConfirmDecisions} from "../lib/candidateSelfConfirmDecision";
import {buildCandidateSelfConfirmStaging,buildCandidateSelfConfirmSubmission,validateCandidateSelfConfirmSubmission} from "../lib/candidateSelfConfirmSubmission";

const profile=buildCandidate360Profile(
  {id:"self-confirm-1",name:"Alex Tan",current_title:"SAP Senior Consultant",current_company:"Parser Co",location:"",email:"alex@example.com"},
  {currentStatus:"ready_for_shortlist"},
  {approvals:[{candidateId:"self-confirm-1",fieldName:"currentCompany",suggestedValue:"Recruiter Co",decision:"approve_suggestion"}]},
);
function stage(input:Record<string,unknown>){const submission=buildCandidateSelfConfirmSubmission(profile.candidateId,input,profile);const validation=validateCandidateSelfConfirmSubmission(submission,profile);return buildCandidateSelfConfirmStaging(submission,validation,profile);}

assert.equal(stage({displayName:"Alex Tan",candidateConsent:false}).items[0].riskLevel,"blocked","candidate consent required");
assert.equal(stage({displayName:"Alex Tan",candidateConsent:true}).items[0].riskLevel,"safe","confirm existing is safe");
assert.equal(stage({location:"Singapore",candidateConsent:true}).items[0].riskLevel,"safe","safe missing value may be added");
assert.equal(stage({currentCompany:"Candidate Co",candidateConsent:true}).items[0].riskLevel,"needs_recruiter_review","recruiter-approved edit is held");
assert.equal(stage({currentCompany:"Not disclosed",candidateConsent:true}).items[0].riskLevel,"blocked","generic value is blocked");
assert.equal(stage({workflowStatus:"ready_for_shortlist",candidateConsent:true}).items[0].riskLevel,"blocked","internal fields are blocked");
const decisions=buildCandidateSelfConfirmDecisions(stage({displayName:"Alex Tan",location:"Singapore",currentCompany:"Candidate Co",workflowStatus:"ready",candidateConsent:true}));
assert.deepEqual(new Set(decisions.decisions.map(item=>item.decision)),new Set(["approve_candidate_confirm","hold_for_recruiter_review","reject_candidate_change"]));
for(const file of ["lib/candidateSelfConfirmSubmission.ts","lib/candidateSelfConfirmDecision.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/new OpenAI|responses\.create|\.delete\(/i);}
console.log("candidateSelfConfirmSubmission.test.ts passed");
