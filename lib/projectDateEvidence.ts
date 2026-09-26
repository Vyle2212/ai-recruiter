import {
  CAREER_CURRENT_TOKEN_PATTERN,
  CAREER_DATE_TOKEN_PATTERN,
  careerDateIsCurrent,
  careerDateRange,
  validCareerDateRange,
} from "./careerDateEvidence";

export const PROJECT_DATE_TOKEN_PATTERN = CAREER_DATE_TOKEN_PATTERN;
export const PROJECT_CURRENT_TOKEN_PATTERN = CAREER_CURRENT_TOKEN_PATTERN;

export function projectDateRange(value: string) {
  return careerDateRange(value);
}

export function projectDateIsCurrent(value: unknown) {
  return careerDateIsCurrent(value);
}

export function validProjectDateRange(start: unknown, end: unknown) {
  return validCareerDateRange(start, end);
}
