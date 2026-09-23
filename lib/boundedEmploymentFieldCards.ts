import { careerMonthIndex } from "./candidateCareerExperience";
import type { BoundedCareerTableRow } from "./boundedCareerTables";

const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const date = `(?:${month}\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2})`;
const range = new RegExp(`\\b(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Now|Till\\s+(?:to\\s+)?Date)\\b`, "gi");
const roleWord = /\b(?:consultant|engineer|analyst|architect|manager|lead|developer|specialist|programmer)\b/i;

function closed(companyInput: string, titleInput: string, start: string, end: string, excerpt: string): BoundedCareerTableRow | null {
  const company = companyInput.replace(/[.;,\s]+$/g, "").trim();
  const title = titleInput.replace(/[.;,\s]+$/g, "").trim();
  if (!company || !title || company.length > 100 || title.length > 95 ||
    !roleWord.test(title) || /\b(?:client|customer|project|responsibilities|university)\b/i.test(company) ||
    /\b(?:client|customer|project\s+description|responsibilities)\b/i.test(title) ||
    /^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(end)) return null;
  const first = careerMonthIndex(start), last = careerMonthIndex(end);
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
    const before = section.slice(Math.max(0, (period.index || 0) - 6500), period.index);
    const career = [...before.matchAll(/\bWork\s+[A-Za-z]{2,24}\b/gi)].at(-1)?.index ?? -1;
    const project = [...before.matchAll(/\b(?:Project Experience|Project History|Project Details)\b/gi)].at(-1)?.index ?? -1;
    if (career < 0 || project > career) return [];
    const card = section.slice((period.index || 0) + period[0].length, periods[index + 1]?.index ?? section.length);
    const fields = /^\s+Role\s*:\s*(.{3,90}?)\s+Company\s*:\s*(.{2,110}?)(?=\s+[A-Za-z][A-Za-z ]{2,25}\s*:|\s+\b(?:Responsibilities|Duties|Projects?)\b|\s*$)/i.exec(card);
    if (!fields || /\b(?:client|customer)\s*:/i.test(card.slice(0, fields[0].length))) return [];
    // A Company cell with a printed organization type establishes ownership;
    // free-form prose about a company does not.
    if (!/(?:\b(?:Sdn\s*Bhd|Pte\s*Ltd|Ltd|Inc)\b|\([^)]{1,40}\bcompany\))\s*$/i.test(fields[2])) return [];
    const item = closed(fields[2], fields[1], period[1], period[2], `${period[0]} ${fields[0]}`);
    return item ? [item] : [];
  });
  const unique = found.filter((item, index) => found.findIndex(other =>
    [other.company, other.title, other.start, other.end].join("|").toLowerCase() ===
    [item.company, item.title, item.start, item.end].join("|").toLowerCase()) === index);
  return unique.length >= 2 ? unique : [];
}

/** A Company and Duration appear before Project and Role in this career form.
 * If multiple companies claim the exact same period, leave all of them for
 * source review instead of choosing one employer from concurrent projects. */
export function companyDurationRoleCards(input: string): BoundedCareerTableRow[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const heading = /\bProfessional Working Experience\b/i.exec(text);
  if (!heading) return [];
  const section = text.slice(heading.index + heading[0].length)
    .split(/\b(?:Education|Academic Qualifications|References|Certification(?:s)?)\b/i)[0]
    .slice(0, 14000);
  const markers = [...section.matchAll(/\bCompany\s*:/gi)];
  const candidates: BoundedCareerTableRow[] = [];
  const assertedSpans = new Map<string, number>();
  markers.forEach((marker, index) => {
    const card = section.slice(marker.index || 0, markers[index + 1]?.index ?? section.length).slice(0, 950);
    const fields = /^Company\s*:\s*(.{2,100}?)\s+Duration\s*:\s*/i.exec(card);
    if (!fields) return;
    const period = range.exec(card.slice(fields[0].length));
    range.lastIndex = 0;
    if (!period || period.index > 5) return;
    const tail = card.slice(fields[0].length + period.index + period[0].length);
    const role = /\bRole\s*:\s*(.{3,95}?)(?=\s+Responsibilities\s*:|\s+Project\s*:|\s*$)/i.exec(tail);
    if (!role || role.index > 250) return;
    const first = careerMonthIndex(period[1]), last = careerMonthIndex(period[2]);
    if (first !== null && last !== null && first <= last && !/^(?:present|current|now|till\s+(?:to\s+)?date)$/i.test(period[2])) {
      const span = `${first}:${last}`;
      assertedSpans.set(span, (assertedSpans.get(span) || 0) + 1);
    }
    const item = closed(fields[1], role[1], period[1], period[2], card);
    if (item) candidates.push(item);
  });
  return candidates.filter(item => assertedSpans.get(`${careerMonthIndex(item.start)}:${careerMonthIndex(item.end)}`) === 1);
}
