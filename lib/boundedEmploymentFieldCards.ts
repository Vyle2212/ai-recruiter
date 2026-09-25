import { careerMonthIndex } from "./candidateCareerExperience";
import type { BoundedCareerTableRow } from "./boundedCareerTables";

const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\s*[/]\\s*(?:\\d{2}|(?:19|20)\\d{2}))`;
const range = new RegExp(
  `\\b(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Now|Till\\s+(?:to\\s+)?Date)\\b`,
  "gi",
);
const roleWord =
  /\b(?:consultant|engineer|analyst|architect|manager|lead|developer|specialist|programmer)\b/i;

function closed(
  companyInput: string,
  titleInput: string,
  start: string,
  end: string,
  excerpt: string,
): BoundedCareerTableRow | null {
  const company = companyInput.replace(/[.;,\s]+$/g, "").trim();
  const title = titleInput.replace(/[.;,\s]+$/g, "").trim();
  if (
    !company ||
    !title ||
    company.length > 100 ||
    title.length > 95 ||
    !roleWord.test(title) ||
    /\b(?:client|customer|project|responsibilities|university)\b/i.test(
      company,
    ) ||
    /\b(?:client|customer|project\s+description|responsibilities)\b/i.test(
      title,
    ) ||
    /^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(end)
  )
    return null;
  const first = careerMonthIndex(start),
    last = careerMonthIndex(end);
  if (first === null || last === null || first > last) return null;
  return { company, title, start, end, excerpt: excerpt.slice(0, 300) };
}

/** A printed Role then Company card owns the period immediately above it.
 * Another role's date or a client's project period cannot fill a missing cell. */
export function datedRoleCompanyCards(input: string): BoundedCareerTableRow[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  // Some OCR sources retain a "Work ..." heading with an uncommon noun.
  // Verify its position relative to project headings for every card instead
  // of guessing the noun or accepting a project-only Role/Company card.
  const section = text.slice(0, 35000);
  const periods = [...section.matchAll(range)];
  const found = periods.flatMap((period, index) => {
    const before = section.slice(
      Math.max(0, (period.index || 0) - 6500),
      period.index,
    );
    const career =
      [...before.matchAll(/\bWork\s+[A-Za-z]{2,24}\b/gi)].at(-1)?.index ?? -1;
    const project =
      [
        ...before.matchAll(
          /\b(?:Project Experience|Project History|Project Details)\b/gi,
        ),
      ].at(-1)?.index ?? -1;
    if (career < 0 || project > career) return [];
    const card = section.slice(
      (period.index || 0) + period[0].length,
      periods[index + 1]?.index ?? section.length,
    );
    const fields =
      /^\s+Role\s*:\s*(.{3,90}?)\s+Company\s*:\s*(.{2,110}?)(?=\s+[A-Za-z][A-Za-z ]{2,25}\s*:|\s+\b(?:Responsibilities|Duties|Projects?)\b|\s*$)/i.exec(
        card,
      );
    if (
      !fields ||
      /\b(?:client|customer)\s*:/i.test(card.slice(0, fields[0].length))
    )
      return [];
    // A Company cell with a printed organization type establishes ownership;
    // free-form prose about a company does not.
    if (
      !/(?:\b(?:Sdn\s*Bhd|Pte\s*Ltd|Ltd|Inc)\b|\([^)]{1,40}\bcompany\))\s*$/i.test(
        fields[2],
      )
    )
      return [];
    const item = closed(
      fields[2],
      fields[1],
      period[1],
      period[2],
      `${period[0]} ${fields[0]}`,
    );
    return item ? [item] : [];
  });
  const unique = found.filter(
    (item, index) =>
      found.findIndex(
        (other) =>
          [other.company, other.title, other.start, other.end]
            .join("|")
            .toLowerCase() ===
          [item.company, item.title, item.start, item.end]
            .join("|")
            .toLowerCase(),
      ) === index,
  );
  return unique.length >= 2 ? unique : [];
}

/** A Company and Duration appear before Project and Role in this career form.
 * If multiple companies claim the exact same period, leave all of them for
 * source review instead of choosing one employer from concurrent projects. */
export function companyDurationRoleCards(
  input: string,
): BoundedCareerTableRow[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const heading = /\bProfessional Working Experience\b/i.exec(text);
  if (!heading) return [];
  const section = text
    .slice(heading.index + heading[0].length)
    .split(
      /\b(?:Education|Academic Qualifications|References|Certification(?:s)?)\b/i,
    )[0]
    .slice(0, 14000);
  const markers = [...section.matchAll(/\bCompany\s*:/gi)];
  const candidates: BoundedCareerTableRow[] = [];
  const assertedSpans = new Map<string, number>();
  markers.forEach((marker, index) => {
    const card = section
      .slice(marker.index || 0, markers[index + 1]?.index ?? section.length)
      .slice(0, 950);
    const fields = /^Company\s*:\s*(.{2,100}?)\s+Duration\s*:\s*/i.exec(card);
    if (!fields) return;
    const period = range.exec(card.slice(fields[0].length));
    range.lastIndex = 0;
    if (!period || period.index > 5) return;
    const tail = card.slice(fields[0].length + period.index + period[0].length);
    const role =
      /\bRole\s*:\s*(.{3,95}?)(?=\s+Responsibilities\s*:|\s+Project\s*:|\s*$)/i.exec(
        tail,
      );
    if (!role || role.index > 250) return;
    const first = careerMonthIndex(period[1]),
      last = careerMonthIndex(period[2]);
    if (
      first !== null &&
      last !== null &&
      first <= last &&
      !/^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(period[2])
    ) {
      const span = `${first}:${last}`;
      assertedSpans.set(span, (assertedSpans.get(span) || 0) + 1);
    }
    const item = closed(fields[1], role[1], period[1], period[2], card);
    if (item) candidates.push(item);
  });
  return candidates.filter(
    (item) =>
      assertedSpans.get(
        `${careerMonthIndex(item.start)}:${careerMonthIndex(item.end)}`,
      ) === 1,
  );
}

/** Read complete labelled cards only inside employment-owned boundaries. */
export function labelledEmploymentFieldCards(
  input: string,
): BoundedCareerTableRow[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const employmentHeading =
    /\b(?:Professional\s+(?:Work\s+)?Experience|Employment\s+History|Career\s+History|Working\s+Experiences?|Work\s+Experience)\b\s*:?\s*/gi;
  const headings = [...text.matchAll(employmentHeading)];
  const stop =
    /\b(?:Project\s+(?:Experience|History|Details)|Project\s+\d+\b|Projects?\s*:|Client\s+Experience|Education|Academic\s+Qualifications?|Certifications?|Technical\s+Skills?|Languages?|References?)\b\s*:?/i;
  const sections = headings.map((heading, index) => {
    const start = (heading.index || 0) + heading[0].length;
    const raw = text.slice(start, headings[index + 1]?.index);
    const boundary = raw.search(stop);
    return {
      body: (boundary >= 0 ? raw.slice(0, boundary) : raw).slice(0, 24000),
      explicitlyOwned: true,
    };
  });
  // Employer/Organization is ownership evidence without a heading. Plain
  // standalone Company cards remain unresolved because they may name a client.
  if (!sections.length && /\b(?:Employer|Organi[sz]ation)\s*:/i.test(text)) {
    const boundary = text.search(stop);
    sections.push({
      body: (boundary >= 0 ? text.slice(0, boundary) : text).slice(0, 24000),
      explicitlyOwned: false,
    });
  }

  const field = /\b(Employer|Company(?:\s+Name)?|Organi[sz]ation)\s*:\s*/gi;
  const splitStartLabel = /\b(?:Date\s+From|Start\s+Date|From)\s*:\s*/i;
  const splitEndLabel = /\b(?:Date\s+To|End\s+Date|To)\s*:\s*/i;
  const nextLabel =
    /\b(?:Employer|Company(?:\s+Name)?|Organi[sz]ation|Role|Position(?:\s+Title)?|Designation|(?:Job\s+)?Title|Duration|Period|From\s*\/\s*To|Date\s+(?:Joined|Left|From|To)|Start\s+Date|End\s+Date|From|To|Client|Customer|Project)\s*:/i;
  const valueAfter = (card: string, label: RegExp) => {
    const match = label.exec(card);
    if (!match) return "";
    const tail = card.slice((match.index || 0) + match[0].length);
    const boundary = tail.search(nextLabel);
    return (boundary >= 0 ? tail.slice(0, boundary) : tail)
      .replace(/^[\s:–—-]+|[\s;|]+$/g, "")
      .trim();
  };
  const rangeIn = (card: string) => {
    range.lastIndex = 0;
    const match = range.exec(card);
    range.lastIndex = 0;
    return match;
  };
  const results: BoundedCareerTableRow[] = [];
  for (const section of sections) {
    const markers = [...section.body.matchAll(field)];
    markers.forEach((marker, cardIndex) => {
      if (
        !section.explicitlyOwned &&
        !/^(?:Employer|Organi[sz]ation)$/i.test(marker[1])
      )
        return;
      const card = section.body
        .slice(
          marker.index || 0,
          markers[cardIndex + 1]?.index ?? section.body.length,
        )
        .slice(0, 1200);
      const ownershipBoundary = card.search(
        /\b(?:Client|Customer|Project)\s*:/i,
      );
      const roleMarker =
        /\b(?:Role|Position(?:\s+Title)?|Designation|(?:Job\s+)?Title)\s*:/i.exec(
          card,
        );
      const periodMarker = /\b(?:Duration|Period|From\s*\/\s*To)\s*:/i.exec(
        card,
      );
      const joinedMarker = /\bDate\s+Joined\s*:/i.exec(card);
      const leftMarker = /\bDate\s+Left\s*:/i.exec(card);
      const splitStartMarker = splitStartLabel.exec(card);
      const splitEndMarker = splitEndLabel.exec(card);
      const dateMarkers = periodMarker
        ? [periodMarker]
        : joinedMarker || leftMarker
          ? [joinedMarker, leftMarker].filter(Boolean)
          : [splitStartMarker, splitEndMarker].filter(Boolean);
      if (
        ownershipBoundary >= 0 &&
        (!roleMarker ||
          !dateMarkers.length ||
          (roleMarker.index || 0) > ownershipBoundary ||
          dateMarkers.some((item) => (item?.index || 0) > ownershipBoundary))
      )
        return;
      const company = valueAfter(
        card,
        /^(?:\s*)(?:Employer|Company(?:\s+Name)?|Organi[sz]ation)\s*:\s*/i,
      );
      const title = valueAfter(
        card,
        /\b(?:Role|Position(?:\s+Title)?|Designation|(?:Job\s+)?Title)\s*:\s*/i,
      );
      const periodLabel = /\b(?:Duration|Period|From\s*\/\s*To)\s*:\s*/i.exec(
        card,
      );
      const joined = valueAfter(card, /\bDate\s+Joined\s*:\s*/i);
      const left = valueAfter(card, /\bDate\s+Left\s*:\s*/i);
      const splitStart = valueAfter(card, splitStartLabel);
      const splitEnd = valueAfter(card, splitEndLabel);
      const period = periodLabel
        ? rangeIn(card.slice((periodLabel.index || 0) + periodLabel[0].length))
        : null;
      const exactStart = (value: string) =>
        value.match(new RegExp(`^(${date})(?=\\s|$)`, "i"))?.[1] || "";
      const exactEnd = (value: string) =>
        value.match(
          new RegExp(
            `^(${date}|Present|Current|Now|Till\\s+(?:to\\s+)?Date)(?=\\s|$)`,
            "i",
          ),
        )?.[1] || "";
      const start = period?.[1] || exactStart(joined) || exactStart(splitStart);
      const end = period?.[2] || exactEnd(left) || exactEnd(splitEnd);
      const current = /^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(
        end,
      );
      const first = careerMonthIndex(start),
        last = careerMonthIndex(end, current);
      if (
        !company ||
        !title ||
        title.length > 120 ||
        title.split(/\s+/).length > 16 ||
        /^(?:project|role|position|designation|n\/?a)$/i.test(title) ||
        !start ||
        !end ||
        first === null ||
        last === null ||
        first > last ||
        /\b(?:client|customer|project)\b/i.test(company) ||
        /\b(?:client|customer|project\s+description)\b/i.test(title)
      )
        return;
      results.push({
        company: company.replace(/[.;,\s]+$/g, "").trim(),
        title: title.replace(/[.;,\s]+$/g, "").trim(),
        start,
        end,
        excerpt: card.slice(0, 300),
      });
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

/** Read three-line employer / role / date cards bounded by employment headings. */
export function multilineEmploymentTriples(
  input: string,
): BoundedCareerTableRow[] {
  const lines = input
    .normalize("NFKC")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const employment =
    /^(?:Professional\s+(?:Work\s+)?Experience|Employment\s+History|Career\s+History|Working\s+Experiences?|Work\s+Experience)\s*:?$/i;
  const boundary =
    /^(?:Projects?|Project\s+(?:Experience|History|Details)|Client\s+Experience|Education|Academic\s+Qualifications?|Certifications?|Technical\s+Skills?|Languages?|References?)\s*:?$/i;
  const legalEmployer =
    /^(?!.*\b(?:client|customer|project)\b)(?:(?:Employer|Company(?:\s+Name)?|Organi[sz]ation)\s*:\s*)?([A-Z][A-Za-z0-9&.,'() /-]{1,110}?\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Ltd\.?|Limited|Inc\.?|Corporation|Corp\.?|GmbH|LLC|Consulting|Technologies|Solutions|Systems|Bank|Berhad))(?:,\s*(?:Malaysia|India|Singapore))?$/i;
  const roleLine =
    /\b(?:consultant|engineer|analyst|architect|manager|lead|developer|specialist|programmer|administrator|executive)\b/i;
  const dateOnly = new RegExp(
    `^(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Now|Till\\s+(?:to\\s+)?Date)$`,
    "i",
  );
  const results: BoundedCareerTableRow[] = [];
  let inEmployment = false;
  lines.forEach((line, index) => {
    if (employment.test(line)) {
      inEmployment = true;
      return;
    }
    if (boundary.test(line)) {
      inEmployment = false;
      return;
    }
    if (!inEmployment) return;
    const period = dateOnly.exec(line);
    if (!period) return;
    const parsePair = (pair: string[]) => {
      if (
        pair.length !== 2 ||
        pair.some((value) => /\b(?:client|customer|project)\b/i.test(value))
      )
        return null;
      const companies = pair.flatMap((value) => {
        const match = legalEmployer.exec(value);
        return match ? [match[1].replace(/[.;,\s]+$/g, "").trim()] : [];
      });
      const roles = pair.filter(
        (value) =>
          roleLine.test(value) &&
          !legalEmployer.test(value) &&
          value.length <= 120,
      );
      return companies.length === 1 && roles.length === 1
        ? { company: companies[0], title: roles[0] }
        : null;
    };
    const before = parsePair(lines.slice(Math.max(0, index - 2), index));
    const after = parsePair(lines.slice(index + 1, index + 3));
    const owned = before || after;
    if (!owned) return;
    const current = /^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(
      period[2],
    );
    const first = careerMonthIndex(period[1]),
      last = careerMonthIndex(period[2], current);
    if (first === null || last === null || first > last) return;
    results.push({
      company: owned.company,
      title: owned.title,
      start: period[1],
      end: period[2],
      excerpt: [
        ...(before ? lines.slice(index - 2, index) : []),
        line,
        ...(before ? [] : lines.slice(index + 1, index + 3)),
      ]
        .join(" ")
        .slice(0, 300),
    });
  });
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
