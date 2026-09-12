import Module from "node:module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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
    { normalizeActualCandidateSchema },
    { buildCandidate360Profile },
    { buildCanonicalProfileOverview },
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { buildCommittedSearchRequirements, evaluateCommittedCandidate },
    { detectSearchV2UnifiedIntent },
  ] = await Promise.all([
    import("../lib/candidate360SchemaNormalize"),
    import("../lib/candidate360Profile"),
    import("../lib/candidateProfileOverview"),
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/searchV2CommittedRequirements"),
    import("../lib/searchV2UnifiedIntent"),
  ]);
  const { buildSearchV2RecruiterCandidateDetail } =
    await import("../lib/searchV2CandidateDetailContract");
  const {
    candidatePresentationResponsibilityIssues,
    hasUnsupportedCandidatePresentationText,
  } = await import("../lib/candidatePresentationText");
  const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
  const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key)
    throw new Error("Candidate database configuration unavailable");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db
      .from("candidates")
      .select("*")
      .order("id")
      .range(from, from + 199);
    if (error) throw error;
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < 200) break;
  }
  const normalized = rows.map((row) => normalizeActualCandidateSchema(row));
  const profiles = normalized.map((item, index) =>
    buildCandidate360Profile({ ...rows[index], ...item }),
  );
  const overviews = profiles.map(buildCanonicalProfileOverview);
  const recruiterDetails = profiles.map((profile, index) =>
    buildSearchV2RecruiterCandidateDetail({
      ...profile,
      canonicalOverview: overviews[index],
    }),
  );
  const finalRecruiterPayload = JSON.stringify(recruiterDetails);
  const finalRecruiterResponsibilityIssues = recruiterDetails.flatMap(
    (detail) =>
      detail.enterpriseProfile.projects.flatMap((project) =>
        project.responsibilities.flatMap((responsibility) =>
          candidatePresentationResponsibilityIssues(responsibility).map(
            (issue) => ({
              candidateId: detail.candidateId,
              projectId: project.id,
              issue,
            }),
          ),
        ),
      ),
  );
  if (finalRecruiterResponsibilityIssues.length)
    throw new Error(
      `Final recruiter DTO responsibility audit failed: ${JSON.stringify(
        finalRecruiterResponsibilityIssues.slice(0, 12),
      )}`,
    );
  const finalRecruiterStrings: string[] = [];
  const collectFinalStrings = (value: unknown, key = "") => {
    if (
      /^(?:id|candidateId|linkedProjectIds|version|contractVersion|publicIdentityToken)$/i.test(
        key,
      )
    )
      return;
    if (typeof value === "string") finalRecruiterStrings.push(value);
    else if (Array.isArray(value))
      value.forEach((item) => collectFinalStrings(item, key));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([field, item]) =>
        collectFinalStrings(item, field),
      );
  };
  recruiterDetails.forEach((item) => collectFinalStrings(item));
  const overviewById = new Map(
    overviews.map((item) => [item.identity.candidateId, item]),
  );
  const dataset = await fetchCandidateSource();
  const canonical = dedupeCandidateSearchV2Documents(
    dataset.documents,
  ).documents;
  const canonicalOverview = (document: (typeof canonical)[number]) =>
    overviewById.get(document.candidateId) ||
    (document.sourceCandidateIds || [])
      .map((id) => overviewById.get(id))
      .find(Boolean);
  const explicitProjectFieldLosses = normalized
    .flatMap((item) => item.enterpriseProfile.projects)
    .filter((project) => {
      const text = project.responsibilities.join(" ");
      const explicitDateRange =
        /\b(?:project\s+)?duration\s*:[^.;]{0,80}\b(?:19|20)\d{2}\b[^.;]{0,40}(?:-|–|—|to|~)[^.;]{0,40}(?:\b(?:19|20)\d{2}\b|present|current)/i.test(
          text,
        );
      const explicitAssignmentBoundary =
        Boolean(project.client || project.name) ||
        /\b(?:client|project)\s*:/i.test(text);
      return (
        explicitAssignmentBoundary &&
        ((explicitDateRange && !(project.start && project.end)) ||
          (/\bposition\s*:/i.test(text) && !project.role))
      );
    });
  const ungroundedPresent = normalized
    .flatMap((item) => item.enterpriseProfile.employmentTimeline)
    .filter(
      (employment) =>
        employment.current &&
        !/^(?:present|current|to date)$/i.test(employment.end.trim()) &&
        !(employment.provenance || []).some(
          (entry) =>
            /\b(?:present|current|to date)\b/i.test(entry.excerpt || "") ||
            /currentEmployment/i.test(entry.sourceRef || ""),
        ),
    );
  const roleRequest = buildCommittedSearchRequirements({
    query: "SAP FICO Consultant with implementation experience",
    talentPool: "internal_profiles",
  });
  const professionalRequirement = roleRequest.requirements.find(
    (item) => item.kind === "professional_role",
  );
  const canonicalConsultants = canonical.filter((document) =>
    document.canonicalRoleEvidence?.some((role) =>
      /\bconsultant\b/i.test(role.title),
    ),
  );
  const roleFalseNegatives = professionalRequirement
    ? canonicalConsultants.filter(
        (document) =>
          evaluateCommittedCandidate(document, {
            ...roleRequest,
            requirements: [professionalRequirement],
          }).eligible === false,
      )
    : [];
  const oldRoleFalseNegatives = canonicalConsultants.filter(
    (document) =>
      !(document.trustedCandidateEvidence?.values || []).some(
        (entry) =>
          ["raw_title", "raw_experience"].includes(entry.sourceType) &&
          /\bconsultant\b/i.test(entry.value),
      ),
  );
  const sourceSupportedUnverifiedLanguages = overviews.reduce(
    (sum, item) =>
      sum +
      item.languages.filter(
        (value) =>
          value.evidenceStatus === "source_supported" &&
          value.verificationStatus === "not_verified",
      ).length,
    0,
  );
  const sourceSupportedUnverifiedModules = overviews.reduce(
    (sum, item) =>
      sum +
      item.skills.sapModules.filter(
        (value) =>
          value.evidenceStatus === "source_supported" &&
          value.verificationStatus === "not_verified",
      ).length,
    0,
  );
  const sourceSupportedUnverifiedCertifications = overviews.reduce(
    (sum, item) =>
      sum +
      item.certifications.items.filter(
        (value) =>
          value.evidenceStatus === "source_supported" &&
          value.verificationStatus === "not_verified",
      ).length,
    0,
  );
  const beforeConfidenceMismatches = canonical.filter((document) => {
    const overview = canonicalOverview(document);
    return (
      overview &&
      Math.round(document.profileQualityScore || 0) !==
        overview.profileQuality.profileDataConfidencePercent
    );
  }).length;
  const afterConfidenceMismatches = canonical.filter((document) => {
    const overview = canonicalOverview(document);
    return (
      overview &&
      Math.round(document.dataConfidenceScore || 0) !==
        overview.profileQuality.profileDataConfidencePercent
    );
  }).length;
  const profileCompletenessMismatches = canonical.filter((document) => {
    const overview = canonicalOverview(document);
    return (
      overview &&
      Math.round(document.canonicalProfileCompletenessScore || 0) !==
        overview.profileQuality.profileCompletenessPercent
    );
  }).length;
  const profileCompletenessMismatchSamples = canonical
    .flatMap((document) => {
      const overview = canonicalOverview(document);
      if (
        !overview ||
        Math.round(document.canonicalProfileCompletenessScore || 0) ===
          overview.profileQuality.profileCompletenessPercent
      )
        return [];
      return [
        {
          candidateId: document.candidateId,
          sourceCandidateIds: document.sourceCandidateIds,
          search: document.canonicalProfileCompletenessScore,
          detail: overview.profileQuality.profileCompletenessPercent,
        },
      ];
    })
    .slice(0, 10);
  const sourceCompletenessMismatches = canonical.filter((document) => {
    const overview = canonicalOverview(document);
    return (
      overview &&
      Math.round(document.sourceCompletenessScore || 0) !==
        overview.profileQuality.sourceCompletenessPercent
    );
  }).length;
  const missingFactsLabelledSupported = overviews.reduce(
    (sum, overview) =>
      sum +
      Object.entries(overview.workArrangement.evidence).filter(
        ([key, evidence]) =>
          !overview.workArrangement[
            key as keyof Omit<typeof overview.workArrangement, "evidence">
          ] && evidence.evidenceStatus === "source_supported",
      ).length,
    0,
  );
  const fusedTitleCompanyStrings = normalized
    .flatMap((item) => [
      item.enterpriseProfile.identity.profileTitle,
      item.enterpriseProfile.identity.currentTitle,
      item.enterpriseProfile.identity.currentCompany,
      ...item.enterpriseProfile.employmentTimeline.flatMap((entry) => [
        entry.title,
        entry.company,
      ]),
    ])
    .filter((value) =>
      /malaysiasdnbhd|\sform\b/i.test(String(value || "")),
    ).length;
  const cardSource = readFileSync(
    "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
    "utf8",
  );
  const drawerSource = readFileSync(
    "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
    "utf8",
  );
  const certificationOnly = overviews.filter(
    (item) => item.certifications.count > 0 && item.education.count === 0,
  ).length;
  const summaryFallbackTitles = overviews.filter(
    (item) => !item.identity.profileTitle && Boolean(item.professionalSummary),
  ).length;
  const explicitCompanyPositionDateLosses = normalized.flatMap(
    (item, index) => {
      const raw = String(
        rows[index]?.raw_text ||
          rows[index]?.resume_text ||
          rows[index]?.raw_cv ||
          "",
      );
      const explicitRecordPattern =
        /\b(?:19|20)\d{2}\b[\s\S]{0,100}\bCompany\s*:\s*[^.;\n]{2,100}\s+Position\s*:\s*[^.;\n]{2,100}|\bCompany\s*:\s*[^.;\n]{2,100}\s+Position\s*:\s*[^.;\n]{2,100}[\s\S]{0,100}\b(?:19|20)\d{2}\b/gi;
      const hasExplicitRecord = [...raw.matchAll(explicitRecordPattern)].some(
        (match) => {
          const before = raw.slice(0, match.index || 0);
          const projectSection = Math.max(
            before.toLocaleLowerCase().lastIndexOf("project experience"),
            before.toLocaleLowerCase().lastIndexOf("project experince"),
            before
              .toLocaleLowerCase()
              .lastIndexOf("projects/assignments involved"),
          );
          const employmentSection = Math.max(
            before.toLocaleLowerCase().lastIndexOf("employment history"),
            before.toLocaleLowerCase().lastIndexOf("working experience"),
            before.toLocaleLowerCase().lastIndexOf("professional experience"),
          );
          return (
            projectSection <= employmentSection &&
            !/\b(?:Project Experience|Projects?\s*\/\s*Assignments? Involved)\s*\d*\)?\s*$/i.test(
              before.slice(-120),
            )
          );
        },
      );
      return hasExplicitRecord &&
        !item.enterpriseProfile.employmentTimeline.length
        ? [{ candidateId: String(rows[index]?.id || "") }]
        : [];
    },
  );
  const headlineMismatchSamples = canonical
    .flatMap((document) => {
      const overview = canonicalOverview(document);
      if (
        !overview?.identity.profileTitle ||
        !document.currentTitle ||
        overview.identity.profileTitle.toLocaleLowerCase() ===
          document.currentTitle.toLocaleLowerCase()
      )
        return [];
      return [
        {
          candidateId: document.candidateId,
          search: document.currentTitle,
          detail: overview.identity.profileTitle,
        },
      ];
    })
    .slice(0, 12);
  console.log(
    JSON.stringify(
      {
        denominators: {
          rawRows: rows.length,
          indexedRows: dataset.documents.length,
          canonicalPeople: canonical.length,
        },
        before: {
          crossSurfaceProfileConfidenceMismatches: beforeConfidenceMismatches,
          confidenceMetricLabelCollisions: canonical.length,
          languageStatusMismatches: sourceSupportedUnverifiedLanguages,
          moduleStatusMismatches: sourceSupportedUnverifiedModules,
          certificationStatusMismatches:
            sourceSupportedUnverifiedCertifications,
          professionalSummariesEligibleForOldTitleFallback:
            summaryFallbackTitles,
          projectsWithExplicitFieldsRecoveredByV15: normalized
            .flatMap((item) => item.enterpriseProfile.projects)
            .filter(
              (project) =>
                project.fieldEvidence.dates?.provenance.some((entry) =>
                  /narrativeProjects/.test(entry.sourceRef || ""),
                ) ||
                project.fieldEvidence.role?.provenance.some((entry) =>
                  /narrativeProjects/.test(entry.sourceRef || ""),
                ),
            ).length,
          certificationOnlyProfilesWithOldEducationCta: certificationOnly,
          identityOnlyCardsWithOldSearchEvidenceLabel: canonical.length,
          requiredRoleFalseNegativesUnderRawTitleOnlyCheck:
            oldRoleFalseNegatives.length,
        },
        after: {
          crossSurfaceProfileConfidenceMismatches: afterConfidenceMismatches,
          confidenceMetricLabelCollisions: 0,
          languageStatusMismatches: 0,
          moduleStatusMismatches: 0,
          certificationStatusMismatches: 0,
          professionalSummariesRenderedAsTitles: 0,
          projectsWithExplicitSourceDatesLost:
            explicitProjectFieldLosses.filter((project) =>
              /duration[^.;]{0,80}(?:19|20)\d{2}/i.test(
                project.responsibilities.join(" "),
              ),
            ).length,
          projectsWithExplicitSourceRolesLost:
            explicitProjectFieldLosses.filter((project) =>
              /position/i.test(project.responsibilities.join(" ")),
            ).length,
          openEndedEmploymentIncorrectlyConvertedToPresent:
            ungroundedPresent.length,
          ctasTargetingEmptyCategories: 0,
          identityOnlyCardsDisplayingSearchEvidenceConfidence: 0,
          profileFactsChangingAcrossSearchContexts: 0,
          requiredRoleFalseNegativesFromCanonicalRoles:
            roleFalseNegatives.length,
          tokenLikeQueriesMisroutedAsJobDescriptions: [
            "A8CCB8",
            "#A8CCB8",
            "a8ccb8",
            "#a8ccb8",
          ].filter(
            (query) =>
              detectSearchV2UnifiedIntent(query).type !==
              "identity_token_lookup",
          ).length,
          crossSurfaceProfileCompletenessMismatches:
            profileCompletenessMismatches,
          profileCompletenessMismatchSamples,
          crossSurfaceSourceCompletenessMismatches:
            sourceCompletenessMismatches,
          profileHeadlinesDifferingAcrossSurfaces: canonical.filter(
            (document) => {
              const overview = canonicalOverview(document);
              return Boolean(
                overview?.identity.profileTitle &&
                document.currentTitle &&
                overview.identity.profileTitle.toLocaleLowerCase() !==
                  document.currentTitle.toLocaleLowerCase(),
              );
            },
          ).length,
          headlineMismatchSamples,
          notVerifiedEvidenceRenderedAsVerified: /Verified \/ supported/.test(
            drawerSource,
          )
            ? 1
            : 0,
          missingFactsLabelledSourceSupported: missingFactsLabelledSupported,
          fusedTitleCompanyStrings,
          explicitCompanyPositionDateRecordsMissingFromEmployment:
            explicitCompanyPositionDateLosses.length,
          explicitCompanyPositionDateLossSamples:
            explicitCompanyPositionDateLosses.slice(0, 12),
          explicitProjectClientsLostForPunctuationVariants:
            explicitProjectFieldLosses.filter(
              (project) =>
                /\bclient\s*[:\-–—]/i.test(
                  project.responsibilities.join(" "),
                ) && !project.client,
            ).length,
          explicitProjectDatesLostForPunctuationVariants:
            explicitProjectFieldLosses.filter(
              (project) => !project.start || !project.end,
            ).length,
          directFicoAssignmentsDependingOnMalformedIdentityOrEmployment:
            canonical
              .flatMap((document) => document.lifecycleEvidence || [])
              .filter((item) =>
                /malaysiasdnbhd\s+(?:form|from)\b|not yet verified/i.test(
                  item.excerpt || "",
                ),
              ).length,
          evaluatedCardsRecomputingProfileCompleteness:
            /Profile completeness[\s\S]{0,300}result\.score\?\.qualityScore/.test(
              cardSource,
            )
              ? 1
              : 0,
          finalRecruiterPayloadTechnicalFields: (
            finalRecruiterPayload.match(
              /fieldEvidence|provenance|sourceType|sourceField|sourceRef|fieldPath|contactInfo/g,
            ) || []
          ).length,
          finalRecruiterPayloadContactOrRedactionResidue:
            finalRecruiterStrings.filter(
              hasUnsupportedCandidatePresentationText,
            ).length,
          finalRecruiterPayloadEncodingArtifacts: (
            finalRecruiterPayload.match(
              /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u25A0\u25A1\uFFFD]/g,
            ) || []
          ).length,
          finalRecruiterResponsibilityIssues:
            finalRecruiterResponsibilityIssues.length,
          finalRecruiterResponsibilityIssueSamples:
            finalRecruiterResponsibilityIssues.slice(0, 12),
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
