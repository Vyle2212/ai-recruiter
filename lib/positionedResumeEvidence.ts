import { projectDateRange, projectDateIsCurrent } from "./projectDateEvidence";

const linesOf = (text: string) =>
  text.split(/\r?\n/).map((line) => line.trim());
const heading =
  /^(?:professional summary|professional experience|work experience|employment history|education|courses|certifications?|languages?(?: skills)?|functional expertise|core competencies|key achievements|project summary experience)$/i;

function section(text: string, label: RegExp): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => label.test(line.trim()));
  if (start < 0) return [];
  const result: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.includes("\f") || heading.test(line.trim())) break;
    if (line.trim()) result.push(line.trim());
  }
  return result;
}

/** Only recover tracked lettering when the filename's name tokens agree
 * exactly with the visible PDF header. A filename alone is not evidence. */
export function trackedHeaderName(
  text: string,
  filename: string,
): string | undefined {
  const header = linesOf(text).find(Boolean) || "";
  const parts = header.split(/\s+/);
  if (parts.filter((part) => part.length === 1).length < 5) return undefined;
  const tokens = filename.replace(/\.[a-z0-9]+$/i, "").split(/[_\s]+/);
  const name: string[] = [];
  for (const token of tokens) {
    if (
      !/^[A-Za-z][A-Za-z'-]+$/.test(token) ||
      /^(?:expert|it|sap\w*|consultant|cv|resume|senior)$/i.test(token)
    )
      break;
    name.push(token);
  }
  if (name.length < 2 || name.length > 5) return undefined;
  if (name.join("").toLowerCase() !== header.replace(/\s/g, "").toLowerCase())
    return undefined;
  return name.join(" ");
}

export function pipeEmploymentCards(text: string) {
  const lines = linesOf(text);
  return lines.flatMap((line, index) => {
    const card = line.match(/^([^|]+)\s*\|\s*([^|]+)$/);
    if (
      !card ||
      !/\b(?:SAP|Consultant|Engineer|Analyst|Manager|Developer)\b/i.test(
        card[1],
      )
    )
      return [];
    let employer = card[2].trim();
    let range = projectDateRange(employer);
    for (let offset = 1; !range && offset <= 2; offset++) {
      const next = lines[index + offset] || "";
      if (!next || /^[•*-]|\||:/.test(next) || heading.test(next)) break;
      employer += " " + next;
      range = projectDateRange(employer);
    }
    if (!range || range.index === undefined) return [];
    employer = employer
      .slice(0, range.index)
      .replace(/[\s(]+$/, "")
      .trim();
    if (!employer || employer.length > 120) return [];
    return [
      {
        employer,
        company: employer,
        title: card[1].trim(),
        start_date: range[1],
        end_date: range[2],
        current: projectDateIsCurrent(range[2]),
      },
    ];
  });
}

export function positionedResumeSections(text: string) {
  const educationLines = section(text, /^EDUCATION$/i);
  const anchors = educationLines.flatMap((line, index) =>
    /^(?:Master|Bachelor|Doctorate|Diploma)\s+(?:Degree|Diploma)$/i.test(line)
      ? [index]
      : [],
  );
  const education = anchors.map((start, index) => {
    const block = educationLines.slice(
      start + 1,
      anchors[index + 1] ?? educationLines.length,
    );
    const institutionLine = block.find((line) =>
      /\b(?:University|Universitas|College|Institute)\b/i.test(line),
    );
    const institutionParts = institutionLine?.split(/\s*\|\s*/);
    const date = block
      .map((line) =>
        line.match(/\b((?:19|20)\d{2})\s*[–—-]\s*((?:19|20)\d{2})\b/),
      )
      .find(Boolean);
    return {
      qualification: block[0]?.replace(/[,;]+$/, "") || educationLines[start],
      institution: institutionParts?.at(-1) || "",
      field_of_study:
        institutionParts && institutionParts.length > 1
          ? institutionParts[0]
          : "",
      graduation_year: date?.[2] || "",
    };
  });
  const certificationLines = section(text, /^CERTIFICATIONS?$/i);
  const certifications: string[] = [];
  for (const line of certificationLines) {
    if (
      /^(?:[•*-]\s*)?(?:SAP Certified|Certified|Certification)/i.test(line) ||
      !certifications.length
    )
      certifications.push(line.replace(/^[•*-]\s*/, ""));
    else certifications[certifications.length - 1] += " " + line;
  }
  const languageLines = section(text, /^LANGUAGES?(?: SKILLS)?$/i);
  const languages = languageLines.flatMap((line, index) => {
    if (
      !/^(?:Bahasa Indonesia|Bahasa Malaysia|English|Mandarin|Vietnamese|French|German|Japanese|Korean|Thai|Hindi)$/i.test(
        line,
      )
    )
      return [];
    const proficiency =
      languageLines[index + 1]?.match(
        /(?:Reading,\s*Speaking,\s*and\s*Writing\s*:\s*)?(Native|Fluent|Advanced|Intermediate|Basic)\s*$/i,
      )?.[1] || "";
    return [{ language: line, proficiency }];
  });
  const projects = section(text, /^PROJECT SUMMARY EXPERIENCE$/i).flatMap(
    (line) => {
      const cells = line.split("\t");
      if (cells.length !== 3 || /^Clients$/i.test(cells[0])) return [];
      return [
        {
          name: cells[1].trim(),
          client: cells[0].trim(),
          role: cells[2].trim(),
          start_date: "",
          end_date: "",
          employer: "",
        },
      ];
    },
  );
  const contact = text.split(/PROFESSIONAL SUMMARY|CORE COMPETENCIES/i)[0];
  const address = /\b(?:South |North |East |West )?Jakarta\b/i.exec(contact);
  return {
    education,
    certifications,
    languages,
    projects,
    location: address ? address[0] : undefined,
    country: address ? "Indonesia" : undefined,
  };
}
