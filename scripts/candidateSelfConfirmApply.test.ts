import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {buildCandidate360Profile} from "../lib/candidate360Profile";
import {buildCandidateSelfConfirmApplyPlan} from "../lib/candidateSelfConfirmApplyPlan";
import {executeCandidateSelfConfirmApply,validateCandidateSelfConfirmApplyMode} from "../lib/candidateSelfConfirmApplyExecutor";
import {buildCandidateSelfConfirmDecisions} from "../lib/candidateSelfConfirmDecision";
import {buildCandidateSelfConfirmStaging,buildCandidateSelfConfirmSubmission,validateCandidateSelfConfirmSubmission} from "../lib/candidateSelfConfirmSubmission";
import {recruiterRouteRegistry} from "../lib/recruiterRouteRegistry";

async function main(){
const profile=buildCandidate360Profile({id:"apply-1",name:"Alex Tan",current_title:"SAP Senior Consultant",current_company:"Existing Co",location:""},{currentStatus:"ready_for_shortlist"});
const submission=buildCandidateSelfConfirmSubmission(profile.candidateId,{displayName:"Alex Tan",location:"Singapore",currentCompany:"Changed Co",candidateConsent:true},profile);
const staging=buildCandidateSelfConfirmStaging(submission,validateCandidateSelfConfirmSubmission(submission,profile),profile);
const decisions=buildCandidateSelfConfirmDecisions(staging);
decisions.decisions.find(item=>item.fieldName==="currentCompany")!.decision="reject_candidate_change";
const current={["apply-1"]:{name:"Alex Tan",location:"",current_company:"Existing Co"}};
const plan=buildCandidateSelfConfirmApplyPlan(staging,decisions,current);
assert.ok(plan.items.every(item=>item.decision==="approve_candidate_confirm"));
assert.ok(plan.excluded.every(item=>["reject_candidate_change","hold_for_recruiter_review","keep_existing"].includes(item.decision)));
assert.equal(plan.backupRequired,true);assert.equal(plan.rollbackReady,true);
assert.throws(()=>validateCandidateSelfConfirmApplyMode(true,false),/requires both/);
assert.throws(()=>validateCandidateSelfConfirmApplyMode(false,true),/requires both/);
const dryDir=fs.mkdtempSync(path.join(os.tmpdir(),"candidate-confirm-dry-"));let calls=0;
const dry=await executeCandidateSelfConfirmApply(plan,{outputDir:dryDir,updateCandidate:async()=>{calls++;}});
assert.equal(dry.result.dryRun,true);assert.equal(calls,0);assert.equal(dry.postAudit.appliedVerified,0);
assert.ok(fs.existsSync(dry.backupPath));assert.ok(fs.existsSync(dry.rollbackPath));
const applyDir=fs.mkdtempSync(path.join(os.tmpdir(),"candidate-confirm-apply-"));let backupBeforeWrite=false;const stored:Record<string,Record<string,unknown>>={["apply-1"]:{...current["apply-1"]}};
const applied=await executeCandidateSelfConfirmApply(plan,{writeCandidateUpdates:true,confirmCandidateSelfConfirmApply:true,outputDir:applyDir,updateCandidate:async(id,update)=>{backupBeforeWrite=fs.existsSync(path.join(applyDir,"candidate-self-confirm-backup.json"))&&fs.existsSync(path.join(applyDir,"candidate-self-confirm-rollback.json"));stored[id]={...stored[id],...update};},readCandidates:async()=>stored});
assert.equal(backupBeforeWrite,true,"backup and rollback exist before writes");assert.equal(applied.postAudit.mismatch,0);assert.equal(applied.postAudit.appliedVerified,plan.items.length);
assert.ok(recruiterRouteRegistry.some(item=>item.route==="/recruiter/candidate-self-confirm-review"));
assert.ok(recruiterRouteRegistry.some(item=>item.route==="/api/recruiter/candidate-self-confirm/review"&&item.readOnly));
for(const file of ["lib/candidateSelfConfirmApplyPlan.ts","lib/candidateSelfConfirmApplyExecutor.ts","scripts/applyCandidateSelfConfirm.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/new OpenAI|responses\.create|\.delete\(/i);}
console.log("candidateSelfConfirmApply.test.ts passed");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
