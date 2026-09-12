export type CareerDateRange = { start?: unknown; end?: unknown; current?: unknown };

const clean = (value: unknown) => typeof value === "string" ? value.normalize("NFKC").trim() : "";

function monthIndex(value: unknown, current = false, now = new Date()): number | null {
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (current || /^(present|current|now)$/i.test(clean(value))) return currentMonth;
  const source = clean(value);
  if (!source) return null;
  if (/^(19|20)\d{2}$/.test(source)) {
    const parsed = Number(source) * 12;
    return parsed <= currentMonth ? parsed : null;
  }
  const timestamp = Date.parse(source);
  if (Number.isNaN(timestamp)) return null;
  const date = new Date(timestamp);
  const parsed = date.getUTCFullYear() * 12 + date.getUTCMonth();
  return parsed <= currentMonth ? parsed : null;
}

/** Counts the union of supported employment ranges, never overlapping months twice. */
export function calculateTotalCareerYears(ranges: CareerDateRange[], now = new Date()): number | null {
  const intervals = ranges.map((range) => {
    const current = range.current === true || /^(true|yes|1)$/i.test(clean(range.current));
    const start = monthIndex(range.start, false, now);
    const end = monthIndex(range.end, current, now);
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
