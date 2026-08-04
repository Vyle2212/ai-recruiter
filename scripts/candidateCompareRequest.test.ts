import assert from "node:assert/strict";import { extractDeterministicKeywordHints,normalizeCandidateCompareRequest } from "../lib/candidateCompareRequest";
assert.throws(()=>normalizeCandidateCompareRequest({candidateIds:["one"]}),/at least 2/);assert.throws(()=>normalizeCandidateCompareRequest({candidateIds:["1","2","3","4","5","6"]}),/at most 5/);
const request=normalizeCandidateCompareRequest({candidateIds:[" one ","two","one"],mustHaveSkills:"SAP, TypeScript, sap",requiredModules:["FI","fi","MM"],notes:"Senior SAP finance migration consultant"});assert.deepEqual(request.candidateIds,["one","two"]);assert.deepEqual(request.mustHaveSkills,["sap","typescript"]);assert.deepEqual(request.requiredModules,["fi","mm"]);assert.ok(extractDeterministicKeywordHints(request.notes).includes("finance"));
console.log("candidateCompareRequest.test.ts passed");

