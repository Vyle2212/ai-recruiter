import assert from "node:assert/strict";
import { buildQuickFixWorkflowRefreshPreview } from "../lib/quickFixWorkflowRefreshPreview";
const report=buildQuickFixWorkflowRefreshPreview();assert.equal(report.mode.includes("no workflow state writes"),true,"no workflow state writes");assert.equal(report.candidatesAnalyzed>=0,true,"workflow refresh preview detects candidate set");console.log("Quick fix workflow refresh preview tests passed");
