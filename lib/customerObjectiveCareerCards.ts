import { careerMonthIndex } from "./candidateCareerExperience";
import { projectDateIsCurrent, projectDateRange } from "./projectDateEvidence";

export type CustomerObjectiveEmployment = {
  company: string;
  title: string;
  excerpt: string;
};
export type CustomerObjectiveProject = {
  employer: string;
  client: string;
  name: string;
  role: string;
  start: string;
  end: string;
  excerpt: string;
};

/** A Customer/Objective/Role triplet under a named employer is an assignment.
 * Its printed dates are never a statement of that employer's tenure. */
export function customerObjectiveCareerCards(source: string) {
  const lines = source.normalize("NFKC").replace(/\r/g, "").split("\n");
  const heading = lines.findIndex((line) =>
    /^\s*PROFESSIONAL\s+EXPERIENCE\s*:?\s*$/i.test(line),
  );
  const employment: CustomerObjectiveEmployment[] = [];
  const projects: CustomerObjectiveProject[] = [];
  if (heading < 0) return { employment, projects };
  const stop = lines.findIndex(
    (line, index) =>
      index > heading &&
      /^\s*(?:EDUCATION|ACADEMIC\s+QUALIFICATIONS?|CERTIFICATIONS?|REFERENCES)\b/i.test(
        line,
      ),
  );
  const section = lines.slice(heading + 1, stop < 0 ? undefined : stop);
  let employer = "";
  const roleLine = (line: string) =>
    /^\s*[•●▪\uF0B7*-]\s*((?:(?:Senior|Lead|Principal)\s+)?(?:SAP|ERP|ABAP|FI|MM|SD|PP|PM|QM|BW|BASIS)\b[^\n]{0,90}\b(?:Consultant|Lead|Manager|Developer|Analyst|Architect|Engineer|Specialist))\s*\.?\s*$/i.exec(
      line,
    )?.[1] || "";
  const companyLine = (line: string) => {
    const value = line.trim();
    return (
      value.length >= 5 &&
      value.length <= 110 &&
      /[A-Z]/.test(value) &&
      !/[a-z]/.test(value) &&
      /^[A-Z0-9 .,&()/'-]+$/.test(value) &&
      value.split(/\s+/).length >= 2 &&
      !/^(?:PROFESSIONAL|PROJECT|CUSTOMER|CLIENT|RESPONSIBILITIES|OBJECTIVE|ROLE|PAGE|CV)\b/.test(
        value,
      )
    );
  };
  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    if (companyLine(line)) {
      const second = companyLine(section[i + 1] || "")
        ? section[i + 1].trim()
        : "";
      const role = roleLine(section[i + (second ? 2 : 1)] || "");
      if (role) {
        employer = [line.trim(), second].filter(Boolean).join(" ");
        employment.push({
          company: employer,
          title: role.trim(),
          excerpt: [line, second, section[i + (second ? 2 : 1)]]
            .filter(Boolean)
            .join(" "),
        });
        if (second) i++;
        continue;
      }
    }
    const marker = /^\s*Customer\s*:\s*(.+)$/i.exec(line);
    if (!marker) continue;
    const range = projectDateRange(marker[1]);
    if (!range || range.index === undefined) continue;
    const client = marker[1].slice(0, range.index).trim();
    const start = range[1],
      end = range[2];
    const from = careerMonthIndex(start),
      to = careerMonthIndex(end, projectDateIsCurrent(end));
    if (
      !client ||
      client.length > 120 ||
      from === null ||
      to === null ||
      from > to
    )
      continue;
    const next = section
      .slice(i + 1, i + 6)
      .map((item) => item.trim())
      .filter(Boolean);
    const roleOffset = next
      .slice(1, 3)
      .findIndex((item) => /^Role\s*:?[ \t]+/i.test(item));
    const roleIndex = roleOffset < 0 ? -1 : roleOffset + 1;
    const firstObjective =
      /^Objective\s*:?[ \t]+(.{5,180})$/i.exec(next[0] || "")?.[1]?.trim() ||
      "";
    const objective =
      roleIndex > 0 &&
      next
        .slice(1, roleIndex)
        .every(
          (item) =>
            !/^(?:Customer|Client|Company|Employer|Project|Role)\s*:/i.test(
              item,
            ),
        )
        ? [firstObjective, ...next.slice(1, roleIndex)]
            .filter(Boolean)
            .join(" ")
        : "";
    const role =
      roleIndex > 0
        ? /^Role\s*:?[ \t]+(.{5,100})$/i
            .exec(next[roleIndex])?.[1]
            ?.replace(/[.;]\s*$/, "")
            .trim() || ""
        : "";
    if (
      !objective ||
      !role ||
      !/\bSAP\b/i.test(`${objective} ${role}`) ||
      !/\b(?:consultant|developer|analyst|architect|engineer|lead|manager|specialist)\b/i.test(
        role,
      ) ||
      !/\b(?:project|implementation|rollout|roll-out|upgrade|support|ams|migration|discovery)\b/i.test(
        objective,
      )
    )
      continue;
    projects.push({
      employer,
      client,
      name: objective,
      role,
      start,
      end,
      excerpt: [employer, line, ...next.slice(0, roleIndex + 1)]
        .filter(Boolean)
        .join(" "),
    });
  }
  return { employment, projects };
}
