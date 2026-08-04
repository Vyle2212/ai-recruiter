import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadStagingStore, stageApprovedChanges, stagingStorePath } from "../lib/aiExtractionStagingStore";
import type { AiExtractionStagingRecord } from "../lib/aiExtractionStagingPreview";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ai-staging-store-"));
fs.mkdirSync(path.join(tmp, "reports"));
const stagingPath = stagingStorePath(tmp);

const item: AiExtractionStagingRecord = {
  stagingId: "candidate-1:currentCompany:candidate-1:currentCompany",
  candidateId: "candidate-1",
  candidateName: "Jane Fico",
  fieldName: "currentCompany",
  currentValue: "",
  approvedValue: "Accenture",
  parserValue: "Not disclosed",
  aiEvidence: "Accenture Jan 2024 - Present",
  aiConfidence: 96,
  approvalDecision: "approve_suggestion",
  reviewerNote: "",
  overrideReason: "",
  riskLevel: "safe",
  applyReadiness: "staged_safe",
  validationStatus: "valid",
  validationReasons: [],
  sourceApprovalId: "candidate-1:currentCompany",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stagedBy: "local-review",
  appliedToCandidate: false,
};

const dryRun = stageApprovedChanges([item], { dryRun: true, baseDir: tmp });
assert.equal(dryRun.dryRun, true, "dry-run should be true by default");
assert.equal(fs.existsSync(stagingPath), false, "dry-run does not write staging file");

const written = stageApprovedChanges([item], { dryRun: false, writeStaging: true, baseDir: tmp });
assert.equal(written.dryRun, false, "writeStaging should disable dry-run only when explicit");
assert.equal(fs.existsSync(stagingPath), true, "writeStaging writes local staging JSON only");
const store = loadStagingStore(tmp);
assert.equal(store.items.length, 1, "staging file should load written item");
assert.equal(store.items[0].appliedToCandidate, false, "real candidate data is never marked applied");
assert.equal(store.items[0].stagedBy, "local-review", "staged record should include stagedBy local-review");

const source = fs.readFileSync(new URL("../lib/aiExtractionStagingStore.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/stage-approved/route.ts", import.meta.url), "utf8");
assert.equal(/supabase|\.update\(|\.delete\(|\.insert\(/i.test(source), false, "staging store must not update Supabase candidates");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "staging store must not call OpenAI");

console.log("AI extraction staging store tests passed");
