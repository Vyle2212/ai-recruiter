import type { RecruiterCanonicalProfileOverview as CanonicalProfileOverview } from "./searchV2CandidateDetailContract";
import { canonicalCandidateSkillCollection } from "./candidateProfileSkills";
import {
  cleanCandidateProjectResponsibilities,
  cleanCandidatePresentationText,
} from "./candidatePresentationText";

export const CANDIDATE_PROFILE_PRESENTATION_VERSION =
  "candidate-profile-presentation-v9-canonical-education-lists";

export type CandidateProfileTab =
  "Overview" | "Experience" | "Projects" | "Education" | "Skills";

export type CredentialCategory = "certification" | "training";

const PROFILE_MONTHS: Record<string, string> = {
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  sept: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
};

export function formatCandidateProfileDate(value: unknown) {
  const source = String(value || "")
    .normalize("NFKC")
    .trim();
  if (!source) return "";
  if (/^(?:present|current|now)$/i.test(source)) return "Present";
  const monthYear = source.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*((?:19|20)\d{2})\b/i,
  );
  if (monthYear) {
    const key = monthYear[1].toLocaleLowerCase().startsWith("sept")
      ? "sept"
      : monthYear[1].slice(0, 3).toLocaleLowerCase();
    return `${PROFILE_MONTHS[key] || monthYear[1].slice(0, 3)} ${monthYear[2]}`;
  }
  return source.match(/\b(?:19|20)\d{2}\b/)?.[0] || source;
}

export function formatCandidateProfilePeriod(
  start: unknown,
  end: unknown,
  current = false,
) {
  const from = formatCandidateProfileDate(start);
  const to = current ? "Present" : formatCandidateProfileDate(end);
  return from && to ? `${from} – ${to}` : from || to || "Dates not provided";
}

const tabBase =
  "relative whitespace-nowrap border-b-2 px-3 py-2 text-sm outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export function candidateProfileTabClassName(
  active: boolean,
  _hasRecords: boolean,
) {
  if (active)
    return `${tabBase} cursor-default border-cyan-300 font-semibold text-cyan-200`;
  return `${tabBase} cursor-pointer border-transparent font-medium text-slate-400 hover:text-slate-200`;
}

export function candidateProfileTabAccessibility(active: boolean) {
  return {
    "aria-selected": active,
    tabIndex: active ? 0 : -1,
  } as const;
}

export function candidateProfileMissingInformation(
  overview: CanonicalProfileOverview,
) {
  const arrangement = overview.workArrangement;
  const missing: string[] = [];
  if (!overview.career.employmentCount) missing.push("Employment");
  if (!overview.career.projectCount) missing.push("Projects");
  if (!overview.education.count) missing.push("formal education");
  if (!overview.certifications.count) missing.push("Certifications");
  if (!overview.skills.totalCount && !overview.skills.lifecycle.length)
    missing.push("Skills");
  if (!overview.languages.length) missing.push("Languages");
  if (
    ![
      arrangement.workAuthorization,
      arrangement.remote,
      arrangement.relocation,
      arrangement.travel,
      arrangement.noticePeriod,
      arrangement.availability,
    ].some(Boolean)
  )
    missing.push("work arrangement");
  return missing;
}

export function classifyCredential(value: unknown): CredentialCategory {
  const text = String(value || "")
    .normalize("NFKC")
    .trim();
  return /\b(?:certified|certification|certificate|ITIL|PRINCE2|ACCA|PMP)\b/i.test(
    text,
  )
    ? "certification"
    : "training";
}

export function splitCredentials(values: readonly string[]) {
  const recruiterLabel = (value: string) =>
    cleanCandidatePresentationText(value)
      .replace(/Financials\s*&\s*Managerial/gi, "Financials & Managerial")
      .replace(/\s+/g, " ")
      .replace(/\bSAP Data Medium Excha$/i, "SAP Data Medium Exchange");
  const unique = [
    ...new Map(
      values.map(recruiterLabel).map((value) => [value.toLowerCase(), value]),
    ).values(),
  ].filter(
    (value) =>
      Boolean(value && /[\p{L}\p{N}]/u.test(value)) &&
      !/^(?:not provided|not available|unknown|n\/?a)$/i.test(value),
  );
  return {
    certifications: unique.filter(
      (value) => classifyCredential(value) === "certification",
    ),
    training: unique.filter(
      (value) => classifyCredential(value) === "training",
    ),
  };
}

export type CandidateEducationPresentationRecord = Readonly<{
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  graduationYear: string;
}>;

export type CandidateEducationPresentation = Readonly<{
  educationRecords: readonly CandidateEducationPresentationRecord[];
  certificationRecords: readonly string[];
  qualificationRecords: readonly string[];
  trainingRecords: readonly string[];
  totalEducationRelatedRecords: number;
}>;

const meaningfulPresentationValue = (value: unknown) => {
  const cleaned = cleanCandidatePresentationText(value).trim();
  return /[\p{L}\p{N}]/u.test(cleaned) &&
    !/^(?:not provided|not available|unknown|n\/?a)$/i.test(cleaned)
    ? cleaned
    : "";
};

export function buildCandidateEducationPresentation(input: {
  educationRecords?: readonly Partial<CandidateEducationPresentationRecord>[];
  credentialRecords?: readonly string[];
  qualificationRecords?: readonly string[];
}): CandidateEducationPresentation {
  const educationRecords = [
    ...new Map(
      (input.educationRecords || [])
        .map((item, index) => {
          const record: CandidateEducationPresentationRecord = {
            id:
              meaningfulPresentationValue(item.id) || `education-${index + 1}`,
            institution: meaningfulPresentationValue(item.institution),
            qualification: meaningfulPresentationValue(item.qualification),
            fieldOfStudy: meaningfulPresentationValue(item.fieldOfStudy),
            startYear: meaningfulPresentationValue(item.startYear),
            endYear: meaningfulPresentationValue(item.endYear),
            graduationYear: meaningfulPresentationValue(item.graduationYear),
          };
          const key = [
            record.institution,
            record.qualification,
            record.fieldOfStudy,
            record.startYear,
            record.endYear,
            record.graduationYear,
          ]
            .join("|")
            .toLocaleLowerCase();
          return { record, key };
        })
        .filter(({ record, key }) =>
          Boolean(
            key.replace(/\|/g, "") &&
            (record.institution ||
              record.qualification ||
              record.fieldOfStudy ||
              record.graduationYear),
          ),
        )
        .map(({ key, record }) => [key, record] as const),
    ).values(),
  ];
  const credentials = splitCredentials(input.credentialRecords || []);
  const qualificationRecords = [
    ...new Map(
      (input.qualificationRecords || [])
        .map(meaningfulPresentationValue)
        .filter(Boolean)
        .map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
  const certificationRecords = credentials.certifications;
  const trainingRecords = credentials.training;
  return {
    educationRecords,
    certificationRecords,
    qualificationRecords,
    trainingRecords,
    totalEducationRelatedRecords:
      educationRecords.length +
      certificationRecords.length +
      qualificationRecords.length +
      trainingRecords.length,
  };
}

export type CredentialPresentation = Readonly<{
  name: string;
  provider: string | null;
  location: string | null;
  dates: string | null;
}>;

export function credentialPresentation(value: string): CredentialPresentation {
  const cleanValue = cleanCandidatePresentationText(value)
    .replace(/Financials\s*&\s*Managerial/gi, "Financials & Managerial")
    .replace(/\s+/g, " ")
    .trim();
  const dates = cleanValue.match(
    /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\s*$/,
  );
  const withoutDates = dates
    ? cleanValue.slice(0, dates.index).trim()
    : cleanValue;
  const location = withoutDates.match(/\(([^()]{2,80})\)\s*$/);
  const withoutLocation = location
    ? withoutDates.slice(0, location.index).trim()
    : withoutDates;
  const provider = withoutLocation.match(
    /\b((?:[A-Z][A-Za-z0-9&.'-]*\s+){0,6}(?:Training\s+Academy|Academy|Institute|University|College))\s*$/,
  );
  return {
    name:
      (provider
        ? withoutLocation
            .slice(0, provider.index)
            .replace(/[\s|–—-]+$/, "")
            .trim()
        : withoutLocation) || cleanValue,
    provider: provider?.[1]?.trim() || null,
    location: location?.[1]?.trim() || null,
    dates: dates ? `${dates[1]}–${dates[2]}` : null,
  };
}

export function candidateProfileTabState(overview: CanonicalProfileOverview) {
  const educationCount =
    overview.education.count +
    overview.certifications.count +
    overview.training.count;
  const skillsCount = canonicalCandidateSkillCollection(overview).total;
  const counts: Record<CandidateProfileTab, number> = {
    Overview: 1,
    Experience: overview.career.employmentCount,
    Projects: overview.career.projectCount,
    Education: educationCount,
    Skills: skillsCount,
  };
  return (Object.keys(counts) as CandidateProfileTab[]).map((tab) => ({
    tab,
    count: tab === "Overview" ? null : counts[tab],
    enabled: true,
    hasRecords: tab === "Overview" || counts[tab] > 0,
    unavailableReason:
      tab === "Overview" || counts[tab] > 0 ? null : "No information available",
  }));
}

export function candidateProfileTabLabel(
  tab: CandidateProfileTab,
  count: number | null,
  hasRecords: boolean,
) {
  if (count == null) return tab;
  return hasRecords ? `${tab} (${count})` : `${tab} \u00b7 Not provided`;
}

const actionStart =
  /^(?:Led|Managed|Configured|Implemented|Supported|Developed|Designed|Delivered|Performed|Prepared|Provided|Coordinated|Analyzed|Analysed|Reviewed|Maintained|Created|Resolved|Assisted|Handled|Monitored|Gathered|Conducted|Facilitated|Executed|Participated|Responsible)\b/i;

export function cleanEmploymentResponsibility(
  input: unknown,
  context: {
    title?: string;
    employer?: string;
    start?: string;
    end?: string;
  } = {},
) {
  let value = cleanCandidatePresentationText(input)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[•*-]\s*/, "")
    .replace(
      /^(?:Specific\s+Responsibilities|Responsibilities|Duties)\s*:?\s*/i,
      "",
    )
    .replace(
      /\b(?:Company\s+Name|Employer|Position|Role|Project\s+Description)\s*:\s*/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  value = value
    .replace(/\s+OTHER\s+SKILLS\b[\s\S]*$/i, "")
    .replace(/\bsign offs\s+Involved\b/gi, "sign-offs. Involved")
    .replace(
      /\bworking on the same\s+Assist users\b/gi,
      "working on the same. Assist users",
    )
    .trim();
  if (!value || value.length < 12) return "";
  if (/^(?:mplementation|lyst\b|ng\b|I\s+Operating\b)/i.test(value)) return "";
  if (/^[a-z]/.test(value) || /^[^A-Za-z0-9]/.test(value)) return "";
  if (
    /\b(?:Specific\s+Responsibilities|Company\s+Name|Project\s+Description)\b/i.test(
      value,
    )
  )
    return "";
  if (
    /^(?:OTHER\s+SKILLS|TECHNICAL\s+SKILLS|CORE\s+SKILLS|SKILLS|EDUCATION|CERTIFICATIONS?|TRAINING|LANGUAGES?)\b/i.test(
      value,
    )
  )
    return "";
  if (
    /^(?:summary\b|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,5}\s+has\b)/i.test(
      value,
    ) ||
    /\b(?:has\s+\d+\s+years?\s+(?:of\s+)?SAP|has successfully delivered|has extensive experience|has strong [A-Z]{2,})\b/i.test(
      value,
    )
  )
    return "";
  if (
    /\b(?:excellent communication|collaboration skills|microsoft office|visio|myob|accpac)\b/i.test(
      value,
    ) &&
    !actionStart.test(value)
  )
    return "";
  const repeated = [context.title, context.employer, context.start, context.end]
    .filter(Boolean)
    .some((field) =>
      value.toLowerCase().startsWith(String(field).trim().toLowerCase()),
    );
  if (repeated) return "";
  if (!actionStart.test(value) && !/[.!?]$/.test(value)) return "";
  return value;
}

export function cleanEmploymentResponsibilities(
  values: readonly unknown[],
  context: {
    title?: string;
    employer?: string;
    start?: string;
    end?: string;
  } = {},
) {
  return [
    ...new Map(
      values
        .map((value) => cleanEmploymentResponsibility(value, context))
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value]),
    ).values(),
  ];
}

export function cleanProjectResponsibilities(values: readonly unknown[]) {
  return cleanCandidateProjectResponsibilities(values);
}
