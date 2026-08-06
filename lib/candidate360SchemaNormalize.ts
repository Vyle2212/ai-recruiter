export type CandidateSchemaRecord = Record<string, unknown>;

export type EnterpriseEmployment = {
  id: string;
  company: string;
  title: string;
  location: string;
  companyType: string;
  modules: string[];
  achievements: string[];
  start: string;
  end: string;
  duration: string;
  current: boolean;
};

export type EnterpriseProject = {
  id: string;
  name: string;
  client: string;
  industry: string;
  country: string;
  role: string;
  modules: string[];
  projectType: string;
  implementationType: string;
  start: string;
  end: string;
  duration: string;
  responsibilities: string[];
  teamSize: number | null;
  environment: string;
};

export type CareerHighlights = {
  yearsExperience: number | null;
  yearsConsulting: number | null;
  yearsLeadership: number | null;
  implementationProjects: number;
  rolloutProjects: number;
  greenfieldProjects: number;
  brownfieldProjects: number;
  amsProjects: number;
  supportProjects: number;
  primarySapModule: string;
  countries: string[];
  industries: string[];
  consultingBackground: boolean;
  endUserBackground: boolean;
  leadershipExperience: boolean;
  teamSize: number | null;
  regionalExperience: string[];
  s4hana: boolean;
  ecc: boolean;
  migration: boolean;
  treasury: boolean;
  banking: boolean;
  publicCloud: boolean;
  privateCloud: boolean;
};

export type IntelligenceMetric = {
  key: string;
  label: string;
  score: number | null;
  confidence: number;
  status: "strong" | "established" | "developing" | "risk" | "unavailable";
  evidence: string[];
  reason: string;
};

export type CandidateIntelligence = {
  candidateStrengths: string[];
  careerRisks: string[];
  promotionReadiness: IntelligenceMetric;
  leadershipReadiness: IntelligenceMetric;
  consultingDna: IntelligenceMetric;
  implementationAuthority: IntelligenceMetric;
  financeDepth: IntelligenceMetric;
  technicalDepth: IntelligenceMetric;
  marketPosition: IntelligenceMetric;
  salaryPosition: IntelligenceMetric;
  regionalCoverage: IntelligenceMetric;
  countryCoverage: IntelligenceMetric;
  projectComplexity: IntelligenceMetric;
  clientTier: IntelligenceMetric;
  domainExpertise: IntelligenceMetric;
  trend: Array<{ label: string; score: number; evidence: string }>;
  insights: {
    topStrengths: string[];
    topRisks: string[];
    idealRoles: string[];
    idealClients: string[];
    idealIndustries: string[];
    idealCountries: string[];
    potentialGaps: string[];
  };
};
export type EnterpriseCandidateProfile = {
  candidateId: string;
  identity: {
    name: string;
    currentTitle: string;
    currentCompany: string;
    headline: string;
    location: string;
    country: string;
  };
  summary: string;
  technicalSkills: string[];
  sapModules: string[];
  careerHighlights: CareerHighlights;
  employmentTimeline: EnterpriseEmployment[];
  projects: EnterpriseProject[];
  education: Array<{ id: string; qualification: string; institution: string; fieldOfStudy: string; startYear: string; endYear: string }>;
  certifications: string[];
  languages: Array<{ language: string; proficiency: string }>;
  recruiterSignals: { availability: string; notice: string; salary: string; travel: string; remote: string; visa: string };
  intelligence: CandidateIntelligence;
  quality: {
    profileCompleteness: number;
    dataConfidence: number;
    missingSections: string[];
    reviewRisks: string[];
  };
};

const GENERIC = /^(unknown|n\/?a|none|not provided|needs_repair|repair missing data|parser extracted|null|undefined)$/i;
const SECTION_KEYS = ["profile", "personal", "summary", "skills", "experience", "projects", "education", "certifications", "languages", "sap", "consulting", "employer", "role", "compensation", "resume", "cv", "career", "ai"];

function isRecord(value: unknown): value is CandidateSchemaRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCandidateValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const source = value.trim();
  if (!source || (!source.startsWith("{") && !source.startsWith("["))) return value;
  try { return JSON.parse(source); } catch { return value; }
}

function unwrap(value: unknown): unknown {
  let current = parseCandidateValue(value);
  for (let depth = 0; depth < 8 && isRecord(current); depth += 1) {
    const keys = Object.keys(current);
    if (keys.length === 1 && ["value", "data", "result"].includes(keys[0])) current = parseCandidateValue(current[keys[0]]);
    else break;
  }
  return current;
}

function clean(value: unknown): string {
  const current = unwrap(value);
  if (typeof current === "string") {
    const result = current.replace(/\s+/g, " ").trim();
    return result && !GENERIC.test(result) ? result : "";
  }
  if (typeof current === "number" || typeof current === "boolean") return String(current);
  if (isRecord(current)) return clean(firstValue([current], ["name", "label", "title", "text", "description"]));
  return "";
}

function direct(record: CandidateSchemaRecord, aliases: string[]): unknown {
  for (const alias of aliases) {
    const value = unwrap(record[alias]);
    if (value !== undefined && value !== null && clean(value)) return value;
  }
}

function parsedRoot(raw: CandidateSchemaRecord): CandidateSchemaRecord {
  const parsed = unwrap(raw.parsed_json);
  return isRecord(parsed) ? parsed : {};
}

function scopes(raw: CandidateSchemaRecord): CandidateSchemaRecord[] {
  const parsed = parsedRoot(raw);
  const output: CandidateSchemaRecord[] = [raw, parsed];
  const queue: Array<{ value: CandidateSchemaRecord; depth: number }> = [{ value: parsed, depth: 0 }];
  const seen = new Set<CandidateSchemaRecord>(output);
  while (queue.length) {
    const item = queue.shift();
    if (!item || item.depth >= 6) continue;
    for (const key of SECTION_KEYS) {
      const value = unwrap(item.value[key]);
      const children = Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : [];
      for (const child of children) if (!seen.has(child)) { seen.add(child); output.push(child); queue.push({ value: child, depth: item.depth + 1 }); }
    }
  }
  return output;
}

function firstValue(sourceScopes: CandidateSchemaRecord[], aliases: string[]): unknown {
  for (const scope of sourceScopes) {
    const value = direct(scope, aliases);
    if (value !== undefined) return value;
  }
}

function firstText(sourceScopes: CandidateSchemaRecord[], aliases: string[]): string {
  return clean(firstValue(sourceScopes, aliases));
}

function asList(value: unknown): unknown[] {
  const current = unwrap(value);
  if (Array.isArray(current)) return current.map(unwrap);
  if (isRecord(current)) {
    for (const key of ["items", "entries", "data", "results", "history", "experiences", "projects", "employment", "work_history"]) {
      const nested = unwrap(current[key]);
      if (Array.isArray(nested)) return nested.map(unwrap);
    }
    return [current];
  }
  if (typeof current === "string" && current.trim()) return current.split(/[,;|\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function recordLists(sourceScopes: CandidateSchemaRecord[], aliases: string[]): CandidateSchemaRecord[] {
  const output: CandidateSchemaRecord[] = [];
  const seen = new Set<unknown>();
  for (const scope of sourceScopes) for (const alias of aliases) {
    const raw = scope[alias];
    if (raw === undefined || seen.has(raw)) continue;
    seen.add(raw);
    output.push(...asList(raw).filter(isRecord));
  }
  return output;
}

function stringList(values: unknown[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const current = unwrap(value);
    if (Array.isArray(current)) { current.forEach(add); return; }
    if (isRecord(current)) {
      const named = clean(firstValue([current], ["name", "skill", "module", "certification", "language", "label", "title"]));
      if (named) add(named);
      else for (const [key, enabled] of Object.entries(current)) if (enabled === true || enabled === 1 || enabled === "true") add(key);
      return;
    }
    for (const item of clean(current).split(/[,;|\n]/).map((entry) => entry.trim()).filter(Boolean)) {
      const key = item.toLowerCase();
      if (!seen.has(key) && !GENERIC.test(item)) { seen.add(key); output.push(item); }
    }
  };
  values.forEach(add);
  return output;
}

function allStrings(sourceScopes: CandidateSchemaRecord[], aliases: string[]): string[] {
  return stringList(sourceScopes.flatMap((scope) => aliases.map((alias) => scope[alias])));
}

function numeric(sourceScopes: CandidateSchemaRecord[], aliases: string[]): number | null {
  const value = firstValue(sourceScopes, aliases);
  const parsed = Number(unwrap(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function maximumNumeric(sourceScopes: CandidateSchemaRecord[], aliases: string[]): number | null {
  const values = sourceScopes.flatMap((scope) => aliases.map((alias) => Number(unwrap(scope[alias])))).filter((value) => Number.isFinite(value) && value >= 0);
  return values.length ? Math.max(...values) : null;
}

function truthy(sourceScopes: CandidateSchemaRecord[], aliases: string[], evidence: string): boolean {
  const value = unwrap(firstValue(sourceScopes, aliases));
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string" && /^(true|yes|y)$/i.test(value.trim())) return true;
  return evidence.toLowerCase().includes(aliases.join(" ").replaceAll("_", " ").toLowerCase());
}

function dateYear(value: string): number {
  return Number(value.match(/(?:19|20)\d{2}/g)?.at(-1) || 0);
}

function duration(start: string, end: string, explicit = ""): string {
  if (explicit) return explicit;
  const startYear = dateYear(start);
  const endYear = /present|current|now/i.test(end) ? new Date().getUTCFullYear() : dateYear(end);
  if (!startYear || !endYear || endYear < startYear) return "";
  const years = endYear - startYear;
  return years === 0 ? "Less than 1 year" : `${years} year${years === 1 ? "" : "s"}`;
}

function normalizeEmployment(sourceScopes: CandidateSchemaRecord[]): EnterpriseEmployment[] {
  const records = recordLists(sourceScopes, ["experience", "experiences", "work_experience", "workExperience", "employment_history", "employmentHistory", "work_history", "career_history"]);
  const unique = new Map<string, EnterpriseEmployment>();
  records.forEach((item, index) => {
    const company = firstText([item], ["company", "employer", "organization", "company_name"]);
    const title = firstText([item], ["title", "job_title", "role", "position"]);
    const location = firstText([item], ["country", "location", "city", "region"]);
    const companyType = firstText([item], ["company_type", "companyType", "employment_type", "organization_type"]);
    const modules = allStrings([item], ["modules", "module", "sap_modules", "sapModules", "key_modules"]);
    const achievements = allStrings([item], ["achievements", "key_achievements", "highlights", "responsibilities", "description", "summary"]).slice(0, 3);
    const start = firstText([item], ["start_date", "startDate", "from", "start"]);
    const end = firstText([item], ["end_date", "endDate", "to", "end"]);
    const currentValue = unwrap(firstValue([item], ["current", "is_current", "isCurrent"]));
    const current = currentValue === true || currentValue === 1 || /^(true|yes)$/i.test(clean(currentValue));
    if (!company && !title) return;
    const entry = { id: firstText([item], ["id"]) || `employment-${index + 1}`, company, title, location, companyType, modules, achievements, start, end, duration: duration(start, end, firstText([item], ["duration", "tenure"])), current };
    unique.set(`${company}|${title}|${start}|${end}`.toLowerCase(), entry);
  });
  if (!unique.size) {
    const resumeText = firstText(sourceScopes, ["resume_text", "raw_text", "cv_text", "raw_cv"]);
    const employerSection = resumeText.match(/\bEMPLOYERS\b([\s\S]*?)(?:\bPROJECT\b|$)/i)?.[1] || "";
    const employerPattern = /(\d{4})\s*-\s*(Present|\d{4})\s*[–—-]\s*(.*?)(?=\s+\d{4}\s*-\s*(?:Present|\d{4})\s*[–—-]|$)/gi;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = employerPattern.exec(employerSection))) {
      const company = clean(match[3]);
      if (!company) continue;
      const start = match[1];
      const end = match[2];
      const current = /present/i.test(end);
      const entry: EnterpriseEmployment = { id: `resume-employment-${++index}`, company, title: "", location: "", companyType: "", modules: [], achievements: [], start, end, duration: duration(start, end), current };
      unique.set(`${company}||${start}|${end}`.toLowerCase(), entry);
    }
  }
  return [...unique.values()].sort((a, b) => Number(b.current) - Number(a.current) || dateYear(b.end || b.start) - dateYear(a.end || a.start));
}

const RESUME_RESPONSIBILITIES = ["Business Blueprint", "Functional Specification", "Configuration", "Data Migration", "System Integration Test", "User Acceptance Test", "Unit Testing", "End-user Training", "Support", "Workshop", "Enhancement", "Electronic bank statement", "Integration with feeder applications", "Integration with other modules", "Integration with Point-Of-Sales system", "Sales and Distribution", "Project System", "Production Planning", "Integration with Weigh Bridge and Plantation Payroll System"];

function resumeResponsibilities(value: string): string[] {
  const patterns = ["Business Blueprint", "Functional Specification", "Configuration", "Data Migration", "System Integration Test", "User Acceptance Test", "Unit Testing", "End-user Training", "Support", "Workshop", "Enhancement", "Electronic bank statement", "Integration with feeder applications", "Integration with other modules", "Integration with Point-Of-Sales system", "Sales and Distribution", "Project System", "Production Planning", "Integration with Weigh Bridge and Plantation Payroll System"];
  return patterns.filter((item) => new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(value)).slice(0, 4);
}

function cleanResumeClient(value: string) {
  let client = value;
  for (const responsibility of RESUME_RESPONSIBILITIES) client = client.replace(new RegExp(responsibility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  return client.replace(/^[:;,\s]+/, "").replace(/^(?:responsibilities?[:\-]*|and|with|GST|T|nfiguration|nd-user)\s+/i, "").replace(/\s+/g, " ").trim();
}
function normalizeResumeProjects(sourceScopes: CandidateSchemaRecord[]): EnterpriseProject[] {
  const resumeText = firstText(sourceScopes, ["resume_text", "raw_text", "cv_text", "raw_cv"]);
  const section = resumeText.match(/PROJECT PROJECT RESPONSIBILITIES([\s\S]*)/i)?.[1]?.replace(/PROJECT PROJECT RESPONSIBILITIES/gi, " ") || "";
  if (!section) return [];
  const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const pattern = new RegExp(`([A-Z][A-Za-z0-9&.,()'\\/ –—-]{2,500}?)\\s+(${month}\\s+\\d{4})\\s*[–—-]\\s*(${month}\\s+\\d{4}|Present)\\s+(SAP\\s+.{2,100}?)\\s+Responsibilities:-\\s*(.*?)(?=[A-Z][A-Za-z0-9&.,()'\\/ –—-]{2,500}?\\s+${month}\\s+\\d{4}\\s*[–—-]\\s*(?:${month}\\s+\\d{4}|Present)\\s+SAP\\s+|$)`, "gi");
  const projects: EnterpriseProject[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(section))) {
    const clientText = clean(match[1]);
    const inheritedResponsibilities = resumeResponsibilities(clientText);
    if (projects.length && inheritedResponsibilities.length) projects[projects.length - 1].responsibilities = inheritedResponsibilities;
    const industry = clientText.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || "";
    const cleanedClient = cleanResumeClient(clientText.replace(/\s*\([^)]+\)\s*$/, ""));
    const client = cleanedClient.replace(/\s+[–—]\s+.*$/, "").replace(/^(?:and|with|GST)\s+/i, "").trim();
    const start = clean(match[2]);
    const end = clean(match[3]);
    const role = clean(match[4]);
    const responsibilityText = clean(match[5]);
    const typeEvidence = `${role} ${responsibilityText}`;
    const projectType = /\brollout\b/i.test(typeEvidence) ? "Rollout" : /\bmigration\b/i.test(typeEvidence) ? "Migration" : /\bams\b/i.test(typeEvidence) ? "AMS" : /\bsupport\b/i.test(typeEvidence) ? "Support" : /\bimplementation\b/i.test(typeEvidence) ? "Implementation" : "";
    let modules = stringList([...(typeEvidence.match(/\b(?:FICO|FI|CO|MM|SD|PP|PS|BW|BI|HCM|SuccessFactors|Ariba|TRM)\b/gi) || [])]);
    if (modules.some((item) => /^FICO$/i.test(item))) modules = modules.filter((item) => !/^(FI|CO)$/i.test(item));
    const environment = /S\/4\s*HANA|S4HANA/i.test(typeEvidence) ? "S/4HANA" : /\bECC\b/i.test(typeEvidence) ? "ECC" : /Public Cloud/i.test(typeEvidence) ? "Public Cloud" : /Private Cloud/i.test(typeEvidence) ? "Private Cloud" : "";
    if (!client || client.split(/\s+/).length > 12) continue;
    projects.push({ id: `resume-project-${projects.length + 1}`, name: cleanedClient, client, industry, country: "", role, modules, projectType, implementationType: projectType, start, end, duration: duration(start, end), responsibilities: resumeResponsibilities(responsibilityText), teamSize: null, environment });
  }
  return projects;
}
function normalizeProjects(raw: CandidateSchemaRecord, sourceScopes: CandidateSchemaRecord[]): EnterpriseProject[] {
  const records = recordLists(sourceScopes, ["projects", "project_experience", "projectExperience", "implementation_projects", "rollout_projects", "ams_projects", "support_projects"]);
  const output: EnterpriseProject[] = records.map((item, index) => {
    const location = firstText([item], ["country", "location", "city", "region"]);
    const companyType = firstText([item], ["company_type", "companyType", "employment_type", "organization_type"]);
    const modules = allStrings([item], ["modules", "module", "sap_modules", "sapModules", "key_modules"]);
    const achievements = allStrings([item], ["achievements", "key_achievements", "highlights", "responsibilities", "description", "summary"]).slice(0, 3);
    const start = firstText([item], ["start_date", "startDate", "from", "start"]);
    const end = firstText([item], ["end_date", "endDate", "to", "end"]);
    return {
      id: firstText([item], ["id", "project_id"]) || `project-${index + 1}`,
      name: firstText([item], ["project_name", "name", "project", "title"]) || `Project ${index + 1}`,
      client: firstText([item], ["client", "customer", "account"]),
      industry: firstText([item], ["industry", "sector", "domain"]),
      country: firstText([item], ["country", "location", "region"]),
      role: firstText([item], ["role", "position", "title"]),
      modules: allStrings([item], ["module", "modules", "sap_module", "sap_modules"]),
      projectType: firstText([item], ["project_type", "projectType", "type"]),
      implementationType: firstText([item], ["implementation_type", "implementationType", "delivery_type"]),
      start, end,
      duration: duration(start, end, firstText([item], ["duration"])),
      responsibilities: allStrings([item], ["responsibilities", "responsibility", "description", "scope", "achievements"]),
      teamSize: numeric([item], ["team_size", "teamSize", "team_members", "team_count"]),
      environment: firstText([item], ["environment", "platform", "landscape", "system", "deployment"]),
    };
  });
  output.push(...normalizeResumeProjects(sourceScopes));
  return [...new Map(output.filter((project) => project.client || project.role || project.start).map((project) => [`${project.client}|${project.role}|${project.start}|${project.end}`.toLowerCase(), project])).values()].sort((a, b) => dateYear(b.end || b.start) - dateYear(a.end || a.start));
}

function normalizeEducation(sourceScopes: CandidateSchemaRecord[]) {
  return recordLists(sourceScopes, ["education", "educations", "education_history", "academic_history"]).map((item, index) => ({
    id: firstText([item], ["id"]) || `education-${index + 1}`,
    qualification: firstText([item], ["degree", "qualification", "certificate"]),
    institution: firstText([item], ["institution", "university", "school", "college"]),
    fieldOfStudy: firstText([item], ["field_of_study", "fieldOfStudy", "major", "specialization"]),
    startYear: firstText([item], ["start_year", "startYear", "start_date"]),
    endYear: firstText([item], ["graduation_year", "graduationYear", "end_year", "endYear", "end_date", "year"]),
  })).filter((item) => item.qualification || item.institution || item.fieldOfStudy);
}

function normalizeLanguages(sourceScopes: CandidateSchemaRecord[]) {
  const records = recordLists(sourceScopes, ["languages", "language_skills", "languageSkills"]);
  if (records.length) return records.map((item) => ({ language: firstText([item], ["language", "name"]), proficiency: firstText([item], ["proficiency", "level", "fluency"]) })).filter((item) => item.language);
  return allStrings(sourceScopes, ["languages", "language_skills", "languageSkills"]).map((language) => ({ language, proficiency: "" }));
}

function countByProject(projects: EnterpriseProject[], patterns: RegExp): number {
  return projects.filter((project) => patterns.test(`${project.name} ${project.projectType} ${project.implementationType} ${project.responsibilities.join(" ")}`)).length;
}

function bounded(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function metric(key: string, label: string, score: number | null, confidence: number, evidence: string[], reason = ""): IntelligenceMetric {
  const verifiedEvidence = evidence.filter((item) => item && item.trim() !== "0" && !/recorded .* score:\s*0(?:\.0+)?$/i.test(item));
  const boundedScore = score === null ? null : bounded(score);
  const normalized = boundedScore !== null && boundedScore > 0 && verifiedEvidence.length ? boundedScore : null;
  const status: IntelligenceMetric["status"] = normalized === null ? "unavailable" : normalized >= 80 ? "strong" : normalized >= 60 ? "established" : normalized >= 40 ? "developing" : "risk";
  const explanation = reason || (normalized === null ? "Not enough verified evidence to assess this dimension." : `Derived from ${verifiedEvidence.length} extracted evidence signal${verifiedEvidence.length === 1 ? "" : "s"}.`);
  return { key, label, score: normalized, confidence: normalized === null ? 0 : bounded(confidence), status, evidence: verifiedEvidence, reason: explanation };
}

function buildIntelligence(input: {
  raw: CandidateSchemaRecord; sourceScopes: CandidateSchemaRecord[];
  identity: EnterpriseCandidateProfile["identity"]; highlights: CareerHighlights;
  projects: EnterpriseProject[]; timeline: EnterpriseEmployment[];
  technicalSkills: string[]; sapModules: string[];
  quality: EnterpriseCandidateProfile["quality"];
}): CandidateIntelligence {
  const { raw, sourceScopes, identity, highlights, projects, timeline, technicalSkills, sapModules, quality } = input;
  const sourceMetric = (key: string, label: string, aliases: string[], fallback: number | null, fallbackEvidence: string[]) => {
    const recorded = maximumNumeric(sourceScopes, aliases);
    const explicit = recorded !== null && recorded > 0 ? recorded : null;
    const evidence = explicit !== null ? stringList([...fallbackEvidence, `Recorded ${label.toLowerCase()} score: ${explicit}`]) : fallbackEvidence;
    const reason = explicit !== null ? `Uses the recorded ${label.toLowerCase()} score supported by ${Math.max(fallbackEvidence.length, 1)} extracted evidence signal${fallbackEvidence.length === 1 ? "" : "s"}.` : "";
    return metric(key, label, explicit ?? fallback, explicit !== null ? 92 : fallback === null ? 0 : 64, evidence, reason);
  };
  const implementationEvidence = [
    highlights.implementationProjects ? `${highlights.implementationProjects} implementation projects` : "",
    highlights.rolloutProjects ? `${highlights.rolloutProjects} rollout projects` : "",
    highlights.migration ? "Migration experience recorded" : "",
  ].filter(Boolean);
  const implementationFallback = implementationEvidence.length ? bounded(35 + highlights.implementationProjects * 7 + highlights.rolloutProjects * 4 + (highlights.migration ? 10 : 0)) : null;
  const leadershipEvidence = [highlights.leadershipExperience ? "Leadership experience recorded" : "", highlights.teamSize ? `Team size up to ${highlights.teamSize}` : "", timeline.some((item) => /lead|manager|head|director/i.test(item.title)) ? "Leadership title in career timeline" : ""].filter(Boolean);
  const leadershipFallback = leadershipEvidence.length ? bounded(45 + (highlights.leadershipExperience ? 25 : 0) + Math.min(highlights.teamSize || 0, 20)) : null;
  const financeSignals = stringList([sapModules.filter((item) => /fico|\bfi\b|\bco\b|treasury|trm|banking/i.test(item)), highlights.treasury ? ["Treasury"] : [], highlights.banking ? ["Banking"] : []]);
  const financeEvidence = stringList([highlights.yearsExperience && financeSignals.length ? [`${highlights.yearsExperience} years SAP finance experience`] : [], financeSignals, highlights.implementationProjects ? [`${highlights.implementationProjects} implementations`] : []]);
  const financeFallback = financeEvidence.length ? bounded(35 + financeSignals.length * 10 + Math.min(highlights.implementationProjects * 3, 20)) : null;
  const technicalEvidence = [...sapModules.slice(0, 5).map((item) => `SAP ${item}`), ...technicalSkills.slice(0, 5)];
  const technicalFallback = technicalEvidence.length ? bounded(35 + Math.min(technicalEvidence.length * 7, 55)) : null;
  const complexityEvidence = stringList(projects.flatMap((project) => [project.projectType, project.implementationType, project.environment, project.teamSize ? `Team ${project.teamSize}` : ""]));
  const complexityFallback = projects.length ? bounded(30 + Math.min(projects.length * 6, 30) + (highlights.s4hana ? 12 : 0) + (highlights.migration ? 10 : 0) + (highlights.teamSize ? Math.min(highlights.teamSize, 18) : 0)) : null;
  const consultingFallback = highlights.consultingBackground ? 80 : highlights.endUserBackground ? 35 : null;
  const consultingEvidence = [highlights.consultingBackground ? "Consulting background recorded" : "", highlights.endUserBackground ? "End-user background recorded" : ""].filter(Boolean);
  const countryFallback = highlights.countries.length ? bounded(35 + highlights.countries.length * 12) : null;
  const regionalFallback = highlights.regionalExperience.length || highlights.countries.length > 1 ? bounded(45 + highlights.regionalExperience.length * 12 + Math.max(0, highlights.countries.length - 1) * 8) : highlights.countries.length === 1 ? 35 : null;
  const domainEvidence = stringList([...highlights.industries, ...financeSignals, ...sapModules.slice(0, 5)]);
  const domainFallback = domainEvidence.length ? bounded(35 + Math.min(domainEvidence.length * 8, 55)) : null;
  const clientTierValue = firstText(sourceScopes, ["client_tier", "clientTier", "employer_reputation", "company_type"]);
  const clientTierScore = maximumNumeric(sourceScopes, ["client_score", "client_tier_score", "employer_reputation_score"]);
  const salaryValue = firstText(sourceScopes, ["expected_salary", "expectedSalary", "current_salary", "salary"]);
  const promotionEvidence = [...leadershipEvidence, highlights.yearsExperience ? `${highlights.yearsExperience} years experience` : "", identity.currentTitle].filter(Boolean);
  const promotionFallback = promotionEvidence.length ? bounded(35 + Math.min(highlights.yearsExperience || 0, 15) * 2 + (leadershipFallback || 0) * .35 + (/senior|lead|manager|head|director/i.test(identity.currentTitle) ? 12 : 0)) : null;
  const metrics = {
    promotionReadiness: sourceMetric("promotionReadiness", "Promotion readiness", ["promotion_readiness_score", "career_level_score"], promotionFallback, promotionEvidence),
    leadershipReadiness: sourceMetric("leadershipReadiness", "Leadership readiness", ["leadership_score", "ownership_score", "manager_score"], leadershipFallback, leadershipEvidence),
    consultingDna: sourceMetric("consultingDna", "Consulting DNA", ["consulting_dna_score", "consulting_score"], consultingFallback, consultingEvidence),
    implementationAuthority: sourceMetric("implementationAuthority", "Implementation authority", ["implementation_authority_score", "implementation_authority"], implementationFallback, implementationEvidence),
    financeDepth: sourceMetric("financeDepth", "Finance depth", ["finance_depth_score", "finance_depth_v2"], financeFallback, financeEvidence),
    technicalDepth: sourceMetric("technicalDepth", "Technical depth", ["technical_depth_score", "module_authority_score"], technicalFallback, technicalEvidence),
    marketPosition: sourceMetric("marketPosition", "Market position", ["percentile_score", "market_position_score", "client_score"], quality.profileCompleteness ? bounded(quality.profileCompleteness * .55 + quality.dataConfidence * .45) : null, [`${quality.profileCompleteness}% profile completeness`, `${quality.dataConfidence}% data confidence`]),
    salaryPosition: metric("salaryPosition", "Salary position", null, 0, salaryValue ? [`Salary recorded (${salaryValue}); no market benchmark available`] : ["Salary data and market benchmark are unavailable"]),
    regionalCoverage: sourceMetric("regionalCoverage", "Regional coverage", ["regional_delivery_score", "multi_country_rollout_score"], regionalFallback, stringList([...highlights.regionalExperience, ...highlights.countries])),
    countryCoverage: sourceMetric("countryCoverage", "Country coverage", ["country_coverage_count"], countryFallback, highlights.countries),
    projectComplexity: sourceMetric("projectComplexity", "Project complexity", ["role_complexity_score", "project_ownership_score", "complexity_score"], complexityFallback, complexityEvidence),
    clientTier: metric("clientTier", "Client tier", clientTierScore, clientTierScore !== null ? 90 : clientTierValue ? 55 : 0, clientTierValue && clientTierValue !== "0" ? [clientTierValue] : []),
    domainExpertise: sourceMetric("domainExpertise", "Domain expertise", ["domain_authority", "module_authority_score"], domainFallback, domainEvidence),
  };
  const metricList = Object.values(metrics);
  const candidateStrengths = metricList.filter((item) => item.score !== null && item.score >= 65).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6).map((item) => `${item.label}: ${item.evidence[0] || `${item.score}%`}`);
  const careerRisks = stringList([...quality.reviewRisks, ...metricList.filter((item) => item.score !== null && item.score < 40).map((item) => `${item.label} requires validation`)]).slice(0, 8);
  const titleScore = (title: string) => /director|head/i.test(title) ? 90 : /manager|lead/i.test(title) ? 75 : /senior/i.test(title) ? 60 : 40;
  const trend = timeline.filter((item) => item.title).slice().reverse().map((item) => ({ label: item.end || item.start || item.company, score: titleScore(item.title), evidence: `${item.title}${item.company ? ` at ${item.company}` : ""}` }));
  const idealRoles = stringList([identity.currentTitle, highlights.primarySapModule ? `SAP ${highlights.primarySapModule} roles` : "", highlights.leadershipExperience ? "SAP team leadership roles" : ""]);
  const idealClients = stringList([highlights.consultingBackground ? "Consulting-led SAP programmes" : "", highlights.endUserBackground ? "SAP end-user organisations" : "", clientTierValue]);
  return {
    candidateStrengths, careerRisks, ...metrics, trend,
    insights: {
      topStrengths: candidateStrengths.slice(0, 3), topRisks: careerRisks.slice(0, 3), idealRoles,
      idealClients, idealIndustries: highlights.industries, idealCountries: highlights.countries,
      potentialGaps: quality.missingSections.map((item) => `${item} requires evidence`),
    },
  };
}
function buildSummary(identity: EnterpriseCandidateProfile["identity"], highlights: CareerHighlights): string {
  const lines: string[] = [];
  const moduleName = highlights.primarySapModule ? ` ${highlights.primarySapModule.replace(/^SAP\s+/i, "")}` : "";
  if (highlights.yearsExperience) lines.push(identity.currentTitle && /sap|fico|consultant/i.test(identity.currentTitle) ? `${highlights.yearsExperience} years ${identity.currentTitle}.` : `${highlights.yearsExperience} years SAP${moduleName}.`);
  else if (identity.currentTitle) lines.push(`${identity.currentTitle}${identity.currentCompany ? ` at ${identity.currentCompany}` : ""}.`);
  const background = highlights.consultingBackground && highlights.endUserBackground ? "Consulting and end-user background." : highlights.consultingBackground ? "Consulting background." : highlights.endUserBackground ? "End-user SAP background." : "";
  if (background) lines.push(background);
  const delivery = [
    highlights.implementationProjects ? `${highlights.implementationProjects} full-cycle implementation${highlights.implementationProjects === 1 ? "" : "s"}` : "",
    highlights.amsProjects ? `${highlights.amsProjects} AMS engagement${highlights.amsProjects === 1 ? "" : "s"}` : "",
    highlights.rolloutProjects ? `${highlights.rolloutProjects} rollout${highlights.rolloutProjects === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (delivery.length) lines.push(`Delivered ${delivery.join(" and ")}.`);
  if (highlights.countries.length) lines.push(`Project exposure across ${highlights.countries.slice(0, 4).join(", ")}.`);
  return lines.slice(0, 4).join("\n") || "Structured career summary is not yet available.";
}

export function normalizeActualCandidateSchema(raw: CandidateSchemaRecord) {
  const sourceScopes = scopes(raw);
  const employmentTimeline = normalizeEmployment(sourceScopes);
  const projects = normalizeProjects(raw, sourceScopes);
  const name = firstText(sourceScopes, ["name", "full_name", "fullName", "candidate_name", "display_name"]);
  const currentTitle = firstText(sourceScopes, ["current_title", "currentTitle", "headline", "job_title", "jobTitle", "position", "role", "title"]);
  const currentCompany = firstText(sourceScopes, ["current_company", "currentCompany", "currentEmployer", "company", "employer", "organization"]) || employmentTimeline[0]?.company || "";
  const location = firstText(sourceScopes, ["current_location", "currentLocation", "location", "country", "city"]);
  const country = firstText(sourceScopes, ["country", "current_country", "nationality"]) || location;
  const headline = firstText(sourceScopes, ["headline", "professional_headline", "summary_title"]);
  if (employmentTimeline[0]) {
    if (!employmentTimeline[0].title) employmentTimeline[0].title = currentTitle;
    if (!employmentTimeline[0].location) employmentTimeline[0].location = country;
  }
  const technicalSkills = allStrings(sourceScopes, ["technical_skills", "technicalSkills", "skills", "hard_skills", "hardSkills", "core_skills"]);
  const sapModules = allStrings(sourceScopes, ["sap_modules", "sapModules", "modules", "primary_module", "primaryModule", "secondary_modules", "module_authorities"]);
  const primarySapModule = firstText(sourceScopes, ["primary_module", "primaryModule", "primary_sap_module"]) || sapModules[0] || "";
  const education = normalizeEducation(sourceScopes);
  const certifications = allStrings(sourceScopes, ["certifications", "certification", "certificates", "professional_certifications"]);
  const languages = normalizeLanguages(sourceScopes);
  const countries = stringList([country, ...projects.map((project) => project.country)]);
  const industries = stringList([...allStrings(sourceScopes, ["industries", "industry", "industry_experience", "sectors"]), ...projects.map((project) => project.industry)]);
  const evidence = JSON.stringify({ raw: Object.fromEntries(Object.entries(raw).filter(([key]) => !["raw_cv", "raw_text", "resume_text", "embedding"].includes(key))), parsed: parsedRoot(raw) }).toLowerCase();
  const resumeText = firstText(sourceScopes, ["resume_text", "raw_text", "cv_text", "raw_cv"]);
  const resumeSapYears = Number(resumeText.match(/(?:more than\s+)?(\d+(?:\.\d+)?)\s+years?\s+of\s+experience[^.]{0,80}\bSAP\b/i)?.[1] || 0) || null;
  const explicitYears = numeric(sourceScopes, ["years_of_sap_experience", "sap_experience_years", "sapYearsExperience", "totalYearsExperience", "years_of_experience", "yearsExperience", "years_experience", "total_experience_years", "experience", "years"]);
  const calculatedMonths = numeric(sourceScopes, ["calculated_experience_months", "experience_months", "total_experience_months"]);
  const yearsFromTimeline = (predicate: (item: EnterpriseEmployment) => boolean) => employmentTimeline.filter(predicate).reduce((sum, item) => { const endYear = /present|current|now/i.test(item.end) ? new Date().getUTCFullYear() : dateYear(item.end); return sum + Math.max(0, endYear - dateYear(item.start)); }, 0);
  const sapTimelineYears = yearsFromTimeline((item) => /\bsap\b|fico|s\/4|hana|abap/i.test(`${item.title} ${item.company}`));
  const consultingYears = maximumNumeric(sourceScopes, ["years_consulting", "consulting_years", "consulting_experience_years"]) ?? (yearsFromTimeline((item) => /consultant|consulting/i.test(`${item.title} ${item.company}`)) || null);
  const leadershipYears = maximumNumeric(sourceScopes, ["years_leadership", "leadership_years", "management_experience_years"]) ?? (yearsFromTimeline((item) => /lead|manager|head|director/i.test(item.title)) || null);
  const evidenceYears = explicitYears && explicitYears > 0 ? explicitYears : resumeSapYears ?? (calculatedMonths && calculatedMonths > 0 ? Math.round(calculatedMonths / 12 * 10) / 10 : sapTimelineYears || null);
  const highlightCount = (aliases: string[], pattern: RegExp) => Math.max(maximumNumeric(sourceScopes, aliases) ?? 0, countByProject(projects, pattern));
  const teamSizes = projects.map((project) => project.teamSize).filter((value): value is number => value !== null);
  const highlights: CareerHighlights = {
    yearsExperience: evidenceYears,
    yearsConsulting: consultingYears,
    yearsLeadership: leadershipYears,
    implementationProjects: highlightCount(["implementation_project_count", "implementation_projects", "implementationCount"], /implementation|greenfield|brownfield/i),
    rolloutProjects: highlightCount(["rollout_project_count", "rollout_projects", "rolloutCount"], /rollout/i),
    greenfieldProjects: highlightCount(["greenfield_project_count", "greenfield_projects"], /greenfield/i),
    brownfieldProjects: highlightCount(["brownfield_project_count", "brownfield_projects"], /brownfield/i),
    amsProjects: highlightCount(["ams_project_count", "ams_projects", "ams_support_project_count"], /\bams\b/i),
    supportProjects: highlightCount(["support_project_count", "support_projects", "supportCount"], /support/i),
    primarySapModule, countries, industries,
    consultingBackground: truthy(sourceScopes, ["consulting_background", "is_from_consulting_firm", "consulting_experience"], evidence) || employmentTimeline.some((item) => /consulting|consultancy/i.test(item.company)),
    endUserBackground: truthy(sourceScopes, ["end_user_background", "end_user_experience", "end_user_project_count"], evidence),
    leadershipExperience: truthy(sourceScopes, ["leadership_experience", "lead_role_count", "manager_role_count", "team_lead"], evidence),
    teamSize: teamSizes.length ? Math.max(...teamSizes) : numeric(sourceScopes, ["team_size", "largest_team_size"]),
    regionalExperience: allStrings(sourceScopes, ["regional_experience", "regions", "region", "country_coverage"]),
    s4hana: truthy(sourceScopes, ["s4hana", "s4_hana", "s4hana_project_count", "s4_implementation_count"], evidence),
    ecc: truthy(sourceScopes, ["ecc", "ecc_projects", "ecc_project_count"], evidence),
    migration: truthy(sourceScopes, ["migration", "migration_experience", "migration_project_count"], evidence),
    treasury: truthy(sourceScopes, ["treasury", "treasury_experience"], evidence),
    banking: truthy(sourceScopes, ["banking", "banking_experience"], evidence),
    publicCloud: truthy(sourceScopes, ["public_cloud", "publicCloud"], evidence),
    privateCloud: truthy(sourceScopes, ["private_cloud", "privateCloud"], evidence),
  };
  const recruiterSignals = {
    availability: firstText(sourceScopes, ["availability", "availability_timeline", "availabilityTimeline", "available_from"]),
    notice: firstText(sourceScopes, ["notice_period", "noticePeriod", "notice"]),
    salary: firstText(sourceScopes, ["expected_salary", "expectedSalary", "salary_expectation"]),
    travel: firstText(sourceScopes, ["travel", "travel_willingness", "willing_to_travel"]),
    remote: firstText(sourceScopes, ["remote", "remote_preference", "work_arrangement"]),
    visa: firstText(sourceScopes, ["visa", "visa_status", "work_authorization"]),
  };
  const identity = { name, currentTitle, currentCompany, headline, location, country };
  const missingSections = [
    ["identity.name", name], ["identity.currentTitle", currentTitle], ["identity.currentCompany", currentCompany],
    ["employmentTimeline", employmentTimeline.length], ["projects", projects.length], ["education", education.length],
    ["skills", technicalSkills.length + sapModules.length], ["certifications", certifications.length], ["languages", languages.length],
  ].filter(([, value]) => !value).map(([section]) => String(section));
  const totalSections = 9;
  const profileCompleteness = Math.round(((totalSections - missingSections.length) / totalSections) * 100);
  const sourceConfidence = numeric(sourceScopes, ["extraction_confidence", "data_confidence", "confidence", "profile_quality_score"]);
  const dataConfidence = Math.max(0, Math.min(100, Math.round(sourceConfidence ?? profileCompleteness)));
  const reviewRisks = [
    ...missingSections.map((section) => `${section} is missing or incomplete`),
    ...(highlights.yearsExperience === null ? ["Years of experience could not be established"] : []),
    ...(!primarySapModule ? ["Primary SAP module requires review"] : []),
  ];
  const quality = { profileCompleteness, dataConfidence, missingSections, reviewRisks };
  const intelligence = buildIntelligence({ raw, sourceScopes, identity, highlights, projects, timeline: employmentTimeline, technicalSkills, sapModules, quality });
  const enterpriseProfile: EnterpriseCandidateProfile = {
    candidateId: firstText([raw], ["id", "candidate_id", "candidateId"]), identity,
    summary: "", technicalSkills, sapModules, careerHighlights: highlights,
    employmentTimeline, projects, education, certifications, languages, recruiterSignals,
    intelligence,
    quality: { profileCompleteness, dataConfidence, missingSections, reviewRisks },
  };
  enterpriseProfile.summary = buildSummary(identity, highlights);
  const legacyProjects = projects.map((project) => ({ id: project.id, name: project.name, client: project.client, role: project.role, modules: project.modules, location: project.country, description: project.responsibilities.join("; "), startDate: project.start, endDate: project.end, projectType: project.projectType || project.implementationType }));
  const legacyEmployment = employmentTimeline.map((item) => ({ id: item.id, company: item.company, title: item.title, startDate: item.start, endDate: item.end, description: "", current: item.current }));
  const legacyEducation = education.map((item) => ({ id: item.id, qualification: item.qualification, institution: item.institution, fieldOfStudy: item.fieldOfStudy, graduationYear: item.endYear }));
  return {
    candidateName: name, current_title: currentTitle, currentTitle, current_company: currentCompany || null, currentCompany: currentCompany || null,
    headline, location: location || null, country: country || null,
    skills: stringList([...technicalSkills, ...sapModules]), technical_skills: technicalSkills, sapModules,
    work_experience: legacyEmployment, workExperience: legacyEmployment, employmentHistory: legacyEmployment,
    projectExperience: legacyProjects, projects: legacyProjects, education: legacyEducation, certifications,
    languages: languages.map((item) => item.proficiency ? item : item.language),
    primary_module: primarySapModule, primaryModule: primarySapModule,
    implementationExperience: highlights.implementationProjects > 0,
    implementationProjectCount: highlights.implementationProjects, rolloutProjectCount: highlights.rolloutProjects,
    amsProjectCount: highlights.amsProjects, supportProjectCount: highlights.supportProjects,
    profileQualityScore: numeric(sourceScopes, ["profile_quality_score"]) ?? profileCompleteness,
    extractionConfidence: dataConfidence, enterpriseProfile,
  };
}






















