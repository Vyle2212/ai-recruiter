import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateCandidateProfileCompletion,
  resolveCandidateIngestion,
} from "../lib/candidateProfileIngestion";

const uploadPage = fs.readFileSync(
  new URL("../app/upload/page.tsx", import.meta.url),
  "utf8",
);
const uploadRoute = fs.readFileSync(
  new URL("../app/api/upload-cv/route.ts", import.meta.url),
  "utf8",
);
const saveCandidate = fs.readFileSync(
  new URL("../lib/saveCandidate.ts", import.meta.url),
  "utf8",
);
const claimSql = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240005_candidate_profile_claim_and_provenance.sql",
    import.meta.url,
  ),
  "utf8",
);
const readbackSql = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240006_candidate_profile_claim_readback.sql",
    import.meta.url,
  ),
  "utf8",
);
const fullProfileSql = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240007_candidate_full_profile_fields.sql",
    import.meta.url,
  ),
  "utf8",
);
const fullProfileReadbackSql = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240008_candidate_full_profile_fields_readback.sql",
    import.meta.url,
  ),
  "utf8",
);

assert.match(
  uploadPage,
  /UPLOAD_CHUNK_SIZE = 8/,
  "970+ CV uploads must be chunked instead of sent as one oversized request",
);
assert.match(uploadPage, /createdCount/);
assert.match(uploadPage, /updatedCount/);
assert.match(uploadPage, /heldForReviewCount/);
assert.match(uploadPage, /incompleteExtractionCount/);
assert.match(uploadRoute, /IDENTITY_REVIEW_REQUIRED/);
assert.match(uploadRoute, /ingestionAction/);
assert.match(uploadRoute, /evaluateCandidateExtractionCoverage/);
assert.match(uploadRoute, /enrichCandidateUpload/);
assert.match(saveCandidate, /resolveCandidateIngestion/);
assert.doesNotMatch(
  saveCandidate,
  /slice\(-8\) === phoneDigits\.slice\(-8\)/,
  "unsafe last-eight phone auto-merge must stay removed",
);

assert.match(claimSql, /auth\.uid\(\)/);
assert.match(claimSql, /role = 'candidate'/);
assert.match(claimSql, /identity_review_required/);
assert.match(claimSql, /security definer/);
assert.match(claimSql, /set search_path = ''/);
assert.match(
  claimSql,
  /revoke all on function private\.claim_candidate_profile\(\) from public, anon/,
);
assert.match(readbackSql, /begin transaction read only/);
assert.match(readbackSql, /has_function_privilege\('anon'/);
assert.match(fullProfileSql, /add column if not exists certifications jsonb/);
assert.match(fullProfileSql, /add column if not exists projects jsonb/);
assert.match(fullProfileSql, /incomplete_needs_review/);
assert.match(fullProfileReadbackSql, /begin transaction read only/);

const ambiguous = resolveCandidateIngestion(
  { name: "Same Person", email: "same@example.com" },
  [
    { id: "a", email: "same@example.com" },
    { id: "b", email: "same@example.com" },
  ],
);
assert.equal(ambiguous.disposition, "hold_for_identity_review");

const adminComplete = evaluateCandidateProfileCompletion(
  {
    name: "Complete Admin Profile",
    email: "complete@example.com",
    location: "Singapore",
    current_title: "SAP FICO Consultant",
    current_company: "Example Consulting",
    skills: ["Finance"],
    projects: [
      {
        client: "Example Client",
        role: "SAP FICO Consultant",
        start_date: "2021-01",
        end_date: "2022-12",
      },
    ],
    education: ["Bachelor of Accounting"],
    languages: ["English"],
    primary_module: "FICO",
    is_sap_profile: true,
    experience: [
      {
        employer: "Example Consulting",
        title: "SAP FICO Consultant",
        start_date: "2021-01",
        current: true,
      },
    ],
  },
  { requireCandidateConfirmation: false },
);
assert.equal(adminComplete.searchable, true);

console.log("candidateProfileLifecycleBatch.test.ts passed");
