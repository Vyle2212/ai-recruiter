import { careerMonthIndex } from "./candidateCareerExperience";

export type LabelledCompanySpell = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `(?:((?:19|20)\\d{2})\\s+(${month})|((?:19|20)\\d{2}))`;
const period = new RegExp(`^\\s*${date}\\s*[-–—]\\s*(?:${date}|(Present|Current|Now))\\b`, "i");
const title = /\b(?:Consultant|Analyst|Engineer|Manager|Specialist|Developer|Lead|Executive|Officer)\b/i;

function normalizedDate(year: string, namedMonth?: string) {
  return namedMonth ? `${namedMonth} ${year}` : year;
}

/** One Company Name field and one From/To field belong to the same card. */
export function labelledCompanySpells(input: string): LabelledCompanySpell[] {
  const source = input.normalize("NFKC").replace(/\s+/g, " ");
  const heading = /\b(?:Work(?:ing)? Experiences?|Employment History|Career History)\b/i.exec(source);
  if (!heading) return [];
  // A duty sentence can mention training or education; only the next Company
  // Name label bounds a card. Each card still requires its own From/To field.
  const section = source.slice(heading.index + heading[0].length);
  const markers = [...section.matchAll(/\bCompany Name\s*:/gi)];
  if (!markers.length) return [];
  const output: LabelledCompanySpell[] = [];
  for (let index = 0; index < markers.length; index++) {
    if (/\b(?:Project(?:\s+\d+)?|Client|Customer)\s*$/i.test(section.slice(Math.max(0, (markers[index].index || 0) - 35), markers[index].index))) continue;
    const block = section.slice(markers[index].index || 0, markers[index + 1]?.index ?? section.length).slice(0, 6000);
    const companyField = /^Company Name\s*:\s*([\s\S]*?)(?=\b(?:Client|Position Title)\s*:)/i.exec(block);
    const positionField = /\bPosition Title\s*:\s*([\s\S]*?)(?=\s*(?:\.|\b(?:Specialization|Role|Job Scope|Provide|Provided|Responsible|From\s*\/\s*To)\s*:|\bProvide\b))/i.exec(block);
    const dated = /\bFrom\s*\/\s*To\s*:\s*([^.;]{5,90})/i.exec(block);
    if (!companyField || !positionField || !dated) continue;
    const company = companyField[1].trim()
      .replace(/\s+Formerly known as\b[\s\S]*$/i, "")
      .replace(/\s*\(Outsourcing for\b[^)]*\)/i, "")
      .replace(/,\s*(?:Cyberjaya|Kuala Lumpur|Petaling Jaya|Singapore)\s*$/i, "");
    const job = positionField[1].trim();
    const matchedPeriod = dated[1].match(period);
    if (!matchedPeriod || !company || !job || !title.test(job) ||
      company.length > 100 || job.length > 90 ||
      /\b(?:client|customer|project|responsibilit(?:y|ies)|university|college)\b/i.test(company) ||
      /\b(?:client|customer|project|responsibilit(?:y|ies))\b/i.test(job)) continue;
    const start = normalizedDate(matchedPeriod[1] || matchedPeriod[3], matchedPeriod[2]);
    const end = matchedPeriod[7] || normalizedDate(matchedPeriod[4] || matchedPeriod[6], matchedPeriod[5]);
    const first = careerMonthIndex(start), last = careerMonthIndex(end, /^(?:Present|Current|Now)$/i.test(end));
    if (first === null || last === null || first > last) continue;
    output.push({ company, title: job, start, end, excerpt: block.slice(0, 280) });
  }
  return output;
}
