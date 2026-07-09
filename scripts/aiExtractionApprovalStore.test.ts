import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadApprovalStore, upsertApprovals, validateApproval, type AiExtractionApproval } from "../lib/aiExtractionApprovalStore";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ai-approval-store-"));
fs.mkdirSync(path.join(tmp, "reports"));

const safeApproval: Partial<AiExtractionApproval> & { reason?: string } = {
  candidateId: "candidate-1",
  fieldName: "currentCompany",
  currentValue: "",
  suggestedValue: "Accenture",
  parserValue: "Not disclosed",
  aiEvidence: "Accenture Jan 2024 - Present",
  aiConfidence: 96,
  decision: "approve_suggestion",
  riskLevel: "safe",
  reviewerNote: "",
  overrideReason: "",
  reason: "direct_evidence_and_high_confidence",
};

let result = upsertApprovals([safeApproval], tmp);
assert.equal(result.ok, true, "safe approval should save");
let store = loadApprovalStore(tmp);
assert.equal(store.approvals.length, 1, "saved approval should load from local JSON");
assert.equal(store.approvals[0].candidateId, "candidate-1", "saved approval should preserve candidateId");
assert.equal(store.mode.includes("no DB writes"), true, "store mode should state no DB writes");

result = upsertApprovals([{ ...safeApproval, reviewerNote: "checked" }], tmp);
assert.equal(result.ok, true, "existing approval should upsert");
store = loadApprovalStore(tmp);
assert.equal(store.approvals.length, 1, "upsert should not duplicate candidate field approval");
assert.equal(store.approvals[0].reviewerNote, "checked", "upsert should update approval details");

assert.equal(validateApproval({ ...safeApproval, candidateId: "" }).includes("candidateId required"), true, "candidateId is required");
assert.equal(validateApproval({ ...safeApproval, fieldName: "" }).includes("fieldName required"), true, "fieldName is required");
assert.equal(validateApproval({ ...safeApproval, decision: undefined }).includes("decision required"), true, "decision is required");
assert.equal(validateApproval({ ...safeApproval, suggestedValue: "" }).includes("suggestedValue required for approve_suggestion"), true, "approve_suggestion requires suggested value");
assert.equal(validateApproval({ ...safeApproval, decision: "manual_override_approve", overrideReason: "" }).includes("manual_override_approve requires overrideReason"), true, "manual override requires reason");
assert.equal(validateApproval({ ...safeApproval, riskLevel: "rejected" }).includes("rejected, risky, or conflict fields cannot be approved normally"), true, "rejected field cannot be approved normally");
assert.equal(validateApproval({ ...safeApproval, riskLevel: "risky" }).includes("rejected, risky, or conflict fields cannot be approved normally"), true, "risky field cannot be approved normally");
assert.equal(validateApproval({ ...safeApproval, riskLevel: "conflict" }).includes("rejected, risky, or conflict fields cannot be approved normally"), true, "conflict field cannot be approved normally");
assert.equal(validateApproval({ ...safeApproval, aiEvidence: "" }).includes("missing evidence cannot be approved normally"), true, "missing evidence cannot be approved normally");
assert.equal(validateApproval({ ...safeApproval, reason: "dirty_or_invalid_employer" } as any).includes("dirty employer or fake identity cannot be approved normally"), true, "dirty employer cannot be approved normally");
assert.equal(validateApproval({ ...safeApproval, reason: "dirty_or_invalid_identity" } as any).includes("dirty employer or fake identity cannot be approved normally"), true, "fake identity cannot be approved normally");

const routeSource = fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/approvals/route.ts", import.meta.url), "utf8");
assert.equal(/supabase|\.update\(|\.delete\(|\.insert\(/i.test(routeSource), false, "approval API must not write to DB");
assert.equal(/from ["']openai["']|OpenAI/.test(routeSource), false, "approval API must not call OpenAI");

console.log("AI extraction approval store tests passed");
