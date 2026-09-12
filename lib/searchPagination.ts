export type SearchPageItem = number | "ellipsis";

export function numberedSearchPages(currentPage: number, totalPages: number): SearchPageItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.min(total, Math.max(1, Math.floor(currentPage)));
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 4) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 3) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));
  const ordered = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: SearchPageItem[] = [];
  ordered.forEach((page, index) => { if (index && page - ordered[index - 1] > 1) result.push("ellipsis"); result.push(page); });
  return result;
}

export function buildSearchReturnUrl(state: { query: string; countries: string; skills: string; sapModules: string; matchQuality: string; page: number }) {
  const query = new URLSearchParams();
  if (state.query) query.set("q", state.query);
  if (state.countries) query.set("countries", state.countries);
  if (state.skills) query.set("skills", state.skills);
  if (state.sapModules) query.set("modules", state.sapModules);
  if (state.matchQuality) query.set("quality", state.matchQuality);
  query.set("page", String(Math.max(1, state.page)));
  return `/recruiter/talent-search/v2?${query.toString()}`;
}
