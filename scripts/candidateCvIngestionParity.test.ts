import assert from "node:assert/strict";
import fs from "node:fs";

import {
  candidateCvRejectedOriginalPolicy,
  prepareCandidateCv,
} from "../lib/candidateCvIngestion";

const source = `
Jane Doe
Email: jane.doe@example.com
Phone: +65 9123 4567
Location: Singapore

PROFESSIONAL SUMMARY
SAP MM consultant with procurement, inventory management, configuration,
blueprint, integration testing, data migration, cutover and hypercare delivery.

WORK EXPERIENCE
SAP MM Consultant | Example Consulting | Jan 2020 - Present
Delivered SAP S/4HANA implementations and regional rollouts.

PROJECT EXPERIENCE
Client: Example Manufacturing
Role: SAP MM Consultant
Jan 2022 - Dec 2023
Led workshops, configuration, testing, migration, training and go-live support.

EDUCATION
Bachelor of Computing

CERTIFICATIONS
SAP Certified Associate

SKILLS
SAP MM, S/4HANA, Procurement, Inventory Management

LANGUAGES
English
`;

async function main() {
  const admin = await prepareCandidateCv({
    buffer: Buffer.from(source),
    fileName: "jane-doe.txt",
    source: "admin_upload",
  });
  const candidate = await prepareCandidateCv({
    buffer: Buffer.from(source),
    fileName: "jane-doe.txt",
    source: "candidate_upload",
  });

  assert.equal(admin.accepted, true);
  assert.equal(candidate.accepted, true);
  if (!admin.accepted || !candidate.accepted)
    throw new Error("fixture rejected");

  const withoutSource = (value: Record<string, any>) => {
    const copy = structuredClone(value);
    delete copy.profile_source_type;
    return copy;
  };
  assert.deepEqual(
    withoutSource(admin.candidatePayload),
    withoutSource(candidate.candidatePayload),
    "admin and candidate CVs must use the exact same extraction/parser output",
  );
  assert.equal(admin.candidatePayload.profile_source_type, "admin_upload");
  assert.equal(
    candidate.candidatePayload.profile_source_type,
    "candidate_upload",
  );
  assert.deepEqual(admin.extractionCoverage, candidate.extractionCoverage);
  assert.deepEqual(admin.parserQuality, candidate.parserQuality);
  assert.deepEqual(candidateCvRejectedOriginalPolicy("resume_quality"), {
    action: "hold_for_review",
    reasonCodes: ["resume_quality_rejected"],
  });
  assert.deepEqual(candidateCvRejectedOriginalPolicy("non_sap_or_non_cv"), {
    action: "hold_for_review",
    reasonCodes: ["candidate_classification_review_required"],
  });

  const lowEvidence = Buffer.from(
    [
      "SYNTHETIC CANDIDATE",
      "PROFESSIONAL SUMMARY",
      "Enterprise consultant supporting client transformation and operations.",
      "WORK EXPERIENCE",
      "Consultant at Synthetic Consulting from January 2020 to June 2025.",
      "EDUCATION",
      "Bachelor of Information Systems. Email candidate@example.invalid.",
    ].join("\n"),
  );
  for (const sourceType of ["admin_upload", "candidate_upload"] as const) {
    const uncertain = await prepareCandidateCv({
      buffer: lowEvidence,
      fileName: "synthetic-low-evidence.txt",
      source: sourceType,
    });
    assert.equal(uncertain.accepted, false);
    if (uncertain.accepted) throw new Error("low-evidence CV was accepted");
    assert.equal(uncertain.recordType, "UNKNOWN");
    assert.deepEqual(
      candidateCvRejectedOriginalPolicy(uncertain.rejectionType),
      {
        action: "hold_for_review",
        reasonCodes: ["candidate_classification_review_required"],
      },
      "neither upload role may delete an uncertain original",
    );
  }

  const uploadRoute = fs.readFileSync(
    new URL("../app/api/upload-cv/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(uploadRoute, /prepareCandidateCv\(\{/);
  assert.match(uploadRoute, /candidateCvRejectedOriginalPolicy\(/);
  assert.match(uploadRoute, /recordCandidateUploadReview\(\{/);
  assert.doesNotMatch(uploadRoute, /parseCv\(buffer, fileName\)/);

  const candidateRoute = fs.readFileSync(
    new URL("../app/api/candidate/profile/cv/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(candidateRoute, /prepareCandidateCv\(\{/);
  assert.match(candidateRoute, /candidateCvRejectedOriginalPolicy\(/);
  assert.match(candidateRoute, /recordCandidateUploadReview\(\{/);

  console.log("candidateCvIngestionParity.test.ts passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
