import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildUiPolishBacklog,UI_POLISH_CATEGORIES } from "./auditUiPolishBacklog";
const report=buildUiPolishBacklog();for(const category of UI_POLISH_CATEGORIES)assert.ok(report.categories.includes(category));assert.equal(report.pagesReviewed,10);assert.equal(report.recommendedNextUiMilestone,"visual-polish-v1");assert.equal(report.candidateDbWrites,0);assert.equal(report.workflowWrites,0);assert.equal(report.openAiCalls,0);assert.ok(fs.existsSync(path.join(process.cwd(),"docs","manual-ui-check-v1.md")));assert.ok(report.items.every(item=>item.readOnly));console.log("uiPolishBacklog.test.ts passed");

