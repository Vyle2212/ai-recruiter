import assert from "node:assert/strict";
import fs from "node:fs";
const ui = fs.readFileSync("app/recruiter/candidate360-v2/[candidateId]/RecruiterAICopilot.tsx", "utf8");
const route = fs.readFileSync("app/api/candidate360/[candidateId]/analyst/route.ts", "utf8");
const requestValidation = fs.readFileSync("lib/candidate360HiringAnalystRequest.ts", "utf8");
for (const required of ["requestHiringAnalystAnswer", "onSubmit", "onKeyDown", "event.shiftKey", "Analyzing candidate evidence…", "disabled={loading}", "Retry", "inFlight.current", "scrollIntoView", "Clear", "Evidence used", "Missing evidence", "Recommended next action", "candidateId: profile.candidateId", "jobId", "setQuestion(text)"]) assert.match(ui, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(ui, /answerQuestion\s*\(|buildCandidateJobDecision/);
for (const required of ["Question is required", "Candidate ID does not match", "Structured Job data is required", "Job ID does not match", "answerCandidateHiringQuestion"]) assert.ok(`${route}\n${requestValidation}`.includes(required));
assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
console.log("candidate360HiringAnalyst UI tests passed");


