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
  const undatedProjectSource = source.replace(
    /PROJECT EXPERIENCE[\s\S]*?EDUCATION/,
    `PROJECT EXPERIENCE
Project: S/4HANA rollout
Client: Synthetic Retail
Role: SAP MM Consultant
Project: AMS support
Client: Synthetic Manufacturing
Role: SAP MM Lead
EDUCATION`,
  );
  for (const origin of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: Buffer.from(undatedProjectSource),
      fileName: "synthetic-undated-client-projects.txt",
      source: origin,
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("undated projects rejected");
    const profile = prepared.candidatePayload;
    assert.equal(profile.current_company, "Example Consulting");
    assert.equal(profile.employment_history[0].employer, "Example Consulting");
    assert.equal(profile.employment_history[0].start_date, "Jan 2020");
    assert.equal(profile.employment_history[0].current, true);
    assert.deepEqual(
      profile.project_history.map((row: Record<string, unknown>) => ({
        name: row.name,
        client: row.client,
        role: row.role,
        start_date: row.start_date,
        end_date: row.end_date,
      })),
      [
        {
          name: "S/4HANA rollout",
          client: "Synthetic Retail",
          role: "SAP MM Consultant",
          start_date: "",
          end_date: "",
        },
        {
          name: "AMS support",
          client: "Synthetic Manufacturing",
          role: "SAP MM Lead",
          start_date: "",
          end_date: "",
        },
      ],
      "clients and projects remain separate from the employer and cannot inherit its tenure",
    );
    assert.ok(
      !prepared.extractionCoverage.missedObservedSections.includes("projects"),
    );
  }
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
    const staleHistorical = enrichCandidateUpload(
      {
        ...historical.candidatePayload,
        current_company: "Example Consulting",
      },
      historical.rawText,
    );
    assert.equal(
      staleHistorical.current_company,
      null,
      "a stale upstream current_company cannot override closed employment evidence",
    );
  }
  const employmentDateFamilies = [
    {
      card: "Employer: Example Consulting\nJob Title: SAP MM Consultant\nDuration: Jan'22 - Present",
      start: "Jan'22",
      end: "Present",
    },
    {
      card: "Employer: Example Consulting\nJob Title: SAP MM Consultant\nDuration: 2022-01 - Now",
      start: "2022-01",
      end: "Now",
    },
    {
      card: "Employer: Example Consulting\nJob Title: SAP MM Consultant\nStart Date: Jan'22\nEnd Date: To date",
      start: "Jan'22",
      end: "To date",
    },
    {
      card: "Employer: Example Consulting\nJob Title: SAP MM Consultant\nDate From: 2022-01\nDate To: Current",
      start: "2022-01",
      end: "Current",
    },
  ] as const;
  for (const sourceType of ["admin_upload", "candidate_upload"] as const) {
    for (const fixture of employmentDateFamilies) {
      const prepared = await prepareCandidateCv({
        buffer: Buffer.from(
          source.replace(
            "SAP MM Consultant | Example Consulting | Jan 2020 - Present",
            fixture.card,
          ),
        ),
        fileName: "synthetic-employment-date-formats.txt",
        source: sourceType,
      });
      assert.equal(prepared.accepted, true);
      if (!prepared.accepted)
        throw new Error("employment date-format fixture rejected");
      assert.deepEqual(prepared.candidatePayload.employment_history, [
        {
          employer: "Example Consulting",
          company: "Example Consulting",
          title: "SAP MM Consultant",
          start_date: fixture.start,
          end_date: fixture.end,
          current: true,
        },
      ]);
      assert.equal(
        prepared.candidatePayload.current_company,
        "Example Consulting",
        "all supported current markers must supply the same grounded employer",
      );
      assert.ok(
        !prepared.extractionCoverage.missingRequiredFields.includes(
          "employment_history",
        ),
      );
    }
    const adjacentPartialEmployment = await prepareCandidateCv({
      buffer: Buffer.from(
        source.replace(
          "SAP MM Consultant | Example Consulting | Jan 2020 - Present",
          "Employer: Example Alpha Consulting\nJob Title: SAP MM Consultant\nStart Date: Jan 2022\nEmployer: Example Beta Consulting\nJob Title: SAP MM Lead\nEnd Date: Dec 2023",
        ),
      ),
      fileName: "synthetic-incomplete-employment-dates.txt",
      source: sourceType,
    });
    assert.equal(adjacentPartialEmployment.accepted, true);
    if (!adjacentPartialEmployment.accepted)
      throw new Error("incomplete employment fixture rejected");
    assert.equal(
      adjacentPartialEmployment.candidatePayload.employment_history.length,
      0,
      "adjacent employment cards must not lend split dates to each other",
    );
    assert.ok(
      adjacentPartialEmployment.extractionCoverage.missingRequiredFields.includes(
        "employment_history",
      ),
    );
  }
  const splitProjectDateFamilies = [
    "Start Date: Jan 2022\nEnd Date: Dec 2023",
    "From: Jan 2022\nTo: Dec 2023",
    "Date From\nJan 2022\nDate To\nDec 2023",
  ];
  for (const sourceType of ["admin_upload", "candidate_upload"] as const) {
    for (const splitDates of splitProjectDateFamilies) {
      const prepared = await prepareCandidateCv({
        buffer: Buffer.from(source.replace("Jan 2022 - Dec 2023", splitDates)),
        fileName: "synthetic-split-project-dates.txt",
        source: sourceType,
      });
      assert.equal(prepared.accepted, true);
      if (!prepared.accepted) throw new Error("split project fixture rejected");
      assert.equal(
        prepared.candidatePayload.project_history.length,
        1,
        "each supported split-date family must recover exactly one project",
      );
      assert.deepEqual(
        {
          client: prepared.candidatePayload.project_history[0].client,
          role: prepared.candidatePayload.project_history[0].role,
          start_date: prepared.candidatePayload.project_history[0].start_date,
          end_date: prepared.candidatePayload.project_history[0].end_date,
        },
        {
          client: "Example Manufacturing",
          role: "SAP MM Consultant",
          start_date: "Jan 2022",
          end_date: "Dec 2023",
        },
      );
      assert.ok(
        !prepared.extractionCoverage.missedObservedSections.includes(
          "projects",
        ),
      );
    }
    const adjacentIncomplete = await prepareCandidateCv({
      buffer: Buffer.from(
        source.replace(
          `Client: Example Manufacturing
Role: SAP MM Consultant
Jan 2022 - Dec 2023
Led workshops, configuration, testing, migration, training and go-live support.`,
          `Project Title: Synthetic Alpha
Client: Synthetic Manufacturing
Role: SAP MM Consultant
Start Date: Jan 2022
Project Title: Synthetic Beta
Client: Synthetic Logistics
Role: SAP MM Lead
End Date: Dec 2023`,
        ),
      ),
      fileName: "synthetic-incomplete-project-dates.txt",
      source: sourceType,
    });
    assert.equal(adjacentIncomplete.accepted, true);
    if (!adjacentIncomplete.accepted)
      throw new Error("incomplete project fixture rejected");
    assert.equal(
      adjacentIncomplete.candidatePayload.project_history.length,
      0,
      "adjacent partial project cards must not lend split dates to each other",
    );
    assert.ok(
      adjacentIncomplete.extractionCoverage.missedObservedSections.includes(
        "projects",
      ),
    );
    const laterSectionDate = await prepareCandidateCv({
      buffer: Buffer.from(
        source
          .replace("Jan 2022 - Dec 2023", "Start Date: Jan 2022")
          .replace(
            "EDUCATION\nBachelor of Computing",
            "EDUCATION\nEnd Date: Dec 2023\nBachelor of Computing",
          ),
      ),
      fileName: "synthetic-cross-section-project-date.txt",
      source: sourceType,
    });
    assert.equal(laterSectionDate.accepted, true);
    if (!laterSectionDate.accepted)
      throw new Error("cross-section project fixture rejected");
    assert.equal(
      laterSectionDate.candidatePayload.project_history.length,
      0,
      "a project cannot borrow a split end date from a later section",
    );
    const reversedSplitDates = await prepareCandidateCv({
      buffer: Buffer.from(
        source.replace(
          "Jan 2022 - Dec 2023",
          "Start Date: Dec 2023\nEnd Date: Jan 2022",
        ),
      ),
      fileName: "synthetic-reversed-split-project-dates.txt",
      source: sourceType,
    });
    assert.equal(reversedSplitDates.accepted, true);
    if (!reversedSplitDates.accepted)
      throw new Error("reversed split project fixture rejected");
    assert.equal(
      reversedSplitDates.candidatePayload.project_history.length,
      0,
      "reversed split project dates must remain unstructured for review",
    );
  }
  for (const sourceType of ["admin_upload", "candidate_upload"] as const) {
    for (const delimiter of [" | ", "; ", "|", ";", "•"]) {
      const flattenedProject = await prepareCandidateCv({
        buffer: Buffer.from(
          source.replace(
            `Client: Example Manufacturing
Role: SAP MM Consultant
Jan 2022 - Dec 2023
Led workshops, configuration, testing, migration, training and go-live support.`,
            [
              "Project: Procurement Transformation",
              "End Client: Example Manufacturing",
              "Role: SAP MM Consultant",
              "Duration: Jan 2022 - Dec 2023",
              "Scope: SAP implementation, migration and cutover",
            ].join(delimiter),
          ),
        ),
        fileName: "synthetic-flattened-project.txt",
        source: sourceType,
      });
      assert.equal(flattenedProject.accepted, true);
      if (!flattenedProject.accepted)
        throw new Error("flattened project fixture rejected");
      assert.equal(flattenedProject.candidatePayload.project_history.length, 1);
      assert.deepEqual(
        {
          name: flattenedProject.candidatePayload.project_history[0].name,
          client: flattenedProject.candidatePayload.project_history[0].client,
          role: flattenedProject.candidatePayload.project_history[0].role,
        },
        {
          name: "Procurement Transformation",
          client: "Example Manufacturing",
          role: "SAP MM Consultant",
        },
        "flattened project delimiters and End Client labels must not pollute searchable fields",
      );
    }
    for (const [range, start, end] of [
      ["01/2022 - 12/2023", "01/2022", "12/2023"],
      ["2022-01 - 2023-12", "2022-01", "2023-12"],
      ["Jan'22 - Dec'23", "Jan'22", "Dec'23"],
      ["2022 - 2023", "2022", "2023"],
      ["Jan 2022 - Present", "Jan 2022", "Present"],
      ["Jan 2022 ~ Till date", "Jan 2022", "Till date"],
      ["Jan 2022 to To date", "Jan 2022", "To date"],
      ["Jan 2022 to Now", "Jan 2022", "Now"],
    ] as const) {
      const datedProject = await prepareCandidateCv({
        buffer: Buffer.from(
          source.replace(
            `Client: Example Manufacturing
Role: SAP MM Consultant
Jan 2022 - Dec 2023
Led workshops, configuration, testing, migration, training and go-live support.`,
            `Project: Procurement Transformation
End Client: Example Manufacturing
Role: SAP MM Consultant
Duration: ${range}
Scope: SAP implementation, migration and cutover`,
          ),
        ),
        fileName: "synthetic-project-date-formats.txt",
        source: sourceType,
      });
      assert.equal(datedProject.accepted, true);
      if (!datedProject.accepted)
        throw new Error("project date-format fixture rejected");
      assert.equal(datedProject.candidatePayload.project_history.length, 1);
      assert.deepEqual(
        {
          name: datedProject.candidatePayload.project_history[0].name,
          client: datedProject.candidatePayload.project_history[0].client,
          role: datedProject.candidatePayload.project_history[0].role,
          start: datedProject.candidatePayload.project_history[0].start_date,
          end: datedProject.candidatePayload.project_history[0].end_date,
        },
        {
          name: "Procurement Transformation",
          client: "Example Manufacturing",
          role: "SAP MM Consultant",
          start,
          end,
        },
        "admin and candidate uploads must retain the same complete project across supported date formats",
      );
    }
    for (const [range, start, end] of [
      ["Jan'22 - Dec'23", "Jan 22", "Dec 23"],
      ["2022-01 - 2023-12", "2022-01", "2023-12"],
      ["Jan 2022 - Now", "Jan 2022", "Now"],
    ] as const) {
      const sparseLabelProject = await prepareCandidateCv({
        buffer: Buffer.from(
          source.replace(
            `Client: Example Manufacturing
Role: SAP MM Consultant
Jan 2022 - Dec 2023
Led workshops, configuration, testing, migration, training and go-live support.`,
            `Project: Procurement Transformation
Client: Example Manufacturing
Role: SAP MM Consultant
Duration: ${range}`,
          ),
        ),
        fileName: "synthetic-sparse-project-date-formats.txt",
        source: sourceType,
      });
      assert.equal(sparseLabelProject.accepted, true);
      if (!sparseLabelProject.accepted)
        throw new Error("sparse project date-format fixture rejected");
      assert.equal(
        sparseLabelProject.candidatePayload.project_history.length,
        1,
      );
      assert.deepEqual(
        {
          name: sparseLabelProject.candidatePayload.project_history[0].name,
          client: sparseLabelProject.candidatePayload.project_history[0].client,
          role: sparseLabelProject.candidatePayload.project_history[0].role,
          start:
            sparseLabelProject.candidatePayload.project_history[0].start_date,
          end: sparseLabelProject.candidatePayload.project_history[0].end_date,
        },
        {
          name: "Procurement Transformation",
          client: "Example Manufacturing",
          role: "SAP MM Consultant",
          start,
          end,
        },
        "sparse labelled projects must use the same grounded date grammar in both upload sources",
      );
    }
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
  const leadingClientProjectSource = source.replace(
    /PROJECT EXPERIENCE[\s\S]*?EDUCATION/,
    `PROJECT EXPERIENCE
Client: Alpha Manufacturing
Role: SAP MM Consultant
Duration: Jan 2021 - Dec 2022
SAP procurement configuration and testing
Project: Beta rollout
Client: Beta Retail
Role: SAP MM Lead
Duration: Jan 2023 - Dec 2024
SAP deployment and cutover
EDUCATION`,
  );
  for (const origin of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: Buffer.from(leadingClientProjectSource),
      fileName: "synthetic.txt",
      source: origin,
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("leading client project rejected");
    const projects =
      prepared.candidatePayload.project_history.filter(isValidProjectEntry);
    assert.equal(projects.length, 2, "both project cards need their own rows");
    assert.deepEqual(
      new Set(projects.map((item: Record<string, unknown>) => item.client)),
      new Set(["Alpha Manufacturing", "Beta Retail"]),
    );
  }
  for (const [leadingSection, expectedClients] of [
    [
      "WORK EXPERIENCE\nClient: Employer Operations\nRole: SAP MM Consultant\nDuration: Jan 2021 - Dec 2022\nPROJECT EXPERIENCE",
      ["Beta Retail"],
    ],
    [
      "PROJECT EXPERIENCE\nWORK EXPERIENCE\nClient: Employer Operations\nRole: SAP MM Consultant\nDuration: Jan 2021 - Dec 2022",
      ["Beta Retail"],
    ],
    [
      "PROJECT EXPERIENCE\nClient: Partial Manufacturing\nRole: SAP MM Consultant",
      ["Partial Manufacturing", "Beta Retail"],
    ],
  ] as const) {
    const bounded = enrichCandidateUpload(
      { name: "Jane Doe" },
      `SAP MM Consultant\n${leadingSection}\nProject: Beta rollout\nClient: Beta Retail\nRole: SAP MM Lead\nDuration: Jan 2023 - Dec 2024`,
    );
    const projects = bounded.project_history.filter(isValidProjectEntry);
    assert.deepEqual(
      new Set(
        projects.map((project: Record<string, unknown>) => project.client),
      ),
      new Set(expectedClients),
      "employment clients stay out of projects, while an undated project card remains present",
    );
    assert.equal(
      projects.find(
        (project: Record<string, unknown>) =>
          project.client === "Partial Manufacturing",
      )?.start_date || "",
      "",
      "the adjacent named project cannot supply dates to an undated client card",
    );
  }
  const splitRoleProjectSource = source.replace(
    /PROJECT EXPERIENCE[\s\S]*?EDUCATION/,
    `PROJECT EXPERIENCE
Project: Procurement rollout
Client: Example Manufacturing
Role
SAP MM Consultant
Duration: Jan 2022 - Dec 2023
SAP configuration, integration testing and cutover
EDUCATION`,
  );
  for (const origin of ["admin_upload", "candidate_upload"] as const) {
    const prepared = await prepareCandidateCv({
      buffer: Buffer.from(splitRoleProjectSource),
      fileName: "synthetic.txt",
      source: origin,
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) throw new Error("split role project rejected");
    const projects =
      prepared.candidatePayload.project_history.filter(isValidProjectEntry);
    assert.equal(
      projects.length,
      1,
      "one labelled project must produce one row",
    );
    assert.equal(projects[0].name, "Procurement rollout");
    assert.equal(projects[0].client, "Example Manufacturing");
  }
  for (const emptyRole of ["Role", "Role:"]) {
    const blankRoleSource = splitRoleProjectSource.replace(
      "Role\nSAP MM Consultant",
      emptyRole,
    );
    for (const origin of ["admin_upload", "candidate_upload"] as const) {
      const prepared = await prepareCandidateCv({
        buffer: Buffer.from(blankRoleSource),
        fileName: "synthetic.txt",
        source: origin,
      });
      assert.equal(prepared.accepted, true);
      if (!prepared.accepted) throw new Error("blank role project rejected");
      assert.equal(
        prepared.candidatePayload.project_history.filter(isValidProjectEntry)
          .length,
        0,
        "a blank role cannot use the following Duration label as its role",
      );
    }
  }
  const incompleteClientCard = enrichCandidateUpload(
    { name: "Jane Doe" },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Alpha\nClient: Synthetic Manufacturing\nRole: SAP MM Consultant\nDuration: Jan 2020 - Dec 2021\nClient: Synthetic Logistics\nRole: SAP MM Lead\nProject Title: Synthetic Gamma\nClient: Synthetic Retail\nRole: SAP MM Architect\nDuration: Jan 2023 - Dec 2024`,
  );
  assert.equal(
    incompleteClientCard.project_history.filter(isValidProjectEntry).length,
    3,
    "an undated Client-only card remains present without borrowing a later project's dates",
  );
  const unfinishedNamedCard = enrichCandidateUpload(
    { name: "Jane Doe" },
    `SAP MM Consultant\nPROJECT EXPERIENCE\nProject Title: Synthetic Alpha\nClient: Synthetic Manufacturing\nRole: SAP MM Consultant\nClient: Synthetic Logistics\nRole: SAP MM Lead\nDuration: Jan 2022 - Dec 2022\nProject Title: Synthetic Gamma\nClient: Synthetic Retail\nRole: SAP MM Architect\nDuration: Jan 2023 - Dec 2024`,
  );
  assert.equal(
    unfinishedNamedCard.project_history.filter(isValidProjectEntry).length,
    3,
    "an undated named card remains present without borrowing the next Client-only card's duration",
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
    assert.equal(partial.candidatePayload.project_history.length, 2);
    assert.equal(partial.candidatePayload.project_history[1].start_date, "");
    assert.equal(partial.candidatePayload.project_history[1].end_date, "");
    assert.ok(
      !partial.extractionCoverage.missedObservedSections.includes("projects"),
    );
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
    assert.equal(unrelatedYear.candidatePayload.project_history.length, 2);
    assert.equal(
      unrelatedYear.candidatePayload.project_history[1].start_date,
      "",
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
