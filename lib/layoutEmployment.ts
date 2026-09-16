export type LayoutEmployment = {
  company: string;
  title: string;
  start?: string;
  end?: string;
  excerpt: string;
};
const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[/.]\\s*(?:19|20)\\d{2})`;
const range = new RegExp(
  `(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Curr)`,
  "i",
);
const role =
  /\b(?:consultant|manager|officer|associate|intern|trainee|specialist|executive|lead|head|analyst|engineer|developer|analytic|contractor|administrator|advisor|advisory|technician|tutor|QA Automation|support|management|housekeeper|promoter)\b/i;
const forbidden =
  /^(?:[•●]|client\b|project\s*[:\t]|responsibilit|environment\b|contract for\b)|\b(?:went live|go.live|implementation project)\b/i;
const heading =
  /^(?:professional (?:work )?experiences?|employment history|work(?:ing)? experience)\s*:?$/i;
const stop =
  /^(?:education|references?|skills|hobbies|technology summary|professional certificates|community leadership|academic qualifications|detailed work experiences?|project (?:history|experience|details))\b/i;

function normalizeHeading(line: string): string {
  const compact = line.replace(/[\s\uE000-\uF8FF]/g, "").toUpperCase();
  const headings: Record<string, string> = {
    WORKEXPERIENCE: "Work Experience",
    PROFESSIONALEXPERIENCE: "Professional Experience",
    EDUCATION: "Education",
    TECHNOLOGYSUMMARY: "Technology Summary",
  };
  return headings[compact] || line;
}

/** Only line-bounded employment headings; never infer dates from assignment prose. */
export function layoutEmployment(source: string): LayoutEmployment[] {
  const rawLines = source
    .normalize("NFKC")
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => normalizeHeading(x.trim()))
    .filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    // DOCX raw text emits each table cell as its own paragraph.
    if (
      /^(Role|Employer|Client|Project)$/i.test(rawLines[i]) &&
      rawLines[i + 1]
    )
      lines.push(rawLines[i++] + "\t" + rawLines[i]);
    else lines.push(rawLines[i]);
  }
  const output: LayoutEmployment[] = [];
  let active = false;
  let table: "year" | "scope" | "dateCompanyRole" | undefined;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (heading.test(line)) {
      active = true;
      continue;
    }
    // A narrow left sidebar can put a two-line heading beside the first role.
    if (/^EMPLOYMENT\s+/.test(line) && /^HISTORY\s+/.test(lines[i + 1] || "")) {
      active = true;
      line = line.replace(/^EMPLOYMENT\s+/, "");
    }
    if (stop.test(line)) active = false;
    if (/EMPLOYMENT HISTORY/.test(line)) active = true;
    if (
      active &&
      /^Year\tEmployer \/ Company\tRole\tResponsibilities\tYears in Company$/.test(
        line,
      )
    ) {
      table = "year";
      continue;
    }
    if (active && /^Name of Company\tScope of Work\tYear$/.test(line)) {
      table = "scope";
      continue;
    }
    if (active && /^Date\s*\tCompany Name\s*\tRole$/i.test(line)) {
      table = "dateCompanyRole";
      continue;
    }
    if (!active) continue;
    const next = (lines[i + 1] || "").replace(/^HISTORY\s+/, "");
    const add = (
      company: string,
      title: string,
      dates: RegExpMatchArray | null,
      count: number,
    ) => {
      company = company.trim();
      title = title.trim().split(/\s+reporting to\b/i)[0];
      if (
        !company ||
        !role.test(title) ||
        forbidden.test(company) ||
        forbidden.test(title)
      )
        return;
      output.push({
        company,
        title,
        start: dates?.[1],
        end: dates?.[2],
        excerpt: lines.slice(i, i + count).join("\n"),
      });
    };
    const cells = line.split("\t").map((x) => x.trim());
    if (
      table === "dateCompanyRole" &&
      cells.length === 3 &&
      new RegExp(`^${date}$`, "i").test(cells[0]) &&
      cells[1].trim() &&
      cells[2].trim()
    ) {
      let title = cells[2].trim();
      // A wrapped table cell remains on its own physical line; never take the next row's date.
      let count = 1;
      if (
        !next.includes("\t") &&
        !stop.test(next) &&
        /[.]$/.test(next) &&
        /\(Project\)/i.test(title) &&
        next.length < 100
      ) {
        title += " " + next;
        count++;
      }
      output.push({
        company: cells[1].trim(),
        title,
        start: cells[0],
        excerpt: lines.slice(i, i + count).join("\n"),
      });
      i += count - 1;
      continue;
    }
    if (
      table === "year" &&
      cells.length === 5 &&
      new RegExp(`^${date}$`, "i").test(cells[0])
    ) {
      const dates = cells[4].match(range);
      const title = cells[2];
      if (role.test(title) || /tester/i.test(title))
        output.push({
          company: cells[1],
          title,
          start: dates?.[1] || cells[0],
          end: dates?.[2],
          excerpt: line,
        });
      continue;
    }
    if (
      table === "scope" &&
      cells.length === 3 &&
      /^Roles & Responsibilities\s+Roles\b/.test(cells[1])
    ) {
      const title = cells[1].match(
        /^Roles & Responsibilities\s+Roles\s+[•●]?\s*(.*?)\s+Responsibilities\b/,
      )?.[1];
      const company = cells[0].split(
        /\s+(?:Jalan|\d+(?:st|nd|rd|th)?\s+Floor|IT Department|Prima\s+\d|Level\s+\d|Website\s*:)/i,
      )[0];
      const dates = cells[2].replace(/\bMac\b/g, "March").match(range);
      if (title && dates?.index === 0) add(company, title, dates, 1);
      continue;
    }
    if (forbidden.test(line)) continue;
    const sharedYearMonths = line.match(
      new RegExp(`^(${month})\\s*[-–—]\\s*(${month})$`, "i"),
    );
    if (
      sharedYearMonths &&
      !role.test(next) &&
      !forbidden.test(next) &&
      /^(?:19|20)\d{2}$/.test(lines[i + 2] || "") &&
      role.test(lines[i + 3] || "")
    ) {
      const year = lines[i + 2];
      add(
        next,
        lines[i + 3],
        `${sharedYearMonths[1]} ${year} - ${sharedYearMonths[2]} ${year}`.match(
          range,
        ),
        4,
      );
      continue;
    }
    const undatedAt = line.match(
      /^([A-Za-z][^,.\t]{2,70}) at ([A-Za-z][^\t]{2,140})$/,
    );
    if (
      undatedAt &&
      role.test(undatedAt[1]) &&
      !/\b(?:19|20)\d{2}\b|\b(?:client|project|worked|working|responsible|supporting)\b/i.test(
        line,
      )
    ) {
      add(undatedAt[2].split(/,|\s+selling\b/i)[0], undatedAt[1], null, 1);
      continue;
    }
    if (
      !role.test(line) &&
      !line.includes("\t") &&
      new RegExp(`^${date}\\s*[-–—]$`, "i").test(next) &&
      role.test(lines[i + 2] || "") &&
      new RegExp(`^${month}$`, "i").test(lines[i + 3] || "") &&
      /^(?:19|20)\d{2}$/.test(lines[i + 4] || "")
    ) {
      add(
        line,
        lines[i + 2],
        `${next} ${lines[i + 3]} ${lines[i + 4]}`.match(range),
        5,
      );
      continue;
    }
    // A right-hand date may wrap around the adjacent role in PDF reading order.
    if (
      !role.test(line) &&
      !line.includes("\t") &&
      new RegExp(`^${date}$`, "i").test(next) &&
      role.test(lines[i + 2] || "") &&
      /^[-–—]\s*(?:Present|Current)$/i.test(lines[i + 3] || "")
    ) {
      add(line, lines[i + 2], (next + " " + lines[i + 3]).match(range), 4);
      continue;
    }
    const roleMonth = next.match(new RegExp(`^([^\\t]+)\\t(${month})$`, "i"));
    const middleDate = lines[i + 2] || "";
    const lastDate = (lines[i + 3] || "").match(/^([^\t]+)\t((?:19|20)\d{2})$/);
    if (
      !role.test(line) &&
      !line.includes("\t") &&
      roleMonth &&
      lastDate &&
      new RegExp(`^(?:19|20)\\d{2}\\s*[-–—]\\s*${month}$`, "i").test(middleDate)
    ) {
      add(
        line,
        roleMonth[1],
        `${roleMonth[2]} ${middleDate} ${lastDate[2]}`.match(range),
        4,
      );
      continue;
    }
    const wholeDates = line.match(range);
    if (
      wholeDates &&
      wholeDates.index === 0 &&
      !line.slice(wholeDates[0].length).replace(/[-–—]/g, "").trim()
    ) {
      const company = lines[i + 2] || "";
      if (
        role.test(next) &&
        !role.test(company) &&
        !company.includes("\t") &&
        !stop.test(company)
      ) {
        add(company, next, wholeDates, 3);
        continue;
      }
    }
    // A complete date followed by the employer is an explicit two-line heading.
    if (
      wholeDates?.index === 0 &&
      line.slice(wholeDates[0].length).trim() &&
      role.test(next)
    ) {
      add(
        line
          .slice(wholeDates[0].length)
          .trim()
          .replace(/\s*\(Based in\b.*$/i, ""),
        next,
        wholeDates,
        2,
      );
      continue;
    }
    // Role on its own line followed by employer and a right-aligned tenure.
    const employerDates = next.match(range);
    if (
      role.test(line) &&
      line.length <= 120 &&
      !/[.|\t:]/.test(line) &&
      !range.test(line) &&
      employerDates &&
      employerDates.index! > 0 &&
      !next.slice(employerDates.index! + employerDates[0].length).trim()
    ) {
      add(
        next
          .slice(0, employerDates.index)
          .trim()
          .replace(/\s*\|$/, ""),
        line,
        employerDates,
        2,
      );
      continue;
    }
    const served = next.match(/^Served as (.{3,120}?)(?:\s+(?:to|for)\b|,)/i);
    const located = line.match(
      new RegExp(
        `^(.{2,140}),[^()]{1,50}\\((${range.source})\\)\\s*[-–—]`,
        "i",
      ),
    );
    if (served && located) {
      add(located[1], served[1], located[2].match(range), 2);
      continue;
    }
    const followingCompany = next.match(/^([^|\t]{2,140})\s*\|\s*(.+)$/);
    if (
      role.test(line) &&
      !/[|\t]/.test(line) &&
      !range.test(line) &&
      followingCompany
    ) {
      const dates = followingCompany[2].match(range);
      if (dates?.[0] === followingCompany[2])
        add(followingCompany[1], line, dates, 2);
      continue;
    }
    const comma = line.match(/^([^,]{3,120}),\s*([^,]{2,140})$/);
    if (
      comma &&
      (role.test(comma[1]) || /^Current Position$/i.test(comma[1]))
    ) {
      const dates = next.match(range);
      if (dates?.index === 0) {
        const title = /^Current Position$/i.test(comma[1]) ? "" : comma[1];
        output.push({
          company: comma[2],
          title,
          start: dates[1],
          end: dates[2],
          excerpt: line + "\n" + next,
        });
        continue;
      }
    }
    // Explicit Role / Employer / Client tables: retain employer and title even
    // when the only dates describe a client engagement, leaving tenure unknown.
    const labelled = line.match(/^Role\s*[:\t ]\s*(.+)$/i);
    const employer = next.match(/^Employer\s*[:\t ]\s*(.+)$/i);
    if (labelled && employer) {
      const dates = employer[1].match(range);
      add(
        dates ? employer[1].slice(0, dates.index).trim() : employer[1],
        labelled[1],
        dates,
        2,
      );
      continue;
    }
    const pipe = line.match(
      /^([^|\t]{2,140})\s*\|\s*([^\t]{3,120})(?:\t[^\t]+)?$/,
    );
    if (pipe) {
      // Date is a right-hand cell on this heading or its immediately next row.
      const dates =
        line.match(range) ||
        next.match(new RegExp(`(?:^|\\t)${range.source}\\s*$`, "i"));
      if (dates)
        add(
          pipe[1],
          pipe[2]
            .replace(range, "")
            .trim()
            .replace(/\s*\|$/, ""),
          dates,
          2,
        );
      continue;
    }
    // Right-aligned end years sometimes wrap alongside the employer on the next row.
    const wrapped = line.match(
      new RegExp(`^(.*?)\\t(${date}\\s*[-–—]\\s*${month})\\s*$`, "i"),
    );
    const yearCell = next.match(/^(.*?)\t((?:19|20)\d{2})$/);
    if (wrapped && yearCell) {
      add(
        yearCell[1],
        wrapped[1],
        `${wrapped[2]} ${yearCell[2]}`.match(range),
        2,
      );
      continue;
    }
    const dates = line.match(range);
    if (
      dates &&
      dates.index! > 0 &&
      !line.slice(dates.index! + dates[0].length).trim()
    ) {
      const left = line.slice(0, dates.index).trim();
      const nextLeft = next.split("\t")[0].trim();
      if (role.test(left) && !role.test(nextLeft)) {
        const department = left.match(/\s+at\s+(.+)$/i);
        // Department wording can wrap before a final, explicitly named employer.
        const company = department
          ? `${department[1]} ${nextLeft}`.split(",").at(-1)!.trim()
          : nextLeft;
        add(company, left, dates, 2);
      } else if (!role.test(left) && role.test(nextLeft))
        add(left, nextLeft, dates, 2);
      continue;
    }
    // Company on its own line, then date range, then a job title.
    const nextDates = next.match(range);
    if (
      !role.test(line) &&
      nextDates?.[0] === next &&
      !line.includes("\t") &&
      (!/[.!?]$/.test(line) || /\b(?:Ltd|Inc|Bhd|Corp|Co)\.$/i.test(line))
    ) {
      add(line, lines[i + 2] || "", nextDates, 3);
    }
  }
  return output;
}
