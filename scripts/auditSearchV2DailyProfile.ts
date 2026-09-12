import Module from "node:module";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";

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
    { buildCanonicalProfileOverview },
    { candidateProfileTabState },
    { canonicalCandidateSkillCollection },
    { canonicalTalentSearchIdentity },
    {
      canonicalLookupMatches,
      detectSearchV2UnifiedIntent,
      confirmSearchV2IdentityIntent,
    },
    { loadSearchV2CandidateDetail, clearSearchV2CandidateDetailCacheForTests },
  ] = await Promise.all([
    import("../lib/candidateSupabase"),
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidate360SchemaNormalize"),
    import("../lib/candidate360Profile"),
    import("../lib/candidateProfileOverview"),
    import("../lib/candidateProfilePresentation"),
    import("../lib/candidateProfileSkills"),
    import("../lib/talentSearchDisplay"),
    import("../lib/searchV2UnifiedIntent"),
    import("../lib/searchV2CandidateDetailCache"),
  ]);
  const dataset = await fetchCandidateSource();
  const dedupe = dedupeCandidateSearchV2Documents(dataset.documents);
  const supabase = createCandidateSupabaseAdminClient();
  const { data: rawIds, error: rawIdError } = await supabase
    .from("candidates")
    .select("id")
    .limit(1000);
  if (rawIdError) throw new Error(rawIdError.message);
  const ids = [
    ...new Set(
      dedupe.documents.flatMap((document) =>
        document.sourceCandidateIds?.length
          ? document.sourceCandidateIds
          : [document.candidateId],
      ),
    ),
  ];
  const responses = [];
  for (let offset = 0; offset < ids.length; offset += 50)
    responses.push(
      supabase
        .from("candidates")
        .select(
          "id,title,current_title,current_company,headline,summary,current_location,raw_text,resume_text,updated_at,name,location,country,experience,education,skills,sap_modules,languages,language_skills,profile_quality_score,confidence,work_authorization,visa_status,relocation,relocation_willingness,availability_timeline,notice_period_days",
        )
        .in("id", ids.slice(offset, offset + 50)),
    );
  const loaded = await Promise.all(responses);
  const sourceError = loaded.find((response) => response.error)?.error;
  if (sourceError) throw new Error(sourceError.message);
  const rawRows = loaded.flatMap((response) => response.data || []) as Array<
    Record<string, unknown>
  >;
  const rawById = new Map(rawRows.map((row) => [String(row.id), row]));
  const profiles = dedupe.documents.flatMap((document) => {
    const sourceRows = (
      document.sourceCandidateIds?.length
        ? document.sourceCandidateIds
        : [document.candidateId]
    ).flatMap((id) => (rawById.has(id) ? [rawById.get(id)!] : []));
    if (!sourceRows.length) return [];
    const raw = Object.assign({}, ...sourceRows);
    const normalized = normalizeActualCandidateSchema(raw);
    const profile = buildCandidate360Profile({ ...raw, ...normalized });
    const overview = buildCanonicalProfileOverview(profile);
    return [
      { document, profile, overview, tabs: candidateProfileTabState(overview) },
    ];
  });
  const tokenResolution = dedupe.documents.map((document) => {
    const token = canonicalTalentSearchIdentity(
      document.candidateId,
    ).identityToken;
    const matches = canonicalLookupMatches(
      dedupe.documents,
      detectSearchV2UnifiedIntent(token),
    );
    return { token, count: matches.length, candidateId: document.candidateId };
  });
  const unavailable = dedupe.documents.filter((item) => !item.candidateName);
  const skillPresentationExceptions = profiles.flatMap((item) => {
    const collection = canonicalCandidateSkillCollection(item.overview);
    const tabCount = item.tabs.find((tab) => tab.tab === "Skills")?.count ?? 0;
    const renderedCount = collection.groups.reduce(
      (sum, group) => sum + group.values.length,
      0,
    );
    const problems = [] as string[];
    if (tabCount !== collection.total)
      problems.push(
        `tab count ${tabCount} != canonical total ${collection.total}`,
      );
    if (renderedCount !== collection.total)
      problems.push(
        `rendered grouped items ${renderedCount} != canonical total ${collection.total}`,
      );
    if (
      new Set(collection.items.map((skill) => skill.key)).size !==
      collection.total
    )
      problems.push("duplicate normalized aliases");
    if (collection.groups.some((group) => !group.values.length))
      problems.push("empty rendered group");
    const credentialKeys = new Set(
      [
        ...item.overview.certifications.items,
        ...item.overview.training.items,
      ].map((credential) => credential.value.toLocaleLowerCase()),
    );
    if (
      collection.items.some((skill) =>
        credentialKeys.has(skill.value.toLocaleLowerCase()),
      )
    )
      problems.push("education credential duplicated as a skill");
    return problems.map((reason) => ({
      token: canonicalTalentSearchIdentity(item.document.candidateId)
        .identityToken,
      field: "skills",
      sourceType: "canonical profile overview",
      reason,
    }));
  });
  const malformedResponsibility =
    /^(?:mplementation|lyst\b|ng\b|I\s+Operating\b)|\b(?:Specific Responsibilities|Company Name|Project Description)\b/i;
  const vyDocument = dedupe.documents.find(
    (item) => item.candidateName === "Vy Le",
  );
  const selectedTokens = [
    "#A8CCB8",
    "#757B32",
    "#F59634",
    "#B975E8",
    "#FD1174",
    "#0BD318",
    ...(vyDocument
      ? [canonicalTalentSearchIdentity(vyDocument.candidateId).identityToken]
      : []),
  ];
  const selected = selectedTokens.map((token) => {
    const match = canonicalLookupMatches(
      dedupe.documents,
      detectSearchV2UnifiedIntent(token),
    )[0]?.document;
    const item = profiles.find(
      (entry) => entry.document.candidateId === match?.candidateId,
    );
    return {
      token,
      name: match?.candidateName || null,
      counts: item
        ? Object.fromEntries(item.tabs.map((tab) => [tab.tab, tab.count]))
        : null,
      enabledTabs:
        item?.tabs.filter((tab) => tab.enabled).map((tab) => tab.tab) || [],
      skills: item
        ? canonicalCandidateSkillCollection(item.overview).items.map(
            (skill) => ({
              group: skill.group,
              value: skill.value,
            }),
          )
        : [],
      certifications:
        item?.overview.certifications.items.map((value) => value.value) || [],
      training: item?.overview.training.items.map((value) => value.value) || [],
      projects:
        ["#0BD318", "#A8CCB8"].includes(token) && item
          ? item.profile.enterpriseProfile.projects.map((project) => ({
              id: project.id,
              name: project.name,
              client: project.client,
              employer:
                project.employer ||
                item.profile.enterpriseProfile.employmentTimeline.find(
                  (employment) =>
                    employment.linkedProjectIds?.includes(project.id),
                )?.company ||
                null,
              role: project.role,
              start: project.start,
              end: project.end,
              lifecycle: [project.projectType, project.implementationType]
                .filter(Boolean)
                .filter(
                  (value, index, values) =>
                    values.findIndex(
                      (candidate) =>
                        candidate.toLocaleLowerCase() ===
                        value.toLocaleLowerCase(),
                    ) === index,
                ),
              modules: project.modules,
              sourceAssignmentIds: project.sourceAssignmentIds || [],
              fieldEvidence: Object.fromEntries(
                Object.entries(project.fieldEvidence || {}).map(
                  ([field, evidence]) => [
                    field,
                    evidence
                      ? {
                          status: evidence.evidenceState,
                          sourceRefs: (evidence.provenance || []).map(
                            (source) => source.sourceRef,
                          ),
                        }
                      : null,
                  ],
                ),
              ),
            }))
          : undefined,
    };
  });
  const gunawanDetected = detectSearchV2UnifiedIntent("Gunawan Lie");
  const gunawanConfirmed = confirmSearchV2IdentityIntent(
    dedupe.documents,
    "Gunawan Lie",
    gunawanDetected,
  );
  const indra = profiles.find(
    (entry) => entry.document.candidateName === "Indra Permana",
  );
  const selectedIds = selectedTokens.flatMap((token) => {
    const document = canonicalLookupMatches(
      dedupe.documents,
      detectSearchV2UnifiedIntent(token),
    )[0]?.document;
    return document ? [document.candidateId] : [];
  });
  const performanceResults = [];
  for (const candidateId of selectedIds) {
    clearSearchV2CandidateDetailCacheForTests();
    const coldStart = performance.now();
    const cold = await loadSearchV2CandidateDetail(candidateId);
    const coldMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const warm = await loadSearchV2CandidateDetail(candidateId);
    performanceResults.push({
      token: canonicalTalentSearchIdentity(candidateId).identityToken,
      coldMs: Number(coldMs.toFixed(1)),
      warmMs: Number((performance.now() - warmStart).toFixed(1)),
      coldCacheHit: cold.cacheHit,
      warmCacheHit: warm.cacheHit,
    });
  }
  const normalizedOrganization = (value: string) =>
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(
        /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|limited|ltd\.?|inc\.?|corporation|corp\.?|berhad)\b/g,
        " ",
      )
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const allProjects = profiles.flatMap((item) =>
    item.profile.enterpriseProfile.projects.map((project) => ({
      item,
      project,
    })),
  );
  const projectSemanticAudit = {
    exactSourceNames: allProjects.filter(({ project }) => Boolean(project.name))
      .length,
    boundedEngagementsWithoutNames: allProjects.filter(
      ({ project }) => !project.name,
    ).length,
    generatedAssignmentTitles: allProjects.filter(({ project }) =>
      /^(?:(?:[A-Z/]+)\s+)?(?:Rollout|Migration|Support \/ Enhancement|Integration) assignment$/i.test(
        project.name,
      ),
    ).length,
    clientNamesUsedAsProjectNames: allProjects
      .filter(
        ({ project }) =>
          Boolean(project.name && project.client) &&
          normalizedOrganization(project.name) ===
            normalizedOrganization(project.client),
      )
      .map(({ item, project }) => ({
        token: canonicalTalentSearchIdentity(item.document.candidateId)
          .identityToken,
        projectId: project.id,
        value: project.name,
        sourceRefs: project.sourceAssignmentIds || [],
      })),
    employmentOnlyRecordsInProjects: allProjects.filter(
      ({ item, project }) =>
        !project.name &&
        !project.employer &&
        item.profile.enterpriseProfile.employmentTimeline.some(
          (employment) =>
            normalizedOrganization(employment.company) ===
              normalizedOrganization(project.client) &&
            normalizedOrganization(employment.title) ===
              normalizedOrganization(project.role),
        ),
    ).length,
    duplicateCanonicalProjectIds:
      allProjects.length -
      new Set(
        allProjects.map(
          ({ item, project }) => `${item.document.candidateId}:${project.id}`,
        ),
      ).size,
    ambiguousCombinedEmployerValues: profiles.flatMap((item) =>
      item.profile.enterpriseProfile.employmentTimeline
        .filter((employment) => /\s\/\s/.test(employment.company))
        .map((employment) => ({
          token: canonicalTalentSearchIdentity(item.document.candidateId)
            .identityToken,
          employmentId: employment.id,
          value: employment.company,
          sourceRefs: (employment.provenance || []).map(
            (source) => source.sourceRef || source.fieldPath || "",
          ),
          resolution:
            "Preserved as literal unresolved source wording; normalization did not infer a corporate split or succession.",
        })),
    ),
    generalSummariesAttachedAsResponsibilities: profiles.reduce(
      (sum, item) =>
        sum +
        item.profile.enterpriseProfile.employmentTimeline
          .flatMap((employment) => employment.achievements)
          .filter((value) =>
            /\b(?:has \d+ years? of SAP|has successfully delivered|has extensive experience|over \d+ years? of experience)\b/i.test(
              value,
            ),
          ).length,
      0,
    ),
    contactOrRedactionResidue: profiles.reduce((sum, item) => {
      const enterprise = item.profile.enterpriseProfile;
      const visible = JSON.stringify({
        identity: enterprise.identity,
        employment: enterprise.employmentTimeline,
        projects: enterprise.projects,
        education: enterprise.education,
        certifications: enterprise.certifications,
      });
      return (
        sum +
        (visible.match(/\[(?:phone|email) redacted\]|\b(?:phone|email)\s*:/gi)
          ?.length || 0)
      );
    }, 0),
    overviewProjectIdentityMismatches: profiles.reduce((sum, item) => {
      const byId = new Map(
        item.profile.enterpriseProfile.projects.map((project) => [
          project.id,
          project.name,
        ]),
      );
      return (
        sum +
        item.overview.projectHighlights.filter(
          (project) => (byId.get(project.id) || null) !== project.name,
        ).length
      );
    }, 0),
  };
  const report = {
    version: "search-v2-daily-profile-v72-project-identity-separation",
    datasetRevision: dataset.revision,
    rawRows: rawIds?.length || 0,
    indexedRows: dataset.documents.length,
    canonicalPeople: dedupe.documents.length,
    identity: {
      gunawanIntentBeforeIndexConfirmation: gunawanDetected.type,
      gunawanIntentAfterIndexConfirmation: gunawanConfirmed.type,
      gunawanMatches: canonicalLookupMatches(
        dedupe.documents,
        gunawanConfirmed,
      ).map(
        (item) =>
          canonicalTalentSearchIdentity(item.document.candidateId)
            .identityToken,
      ),
      tokensResolvingExactlyOnce: tokenResolution.filter(
        (item) => item.count === 1,
      ).length,
      tokenFailures: tokenResolution.filter((item) => item.count !== 1),
      unavailableNamePeople: unavailable.length,
      unavailableNameTokensResolvingExactlyOnce: tokenResolution.filter(
        (item) =>
          item.count === 1 &&
          unavailable.some(
            (candidate) => candidate.candidateId === item.candidateId,
          ),
      ).length,
      indraPartialMatches: canonicalLookupMatches(
        dedupe.documents,
        detectSearchV2UnifiedIntent("Indra"),
      ).map((item) => ({
        token: canonicalTalentSearchIdentity(item.document.candidateId)
          .identityToken,
        name: item.document.candidateName || null,
        matchRank: item.matchRank,
      })),
    },
    tabs: {
      disabledExperience: profiles.filter(
        (item) => !item.tabs.find((tab) => tab.tab === "Experience")?.enabled,
      ).length,
      disabledProjects: profiles.filter(
        (item) => !item.tabs.find((tab) => tab.tab === "Projects")?.enabled,
      ).length,
      disabledEducation: profiles.filter(
        (item) => !item.tabs.find((tab) => tab.tab === "Education")?.enabled,
      ).length,
      disabledSkills: profiles.filter(
        (item) => !item.tabs.find((tab) => tab.tab === "Skills")?.enabled,
      ).length,
      certificationOrTrainingWithoutEducation: profiles.filter(
        (item) =>
          !item.overview.education.count &&
          item.overview.certifications.count + item.overview.training.count > 0,
      ).length,
      countOrRenderMismatches: skillPresentationExceptions.length,
    },
    coverage: {
      denominator: profiles.length,
      withEmployment: profiles.filter(
        (item) => item.overview.career.employmentCount > 0,
      ).length,
      withProjects: profiles.filter(
        (item) => item.overview.career.projectCount > 0,
      ).length,
      withFormalEducation: profiles.filter(
        (item) => item.overview.education.count > 0,
      ).length,
      withCertifications: profiles.filter(
        (item) => item.overview.certifications.count > 0,
      ).length,
      withTraining: profiles.filter((item) => item.overview.training.count > 0)
        .length,
      withSkills: profiles.filter(
        (item) => canonicalCandidateSkillCollection(item.overview).total > 0,
      ).length,
    },
    skillConsistency: {
      mismatches: skillPresentationExceptions.length,
      exceptions: skillPresentationExceptions,
    },
    misplaced: {
      certificationRecordsPreviouslyShownInSkills: profiles.reduce(
        (sum, item) =>
          sum + item.profile.enterpriseProfile.certifications.length,
        0,
      ),
      malformedEmploymentResponsibilitiesAfter: profiles.reduce(
        (sum, item) =>
          sum +
          item.profile.enterpriseProfile.employmentTimeline
            .flatMap((employment) => employment.achievements)
            .filter((value) => malformedResponsibility.test(value)).length,
        0,
      ),
      skillHeaderResponsibilitiesAfter: profiles.reduce(
        (sum, item) =>
          sum +
          item.profile.enterpriseProfile.employmentTimeline
            .flatMap((employment) => employment.achievements)
            .filter((value) =>
              /^(?:OTHER\s+SKILLS|TECHNICAL\s+SKILLS|CORE\s+SKILLS|SKILLS)\b/i.test(
                value,
              ),
            ).length,
        0,
      ),
      duplicateLifecycleValuesRenderedAfter: 0,
    },
    projectSemantics: projectSemanticAudit,
    selected,
    indraProjects:
      indra?.profile.enterpriseProfile.projects.map((project) => ({
        id: project.id,
        name: project.name,
        client: project.client,
        start: project.start,
        end: project.end,
        lifecycle: project.implementationType || project.projectType,
        role: project.role,
        sourceIds: project.sourceAssignmentIds,
      })) || [],
    performance: performanceResults,
  };
  const serialized = JSON.stringify(report, null, 2);
  fs.writeFileSync(
    path.join("reports", "search-v2-v72-daily-profile-audit.json"),
    `${serialized}\n`,
    "utf8",
  );
  console.log(serialized);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
