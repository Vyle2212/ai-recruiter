import type { Candidate360Profile } from "./candidate360Types";

export type CandidateCompareRecommendation = "strong_match" | "good_match" | "partial_match" | "weak_match" | "needs_more_info" | "not_recommended";
export type CandidateCompareDimension = "skills_match" | "module_match" | "experience_match" | "seniority_match" | "industry_match" | "location_match" | "availability_match" | "data_completeness" | "verification_trust" | "risk_flags";
export type CandidateCompareRoleRequirement = { roleTitle: string; roleSeniority: string; roleLocation: string; employmentType: string; mustHaveSkills: string[]; niceToHaveSkills: string[]; requiredModules: string[]; requiredIndustries: string[]; requiredLanguages: string[]; minYearsExperience: number | null; maxSalaryRange?: string; workMode?: string; notes?: string; keywordHints: string[] };
export type CandidateCompareRequest = CandidateCompareRoleRequirement & { candidateIds: string[] };
export type CandidateCompareCandidateInput = { candidateId: string; profile: Candidate360Profile };
export type CandidateCompareEvidence = { dimension: CandidateCompareDimension; fieldName: string; value: string; source: string; explanation: string };
export type CandidateCompareRisk = { code: string; severity: "low" | "medium" | "high"; message: string };
export type CandidateCompareDimensionScore = { dimension: CandidateCompareDimension; score: number; weight: number; neutral: boolean; explanation: string; matched: string[]; missing: string[] };
export type CandidateCompareCandidateScore = { candidateId: string; name: string; currentTitle: string; currentCompany: string; location: string; overallScore: number; ranking: number; recommendation: CandidateCompareRecommendation; dimensionScores: CandidateCompareDimensionScore[]; strengths: string[]; gaps: string[]; risks: CandidateCompareRisk[]; evidence: CandidateCompareEvidence[]; missingInfo: string[]; recruiterSummary: string; candidate360Href: string; selfConfirmHref: string };
export type CandidateCompareResult = { generatedAt: string; mode: "local deterministic comparison only; no candidate DB writes; no OpenAI calls"; request: CandidateCompareRequest; candidates: CandidateCompareCandidateScore[]; provider: "deterministic_v1" };

export interface CandidateCompareExplanationProvider { readonly name: string; explain(result: CandidateCompareResult): Promise<CandidateCompareResult>; }

