import fs from "node:fs";
import path from "node:path";
import Module from "node:module";

type SourceRow = Record<string, unknown>;
type Domain =
  | "Experience"
  | "Projects"
  | "Formal Education"
  | "Certifications"
  | "Training"
  | "Skills"
  | "Languages";

const FIELD_PATHS: Record<Domain, string[]> = {
  Experience: [
    "experience",
    "experiences",
    "work_experience",
    "employment_history",
    "employmentTimeline",
    "professional_history",
    "positions",
    "current_company",
    "current_title",
  ],
  Projects: [
    "projects",
    "project_experience",
    "project_history",
    "assignments",
    "engagements",
  ],
  "Formal Education": [
    "education",
    "educations",
    "education_history",
    "academic_history",
  ],
  Certifications: [
    "certifications",
    "certificates",
    "professional_certifications",
    "qualifications",
  ],
  Training: [
    "training",
    "training_courses",
    "courses",
    "professional_training",
  ],
  Skills: [
    "skills",
    "technical_skills",
    "functional_skills",
    "sap_modules",
    "lifecycle_experience",
  ],
  Languages: ["languages", "language_skills"],
};

const SECTION_PATTERNS: Record<Domain, RegExp> = {
  Experience:
    /(?:employment|work(?:ing)?|professional|career)\s+(?:history|experience)/gi,
  Projects:
    /(?:project|assignment|engagement)\s+(?:history|experience|details)/gi,
  "Formal Education":
    /(?:education|academic\s+(?:history|background|qualifications?))/gi,
  Certifications: /\b(?<!Postgraduate )(?:certifications?|certificates?)\b/gi,
  Training: /(?:training|courses?)/gi,
  Skills: /(?:technical|functional|other)?\s*skills|sap\s+modules/gi,
  Languages: /languages?/gi,
};

const populated = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(String(value ?? "").trim());
};

const itemCount = (value: unknown) => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return populated(value) ? 1 : 0;
};

const sourceRefs = (values: Array<{ sourceRef?: string } | undefined>) => [
  ...new Set(
    values.flatMap((value) => (value?.sourceRef ? [value.sourceRef] : [])),
  ),
];

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };

  const [
    { createCandidateSupabaseAdminClient },
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { normalizeActualCandidateSchema },
    { buildCandidate360Profile },
    { canonicalCandidateSkillCollection },
    { candidateProfileTabState },
    { buildSearchV2RecruiterCandidateDetail },
    { canonicalLookupMatches, detectSearchV2UnifiedIntent },
  ] = await Promise.all([
    import("../lib/candidateSupabase"),
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidate360SchemaNormalize"),
    import("../lib/candidate360Profile"),
    import("../lib/candidateProfileSkills"),
    import("../lib/candidateProfilePresentation"),
    import("../lib/searchV2CandidateDetailContract"),
    import("../lib/searchV2UnifiedIntent"),
  ]);

  const dataset = await fetchCandidateSource();
  const people = dedupeCandidateSearchV2Documents(dataset.documents).documents;
  const targets = ["#0BD318", "#A8CCB8", "#F59634", "#757B32"];
  const documents = targets.map((token) => {
    const matches = canonicalLookupMatches(
      people,
      detectSearchV2UnifiedIntent(token),
    );
    if (matches.length !== 1)
      throw new Error(`${token} resolved ${matches.length} times`);
    return { token, document: matches[0].document };
  });
  const sourceIds = [
    ...new Set(
      documents.flatMap(({ document }) =>
        document.sourceCandidateIds?.length
          ? document.sourceCandidateIds
          : [document.candidateId],
      ),
    ),
  ];
  const db = createCandidateSupabaseAdminClient();
  const { data, error } = await db
    .from("candidates")
    .select("*")
    .in("id", sourceIds);
  if (error) throw new Error(error.message);
  const rows = new Map(
    (data || []).map((row) => [String(row.id), row as SourceRow]),
  );

  const candidates = documents.map(({ token, document }) => {
    const candidateRows = (
      document.sourceCandidateIds?.length
        ? document.sourceCandidateIds
        : [document.candidateId]
    ).flatMap((id) => (rows.has(id) ? [rows.get(id)!] : []));
    const merged = Object.assign({}, ...candidateRows);
    const normalized = normalizeActualCandidateSchema(merged);
    const profile = buildCandidate360Profile({ ...merged, ...normalized });
    const enterprise = profile.enterpriseProfile;
    const recruiterDetail = buildSearchV2RecruiterCandidateDetail(profile);
    const overview = recruiterDetail.canonicalOverview;
    const skillCollection = canonicalCandidateSkillCollection(overview);
    const tabs = Object.fromEntries(
      candidateProfileTabState(overview).map((tab) => [tab.tab, tab.count]),
    );
    const educationPresentation = recruiterDetail.educationPresentation;
    const rawText = candidateRows
      .map((row) =>
        String(
          row.resume_text || row.raw_text || row.cv_text || row.raw_cv || "",
        ),
      )
      .filter(Boolean)
      .join("\n");

    const structuredEvidence = (domain: Domain) =>
      FIELD_PATHS[domain].flatMap((field) =>
        candidateRows.flatMap((row) =>
          populated(row[field])
            ? [
                {
                  path: field,
                  itemCount: itemCount(row[field]),
                  value: row[field],
                },
              ]
            : [],
        ),
      );
    const inspectedSections = (domain: Domain) => [
      ...new Set(rawText.match(SECTION_PATTERNS[domain]) || []),
    ];
    const sectionEvidence = enterprise.quality.sectionEvidence;
    const extraction = enterprise.quality.extraction;
    const employment = enterprise.employmentTimeline.map((item) => ({
      id: item.id,
      title: item.title || null,
      employer: item.company || null,
      start: item.start || null,
      end: item.end || (item.current ? "Present" : null),
      current: item.current,
      sourceRefs: sourceRefs(item.provenance || []),
    }));
    const projects = enterprise.projects.map((item) => ({
      id: item.id,
      project: item.name || null,
      client: item.client || null,
      employer: item.employer || null,
      role: item.role || null,
      start: item.start || null,
      end: item.end || null,
      lifecycle: [
        ...new Set([item.projectType, item.implementationType].filter(Boolean)),
      ],
      modules: item.modules,
      responsibilities: item.responsibilities,
      evidenceState: item.evidenceState,
      assignmentBoundary: {
        clientOrProject: Boolean(item.client || item.name),
        candidateRole: Boolean(item.role),
        deliveryContext: Boolean(
          item.projectType ||
          item.implementationType ||
          item.responsibilities.length,
        ),
        dates: Boolean(item.start || item.end),
      },
      sourceAssignmentIds: item.sourceAssignmentIds || [],
      sourceEvidence: [
        ...new Map(
          Object.values(item.fieldEvidence)
            .flatMap((evidence) => evidence?.provenance || [])
            .filter((entry) => entry.excerpt)
            .map((entry) => [
              `${entry.sourceRef || entry.fieldPath}|${entry.excerpt}`,
              {
                sourceType: entry.sourceType,
                sourceRef: entry.sourceRef || entry.fieldPath || null,
                excerpt: entry.excerpt,
              },
            ]),
        ).values(),
      ],
      finalClassification: item.name
        ? "named_project"
        : "bounded_unnamed_engagement",
      retainedBecause: item.name
        ? "The selected source explicitly identifies a project name and delivery boundary."
        : "The selected source establishes a dated client engagement, candidate role and delivery context without naming the project.",
      sourceRefs: sourceRefs(
        Object.values(item.fieldEvidence).flatMap(
          (evidence) => evidence?.provenance || [],
        ),
      ),
    }));
    const education = enterprise.education.map((item) => ({
      ...item,
      sourceRefs: sourceRefs(sectionEvidence.education.provenance),
    }));
    const certifications = educationPresentation.certificationRecords.map(
      (value) => ({
        value,
        sourceRefs: sourceRefs(sectionEvidence.certifications.provenance),
      }),
    );
    const training = educationPresentation.trainingRecords.map((value) => ({
      value,
      sourceRefs: sourceRefs(sectionEvidence.certifications.provenance),
    }));
    const skills = skillCollection.items.filter(
      (item) => item.group !== "Languages",
    );
    const languages = skillCollection.items.filter(
      (item) => item.group === "Languages",
    );

    const canonicalByDomain: Record<Domain, unknown[]> = {
      Experience: employment,
      Projects: projects,
      "Formal Education": education,
      Certifications: certifications,
      Training: training,
      Skills: skills,
      Languages: languages,
    };
    const apiCounts: Record<Domain, number> = {
      Experience: enterprise.employmentTimeline.length,
      Projects: enterprise.projects.length,
      "Formal Education": educationPresentation.educationRecords.length,
      Certifications: educationPresentation.certificationRecords.length,
      Training: educationPresentation.trainingRecords.length,
      Skills: skillCollection.items.filter((item) => item.group !== "Languages")
        .length,
      Languages: languages.length,
    };
    const renderedCounts: Record<Domain, number> = {
      ...apiCounts,
      Skills: Number(tabs.Skills || 0) - languages.length,
    };
    const sectionStatus = (domain: Domain) => {
      if (domain === "Experience") return extraction.experience;
      if (domain === "Projects") return extraction.projects;
      if (domain === "Formal Education") return sectionEvidence.education;
      if (domain === "Certifications" || domain === "Training")
        return sectionEvidence.certifications;
      if (domain === "Languages") return sectionEvidence.languages;
      return null;
    };

    return {
      token,
      name: document.candidateName || null,
      sourceRowIds: candidateRows.map((row) => String(row.id)),
      domains: Object.fromEntries(
        (Object.keys(FIELD_PATHS) as Domain[]).map((domain) => {
          const accepted = canonicalByDomain[domain];
          const structured = structuredEvidence(domain);
          const sections = inspectedSections(domain);
          const status = sectionStatus(domain);
          const sectionStatusSignalsEvidence =
            domain === "Certifications" || domain === "Training"
              ? sections.length > 0
              : ("sourceTextPresent" in (status || {}) &&
                  Boolean(
                    (status as { sourceTextPresent?: boolean })
                      .sourceTextPresent,
                  )) ||
                ("status" in (status || {}) &&
                  !["genuinely_none", "source_unavailable"].includes(
                    String((status as { status?: string }).status),
                  ));
          const hasUnacceptedEvidence =
            accepted.length === 0 &&
            (structured.length > 0 || sectionStatusSignalsEvidence);
          const rejected = hasUnacceptedEvidence
            ? [
                {
                  count: Math.max(
                    1,
                    structured.reduce((sum, item) => sum + item.itemCount, 0),
                  ),
                  reason:
                    domain === "Experience"
                      ? "No source item established a valid employer-role-date employment boundary."
                      : domain === "Projects"
                        ? "No source item established an explicit project/client assignment boundary with supported delivery context."
                        : `Source text was present but no distinct, domain-valid ${domain.toLocaleLowerCase()} record passed normalization.`,
                },
              ]
            : [];
          return [
            domain,
            {
              inspectedStructuredFields: FIELD_PATHS[domain],
              populatedStructuredPaths: structured,
              inspectedCvSections: sections,
              extractionStatus: status,
              rawEvidenceItemsFound:
                accepted.length +
                rejected.reduce((sum, item) => sum + item.count, 0),
              canonicalAccepted: accepted,
              rejected,
              apiCount: apiCounts[domain],
              renderedTabCount: renderedCounts[domain],
            },
          ];
        }),
      ),
      aggregateTabCounts: tabs,
    };
  });

  const report = {
    version: "search-v2-fixture-source-to-tab-v3-project-identity-separation",
    datasetRevision: dataset.revision,
    denominators: {
      indexedRows: dataset.documents.length,
      canonicalPeople: people.length,
    },
    candidates,
  };
  const outputPath = path.join(
    "reports",
    "search-v2-v72-fixture-source-to-tab.json",
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        candidates: candidates.map((candidate) => ({
          token: candidate.token,
          counts: candidate.aggregateTabCounts,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
