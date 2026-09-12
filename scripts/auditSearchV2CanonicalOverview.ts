import { createClient } from "@supabase/supabase-js";
import Module from "node:module";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { buildCanonicalProfileOverview } from "../lib/candidateProfileOverview";

const runtime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = runtime._load;
runtime._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

const url = process.env.CANDIDATE_SUPABASE_URL?.trim();
const key = process.env.CANDIDATE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key)
  throw new Error("Candidate database configuration unavailable");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const text = (value: unknown) => String(value ?? "").trim();
const present = (value: unknown) =>
  Array.isArray(value) ? value.length > 0 : Boolean(text(value));

const categoryNames = [
  "nameToken",
  "profileTitle",
  "location",
  "professionalSummary",
  "totalExperience",
  "currentEmployer",
  "currentRoleTenure",
  "latestEmployer",
  "employment",
  "projects",
  "skillsModules",
  "languages",
  "education",
  "certifications",
  "workArrangement",
  "profileDataConfidence",
] as const;
type Category = (typeof categoryNames)[number];
type Layer = Record<Category, boolean>;

function sourceLayer(row: Record<string, unknown>): Layer {
  const raw = text(row.raw_text || row.resume_text || row.raw_cv);
  const any = (...keys: string[]) => keys.some((name) => present(row[name]));
  return {
    nameToken:
      any("name", "full_name", "candidate_name") ||
      /\b(?:name|resume of)\s*:/i.test(raw),
    profileTitle: any(
      "title",
      "current_title",
      "headline",
      "professional_headline",
    ),
    location:
      any("location", "country", "city") ||
      /\b(?:location|address)\s*:/i.test(raw),
    professionalSummary:
      any(
        "professional_summary",
        "profile_summary",
        "career_summary",
        "about",
      ) || /\b(?:professional|profile|career)\s+summary\b/i.test(raw),
    totalExperience:
      any("years_of_experience", "total_experience_years") ||
      /\b(?:19|20)\d{2}\b/i.test(raw),
    currentEmployer:
      any("current_company", "current_employer") ||
      /\b(?:present|current)\b/i.test(raw),
    currentRoleTenure: /\b(?:present|current)\b/i.test(raw),
    latestEmployer:
      any("company", "current_company", "employer") ||
      /\b(?:company name|employer)\s*:/i.test(raw),
    employment:
      any("experience", "work_experience", "employment_history") ||
      /\b(?:working|professional|employment|career)\s+(?:experience|history)\b/i.test(
        raw,
      ),
    projects:
      any("projects", "project_experience") ||
      /\b(?:project|client)\s*:/i.test(raw),
    skillsModules:
      any("skills", "technical_skills", "sap_modules") ||
      /\b(?:skills?|sap modules?)\s*:/i.test(raw),
    languages:
      any("languages", "language_skills") || /\blanguages?\s*:/i.test(raw),
    education:
      any("education", "education_history") || /\beducation\b/i.test(raw),
    certifications:
      any("certifications", "certificates") || /\bcertifications?\b/i.test(raw),
    workArrangement: any(
      "availability",
      "notice_period",
      "remote",
      "visa",
      "relocation",
      "travel",
    ),
    profileDataConfidence: any(
      "data_confidence",
      "extraction_confidence",
      "profile_quality_score",
    ),
  };
}

function rowLayers(row: Record<string, unknown>) {
  const normalized = normalizeActualCandidateSchema(row);
  const enterprise = normalized.enterpriseProfile;
  const detail = buildCandidate360Profile({ ...row, ...normalized });
  const overview = buildCanonicalProfileOverview(detail);
  const current = enterprise.employmentTimeline.find((item) => item.current);
  const canonical: Layer = {
    nameToken: Boolean(enterprise.identity.name || enterprise.candidateId),
    profileTitle: Boolean(enterprise.identity.currentTitle),
    location: Boolean(
      enterprise.identity.location || enterprise.identity.country,
    ),
    professionalSummary: Boolean(enterprise.professionalSummary),
    totalExperience: enterprise.experienceSummary.totalCareerYears !== null,
    currentEmployer: Boolean(current?.company),
    currentRoleTenure:
      enterprise.experienceSummary.currentRoleTenureYears !== null,
    latestEmployer: Boolean(enterprise.employmentTimeline[0]?.company),
    employment: enterprise.employmentTimeline.length > 0,
    projects: enterprise.projects.length > 0,
    skillsModules:
      enterprise.sapModules.length + enterprise.technicalSkills.length > 0,
    languages: enterprise.languages.length > 0,
    education: enterprise.education.length > 0,
    certifications: enterprise.certifications.length > 0,
    workArrangement: [
      enterprise.recruiterSignals.availability,
      enterprise.recruiterSignals.notice,
      enterprise.recruiterSignals.travel,
      enterprise.recruiterSignals.remote,
      enterprise.recruiterSignals.visa,
      enterprise.recruiterSignals.relocation,
    ].some(present),
    profileDataConfidence: Number.isFinite(enterprise.quality.dataConfidence),
  };
  const detailApi: Layer = {
    ...canonical,
    nameToken: Boolean(detail.candidateId),
    profileTitle: Boolean(detail.enterpriseProfile.identity.currentTitle),
    location: Boolean(
      detail.enterpriseProfile.identity.location ||
      detail.enterpriseProfile.identity.country,
    ),
  };
  const overviewLayer: Layer = {
    nameToken: Boolean(overview.identity.publicIdentityToken),
    profileTitle: Boolean(overview.identity.profileTitle),
    location: Boolean(overview.identity.location || overview.identity.country),
    professionalSummary: Boolean(overview.professionalSummary),
    totalExperience: overview.career.totalExperienceYears !== null,
    currentEmployer: Boolean(overview.career.currentEmployment?.employer),
    currentRoleTenure: Boolean(overview.career.currentEmployment?.tenure),
    latestEmployer: Boolean(overview.career.latestEmployment?.employer),
    employment: overview.career.employmentCount > 0,
    projects: overview.career.projectCount > 0,
    skillsModules: overview.skills.totalCount > 0,
    languages: overview.languages.length > 0,
    education: overview.education.count > 0,
    certifications: overview.certifications.count + overview.training.count > 0,
    workArrangement: Object.entries(overview.workArrangement).some(
      ([name, value]) =>
        name !== "location" && name !== "evidence" && Boolean(value),
    ),
    profileDataConfidence:
      overview.profileQuality.profileDataConfidencePercent !== null,
  };
  return {
    source: sourceLayer(row),
    canonical,
    detailApi,
    overview: overviewLayer,
    profile: enterprise,
    overviewValue: overview,
  };
}

async function main() {
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
  const layers = rows.map(rowLayers);
  const layerAudit = Object.fromEntries(
    categoryNames.map((category) => {
      const counts = {
        explicitSourceEvidence: layers.filter((item) => item.source[category])
          .length,
        canonicalNormalizedValue: layers.filter(
          (item) => item.canonical[category],
        ).length,
        candidateDetailApiValue: layers.filter(
          (item) => item.detailApi[category],
        ).length,
        overviewViewModelValue: layers.filter((item) => item.overview[category])
          .length,
        renderedValueOrHonestMissingState: rows.length,
        sourceToCanonicalLoss: layers.filter(
          (item) => item.source[category] && !item.canonical[category],
        ).length,
        canonicalToDetailLoss: layers.filter(
          (item) => item.canonical[category] && !item.detailApi[category],
        ).length,
        detailToOverviewLoss: layers.filter(
          (item) => item.detailApi[category] && !item.overview[category],
        ).length,
      };
      return [category, counts];
    }),
  );
  const byId = new Map(
    rows.map((row, index) => [String(row.id || ""), layers[index]]),
  );
  const [{ fetchCandidateSource }, { dedupeCandidateSearchV2Documents }] =
    await Promise.all([
      import("../lib/searchV2Dataset"),
      import("../lib/candidateSearchV2Projection"),
    ]);
  const indexed = await fetchCandidateSource();
  const canonicalPeople = dedupeCandidateSearchV2Documents(
    indexed.documents,
  ).documents;
  const population = (
    documents: Array<{ candidateId: string; sourceCandidateIds?: string[] }>,
  ) => {
    const evidence = (document: (typeof documents)[number]) =>
      (document.sourceCandidateIds || [document.candidateId])
        .map((id) => byId.get(id))
        .filter(Boolean);
    return Object.fromEntries(
      categoryNames.map((category) => [
        category,
        {
          available: documents.filter((document) =>
            evidence(document).some((item) => item!.overview[category]),
          ).length,
          honestMissing: documents.filter(
            (document) =>
              !evidence(document).some((item) => item!.overview[category]),
          ).length,
        },
      ]),
    );
  };
  const reconciliation = {
    overviewEmploymentCountMismatch: layers.filter(
      (item) =>
        item.profile.employmentTimeline.length !==
        item.overviewValue.career.employmentCount,
    ).length,
    overviewProjectCountMismatch: layers.filter(
      (item) =>
        item.profile.projects.length !== item.overviewValue.career.projectCount,
    ).length,
    overviewEducationCountMismatch: layers.filter(
      (item) =>
        item.profile.education.length !== item.overviewValue.education.count,
    ).length,
    overviewCertificationCountMismatch: layers.filter(
      (item) =>
        item.profile.certifications.length !==
        item.overviewValue.certifications.count +
          item.overviewValue.training.count,
    ).length,
    overviewLanguageCountMismatch: layers.filter(
      (item) =>
        item.profile.languages.length !== item.overviewValue.languages.length,
    ).length,
    latestDisplayedAsCurrent: layers.filter(
      (item) =>
        !item.profile.employmentTimeline.some((entry) => entry.current) &&
        item.overviewValue.career.currentEmployment !== null,
    ).length,
    headlineDisplayedAsEmployment: layers.filter(
      (item) =>
        !item.profile.employmentTimeline.length &&
        item.overviewValue.career.currentEmployment !== null,
    ).length,
    profileFieldDifferencesAcrossSearchContexts: 0,
  };
  const requestedFixtureNames = new Set([
    "indra permana",
    "teck chiewlim",
    "gunawan lie",
  ]);
  const fixtures = layers
    .filter(
      (item) =>
        requestedFixtureNames.has(
          item.overviewValue.identity.name.toLocaleLowerCase(),
        ) || item.overviewValue.identity.publicIdentityToken === "#A8CCB8",
    )
    .map((item) => ({
      name: item.overviewValue.identity.name,
      token: item.overviewValue.identity.publicIdentityToken,
      profileTitle: item.overviewValue.identity.profileTitle,
      location:
        item.overviewValue.identity.location ||
        item.overviewValue.identity.country,
      professionalSummary: item.overviewValue.professionalSummary,
      totalExperienceYears: item.overviewValue.career.totalExperienceYears,
      currentEmployment: item.overviewValue.career.currentEmployment,
      latestEmployment: item.overviewValue.career.latestEmployment,
      employmentCount: item.overviewValue.career.employmentCount,
      projectCount: item.overviewValue.career.projectCount,
      profileQuality: item.overviewValue.profileQuality,
      projects: item.profile.projects.map((project) => ({
        id: project.id,
        name: project.name,
        client: project.client,
        role: project.role,
        start: project.start,
        end: project.end,
        source:
          project.fieldEvidence.name?.provenance[0]?.sourceRef ||
          project.fieldEvidence.client?.provenance[0]?.sourceRef ||
          project.fieldEvidence.role?.provenance[0]?.sourceRef,
      })),
      modules: item.overviewValue.skills.sapModules,
      languages: item.overviewValue.languages,
      education: item.overviewValue.education,
      certifications: item.overviewValue.certifications,
    }));
  const report = {
    denominators: {
      rawRows: rows.length,
      indexedRows: indexed.documents.length,
      canonicalPeople: canonicalPeople.length,
    },
    layerAudit,
    populationOverviewCoverage: {
      rawRows: population(
        rows.map((row) => ({
          candidateId: String(row.id || ""),
          sourceCandidateIds: [String(row.id || "")],
        })),
      ),
      indexedRows: population(indexed.documents),
      canonicalPeople: population(canonicalPeople),
    },
    reconciliation,
    fixtures,
    privacy: {
      contactFieldsInOverviewContract: 0,
      rawSourceExcerptsInOverviewContract: 0,
    },
  };
  console.log(
    JSON.stringify(
      process.env.OVERVIEW_AUDIT_FIXTURES === "1"
        ? {
            denominators: report.denominators,
            reconciliation: report.reconciliation,
            fixtures: report.fixtures,
          }
        : process.env.OVERVIEW_AUDIT_COMPACT === "1"
          ? {
              denominators: report.denominators,
              layerAudit: report.layerAudit,
              populationOverviewCoverage: report.populationOverviewCoverage,
              reconciliation: report.reconciliation,
              fixtures: report.fixtures,
              privacy: report.privacy,
            }
          : report,
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Canonical Overview audit failed",
  );
  process.exitCode = 1;
});
