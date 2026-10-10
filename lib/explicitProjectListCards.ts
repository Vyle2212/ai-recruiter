import { careerMonthIndex } from "./candidateCareerExperience";
import { projectDateIsCurrent, projectDateRange } from "./projectDateEvidence";

/** Project bullets beneath an explicit SAP role heading. The heading supplies
 * the assignment role only; neither a client nor employer is inferred. */
export function explicitProjectListCards(source: string) {
  const lines = source.normalize("NFKC").replace(/\r/g, "").split("\n");
  const cards: Array<{name:string;role:string;start:string;end:string;excerpt:string}> = [];
  let role = "";
  for (const line of lines) {
    const heading = line.trim().match(/^OTHER ROLES\s+(SAP\s+.{3,100})$/i);
    if (heading) {
      role = /\b(?:consultant|developer|analyst|architect|engineer|lead|manager|specialist)\b/i.test(heading[1])
        ? heading[1].trim() : "";
      continue;
    }
    if (/^\s*(?:EMPLOYMENT|WORK EXPERIENCE|EDUCATION|CERTIFICATIONS?|REFERENCES)\s*$/i.test(line)) role = "";
    if (!role) continue;
    const project = line.trim().match(/^Project\s*:\s*(.{4,180})$/i);
    if (!project) continue;
    const dates = projectDateRange(project[1]);
    const dateIndex = dates?.index ?? -1;
    if (!dates || dateIndex < 4 || dates[0].trim().length > project[1].length) continue;
    const name = project[1].slice(0, dateIndex).replace(/[,;\s-]+$/, "").trim();
    const trailing = project[1].slice(dateIndex + dates[0].length).trim();
    const from = careerMonthIndex(dates[1]);
    const to = careerMonthIndex(dates[2], projectDateIsCurrent(dates[2]));
    if (name.length < 5 || name.length > 120 || trailing || from === null || to === null || from > to) continue;
    cards.push({name,role,start:dates[1],end:dates[2],excerpt:line.trim()});
  }
  return cards;
}
