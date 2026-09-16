import { careerMonthIndex } from "./candidateCareerExperience";

// These readers use explicit syntax, not company-name dictionaries or proximity
// to arbitrary dates. Input may have lost every PDF line break.
export type FlattenedEmployment = {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  excerpt: string;
  group: string;
};
const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const date = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?${month}[. -]*[’']?\\s*(?:19|20)\\d{2}`;
const ongoing =
  "(?:(?:till|until|to)\\s+(?:date|now|today|present)|present|current|now|ongoing)";
const range = `(${date})\\s*(?:[-–—]|to|until|till)\\s*(${date}|${ongoing})`;
const job =
  "(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Expert)";
const title = `[^:;|]{0,110}?\\b${job}(?:\\s*\\([^)]{1,40}\\))?`;
const company = "[^:;|]{2,120}?";
const forbidden =
  /\b(?:client|customer|project|responsibilities|duties|summary|education|skills|references|referrals|confidential|unknown)\b/i;
const cleanDate = (value: string) =>
  new RegExp(`^${ongoing}$`, "i").test(value)
    ? "Present"
    : value
        .replace(/(\d)(?:st|nd|rd|th)\b/i, "$1")
        .replace(/[.’'-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export function flattenedEmployment(source: string): FlattenedEmployment[] {
  const result: FlattenedEmployment[] = [];
  const add = (
    employer: string,
    role: string,
    start: string,
    end: string,
    excerpt: string,
    group: string,
  ) => {
    employer = employer.trim().replace(/[, ]+$/, "");
    role = role.trim().replace(/\s+\((?:promoted|contract|permanent)\)$/i, "");
    start = cleanDate(start);
    end = cleanDate(end);
    const current = end === "Present";
    const a = careerMonthIndex(start),
      b = careerMonthIndex(end, current);
    if (
      a === null ||
      b === null ||
      b < a ||
      forbidden.test(employer) ||
      employer.length > 120 ||
      /\b(?:worked|working|from|since|as|at)\b/i.test(employer) ||
      new RegExp(`\\b${job}\\b`, "i").test(employer) ||
      (role &&
        (new RegExp(date, "i").test(role) ||
          !new RegExp(`\\b${job}\\b`, "i").test(role) ||
          /\b(?:client|customer|responsibilities|duties)\b/i.test(role)))
    )
      return;
    result.push({
      company: employer,
      title: role,
      start,
      end,
      current,
      excerpt,
      group,
    });
  };
  const headings = [
    ...source.matchAll(
      /\b(?:employment history|career history|working experiences?|work experience|professional experience)\s*:?\s*/gi,
    ),
  ];
  for (const [i, heading] of headings.entries()) {
    if (
      /\b(?:project|client|customer)\s+$/i.test(source.slice(0, heading.index))
    )
      continue;
    const section = source
      .slice((heading.index || 0) + heading[0].length, headings[i + 1]?.index)
      .split(
        /\b(?:project experience|project history|project details|projects\/assignments|education|qualifications|certifications|technical skills|references|referrals)\b|\b(?:Projects?|Client|Customer)\s*:/i,
      )[0];
    // "Worked with Employer as Role from ..." and the inverse order. Require
    // the employment verb; project delivery and "for client" are not aliases.
    const statements = [
      {
        re: new RegExp(
          `\\b(?:Worked|Working|Currently working)\\s+(?:with|in|at)\\s+(${company})\\s+as\\s+(?:an?\\s+)?(${title})(?:\\s+\\(contract\\))?\\s+from\\s+${range}(?=[.;]|\\s|$)`,
          "gi",
        ),
        fields: [1, 2, 3, 4],
      },
      {
        re: new RegExp(
          `\\b(?:Worked|Working|Currently working)\\s+as\\s+(?:an?\\s+)?(${title})\\s+(?:with|in|at)\\s+(${company})\\s*(?:from\\s+|[-–—]\\s*)${range}(?=[.;]|\\s|$)`,
          "gi",
        ),
        fields: [2, 1, 3, 4],
      },
    ];
    for (const { re, fields: f } of statements)
      for (const m of section.matchAll(re)) {
        add(m[f[0]], m[f[1]], m[f[2]], m[f[3]], m[0], "employment-statement");
      }
    // Only the first heading of a narrative section is eligible. Comma/pipe/at
    // delimiters distinguish company from role without guessing word boundaries.
    const headingPatterns = [
      {
        re: new RegExp(
          `^(${company})\\s*[,|]\\s*(${title})\\s+\\(?${range}\\)?(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [1, 2, 3, 4],
      },
      {
        re: new RegExp(
          `^(${title})\\s+(?:at\\s+|\\|\\s*)(${company})(?:\\s*\\|\\s*(?:Contract\\s*\\|\\s*)?|\\s+\\()${range}\\)?(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [2, 1, 3, 4],
      },
    ];
    for (const { re, f } of headingPatterns) {
      const m = section.match(re);
      if (m) add(m[f[0]], m[f[1]], m[f[2]], m[f[3]], m[0], "delimited-heading");
    }
    // Compact date-first ledgers must parse consecutively from the heading.
    // Never skip failed cells or resume in the project narrative that follows.
    let ledger = section.replace(/^From\s+To\s+Company and Title\s+/i, "");
    const table = ledger !== section;
    const dates = table ? `(${date})\\s+(${date}|${ongoing})` : range;
    const datePrefix = new RegExp(`^${dates}\\s+`, "i");
    for (;;) {
      const d = ledger.match(datePrefix);
      if (!d) break;
      const rest = ledger.slice(d[0].length);
      const next = rest.search(new RegExp(`\\s+${date}`, "i"));
      const cell = (next < 0 ? rest : rest.slice(0, next))
        .replace(/\s+Summary\b[\s\S]*$/i, "")
        .trim();
      const m = cell.match(
        new RegExp(
          `^([^|:;]{2,100}?)\\s+[-–—]\\s+(${title}(?:\\s+[IVX]{1,3})?)(?:\\s+\\(promoted\\))?$`,
          "i",
        ),
      );
      if (!m) break;
      add(m[1], m[2], d[1], d[2], d[0] + cell, "dated-ledger");
      if (next < 0) break;
      ledger = rest.slice(next).trim();
    }
  }
  // Explicit Employer plus its own parenthesized tenure is valid even when
  // followed by a project. The project's role must remain unassigned here.
  const beforeReferences = source.split(/\b(?:references|referrals)\b/i)[0];
  const labelled = new RegExp(
    `\\bEmployer\\s*:\\s*(${company})\\s+\\(${range}\\)(?=\\s+(?:Client|Project|Role|Position)\\s*:|[.;]|$)`,
    "gi",
  );
  for (const m of beforeReferences.matchAll(labelled))
    add(m[1], "", m[2], m[3], m[0], "explicit-employer-tenure");
  // An Organization field with its tenure before Position and Project/Task.
  // The latter is an explicit stop, not a source of dates or role text.
  const organization = new RegExp(
    `\\bOrgani[sz]ation\\s*:\\s*(${company})\\s+${range}\\s+Position\\s*:\\s*([^:;]{2,110}?)(?=\\s+(?:Project\\s*[/]\\s*Task|Experience|Responsibilities)\\s*:)`,
    "gi",
  );
  for (const m of beforeReferences.matchAll(organization))
    add(m[1], m[4], m[2], m[3], m[0], "explicit-employer-tenure");
  return result.filter(
    (row, index) =>
      result.findIndex(
        (other) =>
          other.company === row.company &&
          other.title === row.title &&
          other.start === row.start &&
          other.end === row.end &&
          other.current === row.current,
      ) === index,
  );
}
