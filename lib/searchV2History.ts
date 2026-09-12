import { canonicalSearchV2QueryKey } from "./searchV2QueryNormalization";

export type SearchHistorySuggestion = {
  id: string;
  query: string;
  rawQuery?: string;
  normalizedQuery?: string;
  filters: {
    countries: string[];
    skills: string[];
    sapModules: string[];
    languages?: string[];
  };
  matchQuality: "any" | "relevant" | "strong";
  minimumScore: number;
  timestamp: string;
  source: "manual" | "guided" | "posted_job_jd" | "uploaded_jd";
  committedSnapshot?: import("./searchV2CommittedRequirements").CommittedSearchRequirements;
  preparationSnapshot?: import("./searchV2Preparation").SearchPreparationState;
  filterSnapshot?: import("./candidateSearchV2Types").CandidateSearchV2Filters;
  talentPool?: import("./candidateSearchV2Types").CandidateSearchTalentPool;
};
const normalize = (value: string) => canonicalSearchV2QueryKey(value);
export const searchV2HistoryQueryIdentity = (value: string) => normalize(value);
export function rankSearchHistory(
  items: SearchHistorySuggestion[],
  input: string,
  limit = 5,
) {
  const needle = normalize(input);
  return items
    .map((item) => {
      const query = normalize(item.query);
      const concepts = normalize(
        [
          ...item.filters.sapModules,
          ...item.filters.skills,
          ...(item.filters.languages || []),
          ...item.filters.countries,
        ].join(" "),
      );
      const haystack = `${query} ${concepts}`;
      let relevance = needle ? (haystack.includes(needle) ? 100 : 0) : 1;
      if (needle && query.startsWith(needle)) relevance += 100;
      if (needle && query === needle) relevance += 100;
      for (const token of needle.split(" ").filter(Boolean))
        if (haystack.includes(token)) relevance += 10;
      return { item, relevance, recency: Date.parse(item.timestamp) || 0 };
    })
    .filter((row) => !needle || row.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.recency - a.recency)
    .slice(0, limit)
    .map((row) => row.item);
}
