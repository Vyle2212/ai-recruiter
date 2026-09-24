import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { buildCandidateProfileConfirmation } from "../lib/candidateProfileConfirmation";

const current = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Alex Tan",
  email: "alex@example.com",
  phone: "+6591234567",
  current_title: "SAP FICO Consultant",
  current_company: "Employer One",
  location: "Singapore",
  experience: [
    {
      employer: "Employer One",
      title: "SAP FICO Consultant",
      start_date: "2021-01",
      current: true,
    },
  ],
  sap_modules: ["FICO"],
  primary_module: "FICO",
  skills: ["SAP FI", "SAP CO"],
  projects: [
    {
      project: "S/4HANA Transformation",
      client: "Client One",
      role: "FICO Consultant",
      start_date: "2022-01",
      end_date: "2023-06",
    },
  ],
  education: [{ institution: "Example University", degree: "BSc" }],
  certifications: [{ name: "SAP FICO" }],
  languages: [{ language: "English", proficiency: "Professional" }],
  profile_quality_score: 90,
  status: "needs_review",
  updated_at: "2026-09-24T00:00:00.000Z",
};
const profile = buildCandidate360Profile(current);
const fields = {
  displayName: "Alex Tan",
  email: "alex@example.com",
  phone: "+6591234567",
  currentTitle: "SAP FICO Consultant",
  currentCompany: "Employer One",
  location: "Singapore",
  workExperience: JSON.stringify(current.experience),
  sapModules: "FICO",
  techSkills: "SAP FI, SAP CO",
  projectExperience: JSON.stringify(current.projects),
  education: JSON.stringify(current.education),
  certifications: JSON.stringify(current.certifications),
  languages: JSON.stringify(current.languages),
  confirmAccuracy: true,
  consentToShare: true,
};

const accepted = buildCandidateProfileConfirmation({
  candidateId: current.id,
  submittedFields: fields,
  profile,
  currentCandidate: current,
});
assert.equal(accepted.accepted, true);
if (accepted.accepted) {
  assert.equal(
    accepted.candidatePayload.experience[0].employer,
    "Employer One",
  );
  assert.equal(accepted.candidatePayload.projects[0].client, "Client One");
  assert.equal(
    accepted.candidatePayload.projects[0].project,
    "S/4HANA Transformation",
  );
  assert.equal(accepted.searchRow.candidate_id, current.id);
  assert.equal(accepted.searchRow.primary_module, "FICO");
}

for (const [label, patch] of [
  ["sharing consent", { consentToShare: false }],
  ["skills", { techSkills: "" }],
  [
    "invalid date",
    {
      workExperience: JSON.stringify([
        {
          employer: "Employer One",
          title: "Consultant",
          start_date: "May 2022",
          current: true,
        },
      ]),
    },
  ],
  [
    "incomplete second row",
    {
      workExperience: JSON.stringify([
        ...current.experience,
        { employer: "Employer Two", title: "Consultant" },
      ]),
    },
  ],
  [
    "project date",
    {
      projectExperience: JSON.stringify([
        { project: "P", role: "Consultant", start_date: "2022-01" },
      ]),
    },
  ],
] as const) {
  const result = buildCandidateProfileConfirmation({
    candidateId: current.id,
    submittedFields: { ...fields, ...patch },
    profile,
    currentCandidate: current,
  });
  assert.equal(result.accepted, false, `${label} must fail closed`);
}

const transaction = fs.readFileSync(
  "supabase/manual/202609240016_candidate_profile_confirmation.sql",
  "utf8",
);
const readback = fs.readFileSync(
  "supabase/manual/202609240017_candidate_profile_confirmation_readback.sql",
  "utf8",
);
const route = fs.readFileSync(
  "app/api/candidate/profile/confirmation/route.ts",
  "utf8",
);
assert.match(transaction, /for update/gi);
assert.match(transaction, /candidate_profile_confirmation_stale_version/);
assert.match(
  transaction,
  /candidate_profile_confirmation_verified_email_mismatch/,
);
assert.match(
  transaction,
  /profile_confirmation_status = 'candidate_confirmed'/,
);
assert.match(
  transaction,
  /extraction_coverage_status = 'complete_for_validation'/,
);
assert.match(
  transaction,
  /coalesce\(c\.profile_source_state, '\{\}'::jsonb\)\s*\|\|/,
);
assert.match(
  transaction,
  /coalesce\(c\.profile_source_state->'field_sources', '\{\}'::jsonb\)\s*\|\|/,
);
assert.match(transaction, /delete from public\.candidate_search_index/);
assert.match(transaction, /insert into public\.candidate_search_index/);
assert.match(transaction, /p_accuracy_consent is distinct from true/);
assert.match(transaction, /p_sharing_consent is distinct from true/);
assert.match(transaction, /security invoker/);
assert.match(transaction, /set search_path = ''/);
assert.match(
  transaction,
  /revoke all on function public\.apply_candidate_profile_confirmation[\s\S]+from public, anon, authenticated/,
);
assert.match(readback, /READ-ONLY/);
assert.doesNotMatch(
  readback,
  /^\s*(?:alter|create|delete|drop|grant|insert|revoke|truncate|update)\b/im,
);
assert.match(route, /authorizeCandidateCvUpload/);
assert.match(route, /CANDIDATE_PROFILE_CONFIRMATION_ENABLED !== "true"/);
assert.match(
  route,
  /expectedUpdatedAt !== authorization\.scope\.candidateUpdatedAt/,
);
assert.match(route, /apply_candidate_profile_confirmation/);
assert.match(route, /candidate_profile_verified_email_required/);
assert.doesNotMatch(route, /body\.candidateId|body\.candidate_id/);
console.log("candidateProfileConfirmation.test.ts passed");
