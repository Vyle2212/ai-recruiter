import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildGuidedSearchIdentity, guidedIdentityMatchesQuery, validGuidedSearchSnapshot } from "../lib/guidedSearchIdentity";
import type { GuidedSearchHandoff } from "../lib/guidedSourcingTypes";

const query = "SAP FICO Consultant, minimum 5 years, Japanese and English, two implementations, Tokyo, Japan";
const handoff = {
  query,
  filters: { countries: ["Japan"], skills: ["Japanese", "English"], sapModules: ["SAP FICO"] },
  integrityPlan: { version: "search-integrity-v20", planIdentity: "jp-fico", includeRelocationRemote: false, requirements: [] },
  provenance: { schemaVersion: "guided-sourcing-plan-v1", confirmedCriterionIds: [], sourceType: "uploaded_jd", sourceIdentity: "uploaded_jd:jp-fico", sourceFingerprint: "jp-fico" },
  savePreviewParams: {},
} satisfies GuidedSearchHandoff;
const identity = buildGuidedSearchIdentity(handoff, 1);
assert.equal(guidedIdentityMatchesQuery(identity, `  ${query}  `), true);
assert.equal(guidedIdentityMatchesQuery(identity, "SAP CPI Consultant Malaysia"), false);
assert.equal(guidedIdentityMatchesQuery(identity, "SAP OTC Consultant Singapore"), false);
const snapshot = { identity, integrityPlan: handoff.integrityPlan, provenance: handoff.provenance };
assert.equal(validGuidedSearchSnapshot(snapshot, query), true);
assert.equal(validGuidedSearchSnapshot(snapshot, "SAP CPI Consultant Malaysia"), false);
assert.equal(validGuidedSearchSnapshot({ ...snapshot, identity: { ...identity, planId: "other" } }, query), false);
const client = fs.readFileSync(path.join(process.cwd(), "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx"), "utf8");
// The underlying isolation contract remains, while the user-facing product uses unified Search language.
assert.match(client, /Suggested Criteria cleared because the search description changed\./);
assert.doesNotMatch(client, /Start guided search/i);
assert.match(client, /!guidedIdentityMatchesQuery\(guidedSearchIdentity, nextQuery\)/);
assert.match(client, /const guidedPlanMatchesRequest = guidedIdentityMatchesQuery/);
assert.match(client, /guidedPlanMatchesRequest\s*\? guidedIntegrityPlan\s*:\s*null/);
assert.match(client, /latestRequestIdRef\.current \+= 1/);
assert.match(client, /activeAbortControllerRef\.current\?\.abort\(\)/);
assert.match(client, /setExpandedCandidateId\(""\)/);
assert.match(client, /validGuidedSearchSnapshot\(item\.guidedPlanSnapshot, item\.query\)/);
assert.match(client, /onSourceIdentityChange=\{\(\) => invalidateGuidedSearch\(false\)\}/);
assert.match(client, /No candidates meet all required criteria\./);
console.log("guided search query/plan identity isolation tests passed");
