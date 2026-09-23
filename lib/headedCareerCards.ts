import { careerMonthIndex } from "./candidateCareerExperience";

export type HeadedCareerCard = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `(?:${month}\\s*,?\\s*(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\s*/\\s*(?:19|20)\\d{2})`;
const period = `(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Now)`;
const job =
  "(?:Consultant|Manager|Lead|Analyst|Engineer|Developer|Specialist|Tester|Architect|Officer|Executive|Therapist|Chiropractor)";
const role =
  `((?:[A-Za-z0-9/&.+()-]+\\s+){0,9}${job}` +
  `(?:\\s*\\([^)]{1,50}\\))?` +
  `(?:\\s*,\\s*(?:[A-Za-z0-9/&.+()-]+\\s+){0,4}${job})?)`;
const duty =
  "(?:Liaise|Managed|Manage|Conducted|Review|Extracting|Created|Reduced|Responsible|Responsibilities|Led|Worked|Implemented|Configured|Supported|Support|Developed|Built|Collaborated|Provided|Assigned|Help|Adjusting|Assessing|In charge|Performed|Designed|Delivered|Coordinated)";
const heading =
  /\b(?:WORK(?:ING)? EXPERIENCES?|PROFESSIONAL EXPERIENCES?|EMPLOYMENT HISTORY|CAREER HISTORY)\b/gi;
const stop =
  /\b(?:Education|Academic Qualifications|References|Certifications|Project Experience|Project Details|Languages|Hobbies|Professional Summary)\b/i;

function cleaned(value: string) {
  return value.trim().replace(/^[|,:;–— -]+|[|,:;–— -]+$/g, "");
}

function normalizedDate(value: string) {
  return value.replace(/([A-Za-z])\s*,\s*(?=\d)/, "$1 ").trim();
}

function validate(
  companyInput: string,
  titleInput: string,
  start: string,
  end: string,
) {
  const company = cleaned(companyInput);
  const title = cleaned(titleInput);
  const first = careerMonthIndex(start);
  const last = careerMonthIndex(end, /^(?:Present|Current|Now)$/i.test(end));
  if (
    !company ||
    !title ||
    first === null ||
    last === null ||
    first > last ||
    company.length > 90 ||
    title.length > 105 ||
    /\b(?:client|customer|projects?|payroll|report to|university|college|school|industry|responsibilities|objective|service delivery)\b/i.test(
      company,
    ) ||
    /\b(?:project name|responsibilities|objective)\b/i.test(title) ||
    /^(?:client|customer)\b/i.test(title) ||
    new RegExp(`\\b${job}\\b`, "i").test(company) ||
    !new RegExp(`\\b${job}\\b`, "i").test(title)
  )
    return null;
  return { company, title };
}

type CardMatch = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

/**
 * Parse only the first explicit career card immediately below a work heading.
 *
 * Remaining source documents often flatten columns into a single line. The
 * anchor and duty boundary are deliberate: a later customer, product, or duty
 * sentence cannot be borrowed as an employer merely because it precedes a
 * date. Other cards remain in review until their own row boundary is proven.
 */
export function headedCareerCards(input: string): HeadedCareerCard[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  for (const foundHeading of text.matchAll(heading)) {
    if (
      /\b(?:project|client|customer|references?)\s*$/i.test(
        text.slice(
          Math.max(0, (foundHeading.index || 0) - 30),
          foundHeading.index,
        ),
      )
    )
      continue;
    const raw = text.slice((foundHeading.index || 0) + foundHeading[0].length);
    const boundary = raw.search(stop);
    const section = raw
      .slice(0, boundary < 0 ? 900 : Math.min(boundary, 900))
      .trimStart()
      .replace(/^\s*[:|–—-]+\s*/, "");
    const patterns: Array<{
      expression: RegExp;
      map: (match: RegExpMatchArray) => CardMatch;
    }> = [
      {
        // Employer / Role AUGUST 2023 TO PRESENT
        expression: new RegExp(
          `^([A-Z][A-Za-z0-9&.'() -]{2,90}?)\\s*[/|]\\s*${role}\\s+${period}(?=\\s*(?:,|${duty}\\b))`,
          "i",
        ),
        map: (match) => ({
          company: match[1],
          title: match[2],
          start: match[3],
          end: match[4],
          excerpt: match[0],
        }),
      },
      {
        // Employer May 2020 to Present SAP Functional Consultant
        expression: new RegExp(
          `^([A-Z][A-Za-z0-9&.'() -]{2,90}?)\\s+${period}\\s+${role}(?=\\s*(?:,|${duty}\\b))`,
          "i",
        ),
        map: (match) => ({
          company: match[1],
          title: match[4],
          start: match[2],
          end: match[3],
          excerpt: match[0],
        }),
      },
      {
        // SAP FICO Manager Employer - Location - July 2024 to Present
        expression: new RegExp(
          `^${role}\\s+([A-Z][A-Za-z0-9&.'() ]{2,80}?)\\s*[-–—,]\\s*(?![^0-9]{0,45}\\b(?:Ltd|Berhad|Sdn|Pte|Inc|Corp|Group)\\b)[^0-9]{2,45}?\\s*[-–—,]?\\s+${period}(?=\\s+(?:${duty}\\b|[A-Z][A-Za-z&.'-]+\\s+(?:business|is|was|has|participated)\\b))`,
          "iu",
        ),
        map: (match) => ({
          company: match[2],
          title: match[1],
          start: match[3],
          end: match[4],
          excerpt: match[0],
        }),
      },
      {
        // Employer - descriptor - Test Project Manager (July 2024 - Present)
        expression: new RegExp(
          `^([A-Z][A-Za-z0-9&.'/() -]{2,90}?)\\s*[-–—]\\s*(?:[A-Za-z&]+\\s+){1,7}[-–—]\\s*${role}\\s*\\(${period}\\)(?=\\s+(?:Job Description|${duty}\\b))`,
          "i",
        ),
        map: (match) => ({
          company: match[1],
          title: match[2],
          start: match[3],
          end: match[4],
          excerpt: match[0],
        }),
      },
      {
        // Employer - Master Data Analyst Jan 2021 - Present
        expression: new RegExp(
          `^([A-Z][A-Za-z0-9&.'() ]{2,90}?)\\s*[-–—]\\s*${role}\\s+${period}(?=\\s+${duty}\\b)`,
          "i",
        ),
        map: (match) => ({
          company: match[1],
          title: match[2],
          start: match[3],
          end: match[4],
          excerpt: match[0],
        }),
      },
      {
        // Senior Analyst Nov 2022 - Present Employer, Location
        expression: new RegExp(
          `^${role}\\s*${period}\\s+([A-Z][A-Za-z0-9&.'(), -]{2,90}?)(?=\\s*[•·-]?\\s*${duty}\\b)`,
          "i",
        ),
        map: (match) => ({
          company: match[4].replace(
            /,\s*[A-Z][A-Za-z .-]+(?:,\s*[A-Z][A-Za-z .-]+)*$/,
            "",
          ),
          title: match[1],
          start: match[2],
          end: match[3],
          excerpt: match[0],
        }),
      },
      {
        // Employer Sept 2023 - Feb 2024 [short tagline] IT Project Manager Report To:
        expression: new RegExp(
          `^([A-Z][A-Za-z0-9&.'() -]{2,90}?)\\s+${period}\\s+[A-Za-z0-9&.'() -]{0,100}?((?:(?:IT|SAP|ERP|Senior|Program|Project|Technical|Functional|Delivery|Service|Test|Data|Business)\\s+){1,4}${job})(?=\\s+Report To\\s*:)`,
          "i",
        ),
        map: (match) => ({
          company: match[1],
          title: match[4],
          start: match[2],
          end: match[3],
          excerpt: match[0],
        }),
      },
    ];
    for (const { expression, map } of patterns) {
      const match = section.match(expression);
      if (!match) continue;
      const card = map(match);
      const start = normalizedDate(card.start);
      const end = normalizedDate(card.end);
      const owned = validate(card.company, card.title, start, end);
      if (!owned) continue;
      return [
        {
          ...owned,
          start,
          end,
          excerpt: card.excerpt.slice(0, 280),
        },
      ];
    }
  }
  return [];
}
