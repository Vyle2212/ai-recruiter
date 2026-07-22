import {
  Candidate360FieldSource as Source,
  Candidate360VerificationStatus as Status,
  type Candidate360Education,
  type Candidate360Experience,
  type Candidate360Field,
  type Candidate360Language,
  type Candidate360Profile,
  type Candidate360Skill,
} from "./candidate360Types";

type AnyRecord = Record<string, any>;
const SOURCE_RANK: Record<Candidate360FieldSourceValue, number> = {
  unknown: 0, imported: 1, parser_extracted: 2, ai_extracted: 3,
  recruiter_approved: 4, candidate_confirmed: 6, candidate_edited: 7,
};
type Candidate360FieldSourceValue = `${Source}`;

function clean(value: unknown): string { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function array(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {}
  return value.split(/[,;|]/).map(clean).filter(Boolean);
}
function idOf(candidate: AnyRecord) { return clean(candidate.id || candidate.candidate_id); }
function baseSource(candidate: AnyRecord): Source {
  const raw = clean(candidate.extraction_source || candidate.source || candidate.import_source).toLowerCase();
  if (raw.includes("candidate_confirm")) return Source.CandidateConfirmed;
  if (raw.includes("candidate_edit")) return Source.CandidateEdited;
  if (raw.includes("recruiter")) return Source.RecruiterApproved;
  if (raw.includes("ai")) return Source.AiExtracted;
  if (raw.includes("import")) return Source.Imported;
  return Source.ParserExtracted;
}
function statusFor(source: Source, hasValue: boolean): Status {
  if (!hasValue) return Status.NeedsCandidateConfirmation;
  if (source === Source.CandidateConfirmed) return Status.CandidateConfirmed;
  if (source === Source.CandidateEdited) return Status.CandidateEditedNeedsRecruiterReview;
  if (source === Source.RecruiterApproved) return Status.RecruiterVerified;
  return Status.NeedsCandidateConfirmation;
}
function field<T>(fieldName: string, value: T, source: Source, extra: Partial<Candidate360Field<T>> = {}): Candidate360Field<T> {
  const hasValue = value !== null && value !== undefined && clean(value) !== "";
  return {
    fieldName, value, source, verificationStatus: statusFor(source, hasValue),
    confidence: hasValue ? (source === Source.ParserExtracted ? 60 : source === Source.Unknown ? 0 : 90) : 0,
    lastConfirmedAt: null, lastConfirmedBy: null, evidence: "", conflictReason: "",
    editableByCandidate: true, ...extra,
  };
}
function candidateMetadata(candidate: AnyRecord, fieldName: string): AnyRecord | undefined {
  const metadata = candidate.candidate360_fields || candidate.field_metadata || candidate.confirmed_fields || {};
  if (Array.isArray(metadata)) return metadata.find((item) => clean(item?.fieldName || item?.field_name) === fieldName);
  return metadata[fieldName];
}
function acceptedApproval(entry: AnyRecord) {
  return ["approve_suggestion", "manual_override_approve", "approve_for_apply", "applied", "verified_applied"].includes(clean(entry.decision || entry.status));
}
function entries(input: any, names: string[]): AnyRecord[] {
  if (Array.isArray(input)) return input;
  for (const name of names) if (Array.isArray(input?.[name])) return input[name];
  return [];
}
function resolveField<T>(candidate: AnyRecord, fieldName: string, rawValue: T, approvals: any, decisions: any, applyHistory: any): Candidate360Field<T> {
  let result = field(fieldName, rawValue, baseSource(candidate));
  const candidateId = idOf(candidate);
  const overlays: Array<{ value: any; source: Source; status?: Status; at?: string; by?: string; evidence?: string }> = [];
  for (const item of entries(approvals, ["approvals"])) {
    if (clean(item.candidateId) === candidateId && clean(item.fieldName) === fieldName && acceptedApproval(item)) {
      overlays.push({ value: item.suggestedValue, source: Source.RecruiterApproved, status: Status.RecruiterVerified, at: item.updatedAt, by: "recruiter", evidence: item.aiEvidence });
    }
  }
  for (const item of entries(decisions, ["decisions"])) {
    if (clean(item.candidateId) === candidateId && clean(item.fieldName) === fieldName && acceptedApproval(item)) {
      overlays.push({ value: item.suggestedValue, source: Source.RecruiterApproved, status: Status.RecruiterVerified, at: item.updatedAt, by: "recruiter", evidence: array(item.safetyReasons).join("; ") });
    }
  }
  for (const item of entries(applyHistory, ["items", "history"])) {
    if (clean(item.candidateId) === candidateId && clean(item.fieldName) === fieldName && /applied|verified/i.test(clean(item.status))) {
      overlays.push({ value: item.finalDbValue ?? item.approvedValue, source: Source.RecruiterApproved, status: Status.RecruiterVerified, at: item.lastChecked, by: "recruiter", evidence: item.evidence });
    }
  }
  const metadata = candidateMetadata(candidate, fieldName);
  if (metadata !== undefined) {
    const item = typeof metadata === "object" ? metadata : { value: metadata, source: "candidate_confirmed" };
    const source = Object.values(Source).includes(item.source) ? item.source as Source : Source.CandidateConfirmed;
    overlays.push({ value: item.value, source, at: item.lastConfirmedAt || item.confirmedAt, by: item.lastConfirmedBy || "candidate", evidence: item.evidence });
  }
  for (const overlay of overlays.sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source])) {
    if (overlay.value === undefined || overlay.value === null || clean(overlay.value) === "") continue;
    const prior = result;
    const conflict = overlay.source === Source.CandidateEdited && prior.source === Source.RecruiterApproved && clean(prior.value) !== clean(overlay.value);
    result = field(fieldName, overlay.value as T, overlay.source, {
      verificationStatus: conflict ? Status.CandidateEditedNeedsRecruiterReview : overlay.status ?? statusFor(overlay.source, true),
      confidence: overlay.source === Source.CandidateEdited ? 90 : 100,
      lastConfirmedAt: clean(overlay.at) || null, lastConfirmedBy: clean(overlay.by) || null,
      evidence: clean(overlay.evidence), conflictReason: conflict ? `Candidate edit conflicts with recruiter-approved value: ${clean(prior.value)}` : "",
    });
  }
  return result;
}
function stringField(candidate: AnyRecord, name: string, aliases: string[], approvals: any, decisions: any, history: any) {
  const value = aliases.map((key) => candidate[key]).find((item) => clean(item)) ?? "";
  return resolveField(candidate, name, clean(value), approvals, decisions, history);
}
function nestedField(name: string, value: unknown, source: Source) { return field(name, clean(value), source); }

export function buildCandidate360Profile(candidate: AnyRecord, workflowState?: AnyRecord, approvals?: any, decisions?: any, applyHistory?: any): Candidate360Profile {
  const source = baseSource(candidate);
  const displayName = stringField(candidate, "displayName", ["name", "display_name", "candidate_name", "full_name"], approvals, decisions, applyHistory);
  const currentTitle = stringField(candidate, "currentTitle", ["current_title", "title", "headline"], approvals, decisions, applyHistory);
  const currentCompany = stringField(candidate, "currentCompany", ["current_company", "company", "employer"], approvals, decisions, applyHistory);
  const location = stringField(candidate, "location", ["location", "current_location", "country"], approvals, decisions, applyHistory);
  const email = stringField(candidate, "email", ["email", "email_address"], approvals, decisions, applyHistory);
  const phone = stringField(candidate, "phone", ["phone", "phone_number", "mobile"], approvals, decisions, applyHistory);
  const headline = stringField(candidate, "headline", ["headline", "current_title", "title"], approvals, decisions, applyHistory);
  const rawYears = candidate.years_of_experience ?? candidate.yearsExperience ?? candidate.years ?? candidate.total_experience_years;
  const yearsValue = Number.isFinite(Number(rawYears)) && clean(rawYears) ? Number(rawYears) : null;
  const yearsOfExperience = resolveField(candidate, "yearsOfExperience", yearsValue, approvals, decisions, applyHistory);
  const modules = array(candidate.sap_modules || candidate.secondary_modules || candidate.modules);
  const primaryModule = clean(candidate.primary_module || candidate.primarySapModule);
  const moduleNames = Array.from(new Set([primaryModule, ...modules.map((item) => clean(item?.name || item))].filter(Boolean)));
  const skillNames = Array.from(new Set(array(candidate.tech_skills || candidate.technical_skills || candidate.skills).map((item) => clean(item?.name || item)).filter(Boolean)));
  const sapModules: Candidate360Skill[] = moduleNames.map((name) => ({ name: nestedField("sapModule", name, source), category: "sap_module" }));
  const techSkills: Candidate360Skill[] = skillNames.filter((name) => !moduleNames.includes(name)).map((name) => ({ name: nestedField("techSkill", name, source), category: "technical" }));
  const workExperience: Candidate360Experience[] = array(candidate.work_experience || candidate.experience || candidate.employment_history).map((item, index) => {
    const entry = typeof item === "object" ? item : { description: item };
    return { id: clean(entry.id) || `experience-${index + 1}`, title: nestedField("experience.title", entry.title || entry.role, source), company: nestedField("experience.company", entry.company || entry.employer, source), startDate: nestedField("experience.startDate", entry.startDate || entry.start_date, source), endDate: nestedField("experience.endDate", entry.endDate || entry.end_date, source), description: nestedField("experience.description", entry.description || entry.summary, source) };
  });
  const education: Candidate360Education[] = array(candidate.education || candidate.education_history).map((item, index) => {
    const entry = typeof item === "object" ? item : { qualification: item };
    return { id: clean(entry.id) || `education-${index + 1}`, institution: nestedField("education.institution", entry.institution || entry.school, source), qualification: nestedField("education.qualification", entry.qualification || entry.degree, source), fieldOfStudy: nestedField("education.fieldOfStudy", entry.fieldOfStudy || entry.field_of_study, source), graduationYear: nestedField("education.graduationYear", entry.graduationYear || entry.graduation_year || entry.year, source) };
  });
  const languages: Candidate360Language[] = array(candidate.languages).map((item) => {
    const entry = typeof item === "object" ? item : { language: item };
    return { language: nestedField("language", entry.language || entry.name, source), proficiency: nestedField("language.proficiency", entry.proficiency || entry.level, source) };
  });
  const core = [displayName, currentTitle, currentCompany, location, email, phone, yearsOfExperience];
  const missingFields = core.filter((item) => item.value === null || !clean(item.value)).map((item) => item.fieldName);
  if (!sapModules.length && !techSkills.length) missingFields.push("skills");
  if (!workExperience.length) missingFields.push("workExperience");
  const totalFields = 9;
  const completedFields = totalFields - missingFields.length;
  const score = Math.max(0, Math.round((completedFields / totalFields) * 100));
  const allFields = [...core, ...sapModules.map((item) => item.name), ...techSkills.map((item) => item.name)];
  const verificationSummary = Object.fromEntries(Object.values(Status).map((status) => [status, allFields.filter((item) => item.verificationStatus === status).length])) as Record<Status, number>;
  const needsRecruiterReview = allFields.some((item) => [Status.CandidateEditedNeedsRecruiterReview, Status.ConflictDetected].includes(item.verificationStatus));
  const needsCandidateConfirmation = missingFields.length > 0 || allFields.some((item) => item.verificationStatus === Status.NeedsCandidateConfirmation);
  const workflowStatus = clean(workflowState?.currentStatus || workflowState?.status) || "unknown";
  const readyForShortlist = Boolean(workflowState?.readyForShortlist || workflowStatus === "ready_for_shortlist");
  return {
    candidateId: idOf(candidate), displayName, headline, currentTitle, currentCompany, location,
    contactInfo: { email, phone }, yearsOfExperience, sapModules, techSkills, workExperience, education, languages,
    workExperienceSummary: workExperience.length ? `${workExperience.length} experience entr${workExperience.length === 1 ? "y" : "ies"} available` : "No structured work experience available",
    educationSummary: education.length ? `${education.length} education entr${education.length === 1 ? "y" : "ies"} available` : "No structured education available",
    verificationSummary,
    completeness: { score, completedFields, totalFields, highCompleteness: score >= 80, lowCompleteness: score < 50, missingFields },
    missingFields,
    recommendedCandidateActions: [...(missingFields.length ? [`Complete missing fields: ${missingFields.join(", ")}`] : []), ...(needsCandidateConfirmation ? ["Review and confirm profile accuracy"] : [])],
    recommendedRecruiterActions: [...(needsRecruiterReview ? ["Review candidate edits that conflict with trusted values"] : []), ...(workflowState?.recommendedNextAction ? [clean(workflowState.recommendedNextAction).replace(/_/g, " ")] : [])],
    workflowStatus,
    repairQueueStatus: clean(workflowState?.repairQueueStatus || workflowState?.repairCategory) || "not_in_repair_queue",
    selfConfirmStatus: needsCandidateConfirmation ? "awaiting_candidate_confirmation" : "candidate_confirmation_complete",
    readiness: { searchable: !missingFields.includes("displayName") && !missingFields.includes("currentTitle"), readyForShortlist, needsCandidateConfirmation, needsRecruiterReview },
    mode: "read-only Candidate360 profile; no candidate DB writes",
  };
}
