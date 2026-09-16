import { careerMonthIndex } from "./candidateCareerExperience";

// Only explicit adjacent PDF labels form a card. A nearby employment date or
// an unrelated client line must not complete a partial assignment.
export function nativeProjectCards(source: string) {
  const heading = source.search(
    /^\s*(?:DETAILED WORK EXPERIENCES|PROJECT (?:PROFILE|HISTORY|EXPERIENCES?))\s*:?\s*$/im,
  );
  if (heading < 0) return [];
  const section = source
    .slice(heading)
    .replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gim, "");
  const bounded = section.split(
    /^\s*(?:EDUCATION|ACADEMIC QUALIFICATIONS|REFERENCES|PERSONAL DETAILS)\s*:?\s*$/im,
  )[0];
  const pattern =
    /^Project\s*:[ \t]*([^\n]+)\n[ \t]*Environment\s*:[ \t]*([^\n]+)\n[ \t]*Client\s*:[ \t]*([^\n]+)\n[ \t]*(?:Project\s+)?Duration\s*:[ \t]*([^\n]+)\n[ \t]*Roles?\s*&\s*Responsibilities\s*:[ \t]*\n[ \t]*[•●▪-][ \t]*([^\n]+)/gim;
  const output = [];
  for (const match of bounded.matchAll(pattern)) {
    const dates = match[4]
      .trim()
      .match(
        /^([A-Za-z]+\s+(?:19|20)\d{2})\s*[-–—]\s*([A-Za-z]+\s+(?:19|20)\d{2}|Present|Current)$/i,
      );
    if (!dates) continue;
    const start = careerMonthIndex(dates[1]);
    const end = careerMonthIndex(
      dates[2],
      /^(?:present|current)$/i.test(dates[2]),
    );
    if (start === null || end === null || start > end) continue;
    const prefix = bounded.slice(0, match.index).trimEnd();
    const role =
      prefix.match(/(?:^|\n)Role\s*:[ \t]*([^\n]+)$/i)?.[1]?.trim() || "";
    const name = match[1].trim(),
      environment = match[2].trim(),
      client = match[3].trim();
    const responsibility = match[5].trim().replace(/\s+/g, " ");
    if (
      !/\b(?:support|implement|rollout|migration|upgrade|enhancement|integration)\b/i.test(
        name + " " + responsibility,
      )
    )
      continue;
    output.push({
      name,
      environment,
      client,
      role,
      start: dates[1],
      end: dates[2],
      responsibility,
      excerpt: match[0],
    });
  }
  return output;
}
