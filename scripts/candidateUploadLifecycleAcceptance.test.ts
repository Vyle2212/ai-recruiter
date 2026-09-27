import assert from "node:assert/strict";

import { prepareCandidateCv } from "../lib/candidateCvIngestion";
import { evaluateCandidateProfileCompletion } from "../lib/candidateProfileIngestion";
import { candidateSearchLifecycleDecision } from "../lib/candidateSearchLifecycle";

const cv = `Synthetic Candidate
Email: synthetic@example.invalid
Location: Singapore

PROFESSIONAL SUMMARY
SAP MM consultant delivering procurement and inventory configuration, SAP S/4HANA implementation, rollout, integration testing, cutover and hypercare.

WORK EXPERIENCE
SAP MM Consultant | Synthetic Consulting | Jan 2020 - Present
Led SAP MM delivery for multiple customer assignments at Synthetic Consulting.

PROJECT EXPERIENCE
Project: S/4HANA procurement rollout
Client: Synthetic Manufacturing
Role: SAP MM Consultant
Jan 2022 - Dec 2023
Led blueprint workshops, configuration, migration, testing and go-live.

Project: Inventory support transition
Client: Synthetic Logistics
Role: SAP MM Lead
Supported SAP MM operations, incident resolution and training.

EDUCATION
Bachelor of Computing

SKILLS
SAP MM, S/4HANA, Procurement, Inventory Management

LANGUAGES
English`;

async function main() {
  for (const source of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: Buffer.from(cv),
      fileName: "synthetic-sap-mm.txt",
      source,
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("synthetic_cv_rejected");
    const profile = prepared.candidatePayload;
    assert.equal(profile.profile_source_type, source);
    assert.equal(profile.current_company, "Synthetic Consulting");
    assert.equal(
      profile.employment_history[0].employer,
      "Synthetic Consulting",
    );
    assert.equal(profile.employment_history[0].start_date, "Jan 2020");
    assert.equal(profile.employment_history[0].current, true);
    assert.deepEqual(
      profile.project_history.map((project: Record<string, unknown>) => ({
        client: project.client,
        start: project.start_date,
        end: project.end_date,
      })),
      [
        {
          client: "Synthetic Manufacturing",
          start: "Jan 2022",
          end: "Dec 2023",
        },
        { client: "Synthetic Logistics", start: "", end: "" },
      ],
    );
    assert.equal(
      profile.employment_history.some((employment: Record<string, unknown>) =>
        ["Synthetic Manufacturing", "Synthetic Logistics"].includes(
          String(employment.employer),
        ),
      ),
      false,
      "client names must never become employers",
    );
    const completion = evaluateCandidateProfileCompletion(profile, {
      requireCandidateConfirmation: true,
    });
    assert.equal(completion.searchable, false);
    assert.equal(completion.confirmationRequired, true);
    assert.ok(
      completion.missingRequiredFields.includes(
        "candidate_accuracy_confirmation",
      ),
    );
    assert.deepEqual(
      completion.missingRequiredFields,
      ["candidate_accuracy_confirmation"],
      "fully extracted synthetic profile must need only accuracy confirmation",
    );
    assert.equal(
      evaluateCandidateProfileCompletion(
        { ...profile, profile_confirmation_status: "candidate_confirmed" },
        { requireCandidateConfirmation: true },
      ).searchable,
      true,
    );
    assert.equal(
      candidateSearchLifecycleDecision({
        status: "needs_review",
        extraction_coverage_status: profile.extraction_coverage_status,
        profile_confirmation_status: "claimed_incomplete",
      }).visible,
      false,
    );
  }
  console.log(
    "Synthetic candidate upload, employer/project and search gate passed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
