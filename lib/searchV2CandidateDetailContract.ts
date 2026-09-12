import type { Candidate360Profile } from "./candidate360Types";
import type { CanonicalProfileOverview } from "./candidateProfileOverview";
import {
  cleanCandidateProjectResponsibilities,
  cleanCandidatePresentationEntity,
  cleanCandidatePresentationText,
  splitCandidatePresentationSegments,
} from "./candidatePresentationText";
import { buildCandidateEducationPresentation } from "./candidateProfilePresentation";

export const SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION =
  "search-v2-candidate-detail-response-v28-canonical-education-presentation";

export type SearchV2CandidateDetailScope = "recruiter" | "technical_debug";

export type RecruiterCanonicalProfileOverview = Omit<
  CanonicalProfileOverview,
  "provenance"
>;

export type SearchV2RecruiterCandidateDetail = ReturnType<
  typeof buildSearchV2RecruiterCandidateDetail
>;

function cleanStringArray(values: readonly unknown[]) {
  return [
    ...new Map(
      values
        .map(cleanCandidatePresentationText)
        .filter(Boolean)
        .map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
}

function recruiterOverview(
  overview: CanonicalProfileOverview,
): RecruiterCanonicalProfileOverview {
  const { provenance: _technicalProvenance, ...visible } = overview;
  return sanitizeStrings(visible) as RecruiterCanonicalProfileOverview;
}

function sanitizeStrings(value: unknown): unknown {
  if (typeof value === "string") return cleanCandidatePresentationText(value);
  if (Array.isArray(value)) return value.map(sanitizeStrings);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeStrings(item)]),
    );
  return value;
}

const visibleField = (field: { value: unknown }) => ({
  value: cleanCandidatePresentationText(field.value),
});

export function buildSearchV2RecruiterCandidateDetail(
  profile: Candidate360Profile,
) {
  if (!profile.canonicalOverview)
    throw new Error("canonical_candidate_overview_required");
  const enterprise = profile.enterpriseProfile;
  const canonicalEducationRecords = enterprise.education?.length
    ? enterprise.education.map((item) => ({
        id: item.id,
        institution: item.institution,
        qualification: item.qualification,
        fieldOfStudy: item.fieldOfStudy,
        startYear: item.startYear,
        endYear: item.endYear,
        graduationYear: item.endYear,
      }))
    : profile.education.map((item) => ({
        id: item.id,
        institution: item.institution.value,
        qualification: item.qualification.value,
        fieldOfStudy: item.fieldOfStudy.value,
        graduationYear: item.graduationYear.value,
      }));
  const educationPresentation = buildCandidateEducationPresentation({
    educationRecords: canonicalEducationRecords,
    credentialRecords: enterprise.certifications || profile.certifications,
  });
  const overview = recruiterOverview(profile.canonicalOverview);
  const canonicalOverview = {
    ...overview,
    education: {
      ...overview.education,
      count: educationPresentation.educationRecords.length,
      highestOrLatest: educationPresentation.educationRecords.length
        ? overview.education.highestOrLatest
        : null,
    },
    certifications: {
      count: educationPresentation.certificationRecords.length,
      items: educationPresentation.certificationRecords
        .slice(0, 4)
        .map((value) => ({
          value,
          evidenceStatus: "source_supported" as const,
          verificationStatus: "not_verified" as const,
        })),
    },
    training: {
      count: educationPresentation.trainingRecords.length,
      items: educationPresentation.trainingRecords.slice(0, 4).map((value) => ({
        value,
        evidenceStatus: "source_supported" as const,
        verificationStatus: "not_verified" as const,
      })),
    },
  };
  return {
    contractVersion: SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION,
    candidateId: profile.candidateId,
    canonicalOverview,
    educationPresentation,
    enterpriseProfile: {
      identity: {
        name: cleanCandidatePresentationEntity(enterprise.identity.name),
        profileTitle: cleanCandidatePresentationEntity(
          enterprise.identity.profileTitle,
        ),
        currentTitle: cleanCandidatePresentationEntity(
          enterprise.identity.currentTitle,
        ),
        currentCompany: cleanCandidatePresentationEntity(
          enterprise.identity.currentCompany,
        ),
        headline: cleanCandidatePresentationText(enterprise.identity.headline),
        location: cleanCandidatePresentationEntity(
          enterprise.identity.location,
        ),
        country: cleanCandidatePresentationEntity(enterprise.identity.country),
      },
      employmentTimeline: enterprise.employmentTimeline.map((item) => ({
        id: item.id,
        company: cleanCandidatePresentationEntity(item.company),
        title: cleanCandidatePresentationEntity(item.title),
        location: cleanCandidatePresentationEntity(item.location),
        modules: cleanStringArray(item.modules),
        achievements: splitCandidatePresentationSegments(item.achievements),
        start: cleanCandidatePresentationText(item.start),
        end: cleanCandidatePresentationText(item.end),
        duration: cleanCandidatePresentationText(item.duration),
        current: item.current,
        linkedProjectIds: [...(item.linkedProjectIds || [])],
      })),
      projects: enterprise.projects.map((item) => ({
        id: item.id,
        name: cleanCandidatePresentationEntity(item.name),
        client: cleanCandidatePresentationEntity(item.client),
        employer: cleanCandidatePresentationEntity(item.employer),
        industry: cleanCandidatePresentationEntity(item.industry),
        country: cleanCandidatePresentationEntity(item.country),
        role: cleanCandidatePresentationEntity(item.role),
        modules: cleanStringArray(item.modules),
        projectType: cleanCandidatePresentationEntity(item.projectType),
        implementationType: cleanCandidatePresentationEntity(
          item.implementationType,
        ),
        start: cleanCandidatePresentationText(item.start),
        end: cleanCandidatePresentationText(item.end),
        duration: cleanCandidatePresentationText(item.duration),
        responsibilities: cleanCandidateProjectResponsibilities(
          item.responsibilities,
        ),
        teamSize: item.teamSize,
        environment: cleanCandidatePresentationText(item.environment),
      })),
      certifications: cleanStringArray(enterprise.certifications),
    },
    sectionAvailability: {
      experience: enterprise.quality.extraction.experience.status,
      projects: enterprise.quality.extraction.projects.status,
    },
    education: educationPresentation.educationRecords.map((item) => ({
      id: item.id,
      institution: { value: item.institution },
      qualification: { value: item.qualification },
      fieldOfStudy: { value: item.fieldOfStudy },
      graduationYear: { value: item.graduationYear || item.endYear },
    })),
    location: visibleField(profile.location),
  };
}
