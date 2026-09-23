/** Explicit employer and customer labels keep a project's dates out of stated employment tenure. */
import { careerMonthIndex } from "./candidateCareerExperience";
export type OwnedProjectCareerRow = {
  employer: string;
  client: string;
  project: string;
  role: string;
  start: string;
  end: string;
  sourceRef: string;
  excerpt: string;
};

const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const dated = `(?:${month}\\s+(?:19|20)\\d{2}|\\d{1,2}\\.\\d{1,2}\\.(?:19|20)\\d{2})`;
const period = new RegExp(`\\b(${dated})\\s*(?:[-–—]|to|until)\\s*(${dated}|Present|Current|Now)\\b`, "i");
const label = /\b(?:Company|Employer|Customer|Client|End-Client|Industry|Projects?|Project Role|Role|Duration|Team Size|Module|Role and Responsibilit(?:y|ies)|Development Stage|Support Stage|Responsibilit(?:y|ies)|Duties)\s*:/gi;

function fields(source: string) {
  const markers = [...source.matchAll(label)];
  const values = new Map<string, string>();
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const key = marker[0].replace(/\s*:\s*$/, "").toLowerCase();
    if (values.has(key)) continue;
    values.set(key, source.slice((marker.index || 0) + marker[0].length, markers[index + 1]?.index ?? source.length).trim());
  }
  return values;
}

function date(value: string) {
  const numeric = /^(\d{1,2})\.(\d{1,2})\.((?:19|20)\d{2})$/.exec(value);
  if (!numeric) return value;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(numeric[2]) - 1];
  return month && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 31
    ? `${month} ${numeric[3]}` : "";
}

function row(input: { employer: string; client: string; project: string; role: string; period: string; sourceRef: string; excerpt: string }): OwnedProjectCareerRow | null {
  const match = period.exec(input.period);
  const employer = input.employer.replace(/[.;]\s*$/, "").trim();
  const client = input.client.replace(/[.;]\s*$/, "").trim();
  const role = input.role.replace(/[.;]\s*$/, "").trim();
  if (!match || !employer || !client || !input.project || !role ||
    employer.length > 120 || client.length > 120 || role.length > 100 ||
    /\b(?:references?|contact|telephone|e-?mail|project|customer|client)\b/i.test(employer) ||
    /\b(?:references?|contact|telephone|e-?mail|responsibilities)\b/i.test(role) ||
    !/\b(?:consultant|lead|engineer|analyst|architect|manager|specialist|developer|programmer)\b/i.test(role) ||
    employer.toLowerCase() === client.toLowerCase()) return null;
  const start = date(match[1]), end = date(match[2]);
  const first = careerMonthIndex(start), last = careerMonthIndex(end, /^(?:Present|Current|Now)$/i.test(end));
  if (first === null || last === null || first > last) return null;
  return { employer, client, project: input.project, role, start, end, sourceRef: input.sourceRef, excerpt: input.excerpt.slice(0, 320) };
}

export function ownedProjectCareerLedger(resumeText: string): OwnedProjectCareerRow[] {
  const text = resumeText.normalize("NFKC").replace(/\s+/g, " ")
    .split(/\b(?:References|Personal Profile|Educational Qualifications)\s*:?(?=\s|$)/i)[0];
  const output: OwnedProjectCareerRow[] = [];
  // A numbered project ledger owns each labelled field only until the next
  // project. Its Duration describes the assignment, never stated job tenure.
  const numbered = [...text.matchAll(/\bProject\s+(\d{1,2})\s+Duration\s*:/gi)];
  numbered.forEach((marker, index) => {
    const block = text.slice(marker.index || 0, numbered[index + 1]?.index ?? text.length)
      .split(/\b(?:Education|Academic Qualifications|Personal Profile|References|Contact Details)\s*:?/i)[0]
      .slice(0, 1400);
    const field = fields(block);
    const item = row({ employer: field.get("employer") || "", client: field.get("client") || "",
      project: `Project ${marker[1]}`, role: field.get("role") || "",
      period: field.get("duration") || "", sourceRef: `resume.ownedProjectLedger.numbered.${index + 1}`,
      excerpt: block });
    if (item) output.push(item);
  });
  // An explicitly separate Customer identifies a project client. Company is its employer.
  const companies = [...text.matchAll(/\bCompany\s*:/gi)];
  companies.forEach((marker, index) => {
    const block = text.slice(marker.index || 0, companies[index + 1]?.index ?? text.length)
      .split(/\b(?:Education|Academic Qualifications|Personal Profile|References|Contact Details)\s*:?/i)[0]
      .slice(0, 1300);
    const field = fields(block);
    const item = row({ employer: field.get("company") || "", client: field.get("customer") || "", project: field.get("project") || field.get("projects") || "", role: field.get("role") || "", period: field.get("duration") || "", sourceRef: `resume.ownedProjectLedger.company.${index + 1}`, excerpt: block });
    if (item) output.push(item);
  });
  // Stage dates under a labelled employment employer support a project envelope,
  // not a CV-stated employment start/end. Never take a subsequent employer's stage.
  const heading = text.match(/\bEmployment History\s*:?/i);
  if (!heading) return output;
  const section = text.slice((heading.index || 0) + heading[0].length)
    .split(/\b(?:Education|Academic Qualifications|Personal Profile|References|Contact Details)\s*:?/i)[0];
  const employers = [...section.matchAll(/\bEmployer\s*:/gi)];
  employers.forEach((marker, index) => {
    const block = section.slice(marker.index || 0, employers[index + 1]?.index ?? section.length).slice(0, 1300);
    const field = fields(block);
    const development = period.exec(field.get("development stage") || "");
    const support = period.exec(field.get("support stage") || "");
    if (!development || !support || !field.get("end-client")) return;
    const validStage = (start: string, end: string) => {
      const from = careerMonthIndex(date(start));
      const to = careerMonthIndex(date(end), /^(?:Present|Current|Now)$/i.test(end));
      return from !== null && to !== null && from <= to;
    };
    if (!validStage(development[1], development[2]) || !validStage(support[1], support[2])) return;
    const item = row({ employer: field.get("employer") || "", client: field.get("end-client") || "", project: field.get("project") || "", role: field.get("project role") || "", period: `${development[1]} – ${support[2]}`, sourceRef: `resume.ownedProjectLedger.employer.${index + 1}`, excerpt: block });
    if (item) output.push(item);
  });
  return output;
}
