import { careerMonthIndex } from "./candidateCareerExperience";
import { formatEmploymentTenure } from "./employmentTenure";
import { layoutEmployment } from "./layoutEmployment";
import { flattenedEmployment } from "./flattenedEmployment";
import { boundedEmploymentBatch } from "./boundedEmploymentBatch";
import { anchoredEmployment } from "./anchoredEmployment";
import { exportedCareerEmployment } from "./exportedCareerEmployment";
import { ownedProjectCareerLedger } from "./ownedProjectCareerLedger";
import { headedChronologicalEmployment } from "./headedChronologicalEmployment";
import { headedCareerCards, reversedMonthCareerCards } from "./headedCareerCards";
import { labelledCompanySpells } from "./labelledCompanySpells";
import { boundedCareerSummary } from "./boundedCareerSummary";
import { boundedEmployerRoleCards } from "./boundedEmployerRoleCards";
import { boundedCareerTables } from "./boundedCareerTables";
import { companyDurationRoleCards, datedRoleCompanyCards } from "./boundedEmploymentFieldCards";
import type {
  EnterpriseEmployment,
  EnterpriseProject,
  EvidenceRef,
} from "./candidate360SchemaNormalize";
import { cleanEmploymentResponsibilities } from "./candidateProfilePresentation";
import type { Candidate360Profile } from "./candidate360Types";

export const CANDIDATE_EMPLOYMENT_TIMELINE_VERSION =
  "candidate-employment-v106-bounded-employer-field-tables";

export function associatedEmploymentTitle(
  employment: EnterpriseEmployment,
): string {
  return employment.title.trim();
}

export function employmentMetric(
  value: number,
  explicitlySupportedZero = false,
): string {
  if (value > 0 || explicitlySupportedZero) return String(value);
  return "Not evidenced";
}

export function employmentDeliveryMetric(
  ams: number,
  rollouts: number,
  support: { amsZero?: boolean; rolloutZero?: boolean } = {},
): string {
  return `AMS ${employmentMetric(ams, support.amsZero)} | Rollouts ${employmentMetric(rollouts, support.rolloutZero)}`;
}

export function candidateNotesWorkspace(
  profile: Candidate360Profile,
): { href: string; candidateId: string } | null {
  const candidateId = profile.workspace?.primaryCandidateId?.trim();
  const href = profile.workspace?.notesHref?.trim();
  if (!candidateId || !href) return null;
  try {
    const resolved = new URL(href, "https://candidate360.local");
    const expectedPath = `/candidates/${encodeURIComponent(candidateId)}`;
    return resolved.pathname === expectedPath &&
      resolved.hash === "#recruiter-notes"
      ? {
          href: resolved.pathname + resolved.search + resolved.hash,
          candidateId,
        }
      : null;
  } catch {
    return null;
  }
}

type SourceRecord = {
  record: Record<string, unknown>;
  sourceRef: string;
};

type CurrentRoleContext = {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
};

const clean = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim()
    : typeof value === "number"
      ? String(value)
      : "";

const value = (record: Record<string, unknown>, aliases: readonly string[]) => {
  for (const alias of aliases) {
    const candidate = clean(record[alias]);
    if (candidate) return candidate;
  }
  return "";
};

const list = (input: unknown) => {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[;|\n]/)
      : [];
  return [...new Set(values.map(clean).filter(Boolean))];
};

export type EmbeddedCvIdentityHeader = Readonly<{
  name: string;
  start: number;
  clientStart: number;
}>;

/** Detects a repeated CV identity/title header immediately before a client block. */
export function embeddedCvIdentityHeader(
  input: unknown,
): EmbeddedCvIdentityHeader | null {
  const source = clean(input);
  const pattern =
    /(?:^|[.!?]\s+)([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\-]{1,}(?:\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\-]{1,}){1,6}?)\s+((?:SAP|ERP|Senior|Project)\b(?:(?!\bClient\s*:)[\s\S]){8,500}?)(?=\s+Client\s*:)/gu;
  for (const match of source.matchAll(pattern)) {
    const header = match[2];
    if (header.split("|").length < 3) continue;
    if (
      /\b(?:professional|employment|working|project)\s+experience\b/i.test(
        match[1],
      )
    )
      continue;
    if (
      !/\b(?:consultant|solutions? leader|project manager|architect|engineer|analyst)\b/i.test(
        header,
      )
    )
      continue;
    const start = (match.index || 0) + match[0].indexOf(match[1]);
    const clientOffset = source.slice(start).search(/\bClient\s*:/i);
    if (clientOffset < 0) continue;
    return { name: match[1], start, clientStart: start + clientOffset };
  }
  return null;
}

export function stripEmbeddedCvHeaderFromProjectResponsibility(input: unknown) {
  const source = clean(input)
    .replace(/\bPage\s+\d+\s+(?:of|\/)\s*\d+\b/gi, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ");
  const header = embeddedCvIdentityHeader(source);
  if (!header) return clean(source);
  const before = clean(source.slice(0, header.start));
  const project = clean(source.slice(header.clientStart)).replace(
    /^Client\s*:\s*[^()]{2,180}?\s*\((?:[^)]*\b(?:19|20)\d{2}\b[^)]*)\)\s*/i,
    "",
  );
  return clean([before, project].filter(Boolean).join(" "));
}

function sanitizeEmploymentResponsibilities(
  values: readonly string[],
  context: {
    title?: string;
    employer?: string;
    start?: string;
    end?: string;
  } = {},
) {
  return cleanEmploymentResponsibilities(
    values
      .map((item) => {
        const source = clean(item)
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
          .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ");
        const embeddedHeader = embeddedCvIdentityHeader(source);
        return clean(
          embeddedHeader ? source.slice(0, embeddedHeader.start) : source,
        );
      })
      .filter((item) => item.length >= 12 && !/^client\s*:/i.test(item)),
    context,
  );
}

const narrativeEmployment =
  /\b(?:professional summary|profile summary|experience of over|years? of experience covering|covering various roles|career objective|skills summary|technical skills|responsibilities include|high[- ]impact outcomes?)\b/i;

export function validEmploymentTitle(input: unknown) {
  const title = clean(input)
    .replace(/^\s*(?:[•*-]|\d+[.)])\s*/, "")
    .replace(/^\s*[\u2022\uF0B7]\s*/, "")
    .replace(
      /^\s*(?:(?:currently\s+)?working\s+as|currently\s+(?:he|she|they)\s+is\s+(?:working\s+)?as|worked\s+as|as(?=\s)|designation(?=\s|:)|position(?:\s+held)?(?=\s|:)|role(?=\s|:)|job title(?=\s|:))\s*:?\s*/i,
      "",
    )
    .replace(/\s+(?:Responsibilit(?:y|ies)|Job\s+Duties)\s*:\s*[\s\S]*$/i, "")
    .replace(/\s+[-–—]\s+Freelance\s+Job\b[\s\S]*$/i, "")
    .replace(/[+()\d][\d\s()+.-]{7,}.*$/, "")
    .replace(/\s+at\s+.+$/i, "")
    .trim();
  if (!title || title.length > 120 || narrativeEmployment.test(title))
    return "";
  if (/^[^A-Za-z0-9]+/.test(title)) return "";
  if (
    /^(?:com\b|www\b|https?\b|mailto\b|e-?mail\b|phone\b|mobile\b|contact\b|or\s+position\s+held\b)/i.test(
      title,
    )
  )
    return "";
  if (
    /(?:https?:\/\/|www\.|@[a-z0-9.-]+|\.(?:com|net|org|my|sg|ph)\b)/i.test(
      title,
    )
  )
    return "";
  if (
    /\b(?:i\s+am|i'm|my\s+(?:role|experience|responsibility)|handled all|covering various|responsible for)\b/i.test(
      title,
    )
  )
    return "";
  if (
    /^(?:a\s+)?(?:passionate|dedicated|resourceful|results[- ]oriented|highly skilled|experienced professional)\b/i.test(
      title,
    )
  )
    return "";
  if (
    /^(?:work(?:ing)? experience|employment history|career history|technical skills|core skills|profile|summary|curriculum vitae|resume)\b/i.test(
      title,
    )
  )
    return "";
  if (/[.!?]$/.test(title) || title.split(/\s+/).length > 16) return "";
  return title
    .replace(/\bSAP consultant\b/gi, "SAP Consultant")
    .replace(
      /\bFICO functional support consultant\b/gi,
      "FICO Functional Support Consultant",
    )
    .replace(/\bSAP Business improvement\b/gi, "SAP Business Improvement");
}

export function validEmploymentCompany(input: unknown) {
  const source = clean(input);
  const fusedLegalSuffix =
    /(?:Malaysia|Singapore|Indonesia|Vietnam|Thailand)(?:sdn|bhd|pte|ltd)|\b(?:sdn|pte)(?:bhd|ltd)\b/i.test(
      source,
    );
  const company = source
    .replace(
      /^\s*(?:employer|company|organisation|organization)(?=\s|:)\s*:?\s*/i,
      "",
    )
    .replace(
      /([a-z])(?=(?:Malaysia|Singapore|Indonesia|Vietnam|Thailand)(?:sdn|bhd|pte|ltd))/gi,
      "$1 ",
    )
    .replace(
      /\b(Malaysia|Singapore|Indonesia|Vietnam|Thailand)(?=sdn|bhd|pte|ltd)/gi,
      "$1 ",
    )
    .replace(/\b(sdn|pte)(?=bhd|ltd\b)/gi, "$1 ")
    .replace(/\bsdn\s*bhd\b/gi, (value) =>
      fusedLegalSuffix ? "Sdn Bhd" : value,
    )
    .replace(/\bpte\s*ltd\b/gi, (value) =>
      fusedLegalSuffix ? "Pte Ltd" : value,
    )
    .replace(/\s+-\s*(?=\S)/g, " - ")
    .replace(/\s+(?:form|from)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!company || company.length > 140 || narrativeEmployment.test(company) || /^(?:worked|working|employed)\s+(?:as|at|with|for)\b/i.test(company))
    return "";
  if (
    /^(?:client|customer|project|role|position|not established|unknown|n\/?a)(?:\b|\s*:)/i.test(
      company,
    )
  )
    return "";
  if (/[!?]$/.test(company) || company.split(/\s+/).length > 18) return "";
  return company;
}

const monthNames = [
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

function monthIndex(input: string, current = false, now = new Date()) {
  return careerMonthIndex(input, current, now);
}

function supportedRange(start: string, end: string, current: boolean) {
  const from = monthIndex(start);
  const to = monthIndex(end, current);
  return from !== null && to !== null && from <= to;
}

function duration(start: string, end: string, current: boolean) {
  return formatEmploymentTenure(start, end, current);
}

const normalized = (input: unknown) =>
  clean(input)
    .toLowerCase()
    .replace(
      /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|private limited|limited|ltd\.?|inc\.?|corporation|corp\.?)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function evidence(
  sourceRef: string,
  sourceType: EvidenceRef["sourceType"],
  excerpt = "",
): EvidenceRef {
  const visibleExcerpt = clean(excerpt)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
    .split(
      /\b(?:PROJECT\s+(?:PROFILE|HISTORY|EXPERIENCE)|EDUCATION(?:,\s*TRAINING\s*&\s*CERTIFICATIONS)?|ACADEMIC QUALIFICATIONS?|CERTIFICATIONS?|TECHNICAL SKILLS?|CORE SKILLS?|LANGUAGES?|PERSONAL DETAILS|CONTACT DETAILS|REFERENCES?)\b/i,
      1,
    )[0]
    .replace(/\s+/g, " ")
    .trim();
  return {
    sourceType,
    sourceRef,
    fieldPath: sourceRef,
    label:
      sourceType === "employment"
        ? "Structured employment record"
        : sourceType === "parsed_resume"
          ? "Explicit resume employment history"
          : "Verified current-role fields",
    ...(visibleExcerpt ? { excerpt: visibleExcerpt.slice(0, 320) } : {}),
  };
}

function entry(input: {
  company?: string;
  title?: string;
  location?: string;
  companyType?: string;
  modules?: string[];
  responsibilities?: string[];
  start?: string;
  end?: string;
  current?: boolean;
  sourceRef: string;
  sourceType: EvidenceRef["sourceType"];
  excerpt?: string;
  confidence: number;
  sourceId?: string;
  allowGroundedEmployerOnly?: boolean;
}): EnterpriseEmployment | null {
  const company = validEmploymentCompany(input.company);
  const title = validEmploymentTitle(input.title);
  const start = clean(input.start);
  const end = clean(input.end);
  const current =
    input.current === true || /^(?:present|current|now)$/i.test(end);
  const hasGroundedRange = supportedRange(start, end, current);
  const groundedStructuredPartial = input.sourceType === "employment" && Boolean(company || title);
  if (!(company && title) && !groundedStructuredPartial && !(input.allowGroundedEmployerOnly && company && hasGroundedRange)) return null;
  // Preserve a single known date without inventing an open-ended employment.
  // A supplied but invalid complete range must still be excluded as a whole.
  const partialStart = !end && !current && careerMonthIndex(start) !== null;
  const partialEnd = !start && !current && careerMonthIndex(end) !== null;
  const responsibilities = sanitizeEmploymentResponsibilities(
    input.responsibilities || [],
    {
      title,
      employer: company,
      start,
      end,
    },
  );
  return {
    id:
      input.sourceId ||
      `employment-${stableHash([normalized(company), normalized(title), start.toLowerCase(), end.toLowerCase(), input.sourceRef].join("|"))}`,
    sourceEmploymentIds: [input.sourceId || input.sourceRef],
    company,
    title,
    ...(title ? { titleAssociation: "employment_record" as const } : {}),
    location: clean(input.location),
    companyType: clean(input.companyType),
    modules: [...new Set(input.modules || [])],
    achievements: responsibilities.slice(0, 5),
    responsibilities: responsibilities.slice(0, 5),
    start: hasGroundedRange || partialStart ? start : "",
    end: hasGroundedRange || partialEnd ? end : "",
    duration: hasGroundedRange ? duration(start, end, current) : "",
    current,
    evidenceState:
      input.sourceType === "candidate_field" ? "verified" : "source_extracted",
    evidenceConfidence: input.confidence,
    linkedProjectIds: [],
    provenance: [evidence(input.sourceRef, input.sourceType, input.excerpt)],
  };
}

const date =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}";

function responsibilitiesBetween(source: string, start: number, end: number) {
  const sectionBoundary =
    /\b(?:PROJECT\s+(?:PROFILE|HISTORY|EXPERIENCE)|EDUCATION(?:,\s*TRAINING\s*&\s*CERTIFICATIONS)?|ACADEMIC QUALIFICATIONS?|CERTIFICATIONS?|TECHNICAL SKILLS?|CORE SKILLS?|LANGUAGES?|PERSONAL DETAILS|CONTACT DETAILS|REFERENCES?)\b/i;
  const unbounded = source
    .slice(start, end)
    .replace(/^\s*(?:summary|responsibilities?)\s*:?\s*/i, "");
  const sectionIndex = unbounded.search(sectionBoundary);
  const clientIndex = unbounded.search(/\bClient\s*:/i);
  const headerIndex = embeddedCvIdentityHeader(unbounded)?.start ?? -1;
  const boundaries = [sectionIndex, clientIndex, headerIndex].filter(
    (index) => index >= 0,
  );
  const boundary = boundaries.length ? Math.min(...boundaries) : -1;
  const fragment = (boundary >= 0 ? unbounded.slice(0, boundary) : unbounded)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ");
  return fragment
    .split(/(?<=[.!?])\s+|[•\u2022]/)
    .map(clean)
    .filter(
      (item) =>
        item.length >= 12 && item.length <= 300 && !/^client\s*:/i.test(item),
    )
    .slice(0, 3);
}

function resumeRole(input: string) {
  const source = clean(input)
    .replace(
      /^.*\b(?:professional experience|employment history|work experience)\b\s*/i,
      "",
    )
    .trim();
  if (
    /^(?:(?:Senior|Junior|Lead|Principal|Managing|Chief)\s+)*(?:SAP\b[^.!?]{0,90}|Project Manager(?:\s*\/\s*Head of ERP)?|Head of ERP|Senior System Engineer|Account\s*&\s*Admin Officer|Business Support Analyst(?:\s*\(SAP FICO\))?|Finance Manager|Accountant)$/i.test(
      source,
    )
  )
    return validEmploymentTitle(source);
  const roles = [
    ...source.matchAll(
      /\b(?:(?:Senior|Junior|Lead|Principal|Managing|Chief)\s+)*(?:SAP\s+[A-Z0-9/&() -]{1,65}?(?:Consultant|Manager|Lead|Developer|Analyst|Engineer)|Project Manager(?:\s*\/\s*Head of ERP)?|Head of ERP|Senior System Engineer|Account\s*&\s*Admin Officer|Business Support Analyst(?:\s*\(SAP FICO\))?|Finance Manager|Accountant)\b/gi,
    ),
  ];
  return validEmploymentTitle(
    roles.at(-1)?.[0] || source.split(/\.\s+/).at(-1) || source,
  );
}

function resumeCompany(input: string) {
  return validEmploymentCompany(
    clean(input)
      .replace(
        /^.*\b(?:professional experience|employment history|working experience|work(?:\s+and|\s*&)?\s+project experience)\b\s*/i,
        "",
      )
      .split(/\.\s+/)
      .at(-1),
  );
}

// Only enter this parser through an explicit Date / Company Name / Role table.
// Flattened PDF rows keep date boundaries even when column layout is lost.
function tabularResumeEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\b(?<!PROJECT )(?:EXPERIENCE|EXPERINCE|EMPLOYMENT HISTORY|WORKING EXPERIENCE)\s*:?\s+Date\s+Company Name\s+Role\s+([\s\S]*?)(?=\b(?:RELEVANT PROJECT|PROJECT EXPERIENCE|PROJECT EXPERINCE|EDUCATION|ACADEMIC|QUALIFICATIONS|SAP EXPERIENCE|PROFESSIONAL EXPERIENCE|SELECTED PROJECT|SKILLS?|HONOURS|TRAINING)\b|$)/i)?.[1];
  if (!section) return [];
  const text = section.replace(/Page\s+\d+\s+of\s+\d+/gi, " ");
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
  const date = `(?:${month}\\s+(?:\\d{4}|\\d{2})|(?:19|20)\\d{2})`;
  const rows = [...text.matchAll(new RegExp(`\\b(${date})\\s*(?:[-–—]|to)\\s*(${date}|Till date|Present|Current|Now)\\b`, "gi"))];
  const expand = (value: string) => /^Till date$/i.test(value) ? "Present" : value.replace(/\b(\d{2})$/, (_, year: string) => `${Number(year) <= 30 ? "20" : "19"}${year}`);
  return rows.flatMap((row, index) => {
    // Consecutive date-only cells indicate column-major PDF text. Do not pair
    // the following concatenated employer cells with the last date by guesswork.
    const previous = rows[index - 1];
    if (previous && !text.slice((previous.index || 0) + previous[0].length, row.index).trim()) return [];
    const body = text.slice((row.index || 0) + row[0].length, rows[index + 1]?.index ?? text.length).trim().replace(/^\([^)]*\b(?:months?|years?)\)\s*/i, "");
    const clientAt = body.search(/\bClient\s*:/i);
    const specializedRoleAt = body.search(/\b(?:SAP\s|ABAP\s|Application Developer|S4\/HANA\s|Senior\s|Junior\s|Project Specialist|Special Projects Executive|Assistant Manager|Technical Consultant|Business & Integration Associate Manager|Managing Consultant|MM Consultant|Business Sys\\. Analyst|HRIT\b|IT Engineer|Lecturer\b|Intern\b|Part Time\b|Web Application|Transition to Support|HSSE Applications|Global SAP|Production (?:Planner|Officer|Coordination))/i);
    // Generic titles qualify only as a complete trailing role cell, not as
    // words inside an employer name or a later responsibility paragraph.
    const roleAt = specializedRoleAt >= 0 ? specializedRoleAt : body.search(/\b(?:Servicedesk (?:Lead(?:\s*\/\s*Analyst)?|Analyst)|Customer (?:Support|Service (?:Supervisor|Executive|Representative))|Admin\.? (?:Executive|Assistant)|Assistant Operations Manager|Functional Expert|System Analyst|Lead Consultant|Consultant)(?:\s*\([^)]*\))?$/i);
    const company = clientAt >= 0 ? body.slice(0, clientAt) : roleAt > 0 ? body.slice(0, roleAt) : "";
    if (!company) return [];
    // A role-column narrative is retained as evidence, never invented as a title.
    let roleText = clientAt < 0 ? body.slice(roleAt).trim().split(/\s+for\s+(?:Global\s+)?(?:Implementation|SAP Implementation|production support)\b/i)[0] : body.match(/\b((?:SAP|S4\/HANA)\s+[^.]{2,100}?(?:Consultant(?:\s+and\s+(?:Team\s+)?Lead)?|Team\s+Lead))\b/i)?.[1] || "";
    // A repeated table header paired with a pagination footer is not part
    // of the role cell. Preserve an explicitly parenthesized role prefix and
    // leave the footer/name text solely in the source excerpt.
    if (/\bP\s*a\s*g\s*e\s*\|?\s*\d+\s+Date\s+Company Name\s+Role\s*$/i.test(roleText)) {
      const bounded = roleText.match(/^((?:(?:Senior|Junior|Managing|Lead)\s+)?(?:Consultant|Analyst|Engineer|Manager|Developer)\s*\([^)]{1,50}\))\s+/i);
      roleText = bounded?.[1] || "";
    }
    const employer = company.replace(/\s*\([^)]*\bProject\)\s*$/i, "").trim();
    const parsed = entry({company: employer, title: roleText,
      start: expand(row[1]), end: expand(row[2]), current: /^(Till date|Present|Current|Now)$/i.test(row[2]),
      allowGroundedEmployerOnly: true, sourceRef: `resume.employmentTable.${index + 1}`,
      sourceType: "parsed_resume", confidence: roleText ? 96 : 90,
      excerpt: `${row[0]} ${body}`, responsibilities: [body.slice(company.length).trim()],
    });
    return parsed ? [parsed] : [];
  });
}

function organizationDesignationEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\b(?:Employment History\s+)?Organization\s+Designation\s+Duration\s+([\s\S]*?)(?=\b(?:PROJECT\s*#|PROJECT EXPERIENCE|SAP EXPERIENCE|TECHNICAL SKILLS?|TECHNICAL SKILL SET|TRAININGS?|EDUCATION|QUALIFICATIONS)\b|$)/i)?.[1];
  if (!section) return [];
  const date = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ /]+(?:19|20)\\d{2}";
  const ranges = [...section.matchAll(new RegExp(`\\(?(${date})\\)?\\s*(?:to|[-–—])\\s*\\(?(${date}|Present|Current|Now)\\)?(?=\\s|[.;]|$)`, "gi"))];
  const result: EnterpriseEmployment[] = [];
  let offset = 0;
  for (const [index, range] of ranges.entries()) {
    const prefix = section.slice(offset, range.index).trim();
    // A full stop after a completed row ends this compact table. Do not
    // continue into the subsequent project narrative.
    if (prefix.startsWith('.')) break;
    // Match the role suffix, not SAP Partner in a parenthesized employer name.
    const role = prefix.match(/\b((?:(?:APAC|Global)\s+)?SAP\s+(?!Partner\b)[^.;]{1,110}|Warehouse\s+[^.;]{1,100}|(?:Sr\.|Senior|Junior)\s+(?:Functional|ERP|Business)\s+[^;]{1,100}|(?:Customer Relationship|Client Care|Business)\s+(?:Executive|Analyst)|ERP Functional Consultant|Branch Manager|Executive\s*-\s*Accounts|Audit Assistant|Accountant|Consultant)$/i);
    const boundary = role?.index ?? -1;
    if (boundary < 1) break;
    const parsed = entry({company: prefix.slice(0, boundary), title: prefix.slice(boundary),
      start: range[1].replace('/', ' '), end: range[2].replace('/', ' '), current: /^(present|current|now)$/i.test(range[2]),
      sourceRef: `resume.organizationDesignationTable.${index + 1}`, sourceType: 'parsed_resume',
      confidence: 96, excerpt: `${prefix} ${range[0]}`});
    if (!parsed) break;
    result.push(parsed);
    offset = (range.index || 0) + range[0].length;
  }
  return result;
}

function proseEmploymentHeadings(source: string): EnterpriseEmployment[] {
  const section = source.match(/\b(?:PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY|CAREER HISTORY)\s+([\s\S]*?)(?=\b(?:EDUCATION|PROJECT EXPERIENCE|RELEVANT PROJECT|CERTIFICATIONS|TECHNICAL SKILLS)\b|$)/i)?.[1];
  if (!section) return [];
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}";
  // An explicit employer — role — dated heading, following a sentence boundary.
  // Do not treat undated narrative or project-section headings as employment.
  const pattern = new RegExp(`(?:^|[.!?]\\s+)([A-Z][A-Za-z0-9& ,.'()-]{1,100}?)\\s+[-–—]\\s+([^.;]{2,110}?)\\s+\\(?(${month})\\s*[-–—]\\s*(${month}|Present|Current)\\)?`, 'g');
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    if (!/\b(?:Consultant|Lead|Engineer|Specialist|Manager|Administrator|Staff|Director|Analyst)\b/i.test(match[2])) return [];
    const company = match[1].replace(/^.*\b[a-z]{4,}\.\s+/, "");
    if (new RegExp(month, 'i').test(company) || /\b(?:consultant|engineer|analyst|manager)\s+at\b/i.test(company) || /^(?:Senior|Junior|Lead|Principal|SAP|ERP|ABAP)\b(?:\s+[A-Za-z0-9/-]+){0,5}\s+(?:Consultant|Engineer|Analyst|Manager|Developer|Specialist)\s*$/i.test(company) || /^(?:Present|Current|Now)\b/i.test(match[2])) return [];
    const parsed = entry({company, title: match[2], start: match[3], end: match[4],
      sourceRef: `resume.proseEmploymentHeading.${index + 1}`, sourceType: 'parsed_resume',
      confidence: 94, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// Recover the first explicit heading in each employment section. Deliberately
// do not scan arbitrary responsibility sentences for employer-like words.
function compactEmploymentHeading(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\b(?:PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY|WORKING EXPERIENCE)\s*:?\s*/gi)];
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}";
  const range = `(${month})\\s*(?:to|[-–—])\\s*(${month}|Present|Current|Now)`;
  const role = "(?:SAP\\s+[A-Za-z0-9/&() -]{0,50}?|Business\\s+|Senior\\s+|Functional\\s+(?:Application\\s+)?|Technical\\s+)?(?:Consultant|Analyst|Engineer|Manager|Director|Developer|Administrator)(?:\\s*\\([^)]{1,60}\\))?";
  const company = "[A-Z][A-Za-z0-9&.,'() -]{1,100}?";
  const corporate = "(?:Sdn\\.?\\s*Bhd\\.?|Inc\\.?|Ltd\\.?|Limited|Corporation|Consulting|Lawfirm)";
  const patterns = [
    // Indonesian corporate prefix and role/date/employer pipe headings.
    { re: new RegExp(`^(${role})\\s+(PT\\.?\\s+${company})\\s+${range}(?=\\s|$)`, 'i'), fields: [2,1,3,4] },
    { re: new RegExp(`^((?:(?:Senior|Lead|Principal)\\s+)?SAP\\s+[A-Za-z0-9/&() -]{0,60}?(?:Consultant|Analyst|Engineer|Manager|Developer))\\s+${range}\\s+(${company})\\s*\\|`, 'i'), fields: [4,1,2,3] },
    { re: new RegExp(`^(${company}\\s+${corporate})\\s+(${role})\\s+\\(?${range}\\)?`, 'i'), fields: [1,2,3,4] },
    { re: new RegExp(`^(${role})\\s+(${company}\\s+${corporate})\\s+\\(?${range}\\)?`, 'i'), fields: [2,1,3,4] },
    { re: new RegExp(`^(${company})\\s*\\(${range}\\)\\s+(${role})(?=\\s|$)`, 'i'), fields: [1,4,2,3] },
    { re: new RegExp(`^${range}\\s+(${role})\\s+(${company}\\s+${corporate})(?=\\s|$)`, 'i'), fields: [4,3,1,2] },
  ];
  return headings.flatMap((heading, index) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[index + 1]?.index).split(/\b(?:PROJECT EXPERIENCE|PROJECT HISTORY|EDUCATION|PERSONAL DETAILS|TECHNICAL SKILLS)\b/i)[0];
    for (const {re, fields} of patterns) {
      const match = section.match(re);
      if (!match || /\b(?:client|customer|project|summary|expertise)\b/i.test(match[fields[0]])) continue;
      if (!supportedRange(match[fields[2]], match[fields[3]], /^(present|current|now)$/i.test(match[fields[3]]))) continue;
      const parsed = entry({company: match[fields[0]], title: match[fields[1]], start: match[fields[2]], end: match[fields[3]],
        current: /^(present|current|now)$/i.test(match[fields[3]]), sourceRef: `resume.compactEmploymentHeading.${index + 1}`,
        sourceType: 'parsed_resume', confidence: 94, excerpt: match[0]});
      if (parsed) return [parsed];
    }
    return [];
  });
}

// Labelled employment fields are bounded before assignments, so a project's
// duration cannot be borrowed as the employer's tenure.
function labelledEmployerHistory(source: string): EnterpriseEmployment[] {
  const markers = [...source.matchAll(/\b(Employer|Company(?: Name)?)\s*:\s*/gi)];
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}";
  return markers.flatMap((marker, index) => {
    const prefix = source.slice(0, marker.index);
    const lastProject = Math.max(prefix.toLowerCase().lastIndexOf('project experience'), prefix.toLowerCase().lastIndexOf('projects/assignments'));
    const lastEmployment = Math.max(prefix.toLowerCase().lastIndexOf('employment history'), prefix.toLowerCase().lastIndexOf('professional experience'), prefix.toLowerCase().lastIndexOf('working experience'));
    if (/^company/i.test(marker[1]) && (lastEmployment < 0 || lastProject > lastEmployment || /\b(?:Client|Customer)\s*:/i.test(prefix.slice(lastEmployment)))) return [];
    const block = source.slice((marker.index || 0) + marker[0].length, markers[index + 1]?.index)
      .split(/\b(?:Projects?|Client|Customer|Job Duties|Job Tasks|Responsibilities|Duties|Work Description|Scope of Work)\s*[:]/i)[0];
    const company = block.match(/^([\s\S]{2,160}?)(?=\s+(?:(?:Current )?Position(?: Title| Level)?|Designation|Job Title|Job roles|Duration|Period|Start Join date|Holding company|Industry|Co\. official website|Company Industry)\s*:)/i)?.[1];
    const title = block.match(/\b(?:(?:Current )?Position(?: Title| Level)?|Designation|Job Title|Job roles)\s*:\s*([\s\S]{2,120}?)(?=\s+(?:Duration|Period(?:\s*\([^)]*\))?|Organization|Specialization|Last Drawn Salary|Level|Industry|Date Joined)\s*:|[.;]|$)/i)?.[1];
    const range = block.match(new RegExp(`(?:\\d{1,2}\\s+)?(${month})\\s*(?:[-–—~]|to)\\s*(?:\\d{1,2}\\s+)?(${month}|Present|Current|Now)\\b`, 'i'));
    if (!company || !title || !range) return [];
    const cleanTitle = title.replace(new RegExp(`\\s+${month}[\\s\\S]*$`, 'i'), '').replace(/\s+Specific Responsibilities\b[\s\S]*$/i, '').trim();
    const narrativeRole = /^(?:Act as|Led |Overall |SME for)/i.test(cleanTitle);
    const parsed = entry({company: company.split(/\s+seconded to\s+/i)[0], title: narrativeRole ? '' : cleanTitle, allowGroundedEmployerOnly: true,
      responsibilities: narrativeRole ? [cleanTitle] : [], start: range[1], end: range[2], current: /^(present|current|now)$/i.test(range[2]),
      sourceRef: `resume.labelledEmployerHistory.${index + 1}`, sourceType: 'parsed_resume', confidence: 96, excerpt: marker[0] + block});
    return parsed ? [parsed] : [];
  });
}

function explicitHeadingVariants(source: string): EnterpriseEmployment[] {
  const date = "(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+)?(?:19|20)\\d{2}";
  const range = `(${date})\\s*(?:[-–—~]|to)\\s*(${date}|Present|Current|Now)`;
  const headings = [...source.matchAll(/\b(?:EMPLOYMENT HISTORY|WORKING EXPERIENCE|PROFESSIONAL EXPERIENCE)\s*:?\s*/gi)];
  return headings.flatMap((heading, index) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[index + 1]?.index)
      .split(/\b(?:PROJECT EXPERIENCE|PROJECT HISTORY|EDUCATION|PERSONAL DETAILS)\b/i)[0];
    const titleEnd = '(?=\\s+(?:[⮚➢•]|Duties|Responsibilities|Work Description|Projects?\\s*:|Client\\s*:|Customer\\s*:|Summary of Job)|$)';
    const dated = section.match(new RegExp(`^${range}\\s+([A-Z][A-Za-z0-9&.,() -]{1,100}?)\\s+Position(?: Title)?\\s*:\\s*(.{2,100}?)${titleEnd}`, 'i'));
    const caps = section.match(new RegExp(`^COMPANY\\s+(.{2,100}?)\\s+POSITION\\s+(.{2,100}?)\\s+DURATION\\s+${range}`, 'i'));
    const pipe = section.match(new RegExp(`^([^|]{2,100}?)\\s*\\|\\s*([^|]{2,100}?)\\s*\\|\\s*${range}`, 'i'));
    const m = dated || caps || pipe;
    if (!m) return [];
    const company = dated ? m[3] : pipe && !caps ? m[2] : m[1];
    const title = dated ? m[4] : pipe && !caps ? m[1] : m[2];
    const start = dated ? m[1] : m[3];
    const end = dated ? m[2] : m[4];
    if (/\b(?:client|customer|project|summary)\b/i.test(company)) return [];
    if (!supportedRange(start, end, /^(Present|Current|Now)$/i.test(end)) || !/\b(?:Consultant|Analyst|Manager|Lead|Architect|Administrator|Engineer|Developer|Executive|Officer|Director|Sales|Promoter)\b/i.test(title)) return [];
    const parsed = entry({company, title, start, end, current: /^(Present|Current|Now)$/i.test(end),
      sourceRef: `resume.explicitHeadingVariants.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: m[0]});
    return parsed ? [parsed] : [];
  });
}

// Explicit field order provides boundaries even when PDF extraction removes lines.
// Stop before assignments; their dates and customer names are not employment.
function orderedLabelEmployment(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\b(?:EMPLOYMENT HISTORY|WORKING EXPERIENCE|PROFESSIONAL EXPERIENCE)\s*:?\s*/gi)];
  const date = "(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}";
  const range = `(${date})\\s*(?:[-–—]|to|until)\\s*(${date}|Present|Current|Now|todate)`;
  return headings.flatMap((heading, index) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[index + 1]?.index)
      .split(/\b(?:PROJECTS\/ASSIGNMENTS|PROJECT EXPERIENCE|PROJECT HISTORY|PROJECTS|PROJECT\s*:|CLIENT|CUSTOMER|EDUCATION|QUALIFICATIONS|CERTIFICATIONS|PERSONAL DETAILS)\s*:?/i)[0];
    const yearRows = [...section.matchAll(new RegExp(`\\bYear\\s*:?\\s*${range}\\s+Organization\\s*:?\\s*(.{2,150}?)\\s+Position\\s*:?\\s*(.{2,120}?)(?=\\s+Description\\s*:?|$)`, 'gi'))];
    const position = section.match(new RegExp(`^(?:Company Name\\s*:\\s*)?(.{2,150}?)\\s+Position Title\\s*:\\s*(.{2,120}?)(?=\\s+(?:Specialization|Industry|Duration)\\s*:)`, 'i'));
    const duration = position ? section.slice(position[0].length).split(/\b(?:Work Description|Responsibilities|Duties)\b/i)[0].match(new RegExp(`\\bDuration\\s*:\\s*${range}`, 'i')) : null;
    const fields = yearRows.map(m => ({company: m[3], title: m[4], start: m[1], end: m[2], excerpt: m[0]}));
    if (position && duration) fields.push({company: position[1], title: position[2], start: duration[1], end: duration[2], excerpt: section.slice(0, section.indexOf(duration[0]) + duration[0].length)});
    return fields.flatMap((field, row) => {
      const company = field.company.replace(/\s*\(https?:\/\/[^)]*\)/gi, '').trim();
      const end = /^todate$/i.test(field.end) ? 'Present' : field.end;
      const current = /^(?:Present|Current|Now)$/i.test(end);
      if (!supportedRange(field.start, end, current)) return [];
      const parsed = entry({...field, company, end, current,
        sourceRef: `resume.orderedLabels.${index + 1}.${row + 1}`, sourceType: 'parsed_resume', confidence: 94});
      return parsed ? [parsed] : [];
    });
  });
}

// Some exported CVs flatten an explicitly labelled Date / Company / Role form
// into one line. It is bounded to employment so project rows cannot become tenure.
function dateCompanyRoleEmployment(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\b(?:EMPLOYMENT HISTORY|WORKING EXPERIENCE|PROFESSIONAL EXPERIENCE)\s*:?\s*/gi)];
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
  const date = `${month}\\s+(?:19|20)\\d{2}`;
  const range = `(${date})\\s*(?:[-–—]|to|until)\\s*(${date}|Present|Current|Now)`;
  const title = /\b(?:consultant|manager|officer|associate|intern|specialist|executive|lead|head|analyst|engineer|developer|contractor|administrator|architect|director|accountant)\b/i;
  return headings.flatMap((heading, sectionIndex) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[sectionIndex + 1]?.index)
      .split(/\b(?:PROJECTS?\s*\/\s*ASSIGNMENTS?|PROJECT EXPERIENCE|PROJECT HISTORY|EDUCATION|QUALIFICATIONS|CERTIFICATIONS|PERSONAL DETAILS)\b/i)[0];
    const rows = [...section.matchAll(new RegExp(`\\bDate\\s*:\\s*${range}\\s+Company\\s*:\\s*(.{2,140}?)\\s+Role\\s*:\\s*(.{2,120}?)(?=\\s+Date\\s*:|$)`, "gi"))];
    return rows.flatMap((row, index) => {
      const company = row[3].trim(), role = row[4].trim();
      const current = /^(?:Present|Current|Now)$/i.test(row[2]);
      if (/\b(?:client|customer|project|responsibilities|duration)\b/i.test(company) || !title.test(role) || !supportedRange(row[1], row[2], current)) return [];
      const parsed = entry({company, title: role, start: row[1], end: row[2], current,
        sourceRef: `resume.dateCompanyRole.${sectionIndex + 1}.${index + 1}`, sourceType: "parsed_resume", confidence: 96, excerpt: row[0]});
      return parsed ? [parsed] : [];
    });
  });
}

function explicitEmploymentStatements(source: string): EnterpriseEmployment[] {
  const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const date = `(?:\\d{1,2}(?:st|nd|rd|th)?[ -]+)?${month}[ .-]+(?:\\d{1,2}[ -]+)?(?:19|20)\\d{2}`;
  const end = `(?:${date}|(?:till|to)\\s+(?:date|now)|todate|Present|Current|Now)`;
  const range = `(${date})\\s*(?:[-–—]|to|until)?\\s*(${end})`;
  const cleanDate = (value: string) => {
    if (/^(?:(?:till|to)\s+(?:date|now)|todate|present|current|now)$/i.test(value)) return 'Present';
    const m = value.match(new RegExp(`(${month})[ .-]+(?:\\d{1,2}[ -]+)?((?:19|20)\\d{2})$`, 'i'));
    return m ? `${m[1]} ${m[2]}` : value;
  };
  const output: EnterpriseEmployment[] = [];
  // Explicit role + employer + dates; never extract from "for client" narratives.
  const statement = new RegExp(`\\b(?:Currently\\s+working|Working|Worked)\\s+as\\s+(?:an?\\s+)?([^.;]{2,100}?\\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant))\\s+(?:in|at|with)\\s+[“\"]([^”\"]{2,140})[”\"](?:,\\s*[^.;]{1,50}?)?\\s+from\\s+${range}(?=[.;]|$)`, 'gi');
  for (const [index, match] of [...source.matchAll(statement)].entries()) {
    const start = cleanDate(match[3]); const finish = cleanDate(match[4]);
    if (!supportedRange(start, finish, finish === 'Present')) continue;
    const parsed = entry({company: match[2], title: match[1].replace(/^an?\s+/i, ""), start, end: finish, current: finish === 'Present',
      sourceRef: `resume.quotedEmployment.${index + 1}`, sourceType: 'parsed_resume', excerpt: match[0], confidence: 94});
    if (parsed) output.push(parsed);
  }
  // Employer duration must precede Client / Project, not be borrowed from it.
  const labelled = new RegExp(`\\bEmployer\\s*:?\\s+(.{2,140}?)\\s+(?:Date of Employment|Duration)\\s*:?\\s*${range}(?=\\s+(?:Position|Client|Project|Role)\\b|[.;]|$)`, 'gi');
  for (const [index, match] of [...source.matchAll(labelled)].entries()) {
    if (/\b(?:Client|Customer|Project|Duration|Date of Employment|Position|Role|Responsibilities)\b/i.test(match[1])) continue;
    const start = cleanDate(match[2]); const finish = cleanDate(match[3]);
    if (!supportedRange(start, finish, finish === 'Present')) continue;
    const tail = source.slice((match.index || 0) + match[0].length).split(/\b(?:Client|Project|Presale|Responsibility|Responsibilities|Employer)\b/i)[0];
    const title = tail.match(/^\s*Position\s*:?\s+(.{2,120}?)(?=\s+Description\b|[.;]|$)/i)?.[1] || '';
    const parsed = entry({company: match[1], title, start, end: finish, current: finish === 'Present', allowGroundedEmployerOnly: true,
      sourceRef: `resume.explicitEmployerDuration.${index + 1}`, sourceType: 'parsed_resume', excerpt: match[0], confidence: 94});
    if (parsed) output.push(parsed);
  }
  return output;
}

function spacedDateEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Education|Project Experience|Project History|Certifications|Technical Skills)\b|$)/i)?.[1];
  if (!section) return [];
  // Repair only known date words, locally inside employment. Never join arbitrary
  // spaced words or identifiers in the source document.
  let repaired = section;
  for (const word of ['January','February','March','April','May','June','July','August','September','October','November','December','Present','Current']) {
    repaired = repaired.replace(new RegExp(`\\b${[...word].join('\\s+')}\\b`, 'gi'), word);
  }
  repaired = repaired.replace(/\b([12])\s*([09])\s*(\d)\s*(\d)\b/g, '$1$2$3$4');
  const month = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  const date = `${month}\\s+(?:19|20)\\d{2}`;
  const role = '(?:(?:Sr\\.?|Senior|Junior)\\s+)?(?:SAP\\s+[^.!?;]{1,65}?(?:Consultant|Analyst|Engineer|Lead)|Inside Sales Representative|Sales Development Associate|Sales Executive|Telesales Representative|Freelancer(?:\\s*\\([^)]{1,40}\\))?)';
  const pattern = new RegExp(`\\b(${role})\\s+at\\s+([^;!?]{2,150}?)\\s+(${date})\\s*[-–—]\\s*(${date}|Present|Current)(?=\\s|$)`, 'gi');
  return [...repaired.matchAll(pattern)].flatMap((match, index) => {
    if (/\b(?:client|customer|project|responsibilities)\b/i.test(match[2])) return [];
    const current = /^(Present|Current)$/i.test(match[4]);
    if (!supportedRange(match[3], match[4], current)) return [];
    // Only recognize the explicit trailing city cell used by these layouts.
    const location = match[2].match(/,\s*(Kuala Lumpur|Petaling Jaya|Singapore|Jakarta|Bangkok|Ho Chi Minh City)$/i);
    const company = location ? match[2].slice(0, location.index).trim() : match[2];
    const parsed = entry({company, location: location?.[1], title: match[1], start: match[3], end: match[4], current,
      sourceRef: `resume.spacedDateEmployment.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// Numbered employment forms bind the date and employer to an explicit title
// label. Responsibility prose and project tables cannot supply missing cells.
function numberedPositionEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Education|Qualifications|References|Personal Details)\b|$)/i)?.[1];
  if (!section) return [];
  const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}\\s+${month})`;
  const range = `(${date})\\s*[-–—]\\s*(${date}|Present|Current|Now)\\b`;
  const label = '\\s+Position Title\\s*\\(Level\\)\\s*:\\s*(.{2,120}?)(?=\\s+(?:Role|Specialization|Industry|Work Description)\\s*:)';
  const patterns = [
    { re: new RegExp(`\\b\\d{1,2}\\.\\s+([^:;!?]{2,150}?)\\s+${range}${label}`, 'gi'), fields: [1, 4, 2, 3] },
    { re: new RegExp(`\\b${range}\\s+\\d{1,2}\\.\\s+([^:;!?]{2,150}?)${label}`, 'gi'), fields: [3, 4, 1, 2] },
  ];
  const normalizeDate = (value: string) => value.replace(new RegExp(`^((?:19|20)\\d{2})\\s+(${month})$`, 'i'), '$2 $1');
  return patterns.flatMap(({re, fields}, variant) => [...section.matchAll(re)].flatMap((match, index) => {
    const company = match[fields[0]];
    if (/\b(?:client|customer|project|responsibilities|duration)\b/i.test(company) || new RegExp(date, 'i').test(company)) return [];
    const start = normalizeDate(match[fields[2]]), end = normalizeDate(match[fields[3]]);
    const current = /^(Present|Current|Now)$/i.test(end);
    if (!supportedRange(start, end, current)) return [];
    const parsed = entry({company, title: match[fields[1]], start, end, current,
      sourceRef: `resume.numberedPosition.${variant + 1}.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: match[0]});
    return parsed ? [parsed] : [];
  }));
}

function numberedPositionPeriodEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Education|Qualifications|References|Personal Details|Project Experience|Project History)\b|$)/i)?.[1];
  if (!section) return [];
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
  const date = `${month}\\s*(?:19|20)\\d{2}`;
  const range = `(${date})\\s*(?:[-–—]|to|until)\\s*(${date}|Present|Current|Now)`;
  const pattern = new RegExp(`\\b\\d{1,2}\\.\\s+([^:;!?]{2,150}?)\\s+Position Title\\s*:\\s*(.{2,120}?)(?=\\s+(?:Specialization|Working Period)\\s*:)(?:\\s+Specialization\\s*:\\s*(?:(?!\\bWorking Period\\s*:).){0,180})?\\s+Working Period\\s*:\\s*${range}`, "gi");
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    const company = match[1].trim(), title = match[2].trim();
    const start = match[3].replace(/([A-Za-z])(?=\d{4}$)/, "$1 ");
    const end = match[4].replace(/([A-Za-z])(?=\d{4}$)/, "$1 ");
    const current = /^(?:Present|Current|Now)$/i.test(end);
    if (/\b(?:client|customer|project|responsibilities|duration)\b/i.test(company) || !supportedRange(start, end, current)) return [];
    const parsed = entry({company, title, start, end, current,
      sourceRef: `resume.numberedPositionPeriod.${index + 1}`, sourceType: "parsed_resume", confidence: 96, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// A section heading supplies the employer's left boundary when flattened
// responsibility prose makes later unlabelled employer boundaries ambiguous.
function headingDurationPositionEmployment(source: string): EnterpriseEmployment[] {
  const start = source.search(/\b(?:Working Experience|Employment History)\b/i);
  if (start < 0 || /\b(?:Project History|Project Experience)\b/i.test(source.slice(0, start))) return [];
  const bounded = source.slice(start).split(/\b(?:Project History|Project Experience|Education|Technical Skills|Qualifications|References)\b/i)[0];
  const monthYear = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`\\b(?:Working Experience|Employment History)\\s*:?\\s*([^:;!?]{2,140}?)\\s+Duration\\s*:\\s*(${monthYear})\\s*[-–—]\\s*(${monthYear}|Present|Current|Now)\\s+Position\\s*:\\s*([^:;!?]{2,120}?)\\s+Salary\\s*:`, 'gi');
  return [...bounded.matchAll(pattern)].flatMap((match, index) => {
    const company = match[1].trim();
    const current = /^(?:Present|Current|Now)$/i.test(match[3]);
    if (/\b(?:client|customer|project|responsibilities|duration|position)\b/i.test(company) || !supportedRange(match[2], match[3], current)) return [];
    const parsed = entry({company, title: match[4], start: match[2], end: match[3], current,
      sourceRef: `resume.headingDurationPosition.${index + 1}`, sourceType: 'parsed_resume', confidence: 96,
      excerpt: match[0].replace(/\s+Salary\s*:$/i, '')});
    return parsed ? [parsed] : [];
  });
}

function datedEmploymentLedger(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\bEMPLOYMENT HISTORY\s*:?\s*/gi)];
  const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const date = `(?:\\d{1,2}\\s+)?${month}\\s+(?:(?:19|20)\\d{2}|\\d{2})`;
  const pattern = new RegExp(`\\b(${date})\\s*(?:[-–—]|to(?:\\s+date(?=\\s+\\d))?)\\s*(${date}|Present|Current|Now)\\b`, 'gi');
  const expand = (value: string) => value.replace(/\b(\d{2})$/, (_, year: string) => `${Number(year) <= 30 ? '20' : '19'}${year}`);
  return headings.flatMap((heading, sectionIndex) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[sectionIndex + 1]?.index)
      .split(/\b(?:QUALIFICATIONS|EDUCATION|PROJECT EXPERIENCE|PROJECT HISTORY|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|TECHNICAL SKILLS|REFERENCES)\b/i)[0]
      .replace(/Page\s+\d+\s+of\s+\d+/gi, ' ');
    // This is a chronological ledger, not a search across responsibility prose.
    if (!new RegExp(`^[\\s•▪●-]*${date}\\s*(?:[-–—]|to)`, 'i').test(section)) return [];
    const rows = [...section.matchAll(pattern)];
    return rows.flatMap((row, index) => {
      const body = section.slice((row.index || 0) + row[0].length, rows[index + 1]?.index)
        .replace(/[\s•▪●]+$/g, '').trim();
      const pipe = body.match(/^\|\s*([^|]{2,150}?)\s*\|\s*([^|]{2,120})$/);
      const contract = body.match(/^(.{2,220}?)\s+[-–—]\s+((?:Senior|Junior|Lead|SAP|FICO|FI|Data|Project|Application|Conversion|Solution|Independent|Subject Matter|Assistant|Accounts|Finance|Business|Technical|Functional|Software|System)\b.{1,110}?)\s*\((?:Contract|Permanent)\)$/i);
      const parsedFields = pipe || contract;
      if (!parsedFields || /\b(?:Client|Customer|Project Duration|Responsibilities)\b/i.test(parsedFields[1])) return [];
      const start = expand(row[1]); const end = expand(row[2]); const current = /^(Present|Current|Now)$/i.test(end);
      if (!supportedRange(start, end, current)) return [];
      const parsed = entry({company: parsedFields[1], title: parsedFields[2], start, end, current,
        sourceRef: `resume.datedEmploymentLedger.${sectionIndex + 1}.${index + 1}`, sourceType: 'parsed_resume', confidence: 96, excerpt: row[0] + ' ' + body});
      return parsed ? [parsed] : [];
    });
  });
}

// Some employment histories repeat Role -> legal employer -> Period rows.
// Requiring the legal suffix and explicit Period label prevents responsibility
// prose or later project organizations from being promoted to employment.
function roleCompanyPeriodEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Project Experience|Project History|Education|Technical Skills|Certifications|Qualifications|References)\b|$)/i)?.[1];
  if (!section) return [];
  const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const dated = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?${month}\\s+(?:19|20)\\d{2}`;
  const role = '(?:(?:Senior|Junior|Lead|Principal)\\s+)?(?:[A-Za-z][A-Za-z/&()+-]*\\s+){0,4}(?:Engineer|Specialist|Executive|Consultant|Manager|Analyst|Developer|Administrator|Officer)';
  const pattern = new RegExp(`\\b(${role})\\s+([A-Z][A-Za-z0-9&.,'() -]{1,120}?\\b(?:Pte\\s+(?:Ltd|Limited)|Sdn\\s+Bhd|Ltd|Limited|Inc))\\s+Period\\s*:\\s*(${dated})\\s*[-–—]\\s*(${dated}|Present|Current|Now)(?![A-Za-z0-9_])`, 'gi');
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    const current = /^(?:Present|Current|Now)$/i.test(match[4]);
    if (!supportedRange(match[3], match[4], current)) return [];
    const parsed = entry({company: match[2], title: match[1], start: match[3], end: match[4], current,
      sourceRef: `resume.roleCompanyPeriod.${index + 1}`, sourceType: 'parsed_resume', confidence: 96, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// A pipe between a role and company is an explicit ownership boundary in
// flattened CV exports. Keep this narrowly scoped to an employment heading:
// project/client sections often contain the same date vocabulary but do not
// use this role | employer record shape.
function pipedRoleEmployerPeriodEmployment(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\b(?:Professional Work Experience|Professional Experience|Employment History|Working Experiences?|Work Experience)\s*:?[\s]*/gi)];
  const monthYear = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`\\|\\s*([A-Z][A-Za-z0-9&.,'() -]{2,140}?)\\s+(${monthYear})\\s*[-–—]\\s*(${monthYear}|Present|Current|Now)(?![A-Za-z0-9_])`, 'gi');
  const role = /\b(?:consultant|analyst|manager|executive|specialist|advisor|trainee|engineer|developer|architect|officer|associate|director)\b/i;
  const location = /\b(?:city|province|state)\s*,\s*[A-Z]{2}\b|\((?:remote|full[ -]?time|onsite|hybrid)\)/i;
  const ownedTitle = (prefix: string) => {
    const value = prefix.slice(-150).trimEnd();
    const tokens = [...value.matchAll(/[A-Za-z][A-Za-z0-9/+&-]*/g)];
    if (!tokens.length || tokens[tokens.length - 1].index! + tokens[tokens.length - 1][0].length !== value.length) return '';
    let start = value.length;
    let count = 0;
    for (let i = tokens.length - 1; i >= 0 && count < 11; i--) {
      const token = tokens[i];
      const separator = value.slice(token.index! + token[0].length, start);
      if (!/^[A-Z]/.test(token[0]) || !(/^[\s,&/–—-]*$/.test(separator) || (token[0].length <= 3 && /^\.[\s,&/–—-]*$/.test(separator)))) break;
      start = token.index!;
      count++;
    }
    let title = value.slice(start).replace(/^(?:(?:professional|working|work)\s+experience|employment\s+history)\s+/i, '').trim();
    // A final organization in a list can touch the next role after export
    // flattening: "... and Brand Associate, Marketing | Employer ...".
    // Remove that organization only when the next token is itself a role.
    if (/\band\s+$/i.test(value.slice(0, start)) && /^[A-Z][A-Za-z]+\s+(?:Associate|Consultant|Analyst|Manager|Executive|Specialist|Advisor|Engineer|Developer)\b/.test(title))
      title = title.replace(/^[A-Z][A-Za-z]+\s+/, '');
    return role.test(title) && title.split(/\s+/).length <= 11 ? title : '';
  };
  return headings.flatMap((heading, sectionIndex) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[sectionIndex + 1]?.index)
      .split(/\b(?:Project Experience|Project History|Projects? Involved|Education|Technical Skills|Certifications|Qualifications|References)\b/i)[0];
    const dateRange = new RegExp(`${monthYear}\\s*[-–—]\\s*(?:${monthYear}|Present|Current|Now)`, 'i');
    let acceptedEnd = 0;
    return [...section.matchAll(pattern)].flatMap((match, index) => {
      const gapAfterAcceptedRow = section.slice(acceptedEnd, match.index || 0);
      const title = ownedTitle(gapAfterAcceptedRow);
      const company = match[1].trim();
      const current = /^(?:Present|Current|Now)$/i.test(match[3]);
      // The pipe must separate a role from its employer. A date before that
      // role belongs to a date-first row; a role or location after the pipe
      // indicates the opposite column order or an employer/location pair.
      if (
        !title ||
        dateRange.test(gapAfterAcceptedRow) ||
        role.test(company) ||
        location.test(company) ||
        /\b(?:client|customer|project|responsibilities|duties)\b/i.test(company) ||
        !supportedRange(match[2], match[3], current)
      ) return [];
      const parsed = entry({company, title, start: match[2], end: current ? 'Present' : match[3], current,
        sourceRef: `resume.pipedRoleEmployerPeriod.${sectionIndex + 1}.${index + 1}`,
        sourceType: 'parsed_resume', confidence: 96, excerpt: title + ' ' + match[0]});
      if (!parsed) return [];
      acceptedEnd = (match.index || 0) + match[0].length;
      return [parsed];
    });
  });
}

// Explicit tenure followed by an Employer label and legal name. A following
// company description can contain an unlabelled role, so do not guess its title.
function durationEmployerHistory(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Project Experience|Project History|Projects?|Education|Technical Skills|Certifications|Qualifications|References)\b|$)/i)?.[1];
  if (!section) return [];
  const monthYear = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`\\bDuration\\s*:\\s*(${monthYear})\\s*[-–—]\\s*(${monthYear}|Present|Current|Now)\\s+Employer\\s*:\\s*([A-Z][A-Za-z0-9&.,'() -]{1,120}?\\b(?:Sdn\\.?\\s+Bhd\\.?|Pte\\.?\\s+Ltd\\.?|Limited|Ltd\\.?|Inc\\.?))(?=\\s+[-–—]\\s+)`, 'gi');
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    const company = match[3].trim();
    const current = /^(?:Present|Current|Now)$/i.test(match[2]);
    if (/\b(?:client|customer|project|responsibilities|duration|employer)\b/i.test(company) || !supportedRange(match[1], match[2], current)) return [];
    const parsed = entry({company, title: '', start: match[1], end: match[2], current,
      allowGroundedEmployerOnly: true, sourceRef: `resume.durationEmployerHistory.${index + 1}`,
      sourceType: 'parsed_resume', confidence: 92, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// A bounded employment history can list Employer (city), country from/to rows
// without a role. Preserve the explicit employer tenure while keeping the
// location separate and stopping before project organizations.
function locatedEmployerHistory(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Project Experience|Project History|Projects?|Education|Technical Skills|Certifications|Qualifications|References)\b|$)/i)?.[1];
  if (!section) return [];
  const monthYear = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`(?:^|[.;])\\s*([A-Z][^.;]{1,120}?)\\s*\\(([^();]{1,60})\\)\\s*((?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|(?:[A-Z]{2,8}\\s+)?Ltd\\.?)?)\\s*,\\s*([A-Z][A-Za-z .]{1,40})\\s+from\\s+(${monthYear})\\s+to\\s+(${monthYear}|Present|Current|Now|(?:To|Till)\\s+date)(?![A-Za-z0-9_])`, 'gi');
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    const company = `${match[1]} ${match[3]}`.trim();
    const end = match[6].replace(/^(?:To|Till)\s+date$/i, 'Present');
    const current = /^(?:Present|Current|Now)$/i.test(end);
    if (/\b(?:client|customer|project|responsibilities|role)\s*:/i.test(company) || !supportedRange(match[5], end, current)) return [];
    const parsed = entry({company, title: '', location: `${match[2]}, ${match[4]}`, start: match[5], end, current,
      allowGroundedEmployerOnly: true, sourceRef: `resume.locatedEmployerHistory.${index + 1}`,
      sourceType: 'parsed_resume', confidence: 92, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// Explicit Organization / Duration / Designation blocks bind an employer and
// employment role. Project organizations outside this bounded section remain
// assignment evidence only.
function organizationDurationDesignationEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\b(?:Professional Experience|Employment History|Working Experience)\s*:?\s*([\s\S]*?)(?=\b(?:Project Experience|Project History|Education|Technical Skills|Certifications|Qualifications|References)\b|$)/i)?.[1];
  if (!section) return [];
  const monthYear = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`\\bOrganization\\s*\\d*\\s*:\\s*([\\s\\S]{2,160}?)\\s+Duration\\s*:\\s*(?:From\\s+)?(${monthYear})\\s*(?:[-–—]|to|until)\\s*(${monthYear}|Present|Current|To\\s+date)\\s+Designation\\s*:\\s*([\\s\\S]{2,140}?)(?=\\s+(?:Responsibilities?|Organization\\s*\\d*\\s*:)|\\s*$)`, 'gi');
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    const company = match[1].trim();
    const end = match[3].replace(/^To\s+date$/i, 'Present');
    const current = /^(?:Present|Current)$/i.test(end);
    if (/\b(?:client|customer|project|responsibilities|duration|designation)\s*:/i.test(company) || !supportedRange(match[2], end, current)) return [];
    const parsed = entry({company, title: match[4], start: match[2], end, current,
      sourceRef: `resume.organizationDurationDesignation.${index + 1}`, sourceType: 'parsed_resume', confidence: 96, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

// Employer/period tables explicitly identify the employer but not the role.
// Keep that absence visible instead of borrowing titles from later projects.
function organizationPeriodEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(/\b(?:Professional Experience|Employment History|Working Experience)\s*:?\s*Organization\s+Period\s+([\s\S]*?)(?=\b(?:Project Experience|Project History|Education|Technical Skills|Certifications)\b|$)/i)?.[1];
  if (!section) return [];
  const date = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}';
  const ranges = [...section.matchAll(new RegExp(`(${date})\\s*(?:to|[-–—])\\s*(${date}|Present|Current|Now)\\b`, 'gi'))];
  const result: EnterpriseEmployment[] = [];
  let offset = 0;
  for (const [index, range] of ranges.entries()) {
    const company = section.slice(offset, range.index).trim();
    if (!company || /\b(?:client|customer|project|responsibilities|consultant|manager|engineer)\b/i.test(company)) break;
    const current = /^(Present|Current|Now)$/i.test(range[2]);
    if (!supportedRange(range[1], range[2], current)) break;
    const parsed = entry({company, title: '', start: range[1], end: range[2], current,
      allowGroundedEmployerOnly: true, sourceRef: `resume.organizationPeriod.${index + 1}`,
      sourceType: 'parsed_resume', confidence: 90, excerpt: `${company} ${range[0]}`});
    if (!parsed) break;
    result.push(parsed);
    offset = (range.index || 0) + range[0].length;
  }
  return result;
}

// A bounded Career Summary can contain explicit dated role-at-employer
// statements. Qualifiers describe the role, not part of the employer name.
function datedCareerSummary(source: string): EnterpriseEmployment[] {
  const section = source.match(/\bCareer Summary\s*:?\s*([\s\S]*?)(?=\b(?:Professional Experience|Project Experience|Education|Technical Skills)\b|$)/i)?.[1];
  if (!section) return [];
  const date = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`\\bFrom\\s+(${date})\\s*(?:to|[-–—])\\s*(${date}|Now|Present|Current)\\s*:\\s*([^:;.!?]{2,100}?)\\s+at\\s+([^:;!?]{2,180}?)(?=\\s+(?:in\\s+[A-Z/ -]+\\s+role|as\\s+[^.;]{1,60}?consultant)\\b|\\.\\s+From\\b|\\.$|$)`, 'gi');
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    if (!/\b(?:consultant|analyst|engineer|manager|developer|lead)\b/i.test(match[3])) return [];
    const company = match[4].replace(/\s+company$/i, '').trim();
    if (/\b(?:client|customer|project|responsibilities|From)\b/i.test(company) || new RegExp(date, 'i').test(company)) return [];
    const current = /^(Now|Present|Current)$/i.test(match[2]);
    if (!supportedRange(match[1], match[2], current)) return [];
    const parsed = entry({company, title: match[3], start: match[1], end: match[2], current,
      sourceRef: `resume.datedCareerSummary.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

function numberedWorkExperience(source: string): EnterpriseEmployment[] {
  const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const date = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?${month}[ -]+(?:19|20)\\d{2}`;
  const role = '(?:Data Migration (?:Consultant|Specialist)|Senior Consultant|Associate Consultant|EIM Package Specialist|Application Developer Software Engineer)';
  const pattern = new RegExp(`\\bWork Experience\\s*[-–—]\\s*\\d+\\s+(.{2,160}?)[,.]\\s+(${role})\\s+from\\s+(${date})\\s+(?:till|to|until)\\s+(${date}|Present|Current|Now)(?=\\.|\\s+Project\\b|$)`, 'gi');
  return [...source.matchAll(pattern)].flatMap((match, index) => {
    if (/\b(?:client|customer|project|responsibilities)\b/i.test(match[1])) return [];
    const company = match[1].replace(/\s+Bangalore,\s*India$/i, '');
    const normalizeDate = (value: string) => value.replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/-/g, ' ');
    const start = normalizeDate(match[3]), end = normalizeDate(match[4]);
    const current = /^(Present|Current|Now)$/i.test(end);
    if (!supportedRange(start, end, current)) return [];
    const parsed = entry({company, title: match[2], start, end, current,
      sourceRef: `resume.numberedWorkExperience.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: match[0]});
    return parsed ? [parsed] : [];
  });
}

function locatedRoleEmployment(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\b(?:Employment History|Professional Experience)\s*:?\s*/gi)];
  const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const date = `${month}[. ]+(?:19|20)\\d{2}`;
  const company = "[A-Z][A-Za-z0-9&.,'() -]{1,100}?\\s+(?:Ltd\\.?|Limited|Inc\\.?|Corporation|Sdn\\.?\\s*Bhd\\.?)";
  const pattern = new RegExp(`^(${company})\\s+([A-Za-z][A-Za-z ,&-]{1,75}?)\\s+(${date})\\s*[-–—]\\s*(${date}|Present|Current|Now)\\s+Role\\s*:\\s*(.{2,110}?)(?=\\s+(?:Project|Responsibilities|Duties)\\s*:|$)`, 'i');
  return headings.flatMap((heading, index) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[index + 1]?.index).split(/\b(?:Project Experience|Project History|Education|Personal Details)\b/i)[0];
    const m = section.match(pattern);
    if (!m || /\b(?:Client|Customer|Project|Responsibilities|Consultant)\b/i.test(m[1] + ' ' + m[2])) return [];
    const start = m[3].replace(/\.+/g, ' '), end = m[4].replace(/\.+/g, ' ');
    const current = /^(Present|Current|Now)$/i.test(end);
    if (!supportedRange(start, end, current)) return [];
    const parsed = entry({company: m[1], location: m[2], title: m[5], start, end, current,
      sourceRef: `resume.locatedRole.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: m[0]});
    return parsed ? [parsed] : [];
  });
}

// Parenthesized former names remain employer metadata, not role text.
function formerNameEmployment(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\bEmployment History\s*:?\s*/gi)];
  const date = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(?:19|20)\\d{2}';
  const pattern = new RegExp(`^(${date})\\s*[-–—]\\s*(${date}|Present|Current|Now)\\s+(.{2,150}?\\s*\\((?:fka|formerly(?: known as)?)\\s+[^)]{2,120}\\))\\s+(.{2,120}?)\\s+Work Description\\s*:`, 'i');
  return headings.flatMap((heading, index) => {
    const section = source.slice((heading.index || 0) + heading[0].length, headings[index + 1]?.index).split(/\b(?:Project Experience|Project History|Education)\b/i)[0];
    const m = section.match(pattern);
    if (!m || /\b(?:client|customer|project)\b/i.test(m[3]) || !/\b(?:Consultant|Manager|Engineer|Analyst|Lead|Developer)\b/i.test(m[4])) return [];
    const current = /^(Present|Current|Now)$/i.test(m[2]);
    if (!supportedRange(m[1], m[2], current)) return [];
    const parsed = entry({company: m[3], title: m[4], start: m[1], end: m[2], current,
      sourceRef: `resume.formerNameEmployment.${index + 1}`, sourceType: 'parsed_resume', confidence: 94, excerpt: m[0]});
    return parsed ? [parsed] : [];
  });
}

// Job Experiences lists describe assignments under a dated employer heading.
// Recover the employer range without promoting an assignment title to employer role.
function employerAssignmentSummary(source: string): EnterpriseEmployment[] {
  const headings = [...source.matchAll(/\b(?:Professional Experience|Employment History)\s*:?\s*/gi)];
  const date = '(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+)?(?:19|20)\\d{2}';
  const pattern = new RegExp(`^(${date})\\s*[-–—]\\s*(${date}|Present|Current|Now)\\s+(.{2,140}?)\\s+Job Experiences\\s*:?\\s*[-–—]`, 'i');
  return headings.flatMap((heading, index) => {
    const m = source.slice((heading.index || 0) + heading[0].length, headings[index + 1]?.index).match(pattern);
    if (!m || /\b(?:client|customer|project|consultant|manager)\b/i.test(m[3])) return [];
    const current = /^(Present|Current|Now)$/i.test(m[2]);
    if (!supportedRange(m[1], m[2], current)) return [];
    const parsed = entry({company: m[3], title: '', start: m[1], end: m[2], current, allowGroundedEmployerOnly: true,
      sourceRef: `resume.employerAssignmentSummary.${index + 1}`, sourceType: 'parsed_resume', confidence: 90, excerpt: m[0]});
    return parsed ? [parsed] : [];
  });
}

// A bounded employment section can flatten several chronological row layouts.
// These readers require an explicit range plus a structural employer boundary;
// they never cross into project/client sections or use responsibility dates.
function chronologicalEmploymentLedgers(
  source: string,
): EnterpriseEmployment[] {
  const headings = [
    ...source.matchAll(
      /\b(?:Professional Experience|Employment History|Working Experience|Work Experience)\s*:?\s*/gi,
    ),
  ];
  const month =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const dayMonthYear = `(?:(?:\\d{1,2}(?:\\s*(?:st|nd|rd|th))?\\s+)?${month}[., ]+(?:19|20)\\d{2}|${month}\\s+\\d{1,2}(?:\\s*(?:st|nd|rd|th))?[., ]+(?:19|20)\\d{2})`;
  const range = `(${dayMonthYear})\\s*(?:[-–—]|to|until|till)\\s*(${dayMonthYear}|Present|Current|Now)`;
  const role =
    "(?:(?:Senior|Junior|Lead|Principal|Regional|Inside|Assistant|Technical|Technology|Functional|Business|IT|SAP|Solution|Sales|Account)\\s+){0,5}(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Representative|Head)(?:\\s+of\\s+[A-Za-z/& -]{2,60}?)?(?:\\s*[-–—/]\\s*SAP(?:\\s+[A-Za-z0-9/& -]{1,45})?)?";
  const legal =
    "[A-Z0-9][A-Za-z0-9&.,'() /-]{1,100}?\\b(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Private Limited|Corporation|Berhad|Limited|Ltd\\.?|Inc\\.?)";
  const normalize = (value: string) =>
    value
      .replace(/(\d)\s*(?:st|nd|rd|th)\b/gi, "$1")
      .replace(/([A-Za-z])[.,]+\s*(?=\d{4}\b)/, "$1 ")
      .replace(
        new RegExp(`^(${month})\\s+\\d{1,2}[, ]+((?:19|20)\\d{2})$`, "i"),
        "$1 $2",
      )
      .replace(/\s+/g, " ")
      .trim();

  return headings.flatMap((heading, sectionIndex) => {
    const fullSection = source
      .slice(
        (heading.index || 0) + heading[0].length,
        headings[sectionIndex + 1]?.index,
      )
      .split(
        /\b(?:Project Experience|Project History|Project Details|Projects\s*\/\s*Assignments|Education|Qualifications|Certifications|Technical Skills|References)\b|\b(?:Project|Client|Customer)\s*:/i,
      )[0];
    const output: EnterpriseEmployment[] = [];
    const add = (
      company: string,
      title: string,
      start: string,
      end: string,
      excerpt: string,
      row: number,
      family: string,
    ) => {
      start = normalize(start);
      end = normalize(end);
      const current = /^(?:Present|Current|Now)$/i.test(end);
      if (
        /\b(?:client|customer|project|responsibilities|duties)\b/i.test(
          company,
        ) ||
        !supportedRange(start, end, current)
      )
        return;
      const parsed = entry({
        company,
        title,
        start,
        end,
        current,
        sourceRef: `resume.chronologicalLedger.${family}.${sectionIndex + 1}.${row + 1}`,
        sourceType: "parsed_resume",
        confidence: 94,
        excerpt,
      });
      if (parsed) output.push(parsed);
    };

    // Role / tenure / legal employer, with a location or duty sentence after
    // the employer. The legal suffix owns the company boundary.
    const roleTenureEmployer = new RegExp(
      `(?:^|[.!?]\\s+)(${role})\\s+${range}\\s+(${legal})(?=,?\\s+(?:[A-Z][A-Za-z .'-]{1,55}\\s+)?(?:Executed|Identify|Managed|Conducted|Responsible|Provided|Performed|Delivered|Collated|Developed|Maintained|Assisted|Supported|Led)\\b|,\\s*[A-Z][A-Za-z .'-]{1,55}(?:[.!?]|\\s+[A-Z][a-z]+ed\\b)|\\s*$)`,
      "gi",
    );
    for (const [row, match] of [
      ...fullSection.matchAll(roleTenureEmployer),
    ].entries())
      add(
        match[4],
        match[1],
        match[2],
        match[3],
        match[0],
        row,
        "role-tenure-legal-employer",
      );

    // Employer / city-country / role / tenure at the start of a declared
    // section. The comma before country and the dated suffix own every cell.
    const located = fullSection.match(
      new RegExp(
        `^([A-Z0-9][A-Za-z0-9&.'() -]{1,100}?)\\s+(Kuala Lumpur|Petaling Jaya|Singapore|Jakarta|Bangkok|Ho Chi Minh City),\\s*(Malaysia|Singapore|Vietnam|India|Indonesia|Thailand|Philippines|United States)\\s+(${role})\\s+${range}(?=\\s|[.;]|$)`,
        "i",
      ),
    );
    if (located)
      add(
        located[1],
        located[4],
        located[5],
        located[6],
        located[0],
        0,
        "employer-location-role-tenure",
      );

    // Date range : employer role. A role anchor provides the otherwise-lost
    // employer boundary; rows are accepted only inside the employment section.
    const datedColon = new RegExp(
      `(?:^|[.!?]\\s+)${range}\\s*:\\s*([A-Z0-9][A-Za-z0-9&.'’() /-]{1,90}?)\\s+(${role})(?=\\s+(?:Set\\b|Run\\b|Analyze\\b|Manage\\b|Ensure\\b|Support(?:ing)?\\b|[A-Z][a-z]+(?:ed|ing)\\b|Main Duties\\s*:|Responsibilities\\s*:|\\()|\\s*$)`,
      "gi",
    );
    for (const [row, match] of [...fullSection.matchAll(datedColon)].entries())
      add(
        match[3],
        match[4],
        match[1],
        match[2],
        match[0],
        row,
        "dated-colon-employer-role",
      );

    return output;
  });
}

// Some histories use Employer. From MM-YYYY to MM-YYYY: Role. Numeric months
// are converted mechanically; a missing or reversed endpoint is never repaired.
function numericFromToEmployment(source: string): EnterpriseEmployment[] {
  const section = source.match(
    /\bEmployment History\s*:?\s*([\s\S]*?)(?=\b(?:Education|Qualifications|Certifications|Technical Skills|References)\b|$)/i,
  )?.[1];
  if (!section) return [];
  const company =
    "[A-Z0-9][A-Za-z0-9&,'() /-]{1,100}?\\b(?:Co\\.,?\\s*Ltd\\.?|Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Corporation|Limited|Ltd\\.?|Inc\\.?|HQ)";
  const pattern = new RegExp(
    `\\b(${company})\\.?\\s+From\\s+(0?[1-9]|1[0-2])[-/]((?:19|20)\\d{2})\\s+to\\s+(0?[1-9]|1[0-2])[-/]((?:19|20)\\d{2})\\s*:\\s*([^:;]{2,110}?)(?=\\s+(?:Main Duties|Duties|Responsibilities)\\s*:|$)`,
    "gi",
  );
  return [...section.matchAll(pattern)].flatMap((match, index) => {
    const monthName = (value: string) => {
      const name = monthNames[Number(value) - 1];
      return name ? name[0].toUpperCase() + name.slice(1) : "";
    };
    const start = `${monthName(match[2])} ${match[3]}`;
    const end = `${monthName(match[4])} ${match[5]}`;
    if (!supportedRange(start, end, false)) return [];
    const parsed = entry({
      company: match[1],
      title: match[6],
      start,
      end,
      current: false,
      sourceRef: `resume.numericFromTo.${index + 1}`,
      sourceType: "parsed_resume",
      confidence: 96,
      excerpt: match[0],
    });
    return parsed ? [parsed] : [];
  });
}

// Explicit table headings and labels survive flattening even when rows lose
// line breaks. Each family below owns all employer/title/date cells and stops
// before project evidence or free-form duties.
function structuredEmploymentTables(source: string): EnterpriseEmployment[] {
  const output: EnterpriseEmployment[] = [];
  const month =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const date = `${month}\\s+(?:19|20)\\d{2}`;
  const year = "(?:19|20)\\d{2}";
  const end = `(?:${date}|${year}|Present|Current|Now|(?:till|until)\\s+(?:today|date|now))`;
  const range = `(${date}|${year})\\s*(?:[-–—]|to|until|till)\\s*(${end})`;
  const legal =
    "[A-Z0-9][A-Za-z0-9&.,'() /-]{1,110}?\\b(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Private Limited|Corporation|Berhad|Limited|Ltd\\.?|Inc\\.?)";
  const normalizeEnd = (value: string) =>
    /^(?:(?:till|until)\s+(?:today|date|now)|present|current|now)$/i.test(value)
      ? "Present"
      : value;
  const add = (
    company: string,
    title: string,
    start: string,
    finish: string,
    excerpt: string,
    sourceRef: string,
  ) => {
    finish = normalizeEnd(finish);
    const current = finish === "Present";
    if (
      /\b(?:client|customer|project|responsibilities|duties)\b/i.test(
        company,
      ) ||
      !supportedRange(start, finish, current)
    )
      return;
    const parsed = entry({
      company,
      title,
      start,
      end: finish,
      current,
      sourceRef,
      sourceType: "parsed_resume",
      confidence: 96,
      excerpt,
    });
    if (parsed) output.push(parsed);
  };

  // Year / Designation tables repeat legal employer, year tenure and role.
  const yearTable = source.match(
    /\bProfessional Experience\s+Year\s+Designation\s+([\s\S]*?)(?=\b(?:Projects|Project (?:Experience|History|Details)|Education|Qualifications|Technical Skills)\b|$)/i,
  )?.[1];
  if (yearTable) {
    const rows = [
      ...yearTable.matchAll(
        new RegExp(
          `(${legal})(?:\\s*[-–—]\\s*[A-Za-z][A-Za-z .'-]{1,45})?\\s+(${year})\\s*(?:[-–—]|to)\\s*(${year}|Present|Current|Now)\\s+([A-Za-z][^;]{1,110}?\\b(?:Consultant|Manager|Architect|Archited|SME))(?=\\s+${legal}|\\s*$)`,
          "gi",
        ),
      ),
    ];
    for (const [index, row] of rows.entries()) {
      // A trailing scope phrase cannot become the next legal employer, and a
      // title followed by that phrase is not complete enough to emit yet.
      if (/^(?:for|with|and)\b/i.test(row[1]) || /^\s+(?:for|with)\b/i.test(yearTable.slice(row.index! + row[0].length))) continue;
      add(
        row[1],
        row[4],
        row[2],
        row[3],
        row[0],
        `resume.structuredTable.yearDesignation.${index + 1}`,
      );
    }
  }

  // Numbered organisation forms own Duration and Role Played labels.
  const organisation = source.match(
    /\bOrgani[sz]ation Details\s*\(Work Experience\)\s*(?:\([^)]*\)\s*)?([\s\S]*?)(?=\b(?:Education|Qualifications|Certifications|Technical Skills|References)\b|$)/i,
  )?.[1];
  if (organisation) {
    const rows = [
      ...organisation.matchAll(
        new RegExp(
          `\\b\\d+\\s*\\.\\s*(${legal})\\s+Duration\\s*:\\s*${range}\\.?\\s*(?:\\([^)]{1,60}\\))?\\s*Role Played\\s*:\\s*([^:;]{2,110}?)(?=\\s+(?:Skills Used|Responsibilities|Duties|Job Description)\\s*:|\\s+\\d+\\s*\\.|$)`,
          "gi",
        ),
      ),
    ];
    for (const [index, row] of rows.entries())
      add(
        row[1],
        row[4],
        row[2],
        row[3],
        row[0],
        `resume.structuredTable.organisationDurationRole.${index + 1}`,
      );
  }

  const workSection = source.match(
    /\bWorking Experience\s*:?\s*([\s\S]*?)(?=\b(?:Education|Qualifications|Certifications|Technical Skills|References|Professional Experience|Project Experience)\b|$)/i,
  )?.[1];
  if (workSection) {
    // Year range : legal employer / Role label.
    const labelled = [
      ...workSection.matchAll(
        new RegExp(
          `${range}\\s*:\\s*(${legal})\\s+Role\\s*:\\s*([^.;]{2,120}?)(?=\\.\\s+(?:[A-Z(])|\\s+(?:Responsibilities|Duties)\\s*:|$)`,
          "gi",
        ),
      ),
    ];
    const currentEmployers = new Set<string>();
    for (const [index, row] of labelled.entries()) {
      const companyKey = normalized(row[3]);
      const current = /^(?:Present|Current|Now)$/i.test(normalizeEnd(row[2]));
      if (current && currentEmployers.has(companyKey)) continue;
      add(
        row[3],
        row[4],
        row[1],
        row[2],
        row[0],
        `resume.structuredTable.datedEmployerRole.${index + 1}`,
      );
      if (current) currentEmployers.add(companyKey);
    }

    // Date / employer / SAP role / location / Responsibilities rows.
    const sapRows = [
      ...workSection.matchAll(
        new RegExp(
          `${range}\\s+([A-Z][A-Za-z0-9&.'() -]{1,80}?)\\s+((?:(?:Senior|Junior|Lead|Principal)\\s+)?SAP\\s+[A-Za-z0-9/& -]{0,65}?(?:Consultant|Manager|Analyst|Engineer|Lead)),\\s*[A-Za-z][A-Za-z ,.'-]{1,80}\\s+[⮚➢•]?\\s*Responsibilities\\s*:`,
          "gi",
        ),
      ),
    ];
    for (const [index, row] of sapRows.entries())
      add(
        row[3].replace(/(\bS\.?p\.?A\.?)(?:\s+.*)?$/i, "$1"),
        row[4],
        row[1],
        row[2],
        row[0],
        `resume.structuredTable.datedEmployerSapRole.${index + 1}`,
      );

    // Explicit self-employment marker between role and tenure.
    const freelance = workSection.match(
      new RegExp(
        `^([^:;]{2,100}?\\b(?:Consultant|Manager|Developer|Analyst|Engineer))\\s+(FREELANCER)\\s+${range}(?=\\s+Job Description\\s*:|\\s*$)`,
        "i",
      ),
    );
    if (freelance)
      add(
        freelance[2],
        freelance[1],
        freelance[3],
        freelance[4],
        freelance[0],
        "resume.structuredTable.freelanceRoleTenure.1",
      );
  }
  return output;
}

// A flattened assignment ledger may explicitly label Client and Company in
// separate columns. The Company field owns the employment claim; dates and
// roles must be inside that same row. Never promote the Client field.
function labelledClientEmployerEmployment(source: string): EnterpriseEmployment[] {
  const heading = /\bWORK EXPERIENCE\s+(?=DURATION\s*:)/gi;
  const date = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[/. -]*[’']?\\d{2,4}";
  const pattern = new RegExp(
    `\\bDURATION\\s*:\\s*(${date})\\s+(?:TO|TILL|UNTIL|[-–—])\\s*(${date}|CURRENT|PRESENT|DATE|NOW)\\s+CLIENT\\s*:\\s*((?:(?!\\b(?:DURATION|CLIENT|ROLE)\\s*:).){2,110}?)\\s+COMPANY\\s*:\\s*((?:(?!\\b(?:DURATION|CLIENT|COMPANY)\\s*:|\\bROLE\\b).){2,120}?)\\s+ROLE\\s*:?(?=\\s)`,
    "gi",
  );
  const normalizeDate = (value: string) => {
    if (/^(?:current|present|date|now)$/i.test(value)) return "Present";
    const match = value.match(/^([A-Za-z]+)[/. -]*[’']?(\d{2}|\d{4})$/);
    if (!match) return "";
    const year = Number(match[2]);
    return `${match[1]} ${year < 100 ? year + (year <= 30 ? 2000 : 1900) : year}`;
  };
  return [...source.matchAll(heading)].flatMap((section, sectionIndex) => {
    const body = source.slice((section.index || 0) + section[0].length)
      .split(/\b(?:PROJECT SUMMARY|PROJECT EXPERIENCE|ACADEMIC QUALIFICATIONS?|EDUCATIONAL QUALIFICATIONS?|PERSONAL DETAILS)\b/i)[0];
    return [...body.matchAll(pattern)].flatMap((match, rowIndex) => {
      const next = body.slice((match.index || 0) + match[0].length);
      const roleCell = next.split(/\bRESPONSIBILITIES\b|\b(?:DURATION|EDUCATION)\s*:(?=\s|$)/i)[0].trim();
      const title = roleCell.replace(/^.{0,65}?\b(?:was assigned|worked|acting)\s+as\s+(?:an?\s+)?/i, "")
        .replace(/^an?\s+/i, "").trim();
      const company = match[4].split(/\bINDUSTRY\s*[-–—:]\s*/i)[0].trim();
      const start = normalizeDate(match[1]);
      const end = normalizeDate(match[2]);
      const current = end === "Present";
      if (!title || !company || !supportedRange(start, end, current)) return [];
      const parsed = entry({company, title, start, end, current,
        sourceRef: `resume.labelledClientEmployer.${sectionIndex + 1}.${rowIndex + 1}`,
        sourceType: "parsed_resume", excerpt: match[0] + " " + roleCell,
        confidence: 94});
      return parsed ? [parsed] : [];
    });
  });
}

function resumeEmployment(resumeText: string) {
  const output: EnterpriseEmployment[] = [];
  const namedMonth = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const abbreviatedTenure = new RegExp(`\\b(${namedMonth})\\s+(\\d{2})\\s*([-–—]|to)\\s*(${namedMonth})\\s+(\\d{2})(?![\\da-z])`, "gi");
  const expandYear = (year: string) => `${Number(year) <= 30 ? '20' : '19'}${year}`;
  for (const [index, row] of layoutEmployment(resumeText).entries()) {
    const normalizeDate = (input = '') => input.replace(/^(0?[1-9]|1[0-2])[/.]\s*(\d{4})$/, (_, m, y) => `${monthNames[Number(m) - 1]} ${y}`).replace(/^Curr$/i, 'Current');
    const start = normalizeDate(row.start), end = normalizeDate(row.end);
    if (start && end && !supportedRange(start, end, /^(present|current)$/i.test(end))) continue;
    const parsed = entry({ ...row, start, end, allowGroundedEmployerOnly: true, sourceRef: `resume.layout.${index + 1}`, sourceType: 'parsed_resume', confidence: 90 });
    if (parsed) output.push(parsed);
  }
  const source = resumeText
    .normalize("NFKC")
    // Quotes/articles are typography in explicit employment statements. Keep
    // role/employer ownership and both literal date endpoints unchanged.
    .replace(/\b(as)\s+(?:a\s+)?[“"']([^”"']{2,100})[”"'](?=\s+(?:at|in|for)\b)/gi, "$1 $2")
    // Expand abbreviated years only in an explicit worked-as sentence. Global
    // expansion can change row ownership in unrelated flattened date tables.
    .replace(/\bWorked as\b[^;\n]{2,220}?\bfrom\s+[^.;\n]{2,60}/gi, statement => statement.replace(abbreviatedTenure, (_all, startMonth, startYear, separator, endMonth, endYear) => `${startMonth} ${expandYear(startYear)} ${separator} ${endMonth} ${expandYear(endYear)}`))
    .replace(/\b(0?[1-9]|1[0-2])\s*\/\s*(\d{4}|\d{2})\b/g, (_all, month, year) => {
      const value = Number(year); const full = value < 100 ? value + (value <= 30 ? 2000 : 1900) : value;
      return `${monthNames[Number(month) - 1]} ${full}`;
    })
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
  const ownedCareerSpans: {sourceStart: number; sourceEnd: number}[] = [];
  for (const [index, row] of exportedCareerEmployment(source).entries()) {
    const parsed = entry({ ...row, sourceRef: `resume.exportedCareer.${index + 1}`, sourceType: 'parsed_resume', confidence: 94 });
    if (parsed) {
      output.push(parsed);
      ownedCareerSpans.push(row);
    }
  }
  output.push(...labelledClientEmployerEmployment(source), ...tabularResumeEmployment(source), ...organizationDesignationEmployment(source), ...proseEmploymentHeadings(source), ...compactEmploymentHeading(source), ...labelledEmployerHistory(source), ...explicitHeadingVariants(source), ...orderedLabelEmployment(source), ...dateCompanyRoleEmployment(source), ...explicitEmploymentStatements(source), ...spacedDateEmployment(source), ...datedEmploymentLedger(source), ...headingDurationPositionEmployment(source), ...numberedPositionEmployment(source), ...numberedPositionPeriodEmployment(source), ...roleCompanyPeriodEmployment(source), ...pipedRoleEmployerPeriodEmployment(source), ...locatedEmployerHistory(source), ...durationEmployerHistory(source), ...organizationDurationDesignationEmployment(source), ...organizationPeriodEmployment(source), ...datedCareerSummary(source), ...numberedWorkExperience(source), ...locatedRoleEmployment(source), ...formerNameEmployment(source), ...employerAssignmentSummary(source), ...chronologicalEmploymentLedgers(source), ...numericFromToEmployment(source), ...structuredEmploymentTables(source));
  for (const project of ownedProjectCareerLedger(source)) {
    const parsed = entry({ company: project.employer, title: project.role,
      sourceRef: project.sourceRef, sourceType: "parsed_resume", confidence: 94,
      excerpt: project.excerpt });
    if (parsed) output.push(parsed);
  }
  for (const [index, row] of flattenedEmployment(source).entries()) {
    const parsed = entry({...row, allowGroundedEmployerOnly: true,
      sourceRef: `resume.flattened.${row.group}.${index + 1}`, sourceType: "parsed_resume", confidence: 94});
    if (!parsed) continue;
    const sameHeading = !parsed.title && output.find((known) => known.title &&
      (normalized(known.company) === normalized(parsed.company) ||
        normalized(known.company.replace(/\s*\([^()]+\)$/, "")) === normalized(parsed.company)) &&
      monthIndex(known.start) !== null && monthIndex(known.start) === monthIndex(parsed.start) &&
      monthIndex(known.end, known.current) !== null && monthIndex(known.end, known.current) === monthIndex(parsed.end, parsed.current) &&
      known.current === parsed.current && parsed.provenance?.[0]?.excerpt &&
      known.provenance?.some((ref) => ref.sourceRef?.startsWith('resume.layout.') &&
        (clean(ref.excerpt).toLowerCase().includes(clean(parsed.provenance?.[0]?.excerpt).toLowerCase()) ||
          clean(parsed.provenance?.[0]?.excerpt).toLowerCase().startsWith(clean(ref.excerpt).toLowerCase()))));
    if (sameHeading) {
      sameHeading.provenance = [...(sameHeading.provenance || []), ...(parsed.provenance || [])];
      sameHeading.sourceEmploymentIds?.push(...(parsed.sourceEmploymentIds || []));
    } else output.push(parsed);
  }
  for (const [index, row] of anchoredEmployment(source).entries()) {
    const parsed = entry({...row, allowGroundedEmployerOnly: true, sourceRef: `resume.anchored.${index + 1}`, sourceType: 'parsed_resume', confidence: 94});
    if (!parsed) continue;
    // A fuller reader already owns this exact heading. Retain its complete
    // role rather than introducing an empty or clipped duplicate.
    const owned = output.find(known => monthIndex(known.start) === monthIndex(parsed.start) &&
      monthIndex(known.end, known.current) === monthIndex(parsed.end, parsed.current) &&
      known.current === parsed.current && known.provenance?.some(ref =>
        clean(ref.excerpt).toLowerCase().includes(clean(row.excerpt).toLowerCase())));
    if (owned) owned.provenance = [...(owned.provenance || []), ...(parsed.provenance || [])];
    else output.push(parsed);
  }
  const monthYear =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*[’']?\\s*(?:19|20)\\d{2}";
  const explicitCompanyPositionDate = new RegExp(
    `((?:${monthYear})\\s*[-–—]\\s*(?:${monthYear}))[^.]{0,80}?Company\\s*:\\s*([^]{2,140}?)\\s+Position\\s*:\\s*([^]{2,120}?)(?=\\s+(?:Client\\s*[:–—-]|Specific Responsibilities|Responsibilities|Project|$))`,
    "gi",
  );
  [...source.matchAll(explicitCompanyPositionDate)].forEach((match, index) => {
    const range = match[1].match(
      new RegExp(`(${monthYear})\\s*[-–—]\\s*(${monthYear})`, "i"),
    );
    const parsed = entry({
      company: match[2],
      title: match[3].replace(/\s+(?:Division\s*:|Reporting Line\b)[\s\S]*$/i, "").replace(
        /\s*\([^)]*(?:permanent|contract)[^)]*\)\s*$/i,
        "",
      ),
      start: range?.[1]?.replace(/[’']/g, " ").replace(/\s+/g, " ") || "",
      end: range?.[2]?.replace(/[’']/g, " ").replace(/\s+/g, " ") || "",
      current: false,
      sourceRef: `resume.explicitCompanyPositionDate.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 96,
    });
    if (parsed) output.push(parsed);
  });

  // Some CVs use a labelled Company/Position record with Duration after the
  // role, or put the range immediately before Company. Keep this employment
  // extractor assignment-neutral: a Client field remains project provenance.
  const looseMonthYear =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*[’']?[\\s-]*(?:19|20)\\d{2}";
  const labelledCompanyMarkers = [...source.matchAll(/\bCompany\s*:/gi)];
  labelledCompanyMarkers.forEach((marker, index) => {
    const markerIndex = marker.index || 0;
    const block = source
      .slice(
        markerIndex,
        labelledCompanyMarkers[index + 1]?.index ?? source.length,
      )
      .slice(0, 1200);
    const prefix = source.slice(Math.max(0, markerIndex - 120), markerIndex);
    const beforeMarker = source.slice(0, markerIndex).toLocaleLowerCase();
    const projectSection = Math.max(
      beforeMarker.lastIndexOf("project experience"),
      beforeMarker.lastIndexOf("project experince"),
      beforeMarker.lastIndexOf("project history"),
      beforeMarker.lastIndexOf("relevant project experience"),
      beforeMarker.lastIndexOf("relevant project experince"),
      beforeMarker.lastIndexOf("projects/assignments involved"),
    );
    const employmentSection = Math.max(
      beforeMarker.lastIndexOf("employment history"),
      beforeMarker.lastIndexOf("working experience"),
      beforeMarker.lastIndexOf("professional experience"),
      beforeMarker.lastIndexOf("employment & experience"),
      beforeMarker.lastIndexOf("career snapshot"),
    );
    if (employmentSection < 0 || projectSection > employmentSection) return;
    if (
      /\b(?:Project Experience|Projects?\s*\/\s*Assignments? Involved)\s*\d*\)?\s*$/i.test(
        prefix,
      )
    )
      return;
    const company =
      block.match(
        /^Company\s*:\s*([\s\S]{2,140}?)(?=\s+(?:Clients?|Duration|(?:Job\s+)?Position)\s*:)/i,
      )?.[1] || "";
    const title =
      block.match(
        /\b(?:Job\s+)?Position\s*:\s*([\s\S]{2,140}?)(?=\s+(?:Speciali[sz]ation|Duration|Job\s+Scopes?|Specific\s+Responsibilities|Responsibilities|Tasks?|Background|Project(?!\s+(?:Manager|Lead|Director|Coordinator|Management)\b)|Client)\s*:?\s|\s*\(|[.;]|$)/i,
      )?.[1]?.replace(/\s+(?:Division\s*:|Reporting Line\b)[\s\S]*$/i, "") || "";
    const durationRange = block.match(
      new RegExp(
        `\\bDuration\\s*:\\s*(${looseMonthYear})\\s*(?:[-\\u2013\\u2014]|to|until|till)\\s*(${looseMonthYear}|Present|Current|date)`,
        "i",
      ),
    );
    const suffixRange = block.match(
      new RegExp(
        `\\b(?:Position\\s*:[\\s\\S]{2,160}?)?(${looseMonthYear})\\s*(?:[-\\u2013\\u2014]|to|until)\\s*(${looseMonthYear}|Present|Current)(?=\\s+(?:Responsibilities|Duties|Job\\s+Scopes?|Project|Client)\\s*:|[.;]|$)`,
        "i",
      ),
    );
    const parentheticalRange = block.match(
      new RegExp(
        `\\(\\s*(${looseMonthYear})\\s*(?:[-\\u2013\\u2014]|to|until|till)\\s*(${looseMonthYear}|Present|Current)\\s*\\)`,
        "i",
      ),
    );
    const parentheticalYearRange = block.match(
      /\(\s*((?:19|20)\d{2})\s*(?:-|\u2013|\u2014|to|until|till)\s*((?:19|20)\d{2}|Present|Current)\s*\)/i,
    );
    const prefixRange = prefix.match(
      new RegExp(
        `(?:\\(\\s*)?(${looseMonthYear})\\s*(?:[-\\u2013\\u2014]|to|until|\\s)\\s*(${looseMonthYear}|Present|Current)(?:\\s*\\))?\\s*$`,
        "i",
      ),
    );
    const range =
      durationRange ||
      suffixRange ||
      parentheticalRange ||
      parentheticalYearRange ||
      prefixRange;
    const normalizeDate = (value: string) =>
      clean(value).replace(/([A-Za-z])[-\s]+((?:19|20)\d{2})/, "$1 $2");
    if (
      !company ||
      !title ||
      !range ||
      (/\b(?:No\.\s*\d+|Jalan|Street|Towers?|Wisma)\b/i.test(company) &&
        /\bDepartment\s*:/i.test(title)) ||
      /\b(?:duration|client|project)\s*:/i.test(company)
    )
      return;
    const start = normalizeDate(range[1]);
    const end = /^date$/i.test(range[2]) ? "Present" : normalizeDate(range[2]);
    const locatedCompany = company.match(/^(.+?)[–—-]\s+([A-Za-z][A-Za-z .'-]{1,50},\s*(?!(?:Inc|Ltd|Limited|Bhd)\b)[A-Za-z][A-Za-z ]{1,40})$/i);
    const parsed = entry({
      company: locatedCompany?.[1]?.trim() || company,
      location: locatedCompany?.[2] || "",
      title,
      start,
      end,
      current: /^(?:present|current)$/i.test(end),
      responsibilities: responsibilitiesBetween(
        block,
        range.index || 0,
        block.length,
      ),
      sourceRef: `resume.labelledCompanyPositionDate.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: `${prefix.slice(-100)} ${block.slice(0, 320)}`,
      confidence: 95,
    });
    if (parsed) output.push(parsed);
  });

  const positionBeforeCompany = new RegExp(
    `(${looseMonthYear})\\s+(Now|Present|Current|${looseMonthYear})\\s+Position\\s*:\\s*([\\s\\S]{2,120}?)\\s+Company\\s*:\\s*([\\s\\S]{2,140}?)(?=\\s+(?:${looseMonthYear})\\s+(?:Now|Present|Current|${looseMonthYear})\\s+Position\\s*:|\\s+PROJECT\\s+REFERENCES|$)`,
    "gi",
  );
  [...source.matchAll(positionBeforeCompany)].forEach((match, index) => {
    const start = match[1].replace(/([A-Za-z])[-\s]+((?:19|20)\d{2})/, "$1 $2");
    const end = /^(?:now|present|current)$/i.test(match[2])
      ? "Present"
      : match[2].replace(/([A-Za-z])[-\s]+((?:19|20)\d{2})/, "$1 $2");
    const parsed = entry({
      company: match[4],
      title: match[3],
      start,
      end,
      current: end === "Present",
      sourceRef: `resume.positionBeforeCompany.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 95,
    });
    if (parsed) output.push(parsed);
  });

  const workingAs = new RegExp(
    `\\b(?:Currently\\s+working|Worked)\\s+as\\s+([^.;]{2,100}?\\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant))\\s+(?:in|at|with)\\s+([^.;]{2,140}?)\\s+(?:from\\s+)?(${monthYear})\\s+(?:to|[-–—])\\s+(?:\\d{1,2}\\s+)?(${monthYear})(?=[.,;]|\\s+(?:Worked|Expertise|Skills|$))`,
    "gi",
  );
  [...source.matchAll(workingAs)].forEach((match, index) => {
    const parsed = entry({
      title: match[1].replace(/^an?\s+/i, ''),
      company: match[2],
      start: match[3].replace(/[’']/g, " ").replace(/\s+/g, " "),
      end: match[4].replace(/[’']/g, " ").replace(/\s+/g, " "),
      current: false,
      sourceRef: `resume.explicitWorkingAs.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 94,
    });
    if (parsed) output.push(parsed);
  });
  const roleCompany = new RegExp(
    `([^.!?—–]{2,120}?\\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Head of ERP))\\s*[—–]\\s*(.{2,140}?)\\s*\\((${date})\\s*[—–-]\\s*(${date}|Present|Current)\\)`,
    "gi",
  );
  const roleMatches = [...source.matchAll(roleCompany)];
  roleMatches.forEach((match, index) => {
    // A freelance assignment followed by "as <role>" is project evidence,
    // never a second employer when another reader owns the consulting firm.
    if (/^Freelance\s+(?:Job|Project)\b/i.test(clean(match[2])) && /[-–—]\s*as\s+/i.test(match[2])) return;
    const sourceEnd = roleMatches[index + 1]?.index ?? source.length;
    const parsed = entry({
      title: resumeRole(match[1]),
      company: resumeCompany(match[2]),
      start: match[3],
      end: match[4],
      current: /present|current/i.test(match[4]),
      responsibilities: responsibilitiesBetween(
        source,
        (match.index || 0) + match[0].length,
        sourceEnd,
      ),
      sourceRef: `resume.professionalExperience.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 92,
    });
    if (parsed) output.push(parsed);
  });

  const companyRoleDate = `(?:${looseMonthYear}|(?:19|20)\\d{2})`;
  const companyRoleEmployer = "(?:PT\\.?|CV\\.?|[A-Z])[A-Za-z0-9.&/', +\\-]{2,120}?";
  const companyRole = new RegExp(
    `(${companyRoleEmployer})\\s*\\((${companyRoleDate})\\s*[—–-]\\s*(${companyRoleDate}|Present|Current)\\)\\s*(?:As|Position\\s*:)\\s*([^]{2,120}?)(?=\\s+(?:${companyRoleEmployer})\\s*\\(${companyRoleDate}\\s*[—–-]|\\s*(?:Summary|Description|Responsibilities?|${companyRoleDate}|(?:PT\\.?|CV\\.?)\\s+[A-Z]|Industry\\s*\\(Project\\)|Education|Project Experience|$))`,
    "gi",
  );
  const companyMatches = [...source.matchAll(companyRole)];
  companyMatches.forEach((match, index) => {
    const sourceEnd = companyMatches[index + 1]?.index ?? source.length;
    const normalizeCompanyRoleDate = (value: string) =>
      value.replace(/^([A-Za-z]+)[’']?\s*((?:19|20)\d{2})$/, "$1 $2");
    const parsed = entry({
      company: resumeCompany(match[1]),
      start: normalizeCompanyRoleDate(match[2]),
      end: normalizeCompanyRoleDate(match[3]),
      current: /present|current/i.test(match[3]),
      title: resumeRole(match[4]),
      responsibilities: responsibilitiesBetween(
        source,
        (match.index || 0) + match[0].length,
        sourceEnd,
      ),
      sourceRef: `resume.workExperience.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 92,
    });
    if (parsed) output.push(parsed);
  });

  const titleAtCompany = new RegExp(
    `([^.!?]{2,100}?\\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant))\\s+at\\s+(.{2,140}?)\\s+((${date})\\s*[—–-]\\s*(${date}|Present|Current))`,
    "gi",
  );
  const careerRoleSuffix = (raw: string) => {
    const value = clean(raw);
    // Flattened exports can put duty prose directly before a new role. Only
    // the capitalized suffix immediately before "at Employer" owns its date.
    const boundary = Math.max(value.lastIndexOf(','), value.lastIndexOf(':'), value.lastIndexOf(')'), value.lastIndexOf('•'));
    const fragment = value.slice(boundary + 1).trim();
    const tokens = [...fragment.matchAll(/[A-Za-z][A-Za-z0-9/+-]*/g)];
    if (!tokens.length || tokens.at(-1)!.index! + tokens.at(-1)![0].length !== fragment.length) return '';
    let start = fragment.length;
    for (let index = tokens.length - 1, words = 0; index >= 0 && words < 7; index--, words++) {
      const token = tokens[index];
      if (!/^[A-Z]/.test(token[0]) || !/^[\s/&-]*$/.test(fragment.slice(token.index! + token[0].length, start))) break;
      start = token.index!;
      if (/^(?:SAP|ERP|ABAP|FI|CO|FICO|MM|SD|PP|PS|BW|HCM)$/i.test(token[0])) break;
    }
    const title = fragment.slice(start).trim();
    return /\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant)$/i.test(title)
      ? title : '';
  };
  // Explicit cards own their text span. The older prose reader otherwise
  // crosses card boundaries or clips dotted company names to "Bhd."/"Ltd".
  // Match original offsets, not text replacement: identical text may also
  // occur in a separately supported, more specific role later in the source.
  [...source.matchAll(titleAtCompany)].forEach((match, index) => {
    const end = (match.index || 0) + match[0].length;
    if (ownedCareerSpans.some(span => end > span.sourceStart && end <= span.sourceEnd)) return;
    const originalTitle = resumeRole(match[1]);
    const wellFormedTitle = /^(?:SAP|ERP|ABAP|FI|SD|MM|CO|PP|PS|Senior|Sr\.?|Junior|Lead|Principal|Managing|Chief|Project|Head|Business|System|Systems|Software|Technical|Functional|Wintel|IT|HR|Finance|Account|Accounts|Customer|Support|Associate|Consultant|Developer|Analyst|Engineer|Officer|Manager|Director|Operations|Application|Network|Security|Data)\b/i.test(originalTitle);
    const title = !wellFormedTitle && (originalTitle.length > 65 || /:/.test(originalTitle))
      ? careerRoleSuffix(match[1]) : originalTitle;
    if (!title) return;
    const priorCompany = resumeCompany(match[2]);
    const parsed = entry({
      title,
      company: /^(?:Bhd|Ltd|Inc|Limited)(?:\.|\))?$/i.test(priorCompany)
        ? validEmploymentCompany(clean(match[2])) : priorCompany,
      start: match[4],
      end: match[5],
      current: /present|current/i.test(match[5]),
      sourceRef: `resume.careerHistory.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 92,
    });
    if (parsed) output.push(parsed);
  });

  // Employment histories sometimes put the employer between a parenthesized
  // tenure and an explicit Client label, followed by Current Position Title.
  // Treat Client as a boundary only: it must never replace the employer or
  // supply employment dates.
  const datedEmployerClientTitle = new RegExp(
    `\\(\\s*(${monthYear})\\s*[-–—]\\s*(${monthYear}|Present|Current)\\s*\\)\\s*([\\s\\S]{2,180}?)\\s*\\(\\s*Client\\s*:\\s*[\\s\\S]{1,180}?\\)\\s*Current\\s+Position\\s+Title\\s*:\\s*([\\s\\S]{2,120}?)(?=\\s+(?:Industry|Work\\s+Description|Projects?)\\s*:|$)`,
    "gi",
  );
  [...source.matchAll(datedEmployerClientTitle)].forEach((match, index) => {
    const markerIndex = match.index || 0;
    const beforeMarker = source.slice(0, markerIndex).toLowerCase();
    const employmentSection = Math.max(
      beforeMarker.lastIndexOf("employment history"),
      beforeMarker.lastIndexOf("working experience"),
      beforeMarker.lastIndexOf("professional experience"),
    );
    const projectSection = Math.max(
      beforeMarker.lastIndexOf("project experience"),
      beforeMarker.lastIndexOf("project history"),
    );
    const current = /^(?:present|current)$/i.test(match[2]);
    if (
      employmentSection < 0 ||
      projectSection > employmentSection ||
      !supportedRange(match[1], match[2], current)
    )
      return;
    const parsed = entry({
      company: validEmploymentCompany(match[3]),
      title: resumeRole(match[4]),
      start: match[1],
      end: match[2],
      current,
      sourceRef: `resume.datedEmployerClientTitle.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0],
      confidence: 96,
    });
    if (parsed?.company && parsed.title) output.push(parsed);
  });

  const labelledCurrent = source.match(
    /\bCurrent\s+Employment\s+Company\s+Name\s*:\s*([\s\S]{2,140}?)\s+Position\s*:\s*([\s\S]{2,120}?)(?=\s+(?:Project|Responsibilities?|Employment|Working Experience|$))/i,
  );
  if (labelledCurrent) {
    const historyPrefix = source.slice(
      Math.max(0, (labelledCurrent.index || 0) - 320),
      labelledCurrent.index || 0,
    );
    const supportedDates = historyPrefix.match(
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*[-\u2013\u2014]\s*(Present|Current)\b/i,
    );
    const parsed = entry({
      company: labelledCurrent[1],
      title: labelledCurrent[2],
      start: supportedDates?.[1] || "",
      end: supportedDates?.[2] || "",
      current: Boolean(supportedDates),
      sourceRef: "resume.currentEmployment",
      sourceType: "parsed_resume",
      excerpt: labelledCurrent[0],
      confidence: supportedDates ? 96 : 90,
    });
    if (parsed && supportedDates) output.push(parsed);
  }

  const labelledCompany = new RegExp(
    `Company\\s+Name\\s*:\\s*(.{2,120}?)\\s+((${date})\\s*[-\\u2013\\u2014]\\s*(${date}|Present|Current))\\s+Work\\s+Description\\s+([\\s\\S]*?)(?=Company\\s+Name\\s*:|$)`,
    "gi",
  );
  [...source.matchAll(labelledCompany)].forEach((match, index) => {
    const section = match[5];
    const labelledRole =
      section.match(
        /\b(?:Project\s+)?Role\s*:\s*((?:(?:Senior|Junior|Lead|Principal|Managing|Chief)\s+)*(?:SAP\s+)?[A-Za-z0-9/& -]{0,80}?(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Programmer)(?:\s*\([^)]{1,60}\))?)/i,
      )?.[1] ||
      section.match(
        /\b(?:Project\s+)?Role\s*:\s*([\s\S]{2,140}?)(?=\s+(?:Responsible|Responsibilities?|Prepare|Handle|Involved|Perform|Assist|Construct|Structured?|Gather|Monitor|Review|Develop|Manage|Coordinate|Provide|Configure|Analyze|Project|Client|Company\s+Name|$))/i,
      )?.[1] ||
      "";
    const parsed = entry({
      company: resumeCompany(match[1]),
      start: match[3],
      end: match[4],
      current: /present|current/i.test(match[4]),
      title: resumeRole(labelledRole),
      responsibilities: responsibilitiesBetween(section, 0, section.length),
      sourceRef: `resume.labelledWorkingExperience.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: match[0].slice(0, 320),
      confidence: 94,
    });
    if (parsed?.company && parsed.title && parsed.start && parsed.end)
      output.push(parsed);
  });

  const companyMarkers = [...source.matchAll(/\bCompany\s+Name\s*:/gi)].filter(
    (marker) =>
      !/Current\s+Employment\s*$/i.test(
        source.slice(Math.max(0, (marker.index || 0) - 30), marker.index || 0),
      ),
  );
  companyMarkers.forEach((marker, index) => {
    const markerIndex = marker.index || 0;
    const beforeMarker = source.slice(0, markerIndex).toLowerCase();
    const employmentSection = Math.max(
      beforeMarker.lastIndexOf("employment history"),
      beforeMarker.lastIndexOf("working experience"),
      beforeMarker.lastIndexOf("professional experience"),
      beforeMarker.lastIndexOf("employment & experience"),
    );
    const projectSection = Math.max(
      beforeMarker.lastIndexOf("project experience"),
      beforeMarker.lastIndexOf("project experince"),
      beforeMarker.lastIndexOf("project history"),
      beforeMarker.lastIndexOf("relevant project experience"),
      beforeMarker.lastIndexOf("projects/assignments"),
    );
    const numberedEmploymentMarker = /\b\d{1,2}\.\s*$/.test(
      source.slice(Math.max(0, markerIndex - 20), markerIndex),
    );
    if (
      (employmentSection < 0 || projectSection > employmentSection) &&
      !numberedEmploymentMarker
    )
      return;
    const block = source.slice(
      markerIndex,
      companyMarkers[index + 1]?.index ?? source.length,
    );
    const company =
      block.match(
        /^Company\s+Name\s*:\s*([\s\S]{2,140}?)(?=\s+(?:From\s*\/\s*To|Position(?:\s+Title)?|(?:Company\s+)?Industry|Date\s+(?:join(?:ed)?|left))\s*:?\s*)/i,
      )?.[1] || "";
    const title =
      block.match(
        /\bPosition(?:\s+Title)?\s*:?\s*([\s\S]{2,120}?)(?=\s+(?:Responsibilities?|Duties|Job\s+Specialization|Position\s+Level|Industry|From\s*\/\s*To|Date\s+(?:join(?:ed)?|left)|Work\s+(?:Description|description)|Support|Handle|Provide|Manage|$))/i,
      )?.[1] || "";
    const range = block.match(
      /\bFrom\s*\/\s*To\s*:\s*([\s\S]{2,50}?)\s*[-\u2013\u2014]\s*([\s\S]{2,50}?)(?=\s+Position(?:\s+Title)?\s*:|$)/i,
    );
    const joined =
      block.match(
        /\bDate\s+join(?:ed)?\s*:\s*([\s\S]{2,60}?)(?=\s+Date\s+left\s*:)/i,
      )?.[1] || "";
    const left =
      block.match(
        /\bDate\s+left\s*:\s*([\s\S]{2,40}?)(?=\s+(?:Work\s+(?:Description|description)|Duties|Responsibilities?|$))/i,
      )?.[1] || "";
    const prefixRange = source
      .slice(Math.max(0, markerIndex - 90), markerIndex)
      .match(
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*[-\u2013\u2014]\s*(Current|Present)/i,
      );
    const supportedDate = (candidate: string) =>
      clean(candidate)
        .match(
          /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2}|(?:19|20)\d{2}|Present|Current|To date/i,
        )?.[0]
        ?.replace(/To date/i, "Present") || "";
    const start = supportedDate(range?.[1] || joined || prefixRange?.[1] || "");
    const end = supportedDate(range?.[2] || left || prefixRange?.[2] || "");
    const parsed = entry({
      company,
      title,
      start,
      end,
      current: /present|current/i.test(end),
      responsibilities: responsibilitiesBetween(block, 0, block.length),
      sourceRef: `resume.labelledEmployment.${index + 1}`,
      sourceType: "parsed_resume",
      excerpt: block.slice(0, 320),
      confidence: 94,
    });
    // Preserve one explicitly labelled endpoint; do not convert a missing Date
    // left value into Present or borrow a project duration.
    if (parsed?.company && parsed.title && (parsed.start || parsed.end))
      output.push(parsed);
  });
  const priorEmployment = [...output];
  for (const [index, row] of boundedEmploymentBatch(source).entries()) {
    const parsed = entry({...row, allowGroundedEmployerOnly: true, sourceRef: `resume.bounded.${row.group}.${index + 1}`, sourceType: 'parsed_resume', confidence: 94});
    if (!parsed) continue;
    // A new prose/field reader must not resolve conflicting source assertions
    // over a more explicit company/position record or a granular employer history.
    // Keep the existing projection and the untouched source for review.
    const competing = priorEmployment.some(known => {
      const a = monthIndex(known.start), b = monthIndex(known.end, known.current);
      const start = monthIndex(parsed.start), end = monthIndex(parsed.end, parsed.current);
      if (a === null || b === null || start === null || end === null) return false;
      const exactPeriod = a === start && b === end && known.current === parsed.current;
      const differentAssertion = normalized(known.company) !== normalized(parsed.company) || normalized(known.title) !== normalized(parsed.title);
      if (exactPeriod && !differentAssertion) return true;
      // A second reader may retain the location after the same explicit legal
      // employer. Do not duplicate a grounded worked-for statement as a new job.
      if (row.group === 'explicit-sentence' && exactPeriod && normalized(known.title) === normalized(parsed.title) &&
        parsed.company.toLowerCase().startsWith(known.company.toLowerCase() + ',') &&
        known.provenance?.some(ref => ref.sourceRef?.startsWith('resume.flattened.worked-for-legal-employer.'))) return true;
      if (exactPeriod && differentAssertion && known.provenance?.some(ref => (ref.sourceRef?.startsWith('resume.labelledCompany') || ref.sourceRef?.startsWith('resume.labelledEmployerHistory.') || (normalized(known.title) === normalized(parsed.title) && ref.sourceRef?.startsWith('resume.flattened.period-company-designation.'))))) return true;
      return row.group === 'named-employer-fields' && normalized(known.company) === normalized(parsed.company) &&
        !exactPeriod && a >= start && b <= end;
    });
    if (competing) continue;
    // A legal suffix alone is not an employer. Prefer the complete company
    // from the same dated, delimited heading while retaining its provenance.
    const suffixOnly = output.find(known => /^(?:sdn\.?\s*)?bhd\.?$|^(?:inc|ltd)\.?$/i.test(known.company) &&
      normalized(known.title) === normalized(parsed.title) && monthIndex(known.start) === monthIndex(parsed.start) &&
      monthIndex(known.end, known.current) === monthIndex(parsed.end, parsed.current) && known.current === parsed.current &&
      known.provenance?.some(ref => ref.sourceRef?.startsWith('resume.proseEmploymentHeading.') && clean(row.excerpt).toLowerCase().includes(clean(ref.excerpt).toLowerCase())));
    if (suffixOnly) {
      suffixOnly.company = parsed.company;
      suffixOnly.provenance = [...(suffixOnly.provenance || []), ...(parsed.provenance || [])];
      continue;
    }
    const owned = output.find(known => monthIndex(known.start) === monthIndex(parsed.start) &&
      monthIndex(known.end, known.current) === monthIndex(parsed.end, parsed.current) &&
      known.current === parsed.current && known.provenance?.some(ref =>
        (clean(ref.excerpt).toLowerCase().includes(clean(row.excerpt).toLowerCase()) ||
          (normalized(known.title) === normalized(parsed.title) && clean(row.excerpt).toLowerCase().includes(clean(ref.excerpt).toLowerCase())))));
    if (owned) {
      // The same heading may have been read through into a duty sentence.
      // A delimiter-bounded title can trim that explicit narrative suffix.
      if (owned.title.toLowerCase().startsWith(parsed.title.toLowerCase()) &&
        /^\s+(?:(?:Attached to|Participates in|Involved in|Responsible for)\b|Team\s*=)/i.test(owned.title.slice(parsed.title.length))) {
        owned.title = parsed.title;
      }
      owned.provenance = [...(owned.provenance || []), ...(parsed.provenance || [])];
    }
    else output.push(parsed);
  }
  if (!output.length) {
    for (const [index, row] of headedChronologicalEmployment(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.headedChronology.${index + 1}`,
        sourceType: "parsed_resume", confidence: 91 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of headedCareerCards(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.headedCareerCard.${index + 1}`,
        sourceType: "parsed_resume", confidence: 91 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of reversedMonthCareerCards(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.reversedMonthCareerCard.${index + 1}`,
        sourceType: "parsed_resume", confidence: 91 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of boundedCareerSummary(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.boundedCareerSummary.${index + 1}`,
        sourceType: "parsed_resume", confidence: 93 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of boundedEmployerRoleCards(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.boundedEmployerRoleCard.${index + 1}`,
        sourceType: "parsed_resume", confidence: 93 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of boundedCareerTables(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.boundedCareerTable.${index + 1}`,
        sourceType: "parsed_resume", confidence: 93 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of datedRoleCompanyCards(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.datedRoleCompanyCard.${index + 1}`,
        sourceType: "parsed_resume", confidence: 93 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of companyDurationRoleCards(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.companyDurationRoleCard.${index + 1}`,
        sourceType: "parsed_resume", confidence: 93 });
      if (parsed) output.push(parsed);
    }
  }
  if (!output.length) {
    for (const [index, row] of labelledCompanySpells(resumeText).entries()) {
      const parsed = entry({ ...row, sourceRef: `resume.labelledCompanySpell.${index + 1}`,
        sourceType: "parsed_resume", confidence: 94 });
      if (parsed) output.push(parsed);
    }
  }
  return output;
}

export function extractCanonicalEmploymentFromResume(resumeText: string) {
  return canonicalEmploymentTimeline({
    structuredRecords: [],
    resumeText,
    currentRole: { title: "", company: "", location: "", start: "", end: "" },
  });
}

function sameEmployment(
  left: EnterpriseEmployment,
  right: EnterpriseEmployment,
) {
  // A second reader can retain the explicit city in the employer cell while
  // the location-aware reader stores that very city separately. Merge only
  // identical roles and dates; differing titles remain distinct assertions.
  const withoutTrailingCity = (company: string) => company.replace(
    /,\s*(?:Singapore|Kuala Lumpur|Petaling Jaya|Jakarta|Bangkok|Ho Chi Minh City)\s*$/i,
    "",
  );
  const sameCompany = Boolean(
    left.company &&
    right.company &&
    (normalized(left.company) === normalized(right.company) ||
      ((withoutTrailingCity(left.company) !== left.company) !==
        (withoutTrailingCity(right.company) !== right.company) &&
        normalized(withoutTrailingCity(left.company)) ===
          normalized(withoutTrailingCity(right.company)))),
  );
  const sameTitle = Boolean(
    left.title &&
    right.title &&
    normalized(left.title) === normalized(right.title),
  );
  if (!sameCompany) return false;
  const leftStart = monthIndex(left.start);
  const rightStart = monthIndex(right.start);
  const leftEnd = monthIndex(left.end, left.current);
  const rightEnd = monthIndex(right.end, right.current);
  // Opposite partial endpoints do not establish that two rows are the same job.
  // Combining them would manufacture a complete tenure without a shared date.
  if (
    (leftStart !== null && leftEnd === null && rightStart === null && rightEnd !== null) ||
    (rightStart !== null && rightEnd === null && leftStart === null && leftEnd !== null)
  ) return false;
  // Explicitly different dates or titles are conflicting evidence, not duplicates.
  // A one-month tolerance can erase short engagements and promotion boundaries.
  if (leftStart !== null && rightStart !== null && leftStart !== rightStart) return false;
  if (leftEnd !== null && rightEnd !== null && leftEnd !== rightEnd) return false;
  // An undated record cannot identify which dated engagement it belongs to.
  const leftDated = leftStart !== null || leftEnd !== null;
  const rightDated = rightStart !== null || rightEnd !== null;
  if (leftDated !== rightDated) return false;
  // Current and historical assertions must not silently overwrite each other.
  if (left.current !== right.current) return false;
  return sameTitle;
}

function mergeEmployment(
  left: EnterpriseEmployment,
  right: EnterpriseEmployment,
): EnterpriseEmployment {
  const preferred =
    (left.evidenceConfidence || 0) >= (right.evidenceConfidence || 0)
      ? left
      : right;
  const combined = {
    ...preferred,
    company: left.company || right.company,
    title: left.title || right.title,
    location: left.location || right.location,
    companyType: left.companyType || right.companyType,
    modules: [...new Set([...left.modules, ...right.modules])],
    achievements: [
      ...new Set([...left.achievements, ...right.achievements]),
    ].slice(0, 5),
    responsibilities: [
      ...new Set([
        ...(left.responsibilities || left.achievements),
        ...(right.responsibilities || right.achievements),
      ]),
    ].slice(0, 5),
    start: left.start || right.start,
    end: left.end || right.end,
    current: left.current || right.current,
    evidenceConfidence: Math.max(
      left.evidenceConfidence || 0,
      right.evidenceConfidence || 0,
    ),
    linkedProjectIds: [
      ...new Set([
        ...(left.linkedProjectIds || []),
        ...(right.linkedProjectIds || []),
      ]),
    ],
    sourceEmploymentIds: [
      ...new Set([
        ...(left.sourceEmploymentIds || [left.id]),
        ...(right.sourceEmploymentIds || [right.id]),
      ]),
    ].sort(),
    provenance: [
      ...new Map(
        [...(left.provenance || []), ...(right.provenance || [])].map(
          (item) => [
            `${item.sourceType}|${item.sourceRef}|${item.excerpt}`,
            item,
          ],
        ),
      ).values(),
    ],
  };
  return {
    ...combined,
    duration: duration(combined.start, combined.end, combined.current),
  };
}

export function canonicalEmploymentTimeline(input: {
  structuredRecords: readonly SourceRecord[];
  resumeText: string;
  currentRole: CurrentRoleContext;
}) {
  const extracted: EnterpriseEmployment[] = [];
  input.structuredRecords.forEach(({ record, sourceRef }) => {
    const end = value(record, ["end_date", "endDate", "to", "end"]);
    const currentValue = ["current", "is_current", "isCurrent"]
      .map((key) => record[key])
      .find((item) => typeof item === "boolean" || Boolean(clean(item)));
    const parsed = entry({
      company: value(record, [
        "company",
        "employer",
        "organization",
        "organisation",
        "company_name",
      ]),
      title: value(record, ["title", "job_title", "role", "position"]),
      location: value(record, ["country", "location", "city", "region"]),
      companyType: value(record, [
        "company_type",
        "companyType",
        "employment_type",
        "organization_type",
      ]),
      modules: list(record.modules || record.sap_modules || record.sapModules),
      responsibilities: list(
        record.achievements ||
          record.responsibilities ||
          record.description ||
          record.summary,
      ),
      start: value(record, ["start_date", "startDate", "from", "start"]),
      end,
      current:
        currentValue === true ||
        /^(?:true|yes|1)$/i.test(clean(currentValue)) ||
        /^(?:present|current|now)$/i.test(end),
      sourceRef,
      sourceId:
        value(record, ["id", "employment_id", "employmentId"]) || undefined,
      sourceType: "employment",
      confidence: 98,
    });
    if (parsed) extracted.push(parsed);
  });
  extracted.push(...resumeEmployment(input.resumeText));
  const explicitCurrentFieldsOnly =
    !input.resumeText.trim() &&
    Boolean(input.currentRole.title && input.currentRole.company);
  if (
    !extracted.length &&
    ((input.currentRole.start && input.currentRole.end) ||
      explicitCurrentFieldsOnly)
  ) {
    const parsed = entry({
      ...input.currentRole,
      current:
        explicitCurrentFieldsOnly ||
        /^(?:present|current|now)$/i.test(input.currentRole.end),
      sourceRef: "candidate.currentEmployment",
      sourceType: "candidate_field",
      confidence: 80,
    });
    if (parsed) extracted.push(parsed);
  }
  const canonical: EnterpriseEmployment[] = [];
  for (const candidate of extracted) {
    const index = canonical.findIndex((existing) =>
      sameEmployment(existing, candidate),
    );
    if (index < 0) canonical.push(candidate);
    else canonical[index] = mergeEmployment(canonical[index], candidate);
  }
  return canonical
    .map((record) => ({
      ...record,
      id:
        record.sourceEmploymentIds?.length === 1 &&
        !record.sourceEmploymentIds[0].includes(".")
          ? record.sourceEmploymentIds[0]
          : `canonical-employment-${stableHash([normalized(record.company), normalized(record.title), record.start.toLowerCase(), record.end.toLowerCase()].join("|"))}`,
    }))
    .sort((left, right) => {
      const leftEnd =
        monthIndex(left.end, left.current) ?? monthIndex(left.start) ?? -1;
      const rightEnd =
        monthIndex(right.end, right.current) ?? monthIndex(right.start) ?? -1;
      return (
        rightEnd - leftEnd ||
        (monthIndex(right.start) ?? -1) - (monthIndex(left.start) ?? -1) ||
        left.id.localeCompare(right.id)
      );
    });
}

function rangeContains(
  employment: EnterpriseEmployment,
  project: EnterpriseProject,
) {
  const employmentStart = monthIndex(employment.start);
  const employmentEnd = monthIndex(employment.end, employment.current);
  const projectStart = monthIndex(project.start);
  const projectEnd = monthIndex(project.end);
  return (
    employmentStart !== null &&
    employmentEnd !== null &&
    projectStart !== null &&
    projectEnd !== null &&
    employmentStart <= employmentEnd &&
    projectStart <= projectEnd &&
    projectStart >= employmentStart &&
    projectEnd <= employmentEnd
  );
}

function containsNormalizedPhrase(text: string, phrase: string) {
  const key = normalized(phrase);
  return Boolean(key && ` ${normalized(text)} `.includes(` ${key} `));
}

export function linkProjectsToEmployment(
  timeline: readonly EnterpriseEmployment[],
  projects: readonly EnterpriseProject[],
) {
  return timeline.map((employment) => {
    const linkedProjectIds = projects
      .filter((project) => {
        if (!rangeContains(employment, project)) return false;
        // An explicit employer takes precedence over role or narrative similarity.
        // Client names and nested-project provenance cannot override this boundary.
        if (clean(project.employer)) {
          const projectEmployer = normalized(project.employer);
          return Boolean(
            projectEmployer && projectEmployer === normalized(employment.company),
          );
        }
        const projectText = [
          project.name,
          project.role,
          project.environment,
          ...project.responsibilities,
        ].join(" ");
        const explicitlyNamesEmployer = containsNormalizedPhrase(
          projectText,
          employment.company,
        );
        const compatibleRole = Boolean(
          employment.title &&
          project.role &&
          (containsNormalizedPhrase(project.role, employment.title) ||
            containsNormalizedPhrase(employment.title, project.role)),
        );
        const employmentSourceIndexes = new Set(
          (employment.provenance || []).flatMap(
            (item) =>
              (item.sourceRef || "").match(
                /^resume\.professionalExperience\.(\d+)/,
              )?.[1] || [],
          ),
        );
        const projectSourceIndexes = new Set(
          Object.values(project.fieldEvidence)
            .flatMap((field) => field?.provenance || [])
            .flatMap(
              (item) =>
                (item.sourceRef || "").match(
                  /^resume\.inlineClientAssignments\.(\d+)\./,
                )?.[1] || [],
            ),
        );
        const explicitlyNestedInEmployment = [...projectSourceIndexes].some(
          (index) => employmentSourceIndexes.has(index),
        );
        return (
          Boolean(employment.company && explicitlyNamesEmployer) ||
          compatibleRole ||
          explicitlyNestedInEmployment
        );
      })
      .map((project) => project.id);
    return {
      ...employment,
      linkedProjectIds: [...new Set(linkedProjectIds)].sort(),
    };
  });
}

export function employmentTimelineDiagnostics(
  timeline: readonly EnterpriseEmployment[],
) {
  const malformed = timeline.filter((item) =>
    narrativeEmployment.test(`${item.title} ${item.company}`),
  ).length;
  const duplicateKeys = timeline.map(
    (item) =>
      `${normalized(item.company)}|${normalized(item.title)}|${item.start}|${item.end}`,
  );
  let invalidRanges = 0;
  for (const item of timeline) {
    const hasCompleteRange = Boolean(item.start && (item.end || item.current));
    if (hasCompleteRange && !supportedRange(item.start, item.end, item.current))
      invalidRanges += 1;
  }
  return {
    records: timeline.length,
    companyComplete: timeline.filter((item) => Boolean(item.company)).length,
    titleComplete: timeline.filter((item) => Boolean(item.title)).length,
    dateRangeComplete: timeline.filter((item) =>
      supportedRange(item.start, item.end, item.current),
    ).length,
    currentEmployerComplete: timeline.some(
      (item) => item.current && Boolean(item.company),
    ),
    malformedNarrativeRecords: malformed,
    duplicateRecords: duplicateKeys.length - new Set(duplicateKeys).size,
    invalidRanges,
  };
}
