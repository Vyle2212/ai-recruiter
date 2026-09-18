import { careerMonthIndex } from "./candidateCareerExperience";

// A section boundary is evidence of employer ownership. Never resynchronize
// inside duties, client lists or project prose after the first heading row.
export type AnchoredEmployment = {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  excerpt: string;
};
const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `${month}\\.?\\s+(?:19|20)\\d{2}`;
const ongoing = "(?:Present|Current|Now|To date|Till date)";
const range = `(${date})\\s*[-–—]\\s*(${date}|${ongoing})`;
const job =
  "(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Architect|Specialist|Administrator|Director|Executive|Associate|Controller|Coordinator|Therapist|Intern|Trainee|Steward|Supervisor|Department)";
const role = `(?:[A-Za-z0-9/&.-]+\\s+){0,7}${job}(?:\\s*\\([^()]{1,35}\\))?`;
const duty =
  "(?:[•➔\\uF0A7*-]|Responsibilities|Projects?|Client|Customer|Key (?:Responsibilities|Deliverables|highlight)|Conduct|Collaborate|Create|Lead|Led|Manage|Managed|Develop|Developed|Implement|Implemented|Support|Supported|Perform|Performed|Involved|Responsible|Handles?|Acts?|Deliver|Work|Worked|Review|Prepare|Provided|Providing|Assisted|Resolve|Ensure|Report|Design|Designing|Maintain|Maintained|Monitor|Monitoring)";
const boundary = `(?=\\s+(?:${duty}\\b|[•➔\\uF0A7*]|${date}|Phone\\s*:)|\\s*$)`;
const printedDuration =
  "(?:\\(\\d+(?:\\.\\d+)?\\s+(?:years?|months?)(?:\\s+\\d+\\s+months?)?\\)\\s+)?";
const roleAtStart = new RegExp(`^([^:;!?]{2,120}?)${boundary}`, "i");
const hasRole = new RegExp(`\\b${job}\\b`, "i");
const legal =
  /\b(?:Sdn\.?\s*Bhd|Pte\.?\s*Ltd|Pvt\.?\s*Ltd|Ltd|Limited|Inc|Berhad|Corporation|LLP)\b/i;
function titleFrom(next: string): string {
  const match = next.match(roleAtStart);
  const title = (match?.[1] || "").replace(/\s*[-–—*]+$/, "");
  if (
    match &&
    new RegExp(`^\\s*${date}`, "i").test(next.slice(match[0].length))
  )
    return "";
  return !new RegExp(date, "i").test(title) &&
    hasRole.test(title) &&
    !legal.test(title) &&
    !/\b(?:client|customer|worked|working|involved|responsibilities|education|degree|role|implementation)\b/i.test(
      title,
    )
    ? title
    : "";
}
const badCompany = new RegExp(
  `\\b(?:${job}|client|customer|project|education|university|degree|skills|references|summary|profile|experiences?|detailed|work|years?|months?|worked|working|involved|responsible|about|details|credentials|period|date|designation|company|employer|role|unknown|confidential|since|from|at)\\b`,
  "i",
);
function employer(value: string): boolean {
  return (
    /^[A-Za-z]/.test(value) &&
    value.length >= 2 &&
    value.length <= 110 &&
    value.split(/\s+/).length <= 14 &&
    !badCompany.test(value) &&
    !/\b(?:19|20)\d{2}\b|[:;|!?@]/.test(value)
  );
}

export function anchoredEmployment(input: string): AnchoredEmployment[] {
  const source = input.normalize("NFKC").replace(/\s+/g, " ");
  const output: AnchoredEmployment[] = [];
  const heading =
    /\b(?:Employment History|Career History|Work(?:ing)? Experiences?)\s*:?\s*/gi;
  for (const h of source.matchAll(heading)) {
    if (
      /\b(?:project|client|customer|detailed)\s*$/i.test(
        source.slice(Math.max(0, h.index! - 30), h.index),
      )
    )
      continue;
    const tail = source
      .slice(h.index! + h[0].length)
      .split(
        /\b(?:Education|Qualifications|Certifications|References|Technical Skills|Project (?:Experience|History|Details))\b/i,
      )[0];
    let rest = tail
      .replace(/^\d+[.)]\s*/, "")
      .replace(
        /^(?:Period of Service Company Designation|Date\s*Company Name\s*Role)\s*/i,
        "",
      );
    // Employer immediately before tenure: the following prose is not a title
    // unless a role-shaped phrase has its own explicit ending boundary.
    const companyFirst = rest.match(
      new RegExp(
        `^([A-Za-z0-9][A-Za-z0-9&.'’(), /-]{1,109}?)\\s*\\(?${range}\\)?(?=\\s|$)`,
        "i",
      ),
    );
    if (companyFirst && employer(companyFirst[1].trim())) {
      const next = rest.slice(companyFirst[0].length).trimStart();
      const title = titleFrom(next);
      const name = companyFirst[1].trim();
      if (
        /^(?:Project Description|Project Experience|Client|Customer)\b/i.test(
          next,
        )
      )
        continue;
      const explicitRole = new RegExp(`^(?:${role}|Role\\s*:)`, "i").test(next);
      if (
        !title &&
        !legal.test(name) &&
        !explicitRole &&
        !next.toLowerCase().startsWith(name.toLowerCase() + " is ")
      )
        continue;
      add(
        companyFirst[1],
        title,
        companyFirst[2],
        companyFirst[3],
        companyFirst[0] + (title ? " " + title : ""),
      );
      continue;
    }
    // Date-first ledgers have a clear SAP role prefix separating the employer
    // from the title. Only adjacent dated rows may follow; prose stops reading.
    const dated = new RegExp(
      `^${range}\\s*:?\\s+${printedDuration}([^:;|!?]{2,110}?)\\s+((?:Senior\\s+|Junior\\s+)?SAP\\s+(?:[A-Za-z0-9/&.-]+\\s+){0,6}${job}(?:\\s*[-–—]\\s*${role})?(?:\\s*\\([^()]{1,35}\\))?)${boundary}`,
      "i",
    );
    const datedLegal = new RegExp(
      `^${range}\\s*:?\\s+${printedDuration}([A-Za-z][A-Za-z0-9&.'’() /-]{1,100}?\\b(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Limited|Ltd\\.?|Inc\\.?|Berhad))\\s+(${role})${boundary}`,
      "i",
    );
    while (rest) {
      const m = rest.match(dated) || rest.match(datedLegal);
      if (!m || !employer(m[3].trim())) break;
      add(m[3], m[4], m[1], m[2], m[0]);
      rest = rest.slice(m[0].length).trimStart();
    }
  }
  function add(
    company: string,
    title: string,
    start: string,
    end: string,
    excerpt: string,
  ) {
    start = start.replace(".", "");
    end = end.replace(".", "");
    const current = new RegExp(`^${ongoing}$`, "i").test(end);
    if (current) end = "Present";
    const a = careerMonthIndex(start),
      b = careerMonthIndex(end, current);
    if (a === null || b === null || a > b) return;
    output.push({
      company: company.trim().replace(/[, ]+$/, ""),
      title,
      start,
      end,
      current,
      excerpt,
    });
  }
  return output;
}
