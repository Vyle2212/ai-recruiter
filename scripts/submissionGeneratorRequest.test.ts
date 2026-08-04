import assert from "node:assert/strict";import { normalizeSubmissionGenerationRequest } from "../lib/submissionGeneratorRequest";
assert.throws(()=>normalizeSubmissionGenerationRequest({}),/candidateId is required/);const request=normalizeSubmissionGenerationRequest({candidateId:" one ",mustHaveSkills:"SAP, TypeScript, sap",requiredModules:["FI","fi"],jdNotes:"Senior SAP finance transformation",format:"unknown"});assert.equal(request.candidateId,"one");assert.deepEqual(request.mustHaveSkills,["sap","typescript"]);assert.deepEqual(request.requiredModules,["fi"]);assert.equal(request.format,"profile_summary");assert.ok(request.keywordHints.includes("finance"));
console.log("submissionGeneratorRequest.test.ts passed");

