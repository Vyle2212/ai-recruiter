import type { Candidate360Profile } from "./candidate360Types";
import type {
  EnterpriseEmployment,
  EnterpriseProject,
} from "./candidate360SchemaNormalize";
import { canonicalTalentSearchIdentity } from "./talentSearchDisplay";
import { normalizedDisplayTitle } from "./candidateSearchV2Projection";
import { buildCandidateEducationPresentation } from "./candidateProfilePresentation";

export const CANONICAL_PROFILE_OVERVIEW_VERSION =
  "canonical-profile-overview-v13-external-structured-employment";

export type CanonicalOverviewEvidenceState =
  "Verified" | "Supported" | "Not verified";

export type CanonicalOverviewEvidenceDescriptor = Readonly<{
  evidenceStatus: "source_supported" | "unsupported";
  verificationStatus: "verified" | "not_verified";
}>;

export type CanonicalOverviewEmployment = Readonly<{
  id: string;
  title: string | null;
  employer: string | null;
  start: string | null;
  end: string | null;
  current: boolean;
  tenure: string | null;
  location: string | null;
}>;

export type CanonicalOverviewProject = Readonly<{
  id: string;
  name: string | null;
  client: string | null;
  employer: string | null;
  role: string | null;
  start: string | null;
  end: string | null;
  lifecycle: string[];
  modules: string[];
  linkedEmploymentIds: string[];
}>;

export type CanonicalProfileOverview = Readonly<{
  version: typeof CANONICAL_PROFILE_OVERVIEW_VERSION;
  identity: {
    candidateId: string;
    name: string;
    nameAvailable: boolean;
    publicIdentityToken: string;
    talentPool: "internal_profiles" | "linkedin_talent_pool";
    profileTitle: string | null;
    headline: string | null;
    location: string | null;
    country: string | null;
  };
  profileQuality: {
    profileDataConfidencePercent: number | null;
    sourceCompletenessPercent: number | null;
    profileCompletenessPercent: number | null;
  };
  professionalSummary: string | null;
  career: {
    totalExperienceYears: number | null;
    currentEmployment: CanonicalOverviewEmployment | null;
    currentEmployments: CanonicalOverviewEmployment[];
    latestEmployment: CanonicalOverviewEmployment | null;
    employmentCount: number;
    projectCount: number;
    supportedGapCount: number | null;
  };
  skills: {
    sapModules: Array<
      {
        value: string;
        state: CanonicalOverviewEvidenceState;
      } & CanonicalOverviewEvidenceDescriptor
    >;
    functional: Array<
      {
        value: string;
        state: CanonicalOverviewEvidenceState;
      } & CanonicalOverviewEvidenceDescriptor
    >;
    technical: Array<
      {
        value: string;
        state: CanonicalOverviewEvidenceState;
      } & CanonicalOverviewEvidenceDescriptor
    >;
    lifecycle: string[];
    industries: string[];
    totalCount: number;
  };
  employmentHighlights: CanonicalOverviewEmployment[];
  projectHighlights: CanonicalOverviewProject[];
  education: {
    count: number;
    highestOrLatest: {
      qualification: string | null;
      institution: string | null;
      fieldOfStudy: string | null;
      completionDate: string | null;
    } | null;
  };
  certifications: {
    count: number;
    items: Array<{ value: string } & CanonicalOverviewEvidenceDescriptor>;
  };
  training: {
    count: number;
    items: Array<{ value: string } & CanonicalOverviewEvidenceDescriptor>;
  };
  languages: Array<
    {
      value: string;
      proficiency: string | null;
      state: CanonicalOverviewEvidenceState;
    } & CanonicalOverviewEvidenceDescriptor
  >;
  workArrangement: {
    location: string | null;
    workAuthorization: string | null;
    remote: string | null;
    relocation: string | null;
    travel: string | null;
    noticePeriod: string | null;
    availability: string | null;
    evidence: Record<
      | "workAuthorization"
      | "remote"
      | "relocation"
      | "travel"
      | "noticePeriod"
      | "availability",
      CanonicalOverviewEvidenceDescriptor
    >;
  };
  provenance: {
    sourceTypes: string[];
    groundedCategories: string[];
    unavailableCategories: string[];
    canonicalProfileVersion: string;
  };
}>;

const clean = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
};

const supportedFact = (value: unknown) => {
  const normalized = clean(value);
  return !normalized ||
    /^(?:not yet verified|not verified|unknown|not established(?: from source)?|n\/?a|none|unavailable)$/i.test(
      normalized,
    )
    ? null
    : normalized;
};

const unique = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = clean(value);
    if (!normalized) return [];
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
};

function fieldState(field: {
  verificationStatus?: string;
  source?: string;
  evidence?: string;
}): CanonicalOverviewEvidenceState {
  if (
    field.verificationStatus === "recruiter_verified" ||
    field.verificationStatus === "candidate_confirmed"
  )
    return "Verified";
  if (clean(field.evidence) && field.source !== "unknown") return "Supported";
  return "Not verified";
}

function evidenceDescriptor(field?: {
  value?: unknown;
  verificationStatus?: string;
  source?: string;
  evidence?: string;
}): CanonicalOverviewEvidenceDescriptor {
  return {
    evidenceStatus:
      field &&
      (clean(field.value) || clean(field.evidence)) &&
      field.source !== "unknown"
        ? "source_supported"
        : "unsupported",
    verificationStatus:
      field &&
      ["recruiter_verified", "candidate_confirmed"].includes(
        field.verificationStatus || "",
      )
        ? "verified"
        : "not_verified",
  };
}

function employmentView(
  item: EnterpriseEmployment,
): CanonicalOverviewEmployment {
  return {
    id: item.id,
    title: clean(item.title),
    employer: clean(item.company),
    start: clean(item.start),
    end: item.current ? "Present" : clean(item.end),
    current: item.current,
    tenure: clean(item.duration),
    location: clean(item.location),
  };
}

function profileTitleView(
  value: unknown,
  employment: EnterpriseEmployment[],
  currentCompany?: unknown,
) {
  const title = clean(normalizedDisplayTitle(value, currentCompany));
  if (!title) return null;
  const comparable = title.toLocaleLowerCase();
  for (const item of employment) {
    const employer = clean(item.company);
    if (!employer) continue;
    const suffix = employer.toLocaleLowerCase();
    for (const separator of [" - ", " — ", " – "]) {
      const compositeSuffix = `${separator}${suffix}`;
      if (!comparable.endsWith(compositeSuffix)) continue;
      return clean(title.slice(0, title.length - compositeSuffix.length));
    }
  }
  return title;
}

function projectView(
  item: EnterpriseProject,
  employment: EnterpriseEmployment[],
): CanonicalOverviewProject {
  return {
    id: item.id,
    name: clean(item.name),
    client: clean(item.client),
    employer:
      clean(item.employer) ||
      clean(
        employment.find((entry) => entry.linkedProjectIds?.includes(item.id))
          ?.company,
      ),
    role: clean(item.role),
    start: clean(item.start),
    end: clean(item.end),
    lifecycle: unique([item.projectType, item.implementationType]),
    modules: unique(item.modules),
    linkedEmploymentIds: employment
      .filter((entry) => entry.linkedProjectIds?.includes(item.id))
      .map((entry) => entry.id),
  };
}

type SupportedDate = { year: number; month: number };
function supportedDate(value: string | null): SupportedDate | null {
  if (!value || /present|current|now/i.test(value)) return null;
  const match = value.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+((?:19|20)\d{2})\b/i,
  );
  const numeric = value.match(/\b((?:19|20)\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (numeric) return { year: Number(numeric[1]), month: Number(numeric[2]) };
  if (!match) return null;
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  return {
    year: Number(match[2]),
    month: months.indexOf(match[1].slice(0, 3).toLocaleLowerCase()) + 1,
  };
}

function supportedEmploymentGapCount(employment: EnterpriseEmployment[]) {
  const dated = employment
    .flatMap((item) => {
      const start = supportedDate(clean(item.start));
      const end = item.current
        ? {
            year: new Date().getUTCFullYear(),
            month: new Date().getUTCMonth() + 1,
          }
        : supportedDate(clean(item.end));
      return start && end ? [{ start, end }] : [];
    })
    .sort(
      (a, b) =>
        a.start.year * 12 + a.start.month - (b.start.year * 12 + b.start.month),
    );
  if (dated.length < 2) return null;
  const merged: typeof dated = [];
  for (const interval of dated) {
    const previous = merged.at(-1);
    const intervalStart = interval.start.year * 12 + interval.start.month;
    const previousEnd = previous
      ? previous.end.year * 12 + previous.end.month
      : -1;
    if (!previous || intervalStart > previousEnd + 1)
      merged.push({ ...interval });
    else if (interval.end.year * 12 + interval.end.month > previousEnd)
      previous.end = { ...interval.end };
  }
  return Math.max(0, merged.length - 1);
}

/**
 * Builds profile truth only. Search requirements, scores and match evidence are
 * deliberately not accepted as inputs, keeping this projection search-independent.
 */
export function buildCanonicalProfileOverview(
  profile: Candidate360Profile,
): CanonicalProfileOverview {
  const enterprise = profile.enterpriseProfile;
  const identity = canonicalTalentSearchIdentity(
    profile.candidateId,
    enterprise.identity.name,
    profile.displayName.value,
  );
  const current =
    enterprise.employmentTimeline.find((item) => item.current) || null;
  const currentEmployments = enterprise.employmentTimeline
    .filter((item) => item.current)
    .map(employmentView);
  const latest = enterprise.employmentTimeline[0] || null;
  const sapModules = profile.sapModules
    .filter((item) => item.category === "sap_module")
    .map((item) => ({
      value: item.name.value,
      state: fieldState(item.name),
      ...evidenceDescriptor(item.name),
    }));
  const functional = profile.sapModules
    .filter((item) => item.category === "functional")
    .map((item) => ({
      value: item.name.value,
      state: fieldState(item.name),
      ...evidenceDescriptor(item.name),
    }));
  const technical = profile.techSkills.map((item) => ({
    value: item.name.value,
    state: fieldState(item.name),
    ...evidenceDescriptor(item.name),
  }));
  const sourceTypes = unique([
    ...enterprise.employmentTimeline.flatMap((item) =>
      (item.provenance || []).map((entry) => entry.sourceType),
    ),
    ...enterprise.projects.flatMap((item) =>
      Object.values(item.fieldEvidence).flatMap((field) =>
        (field?.provenance || []).map((entry) => entry.sourceType),
      ),
    ),
    ...Object.values(enterprise.quality.sectionEvidence).flatMap((section) =>
      section.provenance.map((entry) => entry.sourceType),
    ),
  ]);
  const grounded = {
    identity:
      identity.nameAvailable || Boolean(clean(enterprise.identity.location)),
    professionalSummary: Boolean(clean(enterprise.professionalSummary)),
    employment: enterprise.employmentTimeline.length > 0,
    projects: enterprise.projects.length > 0,
    skills: sapModules.length + technical.length > 0,
    education: enterprise.education.length > 0,
    certifications: enterprise.certifications.length > 0,
    languages: enterprise.languages.length > 0,
    workArrangement: Boolean(
      supportedFact(enterprise.recruiterSignals.availability) ||
      supportedFact(enterprise.recruiterSignals.notice) ||
      supportedFact(enterprise.recruiterSignals.remote) ||
      supportedFact(enterprise.recruiterSignals.relocation) ||
      supportedFact(enterprise.recruiterSignals.travel) ||
      supportedFact(enterprise.recruiterSignals.visa),
    ),
  };
  const groundedCategories = Object.entries(grounded)
    .filter(([, value]) => value)
    .map(([key]) => key);
  const unavailableCategories = Object.entries(grounded)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const educationPresentation = buildCandidateEducationPresentation({
    educationRecords: enterprise.education.map((item) => ({
      id: item.id,
      institution: item.institution,
      qualification: item.qualification,
      fieldOfStudy: item.fieldOfStudy,
      startYear: item.startYear,
      endYear: item.endYear,
      graduationYear: item.endYear,
    })),
    credentialRecords: enterprise.certifications,
  });
  const highestOrLatest = educationPresentation.educationRecords
    .slice()
    .sort(
      (left, right) =>
        Number(right.endYear || right.startYear || 0) -
        Number(left.endYear || left.startYear || 0),
    )[0];
  const lifecycle = unique(
    enterprise.projects.flatMap((item) => [
      item.projectType,
      item.implementationType,
    ]),
  );
  const profileTitle = profileTitleView(
    enterprise.identity.profileTitle,
    enterprise.employmentTimeline,
    enterprise.identity.currentCompany,
  );
  const arrangementValues = {
    workAuthorization: supportedFact(enterprise.recruiterSignals.visa),
    remote: supportedFact(enterprise.recruiterSignals.remote),
    relocation: supportedFact(enterprise.recruiterSignals.relocation),
    travel: supportedFact(enterprise.recruiterSignals.travel),
    noticePeriod: supportedFact(enterprise.recruiterSignals.notice),
    availability: supportedFact(enterprise.recruiterSignals.availability),
  };
  const sourceCompletenessPercent = enterprise.quality.completenessComponents
    .length
    ? Math.round(
        (enterprise.quality.completenessComponents.filter(
          (item) => item.state !== "missing",
        ).length /
          enterprise.quality.completenessComponents.length) *
          100,
      )
    : null;
  const credentialItem = (value: string) => ({
    value,
    evidenceStatus: "source_supported" as const,
    verificationStatus: "not_verified" as const,
  });
  return {
    version: CANONICAL_PROFILE_OVERVIEW_VERSION,
    identity: {
      candidateId: profile.candidateId,
      name: identity.displayName,
      nameAvailable: identity.nameAvailable,
      publicIdentityToken: identity.identityToken,
      talentPool: "internal_profiles",
      profileTitle: profileTitle || clean(enterprise.identity.headline),
      headline:
        clean(enterprise.identity.headline) !==
        (profileTitle || clean(enterprise.identity.currentTitle))
          ? clean(enterprise.identity.headline)
          : null,
      location: clean(enterprise.identity.location),
      country: clean(enterprise.identity.country),
    },
    profileQuality: {
      profileDataConfidencePercent: Number.isFinite(
        enterprise.quality.dataConfidence,
      )
        ? enterprise.quality.dataConfidence
        : null,
      sourceCompletenessPercent,
      profileCompletenessPercent: Number.isFinite(
        enterprise.quality.profileCompleteness,
      )
        ? enterprise.quality.profileCompleteness
        : null,
    },
    professionalSummary: clean(enterprise.professionalSummary),
    career: {
      totalExperienceYears: enterprise.experienceSummary.totalCareerYears,
      currentEmployment: current ? employmentView(current) : null,
      currentEmployments,
      latestEmployment: latest ? employmentView(latest) : null,
      employmentCount: enterprise.employmentTimeline.length,
      projectCount: enterprise.projects.length,
      supportedGapCount: supportedEmploymentGapCount(
        enterprise.employmentTimeline,
      ),
    },
    skills: {
      sapModules,
      functional,
      technical,
      lifecycle,
      industries: unique(enterprise.careerHighlights.industries),
      totalCount: unique([
        ...sapModules.map((item) => item.value),
        ...functional.map((item) => item.value),
        ...technical.map((item) => item.value),
      ]).length,
    },
    employmentHighlights: enterprise.employmentTimeline
      .slice(0, 3)
      .map(employmentView),
    projectHighlights: enterprise.projects
      .slice(0, 2)
      .map((item) => projectView(item, enterprise.employmentTimeline)),
    education: {
      count: educationPresentation.educationRecords.length,
      highestOrLatest: highestOrLatest
        ? {
            qualification: clean(highestOrLatest.qualification),
            institution: clean(highestOrLatest.institution),
            fieldOfStudy: clean(highestOrLatest.fieldOfStudy),
            completionDate: clean(highestOrLatest.endYear),
          }
        : null,
    },
    certifications: {
      count: educationPresentation.certificationRecords.length,
      items: educationPresentation.certificationRecords
        .slice(0, 4)
        .map(credentialItem),
    },
    training: {
      count: educationPresentation.trainingRecords.length,
      items: educationPresentation.trainingRecords
        .slice(0, 4)
        .map(credentialItem),
    },
    languages: enterprise.languages.map((item) => ({
      value: item.language,
      proficiency: clean(item.proficiency),
      state:
        enterprise.quality.sectionEvidence.languages.state ===
        "structured_available"
          ? "Supported"
          : "Not verified",
      evidenceStatus:
        enterprise.quality.sectionEvidence.languages.state ===
        "structured_available"
          ? "source_supported"
          : "unsupported",
      verificationStatus: "not_verified",
    })),
    workArrangement: {
      location: clean(enterprise.identity.location),
      ...arrangementValues,
      evidence: Object.fromEntries(
        (
          Object.keys(arrangementValues) as Array<
            keyof typeof arrangementValues
          >
        ).map((key) => [
          key,
          {
            evidenceStatus: arrangementValues[key]
              ? "source_supported"
              : "unsupported",
            verificationStatus: "not_verified",
          },
        ]),
      ) as CanonicalProfileOverview["workArrangement"]["evidence"],
    },
    provenance: {
      sourceTypes,
      groundedCategories,
      unavailableCategories,
      canonicalProfileVersion: enterprise.quality.extraction.experience.version,
    },
  };
}

/** External profiles use the same shape while honestly marking unavailable
 * internal-only categories. This does not initiate or alter provider retrieval. */
export function buildExternalCanonicalProfileOverview(input: {
  candidateId: string;
  candidateName?: string | null;
  profileTitle?: string | null;
  currentEmployer?: string | null;
  location?: string | null;
  country?: string | null;
  totalExperienceYears?: number | null;
  professionalSummary?: string | null;
  employmentRecords?: Array<{
    id: string;
    title: string | null;
    employer: string | null;
    start: string | null;
    end: string | null;
    current: boolean;
    location?: string | null;
  }>;
  employmentEvidence?: string[];
  projectEvidence?: string[];
  educationEvidence?: string[];
  certificationEvidence?: string[];
  skills?: string[];
  evidenceConfidencePercent?: number | null;
  profileCompletenessPercent?: number | null;
  sourceTypes?: string[];
}): CanonicalProfileOverview {
  const identity = canonicalTalentSearchIdentity(
    input.candidateId,
    input.candidateName,
  );
  const unique = (values: Array<string | null | undefined>) => [
    ...new Map(
      values
        .map((value) => clean(value))
        .filter((value): value is string => Boolean(value))
        .map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
  const employmentEvidence = unique(input.employmentEvidence || []);
  const projectEvidence = unique(input.projectEvidence || []);
  const educationEvidence = unique(input.educationEvidence || []);
  const certificationEvidence = unique(input.certificationEvidence || []);
  const skills = unique(input.skills || []);
  const structuredEmployment = (input.employmentRecords || []).map(
    (record) => ({
      id: record.id,
      title: clean(record.title),
      employer: clean(record.employer),
      start: clean(record.start),
      end: record.current ? "Present" : clean(record.end),
      current: record.current,
      tenure: null,
      location: clean(record.location),
    }),
  );
  const sapModuleExpression =
    /^(?:SAP\s+)?(?:FICO|FI|CO|MM|SD|PP|PM|PS|QM|WM|EWM|TM|HCM|HR|BW|BI|BTP|ABAP|BASIS|FSCM|FICA|SAC|S\/4HANA)$/i;
  const descriptor = {
    evidenceStatus: "source_supported" as const,
    verificationStatus: "not_verified" as const,
  };
  const sapModules = skills
    .filter((value) => sapModuleExpression.test(value))
    .map((value) => ({ value, state: "Supported" as const, ...descriptor }));
  const functional = skills
    .filter((value) => !sapModuleExpression.test(value))
    .map((value) => ({ value, state: "Supported" as const, ...descriptor }));
  const currentEmployment =
    structuredEmployment.find((record) => record.current) ||
    (clean(input.profileTitle) && clean(input.currentEmployer)
      ? {
          id: `external-current:${input.candidateId}`,
          title: clean(input.profileTitle),
          employer: clean(input.currentEmployer),
          start: null,
          end: null,
          current: true,
          tenure: null,
          location: clean(input.location),
        }
      : null);
  const latestEmployment = structuredEmployment[0] || currentEmployment;
  const groundedCategories = [
    "identity",
    input.professionalSummary ? "professionalSummary" : null,
    employmentEvidence.length ||
    structuredEmployment.length ||
    currentEmployment
      ? "employment"
      : null,
    projectEvidence.length ? "projects" : null,
    skills.length ? "skills" : null,
    educationEvidence.length ? "education" : null,
    certificationEvidence.length ? "certifications" : null,
  ].filter((value): value is string => Boolean(value));
  const unavailableCategories = [
    "professionalSummary",
    "employment",
    "projects",
    "skills",
    "education",
    "certifications",
    "languages",
    "workArrangement",
  ].filter((value) => !groundedCategories.includes(value));
  return {
    version: CANONICAL_PROFILE_OVERVIEW_VERSION,
    identity: {
      candidateId: input.candidateId,
      name: identity.displayName,
      nameAvailable: identity.nameAvailable,
      publicIdentityToken: identity.identityToken,
      talentPool: "linkedin_talent_pool",
      profileTitle: clean(input.profileTitle),
      headline: null,
      location: clean(input.location),
      country: clean(input.country),
    },
    profileQuality: {
      profileDataConfidencePercent:
        input.evidenceConfidencePercent == null
          ? null
          : Math.max(0, Math.min(100, input.evidenceConfidencePercent)),
      sourceCompletenessPercent: null,
      profileCompletenessPercent:
        input.profileCompletenessPercent == null
          ? null
          : Math.max(0, Math.min(100, input.profileCompletenessPercent)),
    },
    professionalSummary: clean(input.professionalSummary),
    career: {
      totalExperienceYears:
        input.totalExperienceYears == null
          ? null
          : Math.max(0, input.totalExperienceYears),
      currentEmployment,
      currentEmployments: structuredEmployment.filter(
        (record) => record.current,
      ).length
        ? structuredEmployment.filter((record) => record.current)
        : currentEmployment
          ? [currentEmployment]
          : [],
      latestEmployment,
      employmentCount: Math.max(
        structuredEmployment.length,
        employmentEvidence.length,
        currentEmployment ? 1 : 0,
      ),
      projectCount: projectEvidence.length,
      supportedGapCount: null,
    },
    skills: {
      sapModules,
      functional,
      technical: [],
      lifecycle: [],
      industries: [],
      totalCount: skills.length,
    },
    employmentHighlights: structuredEmployment.slice(0, 3),
    projectHighlights: [],
    education: {
      count: educationEvidence.length,
      highestOrLatest: educationEvidence[0]
        ? {
            qualification: educationEvidence[0],
            institution: null,
            fieldOfStudy: null,
            completionDate: null,
          }
        : null,
    },
    certifications: {
      count: certificationEvidence.length,
      items: certificationEvidence.map((value) => ({ value, ...descriptor })),
    },
    training: { count: 0, items: [] },
    languages: [],
    workArrangement: {
      location: clean(input.location),
      workAuthorization: null,
      remote: null,
      relocation: null,
      travel: null,
      noticePeriod: null,
      availability: null,
      evidence: Object.fromEntries(
        [
          "workAuthorization",
          "remote",
          "relocation",
          "travel",
          "noticePeriod",
          "availability",
        ].map((key) => [
          key,
          { evidenceStatus: "unsupported", verificationStatus: "not_verified" },
        ]),
      ) as CanonicalProfileOverview["workArrangement"]["evidence"],
    },
    provenance: {
      sourceTypes: unique(
        input.sourceTypes?.length ? input.sourceTypes : ["external_provider"],
      ),
      groundedCategories,
      unavailableCategories,
      canonicalProfileVersion: "external-profile-provider-projection",
    },
  };
}
