import { careerMonthIndex } from "./candidateCareerExperience";

const CAREER_MONTH_NAME =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

export const CAREER_DATE_TOKEN_PATTERN = `(?:${CAREER_MONTH_NAME}[\\s’'/-]+(?:\\d{2}|(?:19|20)\\d{2})|(?:0?[1-9]|1[0-2])\\s*\\/\\s*(?:\\d{2}|(?:19|20)\\d{2})|(?:19|20)\\d{2}(?:[-/](?:0?[1-9]|1[0-2]))?)`;
export const CAREER_CURRENT_TOKEN_PATTERN =
  "(?:Present|Current|Curr|Now|Till(?:\\s+to)?\\s+date|To\\s+date)";

export function careerDateRange(value: string) {
  return value.match(
    new RegExp(
      `\\b(${CAREER_DATE_TOKEN_PATTERN})\\s*(?:-|–|—|to|~)\\s*(${CAREER_DATE_TOKEN_PATTERN}|${CAREER_CURRENT_TOKEN_PATTERN})\\b`,
      "i",
    ),
  );
}

export function careerDateIsCurrent(value: unknown) {
  return new RegExp(`^${CAREER_CURRENT_TOKEN_PATTERN}$`, "i").test(
    String(value ?? "").trim(),
  );
}

export function validCareerDateRange(start: unknown, end: unknown) {
  const from = careerMonthIndex(start);
  const to = careerMonthIndex(end, careerDateIsCurrent(end));
  return from !== null && to !== null && from <= to;
}
