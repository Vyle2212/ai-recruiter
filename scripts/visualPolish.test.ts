import assert from "node:assert/strict";
import fs from "node:fs";
import { buildVisualPolishAudit } from "./auditVisualPolish";
const report=buildVisualPolishAudit();
assert.equal(report.dashboardPrimaryCta,true);
assert.equal(report.safetyLabelsNormalized,true);
assert.equal(report.productHealthEncodingClean,true);
assert.equal(report.smartShortlistLoadingFallback,true);
assert.equal(report.formHelperPanels,true);
assert.equal(report.tableReadabilityHelpers,true);
assert.equal(report.navigationLinksPresent,true);
assert.equal(report.emptyStatesPresent,true);
assert.equal(report.candidateDbWrites,0);
assert.equal(report.workflowWrites,0);
assert.equal(report.noOpenAiCalls,true);
assert.equal(report.passed,true);
assert.ok(!fs.readFileSync("app/recruiter/dashboard/page.tsx","utf8").includes("\uFFFD"));
console.log("visualPolish.test.ts passed");

