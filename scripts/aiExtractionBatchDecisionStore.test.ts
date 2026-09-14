import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import {
  previewBatchBulkDecision,
  applyBatchBulkDecision,
} from "../lib/aiExtractionBatchDecisionStore";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const { setRecruiterApiAuthorizationResolverForTests } =
    await import("../lib/recruiterApiAuthorization");
  setRecruiterApiAuthorizationResolverForTests(async () => ({
    allowed: true,
    scope: {
      version: "recruiter-api-security-wave-a-v1",
      subjectId: "test-user",
      profileId: "test-profile",
      role: "admin",
      organizationId: null,
      cacheKey: "test-scope",
    },
  }));
  const { POST } =
    await import("../app/api/recruiter/ai-extraction-review/batch-decisions-preview/route");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "batch-decisions-"));
  const reviewPath = path.join(tmp, "review.json");
  const approvalsPath = path.join(tmp, "approvals.json");
  const applyHistoryPath = path.join(tmp, "history.json");
  writeJson(reviewPath, {
    queueItems: [
      { candidateId: "c1", existingName: "Jane", source: "batch_promotion" },
      { candidateId: "c2", existingName: "Bad", source: "batch_promotion" },
    ],
    fieldComparisons: [
      {
        candidateId: "c1",
        source: "batch_promotion",
        fieldComparisons: [
          {
            field: "currentCompany",
            existingValue: "",
            aiValue: "Acme",
            evidence: "Employer Acme",
            confidence: 95,
            decision: "safe_accept",
            source: "batch_promotion",
          },
        ],
      },
      {
        candidateId: "c2",
        source: "batch_promotion",
        fieldComparisons: [
          {
            field: "unsupportedField",
            existingValue: "",
            aiValue: "Value",
            evidence: "Evidence",
            confidence: 95,
            decision: "safe_accept",
            source: "batch_promotion",
          },
        ],
      },
    ],
  });
  writeJson(approvalsPath, {
    mode: "local",
    updatedAt: "",
    approvals: [
      {
        approvalId: "existing:title",
        candidateId: "existing",
        fieldName: "title",
        decision: "keep_existing",
      },
    ],
  });
  writeJson(applyHistoryPath, { items: [] });
  const beforeApprovals = fs.readFileSync(approvalsPath, "utf8");
  const preview = previewBatchBulkDecision({
    decision: "approve_safe",
    reviewPath,
    approvalsPath,
    applyHistoryPath,
  });
  assert.equal(
    preview.summary.wouldApproveCount,
    1,
    "preview selects one safe approval",
  );
  assert.equal(
    fs.readFileSync(approvalsPath, "utf8"),
    beforeApprovals,
    "preview bulk approve does not write approvals file",
  );
  const applyApprove = applyBatchBulkDecision({
    decision: "approve_safe",
    reviewPath,
    approvalsPath,
    applyHistoryPath,
    writeApprovalsFile: true,
  }) as any;
  assert.equal(
    applyApprove.writtenCount,
    1,
    "apply bulk approve writes approvals file",
  );
  const afterApprove = fs.readFileSync(approvalsPath, "utf8");
  assert.notEqual(
    afterApprove,
    beforeApprovals,
    "approval file changed after explicit write",
  );
  assert.equal(
    JSON.parse(afterApprove).approvals.some(
      (approval: any) => approval.source === "batch_decision_workflow",
    ),
    true,
    "approval metadata added",
  );
  const applyReject = applyBatchBulkDecision({
    decision: "reject_invalid",
    reviewPath,
    approvalsPath,
    applyHistoryPath,
    writeApprovalsFile: true,
  }) as any;
  assert.equal(
    applyReject.summary.wouldRejectCount,
    1,
    "apply bulk reject writes only approvals file candidates",
  );
  const preserveAgain = applyBatchBulkDecision({
    decision: "approve_safe",
    reviewPath,
    approvalsPath,
    applyHistoryPath,
    writeApprovalsFile: true,
  }) as any;
  assert.equal(preserveAgain.writtenCount, 0, "overwrite disabled by default");
  assert.ok(fs.existsSync(approvalsPath), "approvals file exists");
  const apiResponse = await POST(
    new Request(
      "http://localhost/api/recruiter/ai-extraction-review/batch-decisions-preview",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "approve_safe",
          source: "batch_promotion",
          outputPath: path.join(tmp, "api-preview.json"),
        }),
      },
    ) as any,
  );
  const apiJson = await apiResponse.json();
  assert.equal(Boolean(apiJson.summary), true, "API preview returns summary");
  const source =
    fs.readFileSync(
      new URL("../lib/aiExtractionBatchDecisionStore.ts", import.meta.url),
      "utf8",
    ) +
    fs.readFileSync(
      new URL("../lib/aiExtractionBatchDecisionWorkflow.ts", import.meta.url),
      "utf8",
    );
  assert.equal(
    /\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source),
    false,
    "no candidate DB writes and no delete",
  );
  setRecruiterApiAuthorizationResolverForTests(null);
  assert.equal(
    /writeFileSync\([^)]*ai-extraction-staging\.json/i.test(source),
    false,
    "no staging writes",
  );
  assert.equal(
    /applyCandidateChangesFromStaging|rollbackCandidate|confirmApply|confirmRollback/i.test(
      source,
    ),
    false,
    "no real apply or rollback calls",
  );
  assert.equal(
    /from ["']openai["']|new\s+OpenAI\b/i.test(source),
    false,
    "no OpenAI calls",
  );
  console.log("AI extraction batch decision store tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
