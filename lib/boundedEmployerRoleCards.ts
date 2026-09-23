import { careerMonthIndex } from "./candidateCareerExperience";

export type BoundedEmployerRoleCard = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `${month}\\s*(?:19|20)\\d{2}`;
const end = `(?:${date}|Present|Current|Now|Till\\s+(?:to\\s+)?date)`;
const role = "(?:Manager|Consultant|Lead|Analyst|Associate|Engineer|Specialist|Architect|Developer|Coordinator)";

function add(
  jobs: BoundedEmployerRoleCard[],
  companyInput: string,
  titleInput: string,
  startInput: string,
  endInput: string,
  excerpt: string,
) {
  const company = companyInput.replace(/[,;.\s]+$/g, "").trim();
  const title = titleInput.replace(/^[,;.\s–—-]+|[,;.\s–—-]+$/g, "").trim();
  const normalizeDate = (value: string) => value.replace(/([A-Za-z])((?:19|20)\d{2})\b/g, "$1 $2").replace(/\s+/g, " ").trim();
  const start = normalizeDate(startInput);
  const finish = normalizeDate(endInput);
  const normalizedEnd = /^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(finish)
    ? "Present" : finish;
  const first = careerMonthIndex(start);
  const last = careerMonthIndex(normalizedEnd, normalizedEnd === "Present");
  if (!company || !title || company.length > 95 || title.length > 90 || first === null ||
    last === null || first > last ||
    /\b(?:client|customer|project|payroll|university|education|responsibilities)\b/i.test(company) ||
    /\b(?:client|customer|project\s*#|responsibilities|description)\b/i.test(title) ||
    !new RegExp(`\\b${role}\\b`, "i").test(title)) return;
  jobs.push({ company, title, start, end: normalizedEnd, excerpt: excerpt.slice(0, 300) });
}

/** Each card must contain its own employer, role, and complete period.
 * Project/client fields, dates in duties, and nearby cards never fill a gap. */
export function boundedEmployerRoleCards(input: string): BoundedEmployerRoleCard[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const jobs: BoundedEmployerRoleCard[] = [];

  // Project-detail CVs may have a contract employer in a role @ employer card.
  // The date must be inside that card's parentheses and followed by its duty label.
  const atSection = /\bWORK EXPERIENCE\s*&\s*PROJECT DETAILS\s*:/i.exec(text);
  if (atSection) {
    const section = text.slice(atSection.index + atSection[0].length, atSection.index + atSection[0].length + 15500)
      .split(/\b(?:QUALIFICATION|EDUCATION|CERTIFICATION)\s*:/i)[0];
    const atCard = new RegExp(
      `\\b((?:(?:Sr\\.?|Senior|Assistant|SAP|APAC|PS|PPM|PM|FI|CO|FICO|HCM|Global|Solution|Functional|Project|System|Technical|Design|IT|${role})\\s*[/&()–—-]?\\s*){1,10})@\\s*([^@()]{2,95}?(?:\\([^)]{2,35}\\)[^@()]{0,35}?)?)\\s*\\(\\s*(?:[^()]{0,35}?[,;]\\s*)?(${date})\\s*[-–—]\\s*(${end})\\s*\\)\\s+Key Roles?\\s*,?\\s*Responsibilities\\s*&\\s*Scope\\s*:`,
      "gi",
    );
    for (const match of section.matchAll(atCard)) {
      const employer = match[2].replace(/,\s*(?:Malaysia|India|UAE|Qatar)\s*$/i, "");
      add(jobs, employer, match[1], match[3], match[4], match[0]);
    }
  }

  // Flattened bullet CV: each bullet starts with a role and employer, followed
  // by an explicit city/country and period. Never consume a duty bullet as a row.
  const workSection = /\bWORK EXPERIENCE\b(?!\s*&)/i.exec(text);
  if (workSection) {
    const section = text.slice(workSection.index, workSection.index + 12500)
      .split(/\b(?:EDUCATION|CERTIFICATIONS|ACADEMIC QUALIFICATIONS)\b/i)[0];
    const bulletCard = new RegExp(
      `(?:WORK EXPERIENCE|)\\s+((?:[A-Za-z/&.-]+\\s+){0,5}${role}(?:\\s*,\\s*[A-Za-z]+\\s+[A-Za-z]+|\\s*[–—-]\\s*Software\\s+Testing)?)\\s+([A-Z][A-Za-z&.' -]{1,60}?)\\s*,+\\s*(?:[A-Z][A-Za-z ]{2,35},\\s*){1,3}(?:Malaysia|India|UAE|Qatar)(?:\\s*&\\s*[A-Z][A-Za-z ]{2,35},\\s*India)?\\s+(${date})\\s*[-–—]\\s*(${end})\\b`,
      "gi",
    );
    for (const match of section.matchAll(bulletCard))
      add(jobs, match[2], match[1], match[3], match[4], match[0]);

    // Employer – location Duration period Role Project#: the Project# boundary
    // prevents an assignment's own Duration from becoming employer tenure.
  }
  return jobs.filter((job, index) => jobs.findIndex(other =>
    [other.company, other.title, other.start, other.end].join("|").toLowerCase() ===
    [job.company, job.title, job.start, job.end].join("|").toLowerCase()) === index);
}
