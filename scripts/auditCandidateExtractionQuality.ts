import { buildCanonicalCandidateProfile } from "../lib/canonicalCandidateProfile";
import { classifyCandidateSearchVisibility } from "../lib/candidateSearchVisibility";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import {
  isTalentSearchBadDisplayName,
  isTalentSearchPlaceholderName,
  safeTalentSearchCompany,
} from "../lib/talentSearchDisplay";

type AnyRecord = Record<string, any>;

type ExtractionIssue = {
  candidateId: string;
  displayName: string;
  currentTitle: string;
  currentCompany: string;
  issue: string;
  field: string;
  value: string;
  search_visibility: "RECRUITER_SEARCH" | "VALIDATION_QUEUE";
  validation_queue_reason: string;
  blocked_from_recruiter_search: boolean;
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function list(value: any): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map(clean).filter(Boolean);
  }
  return [];
}

function numeric(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBadTitle(value: any) {
  const title = clean(value);
  if (!title) return true;
  return /^(personal particular|personal particulars|professional objective|professional synopsis|career objective|curriculum vitae|cv|resume|authorization concepts|relevant mast(?: ewm)?|date of birth|profile summary|career history|employment history)$/i.test(title) ||
    /\b(date of birth|subjectmatterex|mdmanalyst|from data acquisition|company profile|project section|education section|certification section|roles and|managed &|responsibilities|personal details)\b/i.test(title);
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || "unknown");
}

function rawName(candidate: AnyRecord) {
  return clean(candidate.displayName || candidate.display_name || candidate.name || candidate.full_name || candidate.candidate_name);
}

function rawTitle(candidate: AnyRecord) {
  return clean(candidate.current_title || candidate.title || candidate.headline || candidate.display_title);
}

function rawCompany(candidate: AnyRecord) {
  return clean(candidate.current_company || candidate.display_company || candidate.currentCompany || candidate.company || candidate.employer);
}

function modules(candidate: AnyRecord) {
  return [candidate.primary_module, candidate.primaryModule, ...list(candidate.sap_modules), ...list(candidate.secondary_modules), ...list(candidate.skills)].map(clean).filter(Boolean);
}

function add(issues: ExtractionIssue[], candidate: AnyRecord, issue: string, field: string, value: any) {
  issues.push({
    candidateId: candidateId(candidate),
    displayName: rawName(candidate) || "Candidate profile pending validation",
    currentTitle: rawTitle(candidate) || "Role not disclosed",
    currentCompany: rawCompany(candidate) || "Not disclosed",
    issue,
    field,
    value: clean(value) || "empty",
    search_visibility: "VALIDATION_QUEUE",
    validation_queue_reason: issue,
    blocked_from_recruiter_search: true,
  });
}

export function auditCandidateExtractionQuality(candidates: AnyRecord[]) {
  const issues: ExtractionIssue[] = [];
  let recruiterSearchable = 0;
  let validationQueue = 0;
  let clientExportEligible = 0;
  let contactable = 0;

  for (const candidate of candidates) {
    const profile = buildCanonicalCandidateProfile(candidate);
    const name = rawName(candidate) || profile.displayName;
    const title = rawTitle(candidate);
    const company = rawCompany(candidate);
    const safeCompany = safeTalentSearchCompany(company);
    const candidateModules = modules(candidate);
    const years = numeric(candidate.years ?? candidate.years_experience ?? candidate.sap_years);
    const hasContact = Boolean(clean(candidate.email) || clean(candidate.phone));
    const invalidName = isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name);
    const invalidTitle = isBadTitle(title);
    const invalidEmployer = company && safeCompany === "Not disclosed";
    const missingModules = candidateModules.length === 0 || candidateModules.every((module) => /^(unknown|sap|general_sap|sap_general)$/i.test(module));
    const invalidYears = years < 0 || years > 45 || (!years && /\b(19|20)\d{2}\b/.test(clean(candidate.raw_text || candidate.resume_text || candidate.summary)));
    const validationStatus = clean(candidate.validation_status || candidate.status || "Needs Review");
    const exportEligible = Boolean(profile.allowedForExecutiveExport && !profile.identityReviewRequired && !invalidName);

    if (hasContact) contactable += 1;
    if (exportEligible) clientExportEligible += 1;
    if (invalidName) add(issues, candidate, "invalid-display-name", "displayName/name", name);
    if (invalidTitle) add(issues, candidate, "invalid-title", "current_title/title", title);
    if (invalidEmployer) add(issues, candidate, "invalid-employer-fragment", "current_company/display_company", company);
    if (!hasContact) add(issues, candidate, "missing-contact", "email/phone", "empty");
    if (!clean(candidate.country || candidate.current_location || candidate.location)) add(issues, candidate, "missing-location", "country/location", "empty");
    if (missingModules) add(issues, candidate, "missing-sap-module", "SAP modules", candidateModules.join(", "));
    if (invalidYears) add(issues, candidate, "invalid-years", "years", years);
    if (/missing information|needs review|parsing issue/i.test(validationStatus) && (invalidName || !hasContact)) add(issues, candidate, "validation-queue-identity", "validation_status", validationStatus);
    if (!exportEligible && invalidName) add(issues, candidate, "client-export-blocked-identity", "client_export_eligible", "false");

    const qualityScore = numeric(candidate.profile_quality_score ?? candidate.parser_quality_score ?? candidate.quality_score);
    const lowQuality = qualityScore > 0 && qualityScore < 55;
    const identityNotTrusted = invalidName || isTalentSearchPlaceholderName(profile.displayName) || isTalentSearchBadDisplayName(profile.displayName);
    if (lowQuality) add(issues, candidate, "low-profile-quality", "profile_quality_score", qualityScore);
    if (/missing information/i.test(validationStatus) && identityNotTrusted) add(issues, candidate, "missing-information-untrusted-identity", "validation_status", validationStatus);

    const visibility = classifyCandidateSearchVisibility(candidate);
    if (visibility.blocked_from_recruiter_search) validationQueue += 1;
    else recruiterSearchable += 1;
  }

  const issueCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.issue] = (acc[issue.issue] || 0) + 1;
    return acc;
  }, {});

  return {
    totalCandidates: candidates.length,
    recruiterSearchable,
    validationQueue,
    contactable,
    clientExportEligible,
    issueCounts,
    issues,
  };
}

export function formatCandidateExtractionQualityReport(report: ReturnType<typeof auditCandidateExtractionQuality>) {
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Candidate Extraction Quality Audit",
    "==================================================",
    "",
    `Candidates audited: ${report.totalCandidates}`,
    `Recruiter-searchable candidates: ${report.recruiterSearchable}`,
    `Validation Queue candidates: ${report.validationQueue}`,
    `Contactable candidates: ${report.contactable}`,
    `Client export eligible: ${report.clientExportEligible}`,
    "",
    "Issue Counts",
  ];
  for (const [issue, count] of Object.entries(report.issueCounts).sort((a, b) => b[1] - a[1])) lines.push(`- ${issue}: ${count}`);
  lines.push("", "Validation Queue Examples");
  for (const issue of report.issues.slice(0, 50)) {
    lines.push(`- ${issue.candidateId} | ${issue.search_visibility} | blocked=${issue.blocked_from_recruiter_search} | ${issue.validation_queue_reason} | ${issue.displayName} | ${issue.currentTitle} | ${issue.currentCompany} | ${issue.issue} | ${issue.field}: ${issue.value}`);
  }
  if (!report.issues.length) lines.push("- None");
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditCandidateExtractionQuality(candidates);
  console.log(formatCandidateExtractionQualityReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});