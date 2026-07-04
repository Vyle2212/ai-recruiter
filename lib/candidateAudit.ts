import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildCanonicalCandidateProfile, type CanonicalCandidateProfile } from "./canonicalCandidateProfile";
import { sanitizeCompanyName } from "./resumeQualityGate";

type AnyRecord = Record<string, any>;

export type AuditIssueType =
  | "invalid-name"
  | "duplicate-identity"
  | "missing-employer"
  | "fake-employer"
  | "invalid-company-type"
  | "invalid-background"
  | "invalid-sap-years"
  | "delivery-metric-anomaly";

export type AuditSeverity = "critical" | "review" | "warning";

export type CandidateAuditIssue = {
  candidateId: string;
  currentName: string;
  type: AuditIssueType;
  severity: AuditSeverity;
  evidence: string;
  isClientExportEligible?: boolean;
  exportBlocked?: boolean;
  blockingReasons?: string[];
};

export type CandidateAuditSource = {
  sourcePath: string;
  table: string;
  rawCandidateCount: number;
};

export type CandidateAuditReport = {
  totalCandidates: number;
  passed: number;
  needReview: number;
  clientExportEligible: number;
  categories: {
    invalidNames: number;
    duplicateGroups: number;
    missingEmployer: number;
    fakeEmployerSuspects: number;
    invalidCompanyType: number;
    invalidBackground: number;
    invalidSapYears: number;
    deliveryMetricAnomalies: number;
    exportBlocked: number;
  };
  issues: CandidateAuditIssue[];
  duplicateGroups: Array<{ key: string; candidates: AnyRecord[] }>;
  source?: CandidateAuditSource;
};

type ProfileRow = {
  candidate: AnyRecord;
  profile: CanonicalCandidateProfile;
};

const ALLOWED_COMPANY_TYPES = ["Consulting Firm", "In-house", "Not disclosed"];
const ALLOWED_BACKGROUNDS = ["Consulting Firm", "In-house", "Mixed (Consulting Firm + In-house)", "Not disclosed"];
const INVALID_NAME_RE = /^(profile under review|review required|name requires validation|needs manual name review|candidate\s*#?\d+|current location|technology consulting|academic background|capital market|gender|nationality|father'?s name|identity under review)$/i;
const FAKE_EMPLOYER_RE = /^(sap|technology consulting|academic background|capital market|current location)$/i;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function ensureDefaultEnvLoaded() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
}

function text(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value === "object") return Object.values(value).map(text).join(" ");
  return String(value);
}

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function displayName(candidate: AnyRecord, profile?: CanonicalCandidateProfile) {
  return clean(profile?.displayName || "Candidate profile pending validation");
}

function rawDisplayName(candidate: AnyRecord) {
  return clean(candidate.name || candidate.candidate_name || candidate.full_name || candidate.display_name);
}

function normalizedName(value: string) {
  return value.toLowerCase().replace(/\b(original|ams|mr|mrs|ms|miss|dr)\b/g, " ").replace(/[^a-z]/g, "");
}

function countryOf(candidate: AnyRecord) {
  return clean(candidate.country || candidate.current_country || candidate.location_country || candidate.current_location || candidate.location).toLowerCase();
}

function moduleOf(candidate: AnyRecord) {
  return clean(candidate.primary_module || candidate.primaryModule || candidate.module || candidate.sap_module).toUpperCase();
}

function phoneOf(candidate: AnyRecord) {
  return clean(candidate.phone || candidate.mobile || candidate.contact_phone).replace(/\D/g, "");
}

function linkedinOf(candidate: AnyRecord) {
  return clean(candidate.linkedin || candidate.linkedin_url || candidate.linkedIn).toLowerCase().replace(/^https?:\/\/(www\.)?/, "");
}

function emailOf(candidate: AnyRecord) {
  return clean(candidate.email || candidate.candidateEmail || candidate.contact_email).toLowerCase();
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function candidateKeys(candidate: AnyRecord, profile: CanonicalCandidateProfile) {
  const keys: string[] = [];
  const email = emailOf(candidate);
  const phone = phoneOf(candidate);
  const linkedin = linkedinOf(candidate);
  const name = normalizedName(displayName(candidate, profile));
  const country = countryOf(candidate);
  const module = moduleOf(candidate);
  if (email.includes("@")) keys.push(`email:${email}`);
  if (phone.length >= 8) keys.push(`phone:${phone}`);
  if (linkedin.includes("linkedin.com")) keys.push(`linkedin:${linkedin}`);
  const employer = clean(profile.currentCompany !== "Not disclosed" ? profile.currentCompany : "").toLowerCase();
  const previousEmployer = clean(profile.previousCompany).toLowerCase();
  const usableName = name && !/^(reviewrequired|profileunderreview|candidateprofilependingvalidation)$/.test(name);
  const usableModule = module && module !== "UNKNOWN" && module !== "N/A";
  const strongName = Boolean(usableName && name.length >= 8);
  if (strongName && (employer || previousEmployer)) keys.push(`name-employer-context:${name}|${employer}|${previousEmployer}`);
  if (/^(email|phone|linkedin):/.test(profile.duplicateKey)) keys.push(`canonical:${profile.duplicateKey}`);
  return keys;
}

function findDuplicateGroups(rows: ProfileRow[]) {
  const groups = new Map<string, AnyRecord[]>();
  for (const row of rows) {
    for (const key of candidateKeys(row.candidate, row.profile)) groups.set(key, [...(groups.get(key) || []), row.candidate]);
  }
  const seen = new Set<string>();
  return Array.from(groups.entries())
    .map(([key, candidates]) => ({ key, candidates: Array.from(new Map(candidates.map((candidate) => [candidateId(candidate), candidate])).values()) }))
    .filter((group) => group.candidates.length > 1)
    .filter((group) => {
      const signature = group.candidates.map(candidateId).sort().join("|");
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function rawEmployerText(candidate: AnyRecord) {
  return clean(candidate.current_company || candidate.currentCompany || candidate.currentEmployer || candidate.current_employer || candidate.employer || candidate.company || candidate.latestCompany);
}

function rawEmployer(candidate: AnyRecord) {
  return sanitizeCompanyName(rawEmployerText(candidate));
}

function hasEnoughTimelineEvidence(candidate: AnyRecord) {
  const blob = text([candidate.raw_text, candidate.resume_text, candidate.raw_cv, candidate.rawText, candidate.work_experience, candidate.workExperience, candidate.employment_history, candidate.employmentHistory]);
  return (blob.match(/\b(?:19|20)\d{2}\b/g) || []).length >= 2;
}

function rawSapYears(candidate: AnyRecord) {
  return candidate.sap_years ?? candidate.years ?? candidate.years_experience ?? candidate.experience_years ?? candidate.total_years ?? candidate.yearsExperience;
}

function deliveryEvidence(candidate: AnyRecord, term: string) {
  const blob = text(candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.rawText || candidate.work_experience || candidate.workExperience);
  return new RegExp(`\\b\\d+\\s+(?:[A-Za-z]+\\s+){0,3}(?:${term})\\b`, "i").test(blob);
}

function isBaseExportEligible(profile: CanonicalCandidateProfile) {
  return profile.allowedForExecutiveExport && !profile.identityReviewRequired && Boolean(profile.displayName);
}

function blockerSeverity(_profile: CanonicalCandidateProfile): AuditSeverity {
  return "review";
}

function addIssue(issues: CandidateAuditIssue[], candidate: AnyRecord, profile: CanonicalCandidateProfile, type: AuditIssueType, severity: AuditSeverity, evidence: string) {
  issues.push({ candidateId: candidateId(candidate), currentName: displayName(candidate, profile), type, severity, evidence });
}

function isBlockingIssue(issue: CandidateAuditIssue) {
  return issue.type !== "delivery-metric-anomaly";
}

function enrichIssueExportState(issue: CandidateAuditIssue, exportEligibleIds: Set<string>, blockingReasonsById: Map<string, string[]>): CandidateAuditIssue {
  const blockingReasons = blockingReasonsById.get(issue.candidateId) || [];
  const isClientExportEligible = exportEligibleIds.has(issue.candidateId);
  return {
    ...issue,
    severity: isBlockingIssue(issue) && isClientExportEligible ? "critical" : issue.severity === "warning" ? "warning" : "review",
    isClientExportEligible,
    exportBlocked: !isClientExportEligible,
    blockingReasons,
  };
}

export function auditCandidates(candidates: AnyRecord[], source?: CandidateAuditSource): CandidateAuditReport {
  if (!Array.isArray(candidates)) throw new Error("Candidate audit input must be a candidate array");
  if (candidates.length === 0) throw new Error("Candidate audit failed: 0 candidates loaded. Check Talent Pool data source.");

  const rows = candidates.map((candidate) => ({ candidate, profile: buildCanonicalCandidateProfile(candidate) }));
  const issues: CandidateAuditIssue[] = [];
  const duplicateGroups = findDuplicateGroups(rows);

  for (const { candidate, profile } of rows) {
    const name = displayName(candidate, profile);
    const rawName = rawDisplayName(candidate);
    const rawProfileUnderReview = /^profile under review$/i.test(rawName);
    if (!profile.displayName || INVALID_NAME_RE.test(name) || (INVALID_NAME_RE.test(rawName) && !(rawProfileUnderReview && profile.displayName))) {
      addIssue(issues, candidate, profile, "invalid-name", blockerSeverity(profile), profile.auditWarnings.find((item) => /name|identity/i.test(item)) || rawName || "Name requires validation");
    }

    const employer = rawEmployer(candidate);
    const rawEmployerValue = rawEmployerText(candidate);
    const canonicalEmployer = profile.currentCompany;
    if (FAKE_EMPLOYER_RE.test(rawEmployerValue) || (canonicalEmployer && canonicalEmployer !== "Not disclosed" && FAKE_EMPLOYER_RE.test(canonicalEmployer))) {
      addIssue(issues, candidate, profile, "fake-employer", blockerSeverity(profile), rawEmployerValue || canonicalEmployer);
    } else if (!canonicalEmployer || canonicalEmployer === "Not disclosed") {
      addIssue(issues, candidate, profile, "missing-employer", blockerSeverity(profile), employer || "Not disclosed / empty");
    }

    const rawCompanyType = clean(candidate.company_type || candidate.companyType || candidate.current_company_type);
    const companyTypeValue = rawCompanyType || profile.companyType;
    if (!ALLOWED_COMPANY_TYPES.includes(companyTypeValue)) addIssue(issues, candidate, profile, "invalid-company-type", blockerSeverity(profile), companyTypeValue);

    const rawBackground = clean(candidate.background || candidate.background_experience || candidate.backgroundExperience || candidate.experience_type);
    const backgroundValue = rawBackground || profile.backgroundExperience;
    if (!ALLOWED_BACKGROUNDS.includes(backgroundValue)) addIssue(issues, candidate, profile, "invalid-background", blockerSeverity(profile), backgroundValue);

    const rawYears = rawSapYears(candidate);
    const numericYears = Number(rawYears);
    if (rawYears === "" || rawYears === null || rawYears === undefined || Number.isNaN(numericYears) || numericYears < 0 || numericYears > 45 || (numericYears === 0 && hasEnoughTimelineEvidence(candidate))) {
      addIssue(issues, candidate, profile, "invalid-sap-years", blockerSeverity(profile), rawYears === undefined || rawYears === null || rawYears === "" ? "empty" : String(rawYears));
    }

    const metrics = profile.deliveryMetrics;
    if ((metrics.implementation === 1 && !deliveryEvidence(candidate, "implementation")) || (metrics.rollout === 1 && !deliveryEvidence(candidate, "rollout")) || (metrics.ams === 1 && !deliveryEvidence(candidate, "ams|support")) || (metrics.s4 === 1 && !deliveryEvidence(candidate, "s\\/?4hana|s4hana"))) {
      addIssue(issues, candidate, profile, "delivery-metric-anomaly", "warning", "Suspicious count of 1 without explicit work-history evidence");
    }
  }

  for (const group of duplicateGroups) {
    for (const candidate of group.candidates) {
      const duplicateProfile = buildCanonicalCandidateProfile(candidate);
      addIssue(issues, candidate, duplicateProfile, "duplicate-identity", blockerSeverity(duplicateProfile), group.key);
    }
  }

  const issueCount = (type: AuditIssueType) => issues.filter((issue) => issue.type === type).length;
  const blockingIssueIds = new Set(issues.filter(isBlockingIssue).map((issue) => issue.candidateId));
  const blockingReasonsById = new Map<string, string[]>();
  for (const issue of issues.filter(isBlockingIssue)) {
    blockingReasonsById.set(issue.candidateId, [...(blockingReasonsById.get(issue.candidateId) || []), `${issue.type}: ${issue.evidence}`]);
  }
  const reviewIds = new Set(rows.filter((row) => !row.profile.allowedForRanking || row.profile.identityReviewRequired).map((row) => candidateId(row.candidate)));
  for (const issue of issues) reviewIds.add(issue.candidateId);
  const exportEligibleRows = rows.filter((row) => row.profile.allowedForExecutiveExport && !row.profile.identityReviewRequired && !blockingIssueIds.has(candidateId(row.candidate)));
  const exportEligibleIds = new Set(exportEligibleRows.map((row) => candidateId(row.candidate)));
  const enrichedIssues = issues.map((issue) => enrichIssueExportState(issue, exportEligibleIds, blockingReasonsById));

  return {
    totalCandidates: candidates.length,
    passed: Math.max(0, candidates.length - reviewIds.size),
    needReview: reviewIds.size,
    clientExportEligible: exportEligibleRows.length,
    categories: {
      invalidNames: issueCount("invalid-name"),
      duplicateGroups: duplicateGroups.length,
      missingEmployer: issueCount("missing-employer"),
      fakeEmployerSuspects: issueCount("fake-employer"),
      invalidCompanyType: issueCount("invalid-company-type"),
      invalidBackground: issueCount("invalid-background"),
      invalidSapYears: issueCount("invalid-sap-years"),
      deliveryMetricAnomalies: issueCount("delivery-metric-anomaly"),
      exportBlocked: candidates.length - exportEligibleRows.length,
    },
    issues: enrichedIssues,
    duplicateGroups,
    source,
  };
}

function appendCriticalIssueExamples(lines: string[], report: CandidateAuditReport) {
  const examples = report.issues.filter((issue) => issue.severity === "critical").slice(0, 10);
  for (const issue of examples) {
    lines.push(`- ${issue.candidateId} | ${issue.currentName} | ${issue.type} | reason: ${issue.evidence} | isClientExportEligible: ${Boolean(issue.isClientExportEligible)} | exportBlocked: ${Boolean(issue.exportBlocked)} | blocking reasons: ${(issue.blockingReasons || []).join("; ") || "None"}`);
  }
  if (!examples.length) lines.push("- None");
}

function appendIssueExamples(lines: string[], report: CandidateAuditReport, type: AuditIssueType) {
  const examples = report.issues.filter((issue) => issue.type === type).slice(0, 5);
  for (const issue of examples) lines.push(`- ${issue.candidateId} | ${issue.currentName} | ${issue.evidence}`);
  if (!examples.length) lines.push("- None");
}

function appendDuplicateExamples(lines: string[], report: CandidateAuditReport) {
  const examples = report.duplicateGroups.slice(0, 5);
  for (const group of examples) {
    const names = group.candidates.map((candidate) => `${candidateId(candidate)}:${rawDisplayName(candidate) || "Unnamed"}`).join("; ");
    lines.push(`- ${group.key} | ${names}`);
  }
  if (!examples.length) lines.push("- None");
}

export function formatAuditReport(report: CandidateAuditReport) {
  const lines = ["==================================================", "PRIMUS AI Recruiter", "Enterprise Candidate Audit", "==================================================", ""];
  if (report.source) {
    lines.push(`Data source: ${report.source.sourcePath}`);
    lines.push(`Candidate source: ${report.source.table}`);
    lines.push(`Raw candidates loaded: ${report.source.rawCandidateCount}`);
    lines.push("");
  }
  lines.push(`Candidates audited: ${report.totalCandidates}`);
  lines.push(`Passed: ${report.passed}`);
  lines.push(`Need review: ${report.needReview}`);
  lines.push(`Client export eligible: ${report.clientExportEligible}`);
  lines.push(`Export blocked: ${report.categories.exportBlocked}`);
  lines.push("");
  lines.push("Name Parser");
  lines.push(`- Invalid names: ${report.categories.invalidNames}`);
  lines.push("");
  lines.push("Identity Resolution");
  lines.push(`- Duplicate groups: ${report.categories.duplicateGroups}`);
  lines.push("");
  lines.push("Employer Parser");
  lines.push(`- Missing employer: ${report.categories.missingEmployer}`);
  lines.push(`- Fake employer suspects: ${report.categories.fakeEmployerSuspects}`);
  lines.push("");
  lines.push("Company Type");
  lines.push(`- Invalid company type: ${report.categories.invalidCompanyType}`);
  lines.push("");
  lines.push("Background");
  lines.push(`- Invalid background: ${report.categories.invalidBackground}`);
  lines.push("");
  lines.push("SAP Years");
  lines.push(`- Invalid SAP years: ${report.categories.invalidSapYears}`);
  lines.push("");
  lines.push("Delivery Metrics");
  lines.push(`- Anomalies: ${report.categories.deliveryMetricAnomalies}`);
  lines.push("");
  lines.push("Critical Issue Examples");
  appendCriticalIssueExamples(lines, report);
  lines.push("");
  lines.push("Invalid Name Examples");
  appendIssueExamples(lines, report, "invalid-name");
  lines.push("");
  lines.push("Missing Employer Examples");
  appendIssueExamples(lines, report, "missing-employer");
  lines.push("");
  lines.push("Duplicate Group Examples");
  appendDuplicateExamples(lines, report);
  lines.push("");
  lines.push("Delivery Anomaly Examples");
  appendIssueExamples(lines, report, "delivery-metric-anomaly");
  lines.push("");
  lines.push("Sample Issues");
  for (const issue of report.issues.slice(0, 20)) lines.push(`- ${issue.candidateId} | ${issue.currentName} | ${issue.type} | ${issue.evidence}`);
  if (!report.issues.length) lines.push("- None");
  return lines.join("\n");
}

export async function loadRealTalentPoolCandidates() {
  ensureDefaultEnvLoaded();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Candidate audit failed: missing Supabase URL/key for Talent Pool candidate source.");

  const supabase = createClient(supabaseUrl, supabaseKey);
  const candidates: AnyRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(`Candidate audit failed: unable to load candidates from Supabase candidates table: ${error.message}`);
    candidates.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return {
    candidates,
    source: {
      // Talent Search: app/search/page.tsx -> /api/search-candidates -> Supabase candidates.
      // Compare: components/candidate-compare-workspace.tsx -> /api/candidates/[id] -> Supabase candidates.
      // Candidate 360: app/candidates/[id]/page.tsx -> Supabase candidates.
      // Shortlist: app/shortlist/page.tsx stores shortlist ids; app/api/shortlists uses shortlist_candidates candidate_id references.
      // Data source file/path: lib/candidateAudit.ts, mirroring app/api/candidates/route.ts and app/api/search-candidates/route.ts.
      // Candidate table/key/source name: Supabase table "candidates", primary row key "id".
      // How many raw candidates are loaded: source.rawCandidateCount is populated here at runtime and printed in the audit report.
      sourcePath: "Supabase via lib/candidateAudit.ts; app routes app/api/candidates/route.ts and app/api/search-candidates/route.ts",
      table: "candidates",
      rawCandidateCount: candidates.length,
    },
  };
}



