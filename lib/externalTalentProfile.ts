export type ExternalDatePrecision = "day" | "month" | "year" | "present";
export type ExternalEmploymentDateStatus =
  "valid" | "partial" | "undated" | "rejected";

export type ExternalEmploymentRecord = {
  id: string;
  title: string | null;
  employer: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  current: boolean;
  currentEvidence: "explicit_flag" | "present_end" | "none";
  dateStatus: ExternalEmploymentDateStatus;
  sourceOrder: number;
  provenance: {
    record: "properties.workHistory";
    titleField: string | null;
    employerField: string | null;
    startField: string | null;
    endField: string | null;
    currentField: string | null;
  };
};

export type ExternalExperienceCalculation = {
  status: "established" | "partial" | "unavailable";
  totalYears: number | null;
  totalRecords: number;
  datedRecords: number;
  undatedRecords: number;
  rejectedDateRecords: number;
};

type ParsedDate = {
  timestamp: number;
  canonical: string;
  precision: ExternalDatePrecision;
};

const clean = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized || null;
};

const equalText = (left: string | null, right: string | null) =>
  Boolean(
    left &&
    right &&
    left.localeCompare(right, undefined, { sensitivity: "base" }) === 0,
  );

const firstTextField = (
  record: Record<string, unknown>,
  fields: readonly string[],
) => {
  for (const field of fields) {
    const value = clean(record[field]);
    if (value) return { value, field };
  }
  return { value: null, field: null };
};

const explicitCompanyName = (value: unknown) => {
  if (typeof value === "string")
    return { value: clean(value), field: "company" };
  if (!value || typeof value !== "object") return { value: null, field: null };
  const company = value as Record<string, unknown>;
  const selected = firstTextField(company, [
    "name",
    "organizationName",
    "companyName",
    "legalName",
  ]);
  return {
    value: selected.value,
    field: selected.field ? "company." + selected.field : null,
  };
};

function parsedDate(
  value: string | null,
  boundary: "start" | "end",
  now: Date,
): ParsedDate | null {
  if (!value) return null;
  if (/^(?:present|current|now)$/i.test(value))
    return boundary === "end"
      ? {
          timestamp: now.getTime(),
          canonical: "Present",
          precision: "present",
        }
      : null;
  const namedMonth = value.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+((?:19|20)\d{2})$/i,
  );
  if (namedMonth) {
    const month = [
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
    ].indexOf(namedMonth[1].slice(0, 3).toLocaleLowerCase());
    const year = Number(namedMonth[2]);
    return {
      timestamp:
        boundary === "start"
          ? Date.UTC(year, month, 1)
          : Date.UTC(year, month + 1, 0, 23, 59, 59, 999),
      canonical: `${year}-${String(month + 1).padStart(2, "0")}`,
      precision: "month",
    };
  }
  let match = value.match(/^(\d{4})$/);
  if (match) {
    const year = Number(match[1]);
    const timestamp = Date.UTC(
      year,
      boundary === "start" ? 0 : 11,
      boundary === "start" ? 1 : 31,
    );
    return {
      timestamp:
        boundary === "end" && year === now.getUTCFullYear()
          ? now.getTime()
          : timestamp,
      canonical: match[1],
      precision: "year",
    };
  }
  match = value.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    const timestamp =
      boundary === "start"
        ? Date.UTC(year, month - 1, 1)
        : Date.UTC(year, month, 0, 23, 59, 59, 999);
    return {
      timestamp:
        boundary === "end" &&
        year === now.getUTCFullYear() &&
        month === now.getUTCMonth() + 1
          ? now.getTime()
          : timestamp,
      canonical: match[1] + "-" + match[2],
      precision: "month",
    };
  }
  match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const timestamp = Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    const date = new Date(timestamp);
    if (
      date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() !== Number(match[2]) - 1 ||
      date.getUTCDate() !== Number(match[3])
    )
      return null;
    return { timestamp, canonical: value, precision: "day" };
  }
  return null;
}

function explicitEmploymentDateRange(value: string | null) {
  if (!value) return null;
  const match = value.match(
    /^\s*((?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}(?:-\d{2})?)\s*(?:-|–|—|to)\s*((?:present|current|now)|(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}(?:-\d{2})?)\s*$/i,
  );
  return match ? { start: match[1], end: match[2] } : null;
}

export function normalizeExternalEmploymentRecords(
  work: unknown[],
  candidateName?: string | null,
  now = new Date(),
): ExternalEmploymentRecord[] {
  const name = clean(candidateName);
  return work.flatMap((item, sourceOrder) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const selectedTitle = firstTextField(record, ["title", "role", "jobTitle"]);
    const company = explicitCompanyName(record.company);
    const directEmployer = firstTextField(record, [
      "employerName",
      "organizationName",
      "companyName",
      "employer",
    ]);
    const selectedEmployer = company.value ? company : directEmployer;
    const title = equalText(selectedTitle.value, name)
      ? null
      : selectedTitle.value;
    const employer =
      equalText(selectedEmployer.value, name) ||
      equalText(selectedEmployer.value, title)
        ? null
        : selectedEmployer.value;
    const description = firstTextField(record, [
      "description",
      "summary",
    ]).value;
    const explicitStart = firstTextField(record, [
      "startDate",
      "start",
      "dateFrom",
    ]);
    const explicitEnd = firstTextField(record, ["endDate", "end", "dateTo"]);
    const dateRange = firstTextField(record, [
      "dateRange",
      "dates",
      "period",
      "tenure",
    ]);
    const parsedRange =
      title && employer ? explicitEmploymentDateRange(dateRange.value) : null;
    const start = explicitStart.value
      ? explicitStart
      : {
          value: parsedRange?.start || null,
          field: parsedRange ? dateRange.field : null,
        };
    const end = explicitEnd.value
      ? explicitEnd
      : {
          value: parsedRange?.end || null,
          field: parsedRange ? dateRange.field : null,
        };
    const currentFlagField = ["isCurrent", "current"].find(
      (field) => record[field] === true,
    );
    const presentEnd = /^(?:present|current|now)$/i.test(end.value || "");
    const current = Boolean(currentFlagField || presentEnd);
    const parsedStart = parsedDate(start.value, "start", now);
    const parsedEnd = parsedDate(
      current && !end.value ? "Present" : end.value,
      "end",
      now,
    );
    const future =
      Boolean(parsedStart && parsedStart.timestamp > now.getTime()) ||
      Boolean(
        parsedEnd &&
        parsedEnd.precision !== "present" &&
        parsedEnd.timestamp > now.getTime(),
      );
    const reversed = Boolean(
      parsedStart && parsedEnd && parsedEnd.timestamp < parsedStart.timestamp,
    );
    const dateStatus: ExternalEmploymentDateStatus =
      !start.value && !end.value
        ? "undated"
        : !parsedStart || !parsedEnd || future || reversed
          ? "rejected"
          : parsedStart.precision === "day" &&
              (parsedEnd.precision === "day" ||
                parsedEnd.precision === "present")
            ? "valid"
            : "partial";
    if (!title && !employer && !description && !start.value && !end.value)
      return [];
    return [
      {
        id: "external-employment-" + sourceOrder,
        title,
        employer,
        description,
        start: start.value,
        end: current ? "Present" : end.value,
        current,
        currentEvidence: currentFlagField
          ? ("explicit_flag" as const)
          : presentEnd
            ? ("present_end" as const)
            : ("none" as const),
        dateStatus,
        sourceOrder,
        provenance: {
          record: "properties.workHistory" as const,
          titleField: selectedTitle.field,
          employerField: selectedEmployer.field,
          startField: start.field,
          endField: end.field,
          currentField: currentFlagField || (presentEnd ? end.field : null),
        },
      },
    ];
  });
}

export function calculateCanonicalExternalExperience(
  records: ExternalEmploymentRecord[],
  now = new Date(),
): ExternalExperienceCalculation {
  const ranges = records.flatMap((record) => {
    if (record.dateStatus !== "valid" && record.dateStatus !== "partial")
      return [];
    const start = parsedDate(record.start, "start", now);
    const end = parsedDate(record.current ? "Present" : record.end, "end", now);
    if (
      !start ||
      !end ||
      start.timestamp > now.getTime() ||
      end.timestamp > now.getTime() ||
      end.timestamp < start.timestamp
    )
      return [];
    return [[start.timestamp, end.timestamp] as const];
  });
  const ordered = [...ranges].sort((left, right) => left[0] - right[0]);
  let totalMs = 0;
  if (ordered.length) {
    let [currentStart, currentEnd] = ordered[0];
    for (const [start, end] of ordered.slice(1)) {
      if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
      else {
        totalMs += currentEnd - currentStart;
        currentStart = start;
        currentEnd = end;
      }
    }
    totalMs += currentEnd - currentStart;
  }
  const undatedRecords = records.filter(
    (record) => record.dateStatus === "undated",
  ).length;
  const rejectedDateRecords = records.filter(
    (record) => record.dateStatus === "rejected",
  ).length;
  const partialPrecision = records.some(
    (record) => record.dateStatus === "partial",
  );
  return {
    status: !ranges.length
      ? "unavailable"
      : partialPrecision || undatedRecords > 0 || rejectedDateRecords > 0
        ? "partial"
        : "established",
    totalYears: ranges.length
      ? Math.round((totalMs / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10
      : null,
    totalRecords: records.length,
    datedRecords: ranges.length,
    undatedRecords,
    rejectedDateRecords,
  };
}

const sortableEnd = (record: ExternalEmploymentRecord, now: Date) =>
  record.current
    ? now.getTime()
    : parsedDate(record.end, "end", now)?.timestamp || Number.NEGATIVE_INFINITY;

export function sortExternalEmploymentRecords(
  records: ExternalEmploymentRecord[],
  now = new Date(),
) {
  return [...records].sort((left, right) => {
    const leftDated =
      left.dateStatus === "valid" || left.dateStatus === "partial";
    const rightDated =
      right.dateStatus === "valid" || right.dateStatus === "partial";
    if (left.current !== right.current) return left.current ? -1 : 1;
    if (leftDated !== rightDated) return leftDated ? -1 : 1;
    if (leftDated && rightDated) {
      const endDifference = sortableEnd(right, now) - sortableEnd(left, now);
      if (endDifference) return endDifference;
      const leftStart = parsedDate(left.start, "start", now)?.timestamp || 0;
      const rightStart = parsedDate(right.start, "start", now)?.timestamp || 0;
      if (rightStart !== leftStart) return rightStart - leftStart;
    }
    return left.sourceOrder - right.sourceOrder;
  });
}

export function confirmedExternalCurrentEmployment(
  records: ExternalEmploymentRecord[],
  now = new Date(),
) {
  return (
    sortExternalEmploymentRecords(
      records.filter((record) => record.current),
      now,
    )[0] || null
  );
}

export function latestDatedExternalEmployment(
  records: ExternalEmploymentRecord[],
  now = new Date(),
) {
  return (
    sortExternalEmploymentRecords(
      records.filter(
        (record) =>
          record.dateStatus === "valid" || record.dateStatus === "partial",
      ),
      now,
    )[0] || null
  );
}

export type ExternalTalentProfilePresentation = {
  profileTitle: string | null;
  professionalSummary: string | null;
  profileReportedTenure: {
    years: number;
    label: string;
    independentlyVerified: false;
  } | null;
  employmentRecords: ExternalEmploymentRecord[];
  experienceCalculation: ExternalExperienceCalculation;
  currentEmployment: ExternalEmploymentRecord | null;
  latestEmployment: ExternalEmploymentRecord | null;
  projectRecords: string[];
  educationRecords: string[];
  certificationRecords: string[];
  skillRecords: string[];
  independentlyVerifiedEmploymentRecords: number;
};

export function sanitizeExternalProfessionalSummary(
  value: unknown,
  identityValues: Array<string | null | undefined> = [],
) {
  if (typeof value !== "string") return null;
  const identityKey = (item: string) =>
    item
      .toLocaleLowerCase()
      .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "")
      .replace(/\s+/g, " ");
  const identities = new Set(
    identityValues
      .map(clean)
      .filter((item): item is string => Boolean(item))
      .map(identityKey),
  );
  const segments = value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/[|¦]{2,}|\s+[|¦]\s+/g, "\n")
    .split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((item) => item.replace(/^[\s•·▪■□\-–—:;]+|[\s|¦]+$/g, ""))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(
      (item) =>
        item.length >= 16 &&
        !identities.has(identityKey(item)) &&
        !/^(?:home|about|experience|education|skills|contact|connections?|followers?|linkedin|people also viewed|show more|see all)$/i.test(
          item,
        ),
    );
  const seen = new Set<string>();
  const unique = segments.filter((item) => {
    const key = item
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const summary = unique.slice(0, 3).join(" ").slice(0, 520).trim();
  return summary || null;
}

export function externalProfileReportedTenure(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ");
  const match = normalized.match(
    /\b(?:over\s+|more\s+than\s+)?(\d{1,2})(?:\+)?\s+years?(?:\s+(?:and\s+)?(\d{1,2})\s+months?)?\b/i,
  );
  if (!match) return null;
  const years = Number(match[1]);
  const months = Number(match[2] || 0);
  if (years < 1 || years > 70 || months > 11) return null;
  return {
    years: Math.round((years + months / 12) * 10) / 10,
    label: `${years}+ years`,
    independentlyVerified: false as const,
  };
}

export function buildExternalTalentProfilePresentation(input: {
  profileTitle?: string | null;
  experienceSummary?: string | null;
  employmentRecords?: ExternalEmploymentRecord[];
  experienceCalculation?: ExternalExperienceCalculation;
  projectText?: string[];
  education?: string[];
  certifications?: string[];
  skills?: string[];
}): ExternalTalentProfilePresentation {
  const employmentRecords = sortExternalEmploymentRecords(
    input.employmentRecords || [],
  );
  return {
    profileTitle: clean(input.profileTitle),
    professionalSummary: sanitizeExternalProfessionalSummary(
      input.experienceSummary,
      [input.profileTitle],
    ),
    profileReportedTenure: externalProfileReportedTenure(
      input.experienceSummary,
    ),
    employmentRecords,
    experienceCalculation:
      input.experienceCalculation ||
      calculateCanonicalExternalExperience(employmentRecords),
    currentEmployment: confirmedExternalCurrentEmployment(employmentRecords),
    latestEmployment: latestDatedExternalEmployment(employmentRecords),
    projectRecords: (input.projectText || [])
      .map(clean)
      .filter(Boolean) as string[],
    educationRecords: (input.education || [])
      .map(clean)
      .filter(Boolean) as string[],
    certificationRecords: (input.certifications || [])
      .map(clean)
      .filter(Boolean) as string[],
    skillRecords: (input.skills || []).map(clean).filter(Boolean) as string[],
    independentlyVerifiedEmploymentRecords: 0,
  };
}
