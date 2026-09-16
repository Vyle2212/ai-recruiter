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
const numericMonth = "(?:0?[1-9]|1[0-2])";
const date = `(?:(?<![\\d/])${year}-${numericMonth}(?![-\\d])|(?<![\\d/])${numericMonth}/${year}(?![\\d/])|(?:${day}[ -]+)?${month}[., -]*${year}|${month}[. ]*${day}[ ,]+${year}|${year}[ |]+${month}|${year})`;
const ongoing =
  "(?:(?:till|until|to|at)\\s+(?:date|now|present)|present|current|now|continuing)";
const range = `(${date})\\s*(?:[-–—]|to|until|till)\\s*(${date}|${ongoing})`;
const job =
  "(?:Consultant|Manager|Leader|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Expert|Controller|Coordinator|Intern|Trainee|Supervisor|Advisor|Programmer|Counsellor|Clerk|Head|Therapist)";
const role = `(?:[A-Za-z0-9/&.+-]+\\s+){0,8}${job}(?:\\s*\\([^)]{1,35}\\))?`;
const roleStart =
  /^(?:Cloud|Fiori|Accounting|Collections|Collection|Speech|R2R|Module|Industrial|SCM|MM|SD|FI|CO|PP|PM|QM|BW|CRM|Deputy|Full|Tech|Package|SAP|ERP|Senior|Junior|Sr\.?|Jr\.?|Principal|Principle|Lead|Project|Program|Business|Software|Systems?|Application|Technical|Functional|Finance|Financial|Accounts?|HR|IT|ABAP|Data|Support|Industrial|Intern|Recruitment|Technology|Solution|Solutions|Associate|Assistant|Executive|Manager|Consultant|Analyst|Engineer|Developer|Secondment|CPL|Team|Group|Procurement|General|Officer|Director|Architect|Tax|Property|Workday|Graduate|Operations?|Logistics|Supply|Mechanical|Electrical|Quality|QA|Sales|Customer|Service|Network|Database|Information|Computer|Product|Process|Manufacturing|Research|Trainee|Accountant|Controller|Coordinator|Advisor|Programmer|Counsellor|Clerk|Head|Therapist)\b/i;
const org =
  "[A-Za-z0-9](?:(?!\\b(?:worked|working|employed|as)\\b)[A-Za-z0-9&.,'’() /-]){1,130}?";
const legal =
  /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Limited|Ltd\.?|Inc\.?|Berhad|Corporation)\b/gi;
const forbidden =
  /\b(?:client|customer|project|university|degree|education|references|referees|responsibilities|involved|responsible|worked|working|implemented|implementation|configuration|confidential|unknown)\b/i;
const hasJob = new RegExp(`\\b${job}\\b`, "i");
function cleanDate(value: string) {
  if (new RegExp(`^${ongoing}$`, "i").test(value)) return "Present";
  const numeric = value.match(/^(?:(\d{4})-(\d{1,2})|(\d{1,2})\/(\d{4}))$/);
  if (numeric) {
    const m = Number(numeric[2] || numeric[3]);
    if (m < 1 || m > 12) return value;
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${numeric[1] || numeric[4]}`;
  }
  return value
    .replace(new RegExp(`^(${year})[ |]+(${month})$`, "i"), "$2 $1")
    .replace(new RegExp(`^(${month})(?=\\d)`, "i"), "$1 ")
    .replace(/(\d)(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/[.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp(`^(${month}) (\\d{1,2}) (${year})$`, "i"), "$2 $1 $3");
}
function validCompany(value: string) {
  // A second legal organization after a comma can be a client. A legal suffix
  // immediately after the comma ("Example, Inc.") is still one employer.
  const comma = value.indexOf(",");
  if (
    comma >= 0 &&
    value.slice(comma + 1).match(legal)?.length &&
    !value.slice(0, comma).match(legal)?.length &&
    !/^\s*(?:Inc\b|Ltd\b|Limited\b|Sdn\b|Pte\b|Co\b)/i.test(
      value.slice(comma + 1),
    )
  )
    return false;
  return (
    !new RegExp(`^${month}$`, "i").test(value) &&
    value.replace(legal, "").replace(/[^A-Za-z]/g, "").length >= 2 &&
    !/^(?:SAP|ERP|SuccessFactors|Module|SD|MM|FI|CO|BW|Support)\b/i.test(
      value,
    ) &&
    !/^(?:Senior|Junior|Sr\.?|Jr\.?)\b/i.test(value) &&
    !/^Programmer(?=[A-Z])/.test(value) &&
    !/\bat[A-Z]/.test(value) &&
    !/\b(?:Port Operations|Pre-shipping|Pay\s*roll|Assigned|Managed|Developed|Delivered|Provided)\b/i.test(
      value,
    ) &&
    value.length >= 2 &&
    value.length <= 130 &&
    !forbidden.test(value) &&
    !/\b(?:Employer Name|Job Title|Period of Employment|Position Title)\b/i.test(
      value,
    ) &&
    !hasJob.test(
      value.match(legal)?.length && !roleStart.test(value)
        ? value.replace(/\bAssociates?\b/gi, "")
        : value,
    ) &&
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
        .replace(
          /\bProject (?=Manager|Lead|Director|Coordinator|Management Analyst)\b/gi,
          "",
        )
        .replace(/\bImplementation (?=Consultant|Manager|Lead)\b/gi, ""),
    ) &&
    !/\b(?:from|since|employed|company|industry|salary|years?|months?|period of employment)\b/i.test(
      value,
    ) &&
    !new RegExp(`\\b${year}\\b`).test(value)
  );
}

export function boundedEmploymentBatch(input: string): BoundedEmployment[] {
  const source = input
    .normalize("NFKC")
    .replace(
      /\bW\s*O\s*R\s*K\s+E\s*X\s*P\s*E\s*R\s*I\s*E\s*N\s*C\s*E\b/gi,
      "WORK EXPERIENCE",
    )
    .replace(/\b(?:W\s*O\s*R\s*K\s+)?E X P E R I E N C E\b/g, "WORK EXPERIENCE")
    .replace(/\b(?:WorkingExperiences?|WorkExperiences?)\b/g, "Work Experience")
    .replace(/\bRelevantExperiences?\b/g, "Relevant Experience")
    .replace(/\s+/g, " ")
    .replace(
      new RegExp(`\\b(\\d{1,2})(${month})\\s+(${year})\\b`, "gi"),
      "$1 $2 $3",
    )
    .replace(
      new RegExp(`\\b(${month})\\s*[’'‘]\\s*(\\d{2})\\b`, "gi"),
      (_, m, y) =>
        `${m} ${Number(y) <= 30 ? 2000 + Number(y) : 1900 + Number(y)}`,
    )
    .replace(
      new RegExp(`(${date})\\s+(?:till date|onwards)\\b`, "gi"),
      "$1 - Present",
    );
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
    if (
      group.startsWith("compact-") &&
      /^(?:Client|Customer|Project)/i.test(company)
    )
      return;
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
    "(?:\\(\\d+\\s+years?(?:\\s*(?:and\\s+)?\\d+\\s+months?)?\\)|\\(\\d+\\s+months?\\))";
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
      .replace(
        /(Consultant|Analyst|Engineer|Manager|Developer)(?=[A-Z])/g,
        "$1 ",
      )
      .replace(/(\))(?!\s)(?=[A-Z])/g, "$1 ")
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
    /\b(?:Professional Experiences?|Work(?:ing)? Experiences?|Employment(?: and Achievement)? History|Employment Record|Employment Summary|Employment Experience|Career History|Career Summary|Work History)\s*:?\s*/gi;
  const duty =
    "(?:Spearhead|Launched|Optimized|Gather|Analyse|Analyze|Consult|Trained|Provides?|Identified|Delivered|Engages|Leading|Master in|Team|Reduced|Delivered|Coordinate|Reviews|Configured|Currently|Attached|Participates|Troubleshoot|Responsibilities|Key (?:Responsibilities|Deliverables)|Job (?:Description|Scope)|Projects?|Clients?|Conduct(?:ed)?|Collaborate|Create|Lead|Led|Manage[ds]?|Develop(?:ed)?|Implement(?:ed)?|Support(?:ed)?|Perform(?:ed)?|Involved|Responsible|Handles?|Acts?|Work(?:ed)?|Review|Prepare|Providing|Provided|Assist(?:ed)?|Resolve|Ensure|Report|Design|Maintain(?:ed)?|Monitor(?:ing)?)";
  const boundary = `(?=\\s+(?:${duty}\\b|[•➔\\uF0A7*]|${date})|\\s*$)`;
  const sectionHeadings = [
    ...source.matchAll(headings),
    ...source.matchAll(/\bExperience\s*:?\s*(?=Company\s*:)/gi),
    ...source.matchAll(
      /(?<!PROJECT )(?<!WORK )(?<!PROFESSIONAL )\bEXPERIENCE\s*:?\s*/g,
    ),
  ].sort((a, b) => a.index! - b.index!);
  for (const h of sectionHeadings) {
    if (
      /\b(?:projects?|clients?|customers?|detailed)\s*$/i.test(
        source.slice(Math.max(0, h.index! - 40), h.index),
      )
    )
      continue;
    const tail = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:Education|Qualifications|Certifications|References|Referees|Technical Skills|Projects? (?:Experience|History|Details))\b/i,
      )[0];
    const rest = tail.replace(/^\d+[.)]\s*/, "");
    // Named employer blocks are parsed as fields, independent of label order.
    // Nested projects terminate this reader before their companies/dates.
    const form = tail.split(
      /\b(?:Projects?(?: Experience| History| Details| Description)?|Education|References|Referees)\s*[:#]/i,
    )[0];
    const labels = [
      ...form.matchAll(
        /\b(Company(?: Name)?|Employer|Organi[sz]ation|Position(?: Title)?(?:\s*\(Level\))?|Designation|Role|Duration|Period|Speciali[sz]ation|Industry|Clients?|Customers?|Environment|Job Scopes?|Job Description|Responsibilities|Work Description|Work Experiences?)\s*:/gi,
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
    /\b(?:Work(?:ing)? Experi[ae]nces?|Professional Experiences?|Employment(?: and Achievement)? History|Employment Experience|Employment Chronicle|Professional Background|Relevant Experience|Career Summary|Career History|Work History|Experiences?|Employment(?= [A-Z]))\s*:?\s*/gi;
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
      /\b(?:Head|Projects?|Summary|provide|providing|develop|developing|design|apply|duties|experiences?|worked|working|implemented)\b/i.test(
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
        /\s[-–—]\s/.test(company) ||
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
  let explicitEmployerTable = false;
  for (const h of source.matchAll(separatorHeadings)) {
    const headingOutputStart = output.length;
    // A separate consulting-assignment section must not supersede an explicit
    // employment table in the same CV with client organizations as employers.
    if (
      explicitEmployerTable &&
      /\bconsulting\s*$/i.test(
        source.slice(Math.max(0, h.index! - 40), h.index),
      )
    )
      continue;
    if (
      /\b(?:projects?|clients?|customers?|detailed|technical|implementation|support|years?(?: of)?)\s*$/i.test(
        source.slice(Math.max(0, h.index! - 50), h.index),
      )
    )
      continue;
    if (
      /^Career Summary/i.test(h[0]) &&
      /^(?:Manager|Director|Consultant),/i.test(
        source.slice(h.index! + h[0].length),
      )
    )
      continue;
    if (
      !/^Employment/i.test(h[0]) &&
      /\bsummary of\s*$/i.test(
        source.slice(Math.max(0, h.index! - 30), h.index),
      )
    )
      continue;
    const tail = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:Education|Qualifications|Certifications|References|Referees|Technical Skills|Personal Projects?|Projects? (?:Experience|History|Details|Involvement))\b/i,
      )[0];
    const labelledLedger = /^Role Company Duration\b/i.test(tail);
    let rest = tail
      .replace(/^and Project\s*/i, "")
      .replace(/^(?:SUMMARY|Details)\s*/i, "")
      .replace(/^ABOUT ME\s+(?=[A-Za-z]+ \d{4})/i, "")
      .replace(/^[-–—]\s*\d+\+?\s*Years?\s+in\s+SAP\s*/i, "")
      .replace(/^Role Company Duration\s*/i, "")
      .replace(/^(?:[_–—-]{3,}\s*|[•]\s*|\d+[.)]+\s*)/, "");
    for (let adjacent = 0; adjacent < 30; adjacent++) {
      acceptedLength = 0;

      // Explicit field delimiters and legal suffixes support interleaved date
      // columns. Dates are reordered only within one complete heading; reversed
      // chronology is still rejected by add(). Never pair separate job records.
      const suffix =
        "(?:Sdn\\.?\\s*Bhd\\.?|SND\\s+BHD\\.?|Pte\\.?\\s*Ltd\\.?|Ltd\\.?|Limited|Inc\\.?|Berhad)";
      const legalField = `(${org}${suffix})`;
      const headedRole = `(?:[A-Za-z0-9/&.+-]+\\s+|\\([A-Za-z /&]+\\)\\s+){0,9}${job}(?:\\s*\\([^)]{1,35}\\))?`;
      const headingStop = `(?=\\s+(?:${duty}\\b|Duties\\b|Respond\\b|Involving\\b|Name of the software\\b|[•·\\uF0A7*])|\\s*$)`;
      const interleavedSchemas = [
        {
          re: new RegExp(
            `^${range}\\s+(${role})\\s+at\\s+${legalField}(?=\\s|$)`,
            "i",
          ),
          f: [4, 3, 1, 2],
          group: "dated-role-at-employer",
        },
        {
          re: new RegExp(
            `^${range}\\s+(${role})\\s*\\|\\s*(${org})\\s*\\|\\s*[^|:;]{2,70}?${headingStop}`,
            "i",
          ),
          f: [4, 3, 1, 2],
          group: "dated-role-employer-city",
        },
        {
          re: new RegExp(
            `^(${date})\\s*[-–—]\\s*(${role})\\s+(${date}|${ongoing})\\s+${legalField}${headingStop}`,
            "i",
          ),
          f: [4, 2, 1, 3],
          group: "split-date-role-employer",
        },
        {
          re: new RegExp(
            `^(${date})\\s*[-–—]\\s*${legalField}(?:,\\s*[A-Za-z .,\\-]{2,70})?\\s+(${date}|${ongoing})\\s+(${role})${headingStop}`,
            "i",
          ),
          f: [2, 4, 1, 3],
          group: "split-date-employer-role",
        },
        {
          re: new RegExp(
            `^(${role}(?:\\s+(?:FICO|MM|SD|ABAP))?)\\s*:\\s*${range}\\s+(${org})${headingStop}`,
            "i",
          ),
          f: [4, 1, 2, 3],
          group: "role-colon-tenure-employer",
        },
        {
          re: new RegExp(
            `^(${role})\\s*\\(\\d+(?:\\.\\d+)?\\s+years?\\)\\s*\\(${range}\\)\\s+${legalField}(?=\\s|$)`,
            "i",
          ),
          f: [4, 1, 2, 3],
          group: "role-duration-tenure-employer",
        },
        {
          re: new RegExp(
            `^${range}\\s+(${headedRole})\\s*[-–—]\\s*${legalField}${headingStop}`,
            "i",
          ),
          f: [4, 3, 1, 2],
          group: "dated-role-dash-legal-employer",
        },
        {
          re: new RegExp(
            `^${range}\\s+(${org})\\s+(SAP (?:Senior )?Consultant(?:\\s*\\([A-Za-z/& ]{1,25}\\))?)(?=\\s+${range}|\\s*[-–—]|\\s*$)`,
            "i",
          ),
          f: [3, 4, 1, 2],
          group: "date-company-sap-role-ledger",
        },
      ];

      interleavedSchemas.push({
        re: new RegExp(
          `^${range}\\s+(${org})\\s+(SAP [A-Za-z/& ]{1,50}?Consultant\\s*[-–—]\\s*Internship)(?=\\s+(?:PROFILE|EDUCATION)\\b|$)`,
          "i",
        ),
        f: [3, 4, 1, 2],
        group: "dated-sap-internship-ledger",
      });
      interleavedSchemas.push(
        {
          re: new RegExp(
            `^${range}\\s*\\(${year}\\)\\s+${legalField}(?=\\s+${range})`,
            "i",
          ),
          f: [3, 0, 1, 2],
          group: "current-year-employer-ledger",
        },
        {
          re: new RegExp(
            `^PERIOD\\s*:\\s*${range}\\s+COMPANY\\s*:\\s*(${org})\\s+POSITION\\s*:\\s*([^:;]{2,100}?)\\s+EXPERIANCE\\b`,
            "i",
          ),
          f: [3, 4, 1, 2],
          group: "period-company-position-card",
        },
      );
      interleavedSchemas.push(
        {
          re: new RegExp(
            `^${range}\\s+([A-Za-z&().]{3,100})\\s+Projects\\s*:`,
            "i",
          ),
          f: [3, 0, 1, 2],
          group: "compact-employer-tenure-projects",
        },
        {
          re: new RegExp(
            `^([A-Za-z&().]{3,100})\\s+${range}\\s+\\d+\\.\\s*(AssociateConsultant|SAPConsultant)-(SuccessFactors|ABAP|FICO)\\s+(?=Joined|Worked|Working)`,
            "i",
          ),
          f: [1, 4, 2, 3],
          group: "compact-numbered-role-heading",
        },
        {
          re: new RegExp(
            `^${range}\\s+(${org})\\s+SAP Application Maintenance\\s+Client\\s*:`,
            "i",
          ),
          f: [3, 0, 1, 2],
          group: "employer-before-client-service",
        },
      );

      interleavedSchemas.push(
        {
          re: new RegExp(
            `^(${role}(?:\\s+(?:III|II|IV))?)\\s*:\\s*(${org})\\s*,\\s*${range}${headingStop}`,
            "i",
          ),
          f: [2, 1, 3, 4],
          group: "role-colon-employer-tenure",
        },
        {
          re: new RegExp(
            `^(${org})\\s*\\|\\s*${range}(?=\\s+\\d+\\.\\s*(?:Training|Projects?)\\b)`,
            "i",
          ),
          f: [1, 0, 2, 3],
          group: "employer-pipe-tenure-projects",
        },
        {
          re: new RegExp(
            `^${range}\\s*\\(\\d+\\s+years?(?:\\s+\\d+\\s+months?)?\\)\\s+((?:SAP|Senior SAP)\\s+[^:;|]{2,100}?${job})\\s+(${org})\\s*\\|`,
            "i",
          ),
          f: [4, 3, 1, 2],
          group: "export-duration-role-employer",
        },
      );

      for (const schema of interleavedSchemas) {
        const m = rest.match(schema.re);
        if (!m) continue;
        const [c, t, a, b] = schema.f;
        if (
          schema.group === "dated-role-dash-legal-employer" &&
          !/^(?:Work|Professional|Employment)/i.test(h[0])
        )
          continue;
        if (schema.group === "compact-numbered-role-heading")
          m[t] = m[t].replace(/([a-z])([A-Z])/g, "$1 $2") + " - " + m[5];
        if (schema.group === "period-company-position-card") {
          const n = output.length;
          add(m[c], m[t], m[a], m[b], m[0], schema.group);
          if (output.length > n)
            acceptedLength = Math.max(acceptedLength, m[0].length);
        } else if (t) addHeader(m[c], m[t], m[a], m[b], m[0], schema.group);
        else {
          const n = output.length;
          add(m[c], "", m[a], m[b], m[0], schema.group);
          if (output.length > n)
            acceptedLength = Math.max(acceptedLength, m[0].length);
        }
      }

      // These schemas keep title/company/date ownership at the heading. They
      // never scan ahead through a duty paragraph to find a convenient date.
      const headingSchemas = [
        {
          re: new RegExp(
            `^([^:;]{2,130}?)\\s+Start Date\\s*:\\s*(${date})\\s+End Date\\s*:\\s*(${date}|${ongoing})\\s+Job Title\\s*:\\s*([^:;]{2,120}?)(?=\\s+${duty}\\b)`,
            "i",
          ),
          f: [1, 4, 2, 3],
          group: "explicit-start-end-title",
        },
        {
          re: new RegExp(
            `^${range}\\s+\\d+[.)]\\s*(${org})\\s+Position Title\\s*:\\s*([^:;]{2,120}?)\\s+(?:Type|Specialization)\\s*:`,
            "i",
          ),
          f: [3, 4, 1, 2],
          group: "numbered-dated-position",
        },
        {
          re: new RegExp(
            `^${range}\\s+Company Name\\s*:\\s*(${org})\\s+Position\\s*:?\\s*([^:;]{2,120}?)\\s+Client\\b`,
            "i",
          ),
          f: [3, 4, 1, 2],
          group: "dated-company-position-client",
        },
        {
          re: new RegExp(
            `^(${org})\\s+((?:SAP|Senior SAP|Application)\\s+(?:[A-Za-z0-9/&.+-]+\\s+){0,7}${job})\\s*\\|\\s*${range}${endRange}`,
            "i",
          ),
          f: [1, 2, 3, 4],
          group: "company-role-date-pipe",
        },
        {
          re: new RegExp(
            `^(${org})\\s*[-–—]\\s*(${role})\\s*\\(?${range}\\)?${endRange}`,
            "i",
          ),
          f: [1, 2, 3, 4],
          group: "employer-dash-role-date",
        },
        {
          re: new RegExp(
            `^(${org})\\s+(${role})\\s*\\(${range}\\)${endRange}`,
            "i",
          ),
          f: [1, 2, 3, 4],
          group: "company-role-parenthesized-date",
        },
        {
          re: new RegExp(
            `^(${org})\\s*\\|\\s*([^|:;]{2,80}?)\\s+${range}\\s+(${role})(?=\\s+${duty}\\b)`,
            "i",
          ),
          f: [1, 5, 3, 4],
          group: "employer-location-date-role",
        },
        {
          re: new RegExp(`^(${role})\\s+(${org})\\s+${range}${endRange}`, "i"),
          f: [2, 1, 3, 4],
          group: "role-company-date-heading",
        },
      ];
      for (const schema of headingSchemas) {
        const m = rest.match(schema.re);
        if (!m) continue;
        const [c, t, a, b] = schema.f;
        if (
          /^company-role-/.test(schema.group) &&
          /\b(?:Senior|Junior|Sr|Jr)\.?\s*$/i.test(m[c])
        )
          continue;
        // Without a delimiter, a legal name is required; otherwise a company
        // word such as "Software" could be swallowed into a job title.
        if (
          schema.group === "role-company-date-heading" &&
          !m[c].match(legal)?.length &&
          /\s/.test(m[c].trim())
        )
          continue;
        if (
          /^company-role-/.test(schema.group) &&
          !/^(?:Senior )?SAP\b/i.test(m[t]) &&
          !m[c].match(legal)?.length
        )
          continue;
        addHeader(m[c], m[t], m[a], m[b], m[0], schema.group);
      }

      // An explicit SAP role prefix or uppercase role separates the company
      // from the title; generic words such as Software are not enough.
      const companySapTitle = rest.match(
        new RegExp(
          `^(${org})\\s+((?:SAP|Cloud CX)\\s+[^:;|]{1,100}?)\\s+\\(?${range}\\)?${endRange}`,
          "i",
        ),
      );
      if (
        companySapTitle &&
        validRole(companySapTitle[2]) &&
        new RegExp(`^${role}$`, "i").test(companySapTitle[2]) &&
        !/\b(?:at|as|for|with)\b/i.test(companySapTitle[2]) &&
        !/\b(?:Organization|Designation|Duration|Highlights|Contract|Senior|Junior|Sr|Jr|SAP)\b|[-–—]\s*$/i.test(
          companySapTitle[1],
        )
      )
        addHeader(
          companySapTitle[1],
          companySapTitle[2],
          companySapTitle[3],
          companySapTitle[4],
          companySapTitle[0],
          "company-explicit-role-date",
        );
      const dateUpperRole = rest.match(
        new RegExp(
          `^${range}\\s+(${org})\\s+((?:SENIOR CONSULTANT|SAP CONSULTANT))(?=\\s+(?:Managed|AMS|Duties|Responsibilities)\\b)`,
          "i",
        ),
      );
      if (
        dateUpperRole &&
        dateUpperRole[3].match(legal)?.length &&
        dateUpperRole[4] === dateUpperRole[4].toUpperCase()
      )
        addHeader(
          dateUpperRole[3],
          dateUpperRole[4],
          dateUpperRole[1],
          dateUpperRole[2],
          dateUpperRole[0],
          "date-employer-uppercase-role",
        );
      const repeatedRole = rest.match(
        new RegExp(
          `^${range}\\s+(${role})\\s+(${org})\\s+(?=SAP [A-Za-z /&-]+Consultant for\\b)`,
          "i",
        ),
      );
      if (repeatedRole && !repeatedRole[4].includes(","))
        addHeader(
          repeatedRole[4],
          repeatedRole[3],
          repeatedRole[1],
          repeatedRole[2],
          repeatedRole[0],
          "date-role-company-assignment-boundary",
        );
      // A labelled duration before a role and legal employer is self-contained.
      const durationHeading = rest.match(
        new RegExp(
          `^Duration\\s*:\\s*${range}\\s+(${role})\\s*[-–—]?\\s*(?:\\(Contracting\\)\\s*)?(${org}(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Limited|Ltd\\.?))\\s+Roles & Responsibilities`,
          "i",
        ),
      );
      if (durationHeading)
        addHeader(
          durationHeading[4],
          durationHeading[3],
          durationHeading[1],
          durationHeading[2],
          durationHeading[0],
          "duration-role-legal-employer",
        );
      // Employer-only headings remain employer-only. Projects following them
      // cannot supply a role, a replacement date or an extra employer.
      const employerTenure = rest.match(
        new RegExp(
          `^(${org})\\s+${range}(?=\\s+(?:Industry\\s*:|[•\\uF0A7]|Project\\s*:))`,
          "i",
        ),
      );
      if (
        employerTenure &&
        !roleStart.test(employerTenure[1]) &&
        !/[,/]|\b(?:language|skills|summary|can|contribute|company)\b/i.test(
          employerTenure[1],
        ) &&
        /^[A-Z]/.test(employerTenure[1])
      ) {
        const prior = output.length;
        add(
          employerTenure[1],
          "",
          employerTenure[2],
          employerTenure[3],
          employerTenure[0],
          "explicit-employer-tenure-heading",
        );
        if (output.length > prior)
          acceptedLength = Math.max(acceptedLength, employerTenure[0].length);
      }
      // A double-delimited pair is unambiguous in either field order; only one
      // side may contain a role. Slash delimiters must be surrounded by spaces.
      const legalOrg = `(${org}(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Co\\.?\\s*,?\\s*Ltd\\.?|Inc\\.?|Limited|Ltd\\.?|Berhad))`;
      const stopDuty = `(?=\\s+(?:${duty}\\b|[•·\\uF0A7*]|[-–—]\\s*[A-Za-z])|\\s*$)`;
      // Date / role / comma / employer, with a repeated legal company name or
      // a duty label providing the end boundary. Never consume client prose.
      const datedComma = rest.match(
        new RegExp(`^${range}\\s+(${role})\\s*,\\s*${legalOrg}(?=\\s|$)`, "i"),
      );
      if (datedComma)
        addHeader(
          datedComma[4],
          datedComma[3],
          datedComma[1],
          datedComma[2],
          datedComma[0],
          "date-role-comma-employer",
        );
      const roleComma = rest.match(
        new RegExp(
          `^(${role})\\s*,\\s*(${org})\\s*[:,]?\\s*\\(?${range}\\)?${endRange}`,
          "i",
        ),
      );
      if (roleComma)
        addHeader(
          roleComma[2],
          roleComma[1],
          roleComma[3],
          roleComma[4],
          roleComma[0],
          "role-comma-employer-date",
        );
      // Legal employer suffix is an explicit field boundary even without a pipe.
      const datedLegalHeader = rest.match(
        new RegExp(`^${range}\\s+${legalOrg}\\s+(${role})${stopDuty}`, "i"),
      );
      if (datedLegalHeader)
        addHeader(
          datedLegalHeader[3],
          datedLegalHeader[4],
          datedLegalHeader[1],
          datedLegalHeader[2],
          datedLegalHeader[0],
          "date-legal-employer-role",
        );
      const dateSlash = rest.match(
        new RegExp(`^${range}\\s+(${org})\\s+/\\s+(${role})${stopDuty}`, "i"),
      );
      if (dateSlash)
        addHeader(
          dateSlash[3],
          dateSlash[4],
          dateSlash[1],
          dateSlash[2],
          dateSlash[0],
          "date-employer-slash-role",
        );
      // A labelled role after employer tenure belongs to that employment heading.
      const companyDateRole = rest.match(
        new RegExp(
          `^(${org})\\s+${range}\\s+Role\\s*:\\s*(${role})${stopDuty}`,
          "i",
        ),
      );
      if (companyDateRole)
        addHeader(
          companyDateRole[1],
          companyDateRole[4],
          companyDateRole[2],
          companyDateRole[3],
          companyDateRole[0],
          "employer-date-labelled-role",
        );
      const roleCompanyParen = rest.match(
        new RegExp(
          `^(${role})\\s+(${org})\\s*[,]?\\s*\\(${range}\\)${endRange}`,
          "i",
        ),
      );
      if (roleCompanyParen)
        addHeader(
          roleCompanyParen[2],
          roleCompanyParen[1],
          roleCompanyParen[3],
          roleCompanyParen[4],
          roleCompanyParen[0],
          "role-employer-parenthesized-date",
        );
      // Parenthesized tenure and an explicit dash before the role delimit the
      // heading; the next adjacent employer may begin directly afterwards.
      const companyParenRole = rest.match(
        new RegExp(
          `^(${org})\\s+\\(${range}\\)\\s*[-–—]\\s*(${role})(?=\\s|$)`,
          "i",
        ),
      );
      if (companyParenRole)
        addHeader(
          companyParenRole[1],
          companyParenRole[4],
          companyParenRole[2],
          companyParenRole[3],
          companyParenRole[0],
          "employer-parenthesized-date-role",
        );
      // Company / title / date comma-separated headings. NFKC handles fullwidth commas.
      const commaCells = rest.match(
        new RegExp(
          `^([^,;:]{2,130}),\\s*(${role})\\s*,\\s*${range}${endRange}`,
          "i",
        ),
      );
      if (commaCells)
        addHeader(
          commaCells[1],
          commaCells[2],
          commaCells[3],
          commaCells[4],
          commaCells[0],
          "comma-employer-role-date",
        );
      const roleSlash = rest.match(
        new RegExp(`^(${role})\\s*/\\s*(${org})\\s+${range}${endRange}`, "i"),
      );
      if (roleSlash)
        addHeader(
          roleSlash[2],
          roleSlash[1],
          roleSlash[3],
          roleSlash[4],
          roleSlash[0],
          "role-slash-employer-date",
        );
      const roleCompanyDate = rest.match(
        new RegExp(
          `^(${role})\\s+(${org})\\s+${range}(?=\\s*[,]|\\s+${duty}\\b|\\s*$)`,
          "i",
        ),
      );
      if (roleCompanyDate)
        addHeader(
          roleCompanyDate[2],
          roleCompanyDate[1],
          roleCompanyDate[3],
          roleCompanyDate[4],
          roleCompanyDate[0],
          "role-employer-date-duty",
        );
      const titledEmployer = rest.match(
        new RegExp(
          `^${range}\\s+(${role})\\s+Employer\\s*:\\s*(${org})(?=\\s+Location\\s*:|\\s+Responsibilities\\b|\\s*$)`,
          "i",
        ),
      );
      if (titledEmployer)
        addHeader(
          titledEmployer[4],
          titledEmployer[3],
          titledEmployer[1],
          titledEmployer[2],
          titledEmployer[0],
          "dated-title-labelled-employer",
        );
      // A slash heading can contain an explicit city after a legal employer;
      // retain it as location text, never as a role or a second employer.
      const roleLegalLocation = rest.match(
        new RegExp(
          `^(${role})\\s*,\\s*(${org})\\s+[–—]\\s*${range}${endRange}`,
          "i",
        ),
      );
      if (roleLegalLocation)
        addHeader(
          roleLegalLocation[2],
          roleLegalLocation[1],
          roleLegalLocation[3],
          roleLegalLocation[4],
          roleLegalLocation[0],
          "role-comma-located-employer",
        );
      const datedNamed = rest.match(
        new RegExp(`^${range}\\s+(${org})\\s+(SAP\\s+${role})${stopDuty}`, "i"),
      );
      if (
        datedNamed &&
        /^SAP\b/i.test(datedNamed[4]) &&
        !roleStart.test(datedNamed[3])
      )
        addHeader(
          datedNamed[3],
          datedNamed[4],
          datedNamed[1],
          datedNamed[2],
          datedNamed[0],
          "date-employer-role-duty",
        );
      const datedRoleCompany = rest.match(
        new RegExp(
          `^${range}\\s+(${role})\\s+(${org})(?=\\s+${duty}\\b|\\s*[•\\uF0A7]|\\s*$)`,
          "i",
        ),
      );
      if (datedRoleCompany)
        addHeader(
          datedRoleCompany[4],
          datedRoleCompany[3],
          datedRoleCompany[1],
          datedRoleCompany[2],
          datedRoleCompany[0],
          "date-role-employer-duty",
        );
      const datedCommaLabel = rest.match(
        new RegExp(
          `^${range}\\s+(${role})\\s*,\\s*(${org})(?=\\s+Role\\s*:)`,
          "i",
        ),
      );
      if (datedCommaLabel)
        addHeader(
          datedCommaLabel[4],
          datedCommaLabel[3],
          datedCommaLabel[1],
          datedCommaLabel[2],
          datedCommaLabel[0],
          "date-role-comma-employer-labelled-duties",
        );
      if (labelledLedger) {
        const ledger = rest.match(
          new RegExp(`^(${role})\\s+(${org})\\s+${range}${endRange}`, "i"),
        );
        if (ledger)
          addHeader(
            ledger[2],
            ledger[1],
            ledger[3],
            ledger[4],
            ledger[0],
            "role-company-duration-table",
          );
      }
      const datedRoleEmployer = rest.match(
        new RegExp(
          `^${range}\\s+([^:;]{2,110}?)\\s+Employer\\s*:\\s*(${org})(?=\\s+Location\\s*:)`,
          "i",
        ),
      );
      if (
        datedRoleEmployer &&
        /^.+(?:Specialist|Consultant|Analyst|Manager)(?:, [A-Z]{2,5})?$/i.test(
          datedRoleEmployer[3],
        )
      ) {
        const prior = output.length;
        add(
          datedRoleEmployer[4],
          datedRoleEmployer[3],
          datedRoleEmployer[1],
          datedRoleEmployer[2],
          datedRoleEmployer[0],
          "dated-role-employer-location-form",
        );
        if (output.length > prior)
          acceptedLength = Math.max(
            acceptedLength,
            datedRoleEmployer[0].length,
          );
      }
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
      const employerLedger = rest.match(
        new RegExp(
          `^${legalOrg}\\s+\\(${range}(?:,\\s*Contract role)?\\)(?=\\s|$)`,
          "i",
        ),
      );
      if (employerLedger) {
        const prior = output.length;
        add(
          employerLedger[1],
          "",
          employerLedger[2],
          employerLedger[3],
          employerLedger[0],
          "legal-employer-tenure-ledger",
        );
        if (output.length > prior)
          acceptedLength = Math.max(acceptedLength, employerLedger[0].length);
      }
      if (!acceptedLength) break;
      rest = rest.slice(acceptedLength).trimStart();
    }
    if (
      /^Employment\b/i.test(h[0]) &&
      output
        .slice(headingOutputStart)
        .some((j) => j.group === "company-role-date-pipe")
    )
      explicitEmployerTable = true;
  }
  // Explicit numbered Organization / Designation / From / To tables own both
  // date columns. Numbering and the next row boundary prevent duty resync.
  for (const heading of source.matchAll(
    /\bOrganization Name Designation From Date To Date\s*/gi,
  )) {
    let rest = source.slice(heading.index! + heading[0].length);
    for (let row = 0; row < 40; row++) {
      const m = rest.match(
        new RegExp(
          `^\\d+\\s+(${org})\\s+((?:Sr\\.?|Senior|Junior|SAP|Manager|Consultant)\\b[^:;]{0,100}?)\\s+(${date})\\s+(${date}|${ongoing})(?=\\s+\\d+\\s|\\s*$)`,
          "i",
        ),
      );
      if (!m) break;
      const previous = output.length;
      add(
        m[1],
        m[2],
        m[3],
        m[4],
        m[0],
        "numbered-organization-designation-table",
      );
      if (output.length === previous) break;
      rest = rest.slice(m[0].length).trimStart();
    }
  }
  // The explicit five-column schema distinguishes employment dates/company
  // from project notes. Stop at the next row and never read dates from notes.
  const numericDate = "(?:0?[1-9]|1[0-2])-(?:19|20)\\d{2}";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  for (const heading of source.matchAll(
    /\bStart End Title Comp\.? Name Notes\s*/gi,
  )) {
    const section = source
      .slice(heading.index! + heading[0].length)
      .split(
        /\b(?:Education|Certification|References|Project Experience)\b/i,
      )[0];
    const rows = [
      ...section.matchAll(
        new RegExp(`(?:^|\\s)(${numericDate})\\s+(${numericDate})\\s+`, "g"),
      ),
    ];
    for (const [index, row] of rows.entries()) {
      const body = section.slice(
        row.index! + row[0].length,
        rows[index + 1]?.index,
      );
      const fields = body.match(
        new RegExp(
          `^(${role}(?:\\s+(?:Senior|Junior))?)\\s+(${org})(?=\\s+(?:SAP (?:Implementation|Project Support|Roll-Out)|AMS Delivery|Implementation|Roll-Out)\\b)`,
          "i",
        ),
      );
      if (!fields || !roleStart.test(fields[1])) continue;
      const toMonth = (d: string) => {
        const [m, y] = d.split("-");
        return `${months[+m - 1]} ${y}`;
      };
      add(
        fields[2],
        fields[1],
        toMonth(row[1]),
        toMonth(row[2]),
        row[0].trimStart() + fields[0],
        "start-end-role-company-notes-table",
      );
    }
  }

  // Labelled employer cards survive whitespace loss because Organization,
  // Duration, Designation and Key Role explicitly separate the four fields.
  // Split known role words only inside the designation field, never company text.
  for (const h of source.matchAll(
    /\b(?:Work(?:ing)?\s*Experiences?|Professional\s*Experiences?|Employment(?: and Achievement)? History|EXPERIENCE)\s*:?\s*/gi,
  )) {
    if (
      /\b(?:project|client|customer)\s*$/i.test(
        source.slice(Math.max(0, h.index! - 40), h.index),
      )
    )
      continue;
    const section = source
      .slice(h.index! + h[0].length)
      .split(/\b(?:Education|Academic|References|Certifications)\b/i)[0];
    const card = new RegExp(
      `(?:^|\\s)Organization\\s*:?\\s*([A-Za-z][^:;]{1,100}?)\\s*Duration\\s*:?\\s*${range}\\s*Designation\\s*:?\\s*([A-Za-z][^:;]{1,110}?)\\s*Key\\s*Role`,
      "gi",
    );
    for (const m of /^Organization\b|^Organization(?=[A-Z])/.test(section)
      ? section.matchAll(card)
      : []) {
      const title = m[4].replace(/([a-z])([A-Z])/g, "$1 $2");
      add(m[1], title, m[2], m[3], m[0], "joined-labelled-organization-card");
    }

    const bracket = new RegExp(
      `\\[\\d+\\.\\s*([^\\]]{2,160})\\]\\s*\\|\\s*\\[([^\\]]{2,130})\\]\\s*\\|\\s*\\[${range}\\]`,
      "gi",
    );
    for (const m of /^\[\d+\./.test(section) ? section.matchAll(bracket) : [])
      add(m[2], m[1], m[3], m[4], m[0], "numbered-bracket-employment");
    // A range plus numbered company plus Position Title/Type is a complete
    // employment record, not a numbered project or a role within its duties.
    const numbered = new RegExp(
      `${range}\\s+\\d+[.)]\\s*(${org})\\s+Position Title\\s*:\\s*([^:;]{2,120}?)\\s+(?:Type|Specialization)\\s*:`,
      "gi",
    );
    for (const m of new RegExp(`^${range}\\s+\\d+[.)]`, "i").test(section)
      ? section.matchAll(numbered)
      : [])
      add(m[3], m[4], m[1], m[2], m[0], "numbered-dated-position");
    // Explicit numbered Company records can retain tenure with unknown title.
    // Do not take a client role later in the record as the employer's title.
    const companyRecord = new RegExp(
      `(?:^|\\s)\\d+[.)]\\s*Company\\s*:\\s*(${org})\\s*,\\s*${range}(?=\\s|$)`,
      "gi",
    );
    for (const m of /^\d+[.)]\s*Company\s*:/i.test(section)
      ? section.matchAll(companyRecord)
      : [])
      add(m[1], "", m[2], m[3], m[0], "numbered-company-tenure");
    // Numbered Employer records own their tenure, even if project details are
    // interleaved between records. A project-only section cannot initiate this.
    for (const m of (/^Employer\s+\d+\s*:/i.test(section)
      ? section
      : ""
    ).matchAll(
      new RegExp(
        `\\bEmployer\\s+\\d+\\s*:\\s*(${role})\\s*[-–—]\\s*(${org})\\s*\\(${range}\\)`,
        "gi",
      ),
    ))
      add(m[2], m[1], m[3], m[4], m[0], "numbered-employer-role-tenure");
  }
  // Industry/Portfolio is an explicit employment summary table; the separate
  // Projects heading ends it, so project durations cannot leak into tenure.
  for (const h of source.matchAll(
    /\bEXPERIENCE\s*:\s*INDUSTRY PORTFOLIO\s*/g,
  )) {
    const section = source
      .slice(h.index! + h[0].length)
      .split(/\bPROJECTS\s*:/)[0];
    const re = new RegExp(
      `(?:^|\\s)Consulting\\s+(${org})\\s*-\\s*Duration\\s*:\\s*(?:from\\s+)?${range}\\s*-\\s*Role\\s*:\\s*([^:;]{2,120}?)(?=\\s+Consulting\\s|\\s*$)`,
      "gi",
    );
    for (const m of section.matchAll(re))
      add(m[1], m[4], m[2], m[3], m[0], "industry-portfolio-employment-table");
  }

  // Employment Summary states organization and total tenure; Current Role is
  // not evidence that the current title applied to every year of that tenure.
  for (const m of source.matchAll(
    new RegExp(
      `\\bEmployment Summary\\s*:\\s*Organization\\s*:\\s*(${org})\\s+Experience\\s*:\\s*\\d+\\s+years?\\s*\\(${range}\\)\\s+Current Role\\s*:`,
      "gi",
    ),
  ))
    add(m[1], "", m[2], m[3], m[0], "organization-summary-tenure");
  // Whitespace-loss exports still carry case-delimited explicit employment
  // sentences. Decode only the role's camel boundaries; keep the employer as
  // written. A bare start and narrative/project dates are not complete ranges.
  const compactDate = `(?:${month})[- ]?${year}`;
  const compactStatement = new RegExp(
    `(?:Working|Worked)as(SAP[A-Za-z./&]{0,55}?(?:Consultant|Lead|Developer))in([A-Z][A-Za-z0-9&.,()]{2,100}?),\\s*from\\s*(${compactDate})\\s*to(${compactDate}|tilldate)(?=[.\\s▶]|$)`,
    "g",
  );
  for (const m of source.matchAll(compactStatement)) {
    const title = m[1]
      .replace(/^SAP/, "SAP ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/Sr\./g, "Sr. ");
    add(
      m[2],
      title,
      m[3],
      m[4] === "tilldate" ? "Present" : m[4],
      m[0],
      "compact-explicit-employment-sentence",
    );
  }

  // Explicit Company / From / To / Duration columns: each numbered row has two
  // endpoints. Duration is retained in the excerpt, never used to create dates.
  for (const h of source.matchAll(
    /\bS\.?No\.? Company From Date To Date Duration\s*\(in Years\)\s*/gi,
  )) {
    if (
      !/\b(?:Employment (?:History|Summary)|Experience Summary)\s*:?\s*$/i.test(
        source.slice(Math.max(0, h.index! - 80), h.index),
      )
    )
      continue;
    let rest = source.slice(h.index! + h[0].length);
    for (let row = 0; row < 40; row++) {
      const m = rest.match(
        new RegExp(
          `^\\d+\\s+(${org})\\s+(${date})\\s+(?:-\\s*)?(${date}|${ongoing})\\s+\\d+(?:\\.\\d+)?(?=\\s+\\d+\\s|\\s+Total\\b|\\s*$)`,
          "i",
        ),
      );
      if (!m) break;
      const previous = output.length;
      add(m[1], "", m[2], m[3], m[0], "numbered-company-from-to-table");
      if (output.length === previous) break;
      rest = rest.slice(m[0].length).trimStart();
    }
  }

  // Repeated labelled employment cards retain field ownership across job
  // descriptions. Each card must provide Date, Company and Position in order.
  for (const h of source.matchAll(
    /\bWork(?:ing)? Experiences?\s*:?\s*(?=Date\s*:)/gi,
  )) {
    const section = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:EDUCATION|QUALIFICATIONS|PROJECT EXPERIENCE|REFERENCES)\b/i,
      )[0];
    for (const m of section.matchAll(
      new RegExp(
        `(?:^|\\s)Date\\s*:\\s*${range}\\s+Company\\s*:\\s*([^:;]{2,160}?)\\s+Position\\s*:\\s*([^:;]{2,100}?)\\s+Job Descriptions?\\s*:`,
        "gi",
      ),
    )) {
      const company = m[3].replace(/\s*[–—]\s*[A-Za-z, ]+$/, "");
      add(company, m[4], m[1], m[2], m[0], "date-company-position-cards");
    }
  }

  // Dense employment summaries have adjacent date/company/SAP-role rows. The
  // entire intervening text must be a row; never search through responsibilities.
  for (const h of source.matchAll(/\bSUMMARY OF EMPLOYMENT\s*/gi)) {
    const section = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:PROJECTS?|EDUCATION|TRAINING|CERTIFICATIONS?|REFERENCES)\b/i,
      )[0];
    const ranges = [...section.matchAll(new RegExp(range, "gi"))];
    for (let i = 0; i < ranges.length; i++) {
      const text = section
        .slice(
          ranges[i].index! + ranges[i][0].length,
          ranges[i + 1]?.index ?? section.length,
        )
        .trim();
      const m = text.match(
        new RegExp(
          `^(${org})\\s+(SAP (?:Senior )?Consultant(?:\\s*\\([A-Za-z/& ]{1,25}\\))?(?:\\s*[-–—]\\s*[A-Za-z/& ]{2,30}Team Lead)?)$`,
          "i",
        ),
      );
      if (m)
        add(
          m[1],
          m[2],
          ranges[i][1],
          ranges[i][2],
          ranges[i][0] + text,
          "summary-employment-sap-ledger",
        );
    }
  }
  // Chronological company/title/date ledgers have no duty paragraphs. A whole
  // cell between adjacent ranges must match; narrative fragments stay rejected.
  for (const h of source.matchAll(/\bEMPLOYMENT CHRONICLE\s*/gi)) {
    const section = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:Academic|Professional Qualifications|Personal|Projects)\b/i,
      )[0];
    let priorEnd = 0;
    for (const m of section.matchAll(new RegExp(range, "gi"))) {
      const fields = section
        .slice(priorEnd, m.index)
        .trim()
        .replace(/\b(Sr|Jr)\.(?=[A-Z])/g, "$1. ");
      const parts = fields.match(
        new RegExp(
          `^(${org})\\s+((?:(?:Sr\\.?|Jr\\.?|Senior|Junior|Project|Application|ERP|EDP)\\s+${role}|PM\\b[^:;]{1,90}))$`,
          "i",
        ),
      );
      if (parts)
        add(
          parts[1],
          parts[2],
          m[1],
          m[2],
          fields + " " + m[0],
          "employment-chronicle-ledger",
        );
      priorEnd = m.index! + m[0].length;
    }
  }

  // Career sections exported from visual CV builders often preserve every
  // field but interleave the columns. Scan only self-contained headings with a
  // legal employer boundary or an explicit field label. Do not resynchronise
  // on project/client prose, and never take a project date as employer tenure.
  const legalSuffix =
    "(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Co\\.?\\s*,?\\s*Ltd\\.?|Limited|Ltd\\.?|Inc\\.?|Berhad|Corporation)";
  const legalEmployer = `(${org}${legalSuffix})`;
  // A contract heading explicitly distinguishes the contracting employer from
  // the organisation served. Keep the client annotation as evidence only.
  // Require the contract marker, legal employer and literal "for" relation;
  // ordinary project/client/date cards must never enter this reader.
  const contractingHeading = new RegExp(
    `\\b((?:SAP|Senior|Junior|Technical|Functional|Solution|Solutions)\\s+${role}\\s*\\(Contract\\))\\s+${legalEmployer}\\s+\\(for\\s+[^()]{2,130}\\)\\s+${range}(?=\\s|$)`,
    "gi",
  );
  for (const m of source.matchAll(contractingHeading)) {
    if (/\b(?:Client|Customer|Project)\s*:\s*$/i.test(source.slice(Math.max(0, m.index! - 30), m.index))) continue;
    add(m[2], m[1], m[3], m[4], m[0], "contract-employer-client-annotation");
  }
  // Year/Description career summaries put role and employer before duty text.
  // Only the explicitly named table supplies row boundaries. Detailed project
  // sections terminate the table even when they repeat employer names.
  for (const header of source.matchAll(/\bWork Experience\s+Year\s+Description\s*/gi)) {
    const section = source.slice(header.index! + header[0].length).split(
      /\b(?:Key Projects|Projects?\s*(?:&\s*Assignments|Experience|Details|History)|Education|References)\b/i,
    )[0];
    const periods = [...section.matchAll(new RegExp(range, "gi"))];
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const fields = section.slice(period.index! + period[0].length, periods[i + 1]?.index ?? section.length).trim();
      const m = fields.match(new RegExp(
        `^((?:SAP|Senior|Junior|Technical|Functional)\\s+${role})\\s+(${org})(?=\\s+(?:Responsible\\b|(?:MM|SD|FI|CO|SAP|Functional)\\s+(?:consultants?|Lead)\\b))`, "i",
      ));
      if (m) add(m[2], m[1], period[1], period[2], period[0] + " " + m[0], "year-description-career-table");
    }
  }
  // Explicit From/To/Description tables carry the date at the start of each
  // row. Split periods first; a preceding row can never supply the next title.
  for (const header of source.matchAll(
    /\bCareer History\s+\(From\)\s+\(To\)\s+\(Description\)\s*/gi,
  )) {
    const section = source
      .slice(header.index! + header[0].length)
      .split(
        /\b(?:Project Experience|Project History|Project Details|Education|References|Technical Skills)\b/i,
      )[0];
    const periods = [...section.matchAll(new RegExp(range, "gi"))];
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const fields = section
        .slice(
          period.index! + period[0].length,
          periods[i + 1]?.index ?? section.length,
        )
        .trim();
      const row = fields.match(
        /^(.{2,120}?)\s+((?:SAP|Senior|Junior|Project|Technical|Functional|Software|IT|Business|Systems?)\b.{2,110})$/i,
      );
      if (!row) continue;
      // A comma-delimited location is not part of the employer. Keep commas
      // belonging to a legal suffix (Example, Inc.) intact.
      const company = row[1].replace(
        /,\s*(?!(?:Inc|Ltd|Limited)\b)[A-Za-z][A-Za-z ,.'-]*$/i,
        "",
      );
      add(
        company,
        row[2],
        period[1],
        period[2],
        period[0] + " " + fields,
        "from-to-description-ledger",
      );
    }
  }
  // A labelled positions ledger owns the period, employer and activity/title
  // within EACH date-delimited row. Never borrow the previous row's title.
  for (const header of source.matchAll(
    /\bList of professional positions\s+Period\s+Organi[sz]ation\s+Description of activities\s*/gi,
  )) {
    const section = source
      .slice(header.index! + header[0].length)
      .split(
        /\b(?:Education|References|Project Details|Project Experience)\b/i,
      )[0];
    const periods = [...section.matchAll(new RegExp(range, "gi"))];
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const fields = section
        .slice(
          period.index! + period[0].length,
          periods[i + 1]?.index ?? section.length,
        )
        .trim();
      const row = fields.match(
        new RegExp(`^${legalEmployer}\\s+(${role})$`, "i"),
      );
      if (row)
        add(
          row[1],
          row[2],
          period[1],
          period[2],
          period[0] + " " + fields,
          "labelled-professional-positions-ledger",
        );
    }
  }
  const careerSections = [
    ...source.matchAll(
      /\b(?:WORK EXPERIENCE|Work Experience|WORK HISTORY|Work History|Professional Experiences?|Employment History|Career History|CAREER HIGHLIGHTS|EXPERIENCES?|Experiences?)\b\s*:?\s*/g,
    ),
  ];
  for (const heading of careerSections) {
    if (
      /\b(?:project|client|customer|industry|technical)\s*$/i.test(
        source.slice(Math.max(0, heading.index! - 45), heading.index),
      )
    )
      continue;
    const section = source
      .slice(heading.index! + heading[0].length)
      .split(
        /\b(?:Education|Academic Qualifications|Certifications|References|Referees|Personal Details)\b/i,
      )[0]
      .slice(0, 24000);
    // Labelled position cards own the first employer and both tenure endpoints.
    // Labels must precede project/client fields; nested project dates are never
    // a fallback. System/tool descriptions bound the complete position title.
    const positionCard = section.match(
      new RegExp(
        `^(${org})\\s+Duration\\s*:\\s*${range}\\s*(?:\\([^)]{1,100}\\)\\s*)?Position(?: Title(?: \\(level\\))?)?\\s*:\\s*([^:;]{2,120}?)\\s+(?:Tools?\\s*&\\s*Systems?|Modules|Responsibilities|Work Descriptions?)\\s*:`,
        "i",
      ),
    );
    if (positionCard)
      add(
        positionCard[1],
        positionCard[4],
        positionCard[2],
        positionCard[3],
        positionCard[0],
        "heading-duration-position-tools",
      );
    // Former legal names are annotations on an explicitly dated employer,
    // not a second employer. A multi-role summary does not establish one title
    // for its whole tenure, so preserve that tenure with an unknown title.
    const formerHeading = section.match(
      new RegExp(
        `^(${org})\\s*[([](?:formerly(?: known as)?|previously known as)\\s+[^)\\]]{2,100}[)\\]]\\s*(?:[–—-]\\s*[A-Za-z][A-Za-z .'-]{1,50},\\s*[A-Za-z][A-Za-z ]{1,40}?\\s+)?\\(?${range}\\)?(?=\\s+(?:Held multiple roles|Team Project Description)|$)`,
        "i",
      ),
    );
    if (formerHeading)
      add(
        formerHeading[1],
        "",
        formerHeading[2],
        formerHeading[3],
        formerHeading[0],
        "former-employer-tenure-summary",
      );
    // Column-major tables have their own ownership-aware reader. Reading the
    // flattened row order here would pair one row's period with the next row.
    const columnMajorHeader =
      /\b(?:Position\s+Company\s+Period|Role\s+Company\s+Duration)\b/i.test(
        section,
      );

    const projectBoundary = section.search(
      /\b(?:Current\s+Projects?\s+(?:History|Experience|Details)\s*:?|Current\s+Projects?\s*:|Projects?\s+(?:History|Experience|Details)\s*:?|Projects?\s*:)/i,
    );
    const beforeProjects = (index: number | undefined) =>
      projectBoundary < 0 || (index ?? 0) < projectBoundary;
    const strictCareerTitle = (value: string) =>
      /^[A-Z]/.test(value) &&
      (roleStart.test(value) ||
        /^(?:Employee|Contract|Sales|Secretary|Corporate|ATR|Account|MIS|Credit|SuccessFactors)\b/.test(
          value,
        )) &&
      value.split(/\s+/).length <= 12 &&
      !/[.!?]/.test(value) &&
      !/\b(?:provide|providing|perform|process|focused|certain|improve|enhancement|intake|implemented|implementation|project scope|providers?|documents?|designation duration|organization designation|main business|worked|working)\b/i.test(
        value,
      );
    const strictCareerCompany = (value: string) =>
      /^[A-Z]/.test(value) &&
      value.length <= 100 &&
      !/[A-Za-z]{36,}/.test(value) &&
      !/\b(?:certified|focused|responsibilities|training|project|client|main business|organization designation|complementary systems|carried|reduced)\b/i.test(
        value,
      );
    const atCareerRowBoundary = (index: number | undefined) => {
      const prefix = section
        .slice(0, index)
        .trim()
        .replace(/\bFrom\s*$/i, "")
        .trim();
      if (!prefix) return true;
      // Narrative sentences end a record. A corporate suffix's full stop does
      // not: the following date/title can still belong to that same employer.
      return (
        /[.!?]$/.test(prefix) &&
        !new RegExp(`${legalSuffix}\\s*$`, "i").test(prefix)
      );
    };
    const careerRole = `${role}(?:\\s+(?:II|III|IV))?`;

    // A legal suffix delimits a company name, not a row. In a flattened CV,
    // an interior period/title can belong to the PREVIOUS employer. These two
    // ambiguous grammars need a career-section start or a narrative sentence
    // boundary. Contiguous role/date/company rows must follow an owned row;
    // other interior rows require one of the labelled/table readers instead.
    const datedRoleLegal = new RegExp(
      `${range}\\s+(${careerRole})\\s*,?\\s+${legalEmployer}`,
      "gi",
    );
    for (const m of section.matchAll(datedRoleLegal)) {
      if (columnMajorHeader) continue;
      // A city followed by numbered duties also explicitly ends a career
      // heading in exports whose narrative bullets lost their punctuation.
      const numberedDuties = /^,\s*[A-Z][A-Za-z ]{1,60}\s+1[.)]\s/.test(
        section.slice(m.index! + m[0].length),
      );
      if (!atCareerRowBoundary(m.index) && !numberedDuties) continue;
      if (!beforeProjects(m.index)) continue;
      if (!strictCareerTitle(m[3]) || !strictCareerCompany(m[4])) continue;
      add(m[4], m[3], m[1], m[2], m[0], "career-date-role-legal-employer");
    }

    const roleDatedLegal = new RegExp(
      `(${careerRole})(?:\\s*\\|\\s*[^|:;]{2,70}\\s*\\|)?\\s+${range}\\s+${legalEmployer}`,
      "gi",
    );
    let ownedRoleRowEnd = 0;
    for (const m of section.matchAll(roleDatedLegal)) {
      if (columnMajorHeader) continue;
      if (
        !atCareerRowBoundary(m.index) &&
        section.slice(ownedRoleRowEnd, m.index).trim()
      )
        continue;
      if (!beforeProjects(m.index)) continue;
      if (!strictCareerTitle(m[1]) || !strictCareerCompany(m[4])) continue;
      add(m[4], m[1], m[2], m[3], m[0], "career-role-date-legal-employer");
      ownedRoleRowEnd = m.index! + m[0].length;
    }

    // Some profile builders render the legal employer immediately before a
    // role, then append a product/specialisation after a dash. Keep the
    // specialisation out of the employer field.
    const casedCareerRange = range
      .replace(/[A-Z]/g, (letter) => `[${letter}${letter.toLowerCase()}]`)
      .replaceAll("present", "[Pp]resent")
      .replaceAll("current", "[Cc]urrent")
      .replaceAll("now", "[Nn]ow")
      .replaceAll("continuing", "[Cc]ontinuing");
    const employerRoleSpecialisation = new RegExp(
      `\\b([A-Z][A-Z0-9&.,()'/]*(?:\\s+[A-Z][A-Z0-9&.,()'/]*){1,10})\\s+((?:SAP|ERP)\\s+[A-Z][A-Z0-9/&.+-]*(?:\\s+[A-Z][A-Z0-9/&.+-]*){0,6})\\s*-\\s*[^0-9]{2,120}?\\s+${casedCareerRange}`,
      "g",
    );
    for (const m of section.matchAll(employerRoleSpecialisation)) {
      if (!beforeProjects(m.index)) continue;
      if (m[1] !== m[1].toUpperCase()) continue;
      if (!strictCareerTitle(m[2]) || !strictCareerCompany(m[1])) continue;
      add(
        m[1],
        m[2],
        m[3],
        m[4],
        m[0],
        "career-employer-role-specialisation-tenure",
      );
    }

    const dashedRoleCompany = new RegExp(
      `((?:SAP|ERP)\\s+${role})\\s*-\\s*(${org})\\s+${range}(?=\\s|$)`,
      "gi",
    );
    for (const m of section.matchAll(dashedRoleCompany)) {
      if (!beforeProjects(m.index)) continue;
      // A second spaced dash identifies a product/module description, not an
      // employer. That layout is handled by the preceding bounded reader.
      if (/\s[-–—]\s/.test(m[2])) continue;
      if (!strictCareerTitle(m[1]) || !strictCareerCompany(m[2])) continue;
      add(m[2], m[1], m[3], m[4], m[0], "career-role-dash-employer-tenure");
    }

    // A descriptive company card explicitly labels Job Title after the company
    // description. The description cannot contribute a company or a date.
    const datedJobTitleCard = new RegExp(
      `${range}\\s+(PT\\.?\\s+[A-Z][A-Za-z0-9&.,() -]{2,100}?)(?=\\s+(?:A member|A high-energy|Our |The |Vision|Company |[A-Z][a-z]+ is|Job Title))[^:]{0,650}?\\s+Job Title\\s*:\\s*(${role})(?=\\s|$)`,
      "gi",
    );
    for (const m of section.matchAll(datedJobTitleCard))
      add(m[3], m[4], m[1], m[2], m[0], "career-date-company-job-title-card");

    // Explicit service/designation fields retain ownership despite a company
    // description between them. Limit this to the first legal employer in the
    // section so client names in duties cannot start another record.
    const serviceDesignation = section.match(
      new RegExp(
        `^(${org}${legalSuffix})[^:]{0,1800}?Year\\(s\\) of Service\\s*:\\s*${range}\\s+Designation\\s*:\\s*(${role})(?=\\s+Role\\s*:|\\s|$)`,
        "i",
      ),
    );
    if (serviceDesignation)
      add(
        serviceDesignation[1],
        serviceDesignation[4],
        serviceDesignation[2],
        serviceDesignation[3],
        serviceDesignation[0],
        "career-service-designation-card",
      );
  }

  // Recruitment-system resumes have an explicit title/employer/range grammar.
  // Restrict this reader to sources bearing the system marker; durations and
  // industry tags after the range are ignored.
  if (/\bSystem generated resume\b/i.test(source)) {
    const generatedBody = source.split(/\bSystem generated resume\b/i)[1];
    const generatedRole =
      "(?:(?:Senior|Junior|SAP|Logistics|Assistant|Principal|Software|Business|Quality|Failure|Conventional|Accounts?|Project|Application|Technical|Functional|IT|Data|Package|Packaged)\\s+)(?:[A-Za-z0-9/&.+()-]+\\s+){0,7}" +
      `${job}(?:\\s*\\([^)]{1,35}\\))?`;
    const generated = new RegExp(
      `(${generatedRole})\\s+(?:@\\s*)?(${org})\\s*-\\s*${range}(?=[.\\s]|$)`,
      "gi",
    );
    for (const m of generatedBody.matchAll(generated)) {
      if (
        m[1].length > 100 ||
        m[1].split(/\s+/).length > 10 ||
        /[a-z][A-Z]/.test(m[1]) ||
        /\b(?:providers?|projects?|documents?|responsibilities?)\b/i.test(m[1])
      )
        continue;
      if (/^by\b/i.test(m[1])) continue;
      const company = m[2]
        .replace(/\\s*\\([^)]*(?:Under|Contract)[^)]*\\)\\s*$/i, "")
        .trim();
      add(
        company,
        m[1],
        m[3],
        m[4],
        m[0],
        "generated-resume-role-employer-tenure",
      );
    }
  }

  // Numbered employment tables may have a final free-text Comments column.
  // Every row must carry both dates before comments. Row numbering restarts no
  // schema outside this explicit header, and notes cannot supply missing dates.
  for (const h of source.matchAll(
    /\bOrganization Name Designation From Date To Date Comments\s*/gi,
  )) {
    if (
      !/\bEMPLOYMENT\b/i.test(
        source.slice(Math.max(0, h.index! - 100), h.index),
      )
    )
      continue;
    const section = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:PERSONAL DETAILS|EDUCATION|PROJECT DETAILS|REFERENCES)\b/i,
      )[0];
    const rows = [
      ...section.matchAll(
        new RegExp(`(?:^|\\s)(\\d{1,2})\\s+(?!${month}\\b)(?=[A-Z])`, "g"),
      ),
    ];
    let expected = 1;
    for (let i = 0; i < rows.length; i++) {
      if (+rows[i][1] !== expected) continue;
      const offset = rows[i].index! + rows[i][0].length;
      const text = section.slice(offset, rows[i + 1]?.index ?? section.length);
      const m = text.match(
        new RegExp(
          `^(${org})\\s+((?:Sr\\.?|Jr\\.?|Senior|Junior|Consultant|Executive)\\b[^:;]{0,65}?)\\s+(${date})\\s*(?:[-–—]\\s*)?(${date}|${ongoing})(?=\\s|$)`,
          "i",
        ),
      );
      if (!m || !roleStart.test(m[2])) break;
      const n = output.length;
      add(m[1], m[2], m[3], m[4], m[0], "organization-date-comments-ledger");
      if (output.length === n) break;
      expected++;
    }
  }
  // Joined Date/Company Name/Role headers occur in text exports. The next date
  // is the row boundary, so company/title fields never absorb project prose.
  for (const h of source.matchAll(
    /\bEMPLOYMENT HISTORY\s+DateCompany NameRole\s*/gi,
  )) {
    const section = source
      .slice(h.index! + h[0].length)
      .split(/\b(?:EDUCATION|PROJECTS|REFERENCES)\b/i)[0];
    const rows = [...section.matchAll(new RegExp(`${range}\\s*`, "gi"))];
    for (let i = 0; i < rows.length; i++) {
      const text = section
        .slice(
          rows[i].index! + rows[i][0].length,
          rows[i + 1]?.index ?? section.length,
        )
        .trim();
      const m = text.match(
        new RegExp(
          `^(${org})\\s+((?:Senior|Junior|SAP|Software)\\s+${role})$`,
          "i",
        ),
      );
      if (m)
        add(
          m[1],
          m[2],
          rows[i][1],
          rows[i][2],
          rows[i][0] + text,
          "joined-date-company-role-table",
        );
    }
  }
  // Whitespace-free source still needs explicit heading/duty boundaries. Decode
  // only recognized role words and printed date tokens; keep employer literal.
  for (const h of source.matchAll(/\bWork Experience\s*:\s*/gi)) {
    const text = source.slice(h.index! + h[0].length);
    const compactDate = `(${month})((?:19|20)\\d{2})`;
    const m = text.match(
      new RegExp(
        `^${compactDate}to${compactDate}\\s+(SAPConsultant|SAPDeveloper|SAPAnalyst)\\s+([A-Za-z&().]{3,100})\\s+Duties\\s*:`,
        "i",
      ),
    );
    if (m)
      add(
        m[6],
        m[5].replace(/^SAP/i, "SAP "),
        `${m[1]} ${m[2]}`,
        `${m[3]} ${m[4]}`,
        m[0],
        "compact-career-heading",
      );
  }

  for (let i = output.length - 1; i >= 0; i--) {
    const row = output[i];
    if (
      row.group === "summary-employment-sap-ledger" ||
      row.group === "dated-sap-internship-ledger"
    )
      continue;
    if (
      output.some(
        (other) =>
          other.group === "dated-sap-internship-ledger" &&
          other.company === row.company &&
          other.start === row.start &&
          other.end === row.end &&
          other.title.startsWith(row.title + " - "),
      )
    ) {
      output.splice(i, 1);
      continue;
    }
    if (
      output.some(
        (other) =>
          other.group === "summary-employment-sap-ledger" &&
          other.company === row.company &&
          other.start === row.start &&
          other.end === row.end &&
          other.title.startsWith(row.title + " – "),
      )
    )
      output.splice(i, 1);
  }

  // Keep established readers first when another schema repeats the same job.
  const addedSchemas = new Set([
    "dated-sap-internship-ledger",
    "dated-role-at-employer",
    "dated-role-employer-city",
    "split-date-role-employer",
    "split-date-employer-role",
    "role-colon-tenure-employer",
    "role-duration-tenure-employer",
    "dated-role-dash-legal-employer",
    "date-company-sap-role-ledger",
    "role-colon-employer-tenure",
    "employer-pipe-tenure-projects",
    "export-duration-role-employer",
    "compact-employer-tenure-projects",
    "compact-numbered-role-heading",
    "employer-before-client-service",
    "date-company-position-cards",
    "summary-employment-sap-ledger",
    "employment-chronicle-ledger",
    "organization-date-comments-ledger",
    "joined-date-company-role-table",
    "compact-career-heading",
    "current-year-employer-ledger",
    "period-company-position-card",
    "explicit-start-end-title",
    "numbered-dated-position",
    "dated-company-position-client",
    "company-role-date-pipe",
    "employer-dash-role-date",
    "company-role-parenthesized-date",
    "employer-location-date-role",
    "role-company-date-heading",
    "company-explicit-role-date",
    "date-employer-uppercase-role",
    "date-role-company-assignment-boundary",
    "duration-role-legal-employer",
    "explicit-employer-tenure-heading",
    "joined-labelled-organization-card",
    "numbered-bracket-employment",
    "numbered-company-tenure",
    "numbered-employer-role-tenure",
    "industry-portfolio-employment-table",
    "organization-summary-tenure",
    "compact-explicit-employment-sentence",
    "numbered-company-from-to-table",
  ]);
  output.sort(
    (a, b) =>
      Number(addedSchemas.has(a.group)) - Number(addedSchemas.has(b.group)),
  );
  return output.filter(
    (row, i) =>
      output.findIndex(
        (other) =>
          [other.company, other.title, other.start, other.end].join("|") ===
          [row.company, row.title, row.start, row.end].join("|"),
      ) === i,
  );
}
