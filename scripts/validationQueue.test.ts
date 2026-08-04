import fs from "node:fs";
import assert from "node:assert/strict";
import { classifyCandidateSearchVisibility, getCandidateValidationQueueIssues } from "../lib/candidateSearchVisibility";
import { paginateValidationQueueItems, parseValidationQueuePagination } from "../lib/validationQueuePagination";

const blockedCandidate = {
  id: "blocked-1",
  name: "Candidate profile pending validation",
  current_title: "Professional Objective",
  current_company: "Managed &",
  primary_module: "UNKNOWN",
  email: "",
  phone: "",
  location: "",
  profile_quality_score: 45,
};

const readyCandidate = {
  id: "ready-1",
  name: "Lee Wah Ken",
  current_title: "SAP MM Consultant",
  current_company: "Accenture Malaysia",
  primary_module: "MM",
  email: "lee@example.com",
  phone: "+60 12 345 6789",
  location: "Malaysia",
  profile_quality_score: 85,
};

assert.equal(classifyCandidateSearchVisibility(blockedCandidate).blocked_from_recruiter_search, true, "blocked extraction profiles should enter Validation Queue");
assert.equal(classifyCandidateSearchVisibility(readyCandidate).blocked_from_recruiter_search, false, "recruiter-ready profiles should remain in Talent Search");
const issueKeys = getCandidateValidationQueueIssues(blockedCandidate).map((issue) => issue.key);
assert.equal(issueKeys.includes("invalid-name"), true, "Validation Queue should group invalid names");
assert.equal(issueKeys.includes("missing-contact"), true, "Validation Queue should group missing contact");
assert.equal(issueKeys.includes("missing-sap-module"), true, "Validation Queue should group missing SAP module");
assert.equal(issueKeys.includes("missing-location"), true, "Validation Queue should group missing location");
assert.equal(issueKeys.includes("invalid-title"), true, "Validation Queue should group invalid title");
assert.equal(issueKeys.includes("invalid-company"), true, "Validation Queue should group invalid company");

const fixtureQueue = [blockedCandidate, readyCandidate]
  .map((candidate) => ({ candidate, visibility: classifyCandidateSearchVisibility(candidate) }))
  .filter((entry) => entry.visibility.blocked_from_recruiter_search);
const groupedInvalidNames = fixtureQueue.filter((entry) => getCandidateValidationQueueIssues(entry.candidate).some((issue) => issue.key === "invalid-name"));
const { page, pageSize } = parseValidationQueuePagination(new URLSearchParams("page=1&pageSize=1"));
const { paginatedItems, totalPages } = paginateValidationQueueItems(fixtureQueue, page, pageSize);
const legacyLimit = parseValidationQueuePagination(new URLSearchParams("page=1&limit=7"));
const clamped = parseValidationQueuePagination(new URLSearchParams("page=0&pageSize=500"));
assert.equal(fixtureQueue.length, 1, "fixture totalMatched should match blocked candidate count");
assert.equal(pageSize, 1, "pageSize param should be honored");
assert.equal(paginatedItems.length, 1, "pageSize=1 should return exactly 1 item");
assert.equal(paginatedItems.length, 1, "returnedCount should equal items.length");
assert.equal(totalPages, 1, "totalPages should use Math.ceil(totalMatched / pageSize)");
assert.equal(legacyLimit.pageSize, 7, "limit should remain a backward-compatible pageSize alias");
assert.equal(clamped.page, 1, "page should clamp to minimum 1");
assert.equal(clamped.pageSize, 100, "pageSize should clamp to maximum 100");
assert.equal(groupedInvalidNames.length, 1, "group filter should still find invalid-name blocked candidates");

const routeSource = fs.readFileSync(new URL("../app/api/validation-queue/route.ts", import.meta.url), "utf8");
assert.equal(routeSource.includes("classifyCandidateSearchVisibility"), true, "Validation Queue API should use shared Talent Search visibility gate");
assert.equal(routeSource.includes("getCandidateValidationQueueIssues"), true, "Validation Queue API should return issue grouping metadata");
assert.equal(routeSource.includes("parseValidationQueuePagination"), true, "Validation Queue API should parse standard page/pageSize params");
assert.equal(routeSource.includes("paginateValidationQueueItems(blocked, page, pageSize)"), true, "Validation Queue API should paginate after group/search filtering");
assert.equal(routeSource.includes("items: paginatedItems"), true, "Validation Queue API should return the paginated item slice");
assert.equal(routeSource.includes("totalMatched: blocked.length"), true, "Validation Queue API should report filtered totalMatched");
assert.equal(routeSource.includes("returnedCount: paginatedItems.length"), true, "Validation Queue API returnedCount should equal items.length");
assert.equal(routeSource.includes("totalPages,"), true, "Validation Queue API should report totalPages from totalMatched/pageSize");
assert.equal(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(routeSource), false, "Validation Queue API v1 must be read-only");
assert.equal(routeSource.includes(".update("), false, "Validation Queue API must not update Supabase records");
assert.equal(routeSource.includes(".insert("), false, "Validation Queue API must not insert Supabase records");
assert.equal(routeSource.includes(".delete("), false, "Validation Queue API must not delete Supabase records");

const pageSource = fs.readFileSync(new URL("../app/validation-queue/page.tsx", import.meta.url), "utf8");
assert.equal(pageSource.includes("/api/validation-queue"), true, "Validation Queue page should load read-only queue API");
assert.equal(pageSource.includes("View Profile"), true, "Validation Queue should let recruiters open profile detail");
assert.equal(pageSource.includes("Talent Search"), true, "Validation Queue should keep Talent Search as a separate clean-search workflow");

console.log("Validation Queue UI tests passed");