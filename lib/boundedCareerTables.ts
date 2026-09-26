import { careerMonthIndex } from "./candidateCareerExperience";

export type BoundedCareerTableRow = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2})`;
const dated = new RegExp(`\\b(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Till\\s+(?:to\\s+)?Date)\\b`, "gi");
const legal = /^([A-Z][A-Za-z0-9&.,'() /-]{1,100}?\b(?:Sdn\.?\s*Bhd\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Ltd\.?|Limited|Inc\.?))(?:,\s*(?:Malaysia|India|Singapore))?\s+(.+)$/i;
const title = /^((?:(?:Senior|Junior|Lead|Principal|SAP|ERP|IT|FICO|FI|CO|MM|SD|Project|Solution|Technical|Functional|Business|Systems?|Application|Integration|Support|Delivery|Team|Data|Digital|[A-Z][a-z]{2,20})\s+){0,5}(?:Consultant|Engineer|Architect|Analyst|Manager|Developer|Specialist|Programmer)(?:\s*\/\s*(?:(?:Senior|Junior|Team|SAP|Project|Technical|Functional)\s+){0,2}(?:Consultant|Lead|Manager|Architect))?)\s+(.{2,110})$/i;

/** One row owns one legal employer, role, distinct client and dated Duration.
 * The header is essential: outside this exact table, a legal Company may be a
 * project customer. An old open-ended CV cannot establish current tenure. */
export function boundedCareerTables(input: string): BoundedCareerTableRow[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const heading = /\bProfessional Experience\s*:\s*Company\s+(?:Name|[A-Z][a-z]{2,14})\s+Designation\s+Client\s+Duration\b/i.exec(text);
  if (!heading) return [];
  const section = text.slice(heading.index + heading[0].length)
    .split(/\b(?:Project Experience|Projects?\s+Handled|Project Details|Education|Academic Qualifications|References)\b/i)[0]
    .slice(0, 2600);
  const periods = [...section.matchAll(dated)];
  const result: BoundedCareerTableRow[] = [];
  let from = 0;
  for (const period of periods) {
    const prefix = section.slice(from, period.index).trim();
    from = (period.index || 0) + period[0].length;
    // Each row starts at the previous row's end. Never borrow a later row's
    // employer, role or date, nor take a project name as Company.
    const fields = legal.exec(prefix);
    const role = fields && title.exec(fields[2] || "");
    if (!fields || !role || /\b(?:client|customer|project)\b/i.test(fields[1] || "")) continue;
    if (/^(?:present|current|till\s+(?:to\s+)?date)$/i.test(period[2])) continue;
    const start = period[1], end = period[2];
    const first = careerMonthIndex(start), last = careerMonthIndex(end);
    if (first === null || last === null || first > last) continue;
    result.push({company: fields[1], title: role[1], start, end,
      excerpt: `${prefix} ${period[0]}`.slice(0, 300)});
  }
  return result;
}
