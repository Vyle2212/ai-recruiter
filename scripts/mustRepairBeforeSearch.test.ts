import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { buildMustRepairBeforeSearchReview, parseMustRepairBeforeSearchQuery } from "../lib/mustRepairBeforeSearch";
import { writeMustRepairBeforeSearchReport, MUST_REPAIR_REPORT_PATH } from "./exportMustRepairBeforeSearch";

const base = {
  id: "ready-1",
  name: "Lee Wah Ken",
  current_title: "SAP MM Consultant",
  current_company: "Accenture Malaysia",
  primary_module: "MM",
  location: "Malaysia",
  email: "lee@example.com",
  phone: "+60 12 345 6789",
  profile_quality_score: 85,
  raw_text: "Lee Wah Ken SAP MM Consultant Accenture Malaysia S/4HANA ECC rollout support AMS migration",
};

const searchReady = base;
const normalEnrichment = { ...base, id: "enrich-1", current_company: "Not disclosed" };
const longTitle = { ...base, id: "long-title-1", current_title: "Experienced consultant responsible for end to end business process improvements and enterprise transformation delivery across multiple stakeholders" };
const unsafeCompany = { ...base, id: "bad-company-1", raw_company: "Accenture Malaysia", current_company: "where as my goal in the world" };
const statusIssue = { ...base, id: "deleted-1", status: "deleted" };
const blockedQueue = { ...base, id: "blocked-1", name: "Candidate profile pending validation" };

const review = buildMustRepairBeforeSearchReview([searchReady, normalEnrichment, longTitle, unsafeCompany, statusIssue, blockedQueue], { page: 1, pageSize: 25 });
assert.equal(review.summary.totalMustRepair, 3, "returns only must_repair_before_search candidates");
assert.equal(review.items.some((item) => item.candidateId === "ready-1"), false, "does not include search_ready candidates");
assert.equal(review.items.some((item) => item.candidateId === "enrich-1"), false, "does not include normal enrichment-only candidates");
assert.equal(review.items.find((item) => item.candidateId === "long-title-1")?.repairPriority, "invalid_title", "invalid long title maps to invalid_title priority");
assert.equal(review.items.find((item) => item.candidateId === "bad-company-1")?.repairPriority, "invalid_company", "unsafe company maps to invalid_company priority");
assert.equal(review.items.find((item) => item.candidateId === "deleted-1")?.repairPriority, "status_issue", "deleted/rejected status maps to status_issue priority");
assert.equal(review.items.every((item) => item.recommendedAction === "remove_from_search_until_repaired"), true, "must-repair items recommend removal until repaired");
assert.equal(review.mode, "read-only", "read-only mode is preserved");

const pageOne = buildMustRepairBeforeSearchReview([longTitle, unsafeCompany, statusIssue], { page: 1, pageSize: 1 });
const pageTwo = buildMustRepairBeforeSearchReview([longTitle, unsafeCompany, statusIssue], { page: 2, pageSize: 1 });
assert.equal(pageOne.items.length, 1, "API pagination works for pageSize=1");
assert.equal(pageOne.returnedCount, pageOne.items.length, "returnedCount equals items.length");
assert.equal(pageOne.totalPages, 3, "totalPages uses filtered count/pageSize");
assert.notEqual(pageOne.items[0].candidateId, pageTwo.items[0].candidateId, "pagination returns different pages");
const parsed = parseMustRepairBeforeSearchQuery(new URLSearchParams("page=0&pageSize=500&priority=invalid_title&q=sap"));
assert.equal(parsed.page, 1, "page clamps to minimum 1");
assert.equal(parsed.pageSize, 100, "pageSize clamps to maximum 100");
assert.equal(parsed.priority, "invalid_title", "priority filter parses");

const reportPath = path.join(process.cwd(), "reports", "must-repair-before-search.test.json");
const exported = writeMustRepairBeforeSearchReport([searchReady, longTitle, unsafeCompany], reportPath);
assert.equal(exported.totalMustRepair, 2, "export output has totalMustRepair count");
assert.equal(exported.mode, "read-only", "export preserves read-only mode");
assert.equal(exported.outputPath.endsWith("must-repair-before-search.test.json"), true, "test export path is local");
assert.equal(MUST_REPAIR_REPORT_PATH, "reports\\must-repair-before-search.json", "report path is stable");
if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

const routeSource = fs.readFileSync(new URL("../app/api/must-repair-before-search/route.ts", import.meta.url), "utf8");
assert.equal(routeSource.includes("buildMustRepairBeforeSearchReview"), true, "API should use shared must-repair helper");
assert.equal(routeSource.includes("parseMustRepairBeforeSearchQuery"), true, "API should parse page/pageSize/priority/q");
assert.equal(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(routeSource), false, "API v1 must be read-only");
assert.equal(routeSource.includes(".update("), false, "API must not update Supabase records");
assert.equal(routeSource.includes(".insert("), false, "API must not insert Supabase records");
assert.equal(routeSource.includes(".delete("), false, "API must not delete Supabase records");

const pageSource = fs.readFileSync(new URL("../app/must-repair-before-search/page.tsx", import.meta.url), "utf8");
assert.equal(pageSource.includes("READ-ONLY / No DB Write"), true, "UI should show read-only badge");
assert.equal(pageSource.includes("/api/must-repair-before-search"), true, "UI should load read-only API");
assert.equal(pageSource.includes("Candidate360"), true, "UI should link to Candidate360");

console.log("Must Repair Before Search tests passed");