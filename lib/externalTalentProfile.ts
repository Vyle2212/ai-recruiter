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
    const start = firstTextField(record, ["startDate", "start", "dateFrom"]);
    const end = firstTextField(record, ["endDate", "end", "dateTo"]);
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
    professionalSummary: clean(input.experienceSummary),
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
