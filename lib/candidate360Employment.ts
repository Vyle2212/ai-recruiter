import type {
  EnterpriseEmployment,
  EnterpriseProject,
  EvidenceRef,
} from "./candidate360SchemaNormalize";
import { cleanEmploymentResponsibilities } from "./candidateProfilePresentation";
import type { Candidate360Profile } from "./candidate360Types";

export const CANDIDATE_EMPLOYMENT_TIMELINE_VERSION =
  "candidate-employment-v21-role-scoped-responsibilities";

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
    .replace(/[+()\d][\d\s()+.-]{7,}.*$/, "")
    .replace(/\s+at\s+.+$/i, "")
    .trim();
  if (!title || title.length > 120 || narrativeEmployment.test(title))
    return "";
  if (/^[^A-Za-z0-9]+/.test(title)) return "";
  if (
    /^(?:com|www|https?|mailto|e-?mail|phone|mobile|contact|or\s+position\s+held\b)/i.test(
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
  if (!company || company.length > 140 || narrativeEmployment.test(company))
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
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (current || /^(?:present|current|now)$/i.test(input.trim()))
    return currentMonth;
  const source = input.trim();
  const numeric = source.match(/^((?:19|20)\d{2})(?:[-/](0?[1-9]|1[0-2]))?$/);
  if (numeric)
    return Number(numeric[1]) * 12 + (numeric[2] ? Number(numeric[2]) - 1 : 0);
  const named = source.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2})\b/i,
  );
  if (named)
    return Number(named[2]) * 12 + monthNames.indexOf(named[1].toLowerCase());
  const timestamp = Date.parse(source);
  if (Number.isNaN(timestamp)) return null;
  const parsed = new Date(timestamp);
  const result = parsed.getUTCFullYear() * 12 + parsed.getUTCMonth();
  return result <= currentMonth ? result : null;
}

function supportedRange(start: string, end: string, current: boolean) {
  const from = monthIndex(start);
  const to = monthIndex(end, current);
  return from !== null && to !== null && from <= to;
}

function duration(start: string, end: string, current: boolean) {
  const from = monthIndex(start);
  const to = monthIndex(end, current);
  if (from === null || to === null || to < from) return "";
  const months = to - from;
  if (months < 1) return "Less than 1 month";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return [
    years ? `${years} year${years === 1 ? "" : "s"}` : "",
    remainder ? `${remainder} month${remainder === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
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
}): EnterpriseEmployment | null {
  const company = validEmploymentCompany(input.company);
  const title = validEmploymentTitle(input.title);
  const start = clean(input.start);
  const end = clean(input.end);
  const current =
    input.current === true || /^(?:present|current|now)$/i.test(end);
  const hasGroundedRange = supportedRange(start, end, current);
  if (!(company && title)) return null;
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
    start: hasGroundedRange ? start : "",
    end: hasGroundedRange ? end : "",
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
        /^.*\b(?:professional experience|employment history|work(?:\s+and|\s*&)?\s+project experience)\b\s*/i,
        "",
      )
      .split(/\.\s+/)
      .at(-1),
  );
}

function resumeEmployment(resumeText: string) {
  const output: EnterpriseEmployment[] = [];
  const source = resumeText
    .normalize("NFKC")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
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
      title: match[3].replace(
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
      beforeMarker.lastIndexOf("relevant project experience"),
      beforeMarker.lastIndexOf("relevant project experince"),
      beforeMarker.lastIndexOf("projects/assignments involved"),
    );
    const employmentSection = Math.max(
      beforeMarker.lastIndexOf("employment history"),
      beforeMarker.lastIndexOf("working experience"),
      beforeMarker.lastIndexOf("professional experience"),
      beforeMarker.lastIndexOf("employment & experience"),
    );
    if (projectSection > employmentSection) return;
    if (
      /\b(?:Project Experience|Projects?\s*\/\s*Assignments? Involved)\s*\d*\)?\s*$/i.test(
        prefix,
      )
    )
      return;
    const company =
      block.match(
        /^Company\s*:\s*([\s\S]{2,140}?)(?=\s+(?:Duration|(?:Job\s+)?Position)\s*:)/i,
      )?.[1] || "";
    const title =
      block.match(
        /\b(?:Job\s+)?Position\s*:\s*([\s\S]{2,140}?)(?=\s+(?:Speciali[sz]ation|Duration|Job\s+Scopes?|Specific\s+Responsibilities|Responsibilities|Tasks?|Background|Project|Client)\s*:?\s|\s*\(|[.;]|$)/i,
      )?.[1] || "";
    const durationRange = block.match(
      new RegExp(
        `\\bDuration\\s*:\\s*(${looseMonthYear})\\s*(?:[-\\u2013\\u2014]|to|until)\\s*(${looseMonthYear}|Present|Current)`,
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
      /\b(?:duration|client|project)\s*:/i.test(company)
    )
      return;
    const start = normalizeDate(range[1]);
    const end = normalizeDate(range[2]);
    const parsed = entry({
      company,
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
      title: match[1],
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

  const companyRole = new RegExp(
    `((?:PT\\.?|CV\\.?|[A-Z])[A-Za-z0-9.&/', +\\-]{2,120}?)\\s*\\((${date})\\s*[—–-]\\s*(${date}|Present|Current)\\)\\s*(?:As|Position\\s*:)\\s*([^]{2,120}?)(?=\\s+(?:Summary|Responsibilities?|${date}|(?:PT\\.?|CV\\.?)\\s+[A-Z]|Industry\\s*\\(Project\\)|Education|Project Experience|$))`,
    "gi",
  );
  const companyMatches = [...source.matchAll(companyRole)];
  companyMatches.forEach((match, index) => {
    const sourceEnd = companyMatches[index + 1]?.index ?? source.length;
    const parsed = entry({
      company: resumeCompany(match[1]),
      start: match[2],
      end: match[3],
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
  [...source.matchAll(titleAtCompany)].forEach((match, index) => {
    const parsed = entry({
      title: resumeRole(match[1]),
      company: resumeCompany(match[2]),
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
    const block = source.slice(
      markerIndex,
      companyMarkers[index + 1]?.index ?? source.length,
    );
    const company =
      block.match(
        /^Company\s+Name\s*:\s*([\s\S]{2,140}?)(?=\s+(?:From\s*\/\s*To|Position(?:\s+Title)?|Industry|Date\s+(?:joined|left))\s*:?\s*)/i,
      )?.[1] || "";
    const title =
      block.match(
        /\bPosition(?:\s+Title)?\s*:?\s*([\s\S]{2,120}?)(?=\s+(?:Responsibilities?|Duties|Industry|From\s*\/\s*To|Date\s+(?:joined|left)|Work\s+(?:Description|description)|Support|Handle|Provide|Manage|$))/i,
      )?.[1] || "";
    const range = block.match(
      /\bFrom\s*\/\s*To\s*:\s*([\s\S]{2,50}?)\s*[-\u2013\u2014]\s*([\s\S]{2,50}?)(?=\s+Position(?:\s+Title)?\s*:|$)/i,
    );
    const joined =
      block.match(
        /\bDate\s+joined\s*:\s*([\s\S]{2,60}?)(?=\s+Date\s+left\s*:)/i,
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
    if (parsed?.company && parsed.title && parsed.start && parsed.end)
      output.push(parsed);
  });
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
  const sameCompany = Boolean(
    left.company &&
    right.company &&
    normalized(left.company) === normalized(right.company),
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
  if (
    leftStart !== null &&
    rightStart !== null &&
    Math.abs(leftStart - rightStart) > 1
  )
    return false;
  if (leftEnd !== null && rightEnd !== null && Math.abs(leftEnd - rightEnd) > 1)
    return false;
  if (sameTitle) return true;
  const leftTitleTokens = new Set(
    normalized(left.title).split(" ").filter(Boolean),
  );
  const rightTitleTokens = new Set(
    normalized(right.title).split(" ").filter(Boolean),
  );
  const overlap =
    [...leftTitleTokens].filter((item) => rightTitleTokens.has(item)).length /
    Math.max(1, Math.min(leftTitleTokens.size, rightTitleTokens.size));
  return (
    leftStart !== null &&
    rightStart !== null &&
    leftEnd !== null &&
    rightEnd !== null &&
    Math.abs(leftStart - rightStart) <= 1 &&
    Math.abs(leftEnd - rightEnd) <= 1 &&
    overlap >= 0.7
  );
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
    const currentValue = value(record, ["current", "is_current", "isCurrent"]);
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
        /^(?:true|yes|1)$/i.test(currentValue) ||
        /present|current|now/i.test(end),
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
    projectStart >= employmentStart &&
    projectEnd <= employmentEnd
  );
}

export function linkProjectsToEmployment(
  timeline: readonly EnterpriseEmployment[],
  projects: readonly EnterpriseProject[],
) {
  return timeline.map((employment) => {
    const linkedProjectIds = projects
      .filter((project) => {
        if (!rangeContains(employment, project)) return false;
        const projectText = [
          project.name,
          project.role,
          project.environment,
          ...project.responsibilities,
        ].join(" ");
        const explicitlyNamesEmployer = normalized(projectText).includes(
          normalized(employment.company),
        );
        const compatibleRole = Boolean(
          employment.title &&
          project.role &&
          (normalized(project.role).includes(normalized(employment.title)) ||
            normalized(employment.title).includes(normalized(project.role))),
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
  for (const item of timeline)
    if (
      (item.start || item.end) &&
      !supportedRange(item.start, item.end, item.current)
    )
      invalidRanges += 1;
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
