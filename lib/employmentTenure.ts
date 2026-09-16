import { careerMonthIndex } from "./candidateCareerExperience";

/** Presentation only: missing month precision must never become an exact tenure. */
export function formatEmploymentTenure(
  start: string,
  end: string,
  current = false,
  reviewedAt = new Date(),
): string {
  const ongoing = current || /^(?:present|current|curr|now)$/i.test(end.trim());
  const from = careerMonthIndex(start, false, reviewedAt);
  const to = careerMonthIndex(end, ongoing, reviewedAt);
  if (from === null || to === null || to < from) return "";
  if (
    /^\d{4}$/.test(start.trim()) ||
    (!ongoing && /^\d{4}$/.test(end.trim()))
  ) {
    const years = Math.floor(to / 12) - Math.floor(from / 12);
    return years === 0
      ? "Less than 1 year (estimated; year precision)"
      : `About ${years} year${years === 1 ? "" : "s"} (estimated; year precision)`;
  }
  const months = to - from;
  if (!months) return "Less than 1 month";
  const years = Math.floor(months / 12),
    remainder = months % 12;
  return [
    years ? `${years} year${years === 1 ? "" : "s"}` : "",
    remainder ? `${remainder} month${remainder === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
