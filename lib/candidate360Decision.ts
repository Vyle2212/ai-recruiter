import type { Candidate360Profile } from "./candidate360Types";

type AnyRecord = Record<string, unknown>;
export type DecisionConfidence = "High" | "Medium" | "Low";
export type EvidenceRef = { text: string; source: string };
export type DecisionSignal = {
  key: string;
  label: string;
  score: number | null;
  status: "matched" | "missing" | "unknown";
  evidence: EvidenceRef[];
  missingEvidence: string[];
  reason: string;
  confidence: DecisionConfidence;
};
export type CandidateJobDecision = {
  job: { id: string; title: string; company: string };
  overall: DecisionSignal & { recommendation: "Interview" | "Hold" | "Reject" | "Need Validation" | "Job Required" };
  breakdown: DecisionSignal[];
  requirements: DecisionSignal[];
  strengths: DecisionSignal[];
  risks: DecisionSignal[];
  unknowns: DecisionSignal[];
  interviewFocus: Array<{ question: string; reason: string; evidence: EvidenceRef[]; confidence: DecisionConfidence }>;
  timelineInsights: Array<{ label: string; value: string; evidence: EvidenceRef[] }>;
  implementationMap: Array<{ label: string; count: number; evidence: EvidenceRef[] }>;
  projectQuality: Array<{ projectId: string; project: string; signals: DecisionSignal[] }>;
  clientPortfolio: { clients: string[]; industries: Array<{ label: string; count: number }>; countries: Array<{ label: string; count: number }> };
  market: { available: false; message: "Market data unavailable." } | { available: true; evidence: EvidenceRef[]; data: AnyRecord };
};

const GENERIC = /^(unknown|not provided|n\/?a|none|null|undefined|to confirm|needs repair)$/i;
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const meaningful = (value: unknown) => Boolean(clean(value) && !GENERIC.test(clean(value)));
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const words = (value: unknown) => clean(value).toLowerCase().split(/[^a-z0-9+/#.-]+/).filter((item) => item.length > 1);
const unique = <T,>(items: T[], key: (item: T) => string) => Array.from(new Map(items.map((item) => [key(item).toLowerCase(), item])).values());

function field(record: AnyRecord, aliases: string[]) {
  for (const alias of aliases) if (meaningful(record[alias])) return record[alias];
}
function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(list);
  if (value && typeof value === "object") return Object.values(value as AnyRecord).flatMap(list);
  return clean(value).split(/[,;|\n]/).map(clean).filter(meaningful);
}
function confidence(known: number, total: number): DecisionConfidence {
  const ratio = total ? known / total : 0;
  return ratio >= .75 ? "High" : ratio >= .45 ? "Medium" : "Low";
}
function evidence(text: string, source: string): EvidenceRef { return { text, source }; }
function signal(input: Omit<DecisionSignal, "confidence"> & { confidence?: DecisionConfidence }): DecisionSignal {
  return { ...input, confidence: input.confidence || confidence(input.evidence.length, input.evidence.length + input.missingEvidence.length) };
}
function frequencies(values: string[]) {
  const map = new Map<string, { label: string; count: number }>();
  for (const value of values.filter(meaningful)) { const key = clean(value).toLowerCase(); const current = map.get(key); map.set(key, { label: current?.label || clean(value), count: (current?.count || 0) + 1 }); }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
function jobRequirements(job: AnyRecord) {
  return unique([
    ...list(field(job, ["requirements", "must_have", "mustHave", "required_skills", "skills"])),
    ...list(field(job, ["sap_modules", "modules", "primary_module"])),
    ...list(field(job, ["languages", "language_requirements"])),
    ...list(field(job, ["location", "country", "work_location"])),
  ].filter((item) => item.length < 120), (item) => item);
}

export function buildCandidateJobDecision(profile: Candidate360Profile, job: AnyRecord): CandidateJobDecision {
  const enterprise = profile.enterpriseProfile;
  const h = enterprise.careerHighlights;
  const projectText = enterprise.projects.map((item) => [item.name, item.client, item.role, item.industry, item.country, item.projectType, item.implementationType, item.environment, ...item.modules, ...item.responsibilities].join(" ")).join(" ");
  const candidateText = [enterprise.identity.currentTitle, enterprise.identity.currentCompany, enterprise.identity.location, enterprise.identity.country, enterprise.summary, ...enterprise.sapModules, ...enterprise.technicalSkills, ...enterprise.languages.flatMap((item) => [item.language, item.proficiency]), projectText].join(" ").toLowerCase();
  const requirements = jobRequirements(job);
  const requirementSignals = requirements.map((requirement, index) => {
    const requirementWords = words(requirement);
    const hits = requirementWords.filter((word) => candidateText.includes(word));
    const matched = requirementWords.length > 0 && hits.length / requirementWords.length >= .5;
    const refs: EvidenceRef[] = [];
    if (matched) {
      const module = enterprise.sapModules.find((item) => requirementWords.some((word) => item.toLowerCase().includes(word)));
      const skill = enterprise.technicalSkills.find((item) => requirementWords.some((word) => item.toLowerCase().includes(word)));
      const project = enterprise.projects.find((item) => requirementWords.some((word) => [item.name, item.role, item.industry, item.country, item.environment, ...item.modules].join(" ").toLowerCase().includes(word)));
      if (module) refs.push(evidence(module, "enterpriseProfile.sapModules"));
      if (skill) refs.push(evidence(skill, "enterpriseProfile.technicalSkills"));
      if (project) refs.push(evidence(`${project.name || project.client}: ${requirement}`, `enterpriseProfile.projects.${project.id}`));
      if (!refs.length) refs.push(evidence(requirement, "enterpriseProfile normalized evidence"));
    }
    return signal({ key: `requirement-${index}`, label: requirement, score: matched ? clamp(70 + 30 * hits.length / Math.max(1, requirementWords.length)) : null, status: matched ? "matched" : "missing", evidence: refs, missingEvidence: matched ? [] : [`Candidate evidence for ${requirement}`], reason: matched ? "Candidate evidence overlaps this explicit job requirement." : "This job requirement is explicit, but supporting candidate evidence was not found." });
  });

  const matchedRequirements = requirementSignals.filter((item) => item.status === "matched");
  const requirementCoverage = requirements.length ? matchedRequirements.length / requirements.length : 0;
  const category = (key: string, label: string, refs: EvidenceRef[], missing: string[], base?: number) => signal({ key, label, score: refs.length ? clamp(base ?? 70 + refs.length * 6) : null, status: refs.length ? "matched" : "unknown", evidence: refs, missingEvidence: refs.length ? [] : missing, reason: refs.length ? `${label} is supported by normalized candidate evidence and compared with the selected job.` : `${label} cannot be scored without supporting candidate and job evidence.` });
  const yearsRef = h.yearsExperience ? [evidence(`${h.yearsExperience} years experience`, "enterpriseProfile.careerHighlights.yearsExperience")] : [];
  const skillRefs = matchedRequirements.flatMap((item) => item.evidence).slice(0, 5);
  const industryRefs = h.industries.map((item) => evidence(item, "enterpriseProfile.careerHighlights.industries"));
  const implementationRefs = h.implementationProjects ? [evidence(`${h.implementationProjects} implementation projects`, "enterpriseProfile.careerHighlights.implementationProjects")] : [];
  const languageRefs = enterprise.languages.map((item) => evidence([item.language, item.proficiency].filter(Boolean).join(" · "), "enterpriseProfile.languages"));
  const locationRefs = meaningful(enterprise.identity.location) ? [evidence(enterprise.identity.location, "enterpriseProfile.identity.location")] : [];
  const availabilityRefs = meaningful(enterprise.recruiterSignals.availability) ? [evidence(enterprise.recruiterSignals.availability, "enterpriseProfile.recruiterSignals.availability")] : [];
  const salaryRefs = meaningful(enterprise.recruiterSignals.salary) ? [evidence(enterprise.recruiterSignals.salary, "enterpriseProfile.recruiterSignals.salary")] : [];
  const breakdown = [
    category("experience", "Experience", yearsRef, ["Verified experience duration"]),
    category("skills", "Skills", skillRefs, ["Candidate evidence matching explicit job skills"], requirements.length ? 55 + requirementCoverage * 45 : undefined),
    category("industry", "Industry", industryRefs, ["Industry evidence and job industry requirement"]),
    category("implementation", "Implementation", implementationRefs, ["Implementation count or owned implementation project"]),
    category("language", "Language", languageRefs, ["Language and proficiency evidence"]),
    category("location", "Location", locationRefs, ["Candidate location and job location"]),
    category("availability", "Availability", availabilityRefs, ["Confirmed availability"]),
    category("salary", "Salary", salaryRefs, ["Confirmed salary expectation"]),
  ];
  const scored = breakdown.filter((item) => item.score !== null);
  const overallScore = requirements.length && scored.length ? clamp((requirementCoverage * 60) + (scored.reduce((sum, item) => sum + (item.score || 0), 0) / scored.length * .4)) : null;
  const overallConfidence = confidence(matchedRequirements.length + scored.length, Math.max(1, requirements.length + breakdown.length));
  const recommendation: CandidateJobDecision["overall"]["recommendation"] = overallScore === null ? (requirements.length ? "Need Validation" : "Job Required") : overallScore >= 72 ? "Interview" : overallScore >= 55 ? "Hold" : "Need Validation";
  const overall = { ...signal({ key: "overall", label: "Overall Fit", score: overallScore, status: overallScore === null ? "unknown" : overallScore >= 55 ? "matched" : "missing", evidence: matchedRequirements.flatMap((item) => item.evidence).slice(0, 5), missingEvidence: requirementSignals.filter((item) => item.status !== "matched").map((item) => item.label), reason: requirements.length ? `Based on ${matchedRequirements.length} of ${requirements.length} explicit requirements plus ${scored.length} evidence-backed dimensions.` : "A selected Job with explicit requirements is required before fit can be calculated.", confidence: overallConfidence }), recommendation };

  const unknownRisks: DecisionSignal[] = [
    ["salary-risk", "Salary expectations", salaryRefs, "Confirmed expected salary"],
    ["notice-risk", "Notice period", meaningful(enterprise.recruiterSignals.notice) ? [evidence(enterprise.recruiterSignals.notice, "enterpriseProfile.recruiterSignals.notice")] : [], "Confirmed notice period"],
    ["visa-risk", "Visa / work authorization", meaningful(enterprise.recruiterSignals.visa) ? [evidence(enterprise.recruiterSignals.visa, "enterpriseProfile.recruiterSignals.visa")] : [], "Confirmed visa or work rights"],
    ["leadership-risk", "Leadership evidence", h.leadershipExperience ? [evidence(`${h.yearsLeadership || "Recorded"} leadership experience`, "enterpriseProfile.careerHighlights.leadershipExperience")] : [], "Team size or leadership accountability"],
  ].map(([key, label, refs, missing]) => signal({ key: String(key), label: String(label), score: (refs as EvidenceRef[]).length ? 80 : null, status: (refs as EvidenceRef[]).length ? "matched" : "unknown", evidence: refs as EvidenceRef[], missingEvidence: (refs as EvidenceRef[]).length ? [] : [String(missing)], reason: (refs as EvidenceRef[]).length ? "Candidate evidence is present; recruiter verification may still be required." : "This hiring factor is unresolved and may affect submission readiness." }));
  const missingRequirementRisks = requirementSignals.filter((item) => item.status === "missing").slice(0, 5);
  const risks: DecisionSignal[] = [];
  const strengths = [...requirementSignals.filter((item) => item.status === "matched"), ...breakdown.filter((item) => (item.score || 0) >= 75)].slice(0, 6);
  const unknowns = [...missingRequirementRisks, ...breakdown.filter((item) => item.status === "unknown"), ...unknownRisks.filter((item) => item.status === "unknown")];
  const interviewFocus = [...missingRequirementRisks, ...unknowns].slice(0, 7).map((item) => ({ question: item.key.startsWith("requirement-") ? `Validate ${item.label} depth and personal ownership.` : `Confirm ${item.label.toLowerCase()} with the candidate.`, reason: item.reason, evidence: item.evidence.length ? item.evidence : [evidence(item.missingEvidence.join(", "), "missing evidence")], confidence: item.confidence }));

  const starts = enterprise.employmentTimeline.map((item) => Number((item.start.match(/\d{4}/) || [])[0])).filter(Number.isFinite);
  const timelineInsights = [
    h.yearsExperience ? { label: "Career experience", value: `${h.yearsExperience} years`, evidence: yearsRef } : null,
    enterprise.employmentTimeline[0]?.duration ? { label: "Current tenure", value: enterprise.employmentTimeline[0].duration, evidence: [evidence(enterprise.employmentTimeline[0].company, `enterpriseProfile.employmentTimeline.${enterprise.employmentTimeline[0].id}`)] } : null,
    starts.length ? { label: "Most active span", value: `${Math.min(...starts)}–${Math.max(...starts)}`, evidence: [evidence(`${starts.length} dated positions`, "enterpriseProfile.employmentTimeline")] } : null,
    h.yearsConsulting ? { label: "Consulting experience", value: `${h.yearsConsulting} years`, evidence: [evidence(`${h.yearsConsulting} years`, "enterpriseProfile.careerHighlights.yearsConsulting")] } : null,
    h.countries.length ? { label: "Country exposure", value: h.countries.join(", "), evidence: h.countries.map((item) => evidence(item, "enterpriseProfile.careerHighlights.countries")) } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const mapEntries: Array<[string, number]> = [["Implementation", h.implementationProjects], ["Rollout", h.rolloutProjects], ["AMS", h.amsProjects], ["Support", h.supportProjects], ["Greenfield", h.greenfieldProjects], ["Brownfield", h.brownfieldProjects], ["Migration", h.migration ? enterprise.projects.filter((item) => /migration/i.test(`${item.projectType} ${item.implementationType}`)).length || 1 : 0]];
  const implementationMap = mapEntries.filter(([, count]) => count > 0).map(([label, count]) => ({ label, count, evidence: [evidence(`${count} ${label}`, `enterpriseProfile.careerHighlights.${label.toLowerCase()}Projects`)] }));
  const projectQuality = enterprise.projects.map((project) => {
    const source = `enterpriseProfile.projects.${project.id}`;
    const values: DecisionSignal[] = [];
    if (project.responsibilities.length) values.push(category("ownership", "Ownership", [evidence(project.responsibilities.slice(0, 2).join("; "), source)], [], project.role ? 75 : 65));
    if (project.teamSize) values.push(category("complexity", "Complexity", [evidence(`Team size ${project.teamSize}`, source)], [], project.teamSize >= 10 ? 85 : 70));
    if (project.country) values.push(category("regional", "Regional", [evidence(project.country, source)], [], 75));
    if (project.client) values.push(category("client-facing", "Client facing", [evidence(project.client, source)], [], 70));
    return { projectId: project.id, project: project.name || project.client, signals: values };
  });
  const clientPortfolio = { clients: unique(enterprise.projects.map((item) => item.client).filter(meaningful), (item) => item), industries: frequencies(enterprise.projects.map((item) => item.industry)), countries: frequencies(enterprise.projects.map((item) => item.country)) };
  const marketRaw = field(job, ["marketBenchmark", "market_benchmark", "benchmark"]);
  const market = marketRaw && typeof marketRaw === "object" ? { available: true as const, evidence: [evidence("Job benchmark data", "job.marketBenchmark")], data: marketRaw as AnyRecord } : { available: false as const, message: "Market data unavailable." as const };
  return { job: { id: clean(job.id || job.job_id), title: clean(job.title || job.job_title || job.role) || "Selected Job", company: clean(job.company || job.client_name || job.client) }, overall, breakdown, requirements: requirementSignals, strengths, risks, unknowns, interviewFocus, timelineInsights, implementationMap, projectQuality, clientPortfolio, market };
}






