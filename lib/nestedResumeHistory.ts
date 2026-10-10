import { sapProjectTypeEvidence } from "./candidatePortalEditEvidence";
import { projectDateRange, projectDateIsCurrent } from "./projectDateEvidence";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const sectionEnd =
  /^(?:education|additional information|skills?|languages?|certifications?|references?)\s*:?$/i;
const projectHeading =
  /^(?:Migration\s+SAP\b|SAP\b.*\b(?:implementation|roll\s*out|migration|upgrade|support)\b|Application Management Services? (?:Division|Department))/i;

/** Count source cards independently of successful employer/role parsing so
 * coverage still reports omissions when this reader cannot resolve an owner. */
export function nestedProjectEvidenceCount(text: string) {
  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) =>
    /^(?:experience|(?:work|professional|employment|career) (?:experience|history))\s*:?$/i.test(
      line,
    ),
  );
  if (start < 0) return 0;
  const history = lines.slice(start + 1);
  const stop = history.findIndex((line) => sectionEnd.test(line));
  if (stop >= 0) history.splice(stop);
  return history.filter(
    (line, index) =>
      projectHeading.test(line) &&
      history
        .slice(index, index + 4)
        .some((row) => Boolean(projectDateRange(row))),
  ).length;
}

/** Read explicit company/date headers and their nested delivery cards. A
 * project date never becomes an employer date, and client names never become
 * legal employers. Only activate when both levels are evidenced in the CV. */
export function nestedResumeHistory(text: string) {
  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) =>
    /^(?:experience|(?:work|professional|employment|career) (?:experience|history))\s*:?$/i.test(
      line,
    ),
  );
  if (start < 0) return null;
  const history = lines.slice(start + 1);
  const stop = history.findIndex((line) => sectionEnd.test(line));
  if (stop >= 0) history.splice(stop);
  const employers: Array<{
    index: number;
    employer: string;
    start_date: string;
    end_date: string;
    current: boolean;
    title: string;
  }> = [];
  for (const [index, line] of history.entries()) {
    const dates = projectDateRange(line);
    if (!dates || !dates.index || projectHeading.test(line)) continue;
    const employer = clean(line.slice(0, dates.index))
      .replace(/[,;|–-]+$/, "")
      .trim();
    // An inline dated legal-company header, rather than a sentence or project.
    if (
      !/^(?:PT\.?\s|[\p{L}\p{N} &.,'()-]+\b(?:Ltd\.?|Limited|Inc\.?|LLC|GmbH|Pte\.?|Corporation|Consulting|Technologies|Solutions|Company)\b)/iu.test(
        employer,
      ) ||
      /\b(?:at|for|implementation|roll\s*out|migration|GPA|responsibilities)\b/i.test(
        employer,
      )
    )
      continue;
    employers.push({
      index,
      employer,
      start_date: dates[1],
      end_date: dates[2],
      current: projectDateIsCurrent(dates[2]),
      title: "",
    });
  }
  const projects: Array<Record<string, unknown>> = [];
  for (const [position, owner] of employers.entries()) {
    const end = employers[position + 1]?.index ?? history.length;
    const block = history.slice(owner.index + 1, end);
    const anchors = block.flatMap((line, index) =>
      projectHeading.test(line) ? [index] : [],
    );
    owner.title =
      block
        .slice(0, anchors[0] ?? block.length)
        .find(
          (line) =>
            /\b(?:consultant|manager|architect|analyst|developer|engineer|lead|associate)\b/i.test(
              line,
            ) &&
            !/^(?:A |An |The |As |[•*])|\b(?:provides|services firm|partner in)\b/i.test(
              line,
            ),
        ) || "";
    for (const [projectIndex, anchor] of anchors.entries()) {
      const card = block.slice(
        anchor,
        anchors[projectIndex + 1] ?? block.length,
      );
      const dateIndex = card
        .slice(0, 4)
        .findIndex((line) => Boolean(projectDateRange(line)));
      if (dateIndex < 1) continue;
      const dates = projectDateRange(card[dateIndex])!;
      const name = clean(card.slice(0, dateIndex).join(" "));
      const body = card.slice(dateIndex + 1).join(" ");
      const role =
        body
          .match(
            /^As\s+(?:a|an)\s+(.+?),?\s*responsibilities\s+include(?:d|s)?\s*:/i,
          )?.[1]
          ?.replace(/[,;]+$/, "")
          .trim() || "";
      projects.push({
        project_type: /^Application Management Services? /i.test(name)
          ? "AMS"
          : sapProjectTypeEvidence(name),
        name,
        employer: owner.employer,
        client: name.match(/\s+at\s+(.+)$/i)?.[1] || "",
        role,
        start_date: dates[1],
        end_date: dates[2],
        current: projectDateIsCurrent(dates[2]),
        description: body,
        evidence_source: "nested_employer_project_card",
      });
    }
  }
  if (
    !employers.length ||
    !projects.length ||
    employers.some((owner) => !owner.title)
  )
    return null;
  return {
    experience: employers.map(({ index, ...row }) => ({
      ...row,
      company: row.employer,
    })),
    projects,
  };
}

export function institutionFirstEducation(text: string) {
  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const start = lines.findIndex((line) => /^education\s*:?$/i.test(line));
  if (start < 0) return [];
  const body = lines.slice(start + 1);
  const end = body.findIndex((line) =>
    /^(?:experience|(?:work|professional|employment|career) (?:experience|history)|additional information|skills?|languages?|certifications?)\s*:?$/i.test(
      line,
    ),
  );
  if (end >= 0) body.splice(end);
  const anchors = body.flatMap((line, index) =>
    /^(?:INSTITUT|INSTITUTE|UNIVERSITAS|UNIVERSITY|COLLEGE)\b/i.test(line) &&
    !/\b(?:19|20)\d{2}\b/.test(line)
      ? [index]
      : [],
  );
  return anchors.flatMap((anchor, index) => {
    const block = body.slice(anchor, anchors[index + 1] ?? body.length);
    const qualification = block.find((line) =>
      /^(?:Sarjana|Bachelor|Master|Diploma|Doctor|B\.?Sc|M\.?Sc)\b/i.test(line),
    );
    if (!qualification) return [];
    return [
      {
        institution: block[0].replace(/[,;]+$/, ""),
        qualification,
        field_of_study:
          qualification.match(/Concentration\s*:\s*(.+)$/i)?.[1] || "",
        graduation_year:
          block
            .slice(1)
            .join(" ")
            .match(/\b(?:19|20)\d{2}\b/)?.[0] || "",
      },
    ];
  });
}
