import { careerMonthIndex } from "./candidateCareerExperience";
import { projectDateIsCurrent, projectDateRange } from "./projectDateEvidence";

/** Dated project cards below a separate employment history. A client heading
 * never establishes the employer or the duration of employment. */
export function sectionedProjectExperienceCards(source: string) {
  const lines = source.normalize("NFKC").replace(/\r/g, "").split("\n");
  const heading = lines.findIndex((line) =>
    /^\s*PROJECT\s+EXPERIENCE\s*:?\s*$/i.test(line),
  );
  if (heading < 0) return [];
  const stop = lines.findIndex(
    (line, index) =>
      index > heading &&
      /^\s*(?:EDUCATION|ACADEMIC|CERTIFICATIONS?|REFERENCES|LANGUAGES|PERSONAL DETAILS)\b/i.test(
        line,
      ),
  );
  const section = lines.slice(heading + 1, stop < 0 ? undefined : stop);
  const anchors = section.flatMap((line, index) => {
    const value = line.trim();
    const dates = projectDateRange(value);
    if (!dates || dates.index !== 0 || dates[0].trim().length !== value.length)
      return [];
    const from = careerMonthIndex(dates[1]);
    const to = careerMonthIndex(dates[2], projectDateIsCurrent(dates[2]));
    return from !== null && to !== null && from <= to
      ? [{ index, start: dates[1], end: dates[2] }]
      : [];
  });
  return anchors.flatMap((anchor, index) => {
    const previous = section
      .slice(index ? anchors[index - 1].index + 1 : 0, anchor.index)
      .map((line) => line.trim())
      .filter(Boolean);
    const headingLine = previous.at(-1) || "";
    const client =
      headingLine.length >= 5 &&
      headingLine.length <= 120 &&
      !/[.:;]$/.test(headingLine) &&
      !/^(?:Position|Project Description|Responsibilities|Environment|System|Platform)\s*:/i.test(
        headingLine,
      ) &&
      !/^[•●▪*-]/.test(headingLine)
        ? headingLine
        : "";
    const block = section
      .slice(anchor.index + 1, anchors[index + 1]?.index ?? section.length)
      .map((line) => line.trim());
    // The next client's heading is included only as evidence of that next
    // card; the preceding card ends at its own Environment field.
    const position = block.findIndex((line) =>
      /^Position\s*:\s*\S/i.test(line),
    );
    const description = block.findIndex((line) =>
      /^Project Description\s*:\s*\S/i.test(line),
    );
    const duties = block.findIndex((line) =>
      /^Responsibilities\s*:\s*$/i.test(line),
    );
    const environment = block.findIndex((line) =>
      /^Environment\s*:\s*\S/i.test(line),
    );
    if (
      position < 0 ||
      position > 2 ||
      description <= position ||
      description > position + 3 ||
      duties <= description ||
      duties > description + 5 ||
      environment <= duties ||
      environment > duties + 18
    )
      return [];
    const role = block[position].replace(/^Position\s*:\s*/i, "").trim();
    const name = [
      block[description].replace(/^Project Description\s*:\s*/i, ""),
      ...block.slice(description + 1, duties).filter(Boolean),
    ].join(" ");
    const responsibility: string[] = [];
    for (const line of block.slice(duties + 1, environment)) {
      if (/^[•●▪*-]\s*\S/.test(line))
        responsibility.push(line.replace(/^[•●▪*-]\s*/, ""));
      else if (line && responsibility.length)
        responsibility[responsibility.length - 1] += ` ${line}`;
    }
    const system = block[environment].replace(/^Environment\s*:\s*/i, "");
    if (
      role.length > 100 ||
      name.length < 12 ||
      name.length > 350 ||
      !/\b(?:consultant|developer|analyst|architect|engineer|lead|manager|specialist|tester)\b/i.test(
        role,
      ) ||
      !/\b(?:project|implementation|rollout|roll-out|upgrade|support|ams|migration|testing)\b/i.test(
        name,
      )
    )
      return [];
    return [
      {
        name,
        client,
        role,
        start: anchor.start,
        end: anchor.end,
        environment: system,
        responsibilities: responsibility.slice(0, 8),
        excerpt: [
          client,
          section[anchor.index],
          ...block.slice(0, environment + 1),
        ]
          .filter(Boolean)
          .join(" "),
      },
    ];
  });
}
