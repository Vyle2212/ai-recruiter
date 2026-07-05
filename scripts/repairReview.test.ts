import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidateRepairReview, parseRepairReviewQuery } from "../lib/candidateRepairReview";

const candidates = [
  {
    id: "safe-1",
    name: "Candidate profile pending validation",
    current_title: "SAP FICO Consultant",
    current_company: "over 10 years consulting experience",
    primary_module: "UNKNOWN",
    years: 8,
    location: "Malaysia",
    raw_text: "Full Name: Ravi Kumar Gender Male WORK EXPERIENCE Jan 2021 - Present Accenture Malaysia SAP FICO Consultant Skills SAP FICO",
  },
  {
    id: "review-1",
    name: "Candidate profile pending validation",
    current_title: "Professional Objective",
    current_company: "Not disclosed",
    primary_module: "UNKNOWN",
    raw_text: "SAP FICO consultant profile without trusted identity",
  },
  {
    id: "insufficient-1",
    name: "Candidate profile pending validation",
    current_title: "Professional Objective",
    current_company: "Not disclosed",
    primary_module: "UNKNOWN",
    raw_text: "generic resume text",
  },
];

const parsed = parseRepairReviewQuery(new URLSearchParams("page=1&pageSize=1&action=safe_to_apply_later&searchableAfterRepair=true&q=ravi"));
assert.equal(parsed.pageSize, 1, "pageSize should be parsed");
assert.equal(parsed.action, "safe_to_apply_later", "action filter should be parsed");
assert.equal(parsed.searchableAfterRepair, "true", "searchableAfterRepair filter should be parsed");

const review = buildCandidateRepairReview(candidates, parsed);
assert.equal(review.items.length, 1, "pageSize=1 should return one item");
assert.equal(review.returnedCount, review.items.length, "returnedCount should equal items.length");
assert.equal(review.items[0].candidateId, "safe-1", "q search should match repair candidate fields");
assert.equal(review.items[0].profileHref.includes("/candidates/safe-1"), true, "item should include Candidate360 profileHref");
assert.equal(Boolean(review.items[0].reviewLabel), true, "item should include reviewLabel");
assert.equal(review.summary.totalValidationQueue, 3, "summary should include total validation queue count");
assert.equal(typeof review.summary.safeToApplyLater, "number", "summary should include safeToApplyLater");
assert.equal(typeof review.summary.needsRecruiterReview, "number", "summary should include needsRecruiterReview");
assert.equal(typeof review.summary.insufficientEvidence, "number", "summary should include insufficientEvidence");
assert.equal(typeof review.summary.suggestedSearchableAfterRepair, "number", "summary should include suggestedSearchableAfterRepair");

const actionFiltered = buildCandidateRepairReview(candidates, { action: "needs_recruiter_review", page: 1, pageSize: 25 });
assert.equal(actionFiltered.items.every((item) => item.action === "needs_recruiter_review"), true, "action filter should work");
const searchableFiltered = buildCandidateRepairReview(candidates, { searchableAfterRepair: "false", page: 1, pageSize: 25 });
assert.equal(searchableFiltered.items.every((item) => item.searchableAfterRepair === false), true, "searchableAfterRepair false filter should work");

const routeSource = fs.readFileSync(new URL("../app/api/repair-review/route.ts", import.meta.url), "utf8");
assert.equal(routeSource.includes("buildCandidateRepairReview"), true, "repair review API should use shared review builder");
assert.equal(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(routeSource), false, "repair review API must be read-only GET only");
assert.equal(/\.update\(|\.insert\(|\.delete\(/.test(routeSource), false, "repair review API must not write to Supabase");

const pageSource = fs.readFileSync(new URL("../app/repair-review/page.tsx", import.meta.url), "utf8");
assert.equal(pageSource.includes("/api/repair-review"), true, "repair review page should load repair review API");
assert.equal(pageSource.includes("READ-ONLY / No DB Write"), true, "repair review page should show read-only badge");
assert.equal(pageSource.includes("Candidate360"), true, "repair review page should link to Candidate360");

const exportSource = fs.readFileSync(new URL("../scripts/exportCandidateRepairReview.ts", import.meta.url), "utf8");
assert.equal(exportSource.includes("reports"), true, "export should write under reports directory");
assert.equal(exportSource.includes("candidate-repair-review.json"), true, "export should create repair review JSON");
assert.equal(/\.update\(|\.insert\(|\.delete\(/.test(exportSource), false, "export script must not write to DB");

console.log("Repair review tests passed");
