import { careerMonthIndex } from "./candidateCareerExperience";
import { sapProjectTypeEvidence } from "./candidatePortalEditEvidence";
import {
  projectDateRange,
  projectDateIsCurrent,
  validProjectDateRange,
} from "./projectDateEvidence";
import { PROJECT_DATE_TOKEN_PATTERN } from "./projectDateEvidence";

const monthName =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
function cardDateRange(value: string) {
  const full =
    projectDateRange(value) ||
    projectDateRange(value.replace(/\buntil\b/gi, "to"));
  if (full) return full;
  const shared = value.match(
    new RegExp(
      `\\b(${monthName})\\s*[-–—]\\s*(${monthName})\\s+((?:19|20)\\d{2})\\b`,
      "i",
    ),
  );
  if (!shared) return null;
  // A trailing shared year is only unambiguous for a forward same-year range.
  const start = `${shared[1]} ${shared[3]}`;
  const end = `${shared[2]} ${shared[3]}`;
  if (
    (careerMonthIndex(start) ?? Infinity) > (careerMonthIndex(end) ?? -Infinity)
  )
    return null;
  return projectDateRange(`${start} - ${end}`);
}

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const sectionEnd =
  /^(?:education|additional information|skills?|languages?|certifications?|references?)\s*:?$/i;
const projectHeading =
  /^(?:Project(?:\s+(?:Name|Title))?\s*:|Migration\s+SAP\b|SAP\b.*\b(?:implementation|roll\s*out|migration|upgrade|support)\b|Application Management Services? (?:Division|Department))/i;

/** Date-bearing titles in selected-project ledgers are useful draft evidence
 * even without a per-project role. Keep them incomplete, with no inferred
 * client/employer/title from the surrounding employment or shared task list. */
export function datedSelectedProjectTitles(text: string) {
  const lines = text
    .normalize("NFKC")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) =>
    /^selected project experience\s*:?$/i.test(line),
  );
  if (start < 0) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (
      sectionEnd.test(line) ||
      /^(?:(?:work|professional|employment|career) (?:experience|history))\s*:?$/i.test(
        line,
      )
    )
      break;
    const range = projectDateRange(line);
    if (!range || !validProjectDateRange(range[1], range[2])) continue;
    const name = clean(line.replace(range[0], "")).replace(/[\s,;|–—-]+$/, "");
    if (
      !/\b(?:SAP|BW\d*|BI\d*)\b/i.test(name) ||
      !/\b(?:reporting|implementation|migration|rollout|upgrade|track)\b/i.test(
        name,
      ) ||
      name.length > 160 ||
      /^[•*·-]/.test(name)
    )
      continue;
    rows.push({
      name,
      client: "",
      employer: "",
      role: "",
      start_date: range[1],
      end_date: range[2],
      current: projectDateIsCurrent(range[2]),
      modules: [],
      project_type: "",
    });
  }
  return rows;
}

/** Count source cards independently of successful employer/role parsing so
 * coverage still reports omissions when this reader cannot resolve an owner. */
export function nestedProjectEvidenceCount(text: string) {
  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) =>
    /^(?:experience|(?:work|professional|employment|career) (?:experience|history))\s*:?$/i.test(
      line,
    ),
  );
  if (start < 0) return 0;
  const history = lines.slice(start + 1);
  const stop = history.findIndex((line) => sectionEnd.test(line));
  if (stop >= 0) history.splice(stop);
  return history.filter(
    (line, index) =>
      projectHeading.test(line) &&
      history
        .slice(index, index + 4)
        .some((row) => Boolean(cardDateRange(row))),
  ).length;
}

/** Read explicit company/date headers and their nested delivery cards. A
 * project date never becomes an employer date, and client names never become
 * legal employers. Only activate when both levels are evidenced in the CV. */
export function nestedResumeHistory(text: string) {
  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) =>
    /^(?:experience|(?:work|professional|employment|career) (?:experience|history))\s*:?$/i.test(
      line,
    ),
  );
  if (start < 0) return null;
  const history = lines.slice(start + 1);
  const stop = history.findIndex((line) => sectionEnd.test(line));
  if (stop >= 0) history.splice(stop);
  const employers: Array<{
    index: number;
    employer: string;
    start_date: string;
    end_date: string;
    current: boolean;
    title: string;
  }> = [];
  for (const [index, line] of history.entries()) {
    const dates = projectDateRange(line);
    if (!dates || !dates.index || projectHeading.test(line)) continue;
    const employer = clean(line.slice(0, dates.index))
      .replace(/[,;|–-]+$/, "")
      .trim();
    // An inline dated legal-company header, rather than a sentence or project.
    if (
      !/^(?:PT\.?\s|[\p{L}\p{N} &.,'()-]+\b(?:Ltd\.?|Limited|Inc\.?|LLC|GmbH|Pte\.?|Corporation|Consulting|Technologies|Solutions|Company|Sdn\.?\s+Bhd\.?|Bhd\.?)\b)/iu.test(
        employer,
      ) ||
      /\b(?:at|for|implementation|roll\s*out|migration|GPA|responsibilities)\b/i.test(
        employer,
      )
    )
      continue;
    employers.push({
      index,
      employer,
      start_date: dates[1],
      end_date: dates[2],
      current: projectDateIsCurrent(dates[2]),
      title: "",
    });
  }
  const projects: Array<Record<string, unknown>> = [];
  for (const [position, owner] of employers.entries()) {
    const end = employers[position + 1]?.index ?? history.length;
    const block = history.slice(owner.index + 1, end);
    const anchors = block.flatMap((line, index) =>
      projectHeading.test(line) ? [index] : [],
    );
    owner.title =
      block
        .slice(0, anchors[0] ?? block.length)
        .find(
          (line) =>
            /\b(?:consultant|manager|architect|analyst|developer|engineer|lead|associate)\b/i.test(
              line,
            ) &&
            !/^(?:A |An |The |As |[•*])|\b(?:provides|services firm|partner in)\b/i.test(
              line,
            ),
        ) || "";
    for (const [projectIndex, anchor] of anchors.entries()) {
      const card = block.slice(
        anchor,
        anchors[projectIndex + 1] ?? block.length,
      );
      const dateIndex = card
        .slice(0, 4)
        .findIndex((line) => Boolean(cardDateRange(line)));
      const dates = dateIndex >= 0 ? cardDateRange(card[dateIndex]) : null;
      const name = clean(
        card
          .slice(0, dateIndex > 0 ? dateIndex : 1)
          .filter(
            (line) =>
              !/^(?:Client|Customer|Role|Position|Designation|Software|Duration|Period)\s*:/i.test(
                line,
              ),
          )
          .join(" "),
      ).replace(/^Project(?:\s+(?:Name|Title))?\s*:\s*/i, "");
      const body = card.slice(Math.max(1, dateIndex + 1)).join(" ");
      const labelRole = card
        .join("\n")
        .match(
          /(?:^|\n)(?:Project Role|Role|Position|Designation)\s*:\s*([^\n]+)/i,
        )?.[1];
      const scopedRole = block
        .slice(0, anchors[0] ?? block.length)
        .join(" ")
        .match(/Assigned as (?:a|an) (.+?) to (?:the )?projects?\b/i)?.[1];
      const role =
        body
          .match(
            /^As\s+(?:a|an)\s+(.+?),?\s*responsibilities\s+include(?:d|s)?\s*:/i,
          )?.[1]
          ?.replace(/[,;]+$/, "")
          .trim() ||
        labelRole ||
        scopedRole ||
        "";
      projects.push({
        project_type: /^Application Management Services? /i.test(name)
          ? "AMS"
          : sapProjectTypeEvidence(name),
        name,
        employer: owner.employer,
        client:
          card
            .join("\n")
            .match(/(?:^|\n)(?:Client|Customer)\s*:\s*([^\n]+)/i)?.[1] ||
          name.match(/\s+at\s+(.+)$/i)?.[1] ||
          "",
        role,
        start_date: dates?.[1] || "",
        end_date: dates?.[2] || "",
        current: projectDateIsCurrent(dates?.[2]),
        description: body,
        evidence_source: "nested_employer_project_card",
      });
    }
  }
  if (
    !employers.length ||
    !projects.length ||
    employers.some((owner) => !owner.title)
  )
    return null;
  return {
    experience: employers.map(({ index, ...row }) => ({
      ...row,
      company: row.employer,
    })),
    projects,
  };
}

/** Explicit qualification fields and adjacent institution/degree pairs. Dates
 * belong to the same education card; employment and certification dates never
 * fill missing graduation years. */
export function labelledResumeEducation(text: string) {
  const lines = text
    .normalize("NFKC")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const rows: Array<{
    institution: string;
    qualification: string;
    field_of_study: string;
    graduation_year: string;
  }> = [];
  const degree =
    /^(?:Bachelor[’']?s?|Master[’']?s?|Diploma|Doctor|PhD|Professional Degree|Primary\/Secondary School)\b/i;
  const school = /\b(?:university|universiti|college|institute|universitas)\b/i;
  const add = (
    qualification: string,
    institution: string,
    field = "",
    year = "",
  ) => {
    if (
      !degree.test(qualification) ||
      !institution ||
      /^(?:client|employer|project|role|qualification)\s*:/i.test(institution)
    )
      return;
    const row = {
      qualification,
      institution,
      field_of_study: field,
      graduation_year: year,
    };
    if (
      !rows.some((existing) => JSON.stringify(existing) === JSON.stringify(row))
    )
      rows.push(row);
  };
  const flat = lines.join(" ");
  const fields =
    /\bQualification\s*:\s*(.{2,160}?)\s+Field of Study\s*:\s*(.{1,160}?)\s+Major\s*:\s*.{1,160}?\s+Institute\s*\/\s*University\s*:\s*(.{2,180}?)\s+Grade\s*:\s*.{1,100}?\s+Graduation Date\s*:\s*((?:19|20)\d{2})(?=\s|$)/gi;
  for (const match of flat.matchAll(fields))
    add(match[1], match[3], match[2], match[4]);
  for (let index = 0; index < lines.length; index++) {
    // Word tables can serialize all four labels before all four values.
    if (
      /^qualification$/i.test(lines[index]) &&
      /^major$/i.test(lines[index + 1] || "") &&
      /^university$/i.test(lines[index + 2] || "") &&
      /^graduation year$/i.test(lines[index + 3] || "")
    ) {
      const values = lines
        .slice(index + 4, index + 8)
        .map((line) => line.replace(/^:\s*/, ""));
      if (values.length === 4 && /^(?:19|20)\d{2}$/.test(values[3]))
        add(values[0], values[2], values[1], values[3]);
    }
    if (/^qualification\s*:?$/i.test(lines[index])) {
      const qualification = lines[index + 1] || "";
      if (
        /^(?:college|university|institution)\s*:?$/i.test(
          lines[index + 2] || "",
        )
      ) {
        const graduation = /^graduation (?:date|year)\s*:?$/i.test(
          lines[index + 4] || "",
        )
          ? lines[index + 5] || ""
          : "";
        add(
          qualification,
          lines[index + 3] || "",
          "",
          graduation.match(/\b(?:19|20)\d{2}\b/)?.[0] || "",
        );
      } else if (school.test(lines[index + 2] || "")) {
        const institution = lines[index + 2];
        const range = projectDateRange(institution);
        add(
          qualification,
          institution.replace(/\s*\([^)]*\)\s*$/, ""),
          "",
          range?.[2].match(/\b(?:19|20)\d{2}\b/)?.[0] || "",
        );
      }
    }
    // Institution and dated degree on adjacent lines remain explicit even if
    // Word floating text boxes interleave Education and Certification headings.
    if (
      school.test(lines[index]) &&
      lines[index].length < 160 &&
      !/\b(?:client|project|training|certification)\b/i.test(lines[index])
    ) {
      const next = lines[index + 1] || "";
      const datedDegree = next.match(/^(.+?)\s+[—–-]\s*((?:19|20)\d{2})$/);
      if (datedDegree) add(datedDegree[1], lines[index], "", datedDegree[2]);
    }
  }
  return rows;
}

export function institutionFirstEducation(text: string) {
  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n|\t/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) => /^education\s*:?$/i.test(line));
  if (start < 0) return [];
  const body = lines.slice(start + 1);
  const end = body.findIndex((line) =>
    /^(?:experience|(?:work|professional|employment|career) (?:experience|history)|project(?:s| undertaken| experience)?|additional information|(?:technical )?skills?|languages?|certifications?|references?)\s*:?$/i.test(
      line,
    ),
  );
  if (end >= 0) body.splice(end);
  // Explicit two-column tables retain the source degree and institution even
  // when the CV does not supply a graduation year. Never borrow project dates.
  if (
    /^qualification\s*:?$/i.test(body[0] || "") &&
    /^institution\s*:?$/i.test(body[1] || "")
  ) {
    const rows = [];
    for (let index = 2; index + 1 < body.length; index += 2) {
      const qualification = body[index];
      const institution = body[index + 1];
      if (
        !/^(?:Bachelor|Master|Diploma|Doctor)(?:\b|of\b)/i.test(
          qualification,
        ) ||
        !/\b(?:university|college|institute|institut|universitas)\b/i.test(
          institution,
        ) ||
        /\b(?:client|employer|project)\b/i.test(institution)
      )
        break;
      rows.push({
        institution,
        qualification,
        field_of_study: "",
        graduation_year: "",
      });
    }
    return rows;
  }
  const anchors = body.flatMap((line, index) =>
    /^(?:INSTITUT|INSTITUTE|UNIVERSITAS|UNIVERSITY|COLLEGE)\b/i.test(line) &&
    !/\b(?:19|20)\d{2}\b/.test(line)
      ? [index]
      : [],
  );
  return anchors.flatMap((anchor, index) => {
    const block = body.slice(anchor, anchors[index + 1] ?? body.length);
    const qualification = block.find((line) =>
      /^(?:Sarjana|Bachelor|Master|Diploma|Doctor|B\.?Sc|M\.?Sc)\b/i.test(line),
    );
    if (!qualification) return [];
    return [
      {
        institution: block[0].replace(/[,;]+$/, ""),
        qualification,
        field_of_study:
          qualification.match(/Concentration\s*:\s*(.+)$/i)?.[1] || "",
        graduation_year:
          block
            .slice(1)
            .join(" ")
            .match(/\b(?:19|20)\d{2}\b/)?.[0] || "",
      },
    ];
  });
}

/** Standalone table labels and company headers followed by Position/Duration.
 * Stop at a project section; project clients cannot become company rows. */
export function labelledResumeEmployment(text: string) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const start = lines.findIndex((line) =>
    /^(?:experience|(?:employment|work|working|professional|career) (?:history|experience))\s*:?$/i.test(
      line,
    ),
  );
  if (start < 0) return [];
  const body = lines.slice(start + 1);
  const stop = body.findIndex((line) =>
    /^(?:professional experience|selected project experience|project experience|education|qualifications|skills|languages)\s*:?$/i.test(
      line,
    ),
  );
  if (stop >= 0) body.splice(stop);
  const anchors = body.flatMap((line, index) =>
    (/^(?:company|employer)(?: name)?(?:\s*:\s*.*)?$/i.test(line) &&
      body
        .slice(index + 1, index + 12)
        .some((row) =>
          /^(?:position title|designation|job title|role|position)\s*(?::|$)/i.test(
            row,
          ),
        ) &&
      body
        .slice(index + 1, index + 12)
        .some((row) =>
          /^(?:duration|period|employment dates)\s*(?::|$)/i.test(row),
        )) ||
    (index + 1 < body.length && /^Position Title\s*:/i.test(body[index + 1]))
      ? [index]
      : [],
  );
  const field = (block: string[], label: string) => {
    const pattern = new RegExp(`^(?:${label})\\s*(?::\\s*(.*))?$`, "i");
    for (let i = 0; i < block.length; i++) {
      const m = block[i].match(pattern);
      if (m) return m[1]?.trim() || block[i + 1] || "";
    }
    return "";
  };
  const records = anchors.flatMap((anchor, index) => {
    const block = body.slice(anchor, anchors[index + 1] ?? body.length);
    const employer = /^(?:company|employer)(?: name)?(?:\s*:\s*.*)?$/i.test(
      block[0],
    )
      ? field(block, "company(?: name)?|employer(?: name)?")
      : block[0];
    const title = field(
      block,
      "position title|designation|job title|role|position",
    );
    const duration = field(block, "duration|period|employment dates");
    const dates = projectDateRange(duration);
    if (
      !employer ||
      !title ||
      !dates ||
      [employer, title].some((value) =>
        /^(?:Location|Designation|Duration|Position|Company|Employer|Role)\s*:?$/i.test(
          value,
        ),
      )
    )
      return [];
    return [
      {
        employer,
        company: employer,
        title,
        start_date: dates[1],
        end_date: dates[2],
        current: projectDateIsCurrent(dates[2]),
      },
    ];
  });
  return records.length === anchors.length ? records : [];
}

/** Complete employment sentences scoped to career history. Decline mixed or
 * unresolved layouts instead of replacing a fuller canonical history. */
export function narrativeResumeEmployment(text: string) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const start = lines.findIndex((line) =>
    /^(?:work|working|employment|professional|career) (?:experience|history)\s*:?$/i.test(
      line,
    ),
  );
  if (start < 0) return [];
  const body = lines.slice(start + 1);
  const stop = body.findIndex((line) =>
    /^(?:projects?(?: type| experience| history)?|duration|education|skills|languages)\s*:/i.test(
      line,
    ),
  );
  if (stop >= 0) body.splice(stop);
  const employmentLines = body.filter((line) =>
    /^(?:Worked|Working) (?:with|for)\b/i.test(line),
  );
  if (
    body.some(
      (line) => !employmentLines.includes(line) && projectDateRange(line),
    )
  )
    return [];
  const records = employmentLines.flatMap((line) => {
    const m = line.match(
      /^(Worked|Working) (?:with|for) (.+?) as (.+?) (?:from|since) (.+?)[.]?$/i,
    );
    if (
      !m ||
      !/\b(?:consultant|developer|engineer|architect|analyst|manager|recruiter|specialist)\b/i.test(
        m[3],
      )
    )
      return [];
    const range = projectDateRange(m[4]);
    // Past-tense employment with no end date cannot imply current employment.
    const since =
      !range &&
      /^Working\b/i.test(m[1]) &&
      /\bsince\b/i.test(line) &&
      new RegExp(`^(?:${PROJECT_DATE_TOKEN_PATTERN})$`, "i").test(m[4]) &&
      careerMonthIndex(m[4]) !== null;
    if (!range && !since) return [];
    return [
      {
        employer: m[2],
        company: m[2],
        title: m[3],
        start_date: range?.[1] || m[4],
        end_date: range?.[2] || "Current",
        current: since || projectDateIsCurrent(range?.[2]),
      },
    ];
  });
  return records.length === employmentLines.length ? records : [];
}

/** Reorder client/project fields only inside the same numbered card. */
export function projectFieldLayoutText(text: string) {
  const roleClientCard =
    /^([ \t]*Role[ \t]*:[^\n]+)\r?\n(?:[ \t]*\r?\n)*([ \t]*Environment[ \t]*:[^\n]+)\r?\n(?:[ \t]*\r?\n)*([ \t]*Client[ \t]*:[^\n]+)\r?\n(?:[ \t]*\r?\n)*(?=[ \t]*Project[ \t]+duration[ \t]*:)/gim;
  // Repeated explicit role/environment/client/duration cards own the role
  // immediately before Client. Reorder locally without inheriting a job title.
  if ([...text.matchAll(roleClientCard)].length >= 2)
    text = text.replace(roleClientCard, "$3\n$1\n$2\n");
  const lines = text
    // These are literal client-site table labels, not inferred employers.
    .replace(/^[ \t]*Exposure[ \t]+(Client[ \t]*:)/gim, "$1")
    .replace(
      /^[ \t]*\(Client[’']s[ \t]+Site\)[ \t]+(Position[ \t]+Title[ \t]*:)/gim,
      "$1",
    )
    .replace(
      /^(\s*(?:client|customer|project|duration|period|position|designation|role))\t+[ \t]*([^\n]+)/gim,
      "$1: $2",
    )
    .split(/\r?\n/);
  const anchors = lines.flatMap((line, index) =>
    /^\s*Project\s+\d+\s*:/i.test(line) ? [index] : [],
  );
  for (let i = anchors.length - 1; i >= 0; i--) {
    const start = anchors[i],
      end = anchors[i + 1] ?? lines.length;
    const card = lines.slice(start, end);
    const project = card.findIndex((line) =>
      /^\s*Project\s*:\s*\S/i.test(line),
    );
    const client = card.findIndex((line) =>
      /^\s*(?:Client|Customer)\s*:\s*\S/i.test(line),
    );
    if (client >= 0 && project > client) {
      const [field] = card.splice(project, 1);
      card.splice(client, 0, field);
      lines.splice(start, end - start, ...card);
    }
  }
  return lines
    .join("\n")
    .replace(/^[ \t]*Project[ \t]+\d+[ \t]*:[ \t]*$/gim, "");
}
