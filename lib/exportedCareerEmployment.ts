import { careerMonthIndex } from "./candidateCareerExperience";

export type ExportedCareerEmployment = {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  excerpt: string;
  sourceStart: number;
  sourceEnd: number;
};

// Profile exports join a section label directly to its first role. The explicit
// "role at employer dates (duration)" card still supplies field ownership.
// Printed durations only delimit cards: they never manufacture an endpoint.
export function exportedCareerEmployment(
  input: string,
): ExportedCareerEmployment[] {
  const source = input.normalize("NFKC").replace(/\s+/g, " ");
  const header = /\bCareer history\s*:?\s*/gi;
  const date =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+(?:19|20)\\d{2}";
  const duration = "\\(\\d+\\s+(?:years?|months?)(?:\\s+\\d+\\s+months?)?\\)";
  const card = new RegExp(
    `^([A-Za-z][^:;!?]{1,119}?)\\s+at\\s+([^:;!?]{2,140}?)\\s+(${date})\\s*[-–—]\\s*(${date}|Present|Current)\\s+${duration}(?=\\s|$)`,
    "i",
  );
  const role =
    /\b(?:consultant|manager|lead|developer|analyst|engineer|officer|accountant|architect|specialist|administrator|director|executive|associate|expert|controller|coordinator|intern|trainee|senior|support|programmer|advisor|therapist)\b/i;
  const forbidden =
    /\b(?:client|customer|project|responsibilities|duties|education|degree|university|worked|working|involved|responsible|supported|assigned|reported|reported to|unknown|confidential)\b/i;
  const output: ExportedCareerEmployment[] = [];
  for (const heading of source.matchAll(header)) {
    if (
      /\b(?:project|client|customer)\s*$/i.test(
        source.slice(Math.max(0, heading.index! - 30), heading.index),
      )
    )
      continue;
    const rest = source.slice(heading.index! + heading[0].length);
    const stop = rest.search(
      /\bEducation(?=[A-Z\s:]|$)|\bCurrent status|\bSkills(?=[A-Z\s:]|$)|\bReferences\b|\bCareer history/i,
    );
    const section = stop < 0 ? rest : rest.slice(0, stop);
    // Only adjacent cards have an unambiguous next title boundary. Narrative
    // after a card is not reinterpreted as the beginning of another title.
    let cursor = section.length - section.trimStart().length;
    let remaining = section.slice(cursor);
    while (remaining) {
      const match = remaining.match(card);
      if (!match) break;
      const title = match[1].trim(),
        company = match[2].trim();
      const start = match[3].replace(".", ""),
        end = match[4].replace(".", "");
      const current = /^(present|current)$/i.test(end);
      const a = careerMonthIndex(start),
        b = careerMonthIndex(end, current);
      if (
        role.test(title) &&
        !forbidden.test(
          title.replace(/\bProject (?=Manager|Lead|Director)\b/gi, ""),
        ) &&
        !forbidden.test(company) &&
        !/\bat\b|\b(?:19|20)\d{2}\b/i.test(company) &&
        title.split(/\s+/).length <= 14 &&
        a !== null &&
        b !== null &&
        a <= b
      ) {
        const sourceStart = heading.index! + heading[0].length + cursor;
        output.push({
          company,
          title,
          start,
          end,
          current,
          excerpt: match[0],
          sourceStart,
          sourceEnd: sourceStart + match[0].length,
        });
      }
      cursor += match[0].length;
      cursor += section.slice(cursor).match(/^\s*/)?.[0].length || 0;
      remaining = section.slice(cursor);
    }
  }
  return output;
}
