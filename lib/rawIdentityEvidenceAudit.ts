import { candidateRawCvText } from "./candidateReExtractionEngine";
import { auditFullCandidateExtraction, extractFullCandidateProfile, type FullCandidateExtractionItem } from "./fullCandidateExtractionEngine";
import { extractRawIdentityCandidate, extractRawIdentityCandidates, type RawIdentityCandidate } from "./rawIdentityEvidenceRecovery";

export type AnyRecord = Record<string, any>;

export type RawIdentityDiagnosticClassification =
  | "name_evidence_present_parser_missed"
  | "name_evidence_absent_raw_text_missing_header"
  | "only_placeholder_identity_present"
  | "raw_text_experience_only"
  | "raw_text_ocr_garbled"
  | "possible_name_needs_review"
  | "not_enough_raw_text"
  | "raw_text_unrelated_document";

export type RawIdentityEvidenceOptions = {
  onlyBlockedIdentity?: boolean;
  limit?: number;
  candidateIds?: string[];
  showSnippets?: boolean;
};

export type RawIdentityEvidenceItem = {
  candidateId: string;
  existingDisplayName: string;
  currentParserName: string;
  parserReviewClassification: string;
  rawTextLength: number;
  rawTextQuality: string;
  first30RawTextLines: string[];
  first1500Characters: string;
  identityKeywordLines: string[];
  contactLines: string[];
  linesNearEmailPhoneContactBlock: string[];
  possiblePersonNameLinesFromTop50: string[];
  possiblePersonNameLinesNearEmailPhone: string[];
  extractedIdentityCandidates: RawIdentityCandidate[];
  bestExtractedIdentityCandidate: RawIdentityCandidate | null;
  clearNameEvidenceExists: boolean;
  onlyPlaceholderNameExists: boolean;
  rawTextStartsAfterHeader: boolean;
  rawTextLooksLikeExperienceOnly: boolean;
  reuploadOriginalCvRecommended: boolean;
  reuploadRecommendationRemovedByIdentityEvidence: boolean;
  diagnosticClassification: RawIdentityDiagnosticClassification;
};

export type RawIdentityEvidenceReport = {
  mode: "read-only";
  totalChecked: number;
  summary: Record<string, number>;
  items: RawIdentityEvidenceItem[];
  examples: RawIdentityEvidenceItem[];
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function existingDisplayName(candidate: AnyRecord) {
  return clean(candidate.display_name || candidate.full_name || candidate.candidate_name || candidate.name || "");
}

function splitLines(raw: string) {
  return raw.replace(/\r/g, "\n").split(/\n+/).map((line) => clean(line)).filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

const IDENTITY_KEYWORD_RE = /\b(?:name|full\s*name|candidate\s*name|personal\s+details|personal\s+particulars|contact|email|e-mail|phone|mobile|linkedin)\b/i;
const CONTACT_RE = /\b(?:contact|email|e-mail|phone|mobile|telephone|linkedin)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PLACEHOLDER_RE = /candidate profile pending validation|profile under review|personal particulars?|personal details/i;

function rawTextQuality(raw: string, lines: string[]) {
  if (!raw || raw.length < 120) return "not_enough_raw_text";
  const alpha = (raw.match(/[A-Za-z]/g) || []).length;
  const nonAscii = (raw.match(/[^\x00-\x7F]/g) || []).length;
  const oneLineHuge = lines.length <= 2 && raw.length > 1200;
  if (oneLineHuge || nonAscii / Math.max(raw.length, 1) > 0.08 || alpha / Math.max(raw.length, 1) < 0.35) return "ocr_garbled";
  return "readable_raw_text";
}

function linesNear(lines: string[], predicate: (line: string) => boolean, radius = 3) {
  const selected: string[] = [];
  lines.forEach((line, index) => {
    if (!predicate(line)) return;
    for (let i = Math.max(0, index - radius); i <= Math.min(lines.length - 1, index + radius); i += 1) selected.push(lines[i]);
  });
  return unique(selected);
}

function rawStartsAfterHeader(lines: string[]) {
  const first = lines.slice(0, 8).join(" ");
  if (!first) return false;
  return /\b(?:responsibilities|project|client|implementation|support|configuration|data migration|work experience|employment history)\b/i.test(first) && !CONTACT_RE.test(first) && !/\bname\b/i.test(first);
}

function looksExperienceOnly(lines: string[]) {
  const first = clean(lines[0]);
  if (/^(?:work experience|employment history|career history|project experience)$/i.test(first)) return true;
  const top = lines.slice(0, 30).join(" ");
  const hasExperience = /\b(?:responsibilities|project|client|implementation|support|configuration|rollout|migration|work experience|employment history|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|20\d{2})\b/i.test(top);
  const hasIdentity = /\b(?:full\s*name|candidate\s*name|email|phone|mobile|linkedin|contact details)\b/i.test(top);
  return hasExperience && !hasIdentity;
}

function classify(args: {
  raw: string;
  quality: string;
  possibleTop: string[];
  possibleNearContact: string[];
  onlyPlaceholder: boolean;
  startsAfterHeader: boolean;
  experienceOnly: boolean;
  bestCandidate: RawIdentityCandidate | null;
}): RawIdentityDiagnosticClassification {
  if (!args.raw || args.raw.length < 120) return "not_enough_raw_text";
  if (/^bản mô tả công việc/i.test(args.raw)) return "raw_text_unrelated_document";
  if (args.bestCandidate || args.possibleNearContact.length) return "name_evidence_present_parser_missed";
  if (args.onlyPlaceholder) return "only_placeholder_identity_present";
  if (args.quality === "ocr_garbled") return "raw_text_ocr_garbled";
  if (args.experienceOnly) return "raw_text_experience_only";
  if (args.possibleTop.length) return "possible_name_needs_review";
  if (args.startsAfterHeader) return "name_evidence_absent_raw_text_missing_header";
  return "name_evidence_absent_raw_text_missing_header";
}

export function parseRawIdentityEvidenceArgs(argv = process.argv.slice(2)): RawIdentityEvidenceOptions {
  const options: RawIdentityEvidenceOptions = {};
  for (const arg of argv) {
    if (arg === "--onlyBlockedIdentity") options.onlyBlockedIdentity = true;
    else if (arg === "--showSnippets") options.showSnippets = true;
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.split("=")[1]);
    else if (arg.startsWith("--candidateIds=")) options.candidateIds = arg.split("=")[1].split(",").map(clean).filter(Boolean);
  }
  return options;
}

export function filterRawIdentityEvidenceCandidates(candidates: AnyRecord[], options: RawIdentityEvidenceOptions = {}) {
  let selected = candidates.slice();
  if (options.candidateIds?.length) {
    const ids = new Set(options.candidateIds);
    selected = selected.filter((candidate) => ids.has(candidateId(candidate)));
  }
  if (options.onlyBlockedIdentity) {
    const blocked = new Set(auditFullCandidateExtraction(selected).items.filter((item) => item.reviewClassification === "blocked_identity").map((item) => item.candidateId));
    selected = selected.filter((candidate) => blocked.has(candidateId(candidate)));
  }
  if (options.limit && options.limit > 0) selected = selected.slice(0, options.limit);
  return selected;
}

export function auditRawIdentityEvidenceForCandidate(candidate: AnyRecord): RawIdentityEvidenceItem {
  const raw = candidateRawCvText(candidate);
  const lines = splitLines(raw);
  let parser: FullCandidateExtractionItem;
  try {
    parser = extractFullCandidateProfile(candidate);
  } catch {
    parser = { candidateId: candidateId(candidate), extractedFullName: "", reviewClassification: "manual_review_required", rawTextQualityReason: "parser_error" } as FullCandidateExtractionItem;
  }

  const quality = rawTextQuality(raw, lines);
  const identityKeywordLines = unique(lines.filter((line) => IDENTITY_KEYWORD_RE.test(line)).slice(0, 80));
  const contactLines = unique(lines.filter((line) => CONTACT_RE.test(line)).slice(0, 80));
  const nearContact = linesNear(lines, (line) => CONTACT_RE.test(line), 4).slice(0, 80);
  const extractedIdentityCandidates = extractRawIdentityCandidates(raw);
  const bestExtractedIdentityCandidate = extractedIdentityCandidates.find((candidate) => !candidate.rejectReason && candidate.confidence >= 75) || null;
  const topCandidates = extractedIdentityCandidates.filter((candidate) => !candidate.rejectReason && /header|labelled|compressed|particulars/i.test(candidate.source)).map((candidate) => candidate.possibleName);
  const nearCandidates = extractedIdentityCandidates.filter((candidate) => !candidate.rejectReason && /email|phone|contact/i.test(candidate.source)).map((candidate) => candidate.possibleName);
  const possibleTop = unique(topCandidates);
  const possibleNear = unique(nearCandidates);
  const onlyPlaceholder = Boolean(lines.length) && lines.slice(0, 30).some((line) => PLACEHOLDER_RE.test(line)) && !possibleTop.length && !possibleNear.length;
  const startsAfterHeader = rawStartsAfterHeader(lines);
  const experienceOnly = looksExperienceOnly(lines);
  const classification = classify({ raw, quality, possibleTop, possibleNearContact: possibleNear, onlyPlaceholder, startsAfterHeader, experienceOnly, bestCandidate: bestExtractedIdentityCandidate });
  const clear = Boolean(bestExtractedIdentityCandidate) || classification === "name_evidence_present_parser_missed";
  const initialReupload = ["name_evidence_absent_raw_text_missing_header", "only_placeholder_identity_present", "raw_text_experience_only", "raw_text_ocr_garbled", "not_enough_raw_text"].includes(classification);
  const unrelatedDocument = /^bản mô tả công việc/i.test(clean(lines[0]));
  const sufficientContactEvidence = raw.length >= 800 && (contactLines.length > 0 || nearContact.length > 0) && !unrelatedDocument;
  const reuploadRecommended = initialReupload && !clear && !sufficientContactEvidence;

  return {
    candidateId: candidateId(candidate),
    existingDisplayName: existingDisplayName(candidate),
    currentParserName: clean(parser.extractedFullName),
    parserReviewClassification: clean(parser.reviewClassification),
    rawTextLength: raw.length,
    rawTextQuality: quality,
    first30RawTextLines: lines.slice(0, 30),
    first1500Characters: raw.slice(0, 1500),
    identityKeywordLines,
    contactLines,
    linesNearEmailPhoneContactBlock: nearContact,
    possiblePersonNameLinesFromTop50: possibleTop,
    possiblePersonNameLinesNearEmailPhone: possibleNear,
    extractedIdentityCandidates,
    bestExtractedIdentityCandidate,
    clearNameEvidenceExists: clear,
    onlyPlaceholderNameExists: onlyPlaceholder,
    rawTextStartsAfterHeader: startsAfterHeader,
    rawTextLooksLikeExperienceOnly: experienceOnly,
    reuploadOriginalCvRecommended: reuploadRecommended,
    reuploadRecommendationRemovedByIdentityEvidence: initialReupload && !reuploadRecommended,
    diagnosticClassification: classification,
  };
}

export function auditRawIdentityEvidence(candidates: AnyRecord[], options: RawIdentityEvidenceOptions = {}): RawIdentityEvidenceReport {
  const selected = filterRawIdentityEvidenceCandidates(candidates, options);
  const items = selected.map(auditRawIdentityEvidenceForCandidate);
  const count = (predicate: (item: RawIdentityEvidenceItem) => boolean) => items.filter(predicate).length;
  return {
    mode: "read-only",
    totalChecked: items.length,
    summary: {
      totalChecked: items.length,
      clearNameEvidencePresent: count((item) => item.clearNameEvidenceExists),
      parserMissedName: count((item) => item.diagnosticClassification === "name_evidence_present_parser_missed"),
      aiProviderMissedNameCandidate: count((item) => item.clearNameEvidenceExists && !item.currentParserName),
      nameEvidenceAbsent: count((item) => ["name_evidence_absent_raw_text_missing_header", "only_placeholder_identity_present", "raw_text_experience_only", "not_enough_raw_text"].includes(item.diagnosticClassification)),
      rawTextMissingHeader: count((item) => item.diagnosticClassification === "name_evidence_absent_raw_text_missing_header"),
      rawTextExperienceOnly: count((item) => item.diagnosticClassification === "raw_text_experience_only"),
      ocrGarbled: count((item) => item.diagnosticClassification === "raw_text_ocr_garbled"),
      possibleNameNeedsReview: count((item) => item.diagnosticClassification === "possible_name_needs_review"),
      onlyPlaceholderIdentityPresent: count((item) => item.diagnosticClassification === "only_placeholder_identity_present"),
      notEnoughRawText: count((item) => item.diagnosticClassification === "not_enough_raw_text"),
      rawTextUnrelatedDocument: count((item) => item.diagnosticClassification === "raw_text_unrelated_document"),
      reuploadRecommended: count((item) => item.reuploadOriginalCvRecommended),
      reuploadRecommendedAfterIdentityEvidenceCorrection: count((item) => item.reuploadOriginalCvRecommended),
      reuploadRemovedBecauseNameEvidenceExists: count((item) => item.reuploadRecommendationRemovedByIdentityEvidence),
      extractedIdentityCandidates: items.reduce((sum, item) => sum + item.extractedIdentityCandidates.filter((candidate) => !candidate.rejectReason).length, 0),
      falsePositiveRejectedCount: count((item) => item.extractedIdentityCandidates.some((candidate) => candidate.rejectReason === "generic_title_or_job_description")),
      stillMissedLikelyNames: count((item) => !item.bestExtractedIdentityCandidate && item.possiblePersonNameLinesFromTop50.length > 0),
    },
    items,
    examples: items.slice(0, 30),
  };
}




