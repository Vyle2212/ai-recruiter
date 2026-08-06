import assert from "node:assert/strict";
import { validateHiringAnalystRequest } from "../lib/candidate360HiringAnalystRequest";
const invalid = (body: unknown) => { const result = validateHiringAnalystRequest("c1", body); assert.equal(result.ok, false); return result.ok ? "" : result.error; };
assert.match(invalid(null), /body is required/);
assert.match(invalid({ candidateId: "c1", question: "   " }), /Question is required/);
assert.match(invalid({ candidateId: "c2", question: "Question" }), /Candidate ID does not match/);
assert.match(invalid({ candidateId: "c1", jobId: "j1", question: "Question" }), /Structured Job data/);
assert.match(invalid({ candidateId: "c1", jobId: "j1", job: { id: "j2" }, question: "Question" }), /Job ID does not match/);
const valid = validateHiringAnalystRequest("c1", { candidateId: "c1", jobId: "j1", job: { id: "j1" }, question: "  Question  " });
assert.equal(valid.ok, true); if (valid.ok) { assert.equal(valid.value.question, "Question"); assert.equal(valid.value.jobId, "j1"); }
console.log("candidate360HiringAnalyst request validation tests passed");
