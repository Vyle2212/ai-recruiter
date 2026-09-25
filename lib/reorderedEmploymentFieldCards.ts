import { careerMonthIndex } from "./candidateCareerExperience";
import type { BoundedCareerTableRow } from "./boundedCareerTables";

const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\s*[/]\\s*(?:\\d{2}|(?:19|20)\\d{2}))`;
const range = new RegExp(
  `\\b(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Now|Till\\s+(?:to\\s+)?Date)\\b`,
  "gi",
);
const employerLabel =
  "(?:Employer|Company(?:\\s+(?:Name|Served))|Organi[sz]ation)";
const roleLabel =
  "(?:Role|Position(?:\\s+Title)?|Designation|(?:Job\\s+)?Title)";
const roleWord =
  /\b(?:consultant|engineer|analyst|architect|manager|lead|developer|specialist|programmer|administrator|executive)\b/i;
const nextLabel = new RegExp(
  `\\b(?:${employerLabel}|${roleLabel}|Duration|Period|From\\s*\\/\\s*To|Date\\s+(?:Joined|Left|From|To)|Client|Customer|Project)\\s*:`,
  "i",
);

const valueAfter = (card: string, label: RegExp) => {
  const match = label.exec(card);
  if (!match) return "";
  const tail = card.slice((match.index || 0) + match[0].length);
  const boundary = tail.search(nextLabel);
  return (boundary >= 0 ? tail.slice(0, boundary) : tail)
    .replace(/^[\s:–—-]+|[\s;|]+$/g, "")
    .trim();
};

const exactDate = (value: string, allowCurrent = false) =>
  value.match(
    new RegExp(
      `^(${date}${allowCurrent ? "|Present|Current|Now|Till\\s+(?:to\\s+)?Date" : ""})$`,
      "i",
    ),
  )?.[1] || "";

/** Reordered labelled cards are accepted only inside an employment-owned
 * section, or when a strong employer label establishes ownership itself. */
export function reorderedEmploymentFieldCards(
  input: string,
): BoundedCareerTableRow[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const employmentHeading =
    /\b(?:Professional\s+(?:Work\s+)?Experience|Employment\s+History|Career\s+History|Working\s+Experiences?|Work\s+Experience)\b\s*:?\s*/gi;
  const stop =
    /\b(?:Project\s+(?:Experience|History|Details)|Project\s+\d+\b|Projects?\s*:|Client\s+Experience|Education|Academic\s+Qualifications?|Certifications?|Technical\s+Skills?|Languages?|References?)\b\s*:?/i;
  const headings = [...text.matchAll(employmentHeading)];
  const sections = headings.map((heading, index) => {
    const start = (heading.index || 0) + heading[0].length;
    const raw = text.slice(start, headings[index + 1]?.index);
    const boundary = raw.search(stop);
    return (boundary >= 0 ? raw.slice(0, boundary) : raw).slice(0, 24000);
  });
  if (
    !sections.length &&
    new RegExp(`\\b${employerLabel}\\s*:`, "i").test(text)
  ) {
    const boundary = text.search(stop);
    sections.push(
      (boundary >= 0 ? text.slice(0, boundary) : text).slice(0, 24000),
    );
  }

  const results: BoundedCareerTableRow[] = [];
  const append = (card: string, start: string, end: string) => {
    const employer = new RegExp(`\\b${employerLabel}\\s*:\\s*`, "i").exec(card);
    const role = new RegExp(`\\b${roleLabel}\\s*:\\s*`, "i").exec(card);
    const ownershipBoundary = card.search(/\b(?:Client|Customer|Project)\s*:/i);
    if (
      !employer ||
      !role ||
      (ownershipBoundary >= 0 &&
        ((employer.index || 0) > ownershipBoundary ||
          (role.index || 0) > ownershipBoundary))
    )
      return;
    const company = valueAfter(
      card,
      new RegExp(`\\b${employerLabel}\\s*:\\s*`, "i"),
    )
      .replace(/[.;,\s]+$/g, "")
      .trim();
    const title = valueAfter(card, new RegExp(`\\b${roleLabel}\\s*:\\s*`, "i"))
      .replace(/[.;,\s]+$/g, "")
      .trim();
    const current = /^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(
      end,
    );
    const first = careerMonthIndex(start),
      last = careerMonthIndex(end, current);
    if (
      !company ||
      !title ||
      !roleWord.test(title) ||
      company.length > 100 ||
      title.length > 120 ||
      title.split(/\s+/).length > 16 ||
      first === null ||
      last === null ||
      first > last ||
      /\b(?:client|customer|project)\b/i.test(company) ||
      /\b(?:client|customer|project\s+description)\b/i.test(title)
    )
      return;
    results.push({ company, title, start, end, excerpt: card.slice(0, 300) });
  };

  for (const section of sections) {
    const periods = [...section.matchAll(range)];
    periods.forEach((period, index) => {
      append(
        section
          .slice(period.index || 0, periods[index + 1]?.index ?? section.length)
          .slice(0, 1200),
        period[1],
        period[2],
      );
    });

    const splitDates = [...section.matchAll(/\bDate\s+From\s*:\s*/gi)];
    splitDates.forEach((anchor, index) => {
      const card = section
        .slice(
          anchor.index || 0,
          splitDates[index + 1]?.index ?? section.length,
        )
        .slice(0, 1200);
      append(
        card,
        exactDate(valueAfter(card, /\bDate\s+From\s*:\s*/i)),
        exactDate(valueAfter(card, /\bDate\s+To\s*:\s*/i), true),
      );
    });

    const employers = [
      ...section.matchAll(new RegExp(`\\b${employerLabel}\\s*:\\s*`, "gi")),
    ];
    employers.forEach((employer, index) => {
      const card = section
        .slice(
          employer.index || 0,
          employers[index + 1]?.index ?? section.length,
        )
        .slice(0, 1200);
      const periodLabel = /\b(?:Duration|Period|From\s*\/\s*To)\s*:\s*/i.exec(
        card,
      );
      if (!periodLabel) return;
      range.lastIndex = 0;
      const period = range.exec(
        card.slice((periodLabel.index || 0) + periodLabel[0].length),
      );
      range.lastIndex = 0;
      if (period && period.index <= 5) append(card, period[1], period[2]);
    });
  }

  return results.filter(
    (item, index) =>
      results.findIndex(
        (other) =>
          [other.company, other.title, other.start, other.end]
            .join("|")
            .toLowerCase() ===
          [item.company, item.title, item.start, item.end]
            .join("|")
            .toLowerCase(),
      ) === index,
  );
}
