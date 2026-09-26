import { careerDateRange, validCareerDateRange } from "./careerDateEvidence";

export type LayoutEmployment = {
  company: string;
  title: string;
  start?: string;
  end?: string;
  excerpt: string;
};
const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `(?:(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])|${month}\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[/.]\\s*(?:19|20)\\d{2})`;
const range = new RegExp(
  `(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Curr)`,
  "i",
);
const role =
  /\b(?:consultant|manager|officer|associate|intern|trainee|specialist|executive|lead|head|analyst|engineer|developer|analytic|contractor|administrator|advisor|advisory|technician|tutor|QA Automation|support|management|housekeeper|promoter|expert|recruiter|generalist)\b/i;
const forbidden =
  /^(?:[•●]|client\b|project\s*[:\t]|responsibilit|environment\b|contract for\b)|\b(?:went live|go.live|implementation project)\b/i;
const heading =
  /^(?:professional (?:work )?experiences?|employment history|work history|career backgrou(?:nd|d)|work(?:ing)? experience)\s*:?$/i;
const stop =
  /^(?:career highlight|extra-curricular|referees|education|references?|skills|hobbies|technology summary|professional certificates|community leadership|academic qualifications|detailed work experiences?|project (?:history|experience|details))\b/i;

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
  let projectDetails = false;
  let table:
    | "career"
    | "year"
    | "scope"
    | "dateCompanyRole"
    | "periodRoleIndustry"
    | undefined;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (heading.test(line)) {
      active = true;
      projectDetails = false;
      continue;
    }
    // A narrow left sidebar can put a two-line heading beside the first role.
    if (/^EMPLOYMENT\s+/.test(line) && /^HISTORY\s+/.test(lines[i + 1] || "")) {
      active = true;
      line = line.replace(/^EMPLOYMENT\s+/, "");
    }
    if (stop.test(line)) active = false;
    if (/EMPLOYMENT HISTORY/.test(line)) {
      active = true;
      projectDetails = false;
    }
    // A project subsection can name a client and a role with its own dates.
    // Only a fresh employment heading may re-enable the new career-card rules.
    if (/^(?:implementations?\s*\/\s*)?projects?\s*:/i.test(line))
      projectDetails = true;
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
    if (/^Company\tJob Title\tProject\tDuration$/i.test(line)) {
      table = "career";
      continue;
    }
    if (/^Period\tRole\tIndustry\tDescription$/i.test(line)) {
      table = "periodRoleIndustry";
      continue;
    }
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
        /^[,;:]/.test(company) ||
        !role.test(title) ||
        forbidden.test(company) ||
        // PDF bullet glyphs can disappear. A following imperative duty must
        // not become the employer in a date/title/company layout.
        /^(?:Conduct(?:ed|ing)?|Perform(?:ed|ing)?|Maintain(?:ed|ing)?|Provide[ds]?|Ensure[ds]?|Develop(?:ed|ing)?|Prepare[ds]?)\s+[a-z]/.test(
          company,
        ) ||
        /^(?:Provided?|Designed?|Developed?|Conducted?|Maintained?|Performed?)\s/i.test(
          title,
        ) ||
        /^Support (?:day to day|daily|the|all|users?\b)/i.test(title) ||
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
    if (!projectDetails) {
      // DOC/DOCX can place each explicitly named employment field in its own
      // paragraph. Require the full local card, not a date from a later row.
      if (/^(?:company[’']?s?\s+name|employer\s+name)$/i.test(line)) {
        const company = next;
        const titleLabel = lines[i + 2] || "";
        const title = lines[i + 3] || "";
        const periodLabel = lines[i + 4] || "";
        const printedPeriod = lines[i + 5] || "";
        const dates = careerDateRange(printedPeriod);
        if (
          /^position\s+title$/i.test(titleLabel) &&
          /^period$/i.test(periodLabel) &&
          dates?.[0] === printedPeriod &&
          validCareerDateRange(dates[1], dates[2]) &&
          /^[\p{L}][^\t:@!?]{2,120}$/u.test(company) &&
          !forbidden.test(company) &&
          !forbidden.test(title) &&
          title.length >= 3 &&
          title.length <= 120 &&
          !careerDateRange(title)
        ) {
          output.push({
            company,
            title,
            start: dates[1],
            end: dates[2],
            excerpt: lines.slice(i, i + 6).join("\n"),
          });
          i += 5;
          continue;
        }
      }
      // In a headed chronology the parenthesized tenure belongs to this
      // company line, with the position on the immediately following line.
      const parenthesized = line.match(
        /^([^\t:@!?()]{3,120})\s+\(([^()]{7,75})\)$/,
      );
      const parenthesizedDates =
        parenthesized && careerDateRange(parenthesized[2]);
      if (
        parenthesized &&
        parenthesizedDates &&
        parenthesizedDates[0] === parenthesized[2] &&
        validCareerDateRange(parenthesizedDates[1], parenthesizedDates[2]) &&
        /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pty\.?\s*Ltd\.?|Berhad|Limited|Ltd\.?|Inc\.?)$/i.test(
          parenthesized[1],
        ) &&
        !/\b(?:consultant|manager|analyst|engineer|developer|architect|programmer|supervisor|associate|specialist)\b/i.test(
          parenthesized[1],
        ) &&
        role.test(next) &&
        next.length <= 100 &&
        !forbidden.test(parenthesized[1]) &&
        !forbidden.test(next) &&
        !/\b(?:client|customer|project)\b/i.test(parenthesized[1])
      ) {
        output.push({
          company: parenthesized[1].trim(),
          title: next,
          start: parenthesizedDates[1],
          end: parenthesizedDates[2],
          excerpt: line + "\n" + next,
        });
        i++;
        continue;
      }
      // A legal employer may precede one short address line and a right-
      // aligned role/tenure. The legal suffix anchors employer ownership.
      const roleLine = lines[i + 2] || "";
      const roleDates = careerDateRange(roleLine);
      const legalEmployer =
        /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pty\.?\s*Ltd\.?|Limited|Ltd\.?|Inc\.?|Berhad)$/i.test(
          line,
        );
      if (
        legalEmployer &&
        next.length <= 55 &&
        !role.test(next) &&
        !careerDateRange(next) &&
        !forbidden.test(next) &&
        roleDates &&
        roleDates.index! > 0 &&
        !roleLine.slice(roleDates.index! + roleDates[0].length).trim() &&
        role.test(roleLine.slice(0, roleDates.index)) &&
        validCareerDateRange(roleDates[1], roleDates[2])
      ) {
        output.push({
          company: line,
          title: roleLine.slice(0, roleDates.index).trim(),
          start: roleDates[1],
          end: roleDates[2],
          excerpt: lines.slice(i, i + 3).join("\n"),
        });
        i += 2;
        continue;
      }
    }
    if (table === "career" && cells.length === 4) {
      const years = cells[3].match(
        /^((?:19|20)\d{2})\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|Present)$/i,
      );
      const half = cells[3].match(
        /^((?:19|20)\d{2})\s*\((1st|2nd) 6 months\)$/i,
      );
      const dates =
        years ||
        (half
          ? `${half[2] === "1st" ? "Jan" : "Jul"} ${half[1]} - ${half[2] === "1st" ? "Jun" : "Dec"} ${half[1]}`.match(
              range,
            )
          : null);
      if (dates) add(cells[0], cells[1], dates, 1);
      continue;
    }
    if (table === "periodRoleIndustry" && cells.length === 4) {
      const continued = next.split("\t").map((x) => x.trim());
      const dates = `${cells[0]} ${continued[0]}`.match(
        new RegExp(
          `^(${date})\\s*[-–—]\\s*(${date}|Present|Current|Curr)$`,
          "i",
        ),
      );
      // The description cell must itself name a legal employer, never a client.
      if (
        dates &&
        /\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Limited|Ltd\.?)$/i.test(
          cells[3],
        ) &&
        !forbidden.test(cells[3])
      ) {
        const continuation = continued[1] || "";
        const title = /-$/.test(cells[1])
          ? cells[1].slice(0, -1) + continuation
          : [cells[1], continuation].filter(Boolean).join(" ");
        add(cells[3], title, dates, 2);
        i++;
        continue;
      }
    }
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
      if (
        !role.test(next) &&
        !next.includes("\t") &&
        !stop.test(next) &&
        role.test(lines[i + 2] || "")
      ) {
        add(next, lines[i + 2], wholeDates, 3);
        i += 2;
        continue;
      }
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
    // ISO month sidebar followed by a title cell and the employer below it.
    if (
      wholeDates?.index === 0 &&
      /^\t/.test(line.slice(wholeDates[0].length)) &&
      role.test(line.slice(wholeDates[0].length)) &&
      !role.test(next) &&
      !stop.test(next)
    ) {
      add(next, line.slice(wholeDates[0].length).trim(), wholeDates, 2);
      continue;
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
