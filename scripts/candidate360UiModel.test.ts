import assert from "node:assert/strict";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { buildCandidate360TrustSummary } from "../lib/candidate360UiModel";
const profile=buildCandidate360Profile({id:"one",name:"A",candidate360_fields:{currentCompany:{value:"Trusted Co",source:"candidate_confirmed"}}},{currentStatus:"ready_for_shortlist"});
const trust=buildCandidate360TrustSummary(profile);
assert.equal(trust.candidateConfirmed,1); assert.ok(trust.missing>0); assert.equal(trust.conflicts,0);
console.log("candidate360UiModel.test.ts passed");

