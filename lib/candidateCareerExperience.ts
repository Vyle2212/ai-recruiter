export type CareerDateRange = { start?: unknown; end?: unknown; current?: unknown };

const clean = (value: unknown) => typeof value === "string" ? value.normalize("NFKC").trim() : "";

/** Deterministic month precision: year-only dates mean January; two-digit
 * years use a fixed 00-30 => 2000-2030, 31-99 => 1931-1999 pivot. */
export function careerMonthIndex(value: unknown, current = false, now = new Date()): number | null {
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const source = clean(value);
  if (current || /^(?:present|current|now|(?:till|to)(?:\s+to)?\s+date)$/i.test(source)) return currentMonth;
  const names = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  let year: number, month: number;
  const iso = source.match(/^(19\d{2}|20\d{2})(?:[-/](0?[1-9]|1[0-2]))?$/);
  const numeric = source.match(/^(0?[1-9]|1[0-2])\s*[/]\s*(\d{2}|19\d{2}|20\d{2})$/);
  const named = source.match(/^(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s’'-]+(\d{2}|19\d{2}|20\d{2})$/i);
  if (iso) { year = Number(iso[1]); month = Number(iso[2] || 1) - 1; }
  else if (numeric) { year = Number(numeric[2]); month = Number(numeric[1]) - 1; }
  else if (named) { year = Number(named[3]); month = names.indexOf(named[2].slice(0,3).toLowerCase()); }
  else {
    // ISO calendar dates remain supported, with validation instead of Date.parse rollover.
    const day = source.match(/^(19\d{2}|20\d{2})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
    if (!day) return null;
    year = Number(day[1]); month = Number(day[2]) - 1;
    const date = new Date(Date.UTC(year, month, Number(day[3])));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== Number(day[3])) return null;
  }
  if (year < 100) year += year <= 30 ? 2000 : 1900;
  // Validate an explicitly supplied day before reducing it to month precision.
  // UTC round-tripping rejects zero days, overflow and non-leap February 29.
  if (named?.[1] !== undefined) {
    const day = Number(named[1]);
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  }
  const result = year * 12 + month;
  return result <= currentMonth ? result : null;
}

/** Counts the union of supported employment ranges, never overlapping months twice. */
export function calculateTotalCareerYears(ranges: CareerDateRange[], now = new Date()): number | null {
  const intervals = ranges.map((range) => {
    const current = range.current === true || /^(true|yes|1)$/i.test(clean(range.current));
    const start = careerMonthIndex(range.start, false, now);
    const end = careerMonthIndex(range.end, current, now);
    return start !== null && end !== null && end >= start ? [start, end] as const : null;
  }).filter((range): range is readonly [number, number] => range !== null).sort((a, b) => a[0] - b[0]);
  if (!intervals.length) return null;
  let totalMonths = 0;
  let [start, end] = intervals[0];
  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else { totalMonths += end - start; start = nextStart; end = nextEnd; }
  }
  totalMonths += end - start;
  return Math.round((totalMonths / 12) * 10) / 10;
}

export function formatTotalCareerExperience(years: number | null | undefined) {
  if (typeof years !== "number" || !Number.isFinite(years) || years <= 0) return "Experience not established";
  if (years < 0.5) return "Less than 1 year experience";
  const wholeYears = Math.round(years);
  return `${wholeYears} ${wholeYears === 1 ? "year" : "years"} experience`;
}
