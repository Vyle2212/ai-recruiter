"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION,
  type SearchV2RecruiterCandidateDetail,
} from "@/lib/searchV2CandidateDetailContract";
import { externalProfileActionLabel } from "@/lib/externalProfileUrl";
import { canonicalTalentSearchIdentity } from "@/lib/talentSearchDisplay";
import { resetCandidateDetailsScroll } from "@/lib/candidateDetailsScroll";
import { buildExternalCanonicalProfileOverview } from "@/lib/candidateProfileOverview";
import CanonicalProfileOverview from "@/components/CanonicalProfileOverview";
import type { ProfileDetailFocus } from "@/components/CanonicalProfileOverview";
import {
  candidateProfileTabClassName,
  candidateProfileTabAccessibility,
  candidateProfileTabLabel,
  candidateProfileTabState,
  cleanEmploymentResponsibilities,
  cleanProjectResponsibilities,
  credentialPresentation,
  formatCandidateProfilePeriod,
  type CandidateProfileTab,
} from "@/lib/candidateProfilePresentation";
import { canonicalCandidateSkillCollection } from "@/lib/candidateProfileSkills";
import type { ExternalTalentAnalysisCapability } from "@/lib/externalTalentAnalysisCapability";
import type { CandidateSearchV2ProfilePreview } from "@/lib/candidateSearchV2Types";

export type CandidateDrawerResult = {
  retrievalKind?: "identity_match" | "evaluated_match";
  identityMatchKind?: "exact" | "partial" | "fuzzy";
  evaluation?: { kind: "recruiter_fit" } | null;
  candidateId: string;
  talentPool?: "internal_profiles" | "linkedin_talent_pool";
  linkedInProfileUrl?: string | null;
  profilePreview?: CandidateSearchV2ProfilePreview;
  candidateName: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  location: string | null;
  country: string | null;
  totalYearsExperience: number | null;
  evidenceConfidencePercent?: number | null;
  profileCompletenessPercent?: number | null;
  queryRelevantSkills?: string[];
  profileEvidence?: {
    name?: boolean;
    title?: boolean;
    employer?: boolean;
    location?: boolean;
    experienceDuration?: boolean;
    employmentHistory?: boolean;
    projectHistory?: boolean;
    education?: boolean;
    certifications?: boolean;
    skills?: boolean;
  };
  score: { finalScore: number } | null;
  evidence?: Array<{ label: string; value: string; source?: string | null }>;
  integrity?: {
    requirements: Array<{
      id: string;
      label: string;
      kind?: string;
      state:
        | "verified"
        | "supported"
        | "not_verified"
        | "manual_review"
        | "conflicting"
        | "not_available"
        | "related"
        | "missing";
      reason: string;
    }>;
    currentEmployment?: {
      title: string;
      employer: string;
      location: string;
      start: string;
      end: string;
      duration: string;
    } | null;
  };
};

export type CandidateDrawerDiagnostic = {
  evaluationMode?: "identity_only" | "fit_evaluation";
  matchLevel: string;
  evidenceConfidence: "High" | "Moderate" | "Limited";
  evidenceCoveragePercent: number;
  requirementCoveragePercent?: number | null;
  requirements: NonNullable<CandidateDrawerResult["integrity"]>["requirements"];
  criteria: Array<{
    id: string;
    label: string;
    importance: "most_important" | "important" | "nice_to_have";
    state: "verified" | "supported" | "not_verified" | "conflicting";
    score: number;
    reason: string;
    assignmentEvidence?: {
      totalGroundedProjects: number;
      directTargetAssignments: number;
      directTargetLifecycleAssignments?: number;
      requestedLifecycleTypes?: readonly string[];
      adjacentAssignments: number;
      unsupportedAssignments: number;
    };
  }>;
  targetSkill?: { value: string; state: "Verified" | "Supported" };
};

const TABS = [
  "Overview",
  "Experience",
  "Projects",
  "Education",
  "Skills",
] as const;
type Tab = (typeof TABS)[number] & CandidateProfileTab;

const detailCache = new Map<string, SearchV2RecruiterCandidateDetail>();
const detailRequests = new Map<
  string,
  Promise<SearchV2RecruiterCandidateDetail>
>();
const detailKey = (candidateId: string, talentPool?: string) =>
  `${SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION}:${talentPool || "internal_profiles"}:${candidateId}`;

export function prefetchCandidateDetails(
  candidateId: string,
  talentPool?: string,
) {
  if (talentPool === "linkedin_talent_pool") return Promise.resolve(null);
  const key = detailKey(candidateId, talentPool);
  if (detailCache.has(key)) return Promise.resolve(detailCache.get(key)!);
  const pending = detailRequests.get(key);
  if (pending) return pending;
  const request = fetch(
    `/api/recruiter/search-v2/candidate-details/${encodeURIComponent(candidateId)}?talentPool=${talentPool || "internal_profiles"}`,
    { credentials: "same-origin", cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("Candidate details are unavailable");
      const profile =
        (await response.json()) as SearchV2RecruiterCandidateDetail;
      if (
        profile.contractVersion !== SEARCH_V2_CANDIDATE_DETAIL_RESPONSE_VERSION
      )
        throw new Error("Candidate details require a refresh");
      return profile;
    })
    .then((profile) => {
      detailCache.set(key, profile);
      return profile;
    })
    .finally(() => detailRequests.delete(key));
  detailRequests.set(key, request);
  return request;
}

const text = (value: string | null | undefined, fallback = "Not provided") =>
  value?.trim() || fallback;

type ExternalEvidenceSections = {
  overview: string[];
  experience: string[];
  projects: string[];
  education: string[];
  certifications: string[];
  skills: string[];
};

function uniqueExternalEvidence(values: Array<string | null | undefined>) {
  return [
    ...new Map(
      values
        .map((value) =>
          String(value || "")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean)
        .map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
}

function externalEvidenceSections(
  candidate: CandidateDrawerResult,
): ExternalEvidenceSections {
  const sections: ExternalEvidenceSections = {
    overview: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    skills: candidate.queryRelevantSkills || [],
  };
  for (const item of candidate.evidence || []) {
    if (/employment|experience/i.test(item.label))
      sections.experience.push(item.value);
    else if (/project/i.test(item.label)) sections.projects.push(item.value);
    else if (/certification|credential/i.test(item.label))
      sections.certifications.push(item.value);
    else if (/education|qualification|degree/i.test(item.label))
      sections.education.push(item.value);
    else if (/skill|module/i.test(item.label)) sections.skills.push(item.value);
    else if (/summary|headline|profile/i.test(item.label))
      sections.overview.push(item.value);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, values]) => [
      key,
      uniqueExternalEvidence(values),
    ]),
  ) as ExternalEvidenceSections;
}

function ExternalEvidenceList({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  return (
    <Panel title={title}>
      {values.length ? (
        <ol className="space-y-3">
          {values.map((value, index) => (
            <li
              key={`${value.toLocaleLowerCase()}:${index}`}
              className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
            >
              <p className="text-sm leading-6 text-slate-300">{value}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-400">
          No grounded {title.toLocaleLowerCase()} was found in the available
          external profile evidence.
        </p>
      )}
    </Panel>
  );
}

function ExternalEmploymentList({
  records,
  fallback,
}: {
  records: CandidateSearchV2ProfilePreview["employment"];
  fallback: string[];
}) {
  if (!records.length)
    return (
      <ExternalEvidenceList title="Employment evidence" values={fallback} />
    );
  return (
    <Panel title="Employment history">
      <ol className="space-y-4">
        {records.map((record) => (
          <li
            key={record.id}
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
          >
            <h4 className="font-semibold text-white">
              {record.title || "Role not provided"}
            </h4>
            <p className="mt-1 text-sm text-slate-300">
              {record.employer || "Employer not provided"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatCandidateProfilePeriod(
                record.start,
                record.end,
                record.current,
              )}
              {record.location ? ` · ${record.location}` : ""}
            </p>
            {record.summary ? (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {record.summary}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ProjectSummary({ values }: { values: readonly string[] }) {
  const cleaned = cleanProjectResponsibilities(values);
  if (!cleaned.length) return null;
  const initial = cleaned.slice(0, 2);
  const additional = cleaned.slice(2);
  return (
    <div className="mt-3 text-sm leading-6 text-slate-300">
      <ul className="list-disc space-y-1 pl-5">
        {initial.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
      {additional.length ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
            Show more
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {additional.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-800 py-5 last:border-b-0">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmploymentResponsibilities({
  values,
  context,
}: {
  values: string[];
  context: { title: string; employer: string; start: string; end: string };
}) {
  const cleaned = cleanEmploymentResponsibilities(values, context);
  if (!cleaned.length) return null;
  const initial = cleaned.slice(0, 3);
  const additional = cleaned.slice(3);
  return (
    <div className="mt-2 text-sm text-slate-300">
      <ul className="list-disc space-y-1 pl-5">
        {initial.map((value, index) => (
          <li key={index}>{value}</li>
        ))}
      </ul>
      {additional.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-cyan-300">
            Show more
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {additional.map((value, index) => (
              <li key={index}>{value}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-label="Loading candidate details" className="space-y-4 p-6">
      {["w-3/4", "w-full", "w-5/6", "w-full"].map((width, index) => (
        <div
          key={index}
          className={`h-16 animate-pulse rounded-lg bg-slate-800/70 ${width}`}
        />
      ))}
    </div>
  );
}

export default function CandidateDetailsDrawer({
  candidate,
  diagnostic,
  visibleCandidates,
  searchContextLabel,
  fullProfileHref,
  shortlistHref,
  onClose,
  onSelect,
  identityLookup = false,
  initialTab = "Overview",
}: {
  candidate: CandidateDrawerResult;
  diagnostic: CandidateDrawerDiagnostic;
  visibleCandidates: CandidateDrawerResult[];
  searchContextLabel: string;
  fullProfileHref: string;
  shortlistHref: string;
  onClose: () => void;
  onSelect: (candidateId: string) => void;
  identityLookup?: boolean;
  initialTab?: CandidateProfileTab;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [educationFocus, setEducationFocus] =
    useState<ProfileDetailFocus | null>(null);
  const [profile, setProfile] =
    useState<SearchV2RecruiterCandidateDetail | null>(null);
  const [error, setError] = useState("");
  const [retryRevision, setRetryRevision] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiAnalysisError, setAiAnalysisError] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiCapability, setAiCapability] =
    useState<ExternalTalentAnalysisCapability | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = visibleCandidates.findIndex(
    (item) => item.candidateId === candidate.candidateId,
  );

  useEffect(() => {
    setTab(initialTab);
    const key = detailKey(candidate.candidateId, candidate.talentPool);
    setProfile(detailCache.get(key) || null);
    setError("");
    if (candidate.talentPool === "linkedin_talent_pool") {
      return;
    }
    let active = true;
    prefetchCandidateDetails(candidate.candidateId, candidate.talentPool)
      .then((value) => {
        if (active && value) setProfile(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Candidate details are unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, [candidate.candidateId, candidate.talentPool, initialTab, retryRevision]);

  useEffect(() => {
    setAiAnalysis("");
    setAiAnalysisError("");
    if (candidate.talentPool !== "linkedin_talent_pool") {
      setAiCapability(null);
      return;
    }
    let active = true;
    fetch("/api/recruiter/search-v2/external-analysis", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI capability is unavailable.");
        return (await response.json()) as ExternalTalentAnalysisCapability;
      })
      .then((value) => {
        if (active) setAiCapability(value);
      })
      .catch(() => {
        if (active)
          setAiCapability({
            version: "external-talent-analysis-capability-v1",
            enabled: false,
            reason: "provider_not_configured",
            message: "AI Match Analysis capability could not be verified.",
            minimumEvidenceItems: 2,
            minimumEvidenceCharacters: 48,
          });
      });
    return () => {
      active = false;
    };
  }, [candidate.candidateId, candidate.talentPool]);

  useLayoutEffect(() => {
    resetCandidateDetailsScroll(contentScrollRef.current);
  }, [tab, candidate.candidateId]);

  useLayoutEffect(() => {
    if (tab !== "Education" || !educationFocus || !contentScrollRef.current)
      return;
    const container = contentScrollRef.current;
    const target = container.querySelector<HTMLElement>(
      `[data-education-section="${educationFocus}"]`,
    );
    if (!target) return;
    container.scrollTop = Math.max(0, target.offsetTop - container.offsetTop);
    target.focus({ preventScroll: true });
  }, [tab, educationFocus, candidate.candidateId, profile]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const enterprise = profile?.enterpriseProfile;
  const employment = enterprise?.employmentTimeline || [];
  const projects = enterprise?.projects || [];
  const canonicalAssignmentEvidence = diagnostic.criteria.find(
    (item) => item.assignmentEvidence,
  )?.assignmentEvidence;
  const experienceExtraction = profile?.sectionAvailability.experience;
  const projectsExtraction = profile?.sectionAvailability.projects;
  const canonicalIdentity = canonicalTalentSearchIdentity(
    candidate.candidateId,
    candidate.candidateName,
  );
  const externalSections = externalEvidenceSections(candidate);
  const externalEmployment = candidate.profilePreview?.employment || [];
  const effectiveProfileCompleteness =
    candidate.profileCompletenessPercent || 0;
  const overview = profile
    ? profile.canonicalOverview
    : candidate.talentPool === "linkedin_talent_pool"
      ? buildExternalCanonicalProfileOverview({
          candidateId: candidate.candidateId,
          candidateName: candidate.candidateName,
          profileTitle: candidate.currentTitle,
          currentEmployer: candidate.currentEmployer,
          location: candidate.location,
          country: candidate.country,
          totalExperienceYears: candidate.totalYearsExperience,
          professionalSummary: externalSections.overview.join(" ") || null,
          employmentRecords: externalEmployment,
          employmentEvidence: externalSections.experience,
          projectEvidence: externalSections.projects,
          educationEvidence: externalSections.education,
          certificationEvidence: externalSections.certifications,
          skills: externalSections.skills,
          evidenceConfidencePercent: candidate.evidenceConfidencePercent,
          profileCompletenessPercent: effectiveProfileCompleteness,
          sourceTypes: ["external_provider"],
        })
      : null;
  const canonicalSkills = overview
    ? canonicalCandidateSkillCollection(overview)
    : { items: [], groups: [], total: 0 };
  const nameAvailable =
    overview?.identity.nameAvailable ?? canonicalIdentity.nameAvailable;
  const name = nameAvailable
    ? overview?.identity.name || canonicalIdentity.displayName
    : `Candidate ${canonicalIdentity.identityToken}`;
  const roleContext = overview?.career.currentEmployment
    ? {
        label: "Current role",
        title: overview.career.currentEmployment.title,
        employer: overview.career.currentEmployment.employer,
      }
    : overview?.career.latestEmployment
      ? {
          label: "Latest known role",
          title: overview.career.latestEmployment.title,
          employer: overview.career.latestEmployment.employer,
        }
      : overview?.identity.profileTitle
        ? {
            label: "Profile title",
            title: overview.identity.profileTitle,
            employer: null,
          }
        : null;
  const profileTitle =
    overview?.identity.profileTitle || overview?.identity.headline || "";
  const separateProfileTitle =
    profileTitle &&
    profileTitle.toLocaleLowerCase() !==
      (roleContext?.title || "").toLocaleLowerCase()
      ? profileTitle
      : "";
  const groundedSkillGroups = canonicalSkills.groups.map((group) => ({
    label: group.group,
    values: group.values,
  }));
  const tabState = overview
    ? candidateProfileTabState(overview)
    : TABS.map((item) => ({
        tab: item,
        count: item === "Overview" ? null : 0,
        enabled: true,
        hasRecords: item === "Overview",
        unavailableReason:
          item === "Overview" ? null : "No information available",
      }));
  const availableTabs = tabState.map((item) => item.tab);
  const educationRecords =
    profile?.educationPresentation.educationRecords || [];
  const certificationRecords =
    profile?.educationPresentation.certificationRecords || [];
  const qualificationRecords =
    profile?.educationPresentation.qualificationRecords || [];
  const trainingRecords = profile?.educationPresentation.trainingRecords || [];
  useEffect(() => {
    if (!availableTabs.includes(tab)) setTab("Overview");
  }, [availableTabs, tab]);
  const location = text(
    enterprise?.identity.location ||
      profile?.location.value ||
      candidate.location ||
      candidate.country,
    "",
  );
  const externalAnalysisEvidence = [
    ...(candidate.evidence || []).map((item) => ({
      label: item.label,
      excerpt: item.value,
    })),
  ].filter(
    (item, index, all) =>
      item.excerpt.trim() &&
      all.findIndex(
        (candidateEvidence) =>
          candidateEvidence.excerpt.normalize("NFKC").trim().toLowerCase() ===
          item.excerpt.normalize("NFKC").trim().toLowerCase(),
      ) === index,
  );
  const externalAnalysisCharacters = externalAnalysisEvidence.reduce(
    (total, value) => total + value.excerpt.length,
    0,
  );
  const hasEnoughEvidenceForAnalysis = Boolean(
    aiCapability &&
    externalAnalysisEvidence.length >= aiCapability.minimumEvidenceItems &&
    externalAnalysisCharacters >= aiCapability.minimumEvidenceCharacters,
  );
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      data-candidate-details-drawer
    >
      <button
        type="button"
        aria-label="Close candidate details"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-slate-950/45"
        onClick={onClose}
      />
      <aside
        id="candidate-details-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Candidate details for ${name}`}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex h-[100dvh] w-full flex-col border-l border-slate-700 bg-slate-950 shadow-2xl sm:w-[min(48vw,880px)]"
      >
        <header className="shrink-0 border-b border-slate-800 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-white">
                {name}
              </h2>
              {!nameAvailable ? (
                <p className="mt-1 text-xs text-slate-400">Name not provided</p>
              ) : null}
              {roleContext?.title ? (
                <p className="mt-1 text-sm text-slate-300">
                  <span className="text-slate-500">{roleContext.label}: </span>
                  {roleContext.title}
                  {roleContext.employer ? ` · ${roleContext.employer}` : ""}
                </p>
              ) : null}
              {separateProfileTitle ? (
                <p className="mt-1 truncate text-xs text-slate-500">
                  Profile title: {separateProfileTitle}
                </p>
              ) : null}
              {location ? (
                <p className="mt-1 text-xs text-slate-500">{location}</p>
              ) : null}
              <p className="mt-1 text-xs font-medium text-cyan-300">
                {candidate.talentPool === "linkedin_talent_pool"
                  ? "External Talent Network"
                  : "Internal Profiles"}
              </p>
              {candidate.talentPool === "linkedin_talent_pool" ? (
                <p className="mt-2 text-xs text-slate-400">
                  Evidence confidence: {diagnostic.evidenceConfidence}
                  <span className="mx-1.5 text-slate-700">·</span>
                  Profile completeness: {effectiveProfileCompleteness}%
                </p>
              ) : null}
            </div>
            <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
              {candidate.linkedInProfileUrl ? (
                <a
                  href={candidate.linkedInProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-sky-700 px-3 py-2 text-sm font-semibold text-sky-200"
                >
                  {candidate.talentPool === "linkedin_talent_pool"
                    ? externalProfileActionLabel(candidate.linkedInProfileUrl)
                    : "View LinkedIn"}
                  <span className="sr-only">
                    {" "}
                    (opens external profile in a new tab)
                  </span>
                </a>
              ) : null}
              {candidate.talentPool !== "linkedin_talent_pool" ? (
                <a
                  href={shortlistHref}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
                >
                  Shortlist
                </a>
              ) : null}
              {candidate.talentPool === "linkedin_talent_pool" ? (
                <button
                  type="button"
                  disabled={
                    aiAnalysisLoading ||
                    !aiCapability?.enabled ||
                    !hasEnoughEvidenceForAnalysis
                  }
                  title={
                    !aiCapability
                      ? "Checking AI Match Analysis availability"
                      : !aiCapability.enabled
                        ? aiCapability.message
                        : !hasEnoughEvidenceForAnalysis
                          ? "Not enough grounded profile evidence is available for analysis."
                          : "Generate an evidence-grounded match analysis"
                  }
                  onClick={async () => {
                    setAiAnalysisLoading(true);
                    setAiAnalysis("");
                    setAiAnalysisError("");
                    try {
                      const response = await fetch(
                        "/api/recruiter/search-v2/external-analysis",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            candidateId: candidate.candidateId,
                            headline: candidate.currentTitle,
                            location: candidate.location,
                            employer: candidate.currentEmployer,
                            evidence: externalAnalysisEvidence,
                          }),
                        },
                      );
                      const payload = await response.json();
                      if (!response.ok)
                        throw new Error(
                          payload.error || "AI Match Analysis is unavailable.",
                        );
                      setAiAnalysis(
                        payload.analysis?.summary ||
                          "Analysis completed from available evidence.",
                      );
                    } catch (error) {
                      setAiAnalysisError(
                        error instanceof Error
                          ? error.message
                          : "AI Match Analysis is unavailable.",
                      );
                    } finally {
                      setAiAnalysisLoading(false);
                    }
                  }}
                  className="rounded-lg border border-violet-700 px-3 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-950/30 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  {aiAnalysisLoading
                    ? "Analyzing available profile evidence…"
                    : !aiCapability
                      ? "Checking AI availability…"
                      : !aiCapability.enabled
                        ? "AI Match unavailable"
                        : !hasEnoughEvidenceForAnalysis
                          ? "AI Match needs more evidence"
                          : "Generate AI Match Analysis"}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Previous visible candidate"
                disabled={selectedIndex <= 0}
                onClick={() =>
                  onSelect(visibleCandidates[selectedIndex - 1].candidateId)
                }
                className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 disabled:opacity-35"
              >
                &#8592;
              </button>
              <button
                type="button"
                aria-label="Next visible candidate"
                disabled={
                  selectedIndex < 0 ||
                  selectedIndex >= visibleCandidates.length - 1
                }
                onClick={() =>
                  onSelect(visibleCandidates[selectedIndex + 1].candidateId)
                }
                className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 disabled:opacity-35"
              >
                &#8594;
              </button>
              <button
                type="button"
                aria-label="Close candidate details"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3 py-2 text-lg text-slate-200"
              >
                &#215;
              </button>
            </div>
          </div>
          <nav
            aria-label="Candidate detail sections"
            role="tablist"
            className="mt-4 flex gap-1 overflow-x-auto"
          >
            {tabState.map(
              ({ tab: item, count, hasRecords, unavailableReason }) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  id={`candidate-detail-${item.toLowerCase()}-tab`}
                  aria-controls={`candidate-detail-${item.toLowerCase()}-panel`}
                  {...candidateProfileTabAccessibility(tab === item)}
                  aria-label={
                    hasRecords === false
                      ? `${item}, not provided in selected profile source`
                      : `${item}${count == null ? "" : `, ${count} records`}`
                  }
                  data-tab-state={
                    tab === item
                      ? "active"
                      : hasRecords === false
                        ? "available-empty"
                        : "available"
                  }
                  title={unavailableReason || undefined}
                  onPointerDown={(event) => {
                    if (event.pointerType === "mouse") event.preventDefault();
                  }}
                  onClick={(event) => {
                    setEducationFocus(null);
                    setTab(item);
                    if (event.detail > 0) event.currentTarget.blur();
                  }}
                  onKeyDown={(event) => {
                    const currentIndex = TABS.indexOf(item);
                    const targetIndex =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? TABS.length - 1
                          : event.key === "ArrowRight" ||
                              event.key === "ArrowDown"
                            ? (currentIndex + 1) % TABS.length
                            : event.key === "ArrowLeft" ||
                                event.key === "ArrowUp"
                              ? (currentIndex - 1 + TABS.length) % TABS.length
                              : -1;
                    if (targetIndex < 0) return;
                    event.preventDefault();
                    const nextTab = TABS[targetIndex];
                    setEducationFocus(null);
                    setTab(nextTab);
                    event.currentTarget.parentElement
                      ?.querySelector<HTMLButtonElement>(
                        `#candidate-detail-${nextTab.toLowerCase()}-tab`,
                      )
                      ?.focus();
                  }}
                  className={candidateProfileTabClassName(
                    tab === item,
                    hasRecords !== false,
                  )}
                >
                  {candidateProfileTabLabel(item, count, hasRecords)}
                  {tab === item ? (
                    <span
                      aria-hidden="true"
                      data-testid="candidate-detail-active-tab-indicator"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-cyan-300"
                    />
                  ) : null}
                </button>
              ),
            )}
          </nav>
        </header>
        {candidate.talentPool === "linkedin_talent_pool" && aiAnalysis ? (
          <div
            role="status"
            className="border-b border-slate-800 bg-violet-950/20 px-5 py-3 text-sm text-violet-100"
          >
            {aiAnalysis}
          </div>
        ) : null}
        {candidate.talentPool === "linkedin_talent_pool" && aiAnalysisError ? (
          <div
            role="alert"
            className="border-b border-amber-900/60 bg-amber-950/20 px-5 py-3 text-sm text-amber-200"
          >
            {aiAnalysisError}
          </div>
        ) : null}

        <div
          ref={contentScrollRef}
          id={`candidate-detail-${tab.toLowerCase()}-panel`}
          role="tabpanel"
          aria-labelledby={`candidate-detail-${tab.toLowerCase()}-tab`}
          data-testid="candidate-detail-scroll-container"
          className="min-h-0 flex-1 overflow-y-auto px-6"
        >
          {!overview && !error ? <LoadingSkeleton /> : null}
          {error ? (
            <p
              role="alert"
              className="my-6 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"
            >
              {error}
            </p>
          ) : null}
          {overview && tab === "Overview" ? (
            <>
              {identityLookup ? (
                <div className="pt-5">
                  <span className="inline-flex rounded-full border border-cyan-700/70 bg-cyan-950/40 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                    {candidate.identityMatchKind === "exact"
                      ? "Exact profile match"
                      : candidate.identityMatchKind === "fuzzy"
                        ? "Possible profile match"
                        : "Profile name match"}
                  </span>
                </div>
              ) : (
                <Panel title="Match summary">
                  <p className="line-clamp-2 text-sm text-slate-300">
                    {searchContextLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                    <p>
                      <span className="font-semibold text-slate-200">
                        {diagnostic.matchLevel}
                      </span>
                    </p>
                    <p>
                      Requirement coverage:{" "}
                      <span className="text-slate-200">
                        {diagnostic.requirementCoveragePercent == null
                          ? "Not provided"
                          : `${diagnostic.requirementCoveragePercent}%`}
                      </span>
                    </p>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-cyan-300">
                      View all criteria
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {diagnostic.requirements.map((item) => (
                        <li
                          key={item.id}
                          title={item.label}
                          aria-label={item.label}
                          className="max-w-full truncate rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
                        >
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </details>
                </Panel>
              )}
              <CanonicalProfileOverview
                overview={overview}
                onNavigate={(destination, focus) => {
                  setEducationFocus(focus || null);
                  setTab(destination);
                }}
              />
              {candidate.talentPool === "linkedin_talent_pool" ? (
                <div className="mb-5 inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                  External source · Not independently verified
                </div>
              ) : null}
            </>
          ) : null}

          {!profile &&
          candidate.talentPool === "linkedin_talent_pool" &&
          tab === "Experience" ? (
            <ExternalEmploymentList
              records={externalEmployment}
              fallback={externalSections.experience}
            />
          ) : null}

          {!profile &&
          candidate.talentPool === "linkedin_talent_pool" &&
          tab === "Projects" ? (
            <ExternalEvidenceList
              title="Project evidence"
              values={externalSections.projects}
            />
          ) : null}

          {!profile &&
          candidate.talentPool === "linkedin_talent_pool" &&
          tab === "Education" ? (
            <>
              <ExternalEvidenceList
                title="Education evidence"
                values={externalSections.education}
              />
              <ExternalEvidenceList
                title="Certification evidence"
                values={externalSections.certifications}
              />
            </>
          ) : null}

          {!profile &&
          candidate.talentPool === "linkedin_talent_pool" &&
          tab === "Skills" ? (
            <Panel title="Skills evidence">
              {externalSections.skills.length ? (
                <div className="flex flex-wrap gap-2">
                  {externalSections.skills.map((skill) => (
                    <span
                      key={skill.toLocaleLowerCase()}
                      className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No grounded skills were found in the available external
                  profile evidence.
                </p>
              )}
            </Panel>
          ) : null}

          {profile && tab === "Experience" ? (
            <Panel title="Employment history">
              {employment.length ? (
                <ol className="space-y-5">
                  {employment.map((item) => (
                    <li
                      key={item.id}
                      className="border-l border-slate-700 pl-4"
                    >
                      <h4 className="font-semibold text-white">
                        {text(item.title, "Role not provided")}
                      </h4>
                      <p className="mt-1 text-sm text-slate-300">
                        {text(item.company, "Company not provided")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCandidateProfilePeriod(
                          item.start,
                          item.end,
                          item.current,
                        )}
                        {item.duration ? ` · ${item.duration}` : ""}
                      </p>
                      {item.location ? (
                        <p className="mt-1 text-sm text-slate-400">
                          {item.location}
                        </p>
                      ) : null}
                      {item.modules.length ? (
                        <p className="mt-2 text-sm text-cyan-200">
                          SAP scope: {item.modules.join(", ")}
                        </p>
                      ) : null}
                      <EmploymentResponsibilities
                        values={item.achievements}
                        context={{
                          title: item.title,
                          employer: item.company,
                          start: item.start,
                          end: item.end,
                        }}
                      />
                      {item.linkedProjectIds?.length ? (
                        <p className="mt-2 text-xs text-cyan-300">
                          {item.linkedProjectIds.length} linked project
                          {item.linkedProjectIds.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="space-y-3 text-sm text-slate-400">
                  <p>
                    No grounded employment history was provided in the selected
                    profile source.
                    {projects.length
                      ? ` ${projects.length === 3 ? "Three" : projects.length} project assignment${projects.length === 1 ? " is" : "s are"} available separately.`
                      : ""}
                  </p>
                  {enterprise?.identity.currentTitle ? (
                    <p className="rounded-lg border border-slate-800 p-3 text-xs text-slate-500">
                      Profile title: {enterprise.identity.currentTitle}. Current
                      employment is not confirmed.
                    </p>
                  ) : null}
                  {experienceExtraction === "extraction_failed" ||
                  experienceExtraction === "extraction_pending" ? (
                    <button
                      type="button"
                      onClick={() => setRetryRevision((value) => value + 1)}
                      className="rounded border border-cyan-800 px-3 py-2 text-xs text-cyan-200"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              )}
            </Panel>
          ) : null}

          {profile && tab === "Projects" ? (
            <Panel title={`Projects (${projects.length})`}>
              {projects.length ? (
                <ol className="space-y-5">
                  {projects.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-slate-800 p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <h4 className="font-semibold text-white">
                          {text(
                            item.name,
                            "Project name not provided in source",
                          )}
                        </h4>
                      </div>
                      <dl className="mt-2 grid gap-1 text-sm text-slate-400 sm:grid-cols-2">
                        {item.client ? (
                          <div>
                            <dt className="inline text-slate-500">Client: </dt>
                            <dd className="inline">{item.client}</dd>
                          </div>
                        ) : null}
                        {item.employer ? (
                          <div>
                            <dt className="inline text-slate-500">
                              Employer:{" "}
                            </dt>
                            <dd className="inline">{item.employer}</dd>
                          </div>
                        ) : null}
                        {item.role ? (
                          <div>
                            <dt className="inline text-slate-500">Role: </dt>
                            <dd className="inline">{item.role}</dd>
                          </div>
                        ) : null}
                        {!item.employer
                          ? employment
                              .filter((entry) =>
                                entry.linkedProjectIds?.includes(item.id),
                              )
                              .slice(0, 1)
                              .map((entry) => (
                                <div key={`employer:${entry.id}`}>
                                  <dt className="inline text-slate-500">
                                    Employer:{" "}
                                  </dt>
                                  <dd className="inline">{entry.company}</dd>
                                </div>
                              ))
                          : null}
                        {item.industry ? (
                          <div>
                            <dt className="inline text-slate-500">
                              Industry:{" "}
                            </dt>
                            <dd className="inline">{item.industry}</dd>
                          </div>
                        ) : null}
                        {item.country ? (
                          <div>
                            <dt className="inline text-slate-500">
                              Location:{" "}
                            </dt>
                            <dd className="inline">{item.country}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <p className="mt-2 text-xs text-slate-500">
                        {[
                          ...new Map(
                            [item.projectType, item.implementationType]
                              .filter(Boolean)
                              .map((value) => [
                                value.trim().toLocaleLowerCase(),
                                value.trim(),
                              ]),
                          ).values(),
                          formatCandidateProfilePeriod(item.start, item.end),
                          item.duration || "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {item.modules.length ? (
                        <p className="mt-2 text-sm text-cyan-200">
                          {item.modules.join(", ")}
                        </p>
                      ) : null}
                      <ProjectSummary values={item.responsibilities} />
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="space-y-3 text-sm text-slate-400">
                  <p>
                    No grounded project history was found in the selected
                    profile source.
                  </p>
                  {projectsExtraction === "extraction_failed" ||
                  projectsExtraction === "extraction_pending" ? (
                    <button
                      type="button"
                      onClick={() => setRetryRevision((value) => value + 1)}
                      className="rounded border border-cyan-800 px-3 py-2 text-xs text-cyan-200"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              )}
            </Panel>
          ) : null}

          {profile && tab === "Education" ? (
            <Panel title="Education and qualifications">
              {!profile.educationPresentation.totalEducationRelatedRecords ? (
                <p className="text-sm text-slate-400">
                  No education, qualifications, certifications or training
                  information was provided in the selected profile source.
                </p>
              ) : null}
              <section
                data-education-section="education"
                tabIndex={-1}
                className="outline-none"
              >
                <h4 className="font-semibold text-white">
                  Formal education ({educationRecords.length})
                </h4>
                {educationRecords.length ? (
                  <ol className="mt-3 space-y-4">
                    {educationRecords.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-slate-800 p-4"
                      >
                        <p className="font-semibold text-white">
                          {text(
                            item.qualification || item.institution,
                            "Education record",
                          )}
                        </p>
                        {item.qualification && item.institution ? (
                          <p className="mt-1 text-sm text-slate-300">
                            {item.institution}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">
                          {[
                            item.fieldOfStudy,
                            item.graduationYear || item.endYear,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : profile.educationPresentation
                    .totalEducationRelatedRecords ? (
                  <p className="mt-2 text-sm text-slate-400">
                    Formal education was not provided in the selected profile
                    source.
                  </p>
                ) : null}
              </section>
              <section
                data-education-section="qualifications"
                tabIndex={-1}
                className="mt-6 border-t border-slate-800 pt-5 outline-none"
              >
                <h4 className="font-semibold text-white">
                  Qualifications ({qualificationRecords.length})
                </h4>
                {qualificationRecords.length ? (
                  <ul className="mt-3 space-y-2">
                    {qualificationRecords.map((item) => (
                      <li
                        key={item.toLocaleLowerCase()}
                        className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : educationRecords.length ||
                  certificationRecords.length ||
                  trainingRecords.length ? (
                  <p className="mt-2 text-sm text-slate-400">
                    No separate qualifications available.
                  </p>
                ) : null}
              </section>
              <section
                data-education-section="certifications"
                tabIndex={-1}
                className="mt-6 border-t border-slate-800 pt-5 outline-none"
              >
                <h4 className="font-semibold text-white">
                  Certifications ({certificationRecords.length})
                </h4>
                {certificationRecords.length ? (
                  <ul className="mt-3 space-y-2">
                    {certificationRecords.map((item) => {
                      const credential = credentialPresentation(item);
                      return (
                        <li
                          key={item.toLowerCase()}
                          className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300"
                        >
                          <p className="font-medium text-slate-200">
                            {credential.name}
                          </p>
                          {credential.provider ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Provider: {credential.provider}
                            </p>
                          ) : null}
                          {credential.dates ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {credential.dates}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : educationRecords.length ||
                  qualificationRecords.length ||
                  trainingRecords.length ? (
                  <p className="mt-2 text-sm text-slate-400">
                    No certifications available.
                  </p>
                ) : null}
              </section>
              <section
                data-education-section="training"
                tabIndex={-1}
                className="mt-6 border-t border-slate-800 pt-5 outline-none"
              >
                <h4 className="font-semibold text-white">
                  Training and courses ({trainingRecords.length})
                </h4>
                {trainingRecords.length ? (
                  <ul className="mt-3 space-y-2">
                    {trainingRecords.map((item) => {
                      const credential = credentialPresentation(item);
                      return (
                        <li
                          key={item.toLowerCase()}
                          className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300"
                        >
                          <p className="font-medium text-slate-200">
                            {credential.name}
                          </p>
                          {credential.provider ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Provider: {credential.provider}
                            </p>
                          ) : null}
                          {credential.location ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Location: {credential.location}
                            </p>
                          ) : null}
                          {credential.dates ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {credential.dates}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : educationRecords.length ||
                  qualificationRecords.length ||
                  certificationRecords.length ? (
                  <p className="mt-2 text-sm text-slate-400">
                    No training or courses available.
                  </p>
                ) : null}
              </section>
            </Panel>
          ) : null}

          {profile && tab === "Skills" ? (
            <>
              {groundedSkillGroups.length ? (
                <p className="pt-5 text-xs text-slate-500">
                  Skills listed in the candidate profile.
                </p>
              ) : null}
              {groundedSkillGroups.length ? (
                groundedSkillGroups.map((group) => (
                  <Panel key={group.label} title={group.label}>
                    <div className="flex flex-wrap gap-2">
                      {group.values.length ? (
                        group.values.map((item, index) => (
                          <span
                            key={`${item.value}-${index}`}
                            className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300"
                          >
                            {item.value}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          Not verified
                        </span>
                      )}
                    </div>
                  </Panel>
                ))
              ) : (
                <Panel title="Skills">
                  <p className="text-sm text-slate-400">
                    No grounded skills were found in the selected profile
                    source.
                  </p>
                </Panel>
              )}
            </>
          ) : null}
        </div>

        {candidate.talentPool !== "linkedin_talent_pool" ? (
          <footer className="flex shrink-0 flex-wrap gap-2 border-t border-slate-800 bg-slate-950 px-6 py-4">
            <a
              href={shortlistHref}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Shortlist
            </a>
            <a
              href={fullProfileHref}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Open full profile
            </a>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
