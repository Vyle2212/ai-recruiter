import { careerMonthIndex } from "./candidateCareerExperience";

export type BoundedCareerSummaryJob = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `${month}\\s*(?:[-–—]\\s*)?(?:19|20)\\d{2}`;
const endDate = `(?:${date}|Present|Current|Now|till\\s+(?:to\\s+)?date|Onwards?)`;
const roleEnd =
  "(?:Consultant|Manager|Lead|Analyst|Engineer|Developer|Specialist|Tester|Architect|Officer|Executive|Coordinator|Apprentice|Accountant)";
const legal =
  "(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Pty\\.?\\s*Ltd\\.?|Berhad|LLC|JSC|Ltd\\.?|Inc\\.?)";
const stop =
  /\b(?:Education|Academic Qualifications|References|Certifications|Project Experience|Project Details|Handled Project Details|Detailed Work Experience|Languages|Hobbies)\b/i;

function normalizeDate(value: string) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/([A-Za-z]+)\s*[-–—]\s*((?:19|20)\d{2})/, "$1 $2")
    .trim();
  return /^(?:till\s+(?:to\s+)?date|onwards?|present|current|now)$/i.test(
    cleaned,
  )
    ? "Present"
    : cleaned;
}

function cleanCompany(value: string) {
  return value
    .replace(/^[\d.)\s]+/, "")
    .replace(/\s*,\s*(?:Kuala Lumpur|Mumbai|Melaka|Malaysia|India|Selangor(?: Darul Ehsan)?)(?:\s*,\s*(?:Malaysia|India))?\.?$/i, "")
    .replace(/[.,;:\s]+$/, "")
    .trim();
}

function cleanTitle(value: string) {
  return value.replace(/^[|,:;–—\s-]+|[|,:;–—.\s-]+$/g, "").trim();
}

function accepted(
  companyInput: string,
  titleInput: string,
  startInput: string,
  endInput: string,
  excerpt: string,
  allowMissingEnd = false,
): BoundedCareerSummaryJob | null {
  const company = cleanCompany(companyInput);
  const title = cleanTitle(titleInput);
  const start = normalizeDate(startInput);
  const end = normalizeDate(endInput);
  const first = careerMonthIndex(start);
  const last = end ? careerMonthIndex(end, end === "Present") : null;
  if (
    !company ||
    !title ||
    company.length > 110 ||
    title.length > 105 ||
    first === null ||
    (!allowMissingEnd && last === null) ||
    (last !== null && first > last) ||
    /\b(?:client|customer|project|payroll|university|college|school|responsibilit|industry)\b/i.test(
      company,
    ) ||
    /\b(?:project name|responsibilit|job description)\b/i.test(title) ||
    /\b(?:participate[ds]?|supported|configured|trained|provided|worked)\b/i.test(title) ||
    !new RegExp(`\\b${roleEnd}\\b`, "i").test(title)
  )
    return null;
  return { company, title, start, end, excerpt: excerpt.slice(0, 300) };
}

function sectionAfter(text: string, heading: RegExp, max = 5000) {
  const match = heading.exec(text);
  if (!match) return "";
  const raw = text.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + max);
  const boundary = raw.search(stop);
  return raw.slice(0, boundary < 0 ? raw.length : boundary);
}

/**
 * Recover repeated career-summary rows only when each row owns its employer,
 * role and complete period. The readers are section bounded and never use
 * dates from duties, projects, clients or the following row.
 */
export function boundedCareerSummary(input: string): BoundedCareerSummaryJob[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const jobs: BoundedCareerSummaryJob[] = [];
  const add = (match: RegExpMatchArray, company: string, title: string, start: string, end: string, allowMissingEnd = false) => {
    const row = accepted(company, title, start, end, match[0], allowMissingEnd);
    if (row) jobs.push(row);
  };

  // WORK SUMMARY: Employer – Role (Month Year to Month Year/Present).
  const summary = sectionAfter(text, /\bWORK SUMMARY\b/i, 2600);
  const companyRole = new RegExp(
    `(?:^\\s*|(?<=\\))\\.?\\s+)([A-Z][A-Za-z0-9&.'() -]{2,105}?)\\s*[–—-]\\s*((?:[A-Za-z0-9/&.+()-]+\\s+){0,9}${roleEnd})\\s*\\(\\s*(${date})\\s*(?:[-–—]|to)\\s*(${endDate})\\s*\\)`,
    "gi",
  );
  for (const match of summary.matchAll(companyRole))
    add(match, match[1], match[2], match[3], match[4]);

  // CAREER PROGRESSION: Employer, optional location - period Role.
  const progression = sectionAfter(text, /\bCAREER PROGRESSION\b/i, 3500);
  const progressionPeriod = new RegExp(
    `[-–—]\\s*(${date})\\s*[-–—]\\s*(${endDate})`,
    "gi",
  );
  const progressionPeriods = [...progression.matchAll(progressionPeriod)];
  let progressionCursor = 0;
  for (const [index, match] of progressionPeriods.entries()) {
    const companyCell = progression
      .slice(progressionCursor, match.index)
      .replace(/^\s+|\s+$/g, "")
      .split(",")[0];
    const after = progression.slice(
      (match.index || 0) + match[0].length,
      progressionPeriods[index + 1]?.index ?? progression.length,
    );
    const role = after.match(
      new RegExp(
        `^\\s*((?:[A-Za-z0-9/&.+()-]+\\s+){0,10}?${roleEnd}(?:\\s+(?:[–—&/]|SAP|S4|HANA|FI|CO|FICO|MM|SD|PP|PS|PM|BW|ABAP|IT|ERP|Project|Management|Solution)){0,10})`,
        "i",
      ),
    );
    if (!role) continue;
    add(match, companyCell, role[1], match[1], match[2]);
    progressionCursor = (match.index || 0) + match[0].length + role[0].length;
  }

  // EXPERIENCES: Role – legal employer (period). A legal suffix and the
  // parentheses are required because prose in this section can mention clients.
  const experiences = sectionAfter(text, /\bEXPERIENCES\b/i, 5000);
  const roleCompany = new RegExp(
    `(?:^\\s*|[.!?]\\s+)((?:[A-Za-z0-9/&.+()-]+\\s+){0,8}${roleEnd}(?:\\s+(?:MIS|SAP|FICO|FI|CO|MM|PS|PM|SD|ABAP|IT|ERP|[–—-])){0,4})\\s+([A-Z][A-Za-z0-9&.'() -]{2,100}?\\b${legal})\\s*\\(\\s*(${date})\\s*(?:[-–—]|to)\\s*(${endDate})\\s*\\)`,
    "gi",
  );
  for (const match of experiences.matchAll(roleCompany))
    add(match, match[2], match[1], match[3], match[4]);

  // PROFESSIONAL BACKGROUND: numbered Employer. Position Title / Date Joined /
  // Date Left fields. "Joined Since" explicitly supports an open-ended spell.
  const background = sectionAfter(text, /\bPROFESSIONAL BACKGROUND\b/i, 6500);
  const cards = [...background.matchAll(/(?:^|\s)(\d{1,2})\.\s+/g)];
  for (const [index, marker] of cards.entries()) {
    const card = background.slice((marker.index || 0) + marker[0].length, cards[index + 1]?.index ?? background.length);
    const fields = card.match(new RegExp(
      `^(.{2,150}?)\\.\\s*Position Title\\s*:\\s*(.{2,105}?)\\s+(Joined Since|Date Joined)\\s*:\\s*(${date})(?:\\s*\\([^)]{1,80}\\))?(?:\\s+Date Left\\s*:\\s*(${endDate}))?\\s+Job Description\\s*:`,
      "i",
    ));
    if (!fields || (fields[3].toLowerCase() === "date joined" && !fields[5])) continue;
    const end = fields[5] || "";
    const fakeMatch = [fields[0]] as unknown as RegExpMatchArray;
    add(fakeMatch, fields[1], fields[2], fields[4], end, fields[3].toLowerCase() === "joined since");
  }

  return jobs.filter((job, index, all) =>
    all.findIndex(other =>
      other.company.toLowerCase() === job.company.toLowerCase() &&
      other.title.toLowerCase() === job.title.toLowerCase() &&
      other.start.toLowerCase() === job.start.toLowerCase() &&
      other.end.toLowerCase() === job.end.toLowerCase(),
    ) === index,
  );
}
