import assert from "node:assert/strict";
import fs from "node:fs";

import {
  candidateCvRejectedOriginalPolicy,
  prepareCandidateCv,
} from "../lib/candidateCvIngestion";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";
import { isValidProjectEntry } from "../lib/candidateProfileIngestion";
import { evaluateCandidateExtractionCoverage } from "../lib/candidateExtractionCoverage";

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
  assert.equal(
    admin.candidatePayload.project_history.length,
    1,
    "the same project cannot be duplicated when one reader captures dates and duties in its role",
  );
  assert.equal(
    admin.candidatePayload.project_history[0].role,
    "SAP MM Consultant",
  );
  assert.deepEqual(
    admin.candidatePayload.sourceExtraction,
    admin.sourceExtraction,
    "shared payload must carry source provenance to the save boundary",
  );
  assert.deepEqual(
    candidate.candidatePayload.sourceExtraction,
    candidate.sourceExtraction,
    "candidate uploads must use the same source provenance contract",
  );
  const splitDateEmployment = source.replace(
    "SAP MM Consultant | Example Consulting | Jan 2020 - Present",
    "Employer: Example Consulting\nJob Title: SAP MM Consultant\nStart Date: Jan 2020\nEnd Date: Present",
  );
  for (const sourceType of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: Buffer.from(splitDateEmployment),
      fileName: "synthetic-split-employment-dates.txt",
      source: sourceType,
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("split-date fixture rejected");
    assert.equal(prepared.candidatePayload.employment_history.length, 1);
    assert.deepEqual(prepared.candidatePayload.employment_history[0], {
      employer: "Example Consulting",
      company: "Example Consulting",
      title: "SAP MM Consultant",
      start_date: "Jan 2020",
      end_date: "Present",
      current: true,
    });
    assert.equal(
      prepared.candidatePayload.current_company,
      "Example Consulting",
      "an explicitly open-ended employment card supplies the current employer",
    );
    assert.ok(
      !prepared.extractionCoverage.missingRequiredFields.includes(
        "current_employer",
      ),
    );
    const historical = await prepareCandidateCv({
      buffer: Buffer.from(
        splitDateEmployment.replace("End Date: Present", "End Date: Dec 2022"),
      ),
      fileName: "synthetic-closed-split-employment-dates.txt",
      source: sourceType,
    });
    assert.equal(historical.accepted, true);
    if (!historical.accepted) throw new Error("historical fixture rejected");
    assert.equal(historical.candidatePayload.employment_history.length, 1);
    assert.equal(
      historical.candidatePayload.current_company,
      null,
      "a completed employment card must not be promoted to current employer",
    );
  }
  const projectSource = `SAP MM Consultant
PROJECT EXPERIENCE
Project Title: Synthetic Alpha
Client: Synthetic Manufacturing
Role: SAP MM Consultant
Jan 2021 - Dec 2022
Project Title: Synthetic Beta
Client: Synthetic Logistics
Role: SAP MM Lead
Jan 2023 - Dec 2024`;
  const moreExplicitProjects = enrichCandidateUpload(
    {
      name: "Jane Doe",
      projects: [
        {
          name: "Synthetic Alpha",
          client: "Synthetic Manufacturing",
          role: "SAP MM Consultant",
          start_date: "Jan 2021",
          end_date: "Dec 2022",
        },
      ],
    },
    projectSource,
  );
  assert.equal(
    moreExplicitProjects.project_history.length,
    2,
    "one canonical project must not hide a second explicitly labelled project",
  );
  const disjointProject = enrichCandidateUpload(
    {
      name: "Jane Doe",
      projects: [
        {
          name: "Synthetic Alpha",
          client: "Synthetic Manufacturing",
          role: "SAP MM Consultant",
          start_date: "Jan 2020",
          end_date: "Dec 2021",
        },
        {
          name: "Synthetic Gamma",
          client: "Synthetic Retail",
          role: "SAP MM Architect",
          start_date: "Jan 2022",
          end_date: "Dec 2022",
        },
      ],
    },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Beta\nClient: Synthetic Logistics\nRole: SAP MM Lead\nDuration: Jan 2023 - Dec 2024`,
  );
  assert.deepEqual(
    new Set(
      disjointProject.project_history.map((row: Record<string, unknown>) =>
        String(row.name),
      ),
    ),
    new Set(["Synthetic Alpha", "Synthetic Beta", "Synthetic Gamma"]),
    "a distinct explicitly dated project must survive even when the canonical reader has more rows",
  );
  const mixedProjectCards = enrichCandidateUpload(
    { name: "Jane Doe" },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Alpha\nClient: Synthetic Manufacturing\nRole: SAP MM Consultant\nDuration: Jan 2020 - Dec 2021\nClient: Synthetic Logistics\nRole: SAP MM Lead\nDuration: Jan 2022 - Dec 2022\nProject Title: Synthetic Gamma\nClient: Synthetic Retail\nRole: SAP MM Architect\nDuration: Jan 2023 - Dec 2024\nEDUCATION\nBachelor of Computing\nClient: Synthetic School\nRole: SAP MM Consultant\nDuration: Jan 2015 - Dec 2016`,
  );
  assert.equal(
    mixedProjectCards.project_history.filter(isValidProjectEntry).length,
    3,
    "a labelled client-only card between named projects is retained once; later education cannot create a project",
  );
  const incompleteClientCard = enrichCandidateUpload(
    { name: "Jane Doe" },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Alpha\nClient: Synthetic Manufacturing\nRole: SAP MM Consultant\nDuration: Jan 2020 - Dec 2021\nClient: Synthetic Logistics\nRole: SAP MM Lead\nProject Title: Synthetic Gamma\nClient: Synthetic Retail\nRole: SAP MM Architect\nDuration: Jan 2023 - Dec 2024`,
  );
  assert.equal(
    incompleteClientCard.project_history.filter(isValidProjectEntry).length,
    2,
    "a Client-only card cannot borrow a later project's dates",
  );
  const unfinishedNamedCard = enrichCandidateUpload(
    { name: "Jane Doe" },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Alpha\nClient: Synthetic Manufacturing\nRole: SAP MM Consultant\nClient: Synthetic Logistics\nRole: SAP MM Lead\nDuration: Jan 2022 - Dec 2022\nProject Title: Synthetic Gamma\nClient: Synthetic Retail\nRole: SAP MM Architect\nDuration: Jan 2023 - Dec 2024`,
  );
  assert.equal(
    unfinishedNamedCard.project_history.filter(isValidProjectEntry).length,
    2,
    "an incomplete named card cannot borrow the next Client-only card's duration",
  );
  const conflictingSource = `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Alpha\nClient: Synthetic Logistics\nRole: SAP MM Consultant\nDuration: Jan 2020 - Dec 2021`;
  const conflictingProjects = enrichCandidateUpload(
    {
      name: "Jane Doe",
      projects: [
        {
          name: "Synthetic Alpha",
          client: "Synthetic Manufacturing",
          role: "SAP MM Consultant",
          start_date: "Jan 2020",
          end_date: "Dec 2021",
        },
      ],
    },
    conflictingSource,
  );
  assert.equal(
    conflictingProjects.project_history.filter(isValidProjectEntry).length,
    2,
  );
  assert.ok(
    evaluateCandidateExtractionCoverage(
      conflictingSource,
      conflictingProjects,
    ).missedObservedSections.includes("projects"),
    "contradictory project clients must remain under review",
  );
  const distinctRole = enrichCandidateUpload(
    {
      name: "Jane Doe",
      projects: [
        {
          name: "Synthetic Alpha",
          client: "Synthetic Logistics",
          role: "SAP MM Lead",
          start_date: "Jan 2020",
          end_date: "Dec 2021",
        },
      ],
    },
    conflictingSource,
  );
  assert.equal(
    distinctRole.project_history.filter(isValidProjectEntry).length,
    2,
    "two genuinely different roles on the same client and period must remain separate assertions",
  );
  const reversed = enrichCandidateUpload(
    { name: "Jane Doe" },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Reversed\nClient: Synthetic Manufacturing\nRole: SAP MM Consultant\nNov 2022 - Mar 2022`,
  );
  assert.equal(
    reversed.project_history.filter(isValidProjectEntry).length,
    0,
    "reversed source dates must never create a qualified project",
  );
  const mixedRoleLabels = enrichCandidateUpload(
    { name: "Jane Doe" },
    `${projectSource}\nRole\nAdditional SAP MM Consultant`,
  );
  assert.equal(
    mixedRoleLabels.project_history.length,
    2,
    "a second role label must not invalidate an explicitly dated project",
  );
  const multilineProjects = Buffer.from(`
Jane Doe
Email: jane.doe@example.com
Location: Singapore
SAP MM consultant with SAP S/4HANA procurement and implementation experience.
WORK EXPERIENCE
SAP MM Consultant | Example Consulting | Jan 2020 - Present
PROJECT EXPERIENCE
Client
Synthetic Manufacturing - Jan 2021 – Dec 2022
Project
Procurement rollout
Role
SAP MM Consultant
Client
Synthetic Logistics - Jan 2023 – Dec 2024
Project
Inventory migration
Role
SAP MM Lead
EDUCATION
Bachelor of Computing
SKILLS
SAP MM, S/4HANA
LANGUAGES
English
`);
  for (const sourceType of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: multilineProjects,
      fileName: "synthetic-multiline-projects.txt",
      source: sourceType,
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("multiline fixture rejected");
    assert.equal(prepared.candidatePayload.project_history.length, 2);
    assert.equal(
      prepared.candidatePayload.project_history[0].client,
      "Synthetic Manufacturing",
    );
    assert.equal(
      prepared.candidatePayload.project_history[0].name,
      "Procurement rollout",
    );
    assert.equal(
      prepared.candidatePayload.project_history[0].start_date,
      "Jan 2021",
    );
    assert.equal(
      prepared.candidatePayload.project_history[1].role,
      "SAP MM Lead",
    );
    const partial = await prepareCandidateCv({
      buffer: Buffer.from(
        multilineProjects
          .toString()
          .replace(
            "Synthetic Logistics - Jan 2023 – Dec 2024",
            "Synthetic Logistics",
          ),
      ),
      fileName: "synthetic-multiline-projects.txt",
      source: sourceType,
    });
    assert.equal(partial.accepted, true);
    if (!partial.accepted) throw new Error("partial fixture rejected");
    assert.equal(partial.candidatePayload.project_history.length, 1);
    assert.ok(
      partial.extractionCoverage.missedObservedSections.includes("projects"),
    );
    assert.equal(partial.extractionCoverage.status, "incomplete_needs_review");
    const dateBeforeClient = await prepareCandidateCv({
      buffer: Buffer.from(
        multilineProjects
          .toString()
          .replace(
            "Client\nSynthetic Logistics - Jan 2023 – Dec 2024",
            "Jan 2023 – Dec 2024\nClient\nSynthetic Logistics",
          ),
      ),
      fileName: "synthetic-date-before-client.txt",
      source: sourceType,
    });
    assert.equal(dateBeforeClient.accepted, true);
    if (!dateBeforeClient.accepted) throw new Error("dated fixture rejected");
    assert.equal(dateBeforeClient.candidatePayload.project_history.length, 2);
    assert.equal(
      dateBeforeClient.candidatePayload.project_history[1].start_date,
      "Jan 2023",
    );
    const unrelatedYear = await prepareCandidateCv({
      buffer: Buffer.from(
        multilineProjects
          .toString()
          .replace(
            "Client\nSynthetic Logistics - Jan 2023 – Dec 2024",
            "Delivered activity Jan 2023 – Dec 2024\nClient\nSynthetic Logistics",
          ),
      ),
      fileName: "synthetic-unrelated-year.txt",
      source: sourceType,
    });
    assert.equal(unrelatedYear.accepted, true);
    if (!unrelatedYear.accepted) throw new Error("undated fixture rejected");
    assert.equal(unrelatedYear.candidatePayload.project_history.length, 1);
    assert.ok(
      unrelatedYear.extractionCoverage.missedObservedSections.includes(
        "projects",
      ),
    );
    const labelledDuration = await prepareCandidateCv({
      buffer: Buffer.from(`Jane Doe
Email: jane.doe@example.com
Location: Singapore
SAP MM consultant delivering SAP S/4HANA implementations.
WORK EXPERIENCE
SAP MM Consultant | Example Consulting | Jan 2020 - Present
PROJECT EXPERIENCE
Project Title: Synthetic Procurement Rollout
Customer
Synthetic Manufacturing
Duration
Jan 2021 - Dec 2022
Role
SAP MM Consultant
Project Title: Synthetic Inventory Migration
Customer
Synthetic Logistics
Duration
Jan 2023 - Dec 2024
Role
SAP MM Lead
EDUCATION
Bachelor of Computing
SKILLS
SAP MM, S/4HANA
LANGUAGES
English`),
      fileName: "synthetic-separated-labels.txt",
      source: sourceType,
    });
    assert.equal(labelledDuration.accepted, true);
    if (!labelledDuration.accepted)
      throw new Error("duration fixture rejected");
    assert.equal(labelledDuration.candidatePayload.project_history.length, 2);
    assert.equal(
      labelledDuration.candidatePayload.project_history[0].name,
      "Synthetic Procurement Rollout",
    );
    const missingDuration = await prepareCandidateCv({
      buffer: Buffer.from(
        labelledDuration.rawText.replace(
          "Duration\nJan 2023 - Dec 2024",
          "Delivered activity Jan 2023 - Dec 2024",
        ),
      ),
      fileName: "synthetic-separated-labels.txt",
      source: sourceType,
    });
    assert.equal(missingDuration.accepted, true);
    if (!missingDuration.accepted) throw new Error("missing duration rejected");
    assert.equal(missingDuration.candidatePayload.project_history.length, 1);
    assert.ok(
      missingDuration.extractionCoverage.missedObservedSections.includes(
        "projects",
      ),
    );
    const quotedMonths = await prepareCandidateCv({
      buffer: Buffer.from(
        multilineProjects
          .toString()
          .replace(
            "Client\nSynthetic Logistics - Jan 2023 – Dec 2024",
            "Jan’ 2023 to Dec’2024\nClient\nSynthetic Logistics",
          ),
      ),
      fileName: "synthetic-quoted-months.txt",
      source: sourceType,
    });
    assert.equal(quotedMonths.accepted, true);
    if (!quotedMonths.accepted) throw new Error("quoted months rejected");
    assert.equal(quotedMonths.candidatePayload.project_history.length, 2);
    assert.equal(
      quotedMonths.candidatePayload.project_history[1].start_date,
      "Jan 2023",
    );
    assert.equal(
      quotedMonths.candidatePayload.project_history[1].end_date,
      "Dec 2024",
    );
  }
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
