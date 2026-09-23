import { careerMonthIndex } from "./candidateCareerExperience";

export type HeadedChronologicalJob = {
  company: string;
  title: string;
  start: string;
  end: string;
  excerpt: string;
};

const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const date = `${month}\\s+(?:19|20)\\d{2}`;
const period = new RegExp(`\\b(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current|Now)\\b`, "gi");
const duty = "(?:Managed|Provided|Possess|Responsibilities|Developed|Led|Implemented|Worked|Conducted|Performed|Designed|Created|Supported|Directed|Coordinated|Delivered|Configured|Master\\s+in)";
const job = "(?:MANAGER|CONSULTANT|SPECIALIST|ANALYST|ENGINEER|DEVELOPER|LEAD)";
const roleWords = `(?:SENIOR\\s*/?\\s*)?(?:(?:PROJECT|ERP|SYSTEM|TECHNICAL|MES|SAP|IT|DATA)\\s+){0,3}${job}`;
const legal = "(?:Sdn\\.?\\s*Bhd\\.?|Pte\\.?\\s*Ltd\\.?|Pty\\.?\\s*Ltd\\.?|LLC|JSC|Ltd\\.?|Inc\\.?)";
const numericPeriod = /\[\s*(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})\s*[-–—]\s*(?:(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})|(Present|Current))\s*\]/gi;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function validDay(day: string, monthNumber: string, year: string): boolean {
  const parsed = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() + 1 === Number(monthNumber) && parsed.getUTCDate() === Number(day);
}

function ownership(next: string): {company: string; title: string} | null {
  // The employer is before the role; an uppercase role and a duty boundary
  // prevent prose or a customer named in a project paragraph becoming employer.
  const companyFirst = next.match(new RegExp(`^([^:;!?@]{2,105}?)\\s+(${roleWords}(?:\\s*/\\s*${roleWords})?)\\s+(?=${duty}\\b)`, "i"));
  if (companyFirst && companyFirst[2] === companyFirst[2].toUpperCase()) {
    const company = companyFirst[1].replace(new RegExp(`(${legal})\\s*,.*$`, "i"), "$1").replace(/[., ]+$/, "");
    if (/^[A-Za-z][A-Za-z .&'-]{2,90}$/.test(company) && !/\b(?:client|customer|project|education|university|course)\b/i.test(company))
      return {company, title: companyFirst[2].trim()};
  }
  // Hyphen separated role / legal employer / customer, as in a career summary.
  const roleFirstLegal = next.match(new RegExp(`^([A-Za-z][A-Za-z /&.-]{3,75}?\\b(?:Manager|Consultant|Specialist|Analyst|Engineer|Developer|Lead))\\s*[-–—]\\s*([A-Za-z][A-Za-z .&'-]{2,85}?\\b${legal})(?=\\s*[-–—,]|\\s+${duty}\\b)`, "i"));
  if (roleFirstLegal && !/\b(?:project|customer|client|school)\b/i.test(roleFirstLegal[2]))
    return {company: roleFirstLegal[2].replace(/[., ]+$/, ""), title: roleFirstLegal[1].trim()};
  // An SAP role and a distinct two-word employer before duty prose. Project
  // headings are rejected by the caller; the role must precede the employer.
  const sapFirst = next.match(new RegExp(`^(SAP\\s+(?:(?:[A-Za-z0-9/]+|Module\\s+[A-Z]{2,4})\\s+){0,5}?(?:Consultant|Manager|Specialist|Analyst|Engineer|Developer|Lead)(?:\\s+Module\\s+[A-Z]{2,4})?)\\s+([A-Z][a-zA-Z]+\\s+[A-Z][a-zA-Z]+)\\s+(?=${duty}\\b)`, "i"));
  if (sapFirst) return {company: sapFirst[2], title: sapFirst[1]};
  return null;
}

/** Parse only a chronology that starts immediately under a career heading. */
export function headedChronologicalEmployment(input: string): HeadedChronologicalJob[] {
  const text = input.normalize("NFKC").replace(/\s+/g, " ");
  const heading = /\b(?:WORK(?:ING)? EXPERIENCES?|PROFESSIONAL EXPERIENCES?|EMPLOYMENT HISTORY|CAREER HISTORY)\b/gi;
  const jobs: HeadedChronologicalJob[] = [];
  for (const h of text.matchAll(heading)) {
    if (/\b(?:project|client|customer|references?)\s*$/i.test(text.slice(Math.max(0, (h.index || 0) - 30), h.index))) continue;
    const section = text.slice((h.index || 0) + h[0].length).split(/\b(?:Education|Academic Qualifications|References|Project Experience|Project Details|Certifications)\b/i)[0].slice(0, 5500);
    const rows = [...section.matchAll(period)];
    if (rows.length && (rows[0].index || 0) > 100 && ![...section.matchAll(numericPeriod)].some(m => (m.index || 0) < 100)) continue;
    // A date within a duty sentence is not a new employment row. Each row
    // must establish a fresh employer and title before the next period.
    for (const [index, m] of rows.length && (rows[0].index || 0) <= 100 ? rows.entries() : []) {
      const after = section.slice((m.index || 0) + m[0].length, rows[index + 1]?.index ?? section.length).replace(/^\s*:\s*/, "").trimStart();
      const found = ownership(after);
      if (!found) continue;
      const start = m[1], end = m[2];
      const a = careerMonthIndex(start), b = careerMonthIndex(end, /^(?:Present|Current|Now)$/i.test(end));
      if (a === null || b === null || a > b) continue;
      jobs.push({ ...found, start, end, excerpt: (m[0] + " " + after).slice(0, 280) });
    }
    // Bracketed day/month/year rows are interpreted only when another date in
    // this same chronology proves day-first notation (a day greater than 12).
    // Ambiguous isolated dates remain untouched for source review.
    const numericRows = [...section.matchAll(numericPeriod)];
    if (numericRows.length && (numericRows[0].index || 0) < 100 &&
      numericRows.some(m => (Number(m[1]) > 12 && validDay(m[1], m[2], m[3])) ||
        (Number(m[4]) > 12 && validDay(m[4], m[5], m[6]))) &&
      numericRows.every(m => Number(m[2]) <= 12 && (!m[5] || Number(m[5]) <= 12))) {
      for (const [index, m] of numericRows.entries()) {
        const after = section.slice((m.index || 0) + m[0].length, numericRows[index + 1]?.index ?? section.length);
        const owned = after.match(/^\s*((?:Senior\s+)?SAP\s+(?:(?:Senior|SAP|FI\/CO|FICO|BW|MM|SD|PP|ABAP)\s+){0,3}Consultant)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+City\s*:/i);
        if (!owned || !m[1] || !m[2] || !m[3] || !validDay(m[1], m[2], m[3]) ||
          (m[4] && !validDay(m[4], m[5], m[6]))) continue;
        const start = `${months[Number(m[2]) - 1]} ${m[3]}`;
        const end = m[7] || `${months[Number(m[5]) - 1]} ${m[6]}`;
        const a = careerMonthIndex(start), b = careerMonthIndex(end, /^(?:Present|Current)$/i.test(end));
        if (a === null || b === null || a > b) continue;
        jobs.push({company: owned[2], title: owned[1], start, end, excerpt: (m[0] + after).slice(0, 280)});
      }
    }
    if (jobs.length) break;
  }
  return jobs;
}
