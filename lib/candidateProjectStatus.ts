import { careerDateIsCurrent } from "./careerDateEvidence";
import { careerMonthIndex } from "./candidateCareerExperience";

type Project = { end?: string; end_date?: string; current?: boolean };
/** A dated end always wins over a stale checkbox. Missing dates never imply current. */
export function candidateProjectStatuses(
  rows: Project[],
): ("Current" | "Latest" | "")[] {
  const ends = rows.map((row) => String(row.end_date || row.end || "").trim());
  const ongoing = rows.map(
    (row, i) =>
      careerDateIsCurrent(ends[i]) || (!ends[i] && row.current === true),
  );
  if (ongoing.some(Boolean))
    return ongoing.map((value) => (value ? "Current" : ""));
  // Status ranking depends on the supplied dates, not the browser clock.
  // Career tenure deliberately rejects future dates; that rule must not hide
  // a Latest badge while editing an explicit end month/year.
  const dates = ends.map((value) =>
    careerMonthIndex(value, false, new Date(Date.UTC(2100, 11, 1))),
  );
  const latest = Math.max(...dates.filter((v): v is number => v !== null));
  return dates.map((value) =>
    value !== null && value === latest ? "Latest" : "",
  );
}
