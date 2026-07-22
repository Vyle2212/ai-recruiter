import assert from "node:assert/strict";
import fs from "node:fs";
import { buildImportMergePreview, buildImportStagingBatch, compareImportedToExisting, matchImportedCandidate } from "../lib/importStaging";

const existing = [
  { id: "c1", name: "Jane Tan", email: "jane@example.com", phone: "+65 9123 4567", current_company: "", current_title: "SAP FICO Lead", location: "Singapore", field_metadata: { email: { source: "candidate_confirmed" }, currentTitle: { source: "recruiter_approved" } } },
  { id: "c2", name: "Alex Wong", current_company: "Acme Consulting", current_title: "SAP MM Consultant", location: "Malaysia" },
  { id: "c3", name: "Duplicate Person", current_company: "Shared Co", current_title: "SAP Consultant" },
  { id: "c4", name: "Duplicate Person", current_company: "Shared Co", current_title: "SAP Consultant" },
];
assert.equal(matchImportedCandidate({ email: "JANE@example.com" }, existing).status, "exact_match", "exact email match");
assert.equal(matchImportedCandidate({ name: "Alex Wong", current_company: "Acme Consulting" }, existing).status, "likely_match", "likely name/company match");
assert.equal(matchImportedCandidate({ name: "Duplicate Person", current_company: "Shared Co" }, existing).status, "duplicate_risk", "duplicate risk detection");

const trusted = compareImportedToExisting({ email: "new@example.com", current_title: "Different Lead", current_company: "New Company" }, existing[0]);
assert.equal(trusted.find((item) => item.fieldName === "email")?.recommendation, "needs_recruiter_review", "candidate confirmed field is not overwritten");
assert.equal(trusted.find((item) => item.fieldName === "currentTitle")?.recommendation, "needs_recruiter_review", "recruiter approved field is not overwritten");
assert.equal(trusted.find((item) => item.fieldName === "currentCompany")?.recommendation, "update_existing", "empty existing field can be filled");

const generic = compareImportedToExisting({ current_company: "Financial Services", current_title: "Consultant" }, {});
assert.equal(generic.find((item) => item.fieldName === "currentCompany")?.recommendation, "reject_import", "generic company blocked");
assert.equal(generic.find((item) => item.fieldName === "currentTitle")?.blocked, true, "generic title blocked");
const conflict = compareImportedToExisting({ location: "Thailand", locationConfidence: 90 }, { location: "Singapore" });
assert.equal(conflict.find((item) => item.fieldName === "location")?.recommendation, "needs_recruiter_review", "conflict requires recruiter review");

const batch = buildImportStagingBatch([{ name: "Brand New Person", email: "brand.new@example.test", current_company: "Specific Systems", current_title: "SAP EWM Lead", location: "Vietnam" }], existing, { batchName: "test", now: () => new Date("2026-07-22T00:00:00.000Z") });
assert.equal(batch.candidates[0].match.status, "new_candidate");
assert.equal(batch.candidates[0].recommendation, "create_new_candidate", "new candidate recommendation");
assert.equal(batch.preservationPolicy.preserveExistingCandidateIds, true);
assert.equal(buildImportMergePreview(batch).candidateDbWritePerformed, false, "merge preview does not write candidate DB");

const sources = ["../lib/importStaging.ts", "../scripts/createImportStagingBatch.ts", "../scripts/auditImportStagingBatch.ts", "../app/api/import-staging/route.ts", "../app/api/import-staging/preview/route.ts"].map((file) => fs.readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
assert.equal(/\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(sources), false, "no candidate DB writes");
assert.equal(/\b(?:unlink|rmSync|rmdir)\b/.test(sources), false, "no delete");
assert.equal(/from ["']openai["']|new OpenAI|\.responses\.create/.test(sources), false, "no OpenAI calls");
console.log("Import staging tests passed");
