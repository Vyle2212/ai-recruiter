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
const day = "\\d{1,2}(?:\\s*(?:st|nd|rd|th))?";
const year = "(?:19|20)\\d{2}";
const date = `(?:(?:${day}\\s+)?${month}[. -]*[’']?\\s*${year}|${month}\\s+${day}[ ,.-]+${year}|${year}\\s+${month}\\.?)`;
const ongoing =
  "(?:(?:till|until|to)\\s+(?:date|now|today|present)|present|current|now|ongoing)";
const range = `(${date})\\s*(?:[-–—]|to|until|till)\\s*(${date}|${ongoing})`;
const job =
  "(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Expert|Controller|Coordinator)";
const title = `[^:;|]{0,110}?\\b${job}(?:\\s*\\([^)]{1,40}\\))?`;
const company = "[^:;|]{2,120}?";
const forbidden =
  /\b(?:client|customer|project|responsibilities|duties|summary|education|skills|references|referrals|confidential|unknown)\b/i;
const cleanDate = (value: string) => {
  if (new RegExp(`^${ongoing}$`, "i").test(value)) return "Present";
  const cleaned = value
    .replace(/(\d)\s*(?:st|nd|rd|th)\b/i, "$1")
    .replace(/[.’'-]/g, " ")
    .replace(/([A-Za-z])((?:19|20)\d{2})\b/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const yearFirst = cleaned.match(new RegExp(`^(${year})\\s+(${month})$`, "i"));
  if (yearFirst) return `${yearFirst[2]} ${yearFirst[1]}`;
  const monthFirst = cleaned.match(
    new RegExp(`^(${month})\\s+(\\d{1,2})[, ]+(${year})$`, "i"),
  );
  return monthFirst
    ? `${monthFirst[2]} ${monthFirst[1]} ${monthFirst[3]}`
    : cleaned;
};

export function flattenedEmployment(source: string): FlattenedEmployment[] {
  const result: FlattenedEmployment[] = [];
  const add = (
    employer: string,
    role: string,
    start: string,
    end: string,
    excerpt: string,
    group: string,
    labelledRole = false,
    allowPartial = false,
  ) => {
    employer = employer.trim().replace(/[, ]+$/, "");
    role = role.trim().replace(/\s+\((?:promoted|contract|permanent)\)$/i, "");
    if (labelledRole) role = role.replace(/^\(([^()]+)\)(?=\s*[-–—/]|$)/, "$1");
    // Quoted employment statements are handled by the dedicated canonical
    // reader, which separates the trailing location from the employer.
    if (group === "employment-statement" && /^[“\"]/.test(employer)) return;
    start = cleanDate(start);
    end = cleanDate(end);
    const current = end === "Present";
    const a = careerMonthIndex(start),
      b = careerMonthIndex(end, current);
    if (
      (labelledRole &&
        /\b(?:research student|doctoral student|phd student|undergraduate|bachelor|master of|degree)\b/i.test(
          role,
        )) ||
      a === null ||
      (b === null && !(allowPartial && !end && role)) ||
      (b !== null && b < a) ||
      forbidden.test(employer) ||
      new RegExp(date, "i").test(employer) ||
      employer.length > 120 ||
      /\b(?:worked|working|from|since|as|at)\b/i.test(employer) ||
      (new RegExp(`\\b${job}\\b`, "i").test(employer) &&
        !(
          labelledRole &&
          /\b(?:Sdn\.?\s*Bhd|Pte\.?\s*Ltd|Pvt\.?\s*Ltd|Limited|Ltd|Inc|Corporation)\.?$/i.test(
            employer,
          )
        )) ||
      (role &&
        (new RegExp(date, "i").test(role) ||
          (!labelledRole && !new RegExp(`\\b${job}\\b`, "i").test(role)) ||
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
    const fullSection = source
      .slice((heading.index || 0) + heading[0].length, headings[i + 1]?.index)
      .split(
        /\b(?:education|qualifications|certifications|technical skills|references|referrals)\b/i,
      )[0];
    const section = fullSection.split(
      /\b(?:project experience|project history|project details|projects\/assignments|education|qualifications|certifications|technical skills|references|referrals)\b|\b(?:Projects?|Client|Customer)\s*:/i,
    )[0];
    // Repeated uppercase form labels survive flattened PDF page furniture.
    // All three fields must be adjacent; dates in an intervening project are
    // never used to complete a partial employment form.
    const formCompany =
      "(?:(?!\\b(?:COMPANY|POSITION|DURATION)\\b)[^:;|]){2,120}?";
    const formRole = "(?:(?!\\b(?:COMPANY|POSITION|DURATION)\\b)[^:;]){2,160}?";
    const forms = [
      ...fullSection.matchAll(
        new RegExp(
          `\\bCOMPANY\\s+(${formCompany})\\s+POSITION\\s+(${formRole})\\s+DURATION\\s+${range}(?=\\s|[.;)]|$)`,
          "gi",
        ),
      ),
    ];
    const firstForm = forms[0];
    if (
      firstForm &&
      !/\b(?:project experience|project history|project details|projects\/assignments)\b|\b(?:Project|Client|Customer)\s*:/i.test(
        fullSection.slice(0, firstForm.index),
      )
    ) {
      for (const m of forms) {
        if (
          !/^COMPANY\s/.test(m[0]) ||
          !/\sPOSITION\s/.test(m[0]) ||
          !/\sDURATION\s/.test(m[0])
        )
          continue;
        if (
          /\b(?:Project|Client|Customer)\s*:?\s*$/i.test(
            fullSection.slice(0, m.index),
          )
        )
          continue;
        add(m[1], m[2], m[3], m[4], m[0], "labelled-employment-form", true);
      }
    }
    // Current/Previous Employment explicitly introduces Company, Position and
    // Service Period. Do not borrow a later Project Period or an unlabeled role.
    const serviceForms = new RegExp(
      `\\b(?:Current|Previous) (?:Employment\\s+(?:(?:Current|Previous) Position\\s+)?|Position\\s+)Company\\s+(${company})\\s+Position\\s+([^:;]{2,160}?)\\s+Service Period\\s+${range}(?=\\s|[.;]|$)`,
      "gi",
    );
    for (const m of fullSection.matchAll(serviceForms))
      add(m[1], m[2], m[3], m[4], m[0], "labelled-employment-form", true);
    // Period / Company / Designation forms: the duty verb terminates the
    // title. A malformed row cannot consume the next Period field.
    if (/^Period\s+/i.test(section)) {
      const periodForm = new RegExp(
        `\\bPeriod\\s+${range}\\s+Company\\s+(${company})\\s+Designation\\s+(${title})(?=\\s+(?:Plan|Investigate|Begun|Provide|Develop|Responsibilities)\\b|$)`,
        "gi",
      );
      for (const m of fullSection.matchAll(periodForm))
        if (
          !/\b(?:Project|Client|Customer)\s*$/i.test(
            fullSection.slice(0, m.index),
          )
        )
          add(m[3], m[4], m[1], m[2], m[0], "period-company-designation");
    }
    // A direct employment assertion with its own range can establish tenure
    // without a title. Project Role fields that follow stay unassigned.
    const assertion = section
      .replace(/^[-–—]\d+\s+/, "")
      .match(
        new RegExp(
          `^(?:Worked|Working)\\s+(?:with|at)\\s+(${company})\\s+(?:since|from)\\s+${range}(?=\\s|[.;]|$)`,
          "i",
        ),
      );
    if (assertion)
      add(
        assertion[1],
        "",
        assertion[2],
        assertion[3],
        assertion[0],
        "employment-tenure-assertion",
      );
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
      "[A-Z0-9][A-Za-z0-9&.,'() /-]{1,100}?\\b(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Private Limited|Corporation|Berhad|S/B|Limited|Ltd\\.?|Inc\\.?)";
    // Complete employer / recognizable role / tenure cells may be adjacent
    // after PDF flattening. Consume from the heading only and stop at prose;
    // never search ahead through duties for another date or employer.
    const roleModifiers =
      "(?:Senior|Junior|Lead|Principal|Global|Regional|Strategic|APAC|Functional|Technical|Business|Sales|Account|Software|Basis|Solution|Development|Integration)";
    const compactRole = `(?:(?:${roleModifiers}\\s+){1,5}${job}|(?:${roleModifiers}\\s+){0,2}SAP\\s+[A-Za-z0-9/& -]{0,65}?\\b${job})`;
    const compactRange = `(${date}|${year})\\s*(?:[-–—]|to|until|till)\\s*(${date}|${year}|${ongoing})`;
    const compactCell = new RegExp(
      `^([A-Z0-9][A-Za-z0-9&.,'() /-]{1,110}?)\\s+(${compactRole})\\s*,?\\s+\\(?${compactRange}\\)?(?=\\s|[.:;]|$)`,
      "i",
    );
    let compactRest = section.replace(/^[-–—]\s*/, "");
    while (compactRest.trim()) {
      const m = compactRest.trimStart().match(compactCell);
      if (
        !m ||
        /\b(?:worked|working|delivered|provided|supported|responsible|involved|led)\b/i.test(
          m[1],
        )
      )
        break;
      if (new RegExp(`^(?:${roleModifiers}\\s*)+$`, "i").test(m[1])) break;
      if (/^(?:Organi[sz]ation|Date|Position|Period|Duration)\s/i.test(m[1]))
        break;
      const previousCount = result.length;
      add(m[1], m[2], m[3], m[4], m[0], "compact-employer-role-tenure");
      if (result.length === previousCount) break;
      compactRest = compactRest.trimStart().slice(m[0].length);
    }
    // The inverse ledger has an explicit "at" between role and employer.
    // Candidate date boundaries delimit cells; an invalid later date stops
    // parsing without contaminating the preceding complete employer cell.
    const atDates = [
      ...section.matchAll(
        new RegExp(`(?:${range}|${year}\\s+[A-Za-z]{3,9}\\s*[-–—])`, "gi"),
      ),
    ];
    if (atDates[0]?.index === 0) {
      for (const [n, boundary] of atDates.entries()) {
        const cell = section
          .slice(boundary.index, atDates[n + 1]?.index)
          .trim();
        const m = cell.match(
          new RegExp(
            `^${range}\\s+([^:;]{2,110}?)\\s+at\\s+([A-Z0-9][A-Za-z0-9&.'() /-]{1,110}?)(?:,\\s*[A-Za-z .,-]{2,60})?\\.?$`,
            "i",
          ),
        );
        if (!m) break;
        const before = result.length;
        add(m[4], m[3], m[1], m[2], m[0], "dated-role-at-employer-ledger");
        if (result.length === before) break;
      }
    }
    // A dated legal-employer heading can put role before or after tenure.
    // Read only the section start, or an established 1 / 2 / 3 employment
    // enumeration. Dates embedded in duties never introduce new jobs.
    const datedHeadingRows = [section];
    const numberedSection = fullSection
      .replace(/^PROFILE\s+/i, "")
      .split(
        /\b(?:project experience|project history|project details|projects\/assignments)\b|\bProjects\s*:/i,
      )[0];
    const numbers = [
      ...numberedSection.matchAll(
        new RegExp(`(?:^|\\s)(\\d{1,2})([.)])\\s+(?=${date})`, "gi"),
      ),
    ];
    if (
      numbers[0]?.index === 0 &&
      numbers[0][1] === "1" &&
      numbers[1]?.[1] === "2"
    ) {
      datedHeadingRows.length = 0;
      for (const [n, marker] of numbers.entries()) {
        if (Number(marker[1]) !== n + 1 || marker[2] !== numbers[0][2]) break;
        datedHeadingRows.push(
          numberedSection.slice(
            (marker.index || 0) + marker[0].length,
            numbers[n + 1]?.index,
          ),
        );
      }
    }
    let datedEmployerHeadingOwned = false;
    for (const candidate of datedHeadingRows) {
      const datedRole = candidate.match(
        new RegExp(
          `^${range}\\s*[,–—-]?\\s*(?:Contract\\s+)?(${title})\\s*,?\\s+(${legal})(?=\\s|[.,]|$)`,
          "i",
        ),
      );
      const datedLabelledRole = candidate.match(
        new RegExp(
          `^${range}\\s*[,–—-]?\\s*(?:Contract\\s+)?([^:;]{2,110}),\\s*(${legal})(?=\\s|[.,]|$)`,
          "i",
        ),
      );
      const roleDated = candidate.match(
        new RegExp(
          `^(${title})\\s+${range}\\s+(${legal})(?=\\s+(?:Skills|Responsibilities|Job Duties)\\s*:|$)`,
          "i",
        ),
      );
      const roleStart =
        /^(?:Senior|Junior|SAP|HCM|Reporting|Functional|Technical|Application|Software|System|Business|Consultant|Manager|Analyst|Engineer|Intern)\b/i;
      const m =
        datedLabelledRole ||
        (datedRole && roleStart.test(datedRole[3]) ? datedRole : null);
      if (m && !new RegExp(`\\b${job}\\b`, "i").test(m[4])) {
        add(m[4], m[3], m[1], m[2], m[0], "dated-legal-role-heading", true);
        continue;
      }
      if (
        roleDated &&
        roleStart.test(roleDated[1]) &&
        !/[,.–—|]/.test(roleDated[1])
      ) {
        add(
          roleDated[4],
          roleDated[1],
          roleDated[2],
          roleDated[3],
          roleDated[0],
          "role-dated-legal-heading",
        );
        continue;
      }
      const employerFirst = candidate.match(
        new RegExp(`^${range}\\s*[:,]?\\s+(${legal})(?=\\s|[.,]|$)`, "i"),
      );
      if (!employerFirst) continue;
      // Keep tenure even when location/narrative prevents a grounded title.
      // Only a complete role followed by an explicit duty boundary is eligible.
      const tail = candidate.slice(employerFirst[0].length);
      const boundedTitle = tail.match(
        new RegExp(
          `^\\s+(${title})(?:,\\s*[A-Za-z ]{2,35})?\\s+(?=Completed\\b|Responsibilities\\b|Job Duties\\b)`,
          "i",
        ),
      );
      if (
        candidate === section &&
        !boundedTitle &&
        !tail.trimStart().startsWith("(") &&
        /^\s+[^:;]{2,110}?(?=\s+(?:Job (?:Functions|responsibilities)|Responsibilities|Main Duties|Task\s*[/]|[•●◼➢⮚]|Hands-on)|$)/i.test(
          tail,
        )
      )
        continue;
      if (
        /^\d+[.)]/.test(employerFirst[3]) ||
        (!boundedTitle &&
          !/^,\s*[A-Za-z]|^\s+\((?!fka\b|formerly\b)[^)]{2,40}\)\s+SAP\b/i.test(
            tail,
          ))
      )
        continue;
      const previousCount = result.length;
      add(
        employerFirst[3],
        boundedTitle?.[1] || "",
        employerFirst[1],
        employerFirst[2],
        employerFirst[0] + (boundedTitle?.[0] || ""),
        "dated-legal-employer-heading",
        true,
      );
      if (candidate === section && result.length > previousCount)
        datedEmployerHeadingOwned = true;
    }
    // Explicit Position / Company / Period columns: consume complete cells
    // from the start, never align separated column-major lists by position.
    const yearTable = section.match(
      /^Position\s+Company\s+Period\s+([\s\S]*)/i,
    );
    if (yearTable) {
      let rest = yearTable[1];
      const cell = new RegExp(
        `^(${title})\\s+(${legal})\\s+(${year})\\s*[-–—]\\s*(${year}|${ongoing})(?=\\s|$)`,
        "i",
      );
      while (rest.trim()) {
        const m = rest.trimStart().match(cell);
        if (!m) break;
        // Multiple legal endings in one company cell indicate lost column
        // order; do not concatenate employers to manufacture a complete row.
        if (
          (
            m[2].match(
              /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Private Limited|Corporation|Berhad|S\/B|Limited|Ltd\.?|Inc\.?)/gi,
            ) || []
          ).length !== 1
        )
          break;
        const previousCount = result.length;
        add(
          m[2],
          m[1],
          m[3],
          m[4],
          m[0],
          "position-company-period-table",
          true,
        );
        if (result.length === previousCount) break;
        rest = rest.trimStart().slice(m[0].length);
      }
    }
    // Compact employment ledger: date : employer, location role. Each cell
    // must be complete and adjacent; a project/narrative breaks the ledger.
    const ledgerDates = [
      ...section.matchAll(new RegExp(`${range}\\s*:`, "gi")),
    ];
    if (ledgerDates[0]?.index === 0) {
      const ledgerRole =
        "(?:(?:Senior|Associate|Assistant|Technical|SAP)\\s+)*(?:Manager|Lead|Consultant|Developer|Engineer|Analyst)|[A-Z]{2,5}\\s*&\\s*Technical Lead";
      for (const [cellIndex, m] of ledgerDates.entries()) {
        const body = section
          .slice(
            m[0].length + (m.index || 0),
            ledgerDates[cellIndex + 1]?.index,
          )
          .trim();
        const fields = body.match(
          new RegExp(
            `^([^,:;]{2,100}),\\s*([A-Za-z][A-Za-z .'-]{1,50}?)\\s+(${ledgerRole})$`,
            "i",
          ),
        );
        if (!fields || /\b(?:project|client|customer)\b/i.test(fields[2]))
          break;
        const previousCount = result.length;
        add(
          fields[1],
          fields[3],
          m[1],
          m[2],
          `${m[0]} ${body}`,
          "dated-location-role-ledger",
        );
        if (result.length === previousCount) break;
      }
    }
    const roleEnd =
      "(?=\\s+(?:Job (?:Functions|responsibilities)|Responsibilities|Main Duties|Task\\s*[/]|[•●◼➢⮚]|Hands-on)|$)";
    const boundedRole = `([^:;]{2,110}?)${roleEnd}`;
    const labelledHeading = enumerated.has(i)
      ? section.replace(/^(?:I1|[IVX]+)\s+/, "")
      : section.replace(/^\d{1,2}[.)]\s*/, "");
    // A legal suffix or a comma directly before tenure supplies the missing
    // employer/role boundary. These readers never search within duty prose.
    const legalRoleHeadings = [
      {
        re: new RegExp(
          `^(${legal})\\s+(${title})\\s+${range}(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [1, 2, 3, 4],
      },
      {
        re: new RegExp(
          `^(${title})\\s+(${legal})\\s+${range}(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [2, 1, 3, 4],
      },
      {
        re: new RegExp(
          `^(${title})\\s+([^,:;|]{2,80}),\\s*${range}(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [2, 1, 3, 4],
      },
      {
        re: new RegExp(
          `^(${title}),\\s*(${legal})(?:\\s*,\\s*([A-Za-z .,-]{2,45}?))?\\s+${range}(?=\\s|[.;]|$)`,
          "i",
        ),
        f: [2, 1, 4, 5],
        location: 3,
      },
    ];
    for (const { re, f, location } of legalRoleHeadings) {
      const m = labelledHeading.match(re);
      if (
        m &&
        /^[A-Za-z0-9]/.test(m[f[1]]) &&
        !(
          location &&
          (forbidden.test(m[location] || "") ||
            new RegExp(`\\b${job}\\b`, "i").test(m[location] || ""))
        )
      )
        add(m[f[0]], m[f[1]], m[f[2]], m[f[3]], m[0], "legal-role-heading");
    }
    // Employer tenure is independent of a later numbered promotion or project.
    // Pipe and labelled Project Description boundaries do not supply a title.
    const employerHeadings = [
      {
        re: new RegExp(`^(${legal})\\s*\\|\\s*${range}(?=\\s|[.;]|$)`, "i"),
        f: [1, 2, 3],
      },
      {
        re: new RegExp(
          `^(${legal}(?:\\s+\\([^:;]{2,70}\\))?)\\s+${range}(?=\\s+\\d+[.)]\\s+)`,
          "i",
        ),
        f: [1, 2, 3],
      },
      {
        re: new RegExp(
          `^(${legal}),\\s*([A-Za-z .,-]{2,45}?)\\s+\\(?${range}\\)?(?=\\s+(?:Involved|Served|[-–—]\\s*\\d+\\s+years?\\s+Served)\\b)`,
          "i",
        ),
        f: [1, 3, 4],
        location: 2,
      },
      {
        re: new RegExp(
          `^${range}\\s+(${company})\\s+Project Description\\s*:`,
          "i",
        ),
        f: [3, 1, 2],
      },
    ];
    for (const { re, f, location } of employerHeadings) {
      const m = labelledHeading.match(re);
      if (
        m &&
        !(
          location &&
          (forbidden.test(m[location] || "") ||
            new RegExp(`\\b${job}\\b`, "i").test(m[location] || ""))
        )
      )
        add(m[f[0]], "", m[f[1]], m[f[2]], m[0], "bounded-employer-tenure");
    }
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
        // An alias after a dated employer is company metadata, not a role.
        !(
          f[0] === 3 &&
          f[1] === 4 &&
          (datedEmployerHeadingOwned || /^\(/.test(m[f[1]]))
        ) &&
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
  // Date Joined / Date Left belong to one Company Name form. Duties may
  // intervene, but another company or a project-history heading ends the form.
  const privateCareer = source.split(/\b(?:references|referrals)\b/i)[0];
  const companyForms = [...privateCareer.matchAll(/\bCompany Name\s*:\s*/gi)];
  for (const [i, marker] of companyForms.entries()) {
    const block = privateCareer
      .slice((marker.index || 0) + marker[0].length, companyForms[i + 1]?.index)
      .split(
        /\b(?:working experiences?|project experience|project history|education|qualifications)\b/i,
      )[0];
    const fields = block.match(
      /^([^:;]{2,120}?)\s+(?:Position\s+)?Title\s*:\s*([^:;]{2,120}?)(?=\s+(?:Level|Industry|Date Joined)\s*:)/i,
    );
    if (!fields) continue;
    const joins = [
      ...block.matchAll(
        new RegExp(`\\bDate Joined\\s*:\\s*(${date})(?=\\s|[.;]|$)`, "gi"),
      ),
    ];
    const leaves = [...block.matchAll(/\bDate Left\s*:\s*/gi)];
    if (joins.length !== 1 || leaves.length > 1) continue;
    const endText = leaves[0]
      ? block.slice((leaves[0].index || 0) + leaves[0][0].length)
      : "";
    const end =
      endText.match(
        new RegExp(`^(${date}|${ongoing})(?=\\s|[.;]|$)`, "i"),
      )?.[1] || "";
    add(
      fields[1],
      fields[2],
      joins[0][1],
      end,
      marker[0] + block,
      "joined-left-form",
      true,
      true,
    );
  }
  // Career Profile uses explicitly labelled employer/title fields. Parenthetical
  // duration counts are allowed; a second date in parentheses is ambiguous and
  // is not silently discarded to associate the range with an employer.
  const career = privateCareer.match(/\bCareer Profile\s+([\s\S]*)/i)?.[1];
  if (career) {
    const careerRows = new RegExp(
      `${range}\\s+(?:\\(\\d+(?:\\.\\d+)?\\s+years?\\)\\s+)?Employer\\s*:\\s*(${company})\\s+Job Title\\s*:\\s*([^:;]{2,150}?)\\s+Job Tasks?\\b`,
      "gi",
    );
    for (const m of career.matchAll(careerRows))
      add(m[3], m[4], m[1], m[2], m[0], "career-profile-labels", true);
  }
  // Professional Profile forms state organization, role and their own duration
  // contiguously. Project/Client fields between them invalidate the association.
  const professional = privateCareer.match(
    /\bProfessional Profile\b[^:]{0,60}:\s*([\s\S]*)/i,
  )?.[1];
  if (professional) {
    const rows = new RegExp(
      `\\bOrgani[sz]ation\\s*:\\s*(${company})\\s+Role\\s*:\\s*([^:;]{2,120}?)\\s+Duration\\s*:\\s*${range}(?=\\s|[.;]|$)`,
      "gi",
    );
    for (const m of professional.matchAll(rows)) {
      if (/\b(?:migration|implementation|rollout)\s+project\b/i.test(m[2]))
        continue;
      add(m[1], m[2], m[3], m[4], m[0], "professional-profile-labels", true);
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
