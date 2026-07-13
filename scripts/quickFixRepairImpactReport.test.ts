import assert from "node:assert/strict";
import { buildQuickFixRepairImpactReport } from "../lib/quickFixRepairImpactReport";
const report=buildQuickFixRepairImpactReport();assert.equal(report.mode.includes("no candidate DB writes"),true,"repair impact is read-only");assert.equal(report.subsetItems>=0,true,"repair impact counts subset items");console.log("Quick fix repair impact report tests passed");
