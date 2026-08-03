import assert from "node:assert/strict";

import { buildCandidate360Profile } from "../lib/candidate360Profile";

const profile = buildCandidate360Profile(
  {
    id: "candidate-360-001",
    name: "Candidate 360 Example",
    current_title: "Senior Consultant",
    current_company: "Example Company",
    location: "Ho Chi Minh City",
    email: "candidate@example.com",
    status: "submitted_to_client",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-03T00:00:00.000Z",
  },
  {
    currentStatus: "submitted_to_client",
    priority: "high",
    ownerId: "recruiter-001",
    ownerName: "Recruiter Example",
    dueDate: "2026-08-05T00:00:00.000Z",
  },
);

assert.equal(profile.workflowStatus, "submitted_to_client");
assert.equal(profile.lifecycle.stage, "submitted");
assert.equal(profile.lifecycle.ownerName, "Recruiter Example");
assert.equal(profile.lifecycle.priority, "high");
assert.equal(profile.lifecycle.nextAction, "follow_up_client");
assert.equal(
  profile.lifecycle.nextActionDueAt,
  "2026-08-05T00:00:00.000Z",
);

console.log("candidate360Lifecycle.test.ts passed");