import type { CandidateCompareRequest } from "./candidateCompareTypes";

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value: unknown) => Array.from(new Set((Array.isArray(value) ? value : text(value).split(/[,;\n|]/)).map((item) => text(item).toLowerCase()).filter(Boolean)));
const STOP = new Set(["and","the","with","for","from","that","this","you","our","are","will","role","candidate","experience","years","required","preferred","skills","work"]);
export function extractDeterministicKeywordHints(notes: unknown) { return Array.from(new Set(text(notes).toLowerCase().match(/[a-z][a-z0-9+#./-]{2,}/g)?.filter((word) => !STOP.has(word)) || [])).slice(0, 30); }
export function normalizeCandidateCompareRequest(input: any): CandidateCompareRequest {
  const rawCandidateIds: unknown[] = Array.isArray(input?.candidateIds) ? input.candidateIds : text(input?.candidateIds).split(",");
  const candidateIds = Array.from(new Set(rawCandidateIds.map(text).filter(Boolean)));
  if (candidateIds.length < 2) throw new Error("Candidate Compare requires at least 2 candidate IDs.");
  if (candidateIds.length > 5) throw new Error("Candidate Compare supports at most 5 candidate IDs.");
  const years = Number(input?.minYearsExperience);
  return { roleTitle:text(input?.roleTitle), roleSeniority:text(input?.roleSeniority), roleLocation:text(input?.roleLocation), employmentType:text(input?.employmentType), mustHaveSkills:list(input?.mustHaveSkills), niceToHaveSkills:list(input?.niceToHaveSkills), requiredModules:list(input?.requiredModules), requiredIndustries:list(input?.requiredIndustries), requiredLanguages:list(input?.requiredLanguages), minYearsExperience:Number.isFinite(years)&&years>=0?years:null, maxSalaryRange:text(input?.maxSalaryRange)||undefined, workMode:text(input?.workMode)||undefined, notes:text(input?.notes)||undefined, keywordHints:extractDeterministicKeywordHints(input?.notes), candidateIds };
}
