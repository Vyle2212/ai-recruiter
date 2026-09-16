import { careerMonthIndex } from "./candidateCareerExperience";

export type BoundedEmployment = {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  excerpt: string;
  group: string;
};
const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const year = "(?:19|20)\\d{2}";
const day = "\\d{1,2}(?:st|nd|rd|th)?";
const date = `(?:(?:${day}[ -]+)?${month}[. -]*${year}|${month}[. ]*${day}[ ,]+${year}|${year})`;
const ongoing =
  "(?:(?:till|until|to)\\s+(?:date|now|present)|present|current|now|continuing)";
const range = `(${date})\\s*(?:[-–—]|to|until|till)\\s*(${date}|${ongoing})`;
const job =
  "(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Expert|Controller|Coordinator|Intern|Trainee|Supervisor|Advisor|Programmer|Counsellor|Clerk|Head)";
const role = `(?:[A-Za-z0-9/&.+-]+\\s+){0,8}${job}(?:\\s*\\([^)]{1,35}\\))?`;
const roleStart =
  /^(?:SCM|MM|SD|FI|CO|PP|PM|QM|BW|CRM|Deputy|Full|Tech|Package|SAP|ERP|Senior|Junior|Sr\.?|Jr\.?|Principal|Principle|Lead|Project|Program|Business|Software|Systems?|Application|Technical|Functional|Finance|Financial|Accounts?|HR|IT|ABAP|Data|Support|Industrial|Intern|Recruitment|Technology|Solution|Solutions|Associate|Assistant|Executive|Manager|Consultant|Analyst|Engineer|Developer|Secondment|CPL|Team|Group|Procurement|General|Officer|Director|Architect|Tax|Property|Workday|Graduate|Operations?|Logistics|Supply|Mechanical|Electrical|Quality|QA|Sales|Customer|Service|Network|Database|Information|Computer|Product|Process|Manufacturing|Research|Trainee|Accountant|Controller|Coordinator|Advisor|Programmer|Counsellor|Clerk|Head)\b/i;
const org =
  "[A-Za-z0-9](?:(?!\\b(?:worked|working|employed|as)\\b)[A-Za-z0-9&.,'’() /-]){1,130}?";
const legal =
  /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Limited|Ltd\.?|Inc\.?|Berhad|Corporation)\b/gi;
const forbidden =
  /\b(?:client|customer|project|university|degree|education|references|referees|responsibilities|involved|responsible|worked|working|implemented|implementation|configuration|confidential|unknown)\b/i;
const hasJob = new RegExp(`\\b${job}\\b`, "i");
function cleanDate(value: string) {
  if (new RegExp(`^${ongoing}$`, "i").test(value)) return "Present";
  return value
    .replace(new RegExp(`^(${month})(?=\\d)`, "i"), "$1 ")
    .replace(/(\d)(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/[.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp(`^(${month}) (\\d{1,2}) (${year})$`, "i"), "$2 $1 $3");
}
function validCompany(value: string) {
  return (
    !new RegExp(`^${month}$`, "i").test(value) &&
    value.replace(legal, "").replace(/[^A-Za-z]/g, "").length >= 2 &&
    !/^(?:SAP|SD|MM|FI|CO|BW|Support)\b/i.test(value) &&
    !/^Programmer(?=[A-Z])/.test(value) &&
    !/\bat[A-Z]/.test(value) &&
    !/\b(?:Port Operations|Pre-shipping|Pay\s*roll|Assigned|Managed|Developed|Delivered|Provided)\b/i.test(
      value,
    ) &&
    value.length >= 2 &&
    value.length <= 130 &&
    !forbidden.test(value) &&
    !hasJob.test(value) &&
    !/\b(?:as|from|since|for|at|with|role|position|industry|specialization|years?|months?)\b|[:;!?@]/i.test(
      value,
    ) &&
    !new RegExp(`\\b${year}\\b`).test(value) &&
    (value.match(legal)?.length || 0) < 2
  );
}
function validRole(value: string) {
  return (
    !value.match(legal)?.length &&
    value.length <= 120 &&
    hasJob.test(value) &&
    !forbidden.test(
      value
        .replace(/\bProject (?=Manager|Lead|Director|Coordinator)\b/gi, "")
        .replace(/\bImplementation (?=Consultant|Manager|Lead)\b/gi, ""),
    ) &&
    !/\b(?:from|since|employed|company|industry|salary|years?|months?)\b/i.test(
      value,
    ) &&
    !new RegExp(`\\b${year}\\b`).test(value)
  );
}

export function boundedEmploymentBatch(input: string): BoundedEmployment[] {
  const source = input.normalize("NFKC").replace(/\s+/g, " ");
  const output: BoundedEmployment[] = [];
  function add(
    company: string,
    title: string,
    start: string,
    end: string,
    excerpt: string,
    group: string,
  ) {
    company = company.trim().replace(/[, ]+$/, "");
    title = title.trim().replace(/^[aA]n?\s+/, "");
    if (!validCompany(company) || (title && !validRole(title))) return;
    start = cleanDate(start);
    end = cleanDate(end);
    const current = end === "Present";
    const a = careerMonthIndex(start),
      b = careerMonthIndex(end, current);
    if (a === null || b === null || a > b) return;
    output.push({ company, title, start, end, current, excerpt, group });
  }
  // Explicit employment sentences establish their own employer/date ownership.
  // Reject additional employer/client relations rather than guessing the payer.
  const statements = [
    {
      re: new RegExp(
        `\\b(?:worked|working|employed)\\s+(?:as\\s+)([A-Za-z][^:;!?]{2,115}?)\\s+(?:for|at|in)\\s+(${org})\\s+(?:from|since)\\s+${range}(?=[.,;\\s]|$)`,
        "gi",
      ),
      f: [2, 1, 3, 4],
    },
    {
      re: new RegExp(
        `\\b(?:worked|working|employed)\\s+(?:with|for|at|in)\\s+(${org})\\s+as\\s+([A-Za-z][^:;!?]{2,115}?)\\s+(?:from|since)\\s+${range}(?=[.,;\\s]|$)`,
        "gi",
      ),
      f: [1, 2, 3, 4],
    },
    {
      re: new RegExp(
        `\\b(?:worked|working|employed)\\s+(?:for|at)\\s+(${org})\\s+from\\s+${range}(?=[.,;\\s]|$)`,
        "gi",
      ),
      f: [1, 0, 2, 3],
    },
    {
      re: new RegExp(
        `\\b(?:worked|working|employed)\\s+at\\s+(${org})\\s+as\\s+(${role})\\s*\\(${range}\\)`,
        "gi",
      ),
      f: [1, 2, 3, 4],
    },
  ];
  for (const { re, f } of statements)
    for (const m of source.matchAll(re)) {
      if (
        /\b(?:client|customer|project|reference)\s*:?\s*$/i.test(
          source.slice(Math.max(0, m.index! - 40), m.index),
        )
      )
        continue;
      add(
        m[f[0]],
        f[1] ? m[f[1]] : "",
        m[f[2]],
        m[f[3]],
        m[0],
        "explicit-sentence",
      );
    }

  const duration =
    "(?:\\(\\d+\\s+years?(?:\\s+(?:and\\s+)?\\d+\\s+months?)?\\)|\\(\\d+\\s+months?\\))";
  // Exported employment cards have a dated heading, title/employer, and the
  // Industry/Specialization/Role/Position Level schema. Labels confirm the card
  // format; printed duration and category Role never overwrite tenure/title.
  const cards = new RegExp(
    `${range}\\s*${duration}?\\s+([^:;!?]{3,210}?)\\s+Industry\\s+([^:;!?]{1,180}?)(?=\\s+(?:Position Level|Specialization)\\b)`,
    "gi",
  );
  for (const m of source.matchAll(cards)) {
    if (
      new RegExp(`${month}[. -]*$`, "i").test(
        source.slice(Math.max(0, m.index! - 15), m.index),
      )
    )
      continue;
    const schema = source.slice(
      m.index! + m[0].length,
      m.index! + m[0].length + 220,
    );
    if (
      !/^\s*(?:Position Level\b|Specialization\s+.{1,100}?\s+Role\b)/i.test(
        schema,
      )
    )
      continue;
    if (
      /\b(?:project|client|customer)\s*(?:duration|period)?\s*:?\s*$/i.test(
        source.slice(Math.max(0, m.index! - 45), m.index),
      )
    )
      continue;
    const body = m[3]
      .replace(new RegExp(`\\s*${duration}`, "i"), "")
      .split(/\s*\|\s*/)[0];
    const fields = body.match(
      new RegExp(
        `^(${role}(?:\\s*[-–—]\\s*(?:SAP\\s+)?[A-Z]{2,4}(?:\\s*[&/]\\s*[A-Z]{2,4})?)?)\\s+(${org})$`,
        "i",
      ),
    );
    if (fields && roleStart.test(fields[1]))
      add(fields[2], fields[1], m[1], m[2], m[0], "labelled-export-card");
  }

  const headings =
    /\b(?:Professional Experiences?|Work(?:ing)? Experiences?|Employment History|Employment Record|Career History|Career Summary|Work History)\s*:?\s*/gi;
  const duty =
    "(?:Attached|Participates|Troubleshoot|Responsibilities|Key (?:Responsibilities|Deliverables)|Job (?:Description|Scope)|Projects?|Clients?|Conduct(?:ed)?|Collaborate|Create|Lead|Led|Manage[ds]?|Develop(?:ed)?|Implement(?:ed)?|Support(?:ed)?|Perform(?:ed)?|Involved|Responsible|Handles?|Acts?|Work(?:ed)?|Review|Prepare|Providing|Provided|Assist(?:ed)?|Resolve|Ensure|Report|Design|Maintain(?:ed)?|Monitor(?:ing)?)";
  const boundary = `(?=\\s+(?:${duty}\\b|[•➔\\uF0A7*]|${date})|\\s*$)`;
  const sectionHeadings = [
    ...source.matchAll(headings),
    ...source.matchAll(
      /(?<!PROJECT )(?<!WORK )(?<!PROFESSIONAL )\bEXPERIENCE\s*:?\s*/g,
    ),
  ].sort((a, b) => a.index! - b.index!);
  for (const h of sectionHeadings) {
    if (
      /\b(?:project|client|customer|detailed)\s*$/i.test(
        source.slice(Math.max(0, h.index! - 40), h.index),
      )
    )
      continue;
    const tail = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:Education|Qualifications|Certifications|References|Referees|Technical Skills|Project (?:Experience|History|Details))\b/i,
      )[0];
    const rest = tail.replace(/^\d+[.)]\s*/, "");
    // Named employer blocks are parsed as fields, independent of label order.
    // Nested projects terminate this reader before their companies/dates.
    const form = tail.split(
      /\b(?:Project(?:s| Experience| History| Details| Description)?|Education|References|Referees)\s*[:#]/i,
    )[0];
    const labels = [
      ...form.matchAll(
        /\b(Company(?: Name)?|Employer|Organi[sz]ation|Position(?: Title)?(?:\s*\(Level\))?|Designation|Role|Duration|Period|Speciali[sz]ation|Industry|Clients?|Customers?|Environment|Job Scopes?|Job Description|Responsibilities|Work Description)\s*:/gi,
      ),
    ];
    const fields = labels.map((m, i) => ({
      label: m[1].toLowerCase(),
      value: form.slice(m.index! + m[0].length, labels[i + 1]?.index).trim(),
      at: m.index!,
    }));
    for (let i = 0; i < fields.length; i++) {
      if (
        !/^(?:company(?: name)?|employer|organi[sz]ation)$/.test(
          fields[i].label,
        )
      )
        continue;
      let j = i + 1;
      while (
        j < fields.length &&
        !/^(?:company(?: name)?|employer|organi[sz]ation)$/.test(
          fields[j].label,
        )
      )
        j++;
      const block = fields.slice(i + 1, j);
      const period = block.find((f) => /^(?:duration|period)$/.test(f.label));
      const roleField =
        block.find((f) => /^position|^designation/.test(f.label)) ||
        block.find((f) => f.label === "role");
      const dates = period?.value.match(new RegExp(`^${range}\\s*[.]?$`, "i"));
      if (
        dates &&
        roleField &&
        !block.some(
          (f) =>
            /^(?:client|customer)/.test(f.label) &&
            new RegExp(range, "i").test(f.value),
        )
      ) {
        add(
          fields[i].value,
          roleField.value.replace(/[.]$/, ""),
          dates[1],
          dates[2],
          form.slice(
            fields[i].at,
            labels[
              Math.max(fields.indexOf(period!), fields.indexOf(roleField)) + 1
            ]?.index,
          ),
          "named-employer-fields",
        );
      }
    }
    // Both a role keyword and a complete tenure must bound the employer.
    const titleCompany = rest.match(
      new RegExp(`^(${role})\\s+(${org})[, ]*\\(?${range}\\)?${boundary}`, "i"),
    );
    if (
      titleCompany &&
      roleStart.test(titleCompany[1]) &&
      !titleCompany[2].includes(",")
    )
      add(
        titleCompany[2],
        titleCompany[1],
        titleCompany[3],
        titleCompany[4],
        titleCompany[0],
        "role-employer-tenure",
      );
    const companyTitle = rest.match(
      new RegExp(
        `^(${org})\\s*[,|–—]\\s*(${role})\\s*[,|]?\\s*\\(?${range}\\)?${boundary}`,
        "i",
      ),
    );
    if (companyTitle && roleStart.test(companyTitle[2]))
      add(
        companyTitle[1],
        companyTitle[2],
        companyTitle[3],
        companyTitle[4],
        companyTitle[0],
        "delimited-employer-role",
      );
    const datedTitle = rest.match(
      new RegExp(`^${range}\\s+(${role})\\s+(${org})${boundary}`, "i"),
    );
    if (
      datedTitle &&
      roleStart.test(datedTitle[3]) &&
      !datedTitle[4].includes(",")
    )
      add(
        datedTitle[4],
        datedTitle[3],
        datedTitle[1],
        datedTitle[2],
        datedTitle[0],
        "dated-role-employer",
      );
    // Compact summaries repeat role / tenure / employer with no duty prose.
    let remaining = rest;
    while (remaining) {
      const head = remaining.match(
        new RegExp(`^(${role})\\s+\\(?${range}\\)?\\s+`, "i"),
      );
      if (!head || !roleStart.test(head[1]) || !validRole(head[1])) break;
      const after = remaining.slice(head[0].length);
      const nextDate = new RegExp(range, "i").exec(after);
      if (!nextDate) break;
      const between = after
        .slice(0, nextDate.index)
        .trim()
        .replace(/\($/, "")
        .trim();
      let split = -1;
      for (const gap of between.matchAll(/\s+/g)) {
        const company = between.slice(0, gap.index);
        const nextTitle = between.slice(gap.index! + gap[0].length);
        if (
          !company.includes(",") &&
          validCompany(company) &&
          roleStart.test(nextTitle) &&
          validRole(nextTitle) &&
          new RegExp(`^${role}$`, "i").test(nextTitle)
        ) {
          split = gap.index!;
          break;
        }
      }
      if (split < 0) break;
      const excerpt = head[0] + between.slice(0, split);
      add(
        between.slice(0, split),
        head[1],
        head[2],
        head[3],
        excerpt,
        "role-tenure-employer-ledger",
      );
      remaining = after.slice(split).trimStart();
    }
  }

  // Explicit separators retain field ownership even after all line breaks are
  // lost. Only read immediately after a career heading, never resynchronize in
  // unlabelled duty or project prose.
  const separatorHeadings =
    /\b(?:Work(?:ing)? Experiences?|Professional Experiences?|Employment History|Career History|Work History|Experiences?)\s*:?\s*/gi;
  let acceptedLength = 0;
  const balanced = (value: string) =>
    (value.match(/\(/g)?.length || 0) === (value.match(/\)/g)?.length || 0);
  const addHeader = (
    company: string,
    title: string,
    start: string,
    end: string,
    excerpt: string,
    group: string,
  ) => {
    title = title.trim().replace(/\s*[-–—.]\s*$/, "");
    company = company.trim();
    if (
      /,(?!\s*SAP\b)/i.test(title) ||
      !roleStart.test(title) ||
      !balanced(title) ||
      !balanced(company) ||
      !/^[A-Za-z0-9]/.test(company) ||
      /\b(?:SAP|ERP)\s*$/i.test(company) ||
      /\b(?:Head|Projects?|Summary|provide|providing|develop|developing|design|apply|duties|experience|worked|working|implemented)\b/i.test(
        company,
      ) ||
      /\b(?:experience|summary|employee|skills|enhancing|providing|developing|hired|location)\b/i.test(
        title,
      )
    )
      return;
    if (
      group === "dash-pair" &&
      (title.includes(",") ||
        company.includes("/") ||
        !new RegExp(`^${role}$`, "i").test(title))
    )
      return;
    const previous = output.length;
    add(company, title, start, end, excerpt, group);
    if (output.length > previous)
      acceptedLength = Math.max(acceptedLength, excerpt.length);
  };
  const cell = "[^|:;\\[\\]•\\uF0A7]{2,130}?";
  const endRange = "(?=\\s|[.,;)]|$)";
  for (const h of source.matchAll(separatorHeadings)) {
    if (
      /\b(?:project|client|customer|technical|implementation|support|years?(?: of)?|summary of)\s*$/i.test(
        source.slice(Math.max(0, h.index! - 50), h.index),
      )
    )
      continue;
    const tail = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:Education|Qualifications|Certifications|References|Referees|Technical Skills|Personal Projects?|Project (?:Experience|History|Details|Involvement))\b/i,
      )[0];
    let rest = tail.replace(/^(?:[_–—-]{3,}\s*|[•]\s*|\d+[.)]\s*)/, "");
    for (let adjacent = 0; adjacent < 30; adjacent++) {
      acceptedLength = 0;
      // A double-delimited pair is unambiguous in either field order; only one
      // side may contain a role. Slash delimiters must be surrounded by spaces.
      const patterns = [
        {
          re: new RegExp(
            `^(${cell})\\s*\\|\\s*(${cell})\\s*\\|?\\s+\\(?${range}\\)?${endRange}`,
            "i",
          ),
          pair: [1, 2],
          dates: [3, 4],
          group: "separator-pair",
        },
        {
          re: new RegExp(
            `^\\[(${cell})\\]\\s*\\[(${cell})\\]\\s*${range}${endRange}`,
            "i",
          ),
          pair: [1, 2],
          dates: [3, 4],
          group: "bracket-pair",
        },
        {
          re: new RegExp(
            `^(${cell})\\s+[/–—-]\\s+(${cell})\\s+\\(?${range}\\)?${endRange}`,
            "i",
          ),
          pair: [1, 2],
          dates: [3, 4],
          group: "dash-pair",
        },
      ];
      for (const p of patterns) {
        const m = rest.match(p.re);
        if (!m) continue;
        const [left, right] = p.pair.map((i) =>
          m[i].trim().replace(/[.]$/, ""),
        );
        if (validRole(left) && !validRole(right))
          addHeader(
            m[p.pair[1]].trim(),
            left,
            m[p.dates[0]],
            m[p.dates[1]],
            m[0],
            p.group,
          );
        else if (validRole(right) && !validRole(left))
          addHeader(
            m[p.pair[0]].trim(),
            right,
            m[p.dates[0]],
            m[p.dates[1]],
            m[0],
            p.group,
          );
      }
      // Pipe immediately before tenure: role/employer boundaries are accepted
      // only with a bounded role keyword or an explicit legal company suffix.
      const pipeDate = rest.match(
        new RegExp(`^(${cell})\\s*\\|\\s*${range}${endRange}`, "i"),
      );
      if (pipeDate) {
        const text = pipeDate[1];
        const roleFirst = text.match(
          new RegExp(`^(${role})\\s+(${org})$`, "i"),
        );
        if (roleFirst && roleStart.test(roleFirst[1]))
          addHeader(
            roleFirst[2],
            roleFirst[1],
            pipeDate[2],
            pipeDate[3],
            pipeDate[0],
            "role-company-pipe-date",
          );
        const companyFirst = text.match(
          new RegExp(
            `^(${org}(?:Sdn\\.?\\s*Bhd\\.?|Inc\\.?|Pte\\.?\\s*Ltd\\.?|Ltd\\.?))\\s+(${role})$`,
            "i",
          ),
        );
        if (companyFirst && roleStart.test(companyFirst[2]))
          addHeader(
            companyFirst[1],
            companyFirst[2],
            pipeDate[2],
            pipeDate[3],
            pipeDate[0],
            "company-role-pipe-date",
          );
      }
      // Parentheses label the role before tenure rather than a client/location.
      const parenthesized = rest.match(
        new RegExp(
          `^(${org})\\s+\\((${role})\\)\\s+\\(?${range}\\)?${endRange}`,
          "i",
        ),
      );
      if (parenthesized && roleStart.test(parenthesized[2]))
        addHeader(
          parenthesized[1],
          parenthesized[2],
          parenthesized[3],
          parenthesized[4],
          parenthesized[0],
          "parenthesized-role",
        );
      // A company at the heading followed by Position Title / Period labels
      // establishes an employment form without requiring a redundant Company label.
      const named = rest.match(
        new RegExp(
          `^(${org})\\s+Position(?: Title)?\\s*:\\s*([^:;]{2,120}?)\\s+Period\\s*:\\s*${range}${endRange}`,
          "i",
        ),
      );
      if (named)
        addHeader(
          named[1],
          named[2],
          named[3],
          named[4],
          named[0],
          "heading-position-period",
        );
      const employerForm = rest.match(
        new RegExp(
          `^Employer Name\\s*:?\\s*(${org})\\s+Job Title\\s*:?\\s*([^:;]{2,120}?)\\s+Period of Employment\\s*:?\\s*${range}${endRange}`,
          "i",
        ),
      );
      if (employerForm)
        addHeader(
          employerForm[1],
          employerForm[2],
          employerForm[3],
          employerForm[4],
          employerForm[0],
          "employer-job-period-form",
        );
      const numberedPosition = rest.match(
        new RegExp(
          `^Position\\s*:\\s*([^:;]{2,120}?)\\.?\\s+Company\\s*:\\s*(${org})\\s+\\(?${range}\\)?${endRange}`,
          "i",
        ),
      );
      if (numberedPosition)
        addHeader(
          numberedPosition[2],
          numberedPosition[1].replace(/[.]$/, ""),
          numberedPosition[3],
          numberedPosition[4],
          numberedPosition[0],
          "numbered-position-company",
        );

      const dateFirstPipe = rest.match(
        new RegExp(
          `^${range}\\s+([^|:;]{2,100})\\s*\\|\\s*(${org})(?=\\s+${range}|\\s+${duty}\\b|\\s*$)`,
          "i",
        ),
      );
      if (dateFirstPipe)
        addHeader(
          dateFirstPipe[4],
          dateFirstPipe[3],
          dateFirstPipe[1],
          dateFirstPipe[2],
          dateFirstPipe[0],
          "date-role-pipe-company",
        );
      const titleDatePipe = rest.match(
        new RegExp(
          `^(${role})\\s*\\|\\s*${range}\\s+(${org})(?=\\s+${duty}\\b|\\s*$)`,
          "i",
        ),
      );
      if (titleDatePipe)
        addHeader(
          titleDatePipe[4],
          titleDatePipe[1],
          titleDatePipe[2],
          titleDatePipe[3],
          titleDatePipe[0],
          "role-pipe-date-company",
        );
      const positioned = rest.match(
        new RegExp(
          `^(${org})\\s+${range}\\s+Position\\s*:\\s*([^:;]{2,120}?)(?=\\s+(?:Duties|Responsibilities|Project)\\b|\\s*$)`,
          "i",
        ),
      );
      if (positioned)
        addHeader(
          positioned[1],
          positioned[4],
          positioned[2],
          positioned[3],
          positioned[0],
          "company-date-position",
        );
      const fieldDate = rest.match(
        new RegExp(
          `^(${org})\\s+Position\\s*:\\s*(${role})\\s+${range}(?=\\s+(?:Duties|Responsibilities|Project)\\b|\\s*$)`,
          "i",
        ),
      );
      if (fieldDate)
        addHeader(
          fieldDate[1],
          fieldDate[2],
          fieldDate[3],
          fieldDate[4],
          fieldDate[0],
          "company-position-date",
        );

      const roleDateCompany = rest.match(
        new RegExp(
          `^(${role})\\s+${range}\\s+(${org})(?=\\s+${duty}\\b|\\s*[•\\uF0A7]|\\s*$)`,
          "i",
        ),
      );
      if (roleDateCompany)
        addHeader(
          roleDateCompany[4],
          roleDateCompany[1],
          roleDateCompany[2],
          roleDateCompany[3],
          roleDateCompany[0],
          "role-date-company-duty",
        );
      const datedLegal = rest.match(
        new RegExp(
          `^${range}\\s+(${org}(?:Sdn\\.?\\s*Bhd\\.?|Inc\\.?|Pte\\.?\\s*Ltd\\.?|Ltd\\.?|Limited))\\s+(${role})(?=\\s+${range}|\\s+${duty}\\b|\\s*[•\\uF0A7]|\\s*$)`,
          "i",
        ),
      );
      if (datedLegal)
        addHeader(
          datedLegal[3],
          datedLegal[4],
          datedLegal[1],
          datedLegal[2],
          datedLegal[0],
          "dated-legal-role-ledger",
        );

      const legalCompany = `(${org}(?:Sdn\\.?\\s*Bhd\\.?|Inc\\.?|Pte\\.?\\s*Ltd\\.?|Ltd\\.?|Limited|Berhad))`;
      const legalRoleDate = rest.match(
        new RegExp(
          `^${legalCompany}\\s+([^:;|]{2,120}?)\\s+${range}${endRange}`,
          "i",
        ),
      );
      if (legalRoleDate)
        addHeader(
          legalRoleDate[1],
          legalRoleDate[2],
          legalRoleDate[3],
          legalRoleDate[4],
          legalRoleDate[0],
          "legal-company-role-date",
        );
      const legalDateRole = rest.match(
        new RegExp(
          `^${legalCompany}\\s+\\(?${range}\\)?\\s+(?:[-–—]\\s*)?(${role})(?=\\s+${duty}\\b|\\s*[•\\uF0A7]|\\s*$)`,
          "i",
        ),
      );
      if (legalDateRole)
        addHeader(
          legalDateRole[1],
          legalDateRole[4],
          legalDateRole[2],
          legalDateRole[3],
          legalDateRole[0],
          "legal-company-date-role",
        );
      if (!acceptedLength) break;
      rest = rest.slice(acceptedLength).trimStart();
    }
  }
  return output.filter(
    (row, i) =>
      output.findIndex(
        (other) =>
          [other.company, other.title, other.start, other.end].join("|") ===
          [row.company, row.title, row.start, row.end].join("|"),
      ) === i,
  );
}
