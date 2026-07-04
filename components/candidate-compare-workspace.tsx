"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock, Copy, Cpu, FileSpreadsheet, FileText, Link2, Mail, MessageCircle, Phone, Search, Send, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { buildCanonicalCandidateProfile, validateCanonicalCandidateProfile } from "@/lib/canonicalCandidateProfile";
import {
  normalizeCompareCandidate,
  rankCompareCandidates,
  type AnyRecord,
  type CandidateCompareSignal,
} from "@/lib/candidateCompareEngine";
import { calculateSubmissionConfidence, type SubmissionConfidenceResult } from "@/lib/submissionConfidence";
import { buildDecisionReasoning, type DecisionReasoning } from "@/lib/ai/decisionReasoning";
import { generateSubmissionOutputs } from "@/lib/ai/submissionGenerator";

const MATCHES_CACHE_KEY = "sapTalentHub.matches.pageState.v1";
const SEARCH_SESSION_PREFIX = "sapTalentHub.searchSession.v1.";
const MAX_SELECTED = 20;
const COMPARE_SHORTLIST_KEY = "primus.shortlist.workflow.v1";
const LAST_COMPARE_URL_KEY = "primus.compare.lastUrl.v1";
const DIRECT_COMPARE_CACHE_KEY = "primus.compare.directCandidates.v1";

type ShortlistStage = "Shortlisted" | "Ready to Submit" | "Sent to Client" | "Interview 1" | "Interview 2" | "Offer" | "Hired" | "Rejected";

type ShortlistWorkflowItem = {
  id: string;
  candidateId: string;
  name: string;
  title: string;
  module: string;
  location: string;
  company: string;
  score: number;
  stage: ShortlistStage;
  sourceSearchId: string;
  sourceSearchTitle: string;
  addedAt: string;
  status: "Shortlisted";
  compareUrl: string;
  rank: number;
  source: "Compare";
  aiRecommended: boolean;
  visibility: {
    internalRecruiter: boolean;
    client: boolean;
    admin: boolean;
  };
};

type MatrixRow = {
  label: string;
  value: (candidate: CandidateCompareSignal, index: number, ranked: CandidateCompareSignal[]) => string;
  score?: (candidate: CandidateCompareSignal) => number | null;
};

type CompareViewMode = "summary" | "detailed" | "export";
type ComparePreset = 5 | 10 | 20;
type CompareFocusMode = "All" | "Only Differences" | "Commercial" | "Delivery" | "Leadership" | "Architecture" | "Implementation";

const SUMMARY_ROW_LABELS = new Set([
  "Key Strength",
  "SAP Years",
  "Implementations",
  "S/4HANA",
  "Architecture",
  "Commercial Risk",
  "Required Validation",
]);

const WINNER_HIGHLIGHT_ROWS = new Set([
  "SAP Years",
  "Implementations",
  "S/4HANA",
  "Architecture",
  "Leadership",
  "Client-facing",
]);

function normalizeModule(value: string | null) {
  return String(value || "").replace(/^SAP\s+/i, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function safeCandidateId(candidate: AnyRecord) {
  return String(candidate.id || candidate.candidate_id || candidate.email || candidate.name || "").trim();
}
function cleanCandidateName(value: unknown) {
  const cleaned = String(value || "")
    .replace(/\.[a-z0-9]{2,5}$/i, " ")
    .replace(/[_|()[\]{}]+/g, " ")
    .replace(/\b(professional summary|current location|availability|notice period|resume|cv|profile|candidate|updated|final|latest)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  const deduped = words.filter((word, index) => index === 0 || word.toLowerCase() !== words[index - 1]?.toLowerCase());
  const candidateName = deduped.join(" ").replace(/\s+(age|current location|availability|notice period|salary|current company|location|professional summary)$/i, "").trim();
  return candidateName;
}

function isInvalidCandidateName(value: string): boolean {
  const normalized = cleanCandidateName(value).toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  const invalidTokens = [
    "current location",
    "location",
    "petaling jaya",
    "malaysia",
    "selangor",
    "kuala lumpur",
    "unknown",
    "not disclosed",
    "protected",
    "age",
    "unnamed candidate",
    "name pending validation",
    "name not disclosed",
    "name requires review",
    "name requires validation",
    "profile under review",
    "profile requires review",
    "requires review",
    "requires validation",
    "needs manual name review",  ];
  if (invalidTokens.some((token) => normalized === token || normalized.startsWith(token + ","))) return true;
  if (/^candidate\s*#?\d+$/i.test(normalized)) return true;
  if (/\b(address|city|country|current company|current role|job title|recommendation|validation|availability|notice period|age|profile|resume|section|summary)\b/i.test(normalized)) return true;
  const symbolCount = (normalized.match(/[^a-z\s'.-]/gi) || []).length;
  if (symbolCount > 1 || /\d{2,}/.test(normalized) || normalized.length > 70) return true;
  return false;
}
function looksLikePersonName(value: string): boolean {
  const normalized = cleanCandidateName(value);
  if (isInvalidCandidateName(normalized)) return false;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;
  return parts.every((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part));
}

function readableEmailName(value: unknown) {
  const local = String(value || "").split("@")[0]?.replace(/[._+-]+/g, " ").replace(/\s+/g, " ").trim();
  return looksLikePersonName(local) ? cleanCandidateName(local).replace(/\b\w/g, (char) => char.toUpperCase()) : "";
}

function resumeHeaderName(candidate: CandidateCompareSignal | undefined) {
  const raw = candidate?.raw || {};
  const text = String(raw.resumeText || raw.resume_text || raw.cvText || raw.cv_text || raw.parsed_resume || raw.profileText || raw.profile_text || "");
  const lines = text.split(/\r?\n/).map((line) => cleanCandidateName(line)).filter(Boolean).slice(0, 8);
  return lines.find((line) => looksLikePersonName(line)) || "";
}

function resumeFileName(candidate: CandidateCompareSignal | undefined) {
  const raw = candidate?.raw || {};
  const fileValue = raw.resumeFileName || raw.resume_file_name || raw.originalFileName || raw.original_file_name || raw.filename || raw.fileName || raw.documentName || raw.document_name || raw.sourceFileName || raw.source_file_name;
  const cleaned = cleanCandidateName(fileValue);
  return looksLikePersonName(cleaned) ? cleaned : "";
}

function getCandidateDisplayName(candidate: CandidateCompareSignal | undefined, fallback = "") {
  if (!candidate) return fallback;
  const raw = candidate.raw || {};
  const fullFromParts = [raw.firstName || raw.first_name || (candidate as AnyRecord).firstName, raw.lastName || raw.last_name || (candidate as AnyRecord).lastName].filter(Boolean).join(" ");
  const trustedValues = [
    raw.fullName,
    raw.full_name,
    (candidate as AnyRecord).fullName,
    candidate.name,
    raw.name,
    raw.candidateName,
    raw.candidate_name,
    raw.parsedResume?.name,
    raw.parsed_resume?.name,
    raw.parsedProfile?.fullName,
    raw.parsedProfile?.full_name,
    raw.parsedProfile?.name,
    raw.profile?.name,
    raw.resume?.name,
    raw.resumeName,
    raw.resume_name,
    fullFromParts,
    raw.originalName,
    raw.original_name,
    raw.profileName,
    raw.profile_name,
  ];
  for (const value of trustedValues) {
    const cleanValue = cleanCandidateName(value);
    if (looksLikePersonName(cleanValue)) return cleanValue;
  }
  return resumeHeaderName(candidate) || resumeFileName(candidate) || readableEmailName(raw.email || raw.candidateEmail || raw.candidate_email || raw.contactEmail || raw.contact_email) || fallback;
}

function resolveCandidateName(candidate: CandidateCompareSignal | undefined) {
  return getCandidateDisplayName(candidate, "");
}

function candidateDisplayName(candidate: CandidateCompareSignal | undefined, _rank?: number) {
  return normalizeCandidateDisplayData(candidate).displayName;
}

function candidateExportName(candidate: CandidateCompareSignal | undefined, _rank?: number) {
  return normalizeCandidateDisplayData(candidate).exportName;
}
function hasResolvedCandidateName(candidate: CandidateCompareSignal | undefined) {
  if (!candidate) return false;
  const name = getCandidateDisplayName(candidate, "");
  return Boolean(name && looksLikePersonName(name) && !isInvalidCandidateName(name));
}

type CandidateDisplayData = {
  displayName: string;
  exportName: string;
  validName: boolean;
  currentCompany: string;
  companyType: "Consulting Firm" | "In-house" | "Not disclosed";
  backgroundExperience: "Consulting Firm" | "In-house" | "Mixed (Consulting Firm + In-house)" | "Not disclosed";
};

function normalizeCandidateDisplayData(candidate: CandidateCompareSignal | undefined): CandidateDisplayData {
  if (!candidate) return { displayName: "", exportName: "", validName: false, currentCompany: "Not disclosed", companyType: "Not disclosed", backgroundExperience: "Not disclosed" };
  const canonical = buildCanonicalCandidateProfile(candidate.raw || candidate);
  return {
    displayName: canonical.displayName,
    exportName: canonical.exportName,
    validName: !canonical.needsManualReview && canonical.allowedForExecutiveExport && Boolean(canonical.exportName),
    currentCompany: canonical.currentCompany,
    companyType: canonical.companyType,
    backgroundExperience: canonical.backgroundExperience,
  };
}
function hasWorkHistoryCompany(candidate: CandidateCompareSignal) {
  return buildCanonicalCandidateProfile(candidate.raw || candidate).auditWarnings.some((item) => /work history|company/i.test(item));
}

function validateCandidateDisplayData(candidate: CandidateCompareSignal) {
  const data = normalizeCandidateDisplayData(candidate);
  const canonical = buildCanonicalCandidateProfile(candidate.raw || candidate);
  const issues = validateCanonicalCandidateProfile(canonical);
  if (issues.length && process.env.NODE_ENV === "development") console.warn("[Compare QA] Candidate display data issue", { candidateId: candidate.id, issues, data });
  return { valid: issues.length === 0, issues, data };
}
type SearchSnapshot = {
  matches: AnyRecord[];
  candidateIds: string[];
  primaryModule: string;
  filters: AnyRecord;
  searchSessionId: string;
};

function emptySearchSnapshot(searchSessionId = "", activeModule = ""): SearchSnapshot {
  return { matches: [], candidateIds: [], primaryModule: activeModule, filters: {}, searchSessionId };
}

function readStoredSnapshot(searchId: string) {
  const stores = [window.localStorage, window.sessionStorage];
  for (const store of stores) {
    const direct = store.getItem(SEARCH_SESSION_PREFIX + searchId);
    if (direct) return direct;
    const fallback = store.getItem(MATCHES_CACHE_KEY);
    if (fallback) {
      try {
        const parsed = JSON.parse(fallback);
        if (String(parsed?.searchSessionId || parsed?.searchId || "") === searchId) return fallback;
      } catch {}
    }
  }
  return "";
}

function readCurrentSearchSnapshot(searchId: string, activeModule: string): SearchSnapshot {
  if (typeof window === "undefined" || !searchId) return emptySearchSnapshot(searchId, activeModule);
  try {
    const stored = readStoredSnapshot(searchId);
    const parsed = JSON.parse(stored || "{}");
    if (String(parsed?.searchSessionId || parsed?.searchId || "") !== searchId) return emptySearchSnapshot(searchId, activeModule);

    const matches = Array.isArray(parsed?.matches) ? parsed.matches : [];
    const candidateIds = Array.isArray(parsed?.candidateIds) ? parsed.candidateIds.map(String).filter(Boolean) : matches.map(safeCandidateId).filter(Boolean);
    const primaryModule = normalizeModule(parsed?.primaryModule || parsed?.module || parsed?.requiredModule || activeModule || "");
    return { matches, candidateIds, primaryModule, filters: parsed?.filters || {}, searchSessionId: searchId };
  } catch {
    return emptySearchSnapshot(searchId, activeModule);
  }
}

function orderBySearchIds(candidates: CandidateCompareSignal[], currentSearchIds: string[]) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return currentSearchIds.map((id) => byId.get(id)).filter(Boolean) as CandidateCompareSignal[];
}

function searchResultCandidates(candidates: CandidateCompareSignal[], currentSearchIds: string[]) {
  if (!currentSearchIds.length) return candidates;
  return orderBySearchIds(candidates, currentSearchIds);
}

function displaySapModule(candidate: CandidateCompareSignal) {
  const module = normalizeModule(candidate.module);
  return module && module !== "UNKNOWN" && module !== "SAP" ? "SAP " + module : "Unknown SAP Module";
}

function rawValue(candidate: CandidateCompareSignal, keys: string[]) {
  for (const key of keys) {
    const value = candidate.raw?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

function rawNumber(candidate: CandidateCompareSignal, keys: string[]) {
  for (const key of keys) {
    const value = Number(candidate.raw?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function globalSearchRank(candidate: CandidateCompareSignal, fallbackIndex?: number) {
  const rank = rawNumber(candidate, [
    "global_rank",
    "globalRank",
    "search_rank",
    "searchRank",
    "match_rank",
    "matchRank",
    "rank_position",
    "rankPosition",
    "rank",
  ]);
  if (rank) return rank;
  return typeof fallbackIndex === "number" && fallbackIndex >= 0 ? fallbackIndex + 1 : 0;
}

function concise(value: string) {
  return String(value || "").replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

function displayValue(value: any, fallback = "To confirm") {
  const clean = concise(String(value || ""));
  if (!clean || /^(unknown|new|n\/a|na|null|none|not confirmed|to confirm)$/i.test(clean)) return fallback;
  return clean;
}

function presentVisibleValue(value: any, fallback = "Pending Validation") {
  const clean = concise(String(value || ""));
  if (!clean) return fallback;
  if (/^to confirm$/i.test(clean)) return fallback;
  return clean;
}
function hasText(candidate: CandidateCompareSignal, terms: string[]) {
  return terms.some((term) => candidate.text.includes(term.toLowerCase()));
}

function textCount(candidate: CandidateCompareSignal, terms: string[]) {
  return terms.reduce((count, term) => count + (candidate.text.includes(term.toLowerCase()) ? 1 : 0), 0);
}
function plural(count: number, singular: string, pluralLabel = singular + "s") {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function isZeroLike(value: any) {
  const clean = String(value ?? "").replace(/[,\s]/g, "").trim();
  return value === 0 || clean === "0" || clean === "0.00";
}

function numericSalaryText(value: any) {
  const text = concise(String(value || ""));
  const amount = Number(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return text;
  return Math.round(amount).toLocaleString("en-US");
}

function hasSalaryValue(value: any) {
  return Boolean(value) && !isZeroLike(value) && Number(String(value).replace(/[^0-9.]/g, "")) > 0;
}

function yearsValue(candidate: CandidateCompareSignal) {
  const years = rawNumber(candidate, ["sap_years", "years", "experience_years", "total_years", "years_experience"]);
  if (years) return years + "+ years";
  const match = candidate.text.match(/(\d{1,2})\+?\s*(?:years|yrs)/i);
  return match ? match[1] + "+ years" : "To confirm";
}

function moduleYearsValue(candidate: CandidateCompareSignal) {
  const years = rawNumber(candidate, ["btp_years", "module_years", "primary_module_years", "sap_btp_years"]);
  if (years) return years + "+ years";
  const direct = candidate.text.match(/(\d{1,2})\+?\s*(?:years|yrs)\s+(?:in|of|with)\s+(?:sap\s+)?([a-z0-9/ ]{2,24})/i);
  if (!direct) return "To confirm";
  const module = normalizeModule(candidate.module);
  const phrase = normalizeModule(direct[2]);
  return module && phrase.includes(module) ? direct[1] + "+ years" : "To confirm";
}

function previousEmployer(candidate: CandidateCompareSignal) {
  const direct = displayValue(rawValue(candidate, ["previous_company", "previousEmployer", "last_company", "prior_company"]), "");
  if (direct) return direct;
  const firms = ["Accenture", "Deloitte", "EY", "PwC", "KPMG", "IBM", "Capgemini", "NTT DATA", "Infosys", "TCS", "DXC", "Fujitsu", "Hitachi", "SAP"];
  const current = candidate.company.toLowerCase();
  return firms.find((firm) => candidate.text.includes(firm.toLowerCase()) && !current.includes(firm.toLowerCase())) || "To confirm";
}

function shortlistSearchTitle(activeModule: string) {
  return activeModule ? `SAP ${normalizeModule(activeModule)} Search` : "Current Search";
}

function readCompareShortlist(): ShortlistWorkflowItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPARE_SHORTLIST_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCompareShortlist(items: ShortlistWorkflowItem[]) {
  window.localStorage.setItem(COMPARE_SHORTLIST_KEY, JSON.stringify(items));
}

function persistLastCompareUrl() {
  if (typeof window === "undefined") return "";
  const compareUrl = window.location.pathname === "/compare" ? window.location.href : "";
  if (compareUrl) window.sessionStorage.setItem(LAST_COMPARE_URL_KEY, compareUrl);
  return compareUrl;
}

function shortlistItemFromCandidate(candidate: CandidateCompareSignal, activeModule: string, searchSessionId: string, rank: number, aiRecommended: boolean): ShortlistWorkflowItem {
  return {
    id: `${searchSessionId || "compare"}-${candidate.id}`,
    candidateId: candidate.id,
    name: candidateDisplayName(candidate),
    title: candidate.title,
    module: activeModule || candidate.module,
    location: candidate.location,
    company: candidate.company,
    score: candidate.score,
    stage: "Shortlisted",
    sourceSearchId: searchSessionId || "current-search",
    sourceSearchTitle: shortlistSearchTitle(activeModule),
    compareUrl: persistLastCompareUrl(),
    addedAt: new Date().toISOString(),
    status: "Shortlisted",
    rank,
    source: "Compare",
    aiRecommended,
    visibility: { internalRecruiter: true, client: false, admin: true },
  };
}

function recommendationStatus(index: number) {
  if (index === 0) return "#1 Submit First";
  if (index === 1) return "#2 Alternative Candidate";
  if (index === 2) return "#3 Secondary Pipeline";
  return `#${index + 1} Hold`;
}

function countValue(candidate: CandidateCompareSignal, keys: string[], terms: string[], label: string, textFallback = "To confirm") {
  const count = rawNumber(candidate, keys);
  if (count) return plural(count, label);
  return hasText(candidate, terms) ? textFallback : "To confirm";
}

function implementationCount(candidate: CandidateCompareSignal) {
  return rawNumber(candidate, ["implementation_project_count", "implementationProjects", "implementation_projects", "implementation_count", "implementations"]);
}

function greenfieldCount(candidate: CandidateCompareSignal) {
  return rawNumber(candidate, ["greenfield_count", "greenfieldProjects", "greenfield_projects"]);
}

function s4hanaCount(candidate: CandidateCompareSignal) {
  return rawNumber(candidate, ["s4hana_project_count", "s4_implementation_count", "s4hanaProjects", "s4hana_projects", "s4_count", "s4hana_count"]);
}

function s4hanaValue(candidate: CandidateCompareSignal) {
  return countValue(candidate, ["s4hana_project_count", "s4_implementation_count", "s4hanaProjects", "s4hana_projects", "s4_count", "s4hana_count"], ["s/4", "s4hana", "s4 hana", "s/4hana"], "S/4HANA project", "S/4HANA delivery");
}

function eccValue(candidate: CandidateCompareSignal) {
  const years = rawNumber(candidate, ["ecc_years", "sap_ecc_years"]);
  if (years) return `${years} years ECC`;
  const implementations = rawNumber(candidate, ["ecc_implementation_count", "eccImplementations", "ecc_implementations"]);
  if (implementations) return plural(implementations, "ECC implementation");
  const projects = rawNumber(candidate, ["ecc_project_count", "eccProjects", "ecc_projects"]);
  if (projects) return plural(projects, "ECC project");
  return "To confirm";
}

function salaryValue(candidate: CandidateCompareSignal, keys: string[]) {
  const value = rawValue(candidate, keys);
  if (!hasSalaryValue(value)) return "Not disclosed";
  const currency = displayValue(rawValue(candidate, ["salary_currency", "current_salary_currency", "expected_salary_currency", "package_currency", "currency"]), "");
  const text = displayValue(value, "Not disclosed");
  if (text === "Not disclosed" || isZeroLike(text)) return "Not disclosed";
  const amount = numericSalaryText(text);
  return currency && !amount.toUpperCase().includes(currency.toUpperCase()) ? `${currency} ${amount}` : amount;
}

function salaryFit(candidate: CandidateCompareSignal) {
  const expected = rawValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage"]);
  const budget = rawValue(candidate, ["client_budget", "clientBudget", "budget", "salary_budget", "max_budget"]);
  if (!hasSalaryValue(expected) || !hasSalaryValue(budget)) return "";
  const expectedNumber = Number(String(expected).replace(/[^0-9.]/g, ""));
  const budgetNumber = Number(String(budget).replace(/[^0-9.]/g, ""));
  return expectedNumber <= budgetNumber ? "Within budget" : "Above budget";
}

function availabilityValue(candidate: CandidateCompareSignal) {
  return displayValue(rawValue(candidate, ["availability", "available_from", "openStatus", "open_status", "availability_status"]), "To confirm");
}

function noticeValue(candidate: CandidateCompareSignal) {
  return displayValue(rawValue(candidate, ["notice_period", "noticePeriod", "notice", "available_notice"]), "To confirm");
}

function workRightsValue(candidate: CandidateCompareSignal) {
  const value = displayValue(rawValue(candidate, ["work_authorization", "workAuthorization", "visa_status", "visa", "work_rights"]), "To confirm");
  return /^(new|unknown|n\/a|na)$/i.test(value) ? "To confirm" : value;
}

function travelValue(candidate: CandidateCompareSignal) {
  return displayValue(rawValue(candidate, ["travel_readiness", "travel", "willing_to_travel"]), "To confirm");
}

function cleanFactual(value: any) {
  const direct = displayValue(value, "");
  return /^(strong evidence|some evidence|not evident)$/i.test(direct) ? "" : direct;
}

function termFact(candidate: CandidateCompareSignal, facts: Array<{ label: string; terms: string[] }>) {
  return facts.find((fact) => hasText(candidate, fact.terms))?.label || "";
}

function architectureRole(candidate: CandidateCompareSignal) {
  const direct = cleanFactual(rawValue(candidate, ["architecture_role", "architecture_ownership", "solution_ownership", "architecture_scope"]));
  if (direct) return direct;
  return termFact(candidate, [
    { label: "Enterprise Architect", terms: ["enterprise architect"] },
    { label: "Solution Architect", terms: ["solution architect", "solution architecture"] },
    { label: "Technical Architect", terms: ["technical architect"] },
    { label: "Integration Architect", terms: ["integration architect"] },
    { label: "Lead Consultant", terms: ["lead consultant"] },
  ]) || "To confirm";
}

function clientFacingRole(candidate: CandidateCompareSignal) {
  const direct = cleanFactual(rawValue(candidate, ["client_facing", "stakeholder_exposure", "client_exposure", "workshop_role"]));
  if (direct) return direct;
  return termFact(candidate, [
    { label: "Workshop Lead", terms: ["workshop lead", "led workshop", "workshops"] },
    { label: "Solution Design", terms: ["solution design"] },
    { label: "Pre-sales", terms: ["pre-sales", "presales"] },
    { label: "Business Process Workshops", terms: ["business process workshop"] },
    { label: "Steering Committee", terms: ["steering committee"] },
    { label: "Key User Training", terms: ["key user training", "user training"] },
    { label: "Customer Presentation", terms: ["customer presentation", "client presentation"] },
  ]) || "To confirm";
}

function teamResponsibility(candidate: CandidateCompareSignal) {
  const direct = cleanFactual(rawValue(candidate, ["team_leadership", "leadership", "team_size", "team_responsibility"]));
  if (direct) return direct;
  const teamSize = rawNumber(candidate, ["team_size", "managed_team_size", "consultants_managed"]);
  if (teamSize) return `Managed ${teamSize} consultants`;
  return termFact(candidate, [
    { label: "Delivery Lead", terms: ["delivery lead"] },
    { label: "Project Lead", terms: ["project lead", "project manager"] },
    { label: "Module Lead", terms: ["module lead"] },
    { label: "Managed Finance stream", terms: ["finance stream"] },
    { label: "Workstream Lead", terms: ["workstream lead"] },
  ]) || "To confirm";
}

function migrationValue(candidate: CandidateCompareSignal) {
  const direct = cleanFactual(rawValue(candidate, ["migration_scope", "migration_experience"]));
  if (direct) return direct;
  return termFact(candidate, [
    { label: "Finance Data Migration", terms: ["finance data migration", "fi data migration"] },
    { label: "Brownfield Data Conversion", terms: ["brownfield data conversion", "brownfield conversion"] },
    { label: "SAP Data Migration", terms: ["sap data migration", "data migration"] },
    { label: "Technical Migration", terms: ["technical migration", "system conversion"] },
  ]) || "To confirm";
}

function currentStatus(candidate: CandidateCompareSignal) {
  const value = displayValue(rawValue(candidate, ["current_status", "recruiter_status", "pipeline_status", "status", "availability_status", "openStatus", "open_status"]), "Warm");
  const normalized = value.toLowerCase();
  if (/available|immediate|open/.test(normalized)) return "Available";
  if (/screen/.test(normalized)) return "Screening";
  if (/interview/.test(normalized)) return "Interviewing";
  if (/submit/.test(normalized)) return "Submitted";
  if (/offer/.test(normalized)) return "Offer";
  if (/placed|hired/.test(normalized)) return "Placed";
  if (/unavailable|not available|closed/.test(normalized)) return "Unavailable";
  return ["Available", "Screening", "Interviewing", "Submitted", "Offer", "Placed", "Unavailable", "Warm"].includes(value) ? value : "Warm";
}

function sentenceLimit(value: string, maxWords = 15) {
  const words = concise(value).replace(/\.$/, "").split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.join(" ") + ".";
}

function topCount(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[], getter: (candidate: CandidateCompareSignal) => number) {
  const value = getter(candidate);
  if (!value) return false;
  const values = ranked.map(getter).sort((a, b) => b - a);
  return value === values[0] && value > (values[1] || 0);
}

function sapYearsDisplay(candidate: CandidateCompareSignal) {
  const years = yearsValue(candidate);
  if (/to confirm|pending|unknown/i.test(years)) return "SAP years pending";
  const number = (years.match(/\d+/) || [""])[0];
  return number ? `${number}+ SAP years` : `${years} SAP years`;
}

function candidateCountry(candidate: CandidateCompareSignal) {
  const location = displayValue(candidate.location, "Location pending");
  return location.split(/[,|/]/)[0]?.trim() || location;
}

function slateSubtitle(candidate: CandidateCompareSignal) {
  return [displayValue(candidate.title, "Role pending"), sapYearsDisplay(candidate), candidateCountry(candidate)].filter(Boolean).join(" · ");
}

function drawerHeaderMeta(candidate: CandidateCompareSignal) {
  return [sapYearsDisplay(candidate), candidateCountry(candidate), displaySapModule(candidate)].filter(Boolean).join(" · ");
}

function companyText(candidate: CandidateCompareSignal) {
  return [candidate.company, candidate.title, candidate.text, rawList(candidate, ["industries", "employers", "workExperience", "work_experience", "employment_history", "experience", "experience_type", "background", "company_type"])].join(" ").toLowerCase();
}

function hasConsultingSignal(text: string) {
  return /consult|consulting|advisory|implementation partner|system integrator|\bsi\b|outsourc|sap partner|it services|accenture|deloitte|pricewaterhousecoopers|pwc|ernst\s*&?\s*young|\bey\b|kpmg|capgemini|ibm|infosys|tcs|tata consultancy|ntt|ntt data|dxc|fujitsu|atos|cognizant|wipro|hcl|abeam|\bcbs\b|cgi|hitachi|sopra steria|tech mahindra|epam|\bfpt\b|tdi apj/.test(text);
}

function hasInHouseSignal(text: string) {
  return /in-house|in house|end user|client side|enterprise|corporate|manufacturer|retail|bank|insurance|pharma|oil|gas|telecom|government|ministry|public sector|authority|municipal|federal|state-owned|petronas|telekom malaysia|dksh|basf|shell|\bbp\b|unilever|nestl[eé]|bosch|panasonic|samsung|dhl|maersk|toyota|intel|micron|western digital/.test(text);
}

function backgroundExperience(candidate: CandidateCompareSignal) {
  return buildCanonicalCandidateProfile(candidate.raw || candidate).backgroundExperience;
}

function isInvalidCompanyName(value: string, candidate?: CandidateCompareSignal) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  if (["current location", "location", "age", "availability", "notice period", "needs validation", "to confirm", "pending validation", "unknown", "unknown needs validation", "not ready", "sap sd", "malaysia", "protected", "not classified"].includes(normalized)) return true;
  if (/\b(age|current location|availability|notice period|job title|current role|role pending|sap consultant|consultant|name pending|candidate #|not classified)\b/i.test(normalized)) return true;
  if (candidate && normalized === getCandidateDisplayName(candidate, "").toLowerCase()) return true;
  return normalized.length > 80;
}
function cleanCompanyName(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").replace(/[,.;:]+$/g, "").trim();
}

function workExperienceRecords(candidate: CandidateCompareSignal): AnyRecord[] {
  const raw = candidate.raw || {};
  const sources = [raw.currentExperience, raw.current_experience, raw.latestExperience, raw.latest_experience, raw.workExperience, raw.work_experience, raw.experience, raw.experiences, raw.employmentHistory, raw.employment_history, raw.positions, raw.jobs, raw.parsedResume?.experience, raw.parsed_resume?.experience, raw.parsedProfile?.experience, raw.parsedProfile?.workExperience, raw.profile?.experience, raw.resume?.experience];
  return sources.flatMap((source) => Array.isArray(source) ? source : source && typeof source === "object" ? [source] : []).filter((item) => item && typeof item === "object") as AnyRecord[];
}

function experienceCompanyName(record: AnyRecord) {
  return cleanCompanyName(record.company || record.companyName || record.company_name || record.employer || record.organization || record.organisation || record.client || record.account);
}

function isCurrentExperience(record: AnyRecord) {
  const end = String(record.endDate || record.end_date || record.to || record.until || record.period || "").toLowerCase();
  return !end || /present|current|now|ongoing|till date|to date/.test(end);
}

function latestExperienceCompany(candidate: CandidateCompareSignal) {
  const records = workExperienceRecords(candidate);
  const current = records.find((record) => isCurrentExperience(record) && !isInvalidCompanyName(experienceCompanyName(record), candidate));
  const fallback = records.find((record) => !isInvalidCompanyName(experienceCompanyName(record), candidate));
  return experienceCompanyName(current || fallback || {});
}

function companyFromResumeText(candidate: CandidateCompareSignal) {
  const raw = candidate.raw || {};
  const text = String(raw.resumeText || raw.resume_text || raw.cvText || raw.cv_text || raw.parsed_resume || candidate.text || "");
  const knownCompany = text.match(/\b(Capgemini Services|Wipro Technologies|Telekom Malaysia Berhad|Orisoft Technology Sdn Bhd|Petronas Digital|Petronas Trading|Petronas|Accenture|Deloitte|PwC|KPMG|EY|IBM Consulting|NTT DATA|TCS|Infosys|HCLTech|DXC|Fujitsu|Hitachi|ABeam|TDI APJ|BASF|DKSH|Shell|BP|Nestle|Unilever|Toyota|Malaysia Airports)\b/i)?.[1];
  if (knownCompany && !isInvalidCompanyName(knownCompany, candidate)) return cleanCompanyName(knownCompany);
  const patterns = [
    /(?:current|present|latest)\s+(?:company|employer|organisation|organization)\s*[:\-]\s*([^\n,;]+)/i,
    /(?:company|employer|organisation|organization)\s*[:\-]\s*([^\n,;]+)/i,
    /(?:at|with)\s+([A-Z][A-Za-z&. ]{2,60})\s+(?:as|from|since|present|current)/,
    /(?:present|current|ongoing)[^\n]{0,80}\b(?:at|with)\s+([A-Z][A-Za-z&. ]{2,60})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanCompanyName(match?.[1] || "");
    if (value && !isInvalidCompanyName(value, candidate)) return value;
  }
  return "";
}
function getCurrentCompany(candidate: CandidateCompareSignal) {
  return buildCanonicalCandidateProfile(candidate.raw || candidate).currentCompany;
}

function getCompanyType(_companyName: string, candidate?: CandidateCompareSignal) {
  if (!candidate) return "Not disclosed";
  return buildCanonicalCandidateProfile(candidate.raw || candidate).companyType;
}

function resolveCurrentCompany(candidate: CandidateCompareSignal) {
  const companyName = getCurrentCompany(candidate);
  const companyType = companyName === "Not disclosed" ? "Not disclosed" : getCompanyType(companyName, candidate);
  return { companyName, companyType, backgroundExperience: backgroundExperience(candidate) };
}

function currentCompanyName(candidate: CandidateCompareSignal) {
  return getCurrentCompany(candidate);
}

function normalizeCompanyClassification(value: string) {
  return getCompanyType(value);
}

function currentCompanyClassification(candidate: CandidateCompareSignal) {
  return resolveCurrentCompany(candidate).companyType;
}

function currentCompanyDisplayValue(candidate: CandidateCompareSignal) {
  return resolveCurrentCompany(candidate).companyName;
}

function currentCompanyComparisonValue(candidate: CandidateCompareSignal) {
  return currentCompanyDisplayValue(candidate);
}

function currentEmployerTypeValue(candidate: CandidateCompareSignal, _compact = false) {
  return currentCompanyDisplayValue(candidate);
}
function architectureLevel(candidate: CandidateCompareSignal) {
  const role = architectureRole(candidate).toLowerCase();
  if (/solution architect|enterprise architect|technical architect|integration architect|architect/i.test(role)) return "Solution Architect";
  if (/lead consultant|principal consultant/.test(role)) return "Lead Consultant";
  if (/functional lead|module lead|workstream lead/.test(role)) return "Functional Lead";
  if (/senior consultant/.test(role)) return "Senior Consultant";
  return "Pending Validation";
}

function keyStrength(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[] = [candidate]) {
  const module = displaySapModule(candidate);
  if (architectureRole(candidate) !== "To confirm" && /architect/i.test(architectureRole(candidate))) return sentenceLimit(`${architectureRole(candidate)} for enterprise ${module} transformations`);
  if (topCount(candidate, ranked, s4hanaCount)) return sentenceLimit(`Extensive ${module} S/4HANA implementation experience`);
  if (topCount(candidate, ranked, greenfieldCount)) return sentenceLimit(`Greenfield ${module} consulting experience`);
  if (topCount(candidate, ranked, implementationCount)) return sentenceLimit(`Led large-scale ${module} implementation programmes`);
  if (clientFacingRole(candidate) !== "To confirm") return sentenceLimit(`Client-facing ${module} delivery across enterprise programmes`);
  const years = yearsValue(candidate);
  if (years !== "To confirm") return sentenceLimit(`${years} SAP delivery background across enterprise programmes`);
  return sentenceLimit(`${module} delivery background ready for recruiter screening`);
}

function riskOptions(candidate: CandidateCompareSignal) {
  const options: Array<{ key: string; risk: string; validation: string }> = [];
  if (salaryValue(candidate, ["current_salary", "currentSalary", "salary", "monthly_salary"]) === "Not disclosed") options.push({ key: "salary", risk: "Compensation requires confirmation", validation: "Confirm current and expected package." });
  if (availabilityValue(candidate) === "To confirm") options.push({ key: "availability", risk: "Availability requires confirmation", validation: "Confirm availability and earliest start date." });
  if (noticeValue(candidate) === "To confirm") options.push({ key: "notice", risk: "Notice period requires confirmation", validation: "Confirm notice period and buyout options." });
  const implementationMissing = countValue(candidate, ["implementation_project_count", "implementationProjects", "implementation_projects", "implementation_count", "implementations"], ["implementation", "greenfield", "rollout", "go-live", "go live"], "implementation project", "Implementation delivery") === "To confirm";
  if (implementationMissing) options.push({ key: "implementation", risk: normalizeModule(candidate.module) === "BTP" ? "SAP BTP implementation ownership requires validation" : "Implementation ownership requires validation", validation: normalizeModule(candidate.module) === "BTP" ? "Confirm BTP implementation scope and ownership." : "Confirm personal implementation ownership." });
  if (clientFacingRole(candidate) === "To confirm") options.push({ key: "client", risk: "Client-facing responsibility requires verification", validation: "Confirm workshop and client-facing responsibilities." });
  if (countValue(candidate, ["greenfield_count", "greenfieldProjects", "greenfield_projects"], ["greenfield"], "Greenfield project", "Greenfield delivery") === "To confirm") options.push({ key: "greenfield", risk: "Greenfield ownership requires validation", validation: "Confirm Greenfield project scope and responsibilities." });
  if (/confidential/i.test(candidate.company)) options.push({ key: "employer", risk: "Current employment requires verification", validation: "Confirm current employer and role context." });
  if (normalizeModule(candidate.module) === "UNKNOWN") options.push({ key: "module", risk: "SAP module depth requires confirmation", validation: "Confirm primary SAP module and delivery depth." });
  return options.length ? options : [
    { key: "ownership", risk: "Delivery ownership still needs final confirmation", validation: "Confirm accountable delivery phases and governance role." },
    { key: "package", risk: "Package flexibility needs confirmation", validation: "Confirm compensation flexibility before submission." },
    { key: "stakeholder", risk: "Stakeholder exposure needs confirmation", validation: "Confirm business stakeholder and workshop scope." },
  ];
}

const FALLBACK_RISKS = [
  "Compensation requires confirmation",
  "Availability requires confirmation",
  "Client-facing responsibility requires verification",
  "Greenfield ownership requires validation",
  "SAP BTP implementation ownership requires validation",
  "Implementation ownership requires validation",
  "Notice period requires confirmation",
  "Current employment requires verification",
  "SAP module depth requires confirmation",
  "Delivery ownership still needs final confirmation",
];

function riskForIndex(ranked: CandidateCompareSignal[], index: number) {
  const used = new Set<string>();
  for (let i = 0; i < index; i += 1) {
    const prior = riskOptions(ranked[i]).find((item) => !used.has(item.risk)) || FALLBACK_RISKS.find((risk) => !used.has(risk));
    if (prior) used.add(typeof prior === "string" ? prior : prior.risk);
  }
  const option = riskOptions(ranked[index]).find((item) => !used.has(item.risk));
  return option?.risk || FALLBACK_RISKS.find((risk) => !used.has(risk)) || "Submission risk requires recruiter review";
}

function mainPrimaryCommercialRisk(candidate: CandidateCompareSignal) {
  return riskOptions(candidate)[0].risk;
}

function uniquePrimaryCommercialRisk(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[], index: number) {
  return ranked[index]?.id === candidate.id ? riskForIndex(ranked, index) : mainPrimaryCommercialRisk(candidate);
}

function validationFromPrimaryCommercialRisk(risk: string) {
  if (/salary|compensation|package/i.test(risk)) return "Salary";
  if (/availability|start/i.test(risk)) return "Availability";
  if (/notice/i.test(risk)) return "Notice";
  if (/employer|employment/i.test(risk)) return "Employer";
  if (/architecture|design/i.test(risk)) return "Architecture";
  if (/client-facing|workshop|stakeholder/i.test(risk)) return "Client Fit";
  if (/btp implementation|implementation ownership|implementation requires validation|greenfield|delivery ownership/i.test(risk)) return "Delivery";
  return "Employer";
}

function normalizeValidationLabel(label: string) {
  if (/salary|compensation|package/i.test(label)) return "Salary";
  if (/availability|start/i.test(label)) return "Availability";
  if (/notice/i.test(label)) return "Notice";
  if (/current company|current employer|employer|employment/i.test(label)) return "Employer";
  if (/architecture/i.test(label)) return "Architecture";
  if (/contact/i.test(label)) return "Contact";
  if (/implementation|delivery/i.test(label)) return "Delivery";
  if (/client fit|client|stakeholder|workshop/i.test(label)) return "Client Fit";
  if (/none|ready|complete/i.test(label)) return "None";
  return label;
}

function validationLabelsForCandidate(candidate: CandidateCompareSignal | undefined, activeModule = "") {
  if (!candidate) return ["Unknown"];
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const pendingSource = confidence.pending.length ? confidence.pending : candidateCardBlockers(candidate);
  if (!pendingSource.length) return ["None"];
  const labels = pendingSource.map((item) => normalizeValidationLabel(shortValidationLabel(item))).filter(Boolean);
  return Array.from(new Set(labels.length ? labels : ["Employer"])).slice(0, 6);
}

function getVisibleChips(items: string[], limit: number) {
  const cleanItems = Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)));
  const safeLimit = Math.max(0, limit);
  return { visible: cleanItems.slice(0, safeLimit), hidden: cleanItems.slice(safeLimit) };
}

function compactValidationLabels(candidate: CandidateCompareSignal | undefined, activeModule = "") {
  const labels = validationLabelsForCandidate(candidate, activeModule);
  const { visible, hidden } = getVisibleChips(labels, 2);
  return hidden.length ? `${visible.join(", ")} +${hidden.length}` : visible.join(", ");
}

function commercialRiskLabel(candidate: CandidateCompareSignal | undefined, activeModule = "") {
  const labels = validationLabelsForCandidate(candidate, activeModule);
  const first = labels[0] || "Unknown";
  if (first === "None") return "Low / None";
  if (first === "Salary") return "High / Salary";
  if (first === "Availability") return "High / Availability";
  if (first === "Notice") return "High / Notice";
  if (first === "Architecture" || first === "Delivery") return "Medium / Architecture";
  if (first === "Client Fit") return "Medium / Client Fit";
  if (first === "Unknown") return "Unknown";
  return "Medium / Employer";
}

function commercialRiskTone(level: string) {
  if (/high/i.test(level)) return "bg-rose-500/10 text-rose-100 ring-rose-500/25";
  if (/medium/i.test(level)) return "bg-amber-500/10 text-amber-100 ring-amber-500/25";
  if (/low/i.test(level)) return "bg-emerald-500/10 text-emerald-100 ring-emerald-500/25";
  return "bg-slate-500/10 text-slate-200 ring-slate-500/25";
}

function validationChipTone(label: string) {
  if (/salary|availability|notice/i.test(label)) return "bg-amber-500/10 text-amber-100 ring-amber-500/25";
  if (/architecture/i.test(label)) return "bg-indigo-500/10 text-indigo-100 ring-indigo-500/25";
  if (/none/i.test(label)) return "bg-emerald-500/10 text-emerald-100 ring-emerald-500/25";
  return "bg-slate-500/10 text-slate-200 ring-slate-500/25";
}

function RiskBadge({ label }: { label: string }) {
  return <span className={commercialRiskTone(label) + " rounded-full px-2 py-0.5 text-[10px] font-black ring-1"}>{label}</span>;
}

function ChipOverflow({ id, sectionKey, hidden, className }: { id: string; sectionKey: string; hidden: string[]; className: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!hidden.length) return null;
  if (expanded) {
    return <>{hidden.map((chip, chipIndex) => <span key={`${id}-${sectionKey}-hidden-${chip}-${chipIndex}`} title={chip} className={className}>{chip}</span>)}</>;
  }
  return <button key={`${id}-${sectionKey}-overflow`} type="button" title={hidden.join(", ")} onClick={(event) => { event.stopPropagation(); setExpanded(true); }} className={className}>+{hidden.length} more</button>;
}

function ValidationChips({ candidate, activeModule = "", limit = 2 }: { candidate: CandidateCompareSignal; activeModule?: string; limit?: number }) {
  const { visible, hidden } = getVisibleChips(validationLabelsForCandidate(candidate, activeModule), limit);
  const chipClass = "rounded-full px-2 py-1 text-[10px] font-semibold ring-1";
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((label, labelIndex) => <span key={`${candidate.id}-validation-${label}-${labelIndex}`} className={validationChipTone(label) + " " + chipClass}>{label}</span>)}
      <ChipOverflow id={candidate.id} sectionKey="validation" hidden={hidden} className={validationChipTone(hidden[0] || "") + " " + chipClass} />
    </div>
  );
}

function requirementMatchSummary(coverage: ReturnType<typeof jdCoverage>) {
  const total = 11;
  const existingPartial = coverage.requirements.filter((item) => item.state === "Partial Match").length;
  const existingMissing = coverage.requirements.filter((item) => item.state === "Missing").length;
  const missing = coverage.percent >= 90 ? 0 : Math.min(total, Math.round((existingMissing / Math.max(coverage.requirements.length, 1)) * total));
  const partial = coverage.percent >= 100 ? 0 : Math.max(existingPartial ? 1 : 0, missing === 0 ? 1 : 0);
  const matched = Math.max(0, total - partial - missing);
  return { total, matched, partial, missing, text: `${matched} / ${total} Requirements Matched` };
}

function decisionStars(percent: number) {
  const filled = Math.max(1, Math.min(5, Math.round(percent / 20)));
  return "*****".slice(0, filled) + "-----".slice(0, 5 - filled);
}

function primaryReasonNotSelected(candidate: CandidateCompareSignal, recommended: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule = "") {
  if (!recommended || candidate.id === recommended.id) return "Selected candidate";
  const candidateConfidence = submissionConfidence(candidate, activeModule || candidate.module);
  const recommendedConfidence = submissionConfidence(recommended, activeModule || recommended.module);
  if (candidateConfidence.pending.length > recommendedConfidence.pending.length) return "Commercial readiness incomplete";
  if ((architectureScore(recommended) || 0) > (architectureScore(candidate) || 0)) return "Architecture ownership not evidenced";
  if ((implementationCount(recommended) || 0) > (implementationCount(candidate) || 0)) return "Lower implementation ownership";
  if ((s4hanaCount(recommended) || 0) > (s4hanaCount(candidate) || 0) || (ranked.length > 2 && ranked.findIndex((item) => item.id === candidate.id) > 1)) return "Less enterprise delivery scope";
  return "Commercial readiness incomplete";
}

type ReportMeta = { searchId?: string; job?: string; primaryModule?: string };

function reportFooterText(meta: ReportMeta, activeModule: string) {
  const module = meta.primaryModule || (activeModule ? `SAP ${normalizeModule(activeModule)}` : "Primary SAP Module pending");
  return `Search ID: ${meta.searchId || "Current Search"} | Job: ${meta.job || "Current Search"} | Primary SAP Module: ${module} | Generated by Primus AI Recruiter™ | Confidential`;
}

type DecisionMatrixRow = MatrixRow & { alwaysShow?: boolean };

function isEmptyEvidence(value: string) {
  return !concise(value) || /^(unknown|to confirm|not disclosed|location to verify|confidential)$/i.test(concise(value));
}

function factScore(value: string) {
  return isEmptyEvidence(value) ? null : 1;
}

function salaryAlignmentScore(candidate: CandidateCompareSignal) {
  const expected = rawValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage"]);
  const budget = rawValue(candidate, ["client_budget", "clientBudget", "budget", "salary_budget", "max_budget"]);
  if (!hasSalaryValue(expected) || !hasSalaryValue(budget)) return null;
  const expectedNumber = Number(String(expected).replace(/[^0-9.]/g, ""));
  const budgetNumber = Number(String(budget).replace(/[^0-9.]/g, ""));
  return Math.max(0, budgetNumber - expectedNumber);
}

function availabilityScore(candidate: CandidateCompareSignal) {
  const availability = availabilityValue(candidate).toLowerCase();
  const notice = noticeValue(candidate).toLowerCase();
  if (/immediate|available now/.test(availability) || /immediate/.test(notice)) return 90;
  const days = Number((notice.match(/\d+/) || availability.match(/\d+/) || [""])[0]);
  if (Number.isFinite(days) && days > 0) return Math.max(10, 80 - days);
  if (availability !== "to confirm") return 50;
  return null;
}

function winnerThreshold(label: string) {
  if (/SAP Years/i.test(label)) return 6;
  if (/Implementation|Greenfield|S\/4HANA|ECC|AMS/i.test(label)) return 7;
  if (/Availability|Notice|Salary/i.test(label)) return 12;
  return 8;
}

function rowScores(row: DecisionMatrixRow, ranked: CandidateCompareSignal[]) {
  if (!row.score) return [];
  return ranked
    .map((candidate) => ({ candidate, score: row.score!(candidate) }))
    .filter((item): item is { candidate: CandidateCompareSignal; score: number } => item.score !== null && Number.isFinite(item.score));
}

function rowWinners(row: DecisionMatrixRow, ranked: CandidateCompareSignal[]) {
  const scored = rowScores(row, ranked);
  if (!scored.length) return [];
  const ordered = [...scored].sort((a, b) => b.score - a.score);
  const top = ordered[0];
  const second = ordered[1];
  if (!top) return [];
  if (second && top.score - second.score < winnerThreshold(row.label)) return [];
  return [top.candidate];
}

function isWinningCell(row: DecisionMatrixRow, candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[]) {
  if (!WINNER_HIGHLIGHT_ROWS.has(row.label)) return false;
  return rowWinners(row, ranked).some((winner) => winner.id === candidate.id);
}

function talentSearchHref(snapshot: SearchSnapshot) {
  const params = new URLSearchParams();
  const filters = snapshot.filters || {};
  const keyword = String(filters.keyword || filters.q || "").trim();
  const module = String(filters.module || filters.primaryModule || snapshot.primaryModule || "").trim();
  if (keyword) {
    params.set("q", keyword);
    params.set("keyword", keyword);
  }
  if (module) params.set("module", module.startsWith("SAP ") ? module : "SAP " + module);
  return params.toString() ? "/search?" + params.toString() : "/search";
}
function architectureScore(candidate: CandidateCompareSignal) {
  const role = architectureRole(candidate).toLowerCase();
  if (role.includes("enterprise architect")) return 5;
  if (role.includes("solution architect")) return 4;
  if (role.includes("integration architect") || role.includes("technical architect")) return 3;
  if (role.includes("lead consultant")) return 2;
  return factScore(architectureRole(candidate));
}

function clientFacingScore(candidate: CandidateCompareSignal) {
  const value = clientFacingRole(candidate).toLowerCase();
  if (value.includes("steering")) return 5;
  if (value.includes("workshop lead") || value.includes("business process")) return 4;
  if (value.includes("pre-sales") || value.includes("customer presentation")) return 3;
  if (value.includes("solution design") || value.includes("training")) return 2;
  return factScore(clientFacingRole(candidate));
}

function matrixRows(ranked: CandidateCompareSignal[], mode: CompareViewMode = "detailed", maxRows?: number): DecisionMatrixRow[] {
  const implementationValue = (candidate: CandidateCompareSignal) => countValue(candidate, ["implementation_project_count", "implementationProjects", "implementation_projects", "implementation_count", "implementations"], ["implementation", "full cycle", "full-cycle", "go-live", "go live"], "implementation", "Implementation delivery");
  const greenfieldValue = (candidate: CandidateCompareSignal) => countValue(candidate, ["greenfield_count", "greenfieldProjects", "greenfield_projects"], ["greenfield"], "Greenfield project", "Greenfield delivery");
  const amsValue = (candidate: CandidateCompareSignal) => countValue(candidate, ["ams_count", "support_project_count", "supportProjects"], ["ams", "support", "application management"], "AMS/support project", "AMS support");
  const rows: DecisionMatrixRow[] = [
    { label: "Role", value: (candidate) => displayValue(candidate.title), alwaysShow: true },
    { label: "Employer", value: (candidate) => displayValue(candidate.company, "Confidential") },
    { label: "Country", value: (candidate) => displayValue(candidate.location) },
    { label: "SAP Years", value: (candidate) => yearsValue(candidate), score: (candidate) => rawNumber(candidate, ["sap_years", "years", "experience_years", "total_years", "years_experience"]) || null },
    { label: "Implementations", value: implementationValue, score: (candidate) => implementationCount(candidate) || factScore(implementationValue(candidate)) },
    { label: "Greenfield", value: greenfieldValue, score: (candidate) => greenfieldCount(candidate) || factScore(greenfieldValue(candidate)) },
    { label: "S/4HANA", value: (candidate) => s4hanaValue(candidate), score: (candidate) => s4hanaCount(candidate) || factScore(s4hanaValue(candidate)) },
    { label: "ECC", value: (candidate) => eccValue(candidate), score: (candidate) => rawNumber(candidate, ["ecc_project_count", "eccProjects", "ecc_projects", "ecc_implementation_count", "eccImplementations", "ecc_implementations", "ecc_years", "sap_ecc_years"]) || null },
    { label: "Migration", value: (candidate) => migrationValue(candidate) },
    { label: "AMS", value: amsValue, score: (candidate) => rawNumber(candidate, ["ams_count", "support_project_count", "supportProjects"]) || factScore(amsValue(candidate)) },
    { label: "Architecture Level", value: (candidate) => architectureLevel(candidate), score: (candidate) => architectureScore(candidate) },
    { label: "Client-facing", value: (candidate) => clientFacingRole(candidate), score: (candidate) => clientFacingScore(candidate) },
    { label: "Leadership", value: (candidate) => teamResponsibility(candidate), score: (candidate) => rawNumber(candidate, ["team_size", "managed_team_size", "consultants_managed"]) || factScore(teamResponsibility(candidate)) },
    { label: "Salary", value: (candidate) => salaryValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage"]), score: (candidate) => salaryAlignmentScore(candidate) },
    { label: "Availability", value: (candidate) => availabilityValue(candidate), score: (candidate) => availabilityScore(candidate) },
    { label: "Notice Period", value: (candidate) => noticeValue(candidate), score: (candidate) => availabilityScore(candidate) },
    { label: "Key Strength", value: (candidate, _index, selected) => keyStrength(candidate, selected), alwaysShow: true },
    { label: "Commercial Risk", value: (candidate, index, selected) => uniquePrimaryCommercialRisk(candidate, selected, index), alwaysShow: true },
    { label: "Required Validation", value: (candidate, index, selected) => validationFromPrimaryCommercialRisk(uniquePrimaryCommercialRisk(candidate, selected, index)), alwaysShow: true },
  ];
  const visible = rows.filter((row) => {
    if (mode === "summary" && !SUMMARY_ROW_LABELS.has(row.label)) return false;
    if (row.alwaysShow && mode === "detailed") return true;
    const values = ranked.map((candidate, index) => concise(row.value(candidate, index, ranked)));
    const unavailable = values.filter(isEmptyEvidence).length;
    if (values.length && unavailable / values.length > 0.7) return false;
    const usefulValues = values.filter((value) => !isEmptyEvidence(value)).map((value) => value.toLowerCase());
    return new Set(usefulValues).size > 1;
  });
  const priority = ["Key Strength", "SAP Years", "Implementations", "S/4HANA", "Architecture Level", "Client-facing", "Leadership", "Commercial Risk", "Required Validation"];
  return visible.sort((a, b) => { const ai = priority.indexOf(a.label); const bi = priority.indexOf(b.label); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi); }).slice(0, maxRows ?? (mode === "summary" ? 7 : 9));
}
function selectInitialCandidates(searchPool: CandidateCompareSignal[], candidateId: string, urlIds: string[]) {
  const explicit = urlIds.filter(Boolean).slice(0, MAX_SELECTED);
  if (explicit.length >= 2) return explicit;
  const current = searchPool.find((candidate) => candidate.id === candidateId);
  const rest = searchPool.filter((candidate) => candidate.id !== candidateId).slice(0, current ? MAX_SELECTED - 1 : MAX_SELECTED);
  return current ? [current.id, ...rest.map((candidate) => candidate.id)] : searchPool.slice(0, MAX_SELECTED).map((candidate) => candidate.id);
}

function decisionTag(candidate: CandidateCompareSignal, selectedNow: boolean, ranked: CandidateCompareSignal[]) {
  if (!selectedNow) return "Selected";
  const index = ranked.findIndex((item) => item.id === candidate.id);
  if (index === 0) return "Submit First";
  if (index === 1) return "Alternative Candidate";
  if (index === 2) return "Secondary Pipeline";
  return "Hold";
}

function slateBlockers(candidate: CandidateCompareSignal) {
  const status = currentStatus(candidate);
  const statusBlockers: string[] = [];
  if (status === "Submitted") statusBlockers.push("Submitted");
  if (status === "Interviewing") statusBlockers.push("Interview in Progress");
  if (status === "Offer") statusBlockers.push("Offer Stage");
  const blockers = dealBreakerOptions(candidate).map((item) => item
    .replace("Salary confirmation pending", "Salary")
    .replace("Availability pending", "Availability")
    .replace("Notice period unknown", "Notice Period")
    .replace("Current employer verification", "Current Employer Verification")
    .replace("Client-facing delivery not verified", "Client-facing Check")
    .replace("Architecture ownership pending", "Architecture pending")
  );
  return [...statusBlockers, ...blockers].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 2);
}

function slateBadge(candidate: CandidateCompareSignal, selectedNow: boolean, disabled: boolean, ranked: CandidateCompareSignal[], shortlistedIds: string[] = []) {
  if (shortlistedIds.includes(candidate.id)) return "Shortlisted";
  if (selectedNow) return decisionTag(candidate, true, ranked);
  return disabled ? "Replace Candidate" : "Add to Compare";
}

function currentPackageValue(candidate: CandidateCompareSignal) {
  return salaryValue(candidate, ["current_salary", "currentSalary", "salary", "monthly_salary"]);
}

function expectedPackageValue(candidate: CandidateCompareSignal) {
  return salaryValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "expectedPackage"]);
}

function selectedSlateFacts(candidate: CandidateCompareSignal, expanded = false) {
  const confidence = submissionConfidence(candidate);
  const blockers = slateBlockers(candidate);
  const completed = confidence.completed.length;
  const total = Math.max(completed + confidence.pending.length, 1);
  const primary = confidence.primaryBlocker || blockers[0] || "Ready for Client Submission";
  const validationItems = confidence.pending.slice(0, 3).filter((item) => item !== primary).join(", ");
  const collapsed = [
    { label: "Status", value: currentStatus(candidate), tone: "slate" },
    { label: "", value: candidate.score + "%", tone: candidate.score >= 85 ? "emerald" : candidate.score >= 72 ? "cyan" : candidate.score >= 58 ? "amber" : "rose" },
    { label: "Submission Readiness", value: confidence.score + "% " + commercialReadinessLabel(confidence, true), tone: confidence.score >= 85 ? "emerald" : confidence.score >= 70 ? "cyan" : "amber" },
    { label: "Primary Validation", value: primary, tone: blockers.length || confidence.pending.length ? "amber" : "emerald" },
  ];
  if (!expanded) return collapsed;
  return [
    ...collapsed,
    { label: "Completed Validation", value: completed + "/" + total + " confirmed", tone: completed ? "emerald" : "slate" },
    ...(validationItems ? [{ label: "Remaining Validation", value: validationItems, tone: "amber" }] : []),
    { label: "Current Package", value: currentPackageValue(candidate), tone: currentPackageValue(candidate) === "Not disclosed" ? "amber" : "slate" },
    { label: "Availability", value: availabilityValue(candidate), tone: availabilityValue(candidate) === "To confirm" ? "amber" : "slate" },
    { label: "Notice Period", value: noticeValue(candidate), tone: noticeValue(candidate) === "To confirm" ? "amber" : "slate" },
  ];
}
function slateSignalChips(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[]) {
  return [
    normalizeModule(candidate.module) || "SAP",
    s4hanaCount(candidate) || hasText(candidate, ["s/4", "s4hana", "s4 hana"]) ? "S4" : "S4 pending",
    architectureRole(candidate) !== "To confirm" ? "Architecture" : "Architecture pending",
    implementationCount(candidate) || hasText(candidate, ["implementation", "go-live", "go live"]) ? "Delivery" : "Delivery pending",
  ].filter(Boolean).slice(0, 4);
}

function SlateDecisionStrip({ candidate, ranked }: { candidate: CandidateCompareSignal; ranked: CandidateCompareSignal[] }) {
  const confidence = submissionConfidence(candidate);
  const chipItems = [
    ...slateSignalChips(candidate, ranked).map((label) => ({ label, tone: "emerald" })),
    ...validationLabelsForCandidate(candidate).filter((label) => label !== "None").map((label) => ({ label, tone: "validation" })),
  ];
  const { visible, hidden } = getVisibleChips(chipItems.map((item) => item.label), 6);
  const hiddenLabels = hidden;
  return (
    <div className="mt-1 grid gap-1">
      <div className="flex items-end justify-between gap-2">
        <div className="text-[18px] font-black leading-none text-white">{candidate.score}%</div>
      </div>
      <div className="flex max-w-full flex-wrap gap-1 overflow-hidden">
        {visible.map((item, itemIndex) => {
          const source = chipItems.find((chip) => chip.label === item);
          const toneClass = source?.tone === "validation" ? validationChipTone(item) : "bg-emerald-500/10 text-emerald-100 ring-emerald-500/20";
          return <span key={`${candidate.id}-slate-chip-${item}-${itemIndex}`} title={item} className={toneClass + " max-w-full truncate rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold leading-4 ring-1"}>{item}</span>;
        })}
        <ChipOverflow id={candidate.id} sectionKey="slate-chip" hidden={hiddenLabels} className="max-w-full truncate rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold leading-4 text-slate-200 ring-1 ring-slate-500/25" />
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${confidence.score}%` }} /></div>
    </div>
  );
}
function slateExpandedCommercialRows(candidate: CandidateCompareSignal) {
  const relocation = displayValue(rawValue(candidate, ["relocation", "relocate", "relocation_status", "willing_to_relocate", "relocation_readiness"]), "To confirm");
  const rows = [
    { label: "Current Salary", value: currentPackageValue(candidate), showIfPending: true },
    { label: "Expected Salary", value: expectedPackageValue(candidate), showIfPending: true },
    { label: "Availability", value: availabilityValue(candidate), showIfPending: true },
    { label: "Notice Period", value: noticeValue(candidate), showIfPending: true },
    { label: "Location", value: candidate.location || "To confirm", showIfPending: false },
    { label: "Relocation", value: relocation, showIfPending: false },
    { label: "Work Rights", value: workRightsValue(candidate), showIfPending: false },
  ];
  return rows.filter((row) => row.showIfPending || !/to confirm|not disclosed|pending validation/i.test(row.value));
}

function slatePositionReason(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[], index: number) {
  const strength = keyStrength(candidate, ranked);
  const risk = uniquePrimaryCommercialRisk(candidate, ranked, index);
  if (index === 0) return `${strength}. Commercial position still needs ${validationChipLabels(candidate).slice(0, 2).join(" and ").toLowerCase()} confirmation before release.`;
  if (index === 1) return `Backup option because ${strength.toLowerCase()}. Use if the first submission does not close commercially.`;
  if (index === 2) return `Secondary pipeline profile with relevant ${displaySapModule(candidate)} evidence. Validate ${risk.toLowerCase()} before positioning.`;
  return `Hold for recruiter review. ${risk} should be resolved before this profile moves forward.`;
}

function SlateExpandedDetails({ candidate, ranked }: { candidate: CandidateCompareSignal; ranked: CandidateCompareSignal[] }) {
  const index = Math.max(0, ranked.findIndex((item) => item.id === candidate.id));
  const confidence = submissionConfidence(candidate, ranked[index]?.module || candidate.module);
  const rows = slateExpandedCommercialRows(candidate);
  const backup = ranked.find((item) => item.id !== candidate.id);
  return (
    <div className="mt-2 rounded-xl bg-[#05070A] p-2.5 ring-1 ring-cyan-500/20">
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map((row, rowIndex) => {
          const pending = /to confirm|not disclosed|needs confirmation|pending validation/i.test(row.value);
          return (
            <div key={`${candidate.id}-slate-expanded-${row.label}-${rowIndex}`} className="rounded-lg bg-[#0B1118] px-2 py-1.5 ring-1 ring-slate-800/60">
              <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">{row.label}</div>
              <div className={(pending ? "text-amber-100" : "text-slate-200") + " mt-0.5 line-clamp-2 text-[10px] font-semibold leading-4"}>{row.value}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 rounded-lg bg-cyan-500/5 px-2.5 py-2 text-[10px] font-semibold leading-4 text-cyan-100 ring-1 ring-cyan-500/15">
        {slatePositionReason(candidate, ranked, index)}
      </div>
      <div className="mt-2 rounded-lg bg-amber-500/5 px-2.5 py-2 ring-1 ring-amber-500/15">
        <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-amber-200">Immediate Recruiter Action</div>
        <div className="mt-0.5 text-[10px] font-semibold leading-4 text-amber-100">{immediateNextAction(candidate, backup, confidence)}</div>
      </div>
    </div>
  );
}
function rawList(candidate: CandidateCompareSignal, keys: string[]) {
  const value = rawValue(candidate, keys);
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean).join(", ");
  return displayValue(value, "To confirm");
}

function drawerSummary(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[]) {
  const index = Math.max(0, ranked.findIndex((item) => item.id === candidate.id));
  const risk = uniquePrimaryCommercialRisk(candidate, ranked, index);
  const commercialNote = /salary|availability|notice|package|confirm|validation/i.test(risk)
    ? "Final commercial validation remains pending before client submission."
    : "Recruiter validation should be completed before client submission.";
  return `Compared profile for ${displaySapModule(candidate)} with ${executiveProfileStrengths(candidate)}. ${commercialNote}`;
}
function executiveProfileStrengths(candidate: CandidateCompareSignal) {
  const strengths: string[] = [];
  if (implementationCount(candidate) || hasText(candidate, ["full cycle", "end-to-end", "implementation", "go-live", "go live"])) strengths.push("enterprise implementation ownership");
  if (s4hanaCount(candidate) || hasText(candidate, ["s/4hana", "s4hana", "s4 hana"])) strengths.push("S/4HANA delivery");
  if (!/to confirm/i.test(architectureRole(candidate))) strengths.push("architecture responsibility");
  if (!/to confirm/i.test(clientFacingRole(candidate))) strengths.push("client-facing SAP transformation delivery");
  if (!strengths.length) strengths.push(displaySapModule(candidate) + " delivery alignment");
  return strengths.slice(0, 3).join(", ");
}
function validationBreakdown(candidate: CandidateCompareSignal) {
  const confidence = submissionConfidence(candidate);
  const labels = ["Implementation Ownership", "Architecture Ownership", "JD Match", "Salary Confirmation", "Availability Confirmation", "Notice Period Confirmation"];
  return labels.map((label) => ({ label, weight: 1, complete: confidence.completed.includes(label) }));
}

function confidencePercent(candidate: CandidateCompareSignal) {
  return submissionConfidence(candidate).score;
}

function readinessLabel(percent: number) {
  if (percent >= 95) return "Ready";
  if (percent >= 85) return "Strong";
  if (percent >= 70) return "Needs Light Validation";
  if (percent >= 50) return "Commercial Validation Required";
  return "Requires Recruiter Validation";
}

function jdRequirements(activeModule: string) {
  const module = activeModule ? activeModule.replace(/^SAP\s+/i, "SAP ") : "SAP";
  return [
    { label: "10+ years", met: (candidate: CandidateCompareSignal) => (rawNumber(candidate, ["sap_years", "years", "experience_years", "total_years", "years_experience"]) || Number((yearsValue(candidate).match(/\d+/) || [0])[0])) >= 10 },
    { label: module, met: (candidate: CandidateCompareSignal) => displaySapModule(candidate).toLowerCase().includes(module.toLowerCase().replace(/^sap\s+/, "")) || normalizeModule(candidate.module) !== "UNKNOWN" },
    { label: "S/4HANA", met: (candidate: CandidateCompareSignal) => s4hanaCount(candidate) > 0 || hasText(candidate, ["s/4", "s4hana", "s4 hana"]) },
    { label: "Architecture ownership", met: (candidate: CandidateCompareSignal) => architectureRole(candidate) !== "To confirm" },
    { label: "Client-facing delivery", met: (candidate: CandidateCompareSignal) => clientFacingRole(candidate) !== "To confirm" },
    { label: "Greenfield leadership", met: (candidate: CandidateCompareSignal) => greenfieldCount(candidate) > 0 },
    { label: "Regional rollout", met: (candidate: CandidateCompareSignal) => hasText(candidate, ["regional", "rollout", "multi-country", "global template"]) },
  ];
}

function jdCoverage(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  const requirements = jdRequirements(activeModule).map((item) => {
    const met = candidate ? item.met(candidate) : false;
    const partial = !met && Boolean(candidate) && (item.label === "Greenfield leadership" || item.label === "Regional rollout") && hasText(candidate!, ["implementation", "rollout", "project", "delivery"]);
    return { label: item.label, state: !candidate ? "Unknown" : met ? "Matched" : partial ? "Partial Match" : "Missing" };
  });
  const score = requirements.reduce((total, item) => total + (item.state === "Matched" ? 1 : item.state === "Partial Match" ? 0.5 : 0), 0);
  return { percent: requirements.length ? Math.round((score / requirements.length) * 100) : 0, requirements };
}

function executiveSummaryItems(currentSearchCount: number, ranked: CandidateCompareSignal[], activeModule: string) {
  const recommended = ranked[0];
  return [
    { label: "Current Search", value: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Current Search" },
    { label: "Candidates Reviewed", value: String(currentSearchCount) },
    { label: "Compared", value: String(ranked.length) },
    { label: "Recommended", value: recommended ? candidateDisplayName(recommended) : "To confirm" },
    { label: "Alternative Candidate", value: ranked[1]?.name || "To confirm" },
    { label: "Submission Readiness", value: recommended ? commercialReadinessValue(submissionConfidence(recommended, activeModule), true) : "0% Pending Commercial Validation" },
    { label: "Required Validation", value: recommended ? outstandingValidationText(submissionConfidence(recommended, activeModule)) : "To confirm" },
    { label: "Generated", value: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
  ];
}

function exportFileName(prefix: string, extension: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}

function ExecutiveSummary({ currentSearchCount, ranked, activeModule }: { currentSearchCount: number; ranked: CandidateCompareSignal[]; activeModule: string }) {
  const items = executiveSummaryItems(currentSearchCount, ranked, activeModule).filter((item) => ["Current Search", "Candidates Reviewed", "Compared", "Generated"].includes(item.label));
  return (
    <section className="rounded-[22px] bg-[#0B1118] px-5 py-3 ring-1 ring-slate-800/60" aria-label="Search Context">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Search Context</div>
          <div className="mt-1 text-xs text-slate-500">Context only. Submission decision is below.</div>
        </div>
        <div className="flex flex-wrap justify-start gap-x-4 gap-y-2 text-[11px] leading-4 text-slate-400 lg:justify-end">
          {items.map((item, itemIndex) => (
            <div key={`summary-${item.label}-${itemIndex}`} className="min-w-fit">
              <span className="text-slate-600">{item.label}</span>
              <span className="ml-1.5 font-medium text-slate-300">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function ClientRequirementMatch({ candidate, activeModule }: { candidate: CandidateCompareSignal | undefined; activeModule: string }) {
  const coverage = jdCoverage(candidate, activeModule);
  return (
    <section className="rounded-[20px] bg-[#0B1118] p-5 ring-1 ring-cyan-500/15" aria-label="Client Requirement Match" title="Calculated against mandatory client requirements.">
      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
        <div className="rounded-2xl bg-[#101923] p-4 ring-1 ring-slate-800/70">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"><ShieldCheck size={13} /> Requirement Match</div>
          <div className="mt-2 text-[24px] font-semibold leading-tight text-white">{requirementMatchSummary(coverage).text}</div>
          <div className="mt-1 text-[11px] leading-4 text-slate-500">Matched {requirementMatchSummary(coverage).matched} · Partial {requirementMatchSummary(coverage).partial} · Missing {requirementMatchSummary(coverage).missing}</div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-200">Client criteria scorecard</div>
            <div className="text-[11px] text-slate-500">Matched, partial and open items</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-medium leading-none sm:grid-cols-4 xl:grid-cols-7">
            {coverage.requirements.map((item, requirementIndex) => {
              const matched = item.state === "Matched";
              const partial = item.state === "Partial Match";
              const unknown = item.state === "Unknown";
              const tone = matched ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-100" : partial ? "border-amber-500/20 bg-amber-500/8 text-amber-100" : unknown ? "border-slate-700/70 bg-[#101923] text-slate-500" : "border-rose-500/20 bg-rose-500/8 text-rose-100";
              const MarkerIcon = matched ? CheckCircle2 : partial ? Clock : unknown ? ShieldCheck : X;
              return (
                <div key={`requirement-${item.label}-${requirementIndex}`} className={tone + " flex h-8 items-center justify-center gap-1.5 rounded-full border px-2.5 text-center"}>
                  <MarkerIcon size={12} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
function candidateCardBlockers(candidate: CandidateCompareSignal) {
  return slateBlockers(candidate).slice(0, 3);
}

function shortValidationLabel(item: string) {
  const value = item.replace(/ Confirmation$/i, "").replace(/ Period$/i, "").trim();
  if (/salary|compensation/i.test(value)) return "Salary";
  if (/current package/i.test(value)) return "Current Package";
  if (/expected package|package/i.test(value)) return "Expected Package";
  if (/availability|start/i.test(value)) return "Availability";
  if (/notice/i.test(value)) return "Notice";
  if (/client/i.test(value)) return "Client Fit";
  if (/architecture/i.test(value)) return "Architecture";
  if (/implementation/i.test(value)) return "Implementation";
  return value.split(/\s+/).slice(0, 3).join(" ");
}

function commercialValidationItems(candidate: CandidateCompareSignal) {
  const currentPackage = currentPackageValue(candidate);
  const expectedPackage = expectedPackageValue(candidate);
  const availability = availabilityValue(candidate);
  const notice = noticeValue(candidate);
  const clientFit = clientFacingRole(candidate);
  return [
    { label: "Salary", value: currentPackage !== "Not disclosed" || expectedPackage !== "Not disclosed" ? "Available" : "Needs confirmation", confirmed: currentPackage !== "Not disclosed" || expectedPackage !== "Not disclosed" },
    { label: "Current Package", value: currentPackage !== "Not disclosed" ? currentPackage : "Needs confirmation", confirmed: currentPackage !== "Not disclosed" },
    { label: "Expected Package", value: expectedPackage !== "Not disclosed" ? expectedPackage : "Needs confirmation", confirmed: expectedPackage !== "Not disclosed" },
    { label: "Availability", value: availability !== "To confirm" ? availability : "Needs confirmation", confirmed: availability !== "To confirm" },
    { label: "Notice Period", value: notice !== "To confirm" ? notice : "Needs confirmation", confirmed: notice !== "To confirm" },
    { label: "Client Fit", value: clientFit !== "To confirm" ? "Validated signal" : "Needs confirmation", confirmed: clientFit !== "To confirm" },
  ];
}

function validationChipLabels(candidate: CandidateCompareSignal) {
  const confidence = submissionConfidence(candidate);
  const pending = confidence.pending.length ? confidence.pending : candidateCardBlockers(candidate);
  const labels = pending.map((item) => normalizeValidationLabel(shortValidationLabel(item))).filter(Boolean);
  return Array.from(new Set(labels.length ? labels : ["Final Check"])).slice(0, 5);
}

function matrixCellClass(row: DecisionMatrixRow, winner: boolean, unavailable: boolean, fullScreen: boolean) {
  const spacing = fullScreen ? " px-2.5 py-1.5 " : " px-2.5 py-2 ";
  if (row.label === "Commercial Risk" || row.label === "Required Validation") return spacing + "align-top";
  return (winner ? "text-emerald-100" : unavailable ? "text-slate-600" : "text-slate-300") + spacing + "text-[12px] leading-[1.45] align-top";
}

function MatrixCommercialChips({ candidate, ranked }: { candidate: CandidateCompareSignal; ranked: CandidateCompareSignal[] }) {
  const items = commercialMatrixItems(candidate, ranked);
  return (
    <div className="grid gap-1.5">
      {items.length ? items.map((item, itemIndex) => (
        <div key={`${candidate.id}-commercial-${item.label}-${itemIndex}`} className="flex items-center justify-between gap-2 rounded-lg bg-[#05070A] px-2 py-1 ring-1 ring-slate-800/55">
          <span className="text-[10px] font-semibold text-slate-300">{item.label}</span>
          <span className={(item.confirmed ? "bg-emerald-500/10 text-emerald-100 ring-emerald-500/20" : "bg-amber-500/10 text-amber-100 ring-amber-500/20") + " rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1"}>{item.value}</span>
        </div>
      )) : null}
    </div>
  );
}
function MatrixValidationChips({ candidate }: { candidate: CandidateCompareSignal }) {
  return <ValidationChips candidate={candidate} limit={2} />;
}

type SlateFact = { label: string; value: string; tone: string };

function SlateFactValue({ candidate, fact }: { candidate: CandidateCompareSignal; fact: SlateFact }) {
  const toneClass = fact.tone === "amber" ? "text-amber-100" : fact.tone === "emerald" ? "text-emerald-100" : fact.tone === "cyan" ? "text-cyan-100" : fact.tone === "rose" ? "text-rose-100" : "text-slate-200";
  if (fact.label === "Completed Validation") {
    const [completedRaw, totalRaw] = fact.value.match(/\d+/g) || ["0", "1"];
    const completed = Number(completedRaw || 0);
    const total = Math.max(Number(totalRaw || 1), 1);
    return <div className="mt-1"><div className="text-[10px] font-semibold text-slate-200">{completed} / {total} Confirmed</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.round((completed / total) * 100)}%` }} /></div></div>;
  }
  if (fact.label === "Remaining Validation") {
    return <div className="mt-1 flex flex-wrap gap-1">{fact.value.split(",").map((item, itemIndex) => <span key={`${candidate.id}-remaining-${item.trim()}-${itemIndex}`} className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100 ring-1 ring-amber-500/20">{shortValidationLabel(item.trim())}</span>)}</div>;
  }
  return <div className={toneClass + " mt-0.5 text-[10px] leading-4 font-semibold"}>{fact.value}</div>;
}
function submissionConfidenceInput(candidate: CandidateCompareSignal): AnyRecord {
  return {
    ...candidate.raw,
    name: candidateDisplayName(candidate),
    current_title: candidate.title,
    title: candidate.title,
    primary_module: candidate.module,
    module: candidate.module,
    current_company: candidate.company,
    company: candidate.company,
    location: candidate.location,
    search_fit: candidate.score,
    text: candidate.text,
  };
}

function submissionConfidence(candidate: CandidateCompareSignal, activeModule = ""): SubmissionConfidenceResult {
  return calculateSubmissionConfidence(submissionConfidenceInput(candidate), { requiredModule: activeModule || candidate.module });
}
function rowBadgeLabel(label: string) {
  if (/SAP Years/i.test(label)) return "Most Experience";
  if (/Implementations/i.test(label)) return "Most Implementations";
  if (/Leadership/i.test(label)) return "Leadership Depth";
  if (/Architecture/i.test(label)) return "Architecture Level";
  if (/S\/4HANA/i.test(label)) return "Highest S4 Exposure";
  return "Clearest Evidence";
}
function commercialReadinessLabel(result: SubmissionConfidenceResult | null | undefined, compact = false) {
  if (!result) return compact ? "Pending Validation" : "Commercial Validation Required";
  if (result.score >= 85 && !result.pending.length) return "Ready for Release";
  if (result.score >= 70) return "Pending Validation";
  return compact ? "Pending Validation" : "Commercial Validation Required";
}

function commercialReadinessValue(result: SubmissionConfidenceResult | null | undefined, compact = false) {
  return (result ? result.score : 0) + "% " + commercialReadinessLabel(result, compact);
}

function executiveWhy(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[]) {
  if (!candidate) return "Select candidates to compare before forming a submission recommendation.";
  const differentiators = executiveProfileStrengths(candidate);
  const module = displaySapModule(candidate);
  return sentenceLimit(`Selected due to demonstrated ownership of ${module} delivery, ${differentiators}, and client-facing execution across complex environments. The profile represents the strongest balance between implementation depth, solution ownership and client readiness within the compared slate`, 55);
}

function outstandingValidationText(result: SubmissionConfidenceResult | null | undefined) {
  const pending = result?.pending || [];
  if (!pending.length) return "Commercial readiness is substantially complete; perform final recruiter confirmation before client submission.";
  const lower = pending.slice(0, 3).map((item) => item.replace(/ Confirmation$/i, "").toLowerCase());
  return sentenceLimit(`Before client submission, confirm ${lower.join(", ")} to ensure commercial alignment and release readiness`, 40);
}

function immediateNextAction(candidate: CandidateCompareSignal | undefined, backup: CandidateCompareSignal | undefined, result: SubmissionConfidenceResult | null | undefined) {
  if (!candidate) return "Select at least two candidates before preparing a client recommendation.";
  const pending = (result?.pending || []).map(shortValidationLabel);
  if (pending.some((item) => /client/i.test(item))) return "Schedule final client-fit validation today.";
  if (pending.length) return validationActionSentence(pending);
  return backup ? `Release the recommended profile and keep ${backup.name} warm as backup.` : "Release the recommended profile after final recruiter confirmation.";
}
function aiExecutiveRationale(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule = "", maxWords = 70) {
  if (!candidate) return "Select candidates to generate a Why This Candidate summary.";
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const module = displaySapModule(candidate);
  const differentiators = executiveProfileStrengths(candidate);
  const pending = confidence.pending.slice(0, 3).map((item) => shortValidationLabel(item).toLowerCase());
  const validation = pending.length ? `Commercially pending: ${pending.join(", ")} confirmation.` : "Commercial position is substantially ready.";
  return sentenceLimit(`Compared with the remaining shortlisted profiles, ${candidateDisplayName(candidate)} demonstrates stronger ${module} delivery ownership, broader enterprise transformation exposure and clearer S/4HANA ownership. The recommendation prioritises ${differentiators} and solution ownership over tenure. ${validation}`, maxWords);
}

function executiveConfidence(candidate: CandidateCompareSignal | undefined) {
  const percent = candidate ? candidate.score : 0;
  const level = percent >= 88 ? "High" : percent >= 75 ? "Moderate" : "Developing";
  return { percent, level, inputs: ["Implementation", "Architecture", "Transformation", "Commercial", "Communication", "Coverage"] };
}

function validationRemainingCount(result: SubmissionConfidenceResult | null | undefined) {
  return result?.pending?.length || 0;
}

function whyCandidateBullets(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule = "") {
  if (!candidate) return ["Select candidates to compare."];
  const bullets: string[] = [];
  const module = displaySapModule(candidate);
  if (implementationCount(candidate) || hasText(candidate, ["implementation", "go-live", "go live", "full cycle"])) bullets.push(`Strongest enterprise ${module} delivery ownership`);
  if (s4hanaCount(candidate) || hasText(candidate, ["s/4hana", "s4hana", "s4 hana"])) bullets.push("Highest S/4HANA transformation relevance");
  if (architectureRole(candidate) !== "To confirm") bullets.push("Demonstrated architecture leadership");
  if (clientFacingRole(candidate) !== "To confirm") bullets.push("Client-facing delivery signal validated");
  if (submissionConfidence(candidate, activeModule || candidate.module).score >= Math.max(...ranked.map((item) => submissionConfidence(item, activeModule || item.module).score))) bullets.push("Commercial validation path is clearest");
  return Array.from(new Set(bullets.length ? bullets : [keyStrength(candidate, ranked)])).slice(0, 4);
}

function evidenceTags(candidate: CandidateCompareSignal | undefined) {
  if (!candidate) return [];
  const tags = [yearsValue(candidate), "Enterprise"];
  if (s4hanaCount(candidate) || hasText(candidate, ["s/4hana", "s4hana", "s4 hana"])) tags.push("S/4HANA");
  if (architectureRole(candidate) !== "To confirm") tags.push("Architecture");
  if (hasText(candidate, ["transformation", "migration", "rollout", "greenfield"])) tags.push("Transformation");
  if (implementationCount(candidate)) tags.push("Implementation");
  return Array.from(new Set(tags.filter((item) => !isEmptyEvidence(item)))).slice(0, 6);
}

function shortExecutiveRationale(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule = "") {
  if (!candidate) return "Select candidates to compare.";
  const module = normalizeModule(activeModule || candidate.module);
  const pending = submissionConfidence(candidate, activeModule || candidate.module).pending.slice(0, 3).map((item) => shortValidationLabel(item).toLowerCase());
  const hasSalary = pending.some((item) => /salary|package|compensation/i.test(item));
  const hasAvailability = pending.some((item) => /availability/i.test(item));
  const hasNotice = pending.some((item) => /notice/i.test(item));
  const action = hasSalary && hasAvailability && hasNotice ? "He should be released to the client after salary, availability and notice period are confirmed." : pending.length ? validationActionSentence(pending) : "He is ready for client interview review.";
  return sentenceLimit(`${candidateDisplayName(candidate)} stands out as the strongest first submission for SAP ${module} based on delivery ownership, S/4HANA relevance and architecture accountability. ${action}`, 45);
}
function whyNotReasons(candidate: CandidateCompareSignal, recommended: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule = "") {
  if (!recommended || candidate.id === recommended.id) return [];
  return [primaryReasonNotSelected(candidate, recommended, ranked, activeModule)];
}

function commercialMatrixItems(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[]) {
  const visible = ["Salary", "Availability", "Notice"];
  return commercialValidationItems(candidate).filter((item) => {
    if (!visible.includes(item.label)) return false;
    const peerValues = ranked.map((peer) => commercialValidationItems(peer).find((peerItem) => peerItem.label === item.label));
    return new Set(peerValues.map((peerItem) => `${peerItem?.confirmed}-${peerItem?.value}`)).size > 1;
  });
}

function commercialRiskSummary(ranked: CandidateCompareSignal[]) {
  const labels = ["Salary", "Availability", "Notice"];
  return labels.map((label) => {
    const items = ranked.map((candidate) => commercialValidationItems(candidate).find((item) => item.label === label));
    const pending = items.filter((item) => item && !item.confirmed).length;
    return { label, text: pending ? `${pending} Pending` : "Confirmed" };
  });
}

function validationChecklist(candidate: CandidateCompareSignal) {
  const confidence = submissionConfidence(candidate);
  const completed = ["Communication", "Architecture verified", "Implementation verified", ...confidence.completed.map(shortValidationLabel)];
  const pending = confidence.pending.map(shortValidationLabel);
  return {
    completed: Array.from(new Set(completed)).slice(0, 5),
    pending: Array.from(new Set(pending.length ? pending : validationChipLabels(candidate))).slice(0, 5),
    count: `${confidence.completed.length} / ${Math.max(confidence.completed.length + confidence.pending.length, 1)} verified`,
    percent: Math.round((confidence.completed.length / Math.max(confidence.completed.length + confidence.pending.length, 1)) * 100),
  };
}

function topEvidenceItems(candidate: CandidateCompareSignal) {
  const items = [
    { label: "Enterprise Implementation", detail: implementationCount(candidate) ? `${implementationCount(candidate)} implementation signals` : "Implementation evidence present", active: implementationCount(candidate) > 0 || hasText(candidate, ["implementation", "go-live", "go live"]) },
    { label: "S/4HANA Transformation", detail: s4hanaValue(candidate), active: s4hanaCount(candidate) > 0 || hasText(candidate, ["s/4hana", "s4hana", "s4 hana"]) },
    { label: "Architecture Ownership", detail: architectureRole(candidate), active: architectureRole(candidate) !== "To confirm" },
  ];
  return items.filter((item) => item.active).slice(0, 3);
}

function moreEvidenceItems(candidate: CandidateCompareSignal) {
  return [
    ["Workshop", hasText(candidate, ["workshop", "stakeholder", "blueprint"]) ? "Validated signal" : "To confirm"],
    ["Knowledge Transfer", hasText(candidate, ["knowledge transfer", "training", "handover"]) ? "Validated signal" : "To confirm"],
    ["Regional Rollout", hasText(candidate, ["regional", "rollout", "multi-country", "global template"]) ? "Validated signal" : "To confirm"],
    ["Industry", rawList(candidate, ["industry", "industries", "sector"])],
    ["Localization", hasText(candidate, ["localization", "localisation", "tax", "statutory"]) ? "Validated signal" : "To confirm"],
  ].filter(([, value]) => value !== "To confirm").slice(0, 5);
}

type DetailChipTone = "cyan" | "emerald" | "amber" | "slate";
type DetailSection = { title: string; chips: string[]; tone: DetailChipTone };

function splitEvidenceValues(value: any): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(splitEvidenceValues);
  if (typeof value === "object") return Object.values(value).flatMap(splitEvidenceValues);
  return String(value).split(/[,;|\n]/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function rawEvidenceList(candidate: CandidateCompareSignal, keys: string[]) {
  const values = keys.flatMap((key) => splitEvidenceValues(candidate.raw?.[key]));
  return Array.from(new Set(values.filter((item) => !isEmptyEvidence(item))));
}

function detectedTerms(candidate: CandidateCompareSignal, terms: Array<{ label: string; match: string[] }>) {
  return terms.filter((item) => hasText(candidate, item.match)).map((item) => item.label);
}

function compactChipValues(values: string[], fallback = "Needs recruiter validation", max = 30) {
  const clean = Array.from(new Set(values.map((item) => concise(item)).filter((item) => item && !isEmptyEvidence(item))));
  return (clean.length ? clean : [fallback]).slice(0, max);
}

function detailChipClass(tone: DetailChipTone = "slate") {
  if (tone === "cyan") return "bg-cyan-500/10 text-cyan-100 ring-cyan-500/20";
  if (tone === "emerald") return "bg-emerald-500/10 text-emerald-100 ring-emerald-500/20";
  if (tone === "amber") return "bg-amber-500/10 text-amber-100 ring-amber-500/20";
  return "bg-[#05070A] text-slate-300 ring-slate-800/70";
}

function detailCommercialSnapshot(candidate: CandidateCompareSignal) {
  const buyout = displayValue(rawValue(candidate, ["buyout", "buyout_option", "buyout_feasibility"]), "To confirm");
  const optional = [
    ["Visa", workRightsValue(candidate)],
    ["Travel", travelValue(candidate)],
    ["Relocation", displayValue(rawValue(candidate, ["relocation", "willing_to_relocate", "relocation_readiness"]), "To confirm")],
    ["Counter Offer Risk", displayValue(rawValue(candidate, ["counter_offer", "counter_offer_risk", "retention_risk"]), "To confirm")],
    ["Motivation", displayValue(rawValue(candidate, ["motivation", "job_motivation", "move_reason"]), "To confirm")],
  ].filter(([, value]) => value && !/to confirm|not disclosed/i.test(String(value)));
  return [
    ["Salary", expectedPackageValue(candidate)],
    ["Availability", availabilityValue(candidate)],
    ["Notice", noticeValue(candidate)],
    ["Buyout", buyout],
    ...optional,
  ];
}
function detailSections(candidate: CandidateCompareSignal): DetailSection[] {
  const implementation = compactChipValues([
    ...rawEvidenceList(candidate, ["project_types", "project_experience", "implementation_experience", "delivery_phases"]),
    ...detectedTerms(candidate, [
      { label: "Implementation", match: ["implementation", "full cycle", "end-to-end"] },
      { label: "Greenfield", match: ["greenfield"] },
      { label: "Brownfield", match: ["brownfield"] },
      { label: "Rollout", match: ["rollout", "roll-out"] },
      { label: "AMS", match: ["ams", "application management"] },
      { label: "Support", match: ["support"] },
      { label: "Upgrade", match: ["upgrade"] },
      { label: "Migration", match: ["migration"] },
      { label: "Template Build", match: ["template build", "global template"] },
      { label: "Localization", match: ["localization", "localisation"] },
      { label: "Hypercare", match: ["hypercare"] },
      { label: "Cutover", match: ["cutover"] },
      { label: "UAT", match: ["uat"] },
      { label: "SIT", match: ["sit"] },
      { label: "Go Live", match: ["go live", "go-live"] },
      { label: "S/4HANA", match: ["s/4hana", "s4hana", "s4 hana"] },
      { label: "ECC", match: ["ecc", "sap ecc"] },
    ]),
  ]);
  const industries = compactChipValues([
    ...rawEvidenceList(candidate, ["industries", "industry", "sector", "domain_exposure"]),
    ...detectedTerms(candidate, [
      { label: "Oil & Gas", match: ["oil & gas", "oil and gas"] },
      { label: "Manufacturing", match: ["manufacturing"] },
      { label: "Retail", match: ["retail"] },
      { label: "Pharmaceutical", match: ["pharmaceutical", "pharma"] },
      { label: "Banking", match: ["banking"] },
      { label: "Insurance", match: ["insurance"] },
      { label: "Utilities", match: ["utilities"] },
      { label: "Automotive", match: ["automotive"] },
      { label: "Logistics", match: ["logistics", "supply chain"] },
      { label: "Healthcare", match: ["healthcare"] },
      { label: "Public Sector", match: ["public sector", "government"] },
      { label: "Telecommunication", match: ["telecommunication", "telecom"] },
    ]),
  ], "Industry needs validation");
  const scale = compactChipValues([
    ...rawEvidenceList(candidate, ["project_scale", "delivery_geography", "regional_scope", "user_count"]),
    ...detectedTerms(candidate, [
      { label: "Local", match: ["local rollout", "local implementation"] },
      { label: "Global", match: ["global"] },
      { label: "Regional", match: ["regional"] },
      { label: "Country", match: ["country rollout", "local rollout"] },
      { label: "Multi-country", match: ["multi-country", "multiple countries"] },
      { label: "APAC", match: ["apac"] },
      { label: "EMEA", match: ["emea"] },
      { label: "US", match: [" united states", " usa", " us "] },
      { label: "Europe", match: ["europe", "european"] },
      { label: "1000+ users", match: ["1000 users", "1,000 users"] },
      { label: "5000+ users", match: ["5000 users", "5,000 users"] },
      { label: "Enterprise rollout", match: ["enterprise rollout", "enterprise-wide"] },
    ]),
  ], "Scale needs validation");
  const architecture = compactChipValues([
    ...rawEvidenceList(candidate, ["architecture_experience", "architecture_scope", "solution_ownership", "technical_scope"]),
    architectureRole(candidate),
    clientFacingRole(candidate),
    ...detectedTerms(candidate, [
      { label: "Solution Architect", match: ["solution architect"] },
      { label: "Solution Design", match: ["solution design"] },
      { label: "Integration", match: ["integration"] },
      { label: "API", match: [" api", "apis"] },
      { label: "CPI", match: ["cpi"] },
      { label: "PI/PO", match: ["pi/po", "pi po"] },
      { label: "Workshop Lead", match: ["workshop lead", "led workshop", "facilitated workshop"] },
      { label: "Workshop", match: ["workshop"] },
      { label: "Blueprint", match: ["blueprint"] },
      { label: "Design Authority", match: ["design authority"] },
      { label: "Cutover", match: ["cutover"] },
      { label: "Hypercare", match: ["hypercare"] },
      { label: "Governance", match: ["governance"] },
    ]),
  ], "Architecture needs validation");
  const leadership = compactChipValues([
    ...rawEvidenceList(candidate, ["leadership", "team_leadership", "management_experience", "stakeholder_exposure"]),
    teamResponsibility(candidate),
    ...detectedTerms(candidate, [
      { label: "Team Lead", match: ["team lead"] },
      { label: "Solution Lead", match: ["solution lead"] },
      { label: "Program Lead", match: ["program lead", "programme lead"] },
      { label: "Project Lead", match: ["project lead"] },
      { label: "Client Workshop", match: ["client workshop"] },
      { label: "Steering Committee", match: ["steering committee"] },
      { label: "Vendor Management", match: ["vendor management"] },
      { label: "Stakeholder Management", match: ["stakeholder management"] },
      { label: "Mentoring", match: ["mentoring", "mentor"] },
      { label: "People Management", match: ["people management"] },
    ]),
  ], "Leadership needs validation");
  const modules = compactChipValues([
    normalizeModule(candidate.module),
    ...rawEvidenceList(candidate, ["modules", "sap_modules", "functional_modules", "skills", "primary_skills"]),
    ...detectedTerms(candidate, [
      { label: "SD", match: [" sap sd", " sales and distribution"] },
      { label: "MM", match: [" sap mm", " materials management"] },
      { label: "FICO", match: ["fico", "fi/co", " sap fi", " sap co"] },
      { label: "PP", match: [" sap pp", "production planning"] },
      { label: "WM", match: [" sap wm", "warehouse management"] },
      { label: "EWM", match: ["ewm"] },
      { label: "TM", match: [" sap tm", "transportation management"] },
      { label: "BTP", match: ["btp"] },
      { label: "SuccessFactors", match: ["successfactors"] },
    ]),
  ], "Module needs validation");
  const languages = compactChipValues([
    ...rawEvidenceList(candidate, ["languages", "language", "spoken_languages"]),
    ...detectedTerms(candidate, [
      { label: "English", match: ["english"] },
      { label: "Mandarin", match: ["mandarin", "chinese"] },
      { label: "Japanese", match: ["japanese"] },
      { label: "Vietnamese", match: ["vietnamese"] },
      { label: "Thai", match: ["thai"] },
      { label: "Bahasa", match: ["bahasa", "indonesian", "malay"] },
    ]),
  ], "Language needs validation");
  const certifications = compactChipValues([
    ...rawEvidenceList(candidate, ["certifications", "certification", "certificates"]),
    ...detectedTerms(candidate, [
      { label: "SAP Certified", match: ["sap certified", "sap certification"] },
      { label: "S/4HANA", match: ["s/4hana certified", "s4hana certified"] },
      { label: "Activate", match: ["activate"] },
      { label: "PMP", match: ["pmp"] },
      { label: "Scrum", match: ["scrum"] },
      { label: "TOGAF", match: ["togaf"] },
      { label: "Azure", match: ["azure"] },
      { label: "AWS", match: ["aws"] },
    ]),
  ], "Certification needs validation");
  return [
    { title: "Delivery Capability", chips: implementation, tone: "cyan" },
    { title: "Enterprise Exposure", chips: industries, tone: "slate" },
    { title: "Project Scale", chips: scale, tone: "amber" },
    { title: "Architecture Level", chips: [architectureLevel(candidate)], tone: "cyan" },
    { title: "Leadership", chips: leadership, tone: "emerald" },
    { title: "Functional Coverage", chips: modules, tone: "cyan" },
    { title: "Languages", chips: languages, tone: "slate" },
    { title: "Certifications", chips: certifications, tone: "emerald" },
  ];
}

function detailSectionVisible(section: DetailSection, focus: CompareFocusMode) {
  if (focus === "All" || focus === "Only Differences") return true;
  if (focus === "Commercial") return false;
  if (focus === "Delivery") return /delivery|project scale|enterprise exposure/i.test(section.title);
  if (focus === "Implementation") return /delivery capability|functional coverage/i.test(section.title);
  if (focus === "Architecture") return /architecture|functional coverage/i.test(section.title);
  if (focus === "Leadership") return /leadership|languages|certifications/i.test(section.title);
  return true;
}

function sectionChipsForFocus(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[], section: DetailSection, focus: CompareFocusMode) {
  if (focus !== "Only Differences" || ranked.length < 2) return section.chips;
  const allSections = ranked.map((item) => detailSections(item).find((current) => current.title === section.title)?.chips || []);
  return section.chips.filter((chip) => !allSections.every((chips) => chips.includes(chip)));
}

function visibleDetailChips(_section: DetailSection, chips: string[]) {
  return getVisibleChips(chips, 8);
}
function detailCommercialRowsForFocus(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[], focus: CompareFocusMode) {
  const rows = detailCommercialSnapshot(candidate);
  if (focus !== "Only Differences" || ranked.length < 2) return rows;
  return rows.filter(([label, value]) => {
    const peerValues = ranked.map((item) => detailCommercialSnapshot(item).find(([peerLabel]) => peerLabel === label)?.[1] || "To confirm");
    return new Set(peerValues.map((item) => String(item).toLowerCase())).size > 1 && !/to confirm|not disclosed/i.test(String(value));
  });
}
function detailCoreComparisonRows(candidate: CandidateCompareSignal, ranked: CandidateCompareSignal[], index: number) {
  return [
    ["Key Strength", keyStrength(candidate, ranked)],
    ["SAP Years", yearsValue(candidate)],
    ["Background Experience", backgroundExperience(candidate)],
    ["Current Company", currentCompanyComparisonValue(candidate)],
    ["Company Type", currentCompanyClassification(candidate)],
    ["Commercial Risk", uniquePrimaryCommercialRisk(candidate, ranked, index)],
    ["Required Validation", validationFromPrimaryCommercialRisk(uniquePrimaryCommercialRisk(candidate, ranked, index))],
  ];
}
function DetailEvaluationWorkspace({ ranked, fullScreen = false, focus = "All", shortlistedIds = [], onMoveToShortlist, onRemoveFromShortlist, onOpenDrawer }: { ranked: CandidateCompareSignal[]; fullScreen?: boolean; focus?: CompareFocusMode; shortlistedIds?: string[]; onMoveToShortlist?: (candidate: CandidateCompareSignal) => void; onRemoveFromShortlist?: (candidate: CandidateCompareSignal) => void; onOpenDrawer?: (candidate: CandidateCompareSignal) => void }) {
  return (
    <section className={(fullScreen ? "flex h-full max-h-full w-full max-w-[1600px] flex-col rounded-[18px] p-3 " : "rounded-[22px] p-4 ") + "bg-[#0B1118] ring-1 ring-slate-800/60"}>
      <div className={(fullScreen ? "mb-2 " : "mb-3 ") + "flex shrink-0 items-center justify-between gap-3"}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Executive View</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Objective side-by-side review of the ranked slate.</div>
        </div>
        <div className="rounded-full bg-[#101923] px-2.5 py-1 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-500/15">{ranked.length} shown</div>
      </div>
      <div className={(fullScreen ? "min-h-0 flex-1 overflow-auto " : "overflow-auto ") + "scroll-smooth rounded-2xl ring-1 ring-slate-800/45"}>
        <div className={(fullScreen ? "min-w-max " : "min-w-max ") + "flex gap-3 p-3"}>
          {ranked.map((candidate, index) => {
            const confidence = submissionConfidence(candidate);
            const candidateRank = globalSearchRank(candidate, index);
            const visibleSections = detailSections(candidate)
              .filter((section) => detailSectionVisible(section, focus))
              .map((section) => ({ section, chips: sectionChipsForFocus(candidate, ranked, section, focus) }))
              .filter((item) => item.chips.length > 0);
            const commercialRows = detailCommercialRowsForFocus(candidate, ranked, focus);
            const coreRows = detailCoreComparisonRows(candidate, ranked, index);
            const isShortlisted = shortlistedIds.includes(candidate.id);
            const showCommercial = (focus === "All" || focus === "Only Differences" || focus === "Commercial") && commercialRows.length > 0;
            return (
              <article key={`detailed-evaluation-${candidate.id}-${index}`} role="button" tabIndex={0} onClick={() => onOpenDrawer?.(candidate)} onKeyDown={(event) => { if (event.key === "Enter") onOpenDrawer?.(candidate); }} className="w-[280px] shrink-0 cursor-pointer rounded-2xl bg-[#101923] p-2 ring-1 ring-slate-800/65 transition hover:bg-[#14202B] hover:ring-cyan-500/20" style={{ contentVisibility: "auto", containIntrinsicSize: "900px 280px" }}>
                <div className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {candidateRank ? <span className="rounded-full border border-cyan-300/40 bg-cyan-400/12 px-2 py-0.5 text-[10px] font-black text-cyan-50 shadow-[0_0_14px_rgba(34,211,238,0.12)]">Rank #{candidateRank}</span> : null}
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200">Compared</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white" title={candidateDisplayName(candidate, candidateRank)}>{candidateDisplayName(candidate, candidateRank)}</div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-400" title={candidate.title}>{candidate.title}</div>
                    {onMoveToShortlist ? <div className="mt-2"><button type="button" onClick={(event) => { event.stopPropagation(); isShortlisted ? onRemoveFromShortlist?.(candidate) : onMoveToShortlist(candidate); }} className={(isShortlisted ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/25 hover:bg-emerald-500/20" : "bg-cyan-400 text-slate-950 ring-cyan-500/20 hover:bg-cyan-300") + " rounded-full px-3 py-1.5 text-[10px] font-black ring-1 transition"}>{isShortlisted ? <><CheckCircle2 size={12} className="inline-block align-[-2px]" /> Shortlisted</> : "Add to Shortlist"}</button></div> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[18px] font-black text-white">{candidate.score}%</div>
                    
                  </div>
                </div>
                <div className="mt-2.5 grid gap-2.5">
                  <section>
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Core Comparison</div>
                    <div className="mt-1 grid gap-1">
                      {coreRows.map(([label, value]) => <div key={`${candidate.id}-core-${label}`} className="rounded-xl bg-[#05070A] px-2.5 py-1.5 ring-1 ring-slate-800/60"><div className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div><div className="mt-0.5 whitespace-pre-line text-[10px] font-semibold leading-4 text-slate-200">{label === "Commercial Risk" ? <RiskBadge label={commercialRiskLabel(candidate)} /> : label === "Required Validation" ? <ValidationChips candidate={candidate} limit={2} /> : presentVisibleValue(value, "Pending Validation")}</div></div>)}
                    </div>
                  </section>
                  {!visibleSections.length && !showCommercial ? <div className="rounded-xl bg-[#05070A] px-3 py-2 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-800/60">No unique evidence in this filter.</div> : null}
                  {visibleSections.map(({ section, chips }) => { const { visible, hidden } = visibleDetailChips(section, chips); const chipClass = detailChipClass(section.tone) + " rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"; return (
                    <section key={`${candidate.id}-detail-section-${section.title}`}>
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{section.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {visible.map((chip, chipIndex) => <span key={`${candidate.id}-${section.title}-${chip}-${chipIndex}`} title={chip} className={chipClass}>{chip}</span>)}<ChipOverflow id={candidate.id} sectionKey={section.title} hidden={hidden} className={chipClass} />
                      </div>
                    </section>
                  ); })}
                  {showCommercial ? <section>
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Commercial Snapshot</div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {commercialRows.map(([label, value], itemIndex) => (
                        <div key={`${candidate.id}-commercial-${label}-${itemIndex}`} className="rounded-xl bg-[#05070A] px-2 py-1.5 ring-1 ring-slate-800/60">
                          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div>
                          <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-200">{presentVisibleValue(value, "Pending Validation")}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${confidence.score}%` }} /></div>
                  </section> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
function firstSectionChips(candidate: CandidateCompareSignal, title: string, fallback = "Needs validation") {
  const section = detailSections(candidate).find((item) => item.title === title);
  return section?.chips?.length ? section.chips.slice(0, 3) : [fallback];
}

type MatrixFilterKey =
  | "all"
  | "shortlisted"
  | "not-shortlisted"
  | "consulting"
  | "in-house"
  | "mixed"
  | "sap10"
  | "sap15"
  | "sap20"
  | "high-risk"
  | "medium-risk"
  | "low-risk"
  | "s4hana"
  | "greenfield"
  | "brownfield"
  | "rollout"
  | "implementation"
  | "available"
  | "salary-pending"
  | "availability-pending"
  | "notice-pending"
  | "architecture-pending";

type MatrixFilterGroupKey = "shortlist" | "experience" | "background" | "employer" | "risk" | "project" | "validation";
type MatrixFilterState = Record<MatrixFilterGroupKey, string>;
type MatrixSortKey = "rank" | "match" | "sapYears" | "risk" | "shortlisted" | "availability" | "company" | "background";

const DEFAULT_MATRIX_FILTERS: MatrixFilterState = {
  shortlist: "all",
  experience: "all",
  background: "all",
  employer: "all",
  risk: "all",
  project: "all",
  validation: "all",
};

const MATRIX_FILTER_GROUPS: Array<{ key: MatrixFilterGroupKey; label: string; options: Array<{ key: string; label: string }> }> = [
  { key: "shortlist", label: "Shortlist", options: [{ key: "all", label: "All" }, { key: "shortlisted", label: "Shortlisted" }, { key: "not-shortlisted", label: "Not Shortlisted" }] },
  { key: "experience", label: "Experience", options: [{ key: "all", label: "All" }, { key: "sap10", label: ">10 SAP Years" }, { key: "sap15", label: ">15 SAP Years" }, { key: "sap20", label: ">20 SAP Years" }] },
  { key: "background", label: "Background", options: [{ key: "all", label: "All" }, { key: "consulting", label: "Consulting Firm" }, { key: "in-house", label: "In-house" }, { key: "mixed", label: "Mixed" }] },
  { key: "risk", label: "Risk", options: [{ key: "all", label: "All" }, { key: "high-risk", label: "High Risk" }, { key: "medium-risk", label: "Medium Risk" }, { key: "low-risk", label: "Low Risk" }] },
  { key: "project", label: "Project", options: [{ key: "all", label: "All" }, { key: "s4hana", label: "S/4HANA" }, { key: "greenfield", label: "Greenfield" }, { key: "brownfield", label: "Brownfield" }, { key: "rollout", label: "Rollout" }, { key: "implementation", label: "Implementation" }] },
  { key: "validation", label: "Validation", options: [{ key: "all", label: "All" }, { key: "salary-pending", label: "Salary Pending" }, { key: "availability-pending", label: "Availability Pending" }, { key: "notice-pending", label: "Notice Pending" }, { key: "architecture-pending", label: "Architecture Pending" }] },
];

const MATRIX_SORTS: Array<{ key: MatrixSortKey; label: string }> = [
  { key: "rank", label: "Rank ascending" },
  { key: "match", label: "AI Match descending" },
  { key: "sapYears", label: "SAP Years descending" },
  { key: "risk", label: "Risk high to low" },
  { key: "shortlisted", label: "Shortlisted first" },
  { key: "availability", label: "Availability readiness" },
  { key: "company", label: "Current Company A-Z" },
  { key: "background", label: "Background type" },
];

function sapYearsNumber(candidate: CandidateCompareSignal) {
  const match = yearsValue(candidate).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function riskWeight(candidate: CandidateCompareSignal) {
  const label = commercialRiskLabel(candidate);
  if (/high/i.test(label)) return 3;
  if (/medium/i.test(label)) return 2;
  if (/low/i.test(label)) return 1;
  return 0;
}

function availabilityWeight(candidate: CandidateCompareSignal) {
  return availabilityValue(candidate) === "To confirm" ? 0 : 1;
}

function matrixFilterLabel(group: MatrixFilterGroupKey, value: string) {
  if (group === "employer") return value;
  return MATRIX_FILTER_GROUPS.find((item) => item.key === group)?.options.find((option) => option.key === value)?.label || value;
}

function matrixFilterMatches(candidate: CandidateCompareSignal, filter: string, shortlistedIds: string[]) {
  const background = backgroundExperience(candidate).toLowerCase();
  const risk = commercialRiskLabel(candidate).toLowerCase();
  const text = candidate.text.toLowerCase();
  const validation = validationLabelsForCandidate(candidate).join(" ").toLowerCase();
  if (filter === "all") return true;
  if (filter === "shortlisted") return shortlistedIds.includes(candidate.id);
  if (filter === "not-shortlisted") return !shortlistedIds.includes(candidate.id);
  if (filter === "consulting") return background === "consulting firm";
  if (filter === "in-house") return background === "in-house";
  if (filter === "mixed") return background.startsWith("mixed");
  if (filter === "sap10") return sapYearsNumber(candidate) > 10;
  if (filter === "sap15") return sapYearsNumber(candidate) > 15;
  if (filter === "sap20") return sapYearsNumber(candidate) > 20;
  if (filter === "high-risk") return risk.startsWith("high");
  if (filter === "medium-risk") return risk.startsWith("medium");
  if (filter === "low-risk") return risk.startsWith("low");
  if (filter === "s4hana") return Boolean(s4hanaCount(candidate) || /s\/4hana|s4hana|s4 hana/i.test(text));
  if (filter === "greenfield") return Boolean(greenfieldCount(candidate) || /greenfield/i.test(text));
  if (filter === "brownfield") return /brownfield/i.test(text);
  if (filter === "rollout") return /rollout|roll-out/i.test(text);
  if (filter === "implementation") return Boolean(implementationCount(candidate) || /implementation|go-live|go live/i.test(text));
  if (filter === "available") return availabilityValue(candidate) !== "To confirm";
  if (filter === "salary-pending") return validation.includes("salary");
  if (filter === "availability-pending") return validation.includes("availability");
  if (filter === "notice-pending") return validation.includes("notice");
  if (filter === "architecture-pending") return validation.includes("architecture");
  return true;
}

function matrixFiltersMatch(candidate: CandidateCompareSignal, filters: MatrixFilterState, shortlistedIds: string[]) {
  if (filters.employer !== "all" && currentEmployerTypeValue(candidate) !== filters.employer) return false;
  return (Object.entries(filters) as Array<[MatrixFilterGroupKey, string]>).every(([group, value]) => group === "employer" || matrixFilterMatches(candidate, value, shortlistedIds));
}
function compareMatrixCandidates(a: CandidateCompareSignal, b: CandidateCompareSignal, sort: MatrixSortKey, rankIndex: Map<string, number>, shortlistedIds: string[]) {
  const rankDelta = (rankIndex.get(a.id) ?? 999) - (rankIndex.get(b.id) ?? 999);
  if (sort === "rank") return rankDelta;
  if (sort === "match") return b.score - a.score || rankDelta;
  if (sort === "sapYears") return sapYearsNumber(b) - sapYearsNumber(a) || rankDelta;
  if (sort === "risk") return riskWeight(b) - riskWeight(a) || rankDelta;
  if (sort === "shortlisted") return Number(shortlistedIds.includes(b.id)) - Number(shortlistedIds.includes(a.id)) || rankDelta;
  if (sort === "availability") return availabilityWeight(b) - availabilityWeight(a) || rankDelta;
  if (sort === "company") return currentEmployerTypeValue(a).localeCompare(currentEmployerTypeValue(b)) || rankDelta;
  if (sort === "background") return backgroundExperience(a).localeCompare(backgroundExperience(b)) || rankDelta;
  return rankDelta;
}
function matrixColumnVisible(key: string, _focus: CompareFocusMode) {
  return ["rank", "candidate", "match", "sapYears", "background", "employer", "keyStrength", "commercialRisk", "validation", "shortlist"].includes(key);
}

function ExecutiveComparisonMatrix({ ranked, focus, fullScreen = false, shortlistedIds, selectedIds, onToggleSelected, onCompareSelected, onMoveToShortlist, onRemoveFromShortlist, onOpenDrawer }: { ranked: CandidateCompareSignal[]; focus: CompareFocusMode; fullScreen?: boolean; shortlistedIds: string[]; selectedIds: string[]; onToggleSelected: (candidate: CandidateCompareSignal) => void; onCompareSelected: () => void; onMoveToShortlist: (candidate: CandidateCompareSignal) => void; onRemoveFromShortlist: (candidate: CandidateCompareSignal) => void; onOpenDrawer: (candidate: CandidateCompareSignal) => void }) {
  const columns = [
    { key: "rank", label: "Rank", className: "w-[70px]" },
    { key: "candidate", label: "Candidate", className: "min-w-[190px]" },
    { key: "match", label: "AI Match", className: "w-[78px]" },
    { key: "sapYears", label: "SAP Years", className: "w-[86px]" },
    { key: "background", label: "Background", className: "min-w-[128px]" },
    { key: "employer", label: "Employer", className: "min-w-[150px]" },
    { key: "keyStrength", label: "Key Strength", className: "min-w-[230px]" },
    { key: "commercialRisk", label: "Risk", className: "w-[112px]" },
    { key: "validation", label: "Validation", className: "w-[122px]" },
    { key: "shortlist", label: "Shortlist", className: "w-[126px]" },
  ].filter((column) => matrixColumnVisible(column.key, focus));
  const [activeFilters, setActiveFilters] = useState<MatrixFilterState>(DEFAULT_MATRIX_FILTERS);
  const [activeSort, setActiveSort] = useState<MatrixSortKey>("rank");
  const rankIndex = useMemo(() => new Map(ranked.map((candidate, index) => [candidate.id, index])), [ranked]);
  const employerOptions = useMemo(() => {
    const counts = new Map<string, number>();
    ranked.forEach((candidate) => counts.set(currentEmployerTypeValue(candidate), (counts.get(currentEmployerTypeValue(candidate)) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => {
      if (a[0] === "Not disclosed") return 1;
      if (b[0] === "Not disclosed") return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    }).slice(0, 9).map(([company]) => company);
  }, [ranked]);
  const activeFilterEntries = (Object.entries(activeFilters) as Array<[MatrixFilterGroupKey, string]>).filter(([, value]) => value !== "all");
  const hasActiveFilters = activeFilterEntries.length > 0;
  const displayCandidates = useMemo(() => ranked.filter((candidate) => matrixFiltersMatch(candidate, activeFilters, shortlistedIds)).sort((a, b) => compareMatrixCandidates(a, b, activeSort, rankIndex, shortlistedIds)), [ranked, activeFilters, activeSort, rankIndex, shortlistedIds]);
  const selectedCount = selectedIds.length;
  return (
    <section className={(fullScreen ? "flex h-full min-h-0 flex-col " : "") + "rounded-[22px] bg-[#0B1118] p-4 ring-1 ring-slate-800/60"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Executive Matrix</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Select 2-5 candidates for detailed comparison.</div>
        </div>
        {selectedCount >= 2 ? <button type="button" disabled={selectedCount > 5} onClick={onCompareSelected} className={(selectedCount <= 5 ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "cursor-not-allowed bg-white/5 text-slate-500 ring-1 ring-slate-700/50") + " rounded-full px-4 py-2 text-[11px] font-black transition"}>Compare Selected ({selectedCount})</button> : null}
      </div>
      <div className="sticky top-0 z-40 mb-3 grid gap-2 rounded-2xl bg-[#05070A]/95 p-2 ring-1 ring-slate-800/60 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Showing {displayCandidates.length} of {ranked.length}</div>
          <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">Sort
            <select value={activeSort} onChange={(event) => setActiveSort(event.target.value as MatrixSortKey)} className="rounded-full bg-[#101923] px-3 py-1.5 text-[10px] font-semibold text-cyan-100 outline-none ring-1 ring-slate-700/70">
              {MATRIX_SORTS.map((item) => <option key={`matrix-sort-${item.key}`} value={item.key}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {MATRIX_FILTER_GROUPS.map((group) => <label key={`matrix-filter-group-${group.key}`} className="grid gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{group.label}<select value={activeFilters[group.key]} onChange={(event) => setActiveFilters((current) => ({ ...current, [group.key]: event.target.value }))} className="min-w-0 rounded-xl bg-[#101923] px-2 py-1.5 text-[10px] font-semibold normal-case tracking-normal text-cyan-100 outline-none ring-1 ring-slate-800/70"><option value="all">All</option>{group.options.filter((option) => option.key !== "all").map((option) => <option key={`${group.key}-${option.key}`} value={option.key}>{option.label}</option>)}</select></label>)}
          <label className="grid gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Current Employer<select value={activeFilters.employer} onChange={(event) => setActiveFilters((current) => ({ ...current, employer: event.target.value }))} className="min-w-0 rounded-xl bg-[#101923] px-2 py-1.5 text-[10px] font-semibold normal-case tracking-normal text-cyan-100 outline-none ring-1 ring-slate-800/70"><option value="all">All</option>{employerOptions.map((company) => <option key={`matrix-employer-${company}`} value={company}>{company}</option>)}</select></label>
        </div>
        {hasActiveFilters ? <div className="flex flex-wrap items-center gap-1.5 pt-1">{activeFilterEntries.map(([group, value]) => <span key={`active-filter-${group}-${value}`} className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-100 ring-1 ring-cyan-500/20">{matrixFilterLabel(group, value)}</span>)}<button type="button" onClick={() => setActiveFilters(DEFAULT_MATRIX_FILTERS)} className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300 ring-1 ring-slate-700/60 hover:text-white">Clear filters</button></div> : null}
      </div>
      <div className={(fullScreen ? "min-h-0 flex-1 " : "max-h-[68vh] ") + "overflow-auto rounded-2xl ring-1 ring-slate-800/60"}>
        <table className="min-w-[1060px] w-full border-collapse text-left xl:min-w-0">
          <thead className="sticky top-0 z-30 bg-[#0B1118] text-[9px] uppercase tracking-[0.12em] text-slate-500 shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <tr>{columns.map((column) => <th key={column.key} className={(column.key === "rank" ? "sticky left-0 z-40 bg-[#0B1118] " : column.key === "candidate" ? "sticky left-[70px] z-40 bg-[#0B1118] " : "") + column.className + " px-2.5 py-1.5 font-black"}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {displayCandidates.map((candidate) => {
              const index = rankIndex.get(candidate.id) ?? 0;
              const candidateRank = globalSearchRank(candidate, index);
              const rowKey = `${candidate.id || candidate.raw?.candidateId || candidate.raw?.candidate_id || candidateDisplayName(candidate, candidateRank)}-${candidateRank || index + 1}-${index}`;
              const selected = selectedIds.includes(candidate.id);
              const isShortlisted = shortlistedIds.includes(candidate.id);
              const cellClass = "border-t border-slate-800/60 px-2.5 py-1.5 align-top text-[11px] leading-4 text-slate-300";
              const renderCell = (columnKey: string) => {
                const cellKey = `${rowKey}-${columnKey}`;
                if (columnKey === "rank") return <td key={cellKey} className={cellClass + " sticky left-0 z-20 bg-[#0B1118] shadow-[8px_0_16px_rgba(0,0,0,0.22)] group-hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.45),8px_0_16px_rgba(0,0,0,0.22)]"}><label className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected} disabled={!selected && selectedCount >= 5} onChange={() => onToggleSelected(candidate)} className="h-3.5 w-3.5 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40" /><span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black text-cyan-100 ring-1 ring-cyan-500/20">#{globalSearchRank(candidate, index)}</span></label></td>;
                if (columnKey === "candidate") return <td key={cellKey} className={cellClass + " sticky left-[70px] z-20 bg-[#0B1118] shadow-[8px_0_16px_rgba(0,0,0,0.18)]"}><div className="min-w-0 text-left"><div className="truncate font-bold text-white" title={candidateDisplayName(candidate, candidateRank)}>{candidateDisplayName(candidate, candidateRank)}</div><div className="mt-0.5 text-[10px] text-slate-500">{candidateCountry(candidate)} · {displaySapModule(candidate)}</div></div></td>;
                if (columnKey === "match") return <td key={cellKey} className={cellClass}><span className="text-base font-black text-white">{candidate.score}%</span></td>;
                if (columnKey === "keyStrength") return <td key={cellKey} className={cellClass}>{keyStrength(candidate, ranked)}</td>;
                if (columnKey === "sapYears") return <td key={cellKey} className={cellClass}>{yearsValue(candidate)}</td>;
                if (columnKey === "background") return <td key={cellKey} className={cellClass}><span className="block truncate" title={backgroundExperience(candidate)}>{backgroundExperience(candidate)}</span></td>;
                if (columnKey === "employer") return <td key={cellKey} className={cellClass}><div className="max-w-[150px]" title={`${currentEmployerTypeValue(candidate)} - ${currentCompanyClassification(candidate)}`}><div className="truncate font-semibold text-slate-100">{currentEmployerTypeValue(candidate)}</div><div className="mt-0.5 truncate text-[10px] text-slate-500">{currentCompanyClassification(candidate)}</div></div></td>;
                if (columnKey === "commercialRisk") { const riskLevel = commercialRiskLabel(candidate); return <td key={cellKey} className={cellClass}><RiskBadge label={riskLevel} /></td>; }
                if (columnKey === "validation") return <td key={cellKey} className={cellClass}><ValidationChips candidate={candidate} limit={2} /></td>;
                return <td key={cellKey} className={cellClass}><button type="button" onClick={(event) => { event.stopPropagation(); isShortlisted ? onRemoveFromShortlist(candidate) : onMoveToShortlist(candidate); }} className={(isShortlisted ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/25 hover:bg-emerald-500/20" : "bg-cyan-400 text-slate-950 ring-cyan-500/20 hover:bg-cyan-300") + " rounded-full px-3 py-1.5 text-[10px] font-black ring-1 transition"}>{isShortlisted ? "Shortlisted" : "Add to Shortlist"}</button></td>;
              };
              return <tr key={`executive-matrix-row-${rowKey}`} role="button" tabIndex={0} onClick={() => onOpenDrawer(candidate)} onKeyDown={(event) => { if (event.key === "Enter") onOpenDrawer(candidate); }} className={(selected ? "bg-cyan-500/[0.05]" : "") + " group cursor-pointer transition hover:bg-cyan-500/[0.13] hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.48)]"}>{columns.map((column) => <Fragment key={`${rowKey}-${column.key}`}>{renderCell(column.key)}</Fragment>)}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ExecutiveComparisonSurface({ ranked, comparePreset, focus, fullScreen = false, shortlistedIds, selectedIds, deepCompareOpen = false, deepCompareCandidates = [], onToggleSelected, onCompareSelected, onMoveToShortlist, onRemoveFromShortlist, onOpenDrawer }: { ranked: CandidateCompareSignal[]; comparePreset: ComparePreset; focus: CompareFocusMode; fullScreen?: boolean; shortlistedIds: string[]; selectedIds: string[]; deepCompareOpen?: boolean; deepCompareCandidates?: CandidateCompareSignal[]; onToggleSelected: (candidate: CandidateCompareSignal) => void; onCompareSelected: () => void; onMoveToShortlist: (candidate: CandidateCompareSignal) => void; onRemoveFromShortlist: (candidate: CandidateCompareSignal) => void; onOpenDrawer: (candidate: CandidateCompareSignal) => void }) {
  if (comparePreset === 5) {
    return <DetailEvaluationWorkspace ranked={ranked} fullScreen={fullScreen} focus={focus} shortlistedIds={shortlistedIds} onMoveToShortlist={onMoveToShortlist} onRemoveFromShortlist={onRemoveFromShortlist} onOpenDrawer={onOpenDrawer} />;
  }
  return (
    <div className={(fullScreen ? "flex h-full min-h-0 flex-col " : "") + "gap-5"}>
      <ExecutiveComparisonMatrix ranked={ranked} focus={focus} fullScreen={fullScreen} shortlistedIds={shortlistedIds} selectedIds={selectedIds} onToggleSelected={onToggleSelected} onCompareSelected={onCompareSelected} onMoveToShortlist={onMoveToShortlist} onRemoveFromShortlist={onRemoveFromShortlist} onOpenDrawer={onOpenDrawer} />
      {deepCompareOpen && deepCompareCandidates.length >= 2 ? <DetailEvaluationWorkspace ranked={deepCompareCandidates} focus={focus} shortlistedIds={shortlistedIds} onMoveToShortlist={onMoveToShortlist} onRemoveFromShortlist={onRemoveFromShortlist} onOpenDrawer={onOpenDrawer} /> : null}
    </div>
  );
}
function ComparisonMatrix({ ranked, mode = "detailed", fullScreen = false, activeCandidateId = "", focus = "All", shortlistedIds = [], onMoveToShortlist, onRemoveFromShortlist, onOpenDrawer }: { ranked: CandidateCompareSignal[]; mode?: CompareViewMode; fullScreen?: boolean; activeCandidateId?: string; focus?: CompareFocusMode; shortlistedIds?: string[]; onMoveToShortlist?: (candidate: CandidateCompareSignal) => void; onRemoveFromShortlist?: (candidate: CandidateCompareSignal) => void; onOpenDrawer?: (candidate: CandidateCompareSignal) => void }) {
  const rows = useMemo(() => matrixRows(ranked, mode, fullScreen ? 10 : undefined), [ranked, mode, fullScreen]);
  if (mode === "detailed") return <DetailEvaluationWorkspace ranked={ranked} fullScreen={fullScreen} focus={focus} shortlistedIds={shortlistedIds} onMoveToShortlist={onMoveToShortlist} onRemoveFromShortlist={onRemoveFromShortlist} onOpenDrawer={onOpenDrawer} />;
  return (
    <section className={(fullScreen ? "flex h-full max-h-full w-full max-w-[1600px] flex-col rounded-[18px] p-3 " : "rounded-[22px] p-4 ") + "bg-[#0B1118] ring-1 ring-slate-800/60"}>
      <div className={(fullScreen ? "mb-1 " : "mb-1.5 ") + "flex shrink-0 items-center justify-between gap-3"}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Comparison Matrix</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Only measurable deltas are highlighted.</div>
        </div>
        <div className="rounded-full bg-[#101923] px-2.5 py-1 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-500/15">{ranked.length} shown</div>
      </div>
      <div className={(fullScreen ? "flex-1 min-h-0 overflow-auto " : "overflow-auto ") + "scroll-smooth rounded-2xl ring-1 ring-slate-800/45"}>
        <div className={fullScreen ? "flex min-h-full w-full items-start" : "w-full"}>
          <table className={(fullScreen ? "min-w-[1120px] " : "min-w-full ") + "w-full border-collapse text-left"}>
          <thead className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="sticky left-0 top-0 z-40 bg-[#0B1118] px-2.5 py-1.5 shadow-[8px_0_16px_rgba(0,0,0,0.25)]">Criteria</th>
              {ranked.map((candidate, index) => {
                const candidateRank = globalSearchRank(candidate, index);
                const blockers = candidateCardBlockers(candidate);
                const confidence = submissionConfidence(candidate);
                return (
                  <th key={candidate.id} className={(!fullScreen && activeCandidateId === candidate.id ? "ring-1 ring-cyan-400/40 " : "") + "sticky top-0 z-30 min-w-[190px] bg-[#0B1118] px-2.5 " + (fullScreen ? "py-1.5 " : "py-2 ") + "align-top shadow-[0_8px_16px_rgba(0,0,0,0.22)]"}>
                    <div className="truncate text-[14px] font-semibold normal-case tracking-normal text-white" title={candidateDisplayName(candidate, candidateRank)}>{candidateDisplayName(candidate, candidateRank)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                      <span>{shortlistedIds.includes(candidate.id) ? "Shortlisted" : recommendationStatus(index).replace(/^#\d+\s*/, "")}</span>
                      <span className={(confidence.score >= 85 ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/25" : confidence.score >= 70 ? "bg-cyan-500/15 text-cyan-100 ring-cyan-500/25" : confidence.score >= 55 ? "bg-amber-500/15 text-amber-100 ring-amber-500/25" : "bg-rose-500/15 text-rose-100 ring-rose-500/25") + " rounded-full px-2 py-0.5 text-[9px] font-medium ring-1"}>Submission Readiness</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <span className="text-[11px] font-semibold text-slate-300">{confidence.score}% {confidenceBadgeLabel(confidence)}</span>
                      {blockers[0] ? <span className="text-[10px] font-medium text-amber-100">{blockers[0]}</span> : null}
                    </div>
                    {shortlistedIds.includes(candidate.id) ? <div className="mt-1.5"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold normal-case tracking-normal text-emerald-100 ring-1 ring-emerald-500/25"><CheckCircle2 size={11} className="inline-block align-[-2px]" /> Shortlisted</span></div> : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const winners = rowWinners(row, ranked);
              const badge = winners.length === 1 ? rowBadgeLabel(row.label) : "";
              return (
                <tr key={row.label} title={fullScreen ? "Investigation row: compare evidence and differentiators" : undefined} className="border-t border-slate-800/60 hover:bg-cyan-500/[0.08]">
                  <td className={"sticky left-0 z-20 bg-[#0B1118] px-2.5 " + (fullScreen ? "py-1.5 " : "py-2 ") + "text-[12px] font-semibold text-white shadow-[8px_0_16px_rgba(0,0,0,0.18)]"}>{row.label === "Commercial Risk" ? <div><div>{row.label}</div><div className="mt-1 flex flex-wrap gap-1">{commercialRiskSummary(ranked).map((item) => <span key={`risk-summary-${item.label}`} className="rounded-full bg-[#101923] px-2 py-0.5 text-[9px] font-semibold text-slate-300 ring-1 ring-slate-700/60">{item.label}: {item.text}</span>)}</div></div> : row.label}</td>
                  {ranked.map((candidate, index) => {
                    const cellValue = row.value(candidate, index, ranked);
                    const unavailable = isEmptyEvidence(cellValue);
                    const winner = isWinningCell(row, candidate, ranked);
                    return (
                                            <td key={`${candidate.id}-${row.label}-${index}`} className={matrixCellClass(row, winner, unavailable, fullScreen)}>
                        {row.label === "Commercial Risk" ? <MatrixCommercialChips candidate={candidate} ranked={ranked} /> : row.label === "Required Validation" ? <MatrixValidationChips candidate={candidate} /> : (
                          <div className="flex flex-col gap-1">
                            {winner && badge ? <span className="w-fit rounded-full bg-amber-400/12 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-100 ring-1 ring-amber-400/30">{badge}</span> : null}
                            <span className={winner ? "font-bold text-white" : ""}>{presentVisibleValue(cellValue, "Pending Validation")}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}

function recommendationSentence(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[]) {
  return executiveWhy(candidate, ranked);
}

function backupSentence(candidate: CandidateCompareSignal | undefined, recommended: CandidateCompareSignal | undefined) {
  if (!candidate) return "No backup candidate selected.";
  const recommendedName = recommended ? candidateDisplayName(recommended) : "the first choice";
  return `${candidateDisplayName(candidate)} should remain the Alternative Candidate if ${recommendedName} cannot be released or commercial alignment changes.`;
}
function validationSignals(candidate: CandidateCompareSignal) {
  return [
    implementationCount(candidate) || hasText(candidate, ["implementation", "go-live", "go live"]) ? "Implementation validated" : "Implementation pending",
    architectureRole(candidate) !== "To confirm" ? "Architecture validated" : "Architecture pending",
    salaryValue(candidate, ["current_salary", "currentSalary", "salary", "monthly_salary"]) !== "Not disclosed" ? "Salary validated" : "Salary pending",
    availabilityValue(candidate) !== "To confirm" ? "Availability validated" : "Availability pending",
    noticeValue(candidate) !== "To confirm" ? "Notice Period validated" : "Notice Period pending",
  ];
}

function confidenceBadgeLabel(result: SubmissionConfidenceResult) {
  return commercialReadinessLabel(result, true);
}

function confidenceBarTone(result: SubmissionConfidenceResult) {
  if (result.score >= 85) return "bg-emerald-400";
  if (result.score >= 70) return "bg-cyan-400";
  if (result.score >= 55) return "bg-amber-400";
  return "bg-rose-400";
}

function FullScreenCompareModal({
  open,
  ranked,
  comparePreset,
  focus,
  onFocusChange,
  selectedIds = [],
  onToggleSelected,
  onCompareSelected,
  activeCandidateId,
  activeFullScreenIndex,
  shortlistedIds = [],
  onMoveToShortlist,
  onRemoveFromShortlist,
  onOpenDrawer,
  onClose,
}: {
  open: boolean;
  ranked: CandidateCompareSignal[];
  comparePreset: ComparePreset;
  focus: CompareFocusMode;
  onFocusChange: (focus: CompareFocusMode) => void;
  selectedIds?: string[];
  onToggleSelected: (candidate: CandidateCompareSignal) => void;
  onCompareSelected: () => void;
  activeCandidateId: string;
  activeFullScreenIndex: number;
  shortlistedIds?: string[];
  onMoveToShortlist: (candidate: CandidateCompareSignal) => void;
  onRemoveFromShortlist: (candidate: CandidateCompareSignal) => void;
  onOpenDrawer: (candidate: CandidateCompareSignal) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted || !ranked.length) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] h-screen w-screen overflow-hidden bg-[#02070b] text-white">
      <section className="flex h-screen w-screen flex-col overflow-hidden bg-[#02070b]">
        <header className="relative z-20 flex h-[56px] max-h-[64px] shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-[#02070b] px-4 pr-28 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200"><Sparkles size={12} /> {comparePreset === 5 ? "Executive View" : `Top ${comparePreset} Executive Matrix`}</div>
          <div className="flex flex-wrap items-center gap-1.5">{(["All", "Only Differences", "Commercial", "Delivery", "Leadership", "Architecture", "Implementation"] as CompareFocusMode[]).map((item) => <button key={`focus-${item}`} type="button" onClick={() => onFocusChange(item)} className={(focus === item ? "bg-cyan-400 text-slate-950" : "bg-[#101923] text-slate-300 ring-1 ring-slate-800/70") + " rounded-full px-2.5 py-1 text-[10px] font-semibold"}>{item}</button>)}</div>
        </header>
        <button type="button" onClick={onClose} className="fixed right-4 top-3 z-30 rounded-full bg-[#101923] px-3 py-1.5 text-xs font-bold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400">Close</button>
        <div className="h-[calc(100vh-56px)] min-h-0 flex-1 overflow-hidden px-3 py-2 lg:px-4">
          <ExecutiveComparisonSurface ranked={ranked} comparePreset={comparePreset} focus={focus} fullScreen shortlistedIds={shortlistedIds} selectedIds={selectedIds} onToggleSelected={onToggleSelected} onCompareSelected={onCompareSelected} onMoveToShortlist={onMoveToShortlist} onRemoveFromShortlist={onRemoveFromShortlist} onOpenDrawer={onOpenDrawer} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
function submissionRecommendationConfidence(candidate: CandidateCompareSignal) {
  const status = currentStatus(candidate);
  if (["Submitted", "Interviewing", "Offer", "Placed"].includes(status)) return status === "Interviewing" ? "Interview" : status;
  if (status === "Unavailable") return "Blocked";
  return commercialReadinessLabel(submissionConfidence(candidate));
}

function decisionConfidence(candidate: CandidateCompareSignal) {
  const confidence = submissionConfidence(candidate);
  return { level: commercialReadinessLabel(confidence), validated: confidence.completed, pending: confidence.pending, primaryBlocker: confidence.primaryBlocker };
}

function dealBreakerOptions(candidate: CandidateCompareSignal) {
  return submissionConfidence(candidate).blockers;
}

function clientSummaryText(ranked: CandidateCompareSignal[]) {
  const recommendation = buildCompareRecommendation(ranked);
  const recommended = recommendation.candidate;
  if (!recommended) return "No candidates selected.";
  return [
    "EXECUTIVE DECISION",
    "",
    "Submit First",
    recommended.name,
    "",
    "Executive Confidence",
    recommendation.executive.percent + "%",
    "",
    "Requirement Match",
    requirementMatchSummary(recommendation.coverage).text,
    "",
    "Submission Readiness",
    recommendation.confidence ? recommendation.confidence.score + "%" : "0%",
    "",
    "--------------------------------",
    "",
    "Evidence Summary",
    ...recommendation.whySelected.slice(0, 4).map((item) => "• " + item),
    "",
    "--------------------------------",
    "",
    "Before Client Submission",
    ...(recommendation.actions.length ? recommendation.actions.map((item) => "- " + item) : ["- Final recruiter confirmation"]),
    "",
    "--------------------------------",
    "",
    "Alternative Candidate",
    recommendation.backup ? recommendation.backup.name : "None selected",
  ].join("\\n");
}
function clientCopyText(ranked: CandidateCompareSignal[]) {
  const recommendation = buildCompareRecommendation(ranked);
  const recommended = recommendation.candidate;
  const backup = recommendation.backup;
  if (!recommended) return "No candidates selected.";
  const confidence = recommendation.confidence;

  return [
    "Subject: Executive Candidate Comparison - " + recommended.name,
    "",
    "Recommended Candidate",
    recommended.name,
    "",
    "Alternative Candidate",
    backup ? backup.name : "None selected",
    "",
    "Submission Readiness",
    commercialReadinessValue(confidence),
    "",
    "Why This Candidate",
    recommendation.whySelected.join("; "),
    "",
    "Required Validation",
    outstandingValidationText(confidence),
    "",
    "Immediate Next Action",
    immediateNextAction(recommended, backup, confidence),
    "",
    "Primus AI",
  ].join("\n");
}
function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
}

function rawText(candidate: CandidateCompareSignal, keys: string[]) {
  return displayValue(rawValue(candidate, keys), "");
}

function absoluteUrl(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return "https://" + trimmed;
  return "";
}

function candidateLinkedInUrl(candidate: CandidateCompareSignal) {
  const value = rawText(candidate, ["linkedin_url", "linkedin", "linkedInUrl", "profile_url", "profileUrl"]);
  return absoluteUrl(value) || (value.includes("linkedin.com") ? "https://" + value.replace(/^https?:\/\//i, "") : "");
}

function candidateEmail(candidate: CandidateCompareSignal) {
  const value = rawText(candidate, ["email", "contact_email", "work_email", "personal_email"]);
  return /@/.test(value) ? value : "";
}

function candidatePhone(candidate: CandidateCompareSignal) {
  const value = rawText(candidate, ["phone", "mobile", "cell", "contact_phone", "phone_number"]);
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? digits : "";
}

function candidateWhatsAppUrl(candidate: CandidateCompareSignal) {
  const phone = candidatePhone(candidate).replace(/[^\d]/g, "");
  return phone.length >= 7 ? "https://wa.me/" + phone : "";
}

function isPersonalInfoLine(line: string) {
  return /\b(phone|mobile|email|linkedin|address|nationality|passport|salary|dob|date of birth|personal profile|profile link|contact|candidate id|record id|reference id|internal id)\b/i.test(line) || /@/.test(line) || /\+?\d[\d\s().-]{6,}\d/.test(line) || /https?:\/\//i.test(line);
}

function classifyResumeSection(line: string) {
  const normalized = concise(line).toLowerCase();
  if (/professional summary|career summary|summary|profile summary/.test(normalized)) return "Professional Summary";
  if (/experience|employment history|work experience|career history/.test(normalized)) return "Experience";
  if (/project|projects/.test(normalized)) return "Projects";
  if (/skill|skills|competencies|tools/.test(normalized)) return "Skills";
  if (/education|certification|certifications|qualification|qualifications/.test(normalized)) return "Education";
  return "";
}

function resumePreviewSections(candidate: CandidateCompareSignal) {
  const raw = candidateResumeText(candidate);
  if (!raw) return [];
  const lines = raw.split(/\n+/).map((line) => concise(line)).filter(Boolean);
  const sections: Array<{ title: string; items: string[] }> = [];
  let current = { title: "", items: [] as string[] };
  const push = () => {
    if (current.title && current.items.length) sections.push(current);
    current = { title: "", items: [] };
  };
  for (const line of lines) {
    if (isPersonalInfoLine(line)) continue;
    const heading = classifyResumeSection(line);
    if (heading) {
      if (current.title !== heading) push();
      current.title = heading;
      continue;
    }
    if (!current.title) current.title = "Professional Summary";
    current.items.push(line.replace(/^[-?\u2022]\s*/, ""));
    if (current.items.length >= 4) push();
  }
  if (current.title && current.items.length) sections.push(current);
  const ordered = ["Professional Summary", "Experience", "Projects", "Skills", "Education"];
  return ordered.map((title) => sections.find((section) => section.title === title)).filter(Boolean) as Array<{ title: string; items: string[] }>;
}


type ResumeEvidenceCard = { key: string; title: string; detail: string };

function sanitizedResumePreviewLines(candidate: CandidateCompareSignal): ResumeEvidenceCard[] {
  const raw = candidateResumeText(candidate);
  if (!raw) return [];
  const cleaned = raw
    .split(/\n+|(?<=\.)\s+/)
    .map((line) => concise(line).replace(/^\[Open\]\s*/i, "").replace(/^[-?\u2022]\s*/, ""))
    .filter(Boolean)
    .filter((line) => !isPersonalInfoLine(line))
    .map((line) => line
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
      .replace(/https?:\/\/\S+|www\.\S+|\S*linkedin\.com\S*/gi, "")
      .replace(/\+?\d[\d\s().-]{6,}\d/g, "")
      .replace(/\b(?:street|st\.|road|rd\.|avenue|ave\.|building|floor|district|ward|city|province|zip|postal)\b.*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim())
    .filter((line) => line.length > 12)
    .filter((line) => !/^(role|company|duration|responsibilities|location|period|project)\s*:?\s*$/i.test(line))
    .filter((line) => !/^\d+\s*(years?|months?)\b/i.test(line));

  const categories = [
    { key: "end-to-end", title: "End-to-End Implementation", detail: "Led full-cycle SAP delivery from blueprint through go-live and hypercare.", test: /full[\s-]?cycle|end[\s-]?to[\s-]?end|implementation lifecycle|blueprint.*go[\s-]?live|go[\s-]?live.*support|implementation/i },
    { key: "s4hana", title: "S/4HANA Delivery", detail: "Delivered S/4HANA programmes across transformation, rollout, and support environments.", test: /S\/4HANA|S4HANA|S4 HANA/i },
    { key: "architecture", title: "Architecture Responsibility", detail: "Owned enterprise SAP finance architecture across transformation programmes.", test: /solution architect|architecture|design authority|architectural/i },
    { key: "module-lead", title: "Module Lead", detail: "Led a functional stream with delivery accountability and issue resolution ownership.", test: /module lead|functional lead|stream lead|lead consultant/i },
    { key: "workshop-client", title: "Workshop / Client-Facing", detail: "Led client workshops, requirements sessions, and stakeholder alignment.", test: /workshop|client[\s-]?facing|stakeholder|steering committee|business users|requirements gathering|fit[\s-]?gap/i },
    { key: "industry", title: "Industry Expertise", detail: "Delivered SAP work in regulated and complex enterprise environments.", test: /retail|manufacturing|banking|pharma|energy|utilities|oil|gas|public sector|automotive|telecom|industry|industries/i },
    { key: "knowledge-transfer", title: "Knowledge Transfer", detail: "Supported training, handover, and adoption before release.", test: /knowledge transfer|training|handover|enablement|train-the-trainer|user adoption/i },
    { key: "regional-rollout", title: "Regional Rollout", detail: "Contributed to multi-country rollout and localisation activity.", test: /regional|rollout|multi[\s-]?country|global template|country deployment|localization/i },
  ];

  const evidence: ResumeEvidenceCard[] = [];
  for (const category of categories) {
    const source = cleaned.find((line) => category.test.test(line));
    if (!source) continue;
    evidence.push({ key: category.key, title: category.title, detail: category.detail });
    if (evidence.length >= 8) break;
  }
  return evidence;
}

function resumeEvidenceIcon(key: string) {
  if (key === "end-to-end") return BriefcaseBusiness;
  if (key === "s4hana") return Cpu;
  if (key === "architecture") return ShieldCheck;
  if (key === "module-lead") return Users;
  if (key === "workshop-client") return Users;
  if (key === "industry") return BriefcaseBusiness;
  if (key === "knowledge-transfer") return BookOpen;
  if (key === "regional-rollout") return CalendarDays;
  return CheckCircle2;
}
function candidateResumeUrl(candidate: CandidateCompareSignal) {
  return absoluteUrl(rawText(candidate, ["resume_url", "resumeUrl", "cv_url", "cvUrl", "file_url", "document_url", "attachment_url", "attachmentUrl", "profile_url", "profileUrl"]));
}

function candidateResumeText(candidate: CandidateCompareSignal) {
  const value = rawText(candidate, ["resume_text", "resumeText", "cv_text", "cvText", "parsed_resume", "profile_summary", "summary", "bio", "experience_summary"]);
  const fallback = candidate.text || "";
  const text = String(value || fallback || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

type CandidateImmediateAction = { label: string; icon: any; href?: string; disabled?: boolean; lockedCopy?: string; onClick?: () => void; intent?: "primary" | "secondary" | "success" };

function candidateRecruiterActions(candidate: CandidateCompareSignal, options: { viewerRole: string; subscription: boolean; hasProfileAccess: boolean; canChat: boolean; chatCreditCost: number; isShortlisted: boolean; canShortlist: boolean; onStartCandidateChat: (candidateId: string) => void; onToggleShortlist: (candidate: CandidateCompareSignal) => void; }) {
  const resumeUrl = candidateResumeUrl(candidate);
  const email = candidateEmail(candidate);
  const whatsappUrl = candidateWhatsAppUrl(candidate);
  const canViewResume = options.viewerRole === "client" ? options.subscription : options.hasProfileAccess;
  const shortlistAction: CandidateImmediateAction = { label: options.isShortlisted ? "Shortlisted" : "Add to Shortlist", icon: CheckCircle2, intent: options.isShortlisted ? "success" : "primary", disabled: !options.canShortlist, lockedCopy: options.canShortlist ? undefined : "Requires subscription or credits", onClick: options.canShortlist ? () => options.onToggleShortlist(candidate) : undefined };
  const actions: CandidateImmediateAction[] = [];
  if (options.viewerRole === "client") {
    actions.push({ label: "Open Resume", icon: FileText, href: resumeUrl, disabled: !canViewResume, lockedCopy: canViewResume ? undefined : "Requires subscription or credits" }, { label: "Chat", icon: Send, disabled: !options.canChat, lockedCopy: options.canChat ? undefined : "Requires subscription or credits", onClick: options.canChat ? () => options.onStartCandidateChat(candidate.id) : undefined }, { label: "WhatsApp", icon: MessageCircle, href: whatsappUrl, disabled: !options.subscription || !whatsappUrl, lockedCopy: options.subscription && whatsappUrl ? undefined : "Requires subscription or credits" }, { label: "Email", icon: Mail, href: email ? "mailto:" + email : "", disabled: !options.subscription || !email, lockedCopy: options.subscription && email ? undefined : "Requires subscription or credits" }, shortlistAction);
  } else {
    actions.push({ label: "Open Resume", icon: FileText, href: resumeUrl, disabled: !resumeUrl || (!options.hasProfileAccess && options.viewerRole !== "admin"), lockedCopy: resumeUrl ? "Requires subscription or credits" : undefined }, { label: "Chat", icon: Send, disabled: !options.canChat, lockedCopy: options.canChat ? undefined : "Requires subscription or credits", onClick: options.canChat ? () => options.onStartCandidateChat(candidate.id) : undefined }, { label: "WhatsApp", icon: MessageCircle, href: whatsappUrl, disabled: !whatsappUrl }, { label: "Email", icon: Mail, href: email ? "mailto:" + email : "", disabled: !email }, shortlistAction);
  }
  return actions;
}

type ExecutivePdfCandidateSnapshot = {
  candidate: CandidateCompareSignal;
  rank: number;
  name: string;
  score: string;
  sapYears: string;
  background: string;
  employer: string;
  companyType: string;
  employerBlock: string;
  keyStrength: string;
  risk: string;
  validation: string;
};

function buildExecutivePdfSnapshot(ranked: CandidateCompareSignal[], activeModule: string): ExecutivePdfCandidateSnapshot[] {
  const invalidForExport = ranked.filter((candidate) => !normalizeCandidateDisplayData(candidate).validName);
  if (invalidForExport.length && process.env.NODE_ENV === "development") console.warn("[Compare QA] Excluding unresolved candidate names from PDF export", invalidForExport.map((candidate) => candidate.id));
  const eligible = ranked.filter((candidate) => normalizeCandidateDisplayData(candidate).validName);
  return eligible.map((candidate, index) => {
    const rank = globalSearchRank(candidate, index);
    const employer = currentEmployerTypeValue(candidate);
    const companyType = currentCompanyClassification(candidate);
    return {
      candidate,
      rank,
      name: candidateDisplayName(candidate, rank),
      score: candidate.score + "%",
      sapYears: yearsValue(candidate),
      background: backgroundExperience(candidate),
      employer,
      companyType,
      employerBlock: `${employer}\n${companyType}`,
      keyStrength: keyStrength(candidate, eligible),
      risk: commercialRiskLabel(candidate, activeModule),
      validation: compactValidationLabels(candidate, activeModule),
    };
  });
}

function exportPdf(ranked: CandidateCompareSignal[], currentSearchCount: number, _notes: Record<string, string>, activeModule: string, reportMeta: ReportMeta = {}) {
  const pdfRows = buildExecutivePdfSnapshot(ranked, activeModule);
  const candidatesForExport = pdfRows.map((row) => row.candidate);
  const recommendation = buildCompareRecommendation(candidatesForExport, activeModule, {});
  const recommended = recommendation.candidate;
  const backup = recommendation.backup;
  const recommendedRow = recommended ? pdfRows.find((row) => row.candidate.id === recommended.id) : undefined;
  const backupRow = backup ? pdfRows.find((row) => row.candidate.id === backup.id) : undefined;
  const confidence = recommendation.confidence;
  const coverage = recommendation.coverage;
  const today = new Date().toLocaleDateString();
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 38;
  const bottomMargin = 42;
  let pageNumber = 1;
  let pageWidth = doc.internal.pageSize.getWidth();
  let pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const refreshPageSize = () => {
    pageWidth = doc.internal.pageSize.getWidth();
    pageHeight = doc.internal.pageSize.getHeight();
  };
  const availableWidth = () => pageWidth - margin * 2;
  const split = (value: string, width: number) => doc.splitTextToSize(String(value || ""), Math.max(24, width));
  const footer = () => {
    refreshPageSize();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Confidential | Primus AI", margin, pageHeight - 20);
    doc.text("Generated " + today, pageWidth / 2 - 42, pageHeight - 20);
    doc.text("Page " + pageNumber, pageWidth - margin - 28, pageHeight - 20);
  };
  const addPage = (orientation: "portrait" | "landscape" = "portrait") => {
    footer();
    doc.addPage("a4", orientation);
    pageNumber += 1;
    refreshPageSize();
    y = margin;
  };
  const drawText = (value: string, x: number, textY: number, width: number, options: { size?: number; bold?: boolean; color?: [number, number, number]; lineGap?: number } = {}) => {
    const size = options.size ?? 9;
    const color = options.color ?? [15, 23, 42];
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = split(value, width);
    doc.text(lines, x, textY);
    return lines.length * (size + (options.lineGap ?? 2));
  };
  const title = (value: string, subtitle = "") => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(15, 23, 42);
    doc.text(value, margin, y);
    y += 18;
    if (subtitle) y += drawText(subtitle, margin, y, availableWidth(), { size: 8.5, color: [71, 85, 105], lineGap: 2 }) + 8;
  };
  const labelValue = (label: string, value: string, x: number, top: number, width: number) => {
    drawText(label, x, top, width, { size: 7.8, bold: true, color: [71, 85, 105], lineGap: 1 });
    drawText(value, x, top + 14, width, { size: 10, bold: true, color: [15, 23, 42], lineGap: 2 });
  };
  const card = (height: number, draw: (x: number, top: number, width: number) => void) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, y, availableWidth(), height, 6, 6, "FD");
    draw(margin + 12, y + 15, availableWidth() - 24);
    y += height + 9;
  };

  doc.setFillColor(5, 7, 10);
  doc.rect(0, 0, pageWidth, 68, "F");
  doc.setTextColor(103, 232, 249);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Primus AI Recruiter™", margin, 25);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Executive Candidate Comparison", margin, 48);
  y = 92;

  title("Executive Summary", "Executive candidate comparison for client submission review.");
  card(82, (x, top, width) => {
    const col = width / 4;
    labelValue("Recommended Candidate", recommendedRow ? recommendedRow.name : "To confirm", x, top, col - 8);
    labelValue("Alternative Candidate", backupRow ? backupRow.name : "None selected", x + col, top, col - 8);
    labelValue("Submission Readiness", confidence ? confidence.score + "%\n" + commercialReadinessLabel(confidence) : "0%\nPending Commercial Validation", x + col * 2, top, col - 8);
    labelValue("Requirement Match", requirementMatchSummary(coverage).text, x + col * 3, top, col - 8);
    drawText("Search Size: " + currentSearchCount + " candidates | Compared: " + pdfRows.length, x, top + 52, width, { size: 8.5, color: [71, 85, 105] });
  });
  card(118, (x, top, width) => {
    drawText("Why This Candidate", x, top, width, { size: 9, bold: true, color: [71, 85, 105] });
    drawText(recommendation.whySelected.map((item) => "- " + item).join("\n"), x, top + 17, width, { size: 9.5, color: [15, 23, 42], lineGap: 3 });
    drawText(recommendation.decision.decision, x, top + 78, width, { size: 8.8, color: [51, 65, 85], lineGap: 2 });
  });
  card(92, (x, top, width) => {
    const col = width / 2;
    drawText("Required Validation", x, top, col - 14, { size: 9, bold: true, color: [71, 85, 105] });
    drawText(outstandingValidationText(confidence), x, top + 17, col - 14, { size: 9.5, color: [51, 65, 85], lineGap: 3 });
    drawText("Requirement Match", x + col, top, col - 14, { size: 9, bold: true, color: [71, 85, 105] });
    const req = requirementMatchSummary(coverage);
    drawText(`${req.text}\nMatched ${req.matched}\nPartial ${req.partial}\nMissing ${req.missing}`, x + col, top + 17, col - 14, { size: 8.5, color: [51, 65, 85], lineGap: 2 });
  });

  addPage("portrait");
  title("Top 5 Executive Cards", "Executive candidate cards for fast submission review.");
  pdfRows.slice(0, 5).forEach((row) => {
    const cardHeight = 86;
    if (y + cardHeight > pageHeight - bottomMargin) addPage("portrait");
    card(cardHeight, (x, top, width) => {
      const left = width * 0.28;
      const mid = width * 0.36;
      drawText(`Rank #${row.rank} · ${row.name}`, x, top, left, { size: 10, bold: true, color: [15, 23, 42] });
      drawText(`${row.score} AI Match\n${row.sapYears}\n${row.background}`, x, top + 18, left, { size: 8.2, color: [51, 65, 85], lineGap: 2 });
      drawText("Current Company", x + left + 8, top, mid - 8, { size: 7.8, bold: true, color: [71, 85, 105] });
      drawText(row.employerBlock, x + left + 8, top + 14, mid - 8, { size: 8.5, bold: true, color: [15, 23, 42], lineGap: 2 });
      drawText("Key Strength", x + left + 8, top + 34, mid - 8, { size: 7.8, bold: true, color: [71, 85, 105] });
      drawText(row.keyStrength, x + left + 8, top + 48, mid - 8, { size: 8, color: [51, 65, 85], lineGap: 2 });
      drawText("Risk", x + left + mid + 8, top, width - left - mid - 8, { size: 7.8, bold: true, color: [71, 85, 105] });
      drawText(row.risk, x + left + mid + 8, top + 14, width - left - mid - 8, { size: 9, bold: true, color: [15, 23, 42] });
      drawText("Validation", x + left + mid + 8, top + 38, width - left - mid - 8, { size: 7.8, bold: true, color: [71, 85, 105] });
      drawText(row.validation, x + left + mid + 8, top + 52, width - left - mid - 8, { size: 8.5, color: [51, 65, 85] });
    });
  });

  const tableRows = pdfRows.slice(5, 20);
  if (tableRows.length) {
    addPage("landscape");
    title("Top 6-20 Executive Matrix", "Compact scan aligned to the Executive Matrix view.");
    const colWidths = [30, 110, 44, 54, 92, 118, 160, 72, 86];
    const headers = ["Rank", "Candidate", "AI", "SAP", "Background", "Employer", "Key Strength", "Risk", "Validation"];
    let tableY = y;
    const drawShortTableRow = (values: string[], top: number, header = false, rowIndex = 0) => {
      let x = margin;
      const rowHeight = header ? 24 : 40;
      values.forEach((value, colIndex) => {
        const width = colWidths[colIndex];
        doc.setDrawColor(203, 213, 225);
        if (header) doc.setFillColor(15, 23, 42);
        else if (rowIndex % 2 === 0) doc.setFillColor(248, 250, 252);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, top, width, rowHeight, "FD");
        const emphasis = !header && (colIndex === 1 || colIndex === 2 || colIndex === 7);
        const color: [number, number, number] = header ? [255, 255, 255] : /high/i.test(value) ? [127, 29, 29] : /medium/i.test(value) ? [120, 53, 15] : /low/i.test(value) ? [20, 83, 45] : [15, 23, 42];
        drawText(value, x + 4, top + 10, width - 8, { size: header ? 7.2 : 6.4, bold: header || emphasis, color, lineGap: 1 });
        x += width;
      });
    };
    drawShortTableRow(headers, tableY, true);
    tableY += 24;
    tableRows.forEach((row, offset) => {
      if (tableY + 40 > pageHeight - bottomMargin) {
        addPage("landscape");
        title("Top 6-20 Executive Matrix", "Continued.");
        tableY = y;
        drawShortTableRow(headers, tableY, true);
        tableY += 24;
      }
      drawShortTableRow([String(row.rank), row.name, row.score, row.sapYears, row.background, row.employerBlock, row.keyStrength, row.risk, row.validation], tableY, false, offset);
      tableY += 40;
    });
    y = tableY + 12;
  }

  addPage("portrait");
  title("Recruiter Action Checklist", "Commercial readiness and immediate recruiter actions.");
  card(124, (x, top, width) => {
    drawText("[ ] Confirm Salary\n[ ] Confirm Availability\n[ ] Confirm Notice Period\n[ ] Confirm Current Employer\n[ ] Validate Architecture Ownership", x, top, width, { size: 11, bold: true, color: [15, 23, 42], lineGap: 5 });
  });
  card(58, (x, top, width) => {
    labelValue("Estimated Recruiter Effort", "12 mins", x, top, width);
  });
  card(48, (x, top, width) => {
    drawText("Confidentiality", x, top, width, { size: 9, bold: true, color: [71, 85, 105] });
    drawText("Confidential recommendation prepared for recruiter review and client submission.", x, top + 17, width, { size: 9, color: [51, 65, 85], lineGap: 2 });
  });
  footer();
  doc.save(exportFileName("candidate-compare", "pdf"));
}
function exportWorkbook(ranked: CandidateCompareSignal[], currentSearchCount: number, _notes: Record<string, string>, activeModule: string, reportMeta: ReportMeta = {}) {
  const wb = XLSX.utils.book_new();
  const generatedDate = new Date().toISOString().slice(0, 10);
  const moduleLabel = activeModule ? `SAP ${normalizeModule(activeModule)}` : "Active Search";
  const invalidForExport = ranked.filter((candidate) => !normalizeCandidateDisplayData(candidate).validName);
  if (invalidForExport.length && process.env.NODE_ENV === "development") console.warn("[Compare QA] Excluding unresolved candidate names from Excel export", invalidForExport.map((candidate) => candidate.id));
  const candidatesForExport = ranked.filter((candidate) => normalizeCandidateDisplayData(candidate).validName);
  const recommendation = buildCompareRecommendation(candidatesForExport, activeModule);
  const confidence = recommendation.confidence;
  const coverage = recommendation.coverage;
  const rowFor = (candidate: CandidateCompareSignal, index: number) => {
    const rank = globalSearchRank(candidate, index);
    return [rank, candidateExportName(candidate, rank), candidate.score + "%", yearsValue(candidate), backgroundExperience(candidate), currentEmployerTypeValue(candidate), currentCompanyClassification(candidate), keyStrength(candidate, candidatesForExport), commercialRiskLabel(candidate, activeModule), compactValidationLabels(candidate, activeModule), recommendationStatus(index) === "Shortlisted" ? "Shortlisted" : "Review"];
  };
  const sheets: Array<{ name: string; rows: any[][]; headerRow: number; filterRow?: number; widths: number[] }> = [
    { name: "Executive Summary", headerRow: 1, widths: [28, 90], rows: [["Primus AI Recruiter™ - Executive Candidate Comparison"], ["Field", "Value"], ["Generated", generatedDate], ["Search ID", reportMeta.searchId || "Current Search"], ["Module", moduleLabel], ["Search Size", currentSearchCount + " candidates"], ["Compared Candidates", candidatesForExport.map((candidate, index) => candidateExportName(candidate, globalSearchRank(candidate, index))).join(", ") || "None"], ["Recommended Candidate", recommendation.candidate ? candidateExportName(recommendation.candidate, 1) : ""], ["Alternative Candidate", recommendation.backup ? candidateExportName(recommendation.backup) : ""], ["Submission Readiness", confidence ? confidence.score + "% " + commercialReadinessLabel(confidence) : "0% Pending Commercial Validation"], ["Requirement Match", requirementMatchSummary(coverage).text], ["Why This Candidate", recommendation.whySelected.join("; ")], ["Required Validation", outstandingValidationText(confidence)]] },
    { name: "Top Candidates", headerRow: 1, filterRow: 1, widths: [8, 28, 12, 14, 24, 18, 22, 46, 18, 24, 18], rows: [["Top Candidates"], ["Rank", "Candidate", "AI Match", "SAP Years", "Background", "Current Company", "Company Type", "Key Strength", "Risk", "Validation", "Status"], ...candidatesForExport.slice(0, 5).map(rowFor)] },
    { name: "Matrix", headerRow: 1, filterRow: 1, widths: [8, 28, 12, 14, 24, 18, 22, 46, 18, 24, 16], rows: [["Executive Matrix"], ["Rank", "Candidate", "AI Match", "SAP Years", "Background", "Current Company", "Company Type", "Key Strength", "Risk", "Validation", "Shortlisted"], ...candidatesForExport.slice(0, 20).map(rowFor)] },
    { name: "Recruiter Actions", headerRow: 1, filterRow: 1, widths: [28, 16, 18, 16, 24, 22, 58], rows: [["Recruiter Action Checklist"], ["Candidate", "Confirm Salary", "Confirm Availability", "Confirm Notice", "Confirm Current Employer", "Validate Architecture", "Immediate Next Action"], ...candidatesForExport.slice(0, 20).map((candidate, index) => { const rank = globalSearchRank(candidate, index); const itemConfidence = submissionConfidence(candidate, activeModule); const backup = candidatesForExport.find((item) => item.id !== candidate.id); return [candidateExportName(candidate, rank), "[ ]", "[ ]", "[ ]", "[ ]", "[ ]", immediateNextAction(candidate, backup, itemConfidence)]; })] },
  ];
  const applyStyle = (ws: XLSX.WorkSheet, rows: any[][], headerRow: number, filterRow?: number, widths: number[] = []) => {
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    ws["!freeze"] = { xSplit: 0, ySplit: headerRow + 1 } as any;
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(range.e.c, 1) } }];
    if (typeof filterRow === "number") ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: filterRow, c: 0 }, e: { r: rows.length - 1, c: range.e.c } }) } as any;
    for (let r = range.s.r; r <= range.e.r; r += 1) for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const value = String(cell.v ?? "");
      const isTitle = r === 0;
      const isHeader = r === headerRow;
      const matchNumber = /%$/.test(value) ? Number(value.replace("%", "")) : NaN;
      const matchFill = Number.isFinite(matchNumber) ? (matchNumber >= 90 ? "DCFCE7" : matchNumber >= 80 ? "FEF3C7" : "FCE7F3") : undefined;
      const riskFill = /high/i.test(value) ? "FEE2E2" : /medium/i.test(value) ? "FEF3C7" : /low/i.test(value) ? "DCFCE7" : undefined;
      const shortlistedFill = /shortlisted/i.test(value) ? "DCFCE7" : undefined;
      cell.s = { font: { name: "Aptos", sz: isTitle ? 14 : 10, bold: isTitle || isHeader, color: { rgb: isTitle || isHeader ? "FFFFFF" : "0F172A" } }, fill: { fgColor: { rgb: isTitle || isHeader ? "0F172A" : shortlistedFill || riskFill || matchFill || (r % 2 === 0 ? "F8FAFC" : "FFFFFF") } }, border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } }, alignment: { wrapText: true, vertical: "top" } } as any;
    }
  };
  sheets.forEach((sheet) => { const ws = XLSX.utils.aoa_to_sheet(sheet.rows); applyStyle(ws, sheet.rows, sheet.headerRow, sheet.filterRow, sheet.widths); XLSX.utils.book_append_sheet(wb, ws, sheet.name); });
  XLSX.writeFile(wb, exportFileName("candidate-compare", "xlsx"));
}

type SubmissionTemplateKey = "Client Email" | "Executive Brief" | "Hiring Manager Brief" | "WhatsApp" | "Recruiter Checklist" | "Positioning" | "LinkedIn Message" | "Teams Update" | "Client Meeting Notes" | "Interview Debrief" | "Submission Cover Sheet";

type SubmissionWorkflowGroup = { label: "CLIENT DELIVERABLES" | "INTERNAL RECRUITER" | "ACCOUNT STRATEGY"; items: SubmissionTemplateKey[] };

const SUBMISSION_WORKFLOWS: SubmissionWorkflowGroup[] = [
  { label: "CLIENT DELIVERABLES", items: ["Client Email", "Executive Brief", "Hiring Manager Brief", "WhatsApp", "LinkedIn Message", "Teams Update", "Client Meeting Notes", "Submission Cover Sheet"] },
  { label: "INTERNAL RECRUITER", items: ["Recruiter Checklist", "Interview Debrief"] },
  { label: "ACCOUNT STRATEGY", items: ["Positioning"] },
];
const SUBMISSION_TEMPLATES: SubmissionTemplateKey[] = SUBMISSION_WORKFLOWS.flatMap((group) => group.items);
const SUBMISSION_SECTIONS = SUBMISSION_TEMPLATES;

const SUBMISSION_OUTPUT_PROFILES: Record<SubmissionTemplateKey, { audience: string; tone: string; length: string }> = {
  "Client Email": { audience: "Client", tone: "Professional", length: "Standard" },
  "Executive Brief": { audience: "Executive", tone: "Executive", length: "One Page" },
  "Hiring Manager Brief": { audience: "Hiring Manager", tone: "Technical", length: "Medium" },
  "WhatsApp": { audience: "Client", tone: "Conversational", length: "Short" },
  "Recruiter Checklist": { audience: "Recruiter", tone: "Internal", length: "Checklist" },
  "Positioning": { audience: "Recruiter", tone: "Sales Strategy", length: "Medium" },
  "LinkedIn Message": { audience: "Client", tone: "Professional", length: "Short" },
  "Teams Update": { audience: "Internal", tone: "Concise", length: "Short" },
  "Client Meeting Notes": { audience: "Recruiter", tone: "Meeting Prep", length: "Medium" },
  "Interview Debrief": { audience: "Recruiter", tone: "Internal", length: "Checklist" },
  "Submission Cover Sheet": { audience: "Client", tone: "Executive", length: "One Page" },
};
type SubmissionClientType = "Consulting" | "Enterprise" | "Partner" | "Internal";
type SubmissionAudience = "HR" | "Hiring Manager" | "Executive" | "Recruiter";
type SubmissionTone = "Professional" | "Consultative" | "Executive";
type SubmissionEmailLength = "Short" | "Standard" | "Long";

type SubmissionConfig = {
  clientContext: string;
  clientType: SubmissionClientType;
  audience: SubmissionAudience;
  tone: SubmissionTone;
  emailLength: SubmissionEmailLength;
};

const DEFAULT_SUBMISSION_CONFIG: SubmissionConfig = {
  clientContext: "Current SAP search",
  clientType: "Enterprise",
  audience: "Executive",
  tone: "Consultative",
  emailLength: "Standard",
};

type SubmissionContent = {
  decision?: DecisionObject;
  templates: Record<SubmissionTemplateKey, string>;
  sections: Record<string, string>;
  internalNotes: string;
};

type DecisionRisk = {
  label: string;
  risk: "Low" | "Medium" | "High";
  evidence: string;
  mitigation: string;
  confidence: number;
};

type DecisionObject = {
  candidate?: CandidateCompareSignal;
  backup?: CandidateCompareSignal;
  module: string;
  clientContext: string;
  decision: string;
  whySelected: string[];
  businessImpact: string[];
  commercialStatus: string;
  risks: DecisionRisk[];
  validationNeeded: string[];
  competitiveDifference: string[];
  evidence: string[];
  confidence: { executive: number; coverage: number; commercial: string };
  recruiterAction: string;
  clientAction: string;
  hiringManagerFocus: string[];
  interviewQuestions: string[];
  salesTalkingPoints: string[];
  internalNotes: string[];
  insights: string[];
  reasoning: DecisionReasoning;
};

function bulletList(items: string[]) {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n") || "- Pending validation";
}

function numberedList(items: string[]) {
  return items.filter(Boolean).map((item, index) => `${index + 1}. ${item}`).join("\n") || "1. Pending validation";
}

function submissionLine(label: string, value: string) {
  return `${label}: ${value || "Pending validation"}`;
}

function submissionEvidence(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  return submissionDecisionSignals(candidate, ranked, activeModule);
}

function submissionValidation(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  if (!candidate) return ["Pending validation"];
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  return confidence.pending.length ? Array.from(new Set(confidence.pending.map(shortValidationLabel))).slice(0, 6) : ["Final recruiter confirmation"];
}

function submissionInterviewFocus(candidate: CandidateCompareSignal | undefined) {
  const focus = ["Architecture ownership", "Transformation accountability", "Team leadership", "Workshop facilitation", "Stakeholder management"];
  if (!candidate) return ["Pending validation"];
  if (!hasText(candidate, ["team", "lead", "managed"])) focus.push("Leadership scope");
  if (!hasText(candidate, ["workshop", "stakeholder", "client-facing", "client facing"])) focus.push("Client-facing responsibilities");
  return Array.from(new Set(focus)).slice(0, 6);
}

function submissionCommercialReadiness(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  if (!candidate) return "0% Commercial Validation Required";
  return commercialReadinessValue(submissionConfidence(candidate, activeModule || candidate.module));
}

function submissionExecutiveConfidence(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  if (!candidate) return 0;
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  return Math.round(candidate.score * 0.72 + confidence.score * 0.28);
}

function commercialStatus(value: string): "Verified" | "Pending" | "Missing" {
  if (!value || /not disclosed|to confirm|unknown|pending validation/i.test(value)) return "Missing";
  if (/pending|confirm|required/i.test(value)) return "Pending";
  return "Verified";
}

function commercialValidationRows(candidate: CandidateCompareSignal | undefined) {
  if (!candidate) return [];
  const rows = [
    ["Salary", expectedPackageValue(candidate)],
    ["Availability", availabilityValue(candidate)],
    ["Notice", noticeValue(candidate)],
    ["Buyout", displayValue(rawValue(candidate, ["buyout", "buyout_option", "notice_buyout"]), "Pending validation")],
    ["Location", displayValue(candidate.location, "Pending validation")],
    ["Relocation", displayValue(rawValue(candidate, ["relocation", "relocate", "relocation_status"]), "Pending validation")],
    ["Travel", travelValue(candidate)],
    ["Visa", workRightsValue(candidate)],
    ["Communication", clientFacingRole(candidate) === "To confirm" ? "Pending validation" : "Validated signal"],
  ];
  return rows.map(([label, value]) => ({ label, value, status: commercialStatus(value) }));
}

function requirementAlignment(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  const coverage = jdCoverage(candidate, activeModule);
  return coverage.requirements.map((item) => ({
    requirement: item.label,
    status: item.state === "Matched" ? "Matched" : item.state === "Partial Match" ? "Partial" : "Missing",
    evidence: item.state === "Matched" ? `${item.label} supports mandate fit and reduces client evaluation risk.` : item.state === "Partial Match" ? `${item.label} may support the mandate, but ownership should be verified before positioning.` : "Evidence not yet confirmed.",
  }));
}

function candidateSnapshotRows(candidate: CandidateCompareSignal | undefined) {
  if (!candidate) return [];
  return [
    ["Experience", yearsValue(candidate)],
    ["Industry", rawList(candidate, ["industry", "industries", "sector"])],
    ["Modules", displaySapModule(candidate)],
    ["Transformation", hasText(candidate, ["transformation", "rollout", "migration", "greenfield"]) ? "Validated signal" : "Ownership requires further validation"],
    ["Architecture", architectureRole(candidate)],
    ["Implementation", implementationCount(candidate) ? `${implementationCount(candidate)} implementation signals` : hasText(candidate, ["implementation", "go-live"]) ? "Implementation risk signal present" : "Ownership requires further validation"],
    ["Leadership", teamResponsibility(candidate)],
    ["Languages", rawList(candidate, ["languages", "language"])],
    ["Certifications", rawList(candidate, ["certifications", "certification", "certificates"])],
    ["Delivery Geography", rawList(candidate, ["countries", "regional_experience", "coverage", "location"]) || candidate.location],
  ];
}

function validationNouns(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  return submissionValidation(candidate, activeModule).filter((item) => !/final recruiter/i.test(item)).slice(0, 4);
}

function validationActionSentence(items: string[]) {
  const blockers = items.filter((item) => !/final recruiter/i.test(item));
  const hasSalary = blockers.some((item) => /salary|package|compensation/i.test(item));
  const hasAvailability = blockers.some((item) => /availability/i.test(item));
  const hasNotice = blockers.some((item) => /notice/i.test(item));
  if (hasSalary && hasAvailability && hasNotice) return "Confirm salary, availability and notice period before client submission.";
  if (blockers.length > 1) return `Confirm ${blockers.slice(0, 3).map((item) => item.toLowerCase()).join(", ")} before client submission.`;
  if (blockers[0]) return `Confirm ${blockers[0].toLowerCase()} before client submission.`;
  return "Release the profile for client interview review.";
}

function explainabilityLabel(label: string) {
  if (/^sap\s+/i.test(label)) return label.replace(/^sap\s+/i, "SAP ");
  if (/notice/i.test(label)) return "Notice";
  if (/salary|package|compensation/i.test(label)) return "Salary";
  if (/availability/i.test(label)) return "Availability";
  return label;
}

function confidenceDriverLabels(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return [];
  const drivers: string[] = [];
  if (implementationCount(candidate) || hasText(candidate, ["implementation", "go-live", "go live", "full cycle", "rollout"])) drivers.push("Strong implementation ownership");
  if (hasText(candidate, ["transformation", "greenfield", "migration", "rollout", "multi-country", "global template"])) drivers.push("Enterprise transformation experience");
  if (s4hanaCount(candidate) || hasText(candidate, ["s/4hana", "s4hana", "s4 hana"])) drivers.push("S/4HANA relevance");
  if (architectureRole(candidate) !== "To confirm") drivers.push("Architecture accountability");
  if (clientFacingRole(candidate) !== "To confirm") drivers.push("Client-facing delivery");
  return Array.from(new Set(drivers.length ? drivers : whyCandidateBullets(candidate, ranked, activeModule))).slice(0, 5);
}

function confidenceLimiterLabels(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  return validationNouns(candidate, activeModule).map(explainabilityLabel).slice(0, 5);
}

function coverageExplainability(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  const coverage = jdCoverage(candidate, activeModule);
  const matched = coverage.requirements.filter((item) => item.state === "Matched").map((item) => explainabilityLabel(item.label)).slice(0, 5);
  const needsValidation = coverage.requirements.filter((item) => item.state !== "Matched").map((item) => explainabilityLabel(item.label)).slice(0, 5);
  const commercialPending = validationNouns(candidate, activeModule).length > 0;
  if (commercialPending && !needsValidation.some((item) => /commercial/i.test(item))) needsValidation.unshift("Commercial readiness");
  return { coverage, matched, needsValidation };
}

function commercialReadinessExplainability(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  const confidence = candidate ? submissionConfidence(candidate, activeModule || candidate.module) : null;
  const rows = commercialValidationRows(candidate);
  const confirmed = rows.filter((item) => item.status === "Verified").map((item) => explainabilityLabel(item.label)).slice(0, 5);
  const pending = rows.filter((item) => item.status !== "Verified").map((item) => explainabilityLabel(item.label)).slice(0, 5);
  return { value: confidence ? commercialReadinessValue(confidence) : "Pending validation", confirmed, pending, action: firstValidationAction(candidate, activeModule) };
}

function ExplainabilityList({ title, items, icon = "check" }: { title: string; items: string[]; icon?: "check" | "limit" }) {
  const titleLower = title.toLowerCase();
  const visual = titleLower.includes("matched") ? "bg-cyan-500/10 text-cyan-100 ring-cyan-500/20" : titleLower.includes("pending") ? "bg-slate-700/40 text-slate-300 ring-slate-700/60" : titleLower.includes("validation") || titleLower.includes("limiter") ? "bg-amber-500/10 text-amber-100 ring-amber-500/25" : "bg-emerald-500/10 text-emerald-100 ring-emerald-500/25";
  const marker = titleLower.includes("validation") || titleLower.includes("limiter") ? "?" : "?";
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {(items.length ? items : ["Needs recruiter validation"]).map((item, index) => (
          <span key={`${title}-${item}-${index}`} className={visual + " inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"}><span>{marker}</span><span>{item}</span></span>
        ))}
      </div>
    </div>
  );
}
function firstValidationAction(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  return validationActionSentence(validationNouns(candidate, activeModule));
}
function decisionImplication(signal: string) {
  if (/implementation|delivery|go-live|rollout/i.test(signal)) return "Proven delivery ownership lowers onboarding risk for the client.";
  if (/architecture|solution/i.test(signal)) return "Clearer architecture accountability gives the client a stronger design-governance story.";
  if (/s\/4hana|transformation|greenfield|migration/i.test(signal)) return "Mandate relevance is stronger for enterprise transformation rather than support-only work.";
  if (/client|stakeholder|workshop|consulting/i.test(signal)) return "Client-facing delivery signals should improve stakeholder confidence in interview.";
  if (/leadership|team|managed/i.test(signal)) return "Leadership signals give the client a more credible workstream ownership narrative.";
  return signal.endsWith(".") ? signal : `${signal}.`;
}

function submissionDecisionSignals(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return ["Evidence not yet confirmed."];
  return Array.from(new Set(whyCandidateBullets(candidate, ranked, activeModule).map(decisionImplication))).slice(0, 5);
}
function retainedSearchQualityGate(value: string) {
  const consequencePattern = /risk|decision|commercial|delivery|governance|confidence|validation|release|onboarding|stakeholder|transformation|mandate|client|business|interview|offer|joining|accountability/i;
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return true;
      if (/^[A-Z][A-Za-z\s()]+:?$/.test(line)) return true;
      if (/^[-0-9.\s]*$/.test(line)) return true;
      return consequencePattern.test(line);
    })
    .join("\n")
    .replace(/\bstrong candidate\b/gi, "lower-risk interview option")
    .replace(/\bgood communication\b/gi, "stakeholder confidence signal")
    .replace(/\bexcellent experience\b/gi, "evidence that changes the client decision")
    .replace(/\bsuitable profile\b/gi, "defensible first-interview option")
    .trim();
}

function businessValueItems(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return ["Needs recruiter validation before client value can be positioned."];
  const evidence = submissionEvidence(candidate, ranked, activeModule).join(" ").toLowerCase();
  const items: string[] = [];
  if (/implementation|delivery|go-live|rollout/.test(evidence) || hasText(candidate, ["implementation", "go-live", "rollout"])) items.push("Lower onboarding risk through proven delivery ownership in SAP programmes.");
  if (/architecture|solution/.test(evidence) || hasText(candidate, ["architecture", "solution design"])) items.push("Stronger architecture accountability for design decisions and early governance.");
  if (/client|stakeholder|workshop/.test(evidence) || hasText(candidate, ["client", "stakeholder", "workshop"])) items.push("Increase stakeholder confidence during design workshops and early scope governance.");
  if (/s\/4hana|transformation|greenfield|migration/.test(evidence) || hasText(candidate, ["s/4hana", "transformation", "greenfield", "migration"])) items.push("Reduce transformation mis-hire risk because the evidence points to enterprise rollout work, not support-only delivery.");
  if (/leadership|team/.test(evidence) || hasText(candidate, ["lead", "team", "managed"])) items.push("Improve delivery leverage by giving the client senior oversight for junior consultants and workstream execution.");
  return (items.length ? items : ["Needs recruiter validation before client value can be positioned."]).slice(0, 5);
}

function executiveRecommendation(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "Select a candidate to generate an executive recommendation.";
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const coverage = jdCoverage(candidate, activeModule);
  const signals = submissionDecisionSignals(candidate, ranked, activeModule);
  const validation = validationNouns(candidate, activeModule);
  const deliveryRisk = signals.some((item) => /lower|stronger|higher|enterprise transformation/i.test(item)) ? "low" : "needs recruiter validation";
  const alternatives = ranked.length > 1 ? `Compared with ${ranked.length - 1} alternative shortlisted profile${ranked.length > 2 ? "s" : ""}, this is the most defensible first submission.` : "No alternative shortlist has been provided for calibration.";
  const commercial = validation.length ? `Commercial confidence is limited only by ${validation.slice(0, 3).map((item) => item.toLowerCase()).join(", ")}.` : "Commercial confidence is sufficient for release subject to final recruiter confirmation.";
  return retainedSearchQualityGate([
    `Decision: If the client interviews only one person today, it should be ${candidateDisplayName(candidate)}. The decision is driven by lower delivery risk and stronger enterprise SAP ${normalizeModule(activeModule || candidate.module)} relevance than the remaining shortlist.`,
    `Decision consequence: ${alternatives} Requirement coverage is ${coverage.percent}% and Executive Confidence is ${submissionExecutiveConfidence(candidate, activeModule)}%, creating enough evidence to move from screening to client decision.`,
    `Client value: ${businessValueItems(candidate, ranked, activeModule)[0]}`,
    `Commercial position: ${commercial} Technical delivery risk is considered ${deliveryRisk}.`,
    `Recommended action: ${firstValidationAction(candidate, activeModule)}`,
  ].join("\n\n"));
}

function clientRiskAssessment(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string): DecisionRisk[] {
  if (!candidate) return [];
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const evidence = submissionEvidence(candidate, ranked, activeModule);
  const commercialPending = validationNouns(candidate, activeModule);
  const hasArchitecture = evidence.some((item) => /architecture|solution/i.test(item));
  const hasImplementation = evidence.some((item) => /implementation|delivery|s\/4hana|transformation/i.test(item));
  const hasClient = hasText(candidate, ["client", "stakeholder", "workshop", "presentation"]);
  return [
    { label: "Delivery Risk", risk: hasImplementation || hasArchitecture ? "Low" : "Medium", evidence: hasImplementation || hasArchitecture ? "Delivery risk is lower because programme accountability and architecture responsibility are both visible." : "Ownership requires further validation.", mitigation: "Use the first interview to verify personal accountability for programme outcomes, not participation.", confidence: Math.max(55, Math.min(94, candidate.score)) },
    { label: "Commercial Risk", risk: commercialPending.length ? "Medium" : "Low", evidence: commercialPending.length ? `${commercialPending.slice(0, 3).join(", ")} remain pending.` : "Commercial risk is not the current gating issue.", mitigation: firstValidationAction(candidate, activeModule), confidence: Math.max(45, Math.min(92, confidence.score)) },
    { label: "Retention Risk", risk: /contract|freelance|project/i.test(candidate.text || "") ? "Medium" : "Low", evidence: /contract|freelance|project/i.test(candidate.text || "") ? "Retention risk requires motivation validation because project-based history is present." : "No material retention risk is visible in the parsed evidence.", mitigation: "Confirm motivation, target role, and expected engagement model.", confidence: 68 },
    { label: "Interview Risk", risk: hasClient ? "Low" : "Medium", evidence: hasClient ? "Interview risk is lower because stakeholder-facing delivery is visible." : "Stakeholder governance requires further validation.", mitigation: "Ask for examples of steering committee, workshop, and stakeholder handling.", confidence: hasClient ? 82 : 61 },
    { label: "Offer Risk", risk: commercialPending.some((item) => /salary|package/i.test(item)) ? "Medium" : "Low", evidence: commercialPending.some((item) => /salary|package/i.test(item)) ? "Compensation alignment is not yet validated." : "Offer risk is not currently driven by compensation evidence.", mitigation: "Confirm current package, expected package, and acceptable range before client submission.", confidence: Math.max(45, Math.min(88, confidence.score)) },
    { label: "Joining Risk", risk: commercialPending.some((item) => /availability|notice/i.test(item)) ? "Medium" : "Low", evidence: commercialPending.some((item) => /availability|notice/i.test(item)) ? "Availability or notice period remains open." : "Joining risk is not currently driven by availability or notice evidence.", mitigation: "Confirm earliest start date, notice period, and buyout feasibility.", confidence: Math.max(45, Math.min(88, confidence.score)) },
  ];
}

function riskAssessmentText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  return clientRiskAssessment(candidate, ranked, activeModule).map((item) => `${item.label}\nRisk: ${item.risk}\nEvidence: ${item.evidence}\nMitigation: ${item.mitigation}\nAI confidence: ${item.confidence}%`).join("\n\n") || "Pending validation";
}

function whyNotDecisionReasons(candidate: CandidateCompareSignal, recommended: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  const reasons = whyNotReasons(candidate, recommended, ranked, activeModule);
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const out: string[] = [];
  if (reasons[0]) out.push(`${reasons[0]} keeps this profile behind the recommended submission.`);
  if (confidence.pending.some((item) => /salary|package|commercial/i.test(item))) out.push("Salary or package confirmation is less clear.");
  if (confidence.pending.some((item) => /availability|notice/i.test(item))) out.push("Timing risk should be clarified before positioning as first submission.");
  if (!hasText(candidate, ["architecture", "solution architect", "solution design"])) out.push("Architecture accountability needs recruiter validation before this profile leads the slate.");
  if (!hasText(candidate, ["implementation", "go-live", "rollout", "transformation"])) out.push("Solution responsibility needs recruiter validation before this person leads the slate.");
  return Array.from(new Set(out.length ? out : reasons.map((item) => `${candidateDisplayName(candidate)} is not first because ${item.toLowerCase()}.`))).slice(0, 2);
}

function whyNotOthersText(ranked: CandidateCompareSignal[], activeModule: string) {
  const recommended = ranked[0];
  return ranked.slice(1).map((item) => `${item.name}\n${whyNotDecisionReasons(item, recommended, ranked, activeModule).map((reason) => `- ${reason}`).join("\n")}`).join("\n\n") || "No alternative candidates selected for comparison.";
}

function interviewStrategyText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "Pending validation";
  const focus = submissionInterviewFocus(candidate).slice(0, 5);
  const risks = clientRiskAssessment(candidate, ranked, activeModule).filter((item) => item.risk !== "Low").slice(0, 3);
  const validation = validationNouns(candidate, activeModule);
  return [
    "Suggested interview focus",
    focus.map((item) => `- ${item}`).join("\n"),
    "",
    "Potential concerns",
    (risks.length ? risks.map((item) => `- ${item.label}: ${item.evidence}`) : ["- No material non-commercial concern identified from parsed evidence."]).join("\n"),
    "",
    "Questions to verify",
    ["Describe the SAP design decisions personally owned.", "Which implementation outcomes were accountable deliverables?", "Where did stakeholder management materially affect delivery?", ...validation.map((item) => `Confirm ${item.toLowerCase()}.`)].slice(0, 6).map((item) => `- ${item}`).join("\n"),
    "",
    "Red flags",
    ["Ownership sounds like participation rather than personal accountability.", "Compensation misalignment.", "Availability does not match client timeline."].map((item) => `- ${item}`).join("\n"),
    "",
    "Client discussion topics",
    businessValueItems(candidate, ranked, activeModule).slice(0, 4).map((item) => `- ${item.replace(/\.$/, "")}`).join("\n"),
  ].join("\n");
}

function recruiterTalkingPoints(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "Pending validation";
  const evidence = submissionEvidence(candidate, ranked, activeModule);
  const action = firstValidationAction(candidate, activeModule);
  const value = businessValueItems(candidate, ranked, activeModule);
  return [
    "60 second pitch",
    `${candidateDisplayName(candidate)} is the first submission because ${evidence.slice(0, 2).map((item) => item.toLowerCase()).join(" and ")}. ${action}`,
    "",
    "3 minute pitch",
    `${candidateDisplayName(candidate)} should be positioned around delivery accountability, not tenure. The client value is clear: ${value.slice(0, 2).map((item) => item.toLowerCase()).join(" ")} ${action}`,
    "",
    "Executive pitch",
    `Interview this person first if the client wants to reduce delivery ambiguity and test enterprise SAP ${normalizeModule(activeModule || candidate.module)} transformation accountability immediately.`,
    "",
    "Sales pitch",
    `Lead with this profile first: it gives the client the clearest interview story while keeping commercial alignment transparent.`,
    "",
    "LinkedIn summary",
    `SAP ${normalizeModule(activeModule || candidate.module)} submission positioned around delivery-risk reduction, architecture maturity and transformation relevance. Commercial validation remains explicit.`,
    "",
    "Phone introduction",
    `I am calling with the most defensible first interview option from the SAP ${normalizeModule(activeModule || candidate.module)} shortlist. The decision is based on delivery-risk reduction, enterprise transformation relevance and transparent commercial validation.`,
  ].join("\n");
}

function clientPersonaFor(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  if (!candidate) return "Recruiter validation";
  if (hasText(candidate, ["architecture", "solution design", "design authority"])) return "CIO / Enterprise Architect";
  if (hasText(candidate, ["implementation", "go-live", "rollout", "delivery"])) return "Delivery Director";
  if (hasText(candidate, ["stakeholder", "workshop", "client-facing", "presentation"])) return "Hiring Manager / Programme Sponsor";
  if (validationNouns(candidate, activeModule).length) return "Recruiter / Account Manager";
  return "CIO / Hiring Manager";
}

function businessPositionFor(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string, index: number) {
  if (!candidate) return "Ownership requires further validation";
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const signals = submissionDecisionSignals(candidate, ranked, activeModule).join(" ");
  if (index === 0) return "Lowest-risk first interview";
  if (confidence.pending.some((item) => /salary|availability|notice|package/i.test(item))) return "Commercially conditional alternative";
  if (/architecture|governance/i.test(signals)) return "Architecture validation alternative";
  if (/transformation|rollout|delivery/i.test(signals)) return "Delivery validation alternative";
  return "Hold for evidence validation";
}

function bestInterviewStageFor(candidate: CandidateCompareSignal | undefined, activeModule: string, index: number) {
  if (!candidate) return "Recruiter validation";
  const validation = validationNouns(candidate, activeModule);
  if (index === 0 && !validation.length) return "First client interview";
  if (validation.some((item) => /salary|availability|notice|package/i.test(item))) return "Recruiter commercial validation";
  if (validation.some((item) => /architecture|implementation|ownership/i.test(item))) return "Technical ownership validation";
  return index <= 1 ? "Client shortlist calibration" : "Backup validation stage";
}

function positioningMatrixText(ranked: CandidateCompareSignal[], activeModule: string) {
  if (!ranked.length) return "POSITIONING MATRIX\nNo shortlisted candidates selected.";
  const rows = ranked.map((candidate, index) => {
    const signals = submissionDecisionSignals(candidate, ranked, activeModule);
    const validation = validationNouns(candidate, activeModule);
    const confidence = submissionConfidence(candidate, activeModule || candidate.module);
    const primary = signals[0] || "Ownership requires further validation.";
    const weakest = validation[0] ? `${validation[0]} requires validation before client submission.` : signals.length > 1 ? "Commercial readiness still requires final recruiter confirmation." : "Ownership requires further validation.";
    const businessPosition = businessPositionFor(candidate, ranked, activeModule, index);
    const persona = clientPersonaFor(candidate, activeModule);
    const stage = bestInterviewStageFor(candidate, activeModule, index);
    const threat = index === 0
      ? "Sets the benchmark for delivery-risk reduction across the shortlist."
      : confidence.score >= 70
        ? "Could challenge the recommended profile if validation closes quickly."
        : "Threat is limited until commercial or ownership validation improves.";
    const priority = index === 0 ? "1 - Interview first" : index === 1 ? "2 - Backup if release risk changes" : validation.length ? "3 - Hold pending validation" : "3 - Keep warm for calibration";
    return [
      candidateDisplayName(candidate),
      `Primary Selling Point: ${primary}`,
      `Weakest Selling Point: ${weakest}`,
      `Business Position: ${businessPosition}`,
      `Client Persona: ${persona}`,
      `Best Interview Stage: ${stage}`,
      `Competitive Threat: ${threat}`,
    ].join("\n");
  });
  return ["POSITIONING MATRIX", "", ...rows].join("\n\n");
}
function whyInterviewFirstText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "Decision\nOwnership requires further validation.\n\nClient Value\nNeeds recruiter validation before a first-interview recommendation.\n\nCommercial Position\nCommercial readiness requires validation.\n\nDelivery Position\nOwnership requires further validation.\n\nRisk if Not Selected\nNo defensible risk trade-off can be asserted until evidence is confirmed.\n\nRecommended Action\nValidate ownership, commercial alignment and availability before client positioning.\n\nConfidence\nPending validation.";
  const coverage = jdCoverage(candidate, activeModule).percent;
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const executive = submissionExecutiveConfidence(candidate, activeModule);
  const validation = validationNouns(candidate, activeModule);
  const value = businessValueItems(candidate, ranked, activeModule);
  const risks = clientRiskAssessment(candidate, ranked, activeModule);
  const deliveryRisk = risks.find((item) => item.label === "Delivery Risk");
  const commercialRisk = risks.find((item) => item.label === "Commercial Risk");
  const alternatives = ranked.slice(1);
  const whyNot = alternatives.slice(0, 2).flatMap((item) => whyNotDecisionReasons(item, candidate, ranked, activeModule)).slice(0, 2);
  const comparison = alternatives.length ? `Compared with ${alternatives.length} alternative shortlisted profile${alternatives.length > 1 ? "s" : ""}, this candidate creates the clearest first-interview case because requirement coverage is ${coverage}% and Executive Confidence is ${executive}%.` : `Requirement match is ${coverage}% and Executive Confidence is ${executive}%; recruiter calibration is still required because no alternative slate is available.`;
  const commercial = validation.length ? `Commercial readiness is conditional. ${validation.slice(0, 3).join(", ")} must be confirmed before final client submission.` : "Commercial risk is not the current gating issue; final recruiter confirmation remains required.";
  const riskIfNot = whyNot.length ? `Passing on this candidate first increases the chance of leading with a slate option where ${whyNot.map((item) => item.replace(/^[^-:]+:\s*/, "").toLowerCase()).join(" ")}` : "Passing on this candidate first may delay the lowest-risk interview path identified by the current comparison signals.";
  return [
    "Decision",
    `Interview ${candidateDisplayName(candidate)} first if the client wants the lowest-risk decision today. ${comparison}`,
    "",
    "Client Value",
    value.slice(0, 2).join(" "),
    "",
    "Commercial Position",
    commercial,
    "",
    "Delivery Position",
    deliveryRisk?.evidence || "Ownership requires further validation.",
    "",
    "Risk if Not Selected",
    riskIfNot,
    "",
    "Recommended Action",
    firstValidationAction(candidate, activeModule),
    "",
    "Confidence",
    `${executive}% Executive Confidence. ${commercialRisk ? `Commercial risk: ${commercialRisk.risk}.` : "Commercial risk pending validation."}`,
  ].join("\n");
}
function positioningStrategyText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "POSITIONING STRATEGY\n\nPrimary Positioning\nOwnership requires further validation.\n\nSecondary Positioning\nPending validation.\n\nAvoid Positioning\nDo not position on tenure, certifications or generic SAP experience.\n\nCompetitive Advantage\nPending validation.\n\nBusiness Narrative\nPending validation.\n\nExecutive Soundbite (30 words)\nOwnership requires further validation before this candidate should be positioned as the lowest-risk first interview.";
  const module = normalizeModule(activeModule || candidate.module);
  const value = businessValueItems(candidate, ranked, activeModule);
  const signals = submissionDecisionSignals(candidate, ranked, activeModule);
  const validation = validationNouns(candidate, activeModule);
  const coverage = jdCoverage(candidate, activeModule).percent;
  const confidence = submissionExecutiveConfidence(candidate, activeModule);
  const alternativeCount = Math.max(0, ranked.length - 1);
  const primary = `Position ${candidateDisplayName(candidate)} as the lowest-risk first interview for SAP ${module}: the story is delivery-risk reduction, not resume breadth.`;
  const secondary = signals[1] || value[1] || "Ownership requires further validation before secondary positioning is asserted.";
  const avoid = validation.length ? `Do not oversell commercial readiness. Lead with transparent validation on ${validation.slice(0, 3).map((item) => item.toLowerCase()).join(", ")}. Avoid tenure-led positioning.` : "Do not position on tenure, certifications or generic SAP capability. Keep the narrative anchored to delivery risk and mandate fit.";
  const advantage = alternativeCount ? `Compared with ${alternativeCount} alternative shortlisted profile${alternativeCount > 1 ? "s" : ""}, this candidate creates the clearest path to a defensible first interview because coverage is ${coverage}% and Executive Confidence is ${confidence}%.` : `Executive Confidence is ${confidence}% with ${coverage}% requirement match; use this only after recruiter calibration because no alternative slate is available.`;
  const narrative = `${value.slice(0, 3).join(" ")} The client conversation should connect these outcomes to faster onboarding, stronger governance and reduced transformation execution risk.`;
  const soundbite = sentenceLimit(`${candidateDisplayName(candidate)} should be positioned as the first interview because the evidence reduces delivery risk, improves governance confidence and keeps commercial validation transparent before client submission.`, 30);
  return [
    "Positioning",
    "",
    "Primary Positioning",
    primary,
    "",
    "Secondary Positioning",
    secondary,
    "",
    "Avoid Positioning",
    avoid,
    "",
    "Competitive Advantage",
    advantage,
    "",
    "Business Narrative",
    narrative,
    "",
    "Executive Soundbite (30 words)",
    soundbite,
  ].join("\n");
}

function aiInsightItems(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return ["Ownership requires further validation before any executive insight can be asserted.", "Commercial readiness cannot be interpreted until validation data is available.", "Delivery confidence remains unproven without accountable implementation evidence.", "The shortlist cannot be sequenced without comparable business-positioning signals.", "Client interview strategy should remain paused until evidence quality improves."];
  const coverage = jdCoverage(candidate, activeModule).percent;
  const confidence = submissionConfidence(candidate, activeModule || candidate.module);
  const executive = submissionExecutiveConfidence(candidate, activeModule);
  const validation = validationNouns(candidate, activeModule);
  const recommendedScore = candidate.score || 0;
  const backup = ranked.find((item) => item.id !== candidate.id);
  const backupScore = backup?.score || 0;
  const qualityGap = Math.max(0, Math.round(recommendedScore - backupScore));
  const hasArchitecture = hasText(candidate, ["architecture", "solution architect", "solution design", "design authority"]);
  const hasTransformation = hasText(candidate, ["transformation", "s/4hana", "greenfield", "rollout", "migration"]);
  const hasStakeholder = hasText(candidate, ["stakeholder", "workshop", "client-facing", "presentation"]);
  return [
    hasArchitecture ? "Architecture ownership reduces early programme ambiguity because design accountability is less likely to sit with the client after onboarding." : "A weaker architecture signal increases downstream design governance risk; ownership requires further validation before executive positioning.",
    validation.length ? `Commercial validation is the remaining release constraint; until ${validation.slice(0, 3).map((item) => item.toLowerCase()).join(", ")} close, the recommendation should be positioned as conditional.` : "Commercial validation is not the gating issue, so the client conversation can focus on delivery confidence and mandate fit.",
    qualityGap > 0 ? `The quality gap to the next shortlisted option is ${qualityGap} points, which means the first interview decision is driven by risk reduction rather than cosmetic profile preference.` : "A technically comparable alternative does not automatically create equal delivery confidence; the decision should remain anchored to ownership and validation quality.",
    hasTransformation ? "Transformation evidence indicates suitability for enterprise rollout work, reducing the risk of hiring a support-oriented profile into a change programme." : "Limited transformation evidence raises implementation-context risk; the interview should test whether this is delivery ownership or adjacent participation.",
    hasStakeholder ? `Stakeholder-facing evidence improves interview confidence because the candidate is more likely to withstand CIO, delivery and business-user scrutiny; Executive Confidence is ${executive}%.` : `Stakeholder governance remains a validation point; ${coverage}% requirement match is useful, but client-facing confidence should not be assumed.`,
  ];
}

function aiInsightsText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  return aiInsightItems(candidate, ranked, activeModule).map((item) => `- ${item}`).join("\n");
}

function clientEmailText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "";
  const evidence = submissionEvidence(candidate, ranked, activeModule);
  const validation = validationNouns(candidate, activeModule);
  return [
    `Subject: First submission recommendation - SAP ${normalizeModule(activeModule || candidate.module)} - ${candidateDisplayName(candidate)}`,
    "",
    "Hi Sarah,",
    "",
    `After reviewing the shortlisted market, I would prioritise ${candidateDisplayName(candidate)} if the client can only interview one person today.`,
    "",
    `The recommendation is based on delivery ownership, architecture accountability and client-facing delivery signals: ${evidence.slice(0, 2).map((item) => item.toLowerCase()).join(" ")} Compared with the remaining shortlist, this is the clearest first-interview case.`,
    "",
    "Why this reduces hiring risk",
    businessValueItems(candidate, ranked, activeModule).slice(0, 4).map((item) => `- ${item}`).join("\n"),
    "",
    validation.length ? `The only remaining validation relates to ${validation.map((item) => item.toLowerCase()).join(", ")}, which we are confirming before release.` : "Commercial alignment is substantially validated and ready for client review.",
    "",
    "Recommended next step: confirm commercial alignment, then proceed to first interview review.",
    "",
    "Best regards,",
    "Vy",
  ].join("\n");
}

function whatsappText(candidate: CandidateCompareSignal | undefined, ranked: CandidateCompareSignal[], activeModule: string) {
  if (!candidate) return "";
  return sentenceLimit(`${candidateDisplayName(candidate)} should be the first SAP ${normalizeModule(activeModule || candidate.module)} interview if the client wants the lowest-risk decision today. ${submissionEvidence(candidate, ranked, activeModule).slice(0, 2).join(" ")} ${firstValidationAction(candidate, activeModule)}`, 120);
}

function createDecisionObject(ranked: CandidateCompareSignal[], activeModule: string, notes: Record<string, string>, config: SubmissionConfig): DecisionObject {
  const candidate = ranked[0];
  const backup = ranked[1];
  const module = normalizeModule(activeModule || candidate?.module || "SAP");
  if (!candidate) {
    const reasoning = buildDecisionReasoning({ candidates: [], module, compareResult: { executiveConfidence: 0, requirementCoverage: 0, commercialReadiness: "Pending validation" }, evidenceSnapshot: { validationNeeded: ["Pending validation"] } });
    return { module, clientContext: config.clientContext, decision: "Pending candidate selection", whySelected: ["Select a recommended candidate before generating the submission package."], businessImpact: ["Pending validation"], commercialStatus: "Pending validation", risks: [], validationNeeded: ["Pending validation"], competitiveDifference: ["Pending validation"], evidence: ["Evidence not yet confirmed."], confidence: { executive: 0, coverage: 0, commercial: "Pending validation" }, recruiterAction: "Select a candidate before release.", clientAction: "Pending validation.", hiringManagerFocus: ["Pending validation"], interviewQuestions: ["Pending validation"], salesTalkingPoints: ["Pending validation"], internalNotes: ["No recruiter notes recorded."], insights: ["Pending validation"], reasoning };
  }
  const coverage = jdCoverage(candidate, activeModule);
  const validation = validationNouns(candidate, activeModule);
  const evidence = submissionEvidence(candidate, ranked, activeModule);
  const commercial = submissionCommercialReadiness(candidate, activeModule);
  const businessImpact = businessValueItems(candidate, ranked, activeModule);
  const risks = clientRiskAssessment(candidate, ranked, activeModule);
  const validationNeeded = validation.length ? validation : ["Final recruiter confirmation"];
  const executive = submissionExecutiveConfidence(candidate, activeModule);
  const reasoning = buildDecisionReasoning({
    candidates: ranked,
    recommended: candidate,
    backup,
    module,
    compareResult: { executiveConfidence: executive, requirementCoverage: coverage.percent, commercialReadiness: commercial },
    commercialValidation: commercialValidationRows(candidate).map((item) => ({ ...item, action: validationActionFor(item.label) })),
    evidenceSnapshot: { differentiators: evidence.slice(0, 4), businessImpact, evidence, risks, validationNeeded },
  });
  const competitiveDifference = ranked.slice(1).map((item) => `${item.name}: ${whyNotDecisionReasons(item, candidate, ranked, activeModule).join(" ")}`).slice(0, 8);
  const questions = ["Which SAP design decisions were personally owned?", "Which implementation outcomes were accountable deliverables?", "Where did stakeholder management materially affect delivery?", ...validation.map((item) => `Can ${item.toLowerCase()} be confirmed before client submission?`)].slice(0, 7);
  const clientFrame: Record<SubmissionClientType, string> = { Consulting: "Position around workshop credibility, architecture judgment and delivery accountability.", Enterprise: "Position around governance, onboarding speed and stakeholder confidence.", Partner: "Position around deployment credibility, margin protection and release certainty.", Internal: "Position around validation clarity and recruiter next action." };
  const audienceAction: Record<SubmissionAudience, string> = { HR: "Confirm process readiness, commercial alignment and interview availability.", "Hiring Manager": "Proceed to a focused interview on ownership, architecture and delivery accountability.", Executive: "Review as the first interview option once commercial alignment is confirmed.", Recruiter: "Complete validation, then release the profile with a clear first-submission narrative." };
  return {
    candidate, backup, module, clientContext: config.clientContext,
    decision: `Submit ${candidateDisplayName(candidate)} first for SAP ${module}.`,
    whySelected: reasoning.decisionSummary,
    businessImpact,
    commercialStatus: commercial,
    risks,
    validationNeeded,
    competitiveDifference: competitiveDifference.length ? competitiveDifference : [backup ? `${backup.name}: Alternative remains viable, but current evidence does not displace the recommended profile.` : "No alternative slate has been provided for comparison."],
    evidence,
    confidence: { executive, coverage: coverage.percent, commercial },
    recruiterAction: firstValidationAction(candidate, activeModule),
    clientAction: validation.length ? audienceAction[config.audience] : "Proceed to client interview review.",
    hiringManagerFocus: reasoning.interviewRecommendation,
    interviewQuestions: questions,
    salesTalkingPoints: [reasoning.clientPositioning.suggestedPositioning, ...reasoning.clientPositioning.buyingSignals, ...reasoning.clientPositioning.possibleObjections],
    internalNotes: [notes[candidate.id] || "No recruiter notes recorded.", `Commercial: ${commercial}`, `Validation: ${(validation.length ? validation : ["Final recruiter confirmation"]).join(", ")}`],
    insights: reasoning.decisionSummary,
    reasoning,
  };
}

function cleanValidationItems(decision: DecisionObject) {
  return decision.validationNeeded.filter((item) => !/final recruiter/i.test(item));
}

function fallbackList(items: string[], fallback = "Needs validation") {
  const clean = items.map((item) => String(item || "").trim()).filter(Boolean);
  return clean.length ? clean : [fallback];
}

function commercialPendingSentence(decision: DecisionObject) {
  const validation = cleanValidationItems(decision);
  if (!validation.length) return "Commercial position: final recruiter confirmation only.";
  const labels = validation.slice(0, 3).map((item) => item.toLowerCase()).join(", ");
  return `Commercial position: ${labels} still need to be confirmed before client submission.`;
}

function renderClientEmail(decision: DecisionObject, _config: SubmissionConfig) {
  const candidate = decision.candidate;
  if (!candidate) return "Select a candidate before generating the client email.";
  const rationale = decision.reasoning.recommendationNarrative;
  return [
    `Subject: SAP ${decision.module} first submission recommendation - ${candidateDisplayName(candidate)}`,
    "",
    "Hi Sarah,",
    "",
    `For the current SAP ${decision.module} search, I recommend we lead with ${candidateDisplayName(candidate)}.`,
    "",
    rationale,
    "",
    commercialPendingSentence(decision),
    "",
    "Suggested next step: review this profile first and confirm whether you would like us to arrange the interview slot.",
    "",
    "Best regards,",
    "Vy",
  ].join("\n");
}

function renderExecutiveBrief(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "EXECUTIVE DECISION\n\nPending candidate selection.";
  const validation = cleanValidationItems(decision);
  return [
    "EXECUTIVE DECISION",
    "",
    "Submit First",
    candidateDisplayName(candidate),
    "",
    "Executive Confidence",
    decision.confidence.executive + "%",
    "",
    "Requirement Match",
    requirementMatchSummary(jdCoverage(candidate, decision.module)).text,
    "",
    "Submission Readiness",
    decision.commercialStatus,
    "",
    "Evidence Summary",
    bulletList(fallbackList(decision.reasoning.decisionSummary).slice(0, 3)),
    "",
    "Before Submission",
    ...(validation.length ? validation.slice(0, 4).map((item) => "- " + item) : ["- Final recruiter confirmation"]),
    "",
    "Alternative Candidate",
    decision.backup ? candidateDisplayName(decision.backup) : "None selected",
  ].join("\n");
}

function renderHiringManagerBrief(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Hiring Manager Brief\n\nPending candidate selection.";
  const concern = decision.risks.find((item) => item.risk !== "Low");
  return [
    "HIRING MANAGER BRIEF",
    "",
    "What to test",
    bulletList(fallbackList(decision.hiringManagerFocus, "Needs validation").slice(0, 5)),
    "",
    "Interview questions",
    numberedList(fallbackList(decision.interviewQuestions, "Needs validation").slice(0, 6)),
    "",
    "Potential concern",
    concern ? `${concern.label}: ${concern.mitigation}` : "No material technical concern is visible from the current Compare signals.",
    "",
    "Expected outcome",
    `Confirm whether ${candidateDisplayName(candidate)} can own SAP ${decision.module} delivery decisions, stakeholder handling and architecture scope in the client environment.`,
  ].join("\n");
}

function renderWhatsApp(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Pending candidate selection.";
  const validation = cleanValidationItems(decision).slice(0, 3).map((item) => item.toLowerCase());
  return [
    "Hi Sarah,",
    "",
    `I'd lead with ${candidateDisplayName(candidate)} for SAP ${decision.module}.`,
    "",
    fallbackList(decision.reasoning.decisionSummary, "Needs validation").slice(0, 2).join(" "),
    "",
    validation.length ? `Pending before submission: ${validation.join(", ")}.` : "Only final recruiter confirmation remains before submission.",
  ].join("\n");
}

function renderLinkedInMessage(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Pending candidate selection.";
  const reason = decision.reasoning.decisionSummary[0] || "Needs validation";
  return [
    `Hi Sarah, quick recommendation for the SAP ${decision.module} search: I would put ${candidateDisplayName(candidate)} forward first.`,
    "",
    `${reason} ${commercialPendingSentence(decision)}`,
  ].join("\n");
}

function renderTeamsUpdate(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Pending candidate selection.";
  const blockers = cleanValidationItems(decision);
  return [
    `Decision: Submit First - ${candidateDisplayName(candidate)}`,
    `Why: ${fallbackList(decision.reasoning.decisionSummary).slice(0, 2).join("; ")}`,
    `Blockers: ${blockers.length ? blockers.slice(0, 3).join(", ") : "Final recruiter confirmation"}`,
    `Next action: ${decision.recruiterAction}`,
  ].join("\n");
}

function renderClientMeetingNotes(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Client Meeting Notes\n\nPending candidate selection.";
  const validation = cleanValidationItems(decision);
  return [
    "CLIENT MEETING NOTES",
    "",
    "Meeting objective",
    `Position ${candidateDisplayName(candidate)} as the first SAP ${decision.module} profile for review and confirm whether the client wants to interview first.`,
    "",
    "Likely client questions",
    "1. Why this candidate first?",
    `Answer: ${decision.reasoning.recommendationNarrative}`,
    "",
    "2. What remains open?",
    `Answer: ${validation.length ? validation.slice(0, 3).join(", ") : "Final recruiter confirmation"}.`,
    "",
    "3. Who is the backup?",
    `Answer: ${decision.backup ? candidateDisplayName(decision.backup) : "No backup selected in Compare"}.`,
    "",
    "Close",
    decision.recruiterAction,
  ].join("\n");
}

function renderInterviewDebrief(decision: DecisionObject) {
  return [
    "INTERVIEW DEBRIEF",
    "",
    "Ownership evidence",
    "- Confirmed personal ownership of delivery outcomes",
    "- Participation only / needs follow-up",
    "",
    "Project scale",
    "- Global / regional / country scope captured",
    "- User count or programme size captured",
    "",
    "Architecture",
    "- Solution design ownership validated",
    "- Integration / governance scope clarified",
    "",
    "Stakeholder handling",
    "- Workshop facilitation confirmed",
    "- Steering / business stakeholder exposure captured",
    "",
    "Commercial update",
    "- Salary updated",
    "- Availability updated",
    "- Notice period updated",
    "",
    "Risk",
    "- Delivery risk",
    "- Commercial risk",
    "- Joining risk",
    "",
    "Final recommendation",
    "- Proceed",
    "- Hold",
    "- Replace with backup",
  ].join("\n");
}

function renderSubmissionCoverSheet(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Submission Cover Sheet\n\nPending candidate selection.";
  const validation = cleanValidationItems(decision);
  return [
    "SUBMISSION COVER SHEET",
    "",
    "Decision",
    `Submit First - ${candidateDisplayName(candidate)}`,
    "",
    "Executive Confidence",
    decision.confidence.executive + "%",
    "",
    "Requirement Match",
    requirementMatchSummary(jdCoverage(candidate, decision.module)).text,
    "",
    "Submission Readiness",
    decision.commercialStatus,
    "",
    "Evidence Summary",
    bulletList(fallbackList(decision.reasoning.decisionSummary).slice(0, 3)),
    "",
    "Validation Checklist",
    ...(validation.length ? validation.slice(0, 4).map((item) => "- " + item) : ["- Final recruiter confirmation"]),
    "",
    "Alternative Candidate",
    decision.backup ? candidateDisplayName(decision.backup) : "None selected",
  ].join("\n");
}

function validationActionFor(label: string) {
  if (/salary|package|compensation/i.test(label)) return "Confirm current and expected package";
  if (/availability/i.test(label)) return "Confirm earliest start date";
  if (/notice/i.test(label)) return "Confirm notice and buyout feasibility";
  if (/visa|work rights/i.test(label)) return "Confirm work rights and sponsorship status";
  if (/travel/i.test(label)) return "Confirm travel flexibility";
  if (/location|relocation/i.test(label)) return "Confirm location and relocation constraints";
  if (/communication/i.test(label)) return "Confirm client-facing communication level";
  return "Needs recruiter validation";
}

function renderCommercialValidation(decision: DecisionObject) {
  const items = [
    "Current Salary",
    "Expected Salary",
    "Availability",
    "Notice Period",
    "Buyout",
    "Visa",
    "Relocation",
    "Travel",
    "Counter Offer",
    "Motivation",
  ];
  return [
    "RECRUITER CHECKLIST",
    "",
    "Commercial Validation",
    ...items.map((item) => "- " + item),
    "",
    "Immediate Action",
    decision.recruiterAction,
  ].join("\n");
}

function renderPositioningStrategy(decision: DecisionObject) {
  const candidate = decision.candidate;
  if (!candidate) return "Positioning\n\nNeeds validation.";
  const validation = cleanValidationItems(decision);
  return [
    "POSITIONING",
    "",
    "Primary positioning",
    `Position ${candidateDisplayName(candidate)} as the first SAP ${decision.module} profile to review, anchored on the Compare decision rather than a broad CV summary.`,
    "",
    "How to sell",
    bulletList(fallbackList(decision.reasoning.clientPositioning.buyingSignals, "Needs validation").slice(0, 3)),
    "",
    "What not to oversell",
    fallbackList(decision.reasoning.clientPositioning.possibleObjections, "Do not oversell tenure, certifications or generic SAP breadth; keep the story tied to mandate fit.").slice(0, 2).join(" "),
    "",
    "Key differentiators",
    bulletList(fallbackList(decision.reasoning.comparisonReasoning, "Needs validation").slice(0, 4)),
    "",
    "Buying signals",
    bulletList(fallbackList(decision.reasoning.clientPositioning.buyingSignals, "Client asks for a lower-risk first interview option.").slice(0, 3)),
  ].join("\n");
}
function buildSubmissionContent(ranked: CandidateCompareSignal[], activeModule: string, notes: Record<string, string>, configOrContext: SubmissionConfig | string): SubmissionContent {
  const config: SubmissionConfig = typeof configOrContext === "string" ? { ...DEFAULT_SUBMISSION_CONFIG, clientContext: configOrContext } : configOrContext;
  const recommendation = buildCompareRecommendation(ranked, activeModule, notes, config);
  const decision = recommendation.decision;
  const empty = "Select candidates before generating a submission.";
  if (!decision.candidate) return { decision, templates: Object.fromEntries(SUBMISSION_TEMPLATES.map((item) => [item, empty])) as Record<SubmissionTemplateKey, string>, sections: Object.fromEntries(SUBMISSION_SECTIONS.map((item) => [item, empty])), internalNotes: empty };
  const templates: Record<SubmissionTemplateKey, string> = generateSubmissionOutputs(SUBMISSION_TEMPLATES, {
    candidateName: candidateDisplayName(decision.candidate),
    role: decision.candidate.title,
    module: decision.module,
    backupName: decision.backup?.name,
    executiveConfidence: decision.confidence.executive,
    requirementCoverage: decision.confidence.coverage,
    commercialReadiness: decision.commercialStatus,
    validationNeeded: decision.validationNeeded,
    recruiterAction: decision.recruiterAction,
    reasoning: decision.reasoning,
  });
  const sections: Record<string, string> = {
    ...templates,
    "Executive Recommendation": templates["Executive Brief"],
    "Why Interview First": templates["Executive Brief"],
    "Interview Strategy": templates["Hiring Manager Brief"],
    "Recruiter Talking Points": templates["Positioning"],
    "Positioning Matrix": templates["Positioning"],
    "Submission Preview": templates["Executive Brief"],
  };
  return { decision, templates, sections, internalNotes: templates["Recruiter Checklist"] };
}
type ExecutiveReportPage = { title: string; question: string; sections: Array<{ title: string; body: string }> };

function compactComparisonMatrixText(ranked: CandidateCompareSignal[], activeModule: string) {
  const labels = new Set(["SAP Years", "Background Experience", "Current Company", "Implementations", "S/4HANA", "Architecture", "Leadership", "Commercial Risk", "Required Validation"]);
  return matrixRows(ranked, "detailed", 9)
    .filter((row) => labels.has(row.label))
    .map((row) => `${row.label}: ${ranked.map((item, index) => `${candidateDisplayName(item)} - ${presentVisibleValue(row.value(item, index, ranked), "Needs validation")}`).join(" | ")}`)
    .join("\n");
}

function reportValidationRows(candidate: CandidateCompareSignal, activeModule: string) {
  const required = new Set(["Salary", "Availability", "Notice Period", "Buyout", "Visa", "Relocation"]);
  const commercialRows = commercialValidationRows(candidate)
    .filter((item) => required.has(item.label) || /buyout|visa|relocation/i.test(item.label))
    .map((item) => `${item.label}: ${item.status} - ${item.value}`);
  const validation = validationNouns(candidate, activeModule).map((item) => `${item}: Pending - ${validationActionFor(item)}`);
  return Array.from(new Set([...commercialRows, ...validation])).slice(0, 8).join("\n") || "Needs validation";
}

function executiveClientReportPages(ranked: CandidateCompareSignal[], activeModule: string, content: SubmissionContent, clientContext: string): ExecutiveReportPage[] {
  const decision = content.decision || createDecisionObject(ranked, activeModule, {}, { ...DEFAULT_SUBMISSION_CONFIG, clientContext });
  const candidate = decision.candidate || ranked[0];
  if (!candidate) return [];
  const backup = decision.backup || ranked[1];
  const riskRows = clientRiskAssessment(candidate, ranked, activeModule).slice(0, 4);
  const validationRisk = riskRows.find((item) => item.label === "Commercial Risk") || riskRows[0];
  const interviewFocus = fallbackList(decision.hiringManagerFocus, "Needs validation").slice(0, 5);
  const alternatives = ranked.slice(1, 5);
  return [
    {
      title: "Page 1 | Executive Decision",
      question: "Who should we submit first?",
      sections: [
        { title: "Submit First", body: candidateDisplayName(candidate) },
        { title: "Decision Metrics", body: [`Executive Confidence: ${decision.confidence.executive}%`, `Requirement Match: ${requirementMatchSummary(jdCoverage(candidate, decision.module)).text}`, `Submission Readiness: ${decision.commercialStatus}`, `Alternative Candidate: ${decision.backup ? candidateDisplayName(decision.backup) : "None selected"}`].join("\n") },
        { title: "Immediate Next Action", body: decision.recruiterAction },
      ],
    },
    {
      title: "Page 2 | Why This Candidate",
      question: "Why is this candidate stronger?",
      sections: [
        { title: "Candidate", body: candidateDisplayName(candidate) },
        { title: "Top Differentiators", body: bulletList(fallbackList(decision.whySelected, "Needs validation").slice(0, 4)) },
        { title: "Business Impact", body: bulletList(fallbackList(decision.businessImpact, "Needs validation").slice(0, 3)) },
        { title: "Evidence-Based Rationale", body: fallbackList(decision.evidence, "Needs validation").slice(0, 3).join(" ") },
      ],
    },
    {
      title: "Page 3 | Candidate Comparison",
      question: "How does this candidate compare against alternatives?",
      sections: [
        { title: "Compact Comparison Matrix", body: compactComparisonMatrixText(ranked, activeModule) || "Needs validation" },
        { title: "Alternative Candidate Validation", body: alternatives.length ? alternatives.map((item) => `${item.name}: ${whyNotDecisionReasons(item, candidate, ranked, activeModule).join(" ")}`).join("\n") : "No alternative candidates selected." },
      ],
    },
    {
      title: "Page 4 | Validation & Risk",
      question: "What must be confirmed before submission?",
      sections: [
        { title: "Required Validation", body: reportValidationRows(candidate, activeModule) },
        { title: "Risk Level", body: validationRisk ? `${validationRisk.label}: ${validationRisk.risk}` : "Needs validation" },
        { title: "Mitigation Action", body: validationRisk?.mitigation || decision.recruiterAction },
      ],
    },
    {
      title: "Page 5 | Submission Recommendation",
      question: "What should the client do next?",
      sections: [
        { title: "Interview Recommendation", body: `Interview ${candidateDisplayName(candidate)} first for SAP ${decision.module}.` },
        { title: "Suggested Interview Focus", body: bulletList(interviewFocus) },
        { title: "Backup Plan", body: backup ? `Keep ${backup.name} warm as backup if commercial alignment or interview timing does not close.` : "No backup selected in Compare." },
        { title: "Final Next Step", body: decision.recruiterAction },
      ],
    },
  ];
}

function downloadSubmissionDoc(ranked: CandidateCompareSignal[], activeModule: string, content: SubmissionContent, clientContext: string) {
  const pages = executiveClientReportPages(ranked, activeModule, content, clientContext);
  if (!pages.length) return;
  const candidate = content.decision?.candidate || ranked[0];
  const html = `<html><body><h1>${htmlEscape("Executive Client Report")}</h1>${pages.map((page) => `<h2>${htmlEscape(page.title)}</h2><p><strong>${htmlEscape(page.question)}</strong></p>${page.sections.map((section) => `<h3>${htmlEscape(section.title)}</h3><pre>${htmlEscape(section.body)}</pre>`).join("")}`).join("<br style=\"page-break-before:always\" />")}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(`executive-client-report-${candidate?.name || "candidate"}`.replace(/[^a-z0-9-]+/gi, "-"), "doc");
  link.click();
  URL.revokeObjectURL(url);
}

function exportSubmissionReportPdf(ranked: CandidateCompareSignal[], activeModule: string, _notes: Record<string, string>, content: SubmissionContent, clientContext: string) {
  const pages = executiveClientReportPages(ranked, activeModule, content, clientContext);
  if (!pages.length) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 42;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const split = (value: string, maxWidth = width) => doc.splitTextToSize(String(value || "Needs validation"), maxWidth);
  const write = (value: string, x: number, y: number, size = 9, bold = false, maxWidth = width) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(15, 23, 42);
    const lines = split(value, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (size + 3);
  };
  const header = (title: string, question: string) => {
    doc.setFillColor(5, 7, 10);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin, 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 201, 214);
    doc.text(question, margin, 52);
    doc.setTextColor(15, 23, 42);
  };
  const footer = (pageIndex: number) => {
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Confidential | Primus AI Executive Client Report | ${pageIndex + 1}/5`, margin, pageHeight - 24);
  };
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    header(page.title, page.question);
    let y = 105;
    page.sections.forEach((section) => {
      y += write(section.title, margin, y, 10, true) + 6;
      y += write(section.body, margin, y, 8.8, false) + 18;
    });
    footer(pageIndex);
  });
  doc.save(exportFileName("executive-client-report", "pdf"));
}
function downloadSelectedSubmissionDoc(candidate: CandidateCompareSignal | undefined, title: string, value: string) {
  if (!candidate) return;
  const html = `<html><body><h1>${htmlEscape(title)}</h1><pre>${htmlEscape(value || "Needs validation")}</pre></body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(`${title}-${candidateDisplayName(candidate)}`.replace(/[^a-z0-9-]+/gi, "-"), "doc");
  link.click();
  URL.revokeObjectURL(url);
}

function exportSelectedSubmissionPdf(candidate: CandidateCompareSignal | undefined, title: string, value: string) {
  if (!candidate) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 42;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(5, 7, 10);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin, 35);
  doc.setFontSize(8.5);
  doc.setTextColor(180, 201, 214);
  doc.text(candidateDisplayName(candidate), margin, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(value || "Needs validation", width);
  let y = 105;
  lines.forEach((line: string) => {
    if (y > pageHeight - 54) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 12;
  });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Confidential | Primus AI Submission Generator", margin, pageHeight - 24);
  doc.save(exportFileName(`${title}-${candidateDisplayName(candidate)}`.replace(/[^a-z0-9-]+/gi, "-"), "pdf"));
}
function SubmissionGeneratorOverlay({ open, ranked, activeModule, notes, onClose, onNotify }: { open: boolean; ranked: CandidateCompareSignal[]; activeModule: string; notes: Record<string, string>; onClose: () => void; onNotify: (message: string) => void }) {
  const [mounted, setMounted] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<SubmissionTemplateKey>("Client Email");
  const clientContext = activeModule ? `SAP ${normalizeModule(activeModule)} search` : "Current SAP search";
  const [drafts, setDrafts] = useState<Partial<Record<SubmissionTemplateKey, string>>>({});
  const [revision, setRevision] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const noteMap: Record<string, string> = {};
  const outputProfile = SUBMISSION_OUTPUT_PROFILES[activeTemplate];
  const submissionConfig = useMemo<SubmissionConfig>(() => ({ ...DEFAULT_SUBMISSION_CONFIG, clientContext }), [clientContext]);
  const generated = useMemo(() => buildSubmissionContent(ranked, activeModule, noteMap, submissionConfig), [ranked, activeModule, noteMap, submissionConfig, revision]);
  const previewValue = drafts[activeTemplate] ?? generated.templates[activeTemplate];
  const previewContent = useMemo(() => ({ ...generated, templates: { ...generated.templates, ...drafts } } as SubmissionContent), [generated, drafts]);
  const recommendation = generated.decision ? buildCompareRecommendation(ranked, activeModule, noteMap, submissionConfig) : buildCompareRecommendation(ranked, activeModule);
  const candidate = recommendation.candidate;
  const coverage = recommendation.coverage;
  const confidence = recommendation.confidence;
  const generatorCoverageExplain = coverageExplainability(candidate, activeModule);
  const generatorCommercialExplain = commercialReadinessExplainability(candidate, activeModule);

  async function copyValue(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    onNotify(message);
  }

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2147483647] h-screen w-screen overflow-hidden bg-[#02070b] text-white">
      <section className="flex h-screen flex-col overflow-hidden">
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 bg-[#02070b] px-5 pr-24">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200"><Sparkles size={13} /> AI Submission Generator</div>
            <div className="mt-1 truncate text-sm font-semibold text-white">{candidate?.name || "Select candidate"} · {candidate?.title || "Role pending"} · {activeModule || candidate?.module || "Module pending"}</div>
          </div>
          <div className="hidden min-w-0 flex-1 truncate text-right text-[11px] font-semibold text-slate-400 lg:block">{clientContext}</div>
        </header>
        <button type="button" onClick={onClose} className="fixed right-4 top-4 z-30 rounded-full bg-[#101923] px-3 py-1.5 text-xs font-bold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400">Close</button>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-0 flex-col rounded-[24px] bg-[#0B1118] ring-1 ring-slate-800/60">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Submission Preview</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">{activeTemplate}</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">{SUBMISSION_WORKFLOWS.map((group) => <div key={`workflow-${group.label}`} className="flex flex-wrap items-center gap-1.5"><span className="px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</span>{group.items.map((item) => <button key={`template-${group.label}-${item}`} type="button" onClick={() => setActiveTemplate(item)} className={(activeTemplate === item ? "bg-cyan-400 text-slate-950" : "bg-[#101923] text-slate-300 ring-1 ring-slate-800/70") + " rounded-full px-3 py-1.5 text-[10px] font-semibold transition"}>{item}</button>)}</div>)}</div>
            </div>
            <textarea value={previewValue} onChange={(event) => setDrafts((current) => ({ ...current, [activeTemplate]: event.target.value }))} className="min-h-0 flex-1 resize-none bg-[#0B1118] p-5 text-sm leading-7 text-slate-200 outline-none placeholder:text-slate-600" />
          </section>
          <aside className="flex min-h-0 flex-col gap-4 overflow-auto rounded-[24px] bg-[#0B1118] p-4 ring-1 ring-slate-800/60">
            <section className="rounded-2xl bg-[#101923] p-4 ring-1 ring-slate-800/65">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Output Profile</div>
              <div className="mt-3 grid gap-2 text-[11px] font-semibold text-slate-300">
                <div>Output: <span className="text-white">{activeTemplate}</span></div>
                <div>Audience: <span className="text-white">{outputProfile.audience}</span></div>
                <div>Tone: <span className="text-white">{outputProfile.tone}</span></div>
                <div>Length: <span className="text-white">{outputProfile.length}</span></div>
                <div>Context: <span className="text-white">{clientContext}</span></div>
              </div>
              <div className="mt-4 rounded-xl bg-[#05070A] p-3 text-[11px] font-semibold leading-5 text-slate-400 ring-1 ring-slate-800/70">
                Audience, tone and length are defined by the selected output. The generator reuses the Compare decision and validation signals without running a second recommendation analysis.
              </div>
            </section>
            <section className="rounded-2xl bg-[#101923] p-4 ring-1 ring-slate-800/65">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Generator Sections</div>
              <div className="mt-2.5 grid gap-2.5">{SUBMISSION_WORKFLOWS.map((group) => <div key={`section-group-${group.label}`}><div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</div><div className="grid gap-1.5">{group.items.map((section) => <button key={`submission-section-${group.label}-${section}`} type="button" onClick={() => setActiveTemplate(section)} className={(activeTemplate === section ? "bg-cyan-400 text-slate-950" : "bg-[#05070A] text-slate-300 ring-1 ring-slate-800/55") + " rounded-xl px-3 py-2 text-left text-[11px] font-semibold"}>{section}</button>)}</div></div>)}</div>
            </section>
            <section className="rounded-2xl bg-[#101923] p-4 ring-1 ring-slate-800/65">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Evidence Snapshot</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#05070A] px-2.5 py-1.5 ring-1 ring-slate-800/60"><div className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">Coverage</div><div className="mt-0.5 text-sm font-black text-white">{coverage.percent}%</div></div>
                <div className="rounded-xl bg-[#05070A] px-2.5 py-1.5 ring-1 ring-slate-800/60"><div className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">Confidence</div><div className="mt-0.5 text-sm font-black text-white">{candidate ? submissionExecutiveConfidence(candidate, activeModule) + "%" : "--"}</div></div>
                <div className="rounded-xl bg-[#05070A] px-2.5 py-1.5 ring-1 ring-slate-800/60"><div className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">Commercial</div><div className="mt-0.5 text-sm font-black text-white">{confidence ? confidence.score + "%" : "--"}</div></div>
              </div>
              <div className="mt-4 border-t border-slate-800/60 pt-3">
                <ExplainabilityList title="Matched" items={generatorCoverageExplain.matched.slice(0, 4)} />
              </div>
              <div className="mt-3">
                <ExplainabilityList title="Pending" items={generatorCommercialExplain.pending.slice(0, 3)} icon="limit" />
              </div>
              <div className="mt-4 rounded-xl bg-[#05070A] p-3 ring-1 ring-slate-800/60">
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Next Action</div>
                <div className="mt-1 text-[11px] font-semibold leading-4 text-cyan-100">Confirm commercials</div>
              </div>
            </section>

          </aside>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-[#02070b] px-5 py-3">
          <div className="text-[11px] font-semibold text-slate-500">Everything is generated from Compare, Candidate360-style evidence and validation signals. Internal notes are excluded from client exports.</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setDrafts((current) => ({ ...current, [activeTemplate]: generated.templates[activeTemplate] })); onNotify(`${activeTemplate} generated`); }} className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950">Generate</button>
            <button type="button" onClick={() => copyValue(previewContent.templates["Client Email"], "Email copied")} className="rounded-full bg-[#101923] px-4 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20">Copy Email</button>
            <button type="button" onClick={() => copyValue(previewContent.templates["WhatsApp"], "WhatsApp copied")} className="rounded-full bg-[#101923] px-4 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20">Copy WhatsApp</button>
            <button type="button" onClick={() => { exportSelectedSubmissionPdf(candidate, activeTemplate, previewValue); onNotify(`${activeTemplate} PDF exported`); }} className="rounded-full bg-[#101923] px-4 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20">Export PDF</button>
            <button type="button" onClick={() => { downloadSelectedSubmissionDoc(candidate, activeTemplate, previewValue); onNotify(`${activeTemplate} DOCX exported`); }} className="rounded-full bg-[#101923] px-4 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20">Export DOCX</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
function ExportActions({ ranked, currentSearchCount, activeModule, searchSessionId, shareUrl, notes, onNotify }: { ranked: CandidateCompareSignal[]; currentSearchCount: number; activeModule: string; searchSessionId: string; shareUrl: string; notes: Record<string, string>; onNotify: (message: string) => void }) {
  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(message);
    } catch {
      onNotify("Copy failed");
    }
  }
  return (
    <section className="rounded-[24px] bg-[#0B1118] p-6 ring-1 ring-slate-800/60">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Export</div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button type="button" aria-label="Export PDF" onClick={() => { exportPdf(ranked, currentSearchCount, notes, activeModule, { searchId: searchSessionId, job: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Current Search", primaryModule: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Active Search" }); onNotify("PDF exported"); }} className="inline-flex items-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"><FileText size={14} />Export PDF</button>
        <button type="button" aria-label="Export Excel" onClick={() => { exportWorkbook(ranked, currentSearchCount, notes, activeModule, { searchId: searchSessionId, job: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Current Search", primaryModule: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Active Search" }); onNotify("Excel workbook exported"); }} className="inline-flex items-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"><FileSpreadsheet size={14} />Export Excel</button>
        <button type="button" aria-label="Copy summary" onClick={() => copyText(clientSummaryText(ranked), "Summary copied")} className="inline-flex items-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"><Copy size={14} />Copy Summary</button>
        <button type="button" aria-label="Live Share Link" onClick={() => copyText(shareUrl, "Live share link copied")} className="inline-flex items-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"><Link2 size={14} />Live Share Link</button><button type="button" aria-label="Read-only client view" onClick={() => copyText(shareUrl + (shareUrl.includes("?") ? "&" : "?") + "viewOnly=1", "Read-only client view copied")} className="inline-flex items-center gap-2 rounded-full bg-[#101923] px-4 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"><Link2 size={14} />Read-only View</button>
      </div>
    </section>
  );
}

function CompareToolbar({ preset, onPresetChange, focus, onFocusChange, onExportToggle, exportOpen, onFullScreen, comparedCount }: { preset: ComparePreset; onPresetChange: (preset: ComparePreset) => void; focus: CompareFocusMode; onFocusChange: (focus: CompareFocusMode) => void; onExportToggle: () => void; exportOpen: boolean; onFullScreen: () => void; comparedCount: number }) {
  const focusItems: CompareFocusMode[] = ["All", "Only Differences", "Commercial", "Delivery", "Leadership", "Architecture", "Implementation"];
  return (
    <div className="rounded-[20px] bg-[#0B1118] p-3 ring-1 ring-slate-800/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Compare</span>
          <div className="inline-flex rounded-full bg-[#05070A] p-1 ring-1 ring-slate-800/70">
            {([5, 10, 20] as ComparePreset[]).map((item) => (
              <button key={`preset-${item}`} type="button" onClick={() => onPresetChange(item)} className={(preset === item ? "bg-cyan-400 text-slate-950 shadow-[0_6px_16px_rgba(34,211,238,0.25)]" : "text-slate-400 hover:bg-white/5 hover:text-cyan-100") + " rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition"}>{item === 5 ? "Top 5 Cards" : `Top ${item} Matrix`}</button>
            ))}
          </div>
          <span className="rounded-full bg-[#05070A] px-2.5 py-1 text-[10px] font-bold text-slate-400 ring-1 ring-slate-800/70">{comparedCount} compared</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onExportToggle} className={(exportOpen ? "bg-cyan-400 text-slate-950" : "bg-[#101923] text-cyan-100 ring-1 ring-cyan-500/20 hover:bg-cyan-950/30") + " rounded-full px-4 py-2 text-[11px] font-semibold transition"}>Export</button>
          <button type="button" onClick={onFullScreen} className="rounded-full bg-[#101923] px-4 py-2 text-[11px] font-semibold text-cyan-100 ring-1 ring-cyan-500/20 transition hover:bg-cyan-950/30">Full Screen</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Filters</span>
        {focusItems.map((item) => <button key={`compare-filter-${item}`} type="button" onClick={() => onFocusChange(item)} className={(focus === item ? "bg-cyan-400 text-slate-950" : "bg-[#05070A] text-slate-300 ring-1 ring-slate-800/70 hover:bg-white/5 hover:text-cyan-100") + " rounded-full px-2.5 py-1 text-[10px] font-semibold transition"}>{item}</button>)}
      </div>
    </div>
  );
}
function confidenceBreakdownTitle(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  if (!candidate) return "Confidence drivers pending candidate selection.";
  const architecture = architectureRole(candidate) !== "To confirm" ? 24 : 10;
  const leadership = teamResponsibility(candidate) !== "To confirm" ? 18 : 8;
  const communication = clientFacingRole(candidate) !== "To confirm" ? 12 : 6;
  const industry = detailSections(candidate).find((item) => item.title === "Enterprise Exposure")?.chips.some((chip) => !/validation/i.test(chip)) ? 6 : 3;
  const language = detailSections(candidate).find((item) => item.title === "Languages")?.chips.some((chip) => !/validation/i.test(chip)) ? 4 : 2;
  return [`Implementation: 28%`, `Architecture: ${architecture}%`, `Leadership: ${leadership}%`, `Communication: ${communication}%`, `Commercial: 8%`, `Industry: ${industry}%`, `Language: ${language}%`].join("\n");
}

function unifiedReadinessScore(candidate: CandidateCompareSignal | undefined, activeModule: string) {
  if (!candidate) return 0;
  const technical = Math.round((candidate.score + jdCoverage(candidate, activeModule).percent) / 2);
  const commercial = submissionConfidence(candidate, activeModule || candidate.module).score;
  const verification = validationChecklist(candidate).percent;
  return Math.round(technical * 0.5 + commercial * 0.3 + verification * 0.2);
}

type CompareRecommendation = {
  candidate?: CandidateCompareSignal;
  backup?: CandidateCompareSignal;
  ranked: CandidateCompareSignal[];
  activeModule: string;
  decision: DecisionObject;
  confidence: SubmissionConfidenceResult | null;
  executive: ReturnType<typeof executiveConfidence>;
  coverage: ReturnType<typeof jdCoverage>;
  readiness: number;
  whySelected: string[];
  blockers: string[];
  actions: string[];
  validationNeeded: string[];
  commercialStatus: string;
  immediateAction: string;
};

function buildCompareRecommendation(ranked: CandidateCompareSignal[], activeModule = "", notes: Record<string, string> = {}, config: SubmissionConfig = DEFAULT_SUBMISSION_CONFIG): CompareRecommendation {
  const candidate = ranked[0];
  const backup = ranked[1];
  const decision = createDecisionObject(ranked, activeModule, notes, { ...config, clientContext: config.clientContext || "Current SAP search" });
  const confidence = candidate ? submissionConfidence(candidate, activeModule || candidate.module) : null;
  const validationNeeded = candidate ? validationNouns(candidate, activeModule || candidate.module).filter((item) => !/final recruiter/i.test(item)) : [];
  return {
    candidate,
    backup,
    ranked,
    activeModule,
    decision,
    confidence,
    executive: executiveConfidence(candidate),
    coverage: jdCoverage(candidate, activeModule),
    readiness: unifiedReadinessScore(candidate, activeModule),
    whySelected: decision.reasoning.decisionSummary.length ? decision.reasoning.decisionSummary.slice(0, 4) : whyCandidateBullets(candidate, ranked, activeModule).slice(0, 4),
    blockers: candidate ? validationChipLabels(candidate).slice(0, 3) : [],
    actions: validationNeeded.slice(0, 3),
    validationNeeded: validationNeeded.length ? validationNeeded : decision.validationNeeded,
    commercialStatus: decision.commercialStatus,
    immediateAction: decision.recruiterAction,
  };
}
function CandidateDrawer({ candidate, ranked, note, onNoteChange, onClose, shortlistedIds, onMoveToShortlist, onRemoveFromShortlist, viewerRole, subscription, hasProfileAccess, canChat, chatCreditCost, onStartCandidateChat }: { candidate: CandidateCompareSignal; ranked: CandidateCompareSignal[]; note: string; onNoteChange: (value: string) => void; onClose: () => void; shortlistedIds: string[]; onMoveToShortlist: (candidate: CandidateCompareSignal) => void; onRemoveFromShortlist: (candidate: CandidateCompareSignal) => void; viewerRole: string; subscription: boolean; hasProfileAccess: boolean; canChat: boolean; chatCreditCost: number; onStartCandidateChat: (candidateId: string) => void; }) {
  const drawerIndex = Math.max(0, ranked.findIndex((item) => item.id === candidate.id));
  const drawerValidation = validationChecklist(candidate);
  const isClientView = viewerRole === "client";
  const drawerViewLabel = isClientView ? "Candidate Preview" : "Recruiter View";
  const snapshotFields = [
    ["Comparison Position", `Rank #${drawerIndex + 1}`],
    ["Primary Blocker", submissionConfidence(candidate).primaryBlocker || "Final recruiter confirmation"],
    ...(isClientView ? [] : [["Internal Validation Progress", drawerValidation.count]]),
    ["Next Check", validationNouns(candidate, candidate.module).filter((item) => !/final recruiter/i.test(item))[0] || "Final recruiter confirmation"],
  ];
  const isShortlisted = shortlistedIds.includes(candidate.id);
  const actions = candidateRecruiterActions(candidate, { viewerRole, subscription, hasProfileAccess, canChat, chatCreditCost, isShortlisted, canShortlist: viewerRole !== "client" || subscription || hasProfileAccess, onStartCandidateChat, onToggleShortlist: (item) => (isShortlisted ? onRemoveFromShortlist(item) : onMoveToShortlist(item)) });
  const previewLines = sanitizedResumePreviewLines(candidate);
  const sectionClass = "rounded-2xl bg-[#101923] p-2 ring-1 ring-slate-800/55";
  const sectionTitleClass = "text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500";
  const summary = drawerSummary(candidate, ranked);
  const drawerConfidence = submissionConfidence(candidate);
  const backup = ranked.find((item) => item.id !== candidate.id);
  return (
    <div className="fixed inset-0 z-[70] bg-black/70" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-[500px] flex-col bg-[#070B10] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-slate-800" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800/70 bg-[#070B10] px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <span>{isClientView ? "Candidate Preview" : "Candidate Workspace"}</span>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[9px] text-cyan-100 ring-1 ring-cyan-500/20">{drawerViewLabel}</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold" title={candidateDisplayName(candidate)}>{candidateDisplayName(candidate)}</h2>
            <div className="mt-0.5 line-clamp-1 text-xs text-slate-400" title={candidate.title}>{candidate.title}</div><div className="mt-0.5 line-clamp-1 text-xs font-semibold text-cyan-100" title={drawerHeaderMeta(candidate)}>{drawerHeaderMeta(candidate)}</div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/5 p-2 text-slate-300 ring-1 ring-slate-700/60 hover:text-white"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
          <section className={sectionClass}>
            <div className={sectionTitleClass}>Executive Summary</div>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">{summary}</p>

          </section>

          {!isClientView ? <section className={sectionClass}>
            <div className={sectionTitleClass}>Decision</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {snapshotFields.map(([label, value], fieldIndex) => (
                <div key={`${candidate.id}-snapshot-${label}-${fieldIndex}`} className="rounded-xl bg-[#0B1118] px-2.5 py-2 ring-1 ring-slate-800/45">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
                  <div className="mt-0.5 text-[12px] font-semibold leading-4 text-slate-200">{value}</div>
                </div>
              ))}
            </div>
          </section> : null}
          <section className={sectionClass}>
            <div className={sectionTitleClass}>Project Evidence Timeline</div>
            <div className="mt-2 grid gap-1.5">
              {previewLines.slice(0, 5).map((item, timelineIndex) => <div key={`${candidate.id}-timeline-${item.key}-${timelineIndex}`} className="rounded-xl bg-[#05070A] px-3 py-2 ring-1 ring-slate-800/45"><div className="text-[11px] font-semibold text-white">{item.title}</div><div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-400">{item.detail}</div></div>)}
            </div>
          </section>

          <section className={sectionClass}>
            <div className={sectionTitleClass}>Evidence</div>
            <div className="mt-2 grid gap-2">
              {topEvidenceItems(candidate).map((item, evidenceIndex) => (
                <div key={`${candidate.id}-top-evidence-${item.label}-${evidenceIndex}`} className="rounded-xl bg-[#05070A] px-3 py-2 ring-1 ring-slate-800/45">
                  <div className="text-[11px] font-semibold leading-4 text-white">5/5 {item.label}</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-slate-400">{item.detail}</div>
                </div>
              ))}
            </div>
            <details className="mt-2 rounded-xl bg-[#05070A] px-3 py-2 ring-1 ring-slate-800/45">
              <summary className="cursor-pointer text-[11px] font-semibold text-cyan-100">More Evidence</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {moreEvidenceItems(candidate).map(([label, value], moreIndex) => <span key={`${candidate.id}-more-evidence-${label}-${moreIndex}`} className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 ring-1 ring-slate-700/60">{label}: {value}</span>)}
                {previewLines.slice(0, 3).map((item, evidenceIndex) => <span key={`${candidate.id}-resume-evidence-${item.key}-${evidenceIndex}`} className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 ring-1 ring-slate-700/60">{item.title}</span>)}
              </div>
            </details>
          </section>
          {isClientView ? <section className={sectionClass}>
            <div className={sectionTitleClass}>Commercial Summary</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {detailCoreComparisonRows(candidate, ranked, drawerIndex).filter(([label]) => label === "Commercial Risk" || label === "Required Validation").map(([label, value]) => (
                <div key={`${candidate.id}-client-commercial-${label}`} className="rounded-xl bg-[#0B1118] px-2.5 py-2 ring-1 ring-slate-800/45">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
                  <div className="mt-0.5 text-[12px] font-semibold leading-4 text-slate-200">{label === "Commercial Risk" ? <RiskBadge label={commercialRiskLabel(candidate)} /> : <ValidationChips candidate={candidate} limit={2} />}</div>
                </div>
              ))}
            </div>
          </section> : null}

          {!isClientView ? <section className={sectionClass}>
            <div className={sectionTitleClass}>Commercial</div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">Internal validation checklist. Hidden from client view.</p><div className="mt-2 rounded-xl bg-[#05070A] px-3 py-2 text-[11px] font-semibold leading-4 text-amber-100 ring-1 ring-amber-500/20">{validationNouns(candidate, candidate.module).filter((item) => !/final recruiter/i.test(item)).length ? `Pending because ${validationNouns(candidate, candidate.module).filter((item) => !/final recruiter/i.test(item)).slice(0, 3).join(", ").toLowerCase()} still need confirmation.` : "Commercial position needs final recruiter confirmation."}</div>
            <div className="mt-2 grid gap-1.5">
              {validationChecklist(candidate).completed.map((item, itemIndex) => <div key={`${candidate.id}-verified-${item}-${itemIndex}`} className="flex items-center gap-2 rounded-xl bg-[#05070A] px-2.5 py-1.5 ring-1 ring-slate-800/45"><CheckCircle2 size={13} className="text-emerald-300" /><span className="text-[11px] font-semibold text-slate-200">{item}</span></div>)}
              {validationChecklist(candidate).pending.map((item, itemIndex) => <div key={`${candidate.id}-pending-${item}-${itemIndex}`} className="flex items-center gap-2 rounded-xl bg-[#05070A] px-2.5 py-1.5 ring-1 ring-amber-500/20"><Clock size={13} className="text-amber-300" /><span className="text-[11px] font-semibold text-amber-100">{item}</span></div>)}
            </div>
            <div className="mt-3"><div className="flex items-center justify-between text-[10px] font-semibold text-slate-400"><span>Internal Validation Progress</span><span>{validationChecklist(candidate).count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${validationChecklist(candidate).percent}%` }} /></div></div>
            <div className="mt-3 rounded-2xl bg-[#05070A] p-2 ring-1 ring-slate-800/55">
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Internal Notes</div>
              <div className="mb-2 text-[10px] font-semibold text-slate-500">Hidden from client view.</div>
              <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Package, availability, notice, client fit, communication..." className="min-h-[72px] w-full resize-y rounded-xl border border-slate-800/60 bg-[#05070A] p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30" />
            </div>
          </section> : null}

          <section className={sectionClass}>
            <div className={sectionTitleClass}>Immediate Actions</div>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-200">{immediateNextAction(candidate, backup, drawerConfidence)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {actions.map((action, actionIndex) => {
                const Icon = action.icon;
                const base = "inline-flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-2 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-400";
                const visual = action.disabled ? "cursor-not-allowed bg-white/5 text-slate-500 ring-1 ring-slate-700/50 blur-[0.15px]" : action.intent === "primary" ? "bg-cyan-400 text-slate-950 ring-1 ring-cyan-500/20 hover:bg-cyan-300" : action.intent === "success" ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/25 hover:bg-emerald-500/20" : "bg-[#05070A] text-cyan-100 ring-1 ring-cyan-500/20 hover:bg-cyan-950/30";
                const body = <><Icon size={13} />{action.label}</>;
                if (action.disabled) return <button key={`${candidate.id}-action-${action.label}-${actionIndex}`} type="button" disabled title={action.lockedCopy || "Requires subscription or credits"} className={base + " " + visual}>{body}</button>;
                if (action.onClick) return <button key={`${candidate.id}-action-${action.label}-${actionIndex}`} type="button" onClick={action.onClick} className={base + " " + visual}>{body}</button>;
                return <a key={`${candidate.id}-action-${action.label}-${actionIndex}`} href={action.href} target="_blank" rel="noreferrer" className={base + " " + visual}>{body}</a>;
              })}
            </div>
            <div className="mt-2 text-[10px] text-slate-500">{viewerRole === "client" && !subscription ? "Requires subscription or credits" : canChat ? `Chat uses ${chatCreditCost} credit${chatCreditCost === 1 ? "" : "s"}` : "Requires subscription or credits"}</div>
          </section>
        </div>
      </aside>
    </div>
  );
}
function ReplaceCandidateDialog({ incoming, ranked, onReplace, onClose }: { incoming: CandidateCompareSignal; ranked: CandidateCompareSignal[]; onReplace: (replaceId: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <section className="w-full max-w-xl rounded-[24px] bg-[#0B1118] p-5 text-white ring-1 ring-cyan-500/20" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Replace Candidate</div>
            <h2 className="mt-2 text-xl font-semibold">Add {incoming.name}</h2>
            <p className="mt-1 text-sm text-slate-400">Choose one current comparison candidate to replace.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2 text-slate-300 ring-1 ring-slate-700/60 hover:text-white"><X size={16} /></button>
        </div>
        <div className="mt-4 grid gap-2">
          {ranked.map((candidate, index) => {
            const candidateRank = globalSearchRank(candidate, index);
            return (
              <button key={`replace-candidate-${candidate.id}`} type="button" onClick={() => onReplace(candidate.id)} className="flex items-center justify-between rounded-2xl bg-[#101923] p-3 text-left ring-1 ring-slate-800/70 transition hover:bg-cyan-950/20 hover:ring-cyan-500/30">
                <div><div className="text-sm font-semibold text-white" title={candidateDisplayName(candidate, candidateRank)}>{candidateDisplayName(candidate, candidateRank)}</div><div className="mt-1 text-xs text-slate-500">{recommendationStatus(index)}</div></div>
                <div className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-slate-950">Replace</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CandidateCompareWorkspace() {
  const [candidates, setCandidates] = useState<CandidateCompareSignal[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState("");
  const [currentSearchIds, setCurrentSearchIds] = useState<string[]>([]);
  const [searchSessionId, setSearchSessionId] = useState("");
  const [sessionMissing, setSessionMissing] = useState(false);
  const [returnToTalentSearch, setReturnToTalentSearch] = useState("/search");
  const [comparePreset, setComparePreset] = useState<ComparePreset>(5);
  const [compareFocus, setCompareFocus] = useState<CompareFocusMode>("All");
  const [exportOpen, setExportOpen] = useState(false);
  const [deepCompareIds, setDeepCompareIds] = useState<string[]>([]);
  const [deepCompareOpen, setDeepCompareOpen] = useState(false);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [drawerCandidateId, setDrawerCandidateId] = useState("");
  const [replaceCandidateId, setReplaceCandidateId] = useState("");
  const [activeFullScreenIndex, setActiveFullScreenIndex] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [shortlistItems, setShortlistItems] = useState<ShortlistWorkflowItem[]>([]);
  const [viewerRole, setViewerRole] = useState("recruiter");
  const [hasProfileAccess, setHasProfileAccess] = useState(false);
  const [chatCredits, setChatCredits] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
      setSessionMissing(true);
      if (process.env.NODE_ENV === "development") console.warn("[Compare QA] Compare candidate loading timed out.");
    }, 5000);

    async function loadCompareCandidates() {
      const params = new URLSearchParams(window.location.search);
      const urlIds = (params.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, MAX_SELECTED);
      const candidateId = params.get("candidateId") || "";
      const requestedIds = Array.from(new Set([...urlIds, candidateId].filter(Boolean))).slice(0, MAX_SELECTED);
      const requestedModule = normalizeModule(params.get("module") || params.get("primaryModule") || "");
      const requestedSearchId = params.get("searchId") || params.get("searchSessionId") || "";
      const requestedPreset = Number(params.get("top") || params.get("preset") || 5);
      const role = String(params.get("role") || "recruiter").toLowerCase();
      const subscription = /^(true|1|yes|paid|subscribed|client_paid)$/i.test(String(params.get("subscription") || params.get("hasSubscription") || "false"));
      const profileAccess = /^(true|1|yes|approved|allowed)$/i.test(String(params.get("hasProfileAccess") || params.get("profileApproved") || params.get("adminApproved") || "false"));
      const credits = Number(params.get("credits") || params.get("chatCredits") || 0);
      setComparePreset(requestedPreset === 10 || requestedPreset === 20 ? requestedPreset : 5);
      setViewerRole(role);
      setHasProfileAccess(profileAccess || subscription || role === "admin");
      setChatCredits(Number.isFinite(credits) ? credits : 0);

      try {
        const snapshot = readCurrentSearchSnapshot(requestedSearchId, requestedModule);
        let matches = snapshot.matches;
        let candidateIds = snapshot.candidateIds;
        let searchSession = snapshot.searchSessionId;
        let primaryModule = snapshot.primaryModule || requestedModule;

        if (!matches.length && requestedIds.length) {
          const cached = JSON.parse(window.sessionStorage.getItem(DIRECT_COMPARE_CACHE_KEY) || "[]");
          const cachedRows = Array.isArray(cached) ? cached.filter((candidate: AnyRecord) => requestedIds.includes(safeCandidateId(candidate))) : [];
          const missingIds = requestedIds.filter((id) => !cachedRows.some((candidate: AnyRecord) => safeCandidateId(candidate) === id));
          const fetchedRows = (await Promise.all(missingIds.map(async (id) => {
            try {
              const response = await fetch(`/api/candidates/${encodeURIComponent(id)}`, { cache: "no-store" });
              if (!response.ok) return null;
              const payload = await response.json();
              return payload?.candidate || null;
            } catch {
              return null;
            }
          }))).filter(Boolean) as AnyRecord[];
          matches = [...cachedRows, ...fetchedRows];
          candidateIds = requestedIds;
          searchSession = requestedSearchId || "direct-compare";
          if (matches.length) window.sessionStorage.setItem(DIRECT_COMPARE_CACHE_KEY, JSON.stringify(matches));
        }

        const normalized = matches.map((candidate: AnyRecord) => normalizeCompareCandidate(candidate)).filter((candidate: CandidateCompareSignal) => buildCanonicalCandidateProfile(candidate.raw || candidate).allowedForRanking);
        const ordered = searchResultCandidates(normalized, candidateIds);
        if (cancelled) return;
        window.clearTimeout(timeout);
        setActiveModule(primaryModule);
        setReturnToTalentSearch(talentSearchHref({ matches, candidateIds, primaryModule, filters: snapshot.filters, searchSessionId: searchSession }));
        setCurrentSearchIds(candidateIds);
        setSearchSessionId(searchSession);
        setSessionMissing(ordered.length === 0);
        setCandidates(ordered);
        setSelectedIds(requestedIds);
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.warn("[Compare QA] Compare candidate recovery failed", error);
        if (!cancelled) setSessionMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCompareCandidates();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    try {
      setNotes(JSON.parse(window.localStorage.getItem("sapTalentHub.compareNotes.v1") || "{}"));
    } catch {
      setNotes({});
    }
  }, []);

  useEffect(() => {
    const refreshShortlist = () => setShortlistItems(readCompareShortlist());
    refreshShortlist();
    window.addEventListener("focus", refreshShortlist);
    window.addEventListener("storage", refreshShortlist);
    return () => {
      window.removeEventListener("focus", refreshShortlist);
      window.removeEventListener("storage", refreshShortlist);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sapTalentHub.compareNotes.v1", JSON.stringify(notes));
  }, [notes]);

  const shortlistedIds = useMemo(() => shortlistItems.map((item) => item.candidateId), [shortlistItems]);
  const currentSearch = useMemo(() => searchResultCandidates(candidates, currentSearchIds), [candidates, currentSearchIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? currentSearch.filter((candidate) => [candidateDisplayName(candidate), candidate.title, candidate.module, candidate.location, candidate.company].join(" ").toLowerCase().includes(q)) : currentSearch;
  }, [currentSearch, query]);
  const allRanked = useMemo(() => rankCompareCandidates(currentSearch), [currentSearch]);
  const ranked = useMemo(() => {
    const base = allRanked.slice(0, comparePreset);
    const baseIds = new Set(base.map((candidate) => candidate.id));
    const extras: CandidateCompareSignal[] = [];
    selectedIds.forEach((id) => {
      const candidate = allRanked.find((item) => item.id === id);
      if (candidate && !baseIds.has(candidate.id)) extras.push(candidate);
    });
    return [...base, ...extras].slice(0, 20);
  }, [allRanked, comparePreset, selectedIds]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const duplicateMap = new Map<string, string[]>();
    ranked.forEach((candidate) => {
      validateCandidateDisplayData(candidate);
      const canonical = buildCanonicalCandidateProfile(candidate.raw || candidate);
      if (!canonical.duplicateKey) return;
      const ids = duplicateMap.get(canonical.duplicateKey) || [];
      ids.push(candidate.id);
      duplicateMap.set(canonical.duplicateKey, ids);
    });
    const duplicateProfiles = Array.from(duplicateMap.entries()).filter(([, ids]) => ids.length > 1);
    if (duplicateProfiles.length) console.warn("[Compare QA] Duplicate profiles detected", duplicateProfiles);
  }, [ranked]);
  const comparedIds = useMemo(() => new Set(ranked.map((candidate) => candidate.id)), [ranked]);
  const deepCompareCandidates = useMemo(() => deepCompareIds.map((id) => ranked.find((candidate) => candidate.id === id)).filter(Boolean) as CandidateCompareSignal[], [deepCompareIds, ranked]);

  useEffect(() => {
    setDeepCompareIds((current) => current.filter((id) => ranked.some((candidate) => candidate.id === id)));
    if (comparePreset === 5) setDeepCompareOpen(false);
  }, [ranked, comparePreset]);
  const selectedFiltered = useMemo(() => filtered.filter((candidate) => comparedIds.has(candidate.id)), [filtered, comparedIds]);
  const availableFiltered = useMemo(() => filtered.filter((candidate) => !comparedIds.has(candidate.id)), [filtered, comparedIds]);
  const slateCandidates = useMemo(() => [...selectedFiltered, ...availableFiltered], [selectedFiltered, availableFiltered]);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.pathname = "/compare";
    url.searchParams.set("ids", ranked.map((candidate) => candidate.id).join(","));
    if (searchSessionId) url.searchParams.set("searchId", searchSessionId);
    if (activeModule) url.searchParams.set("module", activeModule.startsWith("SAP ") ? activeModule : "SAP " + activeModule);
    url.searchParams.set("top", String(comparePreset));
    return url.toString();
  }, [ranked, searchSessionId, activeModule, comparePreset]);
  useEffect(() => {
    if (!loading && !sessionMissing) {
      persistLastCompareUrl();
    }
  }, [loading, sessionMissing]);
  const drawerCandidate = useMemo(() => candidates.find((candidate) => candidate.id === drawerCandidateId) || null, [candidates, drawerCandidateId]);
  const incomingReplaceCandidate = useMemo(() => candidates.find((candidate) => candidate.id === replaceCandidateId) || null, [candidates, replaceCandidateId]);

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clientSummaryText(ranked));
      notify("Client summary copied");
    } catch {
      notify("Copy failed");
    }
  }, [ranked]);

  const exportPdfAction = useCallback(async () => {
    exportPdf(ranked, currentSearch.length, notes, activeModule, { searchId: searchSessionId, job: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Current Search", primaryModule: activeModule ? `SAP ${normalizeModule(activeModule)}` : "Active Search" });
    notify("PDF exported");
  }, [ranked, currentSearch.length, notes, activeModule]);

  useEffect(() => {
    if (!fullScreenOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullScreenOpen(false);
      if (event.key === "ArrowRight") setActiveFullScreenIndex((index) => Math.min(ranked.length - 1, index + 1));
      if (event.key === "ArrowLeft") setActiveFullScreenIndex((index) => Math.max(0, index - 1));
      if (event.ctrlKey && event.key.toLowerCase() === "c") { event.preventDefault(); copySummary(); }
      if (event.ctrlKey && event.key.toLowerCase() === "p") { event.preventDefault(); exportPdfAction(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
        window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullScreenOpen, ranked.length, copySummary, exportPdfAction]);

  function toggleDeepCompareCandidate(candidate: CandidateCompareSignal) {
    setDeepCompareOpen(false);
    setDeepCompareIds((current) => {
      if (current.includes(candidate.id)) return current.filter((id) => id !== candidate.id);
      if (current.length >= 5) {
        notify("You can compare up to 5 candidates at a time.");
        return current;
      }
      return [...current, candidate.id];
    });
  }

  function openDeepCompare() {
    if (deepCompareIds.length < 2 || deepCompareIds.length > 5) return;
    setDeepCompareOpen(true);
  }
  function toggleCandidate(candidate: CandidateCompareSignal) {
    setSelectedIds((current) => {
      if (comparedIds.has(candidate.id)) return current;
      if (ranked.length >= 20) {
        notify("Top 20 comparison limit reached");
        return current;
      }
      return [...current, candidate.id];
    });
  }

  function applyReplacement(replaceId: string) {
    if (!replaceCandidateId) return;
    setSelectedIds((current) => current.map((id) => id === replaceId ? replaceCandidateId : id));
    setReplaceCandidateId("");
  }

  function updateNote(candidateId: string, value: string) {
    setNotes((current) => ({ ...current, [candidateId]: value }));
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function moveToShortlist(candidate: CandidateCompareSignal) {
    persistLastCompareUrl();
    const current = shortlistItems;
    if (current.some((item) => item.candidateId === candidate.id)) {
      notify("Already shortlisted");
      return;
    }
    const rankedForShortlist = rankCompareCandidates(currentSearch);
    const candidateRank = globalSearchRank(candidate, rankedForShortlist.findIndex((item) => item.id === candidate.id));
    const next = [...current, shortlistItemFromCandidate(candidate, activeModule, searchSessionId, candidateRank, rankedForShortlist[0]?.id === candidate.id)];
    setShortlistItems(next);
    try {
      writeCompareShortlist(next);
      notify("Added to Shortlist");
    } catch {
      setShortlistItems(current);
      notify("Shortlist update failed");
    }
  }

  function removeFromShortlist(candidate: CandidateCompareSignal) {
    const current = shortlistItems;
    const next = current.filter((item) => item.candidateId !== candidate.id);
    setShortlistItems(next);
    try {
      writeCompareShortlist(next);
      notify("Removed from Shortlist");
    } catch {
      setShortlistItems(current);
      notify("Shortlist update failed");
    }
  }

  if (!loading && sessionMissing) {
    return (
      <main className="min-h-screen bg-[#05070A] p-4 text-white md:p-6 xl:p-8">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <section className="rounded-[28px] bg-[#0B1118] p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-slate-800/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20">
              <Sparkles size={20} />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-white">No candidates selected for comparison.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Select 2-5 candidates from Talent Search, Shortlist, or Candidate 360 to open Executive Compare.
            </p>
            <Link href={returnToTalentSearch} className="mt-6 inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
              Back to Talent Search
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070A] p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1420px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="rounded-full border border-slate-700/45 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-500/30 hover:bg-cyan-500/10">Back to Home</Link>
            <Link href="/shortlist" onClick={() => persistLastCompareUrl()} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400/40 hover:bg-emerald-500/15">View Shortlist ({shortlistItems.length})</Link>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-950/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">Executive Compare</div>
        </div>

        <section className="rounded-[22px] bg-[#0B1118] p-4 shadow-[0_20px_44px_rgba(0,0,0,0.24)] ring-1 ring-slate-800/60">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200"><Sparkles size={14} /> Primus AI Recruiter™</div>
              <h1 className="mt-2 max-w-4xl text-2xl font-black tracking-tight text-white md:text-4xl">Executive Candidate Comparison</h1>
              <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-300">Objectively compare ranked candidates side-by-side before deciding who to shortlist.</p>
            </div>
            <div className="rounded-2xl bg-[#101923] p-4 ring-1 ring-slate-800/65">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Current Search</div>
              <div className="mt-2 text-2xl font-black text-white">{currentSearch.length} candidates</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-cyan-950/20 px-3 py-2 ring-1 ring-cyan-500/15"><div className="text-[10px] uppercase text-cyan-200">Compared</div><div className="font-bold text-cyan-100">{ranked.length}</div></div>
                <div className="rounded-xl bg-[#0B1118] px-3 py-2 ring-1 ring-slate-800/50"><div className="text-[10px] uppercase text-slate-500">Module</div><div className="font-bold text-white">{activeModule ? "SAP " + activeModule : "Active Search"}</div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[328px_minmax(0,1fr)]">
          <aside className="rounded-[22px] bg-[#0B1118] p-3 ring-1 ring-slate-800/60 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">Current Comparison</div>
                <div className="mt-1 text-xs text-slate-500">Top ranked candidates stay on top.</div>
              </div>
              <div className="rounded-full bg-[#101923] px-3 py-1 text-xs font-bold text-cyan-100 ring-1 ring-cyan-500/15">{currentSearch.length}</div>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#05070A] px-3 py-2 ring-1 ring-slate-800/60">
              <Search size={16} className="text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search slate" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
            </div>
            <div className="mt-2 max-h-[640px] space-y-1.5 overflow-auto pr-1 xl:max-h-[calc(100vh-190px)]">
              {loading ? <div className="rounded-2xl bg-[#101923] p-3 text-sm text-slate-400">Loading candidates...</div> : null}
              {!loading && filtered.length === 0 ? <div className="rounded-2xl bg-[#101923] p-3 text-sm text-slate-400">No candidates returned by this search.</div> : null}
              {slateCandidates.map((candidate, index) => {
                const selectedNow = comparedIds.has(candidate.id);
                const atLimit = !selectedNow && ranked.length >= 20;
                const globalRankIndex = rankCompareCandidates(currentSearch).findIndex((item) => item.id === candidate.id);
                const candidateRank = globalSearchRank(candidate, globalRankIndex >= 0 ? globalRankIndex : index);
                const isShortlisted = shortlistedIds.includes(candidate.id);
                const showSelectedHeader = index === 0 && selectedFiltered.length > 0;
                const showAvailableHeader = index === selectedFiltered.length && availableFiltered.length > 0;
                return (
                  <div key={candidate.id}>
                    {showSelectedHeader ? <div className="mb-1.5 mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Current comparison</div> : null}
                    {showAvailableHeader ? <div className="mb-1.5 mt-2.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Available candidates</div> : null}
                    <article role="button" tabIndex={0} onClick={() => setDrawerCandidateId(candidate.id)} onKeyDown={(event) => { if (event.key === "Enter") setDrawerCandidateId(candidate.id); }} className={(selectedNow ? "bg-cyan-950/25 ring-cyan-500/30" : atLimit ? "bg-[#101923] ring-slate-800/40" : "bg-[#101923] ring-slate-800/50") + " w-full cursor-pointer rounded-xl p-2.5 text-left ring-1 transition duration-200 hover:bg-[#17222E] hover:ring-slate-700/70"}>
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5">{candidateRank ? <span className="shrink-0 rounded-full border border-cyan-300/40 bg-cyan-400/12 px-2 py-0.5 text-[10px] font-black leading-4 text-cyan-50 shadow-[0_0_14px_rgba(34,211,238,0.12)]">Rank #{candidateRank}</span> : null}<div className="truncate text-[13px] font-bold leading-5 text-white" title={candidateDisplayName(candidate, candidateRank)}>{candidateDisplayName(candidate, candidateRank)}</div></div><div className="mt-0.5 truncate text-[11px] leading-4 text-slate-400">{slateSubtitle(candidate)}</div></div>
                        <div className="flex shrink-0 flex-col gap-1">
                          {!selectedNow ? <button type="button" onClick={(event) => { event.stopPropagation(); toggleCandidate(candidate); }} className={(atLimit ? "bg-amber-500/10 text-amber-100" : "bg-white/5 text-slate-300") + " rounded-full px-1.5 py-0.5 text-[8.5px] font-bold leading-4 ring-1 ring-slate-700/45"}>Add to Compare</button> : null}
                          {isShortlisted ? <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-bold leading-4 text-emerald-100 ring-1 ring-emerald-500/25"><CheckCircle2 size={11} className="inline-block align-[-2px]" /> Shortlisted</span> : null}
                        </div>
                      </div>
                      <div className="mt-1.5 grid gap-1 text-[10px] font-semibold text-slate-400"><SlateDecisionStrip candidate={candidate} ranked={ranked} /></div>
                    </article>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="flex min-h-0 flex-col gap-5 xl:h-full xl:overflow-hidden xl:pr-1">
            {ranked.length >= 2 ? (
              <>
                <CompareToolbar preset={comparePreset} onPresetChange={setComparePreset} focus={compareFocus} onFocusChange={setCompareFocus} exportOpen={exportOpen} onExportToggle={() => setExportOpen((open) => !open)} onFullScreen={() => setFullScreenOpen(true)} comparedCount={ranked.length} />
                {exportOpen ? <ExportActions ranked={ranked} currentSearchCount={currentSearch.length} activeModule={activeModule} searchSessionId={searchSessionId} shareUrl={shareUrl} notes={notes} onNotify={notify} /> : null}
                <ExecutiveComparisonSurface ranked={ranked} comparePreset={comparePreset} focus={compareFocus} shortlistedIds={shortlistedIds} selectedIds={deepCompareIds} deepCompareOpen={deepCompareOpen} deepCompareCandidates={deepCompareCandidates} onToggleSelected={toggleDeepCompareCandidate} onCompareSelected={openDeepCompare} onMoveToShortlist={moveToShortlist} onRemoveFromShortlist={removeFromShortlist} onOpenDrawer={(candidate) => setDrawerCandidateId(candidate.id)} />
              </>
            ) : (
              <div className="rounded-[24px] bg-[#0B1118] p-8 text-sm leading-6 text-slate-300 ring-1 ring-slate-800/60">Select at least two parser-approved candidates to open Executive Compare. This view excludes profiles that require identity review.</div>
            )}
          </div>        </section>
      </div>
      <FullScreenCompareModal open={fullScreenOpen && ranked.length >= 2} ranked={ranked} comparePreset={comparePreset} focus={compareFocus} onFocusChange={setCompareFocus} selectedIds={deepCompareIds} onToggleSelected={toggleDeepCompareCandidate} onCompareSelected={openDeepCompare} activeCandidateId={ranked[activeFullScreenIndex]?.id || ""} activeFullScreenIndex={activeFullScreenIndex} shortlistedIds={shortlistedIds} onMoveToShortlist={moveToShortlist} onRemoveFromShortlist={removeFromShortlist} onOpenDrawer={(candidate) => { setDrawerCandidateId(candidate.id); setFullScreenOpen(false); }} onClose={() => setFullScreenOpen(false)} />
      {drawerCandidate ? <CandidateDrawer candidate={drawerCandidate} ranked={ranked} note={notes[drawerCandidate.id] || ""} onNoteChange={(value) => updateNote(drawerCandidate.id, value)} shortlistedIds={shortlistedIds} onMoveToShortlist={moveToShortlist} onRemoveFromShortlist={removeFromShortlist} viewerRole={viewerRole} subscription={viewerRole === "client" && hasProfileAccess} hasProfileAccess={hasProfileAccess} canChat={viewerRole !== "client" || hasProfileAccess || chatCredits >= 1} chatCreditCost={1} onStartCandidateChat={(candidateId) => notify(`Chat started for ${candidateId}`)} onClose={() => setDrawerCandidateId("")} /> : null}
      {incomingReplaceCandidate ? <ReplaceCandidateDialog incoming={incomingReplaceCandidate} ranked={ranked} onReplace={applyReplacement} onClose={() => setReplaceCandidateId("")} /> : null}
      {toast ? <div className="fixed bottom-5 right-5 z-[60] rounded-full bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg">{toast}</div> : null}
    </main>
  );
}

















































































































































































































































































