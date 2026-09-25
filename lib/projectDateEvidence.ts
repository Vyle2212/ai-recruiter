import { careerMonthIndex } from "./candidateCareerExperience";

const PROJECT_MONTH_NAME =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

export const PROJECT_DATE_TOKEN_PATTERN = `(?:${PROJECT_MONTH_NAME}[\\s’'/-]+(?:\\d{2}|(?:19|20)\\d{2})|(?:0?[1-9]|1[0-2])\\s*\\/\\s*(?:\\d{2}|(?:19|20)\\d{2})|(?:19|20)\\d{2}(?:[-/](?:0?[1-9]|1[0-2]))?)`;
export const PROJECT_CURRENT_TOKEN_PATTERN =
  "(?:Present|Current|Now|Till\\s+date|To\\s+date)";

export function projectDateRange(value: string) {
  return value.match(
    new RegExp(
      `\\b(${PROJECT_DATE_TOKEN_PATTERN})\\s*(?:-|–|—|to|~)\\s*(${PROJECT_DATE_TOKEN_PATTERN}|${PROJECT_CURRENT_TOKEN_PATTERN})\\b`,
      "i",
    ),
  );
}

export function projectDateIsCurrent(value: unknown) {
  return new RegExp(`^${PROJECT_CURRENT_TOKEN_PATTERN}$`, "i").test(
    String(value ?? "").trim(),
  );
}

export function validProjectDateRange(start: unknown, end: unknown) {
  const from = careerMonthIndex(start);
  const to = careerMonthIndex(end, projectDateIsCurrent(end));
  return from !== null && to !== null && from <= to;
}
