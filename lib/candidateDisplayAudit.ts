import { resolveCanonicalCandidateDisplay } from "./candidateCanonicalDisplay";
import { TALENT_SEARCH_DISPLAY_RESOLVER_VERSION, cleanTalentSearchModule, cleanTalentSearchTitle, safeTalentSearchCompany } from "./talentSearchDisplay";

type AnyRecord = Record<string, any>;

export type DisplayIssueType =
  | "invalid-name"
  | "education-used-as-name"
  | "certificate-used-as-name"
  | "company-used-as-name"
  | "placeholder-name"
  | "title-used-as-name"
  | "missing-current-employer"
  | "sap-module-used-as-employer"
  | "role-missing-with-module"
  | "unknown-artifact"
  | "sap-sap-artifact"
  | "employment-prefix"
  | "dangling-punctuation"
  | "previous-employer-visible"
  | "validation-status-inconsistent";

export type DisplayIssueSeverity = "critical" | "review" | "enrichment";

export type CandidateDisplayIssue = {
  candidateId: string;
  currentName: string;
  currentRole: string;
  currentEmployer: string;
  issue: DisplayIssueType;
  reason: string;
  severity: DisplayIssueSeverity;
  critical: boolean;
  suggested: CandidateDisplayRepairSuggestion;
};

export type CandidateDisplayRepairSuggestion = {
  candidate_id: string;
  current_name: string;
  suggested_name: string;
  current_role: string;
  suggested_role: string;
  current_employer: string;
  suggested_employer: string;
  current_validation_status: string;
  suggested_validation_status: "Ready" | "Needs Review" | "Missing Information" | "Duplicate Suspected" | "Parsing Issue" | "Hidden" | "Archived";
  confidence: number;
  reason: string;
  source_field: string;
};

export type CandidateDisplayAuditResult = {
  totalScanned: number;
  totalDisplayIssues: number;
  criticalIssueCount: number;
  reviewIssueCount: number;
  enrichmentIssueCount: number;
  issueCounts: Record<string, number>;
  issues: CandidateDisplayIssue[];
  repairs: CandidateDisplayRepairSuggestion[];
};

const PLACEHOLDER_NAME = "Candidate profile pending validation";
const NOT_DISCLOSED = "Not disclosed";
const FORBIDDEN_EMPLOYER_PATTERN = /^(sap|fico|fi|co|mm|sd|pp|pm|ps|abap|basis|btp|ewm|tm|wm|hana|s\/?4hana|s4hana|greenfield|brownfield|rollout|ams|implementation|migration|transformation|support|project)$/i;
const EDUCATION_NAME_PATTERN = /\b(bachelor|master|degree|diploma|university|college|faculty|academic|science|information technology|applied statistics|computer science)\b/i;
const CERTIFICATE_NAME_PATTERN = /\b(certificate|certification|certified|professional certificate|training)\b/i;
const TITLE_NAME_PATTERN = /\b(experienced|senior|consultant|manager|lead|specialist|architect|developer|analyst|engineer|internally|externally|key competencies|competencies|responsibilities|employment history|career history)\b/i;
const COMPANY_NAME_PATTERN = /\b(software|systems|solutions|technologies|technology|consulting|consultancy|group|sdn\s*bhd|pte\s*ltd|limited|ltd|inc|corp|corporation|berhad|plc|llc|gmbh)\b/i;
const NAME_FORBIDDEN_PATTERN = /profile under review|name requires validation|identity under review|current location|technology consulting|academic background|nationality|gender|father'?s name/i;
const BAD_NAME_PHRASE_PATTERN = /^(extended star schema models|installation status|strictly confidential|for mechanical turnkey projects|willing to travel|each type|and need for resources|light mechanics roles|dxc technology|accenture|abeam consulting)$/i;
const GENERIC_NAME_START_PATTERN = /^(currently|experience|experienced|tools|responsibilities|responsibility|project|projects|for|with|and|each|installation|strictly|willing|light|extended)\b/i;

function text(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
  if (typeof value === "object") return Object.values(value).map(text).filter(Boolean).join(" ");
  return String(value).replace(/\s+/g, " ").trim();
}

function clean(value: any): string {
  return text(value).replace(/^["']+|["']+$/g, "").replace(/[,;:]+$/g, "").trim();
}

function getPath(source: AnyRecord, path: string): any {
  return path.split(".").reduce((value: any, key) => value && typeof value === "object" ? value[key] : undefined, source);
}

function parseJsonMaybe(value: any): any {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function list(value: any): any[] {
  const parsed = parseJsonMaybe(value);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") return [parsed];
  return [];
}

function rawText(candidate: AnyRecord): string {
  return text([candidate.raw_text, candidate.rawText, candidate.resume_text, candidate.resumeText, candidate.profile_text, candidate.profileText, candidate.summary, candidate.experience, candidate.workExperience, candidate.work_experience]);
}

export function isForbiddenEmployer(value: any): boolean {
  const company = clean(value);
  if (!company) return true;
  const normalized = company.toLowerCase().replace(/[().,_/\\|&+-]+/g, " ").replace(/\s+/g, " ").trim();
  return safeTalentSearchCompany(company) === NOT_DISCLOSED || FORBIDDEN_EMPLOYER_PATTERN.test(normalized);
}

function cleanEmployerCandidate(value: any): string {
  return clean(value)
    .replace(/\b(?:period|project|role|responsibilities|responsibility|assigned as|was assigned|duration|environment|tools)\b[\s\S]*$/i, "")
    .replace(/^[-:;,.\s]+/, "")
    .replace(/[-:;,.\s]+$/, "")
    .trim();
}

function isPlausibleEmployer(value: any): boolean {
  const company = cleanEmployerCandidate(value);
  if (!company || company.length < 2 || company.length > 60 || isForbiddenEmployer(company)) return false;
  if (/\b(german company|makes electric|assigned|responsib|project role|period|tools|platforms|module|consultant|developer|analyst|manager|lead|senior|business process|based in|towards improving|from date to date|passionate in|employment history|managed demand|pallet positions|jalan|wilayah|menara)\b/i.test(company)) return false;
  const words = company.split(/\s+/).filter(Boolean);
  if (words.length > 6) return false;
  if (/\b(ltd|limited|inc|corp|corporation|sdn|bhd|pte|plc|llc|gmbh|berhad|group|systems|solutions|consulting|technologies|technology|software|energy|bank|aerospace|manufacturing)\b/i.test(company)) return true;
  return words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-Z0-9&][A-Za-z0-9&.'-]*$/.test(word));
}

export function isDisplayNamePlaceholder(value: any): boolean {
  const name = clean(value);
  return !name || NAME_FORBIDDEN_PATTERN.test(name) || /^candidate\s*#?\d+$/i.test(name);
}

function classifyDisplayNameIssueWithoutRecursion(name: string): DisplayIssueType | "" {
  if (/^candidate profile pending validation$/i.test(name)) return "";
  if (isDisplayNamePlaceholder(name)) return "placeholder-name";
  if (BAD_NAME_PHRASE_PATTERN.test(name) || GENERIC_NAME_START_PATTERN.test(name)) return "title-used-as-name";
  if (EDUCATION_NAME_PATTERN.test(name)) return "education-used-as-name";
  if (CERTIFICATE_NAME_PATTERN.test(name)) return "certificate-used-as-name";
  if (COMPANY_NAME_PATTERN.test(name)) return "company-used-as-name";
  if (TITLE_NAME_PATTERN.test(name)) return "title-used-as-name";
  return "";
}

export function isValidDisplayHumanName(value: any): boolean {
  const name = clean(value);
  if (/^candidate profile pending validation$/i.test(name)) return false;
  if (!name || name.length < 4 || name.length > 80) return false;
  if (classifyDisplayNameIssueWithoutRecursion(name)) return false;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return false;
  return parts.every((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part));
}

export function classifyDisplayNameIssue(value: any): DisplayIssueType | "" {
  const name = clean(value);
  if (/^candidate profile pending validation$/i.test(name)) return "";
  const issue = classifyDisplayNameIssueWithoutRecursion(name);
  if (issue) return issue;
  if (!isValidDisplayHumanName(name)) return "invalid-name";
  return "";
}

function nameCandidates(candidate: AnyRecord) {
  const fields = ["name", "candidate_name", "full_name", "display_name", "parsedProfile.name", "parsed_profile.name", "parsedResume.name", "parsed_resume.name", "resume.name", "profile.name", "linkedin_name", "linkedinName", "profileName"];
  return fields.map((field) => ({ value: clean(getPath(candidate, field)), source: field })).filter((item) => item.value);
}

function parseRecords(candidate: AnyRecord) {
  const sources = [candidate.currentExperience, candidate.current_experience, candidate.latestExperience, candidate.latest_experience, candidate.workExperience, candidate.work_experience, candidate.experience, candidate.experiences, candidate.employmentHistory, candidate.employment_history, candidate.positions, candidate.jobs, getPath(candidate, "parsedProfile.experience"), getPath(candidate, "parsedResume.experience"), getPath(candidate, "resume.experience")];
  return sources.flatMap(list).filter((item) => item && typeof item === "object") as AnyRecord[];
}

function companyFromRecord(record: AnyRecord): string {
  return clean(record.company || record.companyName || record.company_name || record.currentCompany || record.current_company || record.employer || record.organization || record.organisation || record.client || record.account);
}

function extractEmployerFromText(candidate: AnyRecord) {
  const blob = rawText(candidate);
  const patterns = [/(?:current\s+(?:company|employer)|present\s+company|currently\s+at|latest\s+experience)\s*[:\-]\s*([^\n\r|;,]{2,80})/i];
  for (const pattern of patterns) {
    const match = blob.match(pattern);
    const value = cleanEmployerCandidate(match?.[1]);
    if (isPlausibleEmployer(value)) return value;
  }
  return "";
}

function moduleFromCandidate(candidate: AnyRecord): string {
  const values = [candidate.primary_module, candidate.module, candidate.sap_module, candidate.selected_modules, candidate.secondary_modules, candidate.all_modules, getPath(candidate, "parsedProfile.primary_module")];
  for (const value of values) {
    const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;|/]+/) : [];
    for (const item of items.length ? items : [value]) {
      const module = cleanTalentSearchModule(item);
      if (module) return module;
    }
  }
  return "";
}

function rawRole(candidate: AnyRecord): string {
  return clean(candidate.display_title || candidate.current_title || candidate.currentTitle || candidate.title || candidate.role || candidate.position || candidate.designation || candidate.job_title || candidate.headline);
}

export function suggestDisplayName(candidate: AnyRecord) {
  const resolved = resolveCanonicalCandidateDisplay(candidate);
  if (resolved.displayName && resolved.displayName !== PLACEHOLDER_NAME && isValidDisplayHumanName(resolved.displayName)) return { value: resolved.displayName, source: "candidateAudit canonical displayName", confidence: 92 };
  for (const item of nameCandidates(candidate)) {
    if (isValidDisplayHumanName(item.value)) return { value: item.value, source: item.source, confidence: ["name", "candidate_name", "full_name"].includes(item.source) ? 90 : 80 };
  }
  return { value: PLACEHOLDER_NAME, source: "fallback", confidence: 20 };
}

export function suggestCurrentEmployer(candidate: AnyRecord) {
  const resolved = resolveCanonicalCandidateDisplay(candidate);
  if (resolved.currentEmployer && resolved.currentEmployer !== NOT_DISCLOSED && !isForbiddenEmployer(resolved.currentEmployer)) return { value: resolved.currentEmployer, source: "candidateAudit resolved employer", confidence: 92 };
  for (const field of ["current_company", "currentCompany", "current_employer", "currentEmployer", "company", "employer"]) {
    const value = cleanEmployerCandidate(getPath(candidate, field));
    if (isPlausibleEmployer(value)) return { value, source: field, confidence: field.startsWith("current") ? 90 : 75 };
  }
  const latest = parseRecords(candidate).map(companyFromRecord).map(cleanEmployerCandidate).find(isPlausibleEmployer);
  if (latest) return { value: latest, source: "latest experience company", confidence: 72 };
  const fromText = extractEmployerFromText(candidate);
  if (fromText) return { value: fromText, source: "raw resume text", confidence: 60 };
  return { value: NOT_DISCLOSED, source: "fallback", confidence: 20 };
}

export function suggestRoleTitle(candidate: AnyRecord) {
  const module = moduleFromCandidate(candidate);
  const raw = rawRole(candidate);
  const cleaned = cleanTalentSearchTitle(raw, module || "SAP");
  if (cleaned && cleaned !== "Role not disclosed" && !/UNKNOWN|\bSAP\s+SAP\b|^Employment\b/i.test(cleaned)) return { value: cleaned, source: raw ? "role/title field" : "module fallback", confidence: raw ? 85 : 68 };
  if (module) return { value: `SAP ${module} Consultant`, source: "module fallback", confidence: 68 };
  return { value: "Role not disclosed", source: "fallback", confidence: 20 };
}

export function suggestValidationStatus(input: { name: string; employer: string; role: string; candidate: AnyRecord; confidence: number; nameConfidence?: number; employerSource?: string }): CandidateDisplayRepairSuggestion["suggested_validation_status"] {
  const hasContact = Boolean(clean(input.candidate.email || input.candidate.contact_email) || clean(input.candidate.phone || input.candidate.mobile || input.candidate.contact_phone) || clean(input.candidate.linkedin || input.candidate.linkedin_url));
  const nameValid = isValidDisplayHumanName(input.name);
  const employerValid = Boolean(input.employer && input.employer !== NOT_DISCLOSED && !isForbiddenEmployer(input.employer));
  const roleClean = Boolean(input.role && input.role !== "Role not disclosed" && !/UNKNOWN|\bSAP\s+SAP\b|^Employment\b|[([{|\-]\s*$|[,;:.]\s*$|\b(?:at|in|for|with|and|or|of|the)\s*$/i.test(input.role));
  const rawTextEmployer = /raw resume text|rawText|resumeText|profileText/i.test(input.employerSource || "");
  if (!nameValid || !employerValid || !hasContact) return "Missing Information";
  if (!roleClean || input.confidence < 75 || Number(input.nameConfidence || input.confidence) < 80 || rawTextEmployer) return "Needs Review";
  return "Ready";
}

function makeRepair(candidate: AnyRecord, reason: string): CandidateDisplayRepairSuggestion {
  const resolved = resolveCanonicalCandidateDisplay(candidate);
  const name = resolved.displayName;
  const role = resolved.displayRole || rawRole(candidate) || "Role not disclosed";
  const employer = resolved.currentEmployer;
  const suggestedName = suggestDisplayName(candidate);
  const suggestedEmployer = suggestCurrentEmployer(candidate);
  const suggestedRole = suggestRoleTitle(candidate);
  const confidence = Math.round((suggestedName.confidence + suggestedEmployer.confidence + suggestedRole.confidence) / 3);
  const suggestedStatus = suggestValidationStatus({ name: suggestedName.value, employer: suggestedEmployer.value, role: suggestedRole.value, candidate, confidence, nameConfidence: suggestedName.confidence, employerSource: suggestedEmployer.source });
  return {
    candidate_id: clean(candidate.id || candidate.candidate_id),
    current_name: name,
    suggested_name: suggestedName.value,
    current_role: role,
    suggested_role: suggestedRole.value,
    current_employer: employer || NOT_DISCLOSED,
    suggested_employer: suggestedEmployer.value,
    current_validation_status: resolved.validationStatus,
    suggested_validation_status: suggestedStatus,
    confidence,
    reason,
    source_field: [suggestedName.source, suggestedEmployer.source, suggestedRole.source].join(" | "),
  };
}

function addIssue(out: CandidateDisplayIssue[], issue: DisplayIssueType, reason: string, severity: DisplayIssueSeverity, repair: CandidateDisplayRepairSuggestion) {
  out.push({ candidateId: repair.candidate_id, currentName: repair.current_name, currentRole: repair.current_role, currentEmployer: repair.current_employer, issue, reason, severity, critical: severity === "critical", suggested: repair });
}

export function auditCandidateDisplay(candidates: AnyRecord[]): CandidateDisplayAuditResult {
  const issues: CandidateDisplayIssue[] = [];
  const repairById = new Map<string, CandidateDisplayRepairSuggestion>();

  for (const candidate of candidates) {
    const repair = makeRepair(candidate, "Display repair preview");
    const currentName = repair.current_name;
    const currentRoleValue = repair.current_role;
    const currentEmployer = repair.current_employer;
    const displayStatus = repair.current_validation_status;
    const module = moduleFromCandidate(candidate);
    const roleClean = cleanTalentSearchTitle(currentRoleValue, module || "SAP");
    const criticalSeverity: DisplayIssueSeverity = displayStatus === "Ready" ? "critical" : "review";
    const nameIssue = classifyDisplayNameIssue(currentName);

    if (/^candidate profile pending validation$/i.test(currentName)) addIssue(issues, "placeholder-name", "Safe placeholder display name for blocked/review profile", "review", repair);
    else if (nameIssue) addIssue(issues, nameIssue, `Current display name is not a safe human name: ${currentName}`, criticalSeverity, repair);
    if (!isValidDisplayHumanName(currentName) && !/^candidate profile pending validation$/i.test(currentName) && nameIssue !== "invalid-name") addIssue(issues, "invalid-name", `Invalid display name: ${currentName}`, criticalSeverity, repair);
    if (!currentEmployer || currentEmployer === NOT_DISCLOSED) addIssue(issues, "missing-current-employer", "Current employer is Not disclosed", "enrichment", repair);
    if (isForbiddenEmployer(currentEmployer) && currentEmployer !== NOT_DISCLOSED) addIssue(issues, "sap-module-used-as-employer", `Employer is a SAP/module/delivery term: ${currentEmployer}`, criticalSeverity, repair);
    if ((!currentRoleValue || /^Role not disclosed$/i.test(currentRoleValue)) && module) addIssue(issues, "role-missing-with-module", `Role is missing but SAP module ${module} exists`, "enrichment", repair);
    if (/UNKNOWN/i.test([currentName, currentRoleValue, currentEmployer].join(" "))) addIssue(issues, "unknown-artifact", "Display contains UNKNOWN artifact", criticalSeverity, repair);
    if (/\bSAP\s+SAP\b/i.test([currentName, currentRoleValue, currentEmployer].join(" "))) addIssue(issues, "sap-sap-artifact", "Display contains SAP SAP artifact", criticalSeverity, repair);
    if (/^Employment\b/i.test(currentRoleValue)) addIssue(issues, "employment-prefix", "Role starts with Employment prefix", "review", repair);
    if (/[([{|\-]\s*$|[,;:.]\s*$|\b(?:at|in|for|with|and|or|of|the)\s*$/i.test(currentRoleValue)) addIssue(issues, "dangling-punctuation", "Role has dangling punctuation", "review", repair);
    if (text(candidate.previousEmployerVisible || candidate.previous_employer_visible || candidate.search_card_previous_employer)) addIssue(issues, "previous-employer-visible", "Previous employer is marked for Talent Search display", "review", repair);
    if (repair.current_validation_status === "Ready" && (/^candidate profile pending validation$/i.test(currentName) || currentEmployer === NOT_DISCLOSED)) addIssue(issues, "validation-status-inconsistent", `Validation status Ready conflicts with display quality (${displayStatus})`, "critical", repair);
    if (roleClean !== currentRoleValue && /UNKNOWN|\bSAP\s+SAP\b|^Employment\b|[([{|\-]\s*$|[,;:.]\s*$|\b(?:at|in|for|with|and|or|of|the)\s*$/i.test(currentRoleValue)) addIssue(issues, "dangling-punctuation", "Role/title needs display cleanup", "review", repair);

    if (issues.some((issue) => issue.candidateId === repair.candidate_id)) {
      repairById.set(repair.candidate_id, { ...repair, reason: issues.filter((issue) => issue.candidateId === repair.candidate_id).map((issue) => issue.issue).join("; ") });
    }
  }

  const issueCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.issue] = (acc[issue.issue] || 0) + 1;
    return acc;
  }, {});

  return {
    totalScanned: candidates.length,
    totalDisplayIssues: issues.length,
    criticalIssueCount: issues.filter((issue) => issue.severity === "critical").length,
    reviewIssueCount: issues.filter((issue) => issue.severity === "review").length,
    enrichmentIssueCount: issues.filter((issue) => issue.severity === "enrichment").length,
    issueCounts,
    issues,
    repairs: Array.from(repairById.values()),
  };
}

export function formatDisplayAuditReport(result: CandidateDisplayAuditResult) {
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Candidate Display Audit",
    "==================================================",
    "",
    `Display resolver: ${TALENT_SEARCH_DISPLAY_RESOLVER_VERSION}`,
    `Total scanned: ${result.totalScanned}`,
    `Total display issues: ${result.totalDisplayIssues}`,
    `Critical display issues: ${result.criticalIssueCount}`,
    `Review display issues: ${result.reviewIssueCount}`,
    `Enrichment issues: ${result.enrichmentIssueCount}`,
    "",
    "Issue Counts",
  ];
  for (const [issue, count] of Object.entries(result.issueCounts).sort((a, b) => b[1] - a[1])) lines.push(`- ${issue}: ${count}`);
  lines.push("", "Top 50 Examples");
  for (const issue of result.issues.slice(0, 50)) lines.push(`- ${issue.candidateId} | ${issue.currentName} | ${issue.currentRole} | ${issue.currentEmployer} | ${issue.issue} | ${issue.severity} | ${issue.reason} | suggested: ${issue.suggested.suggested_name} / ${issue.suggested.suggested_role} / ${issue.suggested.suggested_employer} / ${issue.suggested.suggested_validation_status}`);
  return lines.join("\n");
}

export function repairsToCsv(repairs: CandidateDisplayRepairSuggestion[]) {
  const headers = ["candidate_id", "current_name", "suggested_name", "current_role", "suggested_role", "current_employer", "suggested_employer", "current_validation_status", "suggested_validation_status", "confidence", "reason", "source_field"];
  const escape = (value: any) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...repairs.map((repair) => headers.map((header) => escape((repair as AnyRecord)[header])).join(","))].join("\n") + "\n";
}
