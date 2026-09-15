export type LayoutEmployment = {
  company: string;
  title: string;
  start?: string;
  end?: string;
  excerpt: string;
};
const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])/(?:19|20)\\d{2})`;
const range = new RegExp(
  `(${date})\\s*[-–—]\\s*(${date}|Present|Current)`,
  "i",
);
const role =
  /\b(?:consultant|manager|officer|associate|intern|specialist|executive|lead|head|analyst|engineer|developer|analytic|contractor|administrator|advisory|technician|tutor)\b/i;
const forbidden =
  /^(?:[•●]|client\b|project\s*[:\t]|responsibilit|environment\b|contract for\b)|\b(?:went live|go.live|implementation project)\b/i;
const heading =
  /^(?:professional (?:work )?experiences?|employment history|work(?:ing)? experience)\s*:?$/i;
const stop =
  /^(?:education|references|skills|professional certificates|community leadership|academic qualifications|detailed work experiences?|project (?:history|experience|details))\b/i;

/** Only line-bounded employment headings; never infer dates from assignment prose. */
export function layoutEmployment(source: string): LayoutEmployment[] {
  const rawLines = source
    .normalize("NFKC")
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => x.trim())
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
  let table: "year" | "scope" | undefined;
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
    if (!active) continue;
    const next = (lines[i + 1] || "").replace(/^HISTORY\s+/, "");
    const add = (
      company: string,
      title: string,
      dates: RegExpMatchArray | null,
      count: number,
    ) => {
      company = company.trim();
      title = title.trim();
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
    const cells = line.split("\t");
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
    const followingCompany = next.match(/^([^|\t]{2,140})\s*\|\s*(.+)$/);
    if (role.test(line) && !line.includes("\t") && followingCompany) {
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
      if (dates) add(pipe[1], pipe[2].replace(range, "").trim(), dates, 2);
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
    if (!role.test(line) && nextDates?.[0] === next && !line.includes("\t")) {
      add(line, lines[i + 2] || "", nextDates, 3);
    }
  }
  return output;
}
