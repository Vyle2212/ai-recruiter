import { projectDateRange, projectDateIsCurrent } from "./projectDateEvidence";

const linesOf = (text: string) =>
  text.split(/\r?\n/).map((line) => line.trim());
const heading =
  /^(?:professional summary|professional experience|work experience|employment history|education|courses|certifications?(?:\s*(?:&|and)\s*training)?|earlier career experience|languages?(?: skills)?|skills?|technical skills?|sap skills?|expertise|functional expertise|core competencies|key achievements|project summary experience)\s*:?[\s]*$/i;

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

/** Read bounded employment headers, including two/three pipe cells and
 * year-only earlier-career bullets. Never reuse a neighbouring card's dates. */
export function pipeEmploymentCards(text: string) {
  const lines = linesOf(text);
  let employmentScope = true;
  return lines.flatMap((original, index) => {
    if (heading.test(original)) {
      employmentScope =
        /^(?:professional experience|work experience|employment history|earlier career experience)$/i.test(
          original,
        );
      return [];
    }
    if (!employmentScope) return [];
    const line = original.replace(/^[•●▪\uf0b7*-]\s*/, "");
    const cells = line.split(/\s*\|\s*/);
    if (cells.length < 2 || cells.length > 3) return [];
    let title = cells[0];
    let employer = cells[1];
    let period = cells[2] || "";
    // Earlier career: Title – Employer | 2009. The delimiter is structural,
    // not the hyphen inside a job title or company name.
    if (
      cells.length === 2 &&
      /^(?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?$/.test(employer)
    ) {
      const split = title.match(/^(.+?)\s+[–—]\s+(.+)$/);
      if (!split) return [];
      title = split[1];
      period = employer;
      employer = split[2];
    }
    if (
      !/\b(?:SAP|Consultant|Engineer|Analyst|Manager|Developer|Architect|Auditor)\b/i.test(
        title,
      )
    )
      return [];
    let dated = period || employer;
    let range = projectDateRange(dated);
    for (let offset = 1; !period && !range && offset <= 2; offset++) {
      const next = lines[index + offset] || "";
      if (!next || /^[•●▪\uf0b7*-]|\||:/.test(next) || heading.test(next))
        break;
      employer += " " + next;
      dated = employer;
      range = projectDateRange(dated);
    }
    const year = period.match(/^((?:19|20)\d{2})$/);
    if (!range && !year) return [];
    if (!period && range?.index !== undefined)
      employer = employer.slice(0, range.index).replace(/[\s(]+$/, "");
    employer = employer.trim();
    if (!employer || employer.length > 120) return [];
    return [
      {
        employer,
        company: employer,
        title: title.trim(),
        start_date: range?.[1] || year![1],
        end_date: range?.[2] || year![1],
        current: projectDateIsCurrent(range?.[2]),
      },
    ];
  });
}

/** A single-token name needs independent contact-header evidence. */
export function contactHeaderName(text: string) {
  const lines = linesOf(text).filter(Boolean);
  const first = lines[0] || "";
  if (!/^[\p{L}][\p{L}'’-]{3,35}$/u.test(first)) return undefined;
  if (
    /^(?:resume|summary|profile|education|skills|experience|certifications?|curriculum)$/i.test(
      first,
    )
  )
    return undefined;
  const contact = lines.slice(1, 5).join(" ");
  const slug = contact.match(/linkedin\.com\/in\/([^/\s]+)/i)?.[1] || "";
  if (
    !contact.includes("@") ||
    !slug
      .split(/[-_]/)
      .some((token) => token.toLowerCase() === first.toLowerCase())
  )
    return undefined;
  return first;
}

/** Location requires an address/contact claim, never a country in employment,
 * project delivery, education, phone prefix or the profile summary. */
export function explicitContactLocation(text: string) {
  const header = text.split(
    /(?:^|\n)\s*(?:PROFILE SUMMARY|PROFESSIONAL SUMMARY|KEY HIGHLIGHTS|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EDUCATION)\s*(?:\n|$)/i,
  )[0];
  return header
    .match(
      /(?:^|\n)\s*(?:current location|location|address|based in)\s*[:–-]\s*([^\n]+)/i,
    )?.[1]
    ?.trim();
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
  const inlineEducation = educationLines.flatMap((line) => {
    const row = line
      .replace(/^[•●▪\uf0b7*-]\s*/, "")
      .match(
        /^((?:Master|Bachelor|Doctorate|Diploma).+?)\s+[–—]\s+(.+?)\s*\|\s*((?:19|20)\d{2})$/i,
      );
    if (!row) return [];
    return [
      {
        qualification: row[1],
        institution: row[2].replace(
          /,\s*(?:Australia|Indonesia|Singapore|India|Malaysia|Vietnam|Philippines)\s*$/i,
          "",
        ),
        field_of_study: "",
        graduation_year: row[3],
      },
    ];
  });
  education.push(...inlineEducation);
  const certificationLines = section(
    text,
    /^CERTIFICATIONS?(?:\s*(?:&|and)\s*TRAINING)?$/i,
  );
  const certifications: string[] = [];
  for (const line of certificationLines) {
    if (
      /^[•●▪\uf0b7*-]\s*|^(?:SAP Certified|Certified|Certification)/i.test(
        line,
      ) ||
      !certifications.length
    )
      certifications.push(line.replace(/^[•●▪\uf0b7*-]\s*/, ""));
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
        /(?:Reading,\s*Speaking,\s*and\s*Writing\s*:\s*)?(Native|Fluent|Advanced|Intermediate|Basic|(?:JLPT\s*)?N[1-5]|HSK\s*[1-9]|TOPIK\s*[1-6]|CEFR\s*[ABC][12]|IELTS\s*\d(?:\.\d)?)\s*$/i,
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

/** Recover named SAP delivery activities inside a bounded employment card.
 * The employment establishes role/employer, not client or project dates.
 * Aggregate counts, generic support/skills and project-wide adjectives do not
 * establish individual projects. Keep the original sentence as evidence. */
export function embeddedSapEmploymentProjects(text: string) {
  const lines = linesOf(text.replace(/\f/g, "\n"));
  const records: Array<Record<string, unknown>> = [];
  let owner: ReturnType<typeof pipeEmploymentCards>[number] | undefined;
  let narrative: string[] = [];
  const flush = () => {
    if (!owner) return;
    const paragraphs = narrative
      .join("\n")
      .split(
        /(?:^|\n)\s*[•●▪\uf0b7*]\s*|\n(?=(?:Architected|Led|Delivered|Implemented|Deployed|Pioneered|Spearheaded|Directed|Facilitated)\b)/i,
      );
    const seen = new Set<string>();
    for (const paragraph of paragraphs) {
      const sentence = paragraph.replace(/\s+/g, " ").trim();
      // An explicit delivery noun must follow SAP/S4, within the same clause.
      const match = sentence.match(
        /\b(?:SAP\s+S\/4HANA|SAP|S\/4HANA)\s+[^,;.!?]{0,90}?\b(?:integration|implementation|automation|enhancements?|assessment and design phase)\b/i,
      );
      if (
        !match ||
        !/^(?:Architected|Led|Delivered|Implemented|Deployed|Pioneered|Spearheaded|Directed|Facilitated)\b/i.test(
          sentence,
        ) ||
        /\b(?:\d+|multiple|several|various)\s+(?:E2E\s+)?$/i.test(
          sentence.slice(0, match.index),
        )
      )
        continue;
      const rest = sentence.slice((match.index || 0) + match[0].length);
      if (
        /^s\b/i.test(rest) ||
        /^(?:\s+and)?\s+(?:enhancement )?workstreams?\b/i.test(rest)
      )
        continue;
      const name = match[0].trim();
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const dates = projectDateRange(sentence);
      const current =
        projectDateIsCurrent(dates?.[2]) ||
        /\b(?:currently (?:leading|delivering|implementing)|ongoing project)\b/i.test(
          sentence,
        );
      const client =
        sentence.match(/\b(?:client|customer)\s*:\s*([^,;.]+)/i)?.[1]?.trim() ||
        sentence
          .match(
            /\bfor (?:a |the )?(Tier-\d+ [^,;.]+? (?:organisation|organization|company|client))\b/i,
          )?.[1]
          ?.trim() ||
        "";
      records.push({
        name,
        employer: owner.employer,
        client,
        role: owner.title,
        start_date: dates?.[1] || "",
        end_date: current ? "" : dates?.[2] || "",
        current,
        description: sentence,
        evidence_source: "employment_narrative",
        evidence_confidence: 0.8,
      });
    }
  };
  for (const line of lines) {
    const card = pipeEmploymentCards(line)[0];
    if (card) {
      flush();
      owner = card;
      narrative = [];
      continue;
    }
    if (
      /^(?:project(?:\s+(?:name|title|experience|history))?|client|end client)\s*:/i.test(
        line,
      ) ||
      heading.test(line) ||
      /^(?:key highlights|key skills|functional skills|profile summary)$/i.test(
        line,
      )
    ) {
      flush();
      owner = undefined;
      narrative = [];
      continue;
    }
    if (owner && line) narrative.push(line);
  }
  flush();
  return records;
}
