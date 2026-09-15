import { normalizeActualCandidateSchema } from "./candidate360SchemaNormalize";
import { isDeepStrictEqual } from "node:util";

export const ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION = "ptf1c2a-candidate-v3";
export const ACCEPTANCE_SYNTHETIC_CANDIDATE_ID =
  "a11ce000-0000-4000-8000-00000000012a";
// Stable database lease identifier; independent of the searchable person name.
export const ACCEPTANCE_SYNTHETIC_REGISTRY_MARKER = "PTF Synthetic Tester";
export const ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER = "Synthetic PTF Tester";
export const ACCEPTANCE_INTERNAL_SEARCH_QUERY = "Synthetic PTF Tester";

export type AcceptanceSyntheticRegistryRecord = {
  marker?: unknown;
  candidate_id?: unknown;
  fixture_version?: unknown;
  synthetic_namespace?: unknown;
  owner_run_id?: unknown;
  owner_hash?: unknown;
  environment_id?: unknown;
  project_ref?: unknown;
  expected_commit_sha?: unknown;
  expires_at?: unknown;
  search_query?: unknown;
  active?: unknown;
};

export function acceptanceSyntheticCandidateRecord() {
  return {
    id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
    name: ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
    email: "ptf-synthetic-sap-fico@acceptance.invalid",
    phone: null,
    linkedin_url: null,
    title: "SAP FICO Consultant",
    current_title: "SAP FICO Consultant",
    current_company: "PTF Synthetic Consulting Ltd",
    headline: "Synthetic SAP FICO acceptance profile",
    summary:
      "Synthetic acceptance profile with canonical employment and a separate implementation assignment.",
    current_location: "Malaysia",
    location: "Malaysia",
    country: "Malaysia",
    primary_module: "FICO",
    secondary_modules: ["FI", "CO"],
    skills: ["FICO", "FI", "CO"],
    sap_modules: ["FICO", "FI", "CO"],
    experience: JSON.stringify([
      {
        id: "ptf-current-employment",
        company: "PTF Synthetic Consulting Ltd",
        title: "SAP FICO Consultant",
        start_date: "2022-01",
        end_date: "Present",
        location: "Malaysia",
        responsibilities: [
          "Delivered SAP FICO configuration for a bounded synthetic assignment.",
        ],
      },
      {
        id: "ptf-historical-employment",
        company: "PTF Synthetic Services Ltd",
        title: "SAP Finance Analyst",
        start_date: "2018-01",
        end_date: "2021-12",
        location: "Malaysia",
        responsibilities: ["Supported SAP FI and CO operations."],
      },
    ]),
    resume_text: [
      "PROFESSIONAL EXPERIENCE",
      "PTF Synthetic Consulting Ltd | SAP FICO Consultant | January 2022 - Present",
      "PTF Synthetic Services Ltd | SAP Finance Analyst | January 2018 - December 2021",
      "PROJECT EXPERIENCE",
      "Project: PTF Synthetic S/4HANA Finance Implementation Employer: PTF Synthetic Consulting Ltd Client: PTF Synthetic Manufacturing Client Duration: January 2023 - December 2023 Role: SAP FICO Consultant Responsibilities: Implemented SAP S/4HANA FICO design, configuration, testing, go-live and hypercare.",
    ].join("\n"),
    raw_text: "",
    education: "[]",
    status: "ACTIVE",
    implementation_project_count: 1,
    s4hana_project_count: 1,
    extraction_confidence: "1",
    profile_quality_score: 100,
    confidence: "1",
  };
}

export function validateAcceptanceSyntheticCandidate(value: unknown) {
  const candidate = value as Record<string, unknown>;
  const expected = acceptanceSyntheticCandidateRecord() as Record<
    string,
    unknown
  >;
  const blockers: string[] = [];
  if (candidate.id !== ACCEPTANCE_SYNTHETIC_CANDIDATE_ID)
    blockers.push("synthetic_candidate_id_mismatch");
  if (candidate.name !== ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER)
    blockers.push("synthetic_candidate_marker_mismatch");
  if (
    String(candidate.email || "").toLowerCase() !==
    "ptf-synthetic-sap-fico@acceptance.invalid"
  )
    blockers.push("synthetic_candidate_email_invalid");
  if (candidate.phone || candidate.linkedin_url)
    blockers.push("synthetic_candidate_contact_or_social_present");
  for (const field of [
    "id",
    "name",
    "email",
    "phone",
    "linkedin_url",
    "title",
    "current_title",
    "current_company",
    "headline",
    "summary",
    "current_location",
    "raw_text",
    "resume_text",
    "location",
    "country",
    "experience",
    "education",
    "skills",
    "sap_modules",
    "primary_module",
    "secondary_modules",
    "status",
  ])
    if (!isDeepStrictEqual(candidate[field], expected[field]))
      blockers.push("synthetic_candidate_unapproved_field_value");
  const serialized = JSON.stringify(candidate);
  for (const required of [
    "PTF Synthetic Consulting Ltd",
    "PTF Synthetic Services Ltd",
    "PTF Synthetic Manufacturing Client",
    "SAP FICO",
  ])
    if (!serialized.includes(required))
      blockers.push("synthetic_candidate_required_evidence_missing");

  const canonical = normalizeActualCandidateSchema(candidate);
  if (canonical.candidateName !== ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER)
    blockers.push("synthetic_candidate_canonical_name_missing");
  const employment = canonical.enterpriseProfile.employmentTimeline;
  const projects = canonical.enterpriseProfile.projects;
  if (employment.length !== 2)
    blockers.push("synthetic_candidate_employment_contract_invalid");
  if (!employment.some((item) => /present/i.test(item.end || "")))
    blockers.push("synthetic_candidate_current_provenance_missing");
  if (!employment.every((item) => item.start && item.end))
    blockers.push("synthetic_candidate_dated_employment_missing");
  if (
    !projects.some(
      (item) =>
        item.client === "PTF Synthetic Manufacturing Client" &&
        item.employer === "PTF Synthetic Consulting Ltd",
    )
  )
    blockers.push("synthetic_candidate_project_separation_invalid");
  if (!canonical.enterpriseProfile.experienceSummary.totalCareerYears)
    blockers.push("synthetic_candidate_total_experience_unavailable");
  return {
    valid: blockers.length === 0,
    blockers: [...new Set(blockers)],
    canonical: {
      employmentRecords: employment.length,
      projectRecords: projects.length,
      currentEmploymentRecords: employment.filter((item) =>
        /present/i.test(item.end || ""),
      ).length,
      totalCareerYears:
        canonical.enterpriseProfile.experienceSummary.totalCareerYears,
    },
  };
}
