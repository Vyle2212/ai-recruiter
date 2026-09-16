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
  "(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Expert|Controller|Coordinator)";
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
      new RegExp(date, "i").test(employer) ||
      employer.length > 120 ||
      /\b(?:worked|working|from|since|as|at)\b/i.test(employer) ||
      new RegExp(`\\b${job}\\b`, "i").test(employer) ||
      (role &&
        (new RegExp(date, "i").test(role) ||
          !new RegExp(`\\b${job}\\b`, "i").test(role) ||
          /\b(?:client|customer|responsibilities|duties|being|worked|working|responsible|involved|performed|handled|about)\b/i.test(
            role,
          )))
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
  // Roman prefixes are ambiguous company initials unless repeated headings
  // establish an ordered I / II / III sequence. "I1" is retained only as the
  // first enumerator in that sequence (a common flattened/OCR list artifact).
  const enumerated = new Set<number>();
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const markerAt = (i: number) =>
    headings[i] &&
    source
      .slice((headings[i].index || 0) + headings[i][0].length)
      .match(/^(I1|[IVX]+)\s+/)?.[1];
  for (let i = 0; i < headings.length - 1; i++) {
    if (!/^(?:I|I1)$/.test(markerAt(i) || "") || markerAt(i + 1) !== "II")
      continue;
    enumerated.add(i);
    for (let j = 1; j < roman.length && markerAt(i + j) === roman[j]; j++)
      enumerated.add(i + j);
  }
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
    // Legal suffixes and explicit field labels supply boundaries lost when a
    // PDF is flattened. Never continue searching inside responsibility prose.
    const legal =
      "[A-Z0-9][A-Za-z0-9&.,'() /-]{1,100}?\\b(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Private Limited|Corporation|Berhad|Limited|Ltd\\.?|Inc\\.?)";
    const roleEnd =
      "(?=\\s+(?:Job (?:Functions|responsibilities)|Responsibilities|Main Duties|Task\\s*[/]|[•●◼➢⮚]|Hands-on)|$)";
    const boundedRole = `([^:;]{2,110}?)${roleEnd}`;
    const labelledHeading = enumerated.has(i)
      ? section.replace(/^(?:I1|[IVX]+)\s+/, "")
      : section.replace(/^\d{1,2}[.)]\s*/, "");
    const fieldHeadings = [
      {
        re: new RegExp(
          `^(${legal})(?:\\s+([^:()]{1,45}?))?\\s+Position\\s*:\\s*([^:;]{2,110}?)\\s+\\(${range}\\)${roleEnd}`,
          "i",
        ),
        f: [1, 3, 4, 5],
        location: 2,
      },
      {
        re: new RegExp(
          `^(${legal})\\s+${range}\\s+(?:Position\\s*:\\s*)?${boundedRole}`,
          "i",
        ),
        f: [1, 4, 2, 3],
      },
      {
        re: new RegExp(
          `^${range}\\s+(?:\\(\\d+\\s+(?:months?|years?)\\)\\s+)?(${legal})\\s+${boundedRole}`,
          "i",
        ),
        f: [3, 4, 1, 2],
      },
      {
        re: new RegExp(
          `^COMPANY\\s+(${company})\\s+POSITION\\s+([^:;]{2,110}?)\\s+DURATION\\s+${range}(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [1, 2, 3, 4],
      },
    ];
    for (const { re, f, location } of fieldHeadings) {
      const m = labelledHeading.match(re);
      if (
        m &&
        !(
          location &&
          (forbidden.test(m[location] || "") ||
            new RegExp(date, "i").test(m[location] || ""))
        )
      )
        add(m[f[0]], m[f[1]], m[f[2]], m[f[3]], m[0], "bounded-heading-fields");
    }
    // Consecutive employer — tenure — (role) rows form a compact ledger.
    let parenthesizedLedger = labelledHeading;
    const parenthesizedRow = new RegExp(
      `^(${legal})\\s*[-–—]\\s*${range}\\s+\\(([^:;()]{2,100})\\)(?=\\s|$)`,
      "i",
    );
    for (;;) {
      const m = parenthesizedLedger.match(parenthesizedRow);
      if (!m) break;
      const before = result.length;
      add(m[1], m[4], m[2], m[3], m[0], "bounded-heading-fields");
      if (before === result.length) break;
      parenthesizedLedger = parenthesizedLedger.slice(m[0].length).trim();
    }
    const employerTenure = labelledHeading.match(
      new RegExp(`^(${legal})\\s+\\(${range}\\)\\s*$`, "i"),
    );
    if (employerTenure)
      add(
        employerTenure[1],
        "",
        employerTenure[2],
        employerTenure[3],
        employerTenure[0],
        "heading-employer-tenure",
      );

    // Date | Employer compact ledgers contain no title column. A role from a
    // later narrative must not fill it. Parse every cell consecutively and stop
    // at the first incomplete or unbounded cell.
    let employerLedger = section;
    const employerDate = new RegExp(`^${range}\\s*\\|\\s*`, "i");
    for (;;) {
      const d = employerLedger.match(employerDate);
      if (!d) break;
      const rest = employerLedger.slice(d[0].length);
      const next = rest.search(new RegExp(`\\s+${date}`, "i"));
      const cell = (next < 0 ? rest : rest.slice(0, next)).trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9&.,'() -]{1,100}$/.test(cell)) break;
      const before = result.length;
      add(
        cell.replace(/\s+\((?:contracting|contract)\)$/i, ""),
        "",
        d[1],
        d[2],
        d[0] + cell,
        "employer-only-ledger",
      );
      if (next < 0 || result.length === before) break;
      employerLedger = rest.slice(next).trim();
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
