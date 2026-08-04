import assert from "node:assert/strict";
import { validateQuickFixSubsetDecision, quickFixSubsetApplyModeFromFlags } from "../lib/quickFixApplySubsetValidator";
const staging:any={candidateId:"c1",fieldName:"currentCompany",approvedValue:"EY Consulting"};
assert.equal(validateQuickFixSubsetDecision({candidateId:"c1",fieldName:"currentCompany",suggestedValue:"EY Consulting",decision:"approve_for_apply"} as any, staging).ok,true,"subset allows currentCompany approved decision");
assert.equal(validateQuickFixSubsetDecision({candidateId:"c1",fieldName:"title",suggestedValue:"SAP Consultant",decision:"approve_for_apply"} as any,{...staging,fieldName:"title",approvedValue:"SAP Consultant"}).ok,false,"subset blocks unsupported fields in v1");
assert.equal(validateQuickFixSubsetDecision({candidateId:"c1",fieldName:"currentCompany",suggestedValue:"Under Accenture Technology",decision:"approve_for_apply"} as any,{...staging,approvedValue:"Under Accenture Technology"}).ok,false,"suspicious values excluded");
assert.throws(()=>quickFixSubsetApplyModeFromFlags(true,false),/requires --confirmApplySubset/,"real apply rejected without confirmApplySubset");
assert.throws(()=>quickFixSubsetApplyModeFromFlags(false,true),/requires --writeCandidateUpdates/,"real apply rejected without writeCandidateUpdates");
console.log("Quick fix apply subset validator tests passed");
